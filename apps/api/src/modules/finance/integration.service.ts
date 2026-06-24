// apps/api/src/modules/finance/integration.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { FiscalDocument, FiscalDocumentType, AgendaColor, AgendaEventType, Prisma } from '@prisma/client';

const DOC_TYPE_COLOR: Record<FiscalDocumentType, AgendaColor> = {
  NFE: AgendaColor.YELLOW, NFSE: AgendaColor.YELLOW, FATURA: AgendaColor.BLUE,
  DUPLICATA: AgendaColor.BLUE, BOLETO: AgendaColor.BLUE, CONSUMO: AgendaColor.ORANGE, OUTROS: AgendaColor.PURPLE,
};

export interface IntegrationParty {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: 'DEBIT' | 'CREDIT';
  value: number;
  label: string;
}

export interface IntegrationPreview {
  mode: 'PRESTADOR' | 'TOMADOR';
  doc: {
    id: string; documentNumber: string; issuerName: string;
    grossAmount: number; netAmount: number; pisAmount: number;
    cofinsAmount: number; irAmount: number; inssAmount: number;
    csllAmount: number; issAmount: number; competenceMonth: string;
  };
  entries: IntegrationParty[];
  warnings: string[];
}

async function resolveAccount(
  prisma: PrismaService, companyId: string, namePattern: string, fallbackCode?: string
): Promise<{ id: string; code: string; name: string } | null> {
  const acc = await prisma.chartOfAccounts.findFirst({
    where: { companyId, deletedAt: null, name: { contains: namePattern, mode: 'insensitive' } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  return acc ?? null;
}

async function resolveAccountByCode(
  prisma: PrismaService, companyId: string, code: string
): Promise<{ id: string; code: string; name: string } | null> {
  const acc = await prisma.chartOfAccounts.findFirst({
    where: { companyId, deletedAt: null, code },
    select: { id: true, code: true, name: true },
  });
  return acc ?? null;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  constructor(private readonly prisma: PrismaService) {}

  private toDecimal(value?: string | number | null): Prisma.Decimal {
    if (value === undefined || value === null) return new Prisma.Decimal(0);
    if (typeof value === 'number') return new Prisma.Decimal(value);
    return new Prisma.Decimal(String(value) || '0');
  }

  private buildAgendaTitle(doc: FiscalDocument): string {
    const type = doc.documentType === 'CONSUMO' ? '\u26a1' : '\U0001f9fe';
    const num  = doc.documentNumber ? ` #${doc.documentNumber}` : '';
    const name = doc.issuerName.length > 20 ? doc.issuerName.slice(0, 20) + '\u2026' : doc.issuerName;
    return `${type} ${name}${num}`;
  }

  // ── Resolve contas da empresa para o lançamento ─────────────────────────
  private async resolveCompanyAccounts(companyId: string, doc: FiscalDocument, isPrestador: boolean) {
    const warnings: string[] = [];

    const find = async (patterns: string[], label: string) => {
      for (const p of patterns) {
        const acc = await resolveAccount(this.prisma, companyId, p);
        if (acc) return acc;
      }
      warnings.push(`Conta não encontrada: ${label}`);
      return null;
    };

    if (isPrestador) {
      // PRESTADOR: emitiu a nota — AR
      const arAcc  = await find(['Clientes Diversos', 'Clientes'], 'Clientes');
      const revAcc = await find(['Serviços Prestados', 'Prestação de Serviços'], 'Receita Serviços');
      const pisAcc = await find(['PIS a Recolher'], 'PIS a Recolher');
      const cofAcc = await find(['COFINS a Recolher'], 'COFINS a Recolher');
      const pisDedAcc = await this.prisma.chartOfAccounts.findFirst({
          where: { companyId, deletedAt: null, name: 'PIS', isAnalytic: true },
          select: { id: true, code: true, name: true },
        });
      const cofDedAcc = await this.prisma.chartOfAccounts.findFirst({
          where: { companyId, deletedAt: null, name: 'COFINS', isAnalytic: true },
          select: { id: true, code: true, name: true },
        });
      const irrfAcc = await find(['IRRF a Recuperar'], 'IRRF a Recuperar');
      const inssAcc = await find(['INSS a Recolher'], 'INSS a Recolher');
      const csllAcc = await find(['Provisao CSLL', 'Provisão CSLL'], 'Provisão CSLL');
      return { arAcc, revAcc, pisAcc, cofAcc, pisDedAcc, cofDedAcc, irrfAcc, inssAcc, csllAcc, warnings };
    } else {
      // TOMADOR: recebeu a nota — AP
      const apAcc  = await find(['Fornecedores', 'Contas a Pagar'], 'Fornecedores');
      const expAcc = doc.expenseAccountId
        ? await this.prisma.chartOfAccounts.findUnique({ where: { id: doc.expenseAccountId }, select: { id: true, code: true, name: true } })
        : await find(['Despesas Gerais', 'Serviços de Terceiros'], 'Despesa Serviços');
      return { apAcc, expAcc, warnings };
    }
  }

  // ── Preview: calcula sem persistir ──────────────────────────────────────
  async previewIntegration(docId: string, companyId: string): Promise<IntegrationPreview> {
    const doc = await this.prisma.fiscalDocument.findFirstOrThrow({ where: { id: docId, companyId } });
    const notes = (doc.notes ?? '').toUpperCase();
    const isPrestador = notes.includes('PRESTADOR') || notes.includes('EMITIDA');
    const mode = isPrestador ? 'PRESTADOR' : 'TOMADOR';

    const accs = await this.resolveCompanyAccounts(companyId, doc, isPrestador);
    const warnings = accs.warnings ?? [];
    const entries: IntegrationParty[] = [];

    const n = (v: any) => Number(v ?? 0);

    if (isPrestador) {
      const { arAcc, revAcc, pisAcc, cofAcc, pisDedAcc, cofDedAcc, irrfAcc, inssAcc, csllAcc } = accs as any;
      const bruto = n(doc.grossAmount);
      const pis   = n(doc.pisAmount);
      const cof   = n(doc.cofinsAmount);
      const ir    = n(doc.irAmount);
      const inss  = n(doc.inssAmount);
      const csll  = n(doc.csllAmount);

      if (arAcc)  entries.push({ accountId: arAcc.id,  accountCode: arAcc.code,  accountName: arAcc.name,  type: 'DEBIT',  value: bruto, label: 'Clientes a Receber' });
      if (revAcc) entries.push({ accountId: revAcc.id, accountCode: revAcc.code, accountName: revAcc.name, type: 'CREDIT', value: bruto, label: 'Receita de Serviços' });

      if (pis > 0 && pisDedAcc) entries.push({ accountId: pisDedAcc.id, accountCode: pisDedAcc.code, accountName: pisDedAcc.name, type: 'DEBIT',  value: pis, label: 'PIS s/ Receita' });
      if (pis > 0 && pisAcc)    entries.push({ accountId: pisAcc.id,    accountCode: pisAcc.code,    accountName: pisAcc.name,    type: 'CREDIT', value: pis, label: 'PIS a Recolher' });

      if (cof > 0 && cofDedAcc) entries.push({ accountId: cofDedAcc.id, accountCode: cofDedAcc.code, accountName: cofDedAcc.name, type: 'DEBIT',  value: cof, label: 'COFINS s/ Receita' });
      if (cof > 0 && cofAcc)    entries.push({ accountId: cofAcc.id,    accountCode: cofAcc.code,    accountName: cofAcc.name,    type: 'CREDIT', value: cof, label: 'COFINS a Recolher' });

      if (ir > 0 && irrfAcc) {
        entries.push({ accountId: irrfAcc.id, accountCode: irrfAcc.code, accountName: irrfAcc.name, type: 'DEBIT',  value: ir, label: 'IRRF Retido (a Recuperar)' });
        if (arAcc) entries.push({ accountId: arAcc.id, accountCode: arAcc.code, accountName: arAcc.name, type: 'CREDIT', value: ir, label: 'Clientes (IRRF retido)' });
      }
      if (inss > 0 && inssAcc) {
        entries.push({ accountId: inssAcc.id, accountCode: inssAcc.code, accountName: inssAcc.name, type: 'DEBIT',  value: inss, label: 'INSS Retido' });
        if (arAcc) entries.push({ accountId: arAcc.id, accountCode: arAcc.code, accountName: arAcc.name, type: 'CREDIT', value: inss, label: 'Clientes (INSS retido)' });
      }
      if (csll > 0 && csllAcc) {
        entries.push({ accountId: csllAcc.id, accountCode: csllAcc.code, accountName: csllAcc.name, type: 'DEBIT',  value: csll, label: 'CSLL Retida' });
        if (arAcc) entries.push({ accountId: arAcc.id, accountCode: arAcc.code, accountName: arAcc.name, type: 'CREDIT', value: csll, label: 'Clientes (CSLL retida)' });
      }
    } else {
      const { apAcc, expAcc } = accs as any;
      const net = n(doc.netAmount);
      if (expAcc) entries.push({ accountId: expAcc.id, accountCode: expAcc.code, accountName: expAcc.name, type: 'DEBIT',  value: net, label: 'Despesa' });
      if (apAcc)  entries.push({ accountId: apAcc.id,  accountCode: apAcc.code,  accountName: apAcc.name,  type: 'CREDIT', value: net, label: 'Fornecedores a Pagar' });
    }

    return {
      mode,
      doc: {
        id: doc.id, documentNumber: doc.documentNumber ?? '', issuerName: doc.issuerName,
        grossAmount: n(doc.grossAmount), netAmount: n(doc.netAmount),
        pisAmount: n(doc.pisAmount), cofinsAmount: n(doc.cofinsAmount),
        irAmount: n(doc.irAmount), inssAmount: n(doc.inssAmount),
        csllAmount: n(doc.csllAmount), issAmount: n(doc.issAmount),
        competenceMonth: doc.competenceMonth,
      },
      entries,
      warnings,
    };
  }

  // ── runIntegration: persiste ─────────────────────────────────────────────
  async runIntegration(doc: FiscalDocument, companyId: string, userId: string) {
    const notes = (doc.notes ?? '').toUpperCase();
    const isPrestador = notes.includes('PRESTADOR') || notes.includes('EMITIDA');
    const mode = isPrestador ? 'PRESTADOR' : 'TOMADOR';
    const accs = await this.resolveCompanyAccounts(companyId, doc, isPrestador);
    const n = (v: any) => Number(v ?? 0);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (isPrestador) {
          const { arAcc, revAcc, pisAcc, cofAcc, pisDedAcc, cofDedAcc, irrfAcc, inssAcc, csllAcc } = accs as any;
          const bruto = n(doc.grossAmount);
          const pis   = n(doc.pisAmount);
          const cof   = n(doc.cofinsAmount);
          const ir    = n(doc.irAmount);
          const inss  = n(doc.inssAmount);
          const csll  = n(doc.csllAmount);
          const netAr = bruto - ir - inss - csll;

          // AR
          const arEntry = await tx.arEntry.create({
            data: {
              companyId, title: `NFS-e ${doc.documentNumber ?? 'S/N'} - ${doc.issuerName}`,
              description: `Competência ${doc.competenceMonth}`,
              documentNumber: doc.documentNumber ?? undefined,
              origin: 'FISCAL_DOCUMENT', issueDate: doc.issueDate,
              dueDate: doc.dueDate, competenceMonth: doc.competenceMonth,
              amount: new Prisma.Decimal(netAr), status: 'OPEN',
              fiscalDocumentId: doc.id, createdById: userId,
            },
          });

          // Lançamento contábil
          const je = await tx.journalEntry.create({
            data: {
              companyId, date: doc.issueDate,
              description: `NFS-e ${doc.documentNumber ?? 'S/N'} — ${doc.issuerName} (Prestador)`,
              reference: doc.documentNumber ?? doc.id, sourceModule: 'FISCAL', createdById: userId,
            },
          });

          const items: any[] = [];
          if (arAcc)  items.push({ journalEntryId: je.id, accountId: arAcc.id,  type: 'DEBIT',  value: new Prisma.Decimal(bruto) });
          if (revAcc) items.push({ journalEntryId: je.id, accountId: revAcc.id, type: 'CREDIT', value: new Prisma.Decimal(bruto) });
          if (pis > 0 && pisDedAcc) items.push({ journalEntryId: je.id, accountId: pisDedAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(pis) });
          if (pis > 0 && pisAcc)    items.push({ journalEntryId: je.id, accountId: pisAcc.id,    type: 'CREDIT', value: new Prisma.Decimal(pis) });
          if (cof > 0 && cofDedAcc) items.push({ journalEntryId: je.id, accountId: cofDedAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(cof) });
          if (cof > 0 && cofAcc)    items.push({ journalEntryId: je.id, accountId: cofAcc.id,    type: 'CREDIT', value: new Prisma.Decimal(cof) });
          if (ir > 0 && irrfAcc && arAcc) {
            items.push({ journalEntryId: je.id, accountId: irrfAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(ir) });
            items.push({ journalEntryId: je.id, accountId: arAcc.id,   type: 'CREDIT', value: new Prisma.Decimal(ir) });
          }
          if (inss > 0 && inssAcc && arAcc) {
            items.push({ journalEntryId: je.id, accountId: inssAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(inss) });
            items.push({ journalEntryId: je.id, accountId: arAcc.id,   type: 'CREDIT', value: new Prisma.Decimal(inss) });
          }
          if (csll > 0 && csllAcc && arAcc) {
            items.push({ journalEntryId: je.id, accountId: csllAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(csll) });
            items.push({ journalEntryId: je.id, accountId: arAcc.id,   type: 'CREDIT', value: new Prisma.Decimal(csll) });
          }
          if (items.length) await tx.journalEntryItem.createMany({ data: items });

          const agendaEvent = await tx.agendaEvent.create({
            data: {
              companyId, eventType: 'OTHER', title: this.buildAgendaTitle(doc),
              description: `NFS-e nº ${doc.documentNumber ?? 'S/N'} — ${doc.issuerName}`,
              color: DOC_TYPE_COLOR[doc.documentType], dueDate: doc.dueDate,
              amount: new Prisma.Decimal(netAr), isPaid: false,
              fiscalDocumentId: doc.id, createdById: userId,
            },
          });

          await tx.fiscalDocument.update({
            where: { id: doc.id },
            data: { journalEntryId: je.id, agendaEventId: agendaEvent.id, integrationStatus: 'INTEGRATED' },
          });

          return { mode, arEntry, journalEntryId: je.id };

        } else {
          const { apAcc, expAcc } = accs as any;
          const net = n(doc.netAmount);

          const apEntry = await tx.apEntry.create({
            data: {
              companyId, title: `${doc.documentType} - ${doc.issuerName}`,
              description: `Doc. ${doc.documentNumber ?? 'S/N'} — ${doc.competenceMonth}`,
              documentNumber: doc.documentNumber ?? undefined,
              issueDate: doc.issueDate, dueDate: doc.dueDate,
              amount: new Prisma.Decimal(net), status: 'OPEN',
              fiscalDocumentId: doc.id, createdById: userId,
            },
          });

          const je = await tx.journalEntry.create({
            data: {
              companyId, date: doc.issueDate,
              description: `${doc.documentType} ${doc.issuerName} (Tomador)`,
              reference: doc.documentNumber ?? doc.id, sourceModule: 'FISCAL', createdById: userId,
            },
          });

          const items: any[] = [];
          if (expAcc) items.push({ journalEntryId: je.id, accountId: expAcc.id, type: 'DEBIT',  value: new Prisma.Decimal(net) });
          if (apAcc)  items.push({ journalEntryId: je.id, accountId: apAcc.id,  type: 'CREDIT', value: new Prisma.Decimal(net) });
          if (items.length) await tx.journalEntryItem.createMany({ data: items });

          const agendaEvent = await tx.agendaEvent.create({
            data: {
              companyId, eventType: 'PAYMENT', title: this.buildAgendaTitle(doc),
              description: `${doc.documentType} nº ${doc.documentNumber ?? 'S/N'} — ${doc.issuerName}`,
              color: DOC_TYPE_COLOR[doc.documentType], dueDate: doc.dueDate,
              amount: new Prisma.Decimal(net), isPaid: false,
              fiscalDocumentId: doc.id, apEntryId: apEntry.id, createdById: userId,
            },
          });

          await tx.fiscalDocument.update({
            where: { id: doc.id },
            data: { apEntryId: apEntry.id, journalEntryId: je.id, agendaEventId: agendaEvent.id, integrationStatus: 'INTEGRATED' },
          });

          return { mode, apEntry, journalEntryId: je.id };
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Falha na integracao fiscal', error);
      await this.prisma.fiscalDocument.update({ where: { id: doc.id }, data: { integrationStatus: 'ERROR' } }).catch(() => {});
      throw new InternalServerErrorException(`Falha ao integrar: ${(error as any)?.message?.slice(0, 200)}`);
    }
  }

  async createWithIntegration(companyId: string, dto: CreateFiscalDocumentDto, userId: string) {
    const doc = await this.prisma.fiscalDocument.create({
      data: {
        companyId, documentType: dto.documentType, documentNumber: dto.documentNumber,
        accessKey: dto.accessKey, issuerCnpj: dto.issuerCnpj, issuerName: dto.issuerName,
        issuerStateReg: dto.issuerStateReg, issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate), competenceMonth: dto.competenceMonth,
        grossAmount: this.toDecimal(dto.grossAmount), discountAmount: this.toDecimal(dto.discountAmount),
        netAmount: this.toDecimal(dto.netAmount), irAmount: this.toDecimal(dto.irAmount),
        pisAmount: this.toDecimal(dto.pisAmount), cofinsAmount: this.toDecimal(dto.cofinsAmount),
        csllAmount: this.toDecimal(dto.csllAmount), issAmount: this.toDecimal(dto.issAmount),
        inssAmount: this.toDecimal(dto.inssAmount), expenseAccountId: dto.expenseAccountId,
        costCenter: dto.costCenter, notes: dto.notes, attachmentUrl: dto.attachmentUrl,
        integrationStatus: 'PENDING', status: 'RASCUNHO', createdById: userId,
      },
    });
    return this.runIntegration(doc, companyId, userId);
  }
}
