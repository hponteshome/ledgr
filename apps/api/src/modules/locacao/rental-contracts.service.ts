// apps/api/src/modules/locacao/rental-contracts.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma, DocumentType, DocumentStatus, DocumentVisibility } from '@prisma/client';
import { CreateRentalContractDto, UpdateRentalContractDto } from './dto/rental-contract.dto';
import * as crypto from 'crypto';
import * as Handlebars from 'handlebars';
import { DocumentsService } from '../../core/documents/documents.service';
import { valorPorExtenso } from './utils/extenso.util';
import {
  formatDateBR,
  formatDateExtenso,
  formatCurrencyBRL,
  formatCep,
  formatCpfCnpj,
  monthsBetween,
  maritalStatusLabel,
  guaranteeTypeLabel,
  readjustmentIndexLabel,
  resolveGender,
  termosLocatario,
  termosFiador,
} from './utils/contract-format.util';

function toDecimal(value: number | string | undefined | null): Prisma.Decimal | undefined {
  if (value === undefined || value === null || (value as any) === '') return undefined;
  const normalized = String(value).replace(',', '.');
  return new Prisma.Decimal(normalized);
}

function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  // Campos DATE-only (sem hora): o driver pg le/grava usando getters LOCAIS do
  // processo Node (documentado em node-postgres), nao UTC. Construir via
  // new Date(ano, mes-1, dia) (construtor local) garante que o dia gravado no
  // Postgres seja exatamente o dia pretendido, independente do fuso do processo
  // (desde que TZ esteja fixado corretamente - ver main.ts).
  const parts = value.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

@Injectable()
export class RentalContractsService {
  constructor(private prisma: PrismaService, private documents: DocumentsService) {}

  async findAll(companyId: string, status?: string) {
    return this.prisma.rentalContract.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        fixedAsset: { select: { id: true, description: true, internalCode: true } },
        tenant: { select: { id: true, fullName: true, cpf: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.rentalContract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { fixedAsset: true, tenant: true },
    });
    if (!found) throw new NotFoundException('Contrato de locacao nao encontrado.');
    if (found.documentId) {
      const doc = await this.prisma.document.findUnique({
        where: { id: found.documentId },
        select: { id: true, status: true, currentVersion: true },
      });
      return { ...found, document: doc };
    }
    return found;
  }

