// ============================================================
// LEDGR — src/modules/finance/integration.service.ts
// Coração do módulo: AP × Fiscal × Contábil × Agenda em $transaction
// ============================================================

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import {
  FiscalDocument,
  FiscalDocumentType,
  AgendaColor,
  AgendaEventType,
  Prisma,
} from '@prisma/client';

// Mapeamento tipo de documento → cor do post-it
const DOC_TYPE_COLOR: Record<FiscalDocumentType, AgendaColor> = {
  NFE:       AgendaColor.YELLOW,
  NFSE:      AgendaColor.YELLOW,
  FATURA:    AgendaColor.BLUE,
  DUPLICATA: AgendaColor.BLUE,
  BOLETO:    AgendaColor.BLUE,
  CONSUMO:   AgendaColor.ORANGE,
  OUTROS:    AgendaColor.PURPLE,
};

// Conta contábil padrão para cada tipo (configurável futuro)
const DEFAULT_AP_ACCOUNT = '2.1.01'; // Fornecedores a Pagar

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helper para converter valores para Decimal ─────────────────
  private toDecimal(value?: string | number): Prisma.Decimal {
    if (value === undefined || value === null) return new Prisma.Decimal(0);
    if (typeof value === 'number') return new Prisma.Decimal(value);
    return new Prisma.Decimal(value || 0);
  }

  // ── Cria documento + dispara integração completa ────────────
  async createWithIntegration(
    companyId: string,
    dto: CreateFiscalDocumentDto,
    userId: string,
  ) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Cria o documento fiscal
        const doc = await tx.fiscalDocument.create({
          data: {
            companyId,
            documentType:   dto.documentType,
            documentNumber: dto.documentNumber,
            accessKey:      dto.accessKey,
            issuerCnpj:     dto.issuerCnpj,
            issuerName:     dto.issuerName,
            issuerStateReg: dto.issuerStateReg,
            issueDate:      new Date(dto.issueDate),
            dueDate:        new Date(dto.dueDate),
            competenceMonth: dto.competenceMonth,
            grossAmount:    this.toDecimal(dto.grossAmount),
            discountAmount: this.toDecimal(dto.discountAmount),
            netAmount:      this.toDecimal(dto.netAmount),
            irAmount:       this.toDecimal(dto.irAmount),
            pisAmount:      this.toDecimal(dto.pisAmount),
            cofinsAmount:   this.toDecimal(dto.cofinsAmount),
            csllAmount:     this.toDecimal(dto.csllAmount),
            issAmount:      this.toDecimal(dto.issAmount),
            inssAmount:     this.toDecimal(dto.inssAmount),
            expenseAccountId: dto.expenseAccountId,
            costCenter:     dto.costCenter,
            notes:          dto.notes,
            attachmentUrl:  dto.attachmentUrl,
            integrationStatus: 'PENDING',
            status: 'RASCUNHO',
            createdById: userId,
          },
        });

        // 2. Gera título no Contas a Pagar
        // 🔴 NOTA: O modelo 'accountsPayable' pode ter nome diferente no seu schema
        // Ajuste conforme necessário: 'apEntry', 'payable', 'accountsPayable'
        const apEntry = await tx.apEntry.create({
          data: {
            companyId,
            title:          `${doc.documentType} - ${doc.issuerName}`,
            description:    `Ref.: Doc. ${doc.documentNumber ?? 'S/N'} — ${doc.competenceMonth}`,
            dueDate:        doc.dueDate,
            amount:         doc.netAmount,
            status:         'OPEN',
            fiscalDocumentId: doc.id,
            supplierId:     null, // TODO: resolver supplierId via CNPJ lookup
            createdById: userId,
          },
        });

        // 3. Lança no Contábil (débito despesa / crédito fornecedores)
        const journalEntry = await tx.journalEntry.create({
          data: {
            companyId,
            date:           doc.issueDate, // 🔴 CORRIGIDO: 'entryDate' → 'date'
            description:    `Lançamento automático — ${doc.documentType} ${doc.issuerName}`,
            reference:      doc.documentNumber ?? doc.id,
            sourceModule:   'FINANCE', // 🔴 CORRIGIDO: 'isAutomatic' → 'sourceModule'
            createdById:    userId,
          },
        });

        // Criar items do lançamento
        await tx.journalEntryItem.createMany({
          data: [
            {
              // Débito: conta de despesa (configurável)
              journalEntryId: journalEntry.id,
              accountId:      dto.expenseAccountId ?? '3.1.01', // Despesas Gerais
              type:           'DEBIT',
              value:          doc.netAmount,
            },
            {
              // Crédito: fornecedores a pagar
              journalEntryId: journalEntry.id,
              accountId:      DEFAULT_AP_ACCOUNT,
              type:           'CREDIT',
              value:          doc.netAmount,
            },
          ],
        });

        // 4. Cria/atualiza evento na Agenda
        const agendaTitle = this.buildAgendaTitle(doc);
        const agendaEvent = await tx.agendaEvent.create({
          data: {
            companyId,
            eventType:        'PAYMENT',
            title:            agendaTitle,
            description:      `${doc.documentType} nº ${doc.documentNumber ?? 'S/N'} — ${doc.issuerName}`,
            color:            DOC_TYPE_COLOR[doc.documentType],
            dueDate:          doc.dueDate,
            amount:           doc.netAmount,
            isPaid:           false,
            fiscalDocumentId: doc.id,
            apEntryId:        apEntry.id,
            createdById:      userId,
          },
        });

        // 5. Atualiza o documento com os IDs gerados e status INTEGRATED
        const updated = await tx.fiscalDocument.update({
          where: { id: doc.id },
          data: {
            apEntryId:        apEntry.id,
            journalEntryId:   journalEntry.id,
            agendaEventId:    agendaEvent.id,
            integrationStatus: 'INTEGRATED',
          },
        });

        // 6. AuditLog
        await tx.auditLog.create({
          data: {
            actorId:    userId,
            action:     'CREATE',
            targetId:   doc.id,
            // 🔴 REMOVIDO: 'companyId' não existe no modelo AuditLog
            // companyId,
            // 🔴 ADICIONADO: campos obrigatórios do AuditLog
            before:     null,
            after:      JSON.stringify({
              fiscalDocumentId: doc.id,
              apEntryId:      apEntry.id,
              journalEntryId: journalEntry.id,
              agendaEventId:  agendaEvent.id,
            }),
            ip:         null,
          },
        });

        return {
          fiscalDocument: updated,
          apEntry,
          journalEntry,
          agendaEvent,
        };
      });

      return result;
    } catch (error) {
      this.logger.error('Falha na integração de documento fiscal', error);
      throw new InternalServerErrorException(
        'Falha ao integrar documento. Nenhuma alteração foi salva.',
      );
    }
  }

  // ── Re-integra um documento com status PENDING/ERROR ────────
  async runIntegration(doc: FiscalDocument, companyId: string, userId: string) {
    // Monta DTO a partir do documento existente para reusar createWithIntegration
    const dto: CreateFiscalDocumentDto = {
      documentType:   doc.documentType,
      documentNumber: doc.documentNumber ?? undefined,
      accessKey:      doc.accessKey ?? undefined,
      issuerCnpj:     doc.issuerCnpj,
      issuerName:     doc.issuerName,
      issuerStateReg: doc.issuerStateReg ?? undefined,
      issueDate:      doc.issueDate.toISOString(),
      dueDate:        doc.dueDate.toISOString(),
      competenceMonth: doc.competenceMonth,
      grossAmount:    Number(doc.grossAmount),
      netAmount:      Number(doc.netAmount),
      discountAmount: Number(doc.discountAmount),
      irAmount:       Number(doc.irAmount),
      pisAmount:      Number(doc.pisAmount),
      cofinsAmount:   Number(doc.cofinsAmount),
      csllAmount:     Number(doc.csllAmount),
      issAmount:      Number(doc.issAmount),
      inssAmount:     Number(doc.inssAmount),
      expenseAccountId: doc.expenseAccountId ?? undefined,
      costCenter:     doc.costCenter ?? undefined,
      notes:          doc.notes ?? undefined,
      attachmentUrl:  doc.attachmentUrl ?? undefined,
    };

    return this.createWithIntegration(companyId, dto, userId);
  }

  // ── Helpers ─────────────────────────────────────────────────
  private buildAgendaTitle(doc: FiscalDocument): string {
    const type = doc.documentType === 'CONSUMO' ? '⚡' : '🧾';
    const num  = doc.documentNumber ? ` #${doc.documentNumber}` : '';
    const name = doc.issuerName.length > 20
      ? doc.issuerName.slice(0, 20) + '…'
      : doc.issuerName;
    return `${type} ${name}${num}`;
  }
}