  // Recorrencia mensal de aluguel: gera o ArEntry (origin ALUGUEL) + JournalEntry
  // (Debito Alugueis a Receber / Credito Receita de Alugueis, cada partida ja
  // marcada com assetId do imovel) para cada contrato ATIVO vigente na
  // competencia, uma unica vez por contrato+mes (idempotente via
  // @@unique([rentalContractId, competenceMonth])). Espelha o padrao ja
  // validado do ProvisaoService.gerarLancamentos() (lado despesa), agora
  // para o lado receita. NOVO 25/09/2026.
  async gerarLancamentos(companyId: string, userId: string, competencia: string) {
    const config = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (!config?.locacaoContaReceitaAlugueisId || !config?.locacaoContaAlugueisAReceberId) {
      throw new BadRequestException(
        "Configure as contas de Receita de Aluguéis e Aluguéis a Receber na aba Contábil antes de gerar os lançamentos.",
      );
    }

    const [y, m] = competencia.split('-').map(Number);
    const inicioMes = new Date(Date.UTC(y, m - 1, 1));
    const fimMes = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const contratos = await this.prisma.rentalContract.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "ATIVO",
        startDate: { lte: fimMes },
        OR: [{ endDate: null }, { endDate: { gte: inicioMes } }],
      },
      include: { fixedAsset: { select: { id: true, internalCode: true, description: true } } },
    });

    const results: any[] = [];
    for (const contrato of contratos) {
      const existing = await this.prisma.arEntry.findFirst({
        where: { rentalContractId: contrato.id, competenceMonth: competencia },
      });
      if (existing) {
        results.push({ contratoId: contrato.id, imovel: contrato.fixedAsset.internalCode, status: "ja_existia" });
        continue;
      }

      // CORRIGIDO 23/10/2026: aluguel e pago no mes SEGUINTE ao da competencia (vencido),
      // no dia contratado; periodicidade nao mensal (ex.: temporada) usa as datas explicitas.
      let venc = new Date(Date.UTC(y, m, contrato.dueDay, 12));
      if (venc.getUTCMonth() !== m % 12) venc.setUTCDate(0);
      const datasExplicitas: string[] = Array.isArray(contrato.explicitDueDates) ? (contrato.explicitDueDates as any[]).map(String) : [];
      if (contrato.duePeriodicity !== 'MENSAL' && datasExplicitas.length > 0) {
        const ini = new Date(contrato.startDate);
        const idx = (y - ini.getUTCFullYear()) * 12 + (m - 1 - ini.getUTCMonth());
        const d = datasExplicitas[Math.min(Math.max(idx, 0), datasExplicitas.length - 1)];
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) venc = new Date(d + 'T12:00:00Z');
      }
      // receita reconhecida no ultimo dia do mes de competencia (Lucro Real)
      const dataCompetencia = new Date(Date.UTC(y, m, 0, 12));

      const amount = contrato.rentAmount;
      const titulo = "Aluguel " + contrato.fixedAsset.internalCode + " - " + competencia;

      const arEntry = await this.prisma.$transaction(async (tx) => {
        const journalEntry = await tx.journalEntry.create({
          data: {
            companyId,
            date: dataCompetencia,
            description: "Receita de competência: " + titulo,
            sourceModule: "FINANCE",
            createdById: userId,
            items: {
              create: [
                { accountId: config.locacaoContaAlugueisAReceberId!, value: amount, type: "DEBIT", assetId: contrato.fixedAssetId },
                { accountId: config.locacaoContaReceitaAlugueisId!, value: amount, type: "CREDIT", assetId: contrato.fixedAssetId },
              ],
            },
          },
        });

        // NOVO 23/10/2026: evento na Agenda Financeira para o recebimento
        const agenda = await tx.agendaEvent.create({
          data: {
            companyId,
            eventType: 'OTHER',
            title: 'Recebimento ' + titulo,
            description: contrato.tenantName,
            color: 'BLUE',
            dueDate: venc,
            amount,
            createdById: userId,
          },
        });

        return tx.arEntry.create({
          data: {
            companyId,
            title: titulo,
            origin: "ALUGUEL",
            issueDate: inicioMes,
            dueDate: venc,
            competenceMonth: competencia,
            amount,
            customerName: contrato.tenantName,
            customerCnpjCpf: contrato.tenantTaxId,
            customerId: contrato.tenantId,
            fixedAssetId: contrato.fixedAssetId,
            rentalContractId: contrato.id,
            revenueAccountId: config.locacaoContaReceitaAlugueisId!,
            receivableAccountId: config.locacaoContaAlugueisAReceberId!,
            journalEntryId: journalEntry.id,
            agendaEventId: agenda.id,
            createdById: userId,
          },
        });
      });

      results.push({ contratoId: contrato.id, imovel: contrato.fixedAsset.internalCode, status: "gerado", arEntryId: arEntry.id });
    }

    return { competencia, total: contratos.length, results };
  }

  // NOVO 23/10/2026: alertas de locacao para o Dashboard - fim de contrato (90 dias),
  // reajuste pendente (aniversario/data-base ja passou e nao ha reajuste aplicado depois dele),
  // reajuste proximo (60 dias) e recebimentos de aluguel vencidos ou a vencer em 15 dias.
  // Temporada (periodicidade nao mensal) nao gera alerta de reajuste.
  async alertas(companyId: string) {
    const DIA = 86400000;
    const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const dias = (d: Date) => Math.round((d.getTime() - hoje.getTime()) / DIA);
    const utc = (v: Date | string) => { const s = new Date(v).toISOString().slice(0, 10); return new Date(s + 'T00:00:00Z'); };
    const addMeses = (d: Date, n: number) => {
      const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
      if (r.getUTCDate() !== d.getUTCDate()) r.setUTCDate(0);
      return r;
    };

    const contratos = await this.prisma.rentalContract.findMany({
      where: { companyId, deletedAt: null, status: 'ATIVO' },
      include: { fixedAsset: { select: { internalCode: true } } },
    });
    const alertas: any[] = [];
    for (const c of contratos) {
      const imovel = c.fixedAsset.internalCode;
      const ini = utc(c.startDate);
      const fim = c.endDate ? utc(c.endDate) : null;
      if (fim && c.duePeriodicity === 'MENSAL') { // temporada termina por natureza - sem alerta
        const d = dias(fim);
        if (d <= 90) alertas.push({
          tipo: 'FIM_CONTRATO', severidade: d <= 30 ? 'alta' : 'media', contratoId: c.id, imovel, data: iso(fim), dias: d,
          mensagem: d < 0 ? `Contrato venceu há ${-d} dias - renovar ou encerrar` : d === 0 ? 'Contrato termina hoje' : `Contrato termina em ${d} dias`,
        });
      }
      if (c.duePeriodicity !== 'MENSAL') continue;
      const per = c.readjustmentPeriodMonths || 12;
      const aplicado = c.lastReadjustmentDate ? utc(c.lastReadjustmentDate) : null;
      let ultimoAniv: Date | null = null;
      let proximo: Date | null = null;
      for (let k = 1; k < 200; k++) {
        const a = addMeses(ini, per * k);
        if (a <= hoje) ultimoAniv = a; else { proximo = a; break; }
      }
      if (c.nextReadjustmentDate) {
        const nx = utc(c.nextReadjustmentDate);
        if (nx <= hoje) { ultimoAniv = nx; proximo = addMeses(nx, per); } else { ultimoAniv = null; proximo = nx; }
      }
      const indice = c.readjustmentIndex ?? 'sem índice cadastrado';
      if (ultimoAniv && hoje.getTime() - ultimoAniv.getTime() <= 365 * DIA && (!aplicado || aplicado < ultimoAniv)) {
        alertas.push({
          tipo: 'REAJUSTE_PENDENTE', severidade: 'media', contratoId: c.id, imovel, data: iso(ultimoAniv), dias: dias(ultimoAniv),
          mensagem: `Reajuste (${indice}) a aplicar - data-base ${iso(ultimoAniv).split('-').reverse().join('/')}`,
        });
      }
      if (proximo && fim && proximo > fim) proximo = null;
      if (proximo && dias(proximo) <= 60) {
        alertas.push({
          tipo: 'REAJUSTE_PROXIMO', severidade: 'baixa', contratoId: c.id, imovel, data: iso(proximo), dias: dias(proximo),
          mensagem: `Reajuste (${indice}) em ${dias(proximo)} dias`,
        });
      }
    }

    const titulos = await this.prisma.arEntry.findMany({
      where: {
        companyId, deletedAt: null, rentalContractId: { not: null },
        status: { in: ['OPEN', 'OVERDUE', 'PARTIAL'] as any },
        dueDate: { lte: new Date(hoje.getTime() + 15 * DIA) },
      },
      include: { fixedAsset: { select: { internalCode: true } } },
      orderBy: { dueDate: 'asc' },
    });
    for (const t of titulos) {
      const venc = utc(t.dueDate);
      const d = dias(venc);
      const saldo = Number(t.amount) - Number(t.receivedAmount ?? 0);
      if (saldo <= 0) continue;
      alertas.push({
        tipo: 'RECEBIMENTO', severidade: d < 0 ? 'alta' : 'baixa', contratoId: t.rentalContractId, imovel: t.fixedAsset?.internalCode ?? '',
        data: iso(venc), dias: d, valor: saldo,
        mensagem: d < 0 ? `Aluguel ${t.competenceMonth ?? ''} vencido há ${-d} dias` : `Aluguel ${t.competenceMonth ?? ''} vence em ${d} dias`,
      });
    }

    const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade] || String(a.data).localeCompare(String(b.data)));
    return { geradoEm: new Date().toISOString(), total: alertas.length, alertas };
  }

  async create(companyId: string, userId: string, dto: CreateRentalContractDto) {
    return this.prisma.rentalContract.create({
      data: {
        companyId,
        createdById: userId,
        contractNumber: dto.contractNumber,
        fixedAssetId: dto.fixedAssetId,
        tenantId: dto.tenantId,
        tenantName: dto.tenantName,
        tenantTaxId: dto.tenantTaxId,
        tenantRg: dto.tenantRg,
        tenantProfession: dto.tenantProfession,
        tenantMaritalStatus: dto.tenantMaritalStatus,
        tenantGender: dto.tenantGender === '' ? null : dto.tenantGender,
        guarantorGender: dto.guarantorGender === '' ? null : dto.guarantorGender,
        specificClauses: dto.specificClauses === '' ? null : dto.specificClauses,
        guarantorHasSpouse: dto.guarantorHasSpouse,
        tenantNationality: dto.tenantNationality,
        tenantStreet: dto.tenantStreet,
        tenantNumber: dto.tenantNumber,
        tenantComplement: dto.tenantComplement,
        tenantNeighborhood: dto.tenantNeighborhood,
        tenantCity: dto.tenantCity,
        tenantState: dto.tenantState,
        tenantZipCode: dto.tenantZipCode,
        startDate: toDate(dto.startDate)!,
        endDate: toDate(dto.endDate),
        rentAmount: toDecimal(dto.rentAmount)!,
        duePeriodicity: dto.duePeriodicity,
        dueDay: dto.dueDay,
        firstDueDate: toDate(dto.firstDueDate)!,
        explicitDueDates: dto.explicitDueDates,
        guaranteeType: dto.guaranteeType,
        guaranteeDescription: dto.guaranteeDescription,
        policyNumber: dto.policyNumber,
        policyStartDate: toDate(dto.policyStartDate),
        policyEndDate: toDate(dto.policyEndDate),
        policyCoverage: toDecimal(dto.policyCoverage),
        policyPremium: toDecimal(dto.policyPremium),
        readjustmentPeriodMonths: dto.readjustmentPeriodMonths,
        readjustmentIndex: dto.readjustmentIndex,
        readjustmentIndexOther: dto.readjustmentIndexOther,
        penaltyDescription: dto.penaltyDescription,
        penaltyReleaseDeadlineDays: dto.penaltyReleaseDeadlineDays,
        bonusDescription: dto.bonusDescription,
        bonusStartDate: toDate(dto.bonusStartDate),
        bonusEndDate: toDate(dto.bonusEndDate),
        hasIntermediary: dto.hasIntermediary ?? false,
        intermediaryType: dto.intermediaryType,
        intermediaryName: dto.intermediaryName,
        intermediaryTaxId: dto.intermediaryTaxId,
        intermediaryCreci: dto.intermediaryCreci,
        intermediaryManagesCollection: dto.intermediaryManagesCollection ?? false,
        intermediaryAdminFeeAmount: toDecimal(dto.intermediaryAdminFeeAmount),
        intermediaryCommissionPercent: toDecimal(dto.intermediaryCommissionPercent),
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
        nextReadjustmentDate: toDate(dto.nextReadjustmentDate),
        lastReadjustmentDate: toDate(dto.lastReadjustmentDate),
      },
    });
  }

  async update(companyId: string, userId: string, id: string, dto: UpdateRentalContractDto) {
    await this.findOne(companyId, id);
    return this.prisma.rentalContract.update({
      where: { id },
      data: {
        updatedById: userId,
        contractNumber: dto.contractNumber,
        fixedAssetId: dto.fixedAssetId,
        tenantId: dto.tenantId,
        tenantName: dto.tenantName,
        tenantTaxId: dto.tenantTaxId,
        tenantRg: dto.tenantRg,
        tenantProfession: dto.tenantProfession,
        tenantMaritalStatus: dto.tenantMaritalStatus,
        tenantGender: dto.tenantGender === '' ? null : dto.tenantGender,
        guarantorGender: dto.guarantorGender === '' ? null : dto.guarantorGender,
        specificClauses: dto.specificClauses === '' ? null : dto.specificClauses,
        guarantorHasSpouse: dto.guarantorHasSpouse,
        tenantNationality: dto.tenantNationality,
        tenantStreet: dto.tenantStreet,
        tenantNumber: dto.tenantNumber,
        tenantComplement: dto.tenantComplement,
        tenantNeighborhood: dto.tenantNeighborhood,
        tenantCity: dto.tenantCity,
        tenantState: dto.tenantState,
        tenantZipCode: dto.tenantZipCode,
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        rentAmount: toDecimal(dto.rentAmount),
        duePeriodicity: dto.duePeriodicity,
        dueDay: dto.dueDay,
        firstDueDate: toDate(dto.firstDueDate),
        explicitDueDates: dto.explicitDueDates,
        guaranteeType: dto.guaranteeType,
        guaranteeDescription: dto.guaranteeDescription,
        policyNumber: dto.policyNumber,
        policyStartDate: toDate(dto.policyStartDate),
        policyEndDate: toDate(dto.policyEndDate),
        policyCoverage: toDecimal(dto.policyCoverage),
        policyPremium: toDecimal(dto.policyPremium),
        readjustmentPeriodMonths: dto.readjustmentPeriodMonths,
        readjustmentIndex: dto.readjustmentIndex,
        readjustmentIndexOther: dto.readjustmentIndexOther,
        penaltyDescription: dto.penaltyDescription,
        penaltyReleaseDeadlineDays: dto.penaltyReleaseDeadlineDays,
        bonusDescription: dto.bonusDescription,
        bonusStartDate: toDate(dto.bonusStartDate),
        bonusEndDate: toDate(dto.bonusEndDate),
        hasIntermediary: dto.hasIntermediary,
        intermediaryType: dto.intermediaryType,
        intermediaryName: dto.intermediaryName,
        intermediaryTaxId: dto.intermediaryTaxId,
        intermediaryCreci: dto.intermediaryCreci,
        intermediaryManagesCollection: dto.intermediaryManagesCollection,
        intermediaryAdminFeeAmount: toDecimal(dto.intermediaryAdminFeeAmount),
        intermediaryCommissionPercent: toDecimal(dto.intermediaryCommissionPercent),
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
        nextReadjustmentDate: toDate(dto.nextReadjustmentDate),
        lastReadjustmentDate: toDate(dto.lastReadjustmentDate),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.rentalContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async generateDocument(companyId: string, userId: string, id: string, force = false, dataInstrumento?: string, templateId?: string) {
    // Data do instrumento (29/09/2026): obrigatoria a cada geracao, confirmada pelo usuario no Quadro Resumo.
    const dataInst = /^\d{4}-\d{2}-\d{2}$/.test(dataInstrumento ?? '') ? (dataInstrumento as string) : '';
    if (!dataInst) throw new BadRequestException('Informe e confirme a data do instrumento para gerar o contrato.');
    const [yi, mi, di] = dataInst.split('-').map(Number);
    const dataInstUtc = new Date(Date.UTC(yi, mi - 1, di));

    const contract = await this.prisma.rentalContract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { fixedAsset: true, company: true },
    });
    if (!contract) throw new NotFoundException('Contrato de locacao nao encontrado.');
    await this.prisma.rentalContract.update({ where: { id: contract.id }, data: { instrumentDate: toDate(dataInst) } });

    const template = await this.resolveTemplate(companyId, templateId);
    await this.prisma.rentalContract.update({ where: { id: contract.id }, data: { templateId: template.id } });

    let existingDoc: { id: string; status: string; currentVersion: number; revisionImportedAt: Date | null } | null = null;
    if (contract.documentId) {
      existingDoc = await this.prisma.document.findUnique({
        where: { id: contract.documentId },
        select: { id: true, status: true, currentVersion: true, revisionImportedAt: true },
      });
      if (existingDoc && existingDoc.status !== 'RASCUNHO') {
        throw new BadRequestException(
          `Este contrato ja possui um documento com status ${existingDoc.status}. Nao e possivel gerar novamente. Para reiniciar, exclua o documento em Arquivos Digitais primeiro.`,
        );
      }
    }

    if (existingDoc?.revisionImportedAt && !force) {
      throw new ConflictException(
        'Este documento tem uma versao revisada importada do Word. Gerar novamente substitui o texto pela versao do template (a revisao continua no historico de versoes).',
      );
    }

    const dados = this.buildContext(contract, dataInstUtc);
    const html = this.renderTemplate(template.content, dados);
    const contentHash = crypto.createHash('sha256').update(html).digest('hex');

    const ddmmyy = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${dd}${mm}${yy}`;
    };
    const inicio = ddmmyy(contract.startDate);
    const fim = contract.endDate ? ddmmyy(contract.endDate) : 'indeterminado';
    const documentTitle = `Locação_${contract.fixedAsset.internalCode}_${inicio}a${fim}.pdf`;

    let document;
    if (existingDoc) {
      const newVersion = existingDoc.currentVersion + 1;
      await this.prisma.documentVersion.create({
        data: {
          documentId: existingDoc.id,
          version: newVersion,
          content: html,
          contentHash,
          changeNote: `Contrato regerado (template: ${template.name} v${template.version}) - v${newVersion}`,
          createdById: userId,
        },
      });
      document = await this.prisma.document.update({
        where: { id: existingDoc.id },
        data: { title: documentTitle, content: html, contentHash, currentVersion: newVersion, revisionImportedAt: null, templateId: template.id, templateVersion: template.version, updatedAt: new Date() },
      });
      await this.prisma.rentalContract.update({
        where: { id: contract.id },
        data: { updatedById: userId },
      });
    } else {
      document = await this.prisma.document.create({
        data: {
          companyId,
          type: DocumentType.CONTRATO_LOCACAO,
          status: DocumentStatus.RASCUNHO,
          visibility: DocumentVisibility.RESERVADO,
          title: documentTitle,
          date: new Date(),
          content: html,
          contentHash,
          templateId: template.id,
          templateVersion: template.version,
          createdById: userId,
        },
      });
      await this.prisma.rentalContract.update({
        where: { id: contract.id },
        data: { documentId: document.id, updatedById: userId },
      });
    }

    return document;
  }

  // Template (30/09/2026): o escolhido na geracao ou, sem escolha, o padrao da empresa,
  // depois o padrao global e, por fim, o ativo mais recente.
  private async resolveTemplate(companyId: string, templateId?: string) {
    const base = { type: DocumentType.CONTRATO_LOCACAO, isActive: true, deletedAt: null };
    if (templateId) {
      const t = await this.prisma.documentTemplate.findFirst({
        where: { ...base, id: templateId, OR: [{ companyId: null }, { companyId }] },
      });
      if (!t) throw new BadRequestException('Template selecionado nao encontrado ou inativo.');
      return t;
    }
    const t =
      (await this.prisma.documentTemplate.findFirst({ where: { ...base, companyId, isDefault: true } })) ??
      (await this.prisma.documentTemplate.findFirst({ where: { ...base, companyId: null, isDefault: true } })) ??
      (await this.prisma.documentTemplate.findFirst({ where: { ...base, companyId }, orderBy: { updatedAt: 'desc' } })) ??
      (await this.prisma.documentTemplate.findFirst({ where: { ...base, companyId: null }, orderBy: { updatedAt: 'desc' } }));
    if (!t) throw new NotFoundException('Nenhum template ativo de Contrato de Locacao encontrado.');
    return t;
  }

  // Contexto do template (30/09/2026): extraido do generateDocument para servir tambem a pre-visualizacao.
  private buildContext(contract: any, dataInstUtc: Date) {
    const isFianca = contract.guaranteeType === 'FIANCA';
    const rentAmountNumber = Number(contract.rentAmount);

    const gLoc = resolveGender(contract.tenantGender, contract.tenantTaxId);
    const gFia = resolveGender(contract.guarantorGender, null);

    // Disposicoes especificas (29/09/2026): texto proprio do contrato, fora do template.
    // Blocos separados por linha em branco; 1o = caput, demais = paragrafos rotulados.
    const ORD = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo'];
    const blocos = (contract.specificClauses ?? '').split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const clausulasEspecificas = blocos.map((texto, i) => ({
      texto,
      rotulo: i === 0 ? '' : blocos.length === 2 ? 'Parágrafo único' : `Parágrafo ${ORD[i - 1] ?? i + 'º'}`,
    }));

    const dados = {
      empresa: {
        legalName: contract.company.legalName,
        taxId: formatCpfCnpj(contract.company.taxId),
        street: contract.company.street,
        number: contract.company.number,
        complement: contract.company.complement,
        neighborhood: contract.company.neighborhood,
        city: contract.company.city,
        state: contract.company.state,
        zipCode: formatCep(contract.company.zipCode),
      },
      contrato: {
        tenantName: contract.tenantName,
        tenantNationality: contract.tenantNationality,
        tenantMaritalStatus: maritalStatusLabel(contract.tenantMaritalStatus, gLoc),
        tenantProfession: contract.tenantProfession,
        tenantRg: contract.tenantRg,
        tenantTaxId: formatCpfCnpj(contract.tenantTaxId),
        tenantStreet: contract.tenantStreet,
        tenantNumber: contract.tenantNumber,
        tenantComplement: contract.tenantComplement,
        tenantNeighborhood: contract.tenantNeighborhood,
        tenantZipCode: formatCep(contract.tenantZipCode),
        tenantCity: contract.tenantCity,
        tenantState: contract.tenantState,
        prazoMeses: monthsBetween(contract.startDate, contract.endDate),
        startDate: formatDateBR(contract.startDate),
        endDate: formatDateBR(contract.endDate),
        rentAmount: formatCurrencyBRL(rentAmountNumber),
        rentAmountExtenso: valorPorExtenso(rentAmountNumber),
        dueDay: contract.dueDay,
        readjustmentPeriodMonths: contract.readjustmentPeriodMonths,
        readjustmentIndex: readjustmentIndexLabel(contract.readjustmentIndex, contract.readjustmentIndexOther),
        guaranteeType: guaranteeTypeLabel(contract.guaranteeType),
        isFianca,
        loc: termosLocatario(gLoc),
        fia: termosFiador(gFia),
        fiadorNome: isFianca ? (contract.guaranteeDescription ?? '').split(',')[0].trim() : '',
        fiadorComConjuge: isFianca && !!contract.guarantorHasSpouse,
        temClausulasEspecificas: clausulasEspecificas.length > 0,
        clausulasEspecificas,
        guaranteeDescription: contract.guaranteeDescription,
        penaltyDescription: contract.penaltyDescription,
        numeroVias: isFianca ? 3 : 2,
        dataAssinatura: formatDateExtenso(dataInstUtc),
      },
      imovel: {
        street: contract.fixedAsset.street,
        number: contract.fixedAsset.number,
        complement: contract.fixedAsset.complement,
        neighborhood: contract.fixedAsset.neighborhood,
        city: contract.fixedAsset.city,
        state: contract.fixedAsset.state,
        zipCode: formatCep(contract.fixedAsset.zipCode),
        registryNumber: contract.fixedAsset.registryNumber,
        registryOffice: contract.fixedAsset.registryOffice,
      },
    };
    return dados;
  }

  // Compila o template e remove paragrafos/linhas de tabela vazios que sobram dos blocos
  // condicionais (templates editados pelo Word levam os marcadores em paragrafos proprios).
  private renderTemplate(content: string, dados: any): string {
    let html: string;
    try {
      html = Handlebars.compile(content)(dados);
    } catch (e: any) {
      throw new BadRequestException(`Erro ao aplicar o template: ${e?.message ?? e}`);
    }
    return html
      .replace(/<tr>\s*<td[^>]*>\s*(?:<p[^>]*>\s*<\/p>)?\s*<\/td>\s*<\/tr>/gi, '')
      .replace(/<p[^>]*>\s*<\/p>/gi, '');
  }

  // Pre-visualizacao (30/09/2026): PDF de um texto de template (em edicao) com os dados deste contrato. Nao grava nada.
  async previewTemplate(companyId: string, id: string, content: string, dataInstrumento?: string) {
    if (!content?.trim()) throw new BadRequestException('Informe o conteudo do template.');
    const contract = await this.prisma.rentalContract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { fixedAsset: true, company: true },
    });
    if (!contract) throw new NotFoundException('Contrato de locacao nao encontrado.');
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(dataInstrumento ?? '') ? (dataInstrumento as string) : new Date().toISOString().slice(0, 10);
    const [y, m, d] = iso.split('-').map(Number);
    const html = this.renderTemplate(content, this.buildContext(contract, new Date(Date.UTC(y, m - 1, d))));
    return this.documents.renderPdf(
      { type: DocumentType.CONTRATO_LOCACAO, companyId, status: 'RASCUNHO', visibility: 'RESERVADO', title: 'Pre-visualizacao', content: html, signatures: [] },
      'Pre-visualizacao do template.pdf',
    );
  }

  async prepareSigners(companyId: string, id: string) {
    const contract = await this.findOne(companyId, id);
    if (!contract.documentId) {
      throw new BadRequestException('Este contrato ainda nao possui um documento gerado.');
    }
    const existing = await this.prisma.documentSigner.findMany({
      where: { documentId: contract.documentId },
    });
    if (existing.length > 0) {
      return existing;
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const locador = await this.prisma.documentSigner.create({
      data: {
        documentId: contract.documentId,
        name: company?.legalName ?? '',
        cpf: (company?.taxId ?? '').replace(/\D/g, '') || null,
        role: 'LOCADOR',
        order: 1,
      },
    });
    const locatario = await this.prisma.documentSigner.create({
      data: {
        documentId: contract.documentId,
        name: contract.tenantName,
        cpf: (contract.tenantTaxId ?? '').replace(/\D/g, '') || null,
        role: 'LOCATARIO',
        order: 2,
      },
    });
    return [locador, locatario];
  }

  async prepareSignersByDocument(companyId: string, documentId: string) {
    const contract = await this.prisma.rentalContract.findFirst({
      where: { documentId, companyId, deletedAt: null },
    });
    if (!contract) throw new NotFoundException('Contrato nao encontrado para este documento.');
    return this.prepareSigners(companyId, contract.id);
  }
}