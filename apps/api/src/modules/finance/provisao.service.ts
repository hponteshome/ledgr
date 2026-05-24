// apps/api/src/modules/finance/provisao.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProvisaoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllConfigs(companyId: string) {
    return this.prisma.provisaoConfig.findMany({
      where: { companyId, deletedAt: null },
      include: {
        rateios: { include: { empresa: { select: { id: true, legalName: true, taxId: true } } } },
        lancamentos: { orderBy: { competencia: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createConfig(companyId: string, dto: any, createdById?: string) {
    const { rateios, companyId: _cid, ...data } = dto;
    const cleanData: any = Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v === '' ? null : v]));
    const config = await this.prisma.$transaction(async tx => {
      const created = await tx.provisaoConfig.create({
        data: { ...cleanData, companyId } as any,
      });
      if (rateios?.length) {
        await tx.provisaoRateioConfig.createMany({
          data: rateios.map((r: any) => ({
            provisaoId:  created.id,
            empresaId:   r.empresaId,
            percentual:  r.percentual,
            competencia: r.competencia ?? null,
          })),
        });
      }
      return created;
    });
    await this.gerarAgendaPlanejada({ ...config, companyId }, createdById ?? (config as any).createdById);
    return config;
  }

  async updateConfig(id: string, companyId: string, dto: any, createdById?: string) {
    const { rateios, ...data } = dto;
    const config = await this.prisma.$transaction(async tx => {
      const updated = await tx.provisaoConfig.update({
        where: { id },
        data,
      });
      if (rateios) {
        await tx.provisaoRateioConfig.deleteMany({
          where: { provisaoId: id, competencia: null },
        });
        if (rateios.length) {
          await tx.provisaoRateioConfig.createMany({
            data: rateios.filter((r: any) => !r.competencia).map((r: any) => ({
              provisaoId:  id,
              empresaId:   r.empresaId,
              percentual:  r.percentual,
              competencia: null,
            })),
          });
        }
      }
      return updated;
    });
    await this.gerarAgendaPlanejada({ ...config, companyId }, createdById ?? (config as any).createdById);
    return config;
  }

  async deleteConfig(id: string) {
    return this.prisma.provisaoConfig.update({
      where: { id },
      data: { deletedAt: new Date(), ativo: false },
    });
  }

  async gerarAgendaPlanejada(config: any, createdById: string) {
    if (!config.geraAgenda) return;
    await this.prisma.agendaEvent.deleteMany({
      where: { provisaoConfigId: config.id, eventType: 'PLANNED_PAYMENT', isPaid: false },
    });
    const parseComp = (s: string) => { const [y, m] = s.split('-').map(Number); return { y, m }; };
    const ini = parseComp(config.competenciaIni);
    const fim = config.competenciaFim
      ? parseComp(config.competenciaFim)
      : (() => { const d = new Date(); return { y: d.getFullYear() + 2, m: d.getMonth() + 1 }; })();
    const eventos: any[] = [];
    let cur = { ...ini };
    while (cur.y < fim.y || (cur.y === fim.y && cur.m <= fim.m)) {
      const dueDate = new Date(Date.UTC(cur.y, cur.m - 1, config.diaVencimento, 12));
      if (dueDate.getUTCMonth() !== cur.m - 1) dueDate.setUTCDate(0);
      eventos.push({
        companyId:        config.companyId,
        provisaoConfigId: config.id,
        eventType:        'PLANNED_PAYMENT',
        title:            config.descricao + ' — ' + cur.y + '-' + String(cur.m).padStart(2, '0'),
        description:      config.fornecedorNome ?? undefined,
        color:            config.agendaColor ?? 'BLUE',
        dueDate,
        amount:           config.valor,
        createdById,
      });
      cur.m++;
      if (cur.m > 12) { cur.m = 1; cur.y++; }
    }
    if (eventos.length > 0) await this.prisma.agendaEvent.createMany({ data: eventos });
  }

  async gerarLancamentos(companyId: string, createdById: string, competencia: string) {
    const configs = await this.prisma.provisaoConfig.findMany({
      where: { companyId, ativo: true, deletedAt: null },
      include: { rateios: true },
    });
    const results: any[] = [];
    for (const config of configs) {
      const existing = await this.prisma.provisaoLancamento.findUnique({
        where: { provisaoId_companyId_competencia: { provisaoId: config.id, companyId, competencia } },
      });
      if (existing) { results.push({ id: config.id, descricao: config.descricao, status: 'ja_existia' }); continue; }
      const [y, m] = competencia.split('-').map(Number);
      const venc = new Date(Date.UTC(y, m - 1, config.diaVencimento, 12));
      if (venc.getUTCMonth() !== m - 1) venc.setUTCDate(0);
      const valor = Number(config.valor);
      const valorPis    = config.creditaPisCofins ? Math.round(valor * Number(config.aliqPis)    * 100) / 100 : 0;
      const valorCofins = config.creditaPisCofins ? Math.round(valor * Number(config.aliqCofins) * 100) / 100 : 0;
      const valorCsll   = config.creditaPisCofins ? Math.round(valor * Number(config.aliqCsll)   * 100) / 100 : 0;
      const valorIrpj   = config.creditaPisCofins ? Math.round(valor * Number(config.aliqIrpj)   * 100) / 100 : 0;
      await this.prisma.$transaction(async tx => {
        const lanc = await tx.provisaoLancamento.create({
          data: { provisaoId: config.id, companyId, competencia, valor: config.valor, valorPis, valorCofins, valorCsll, valorIrpj, status: config.exigirNF ? 'NF_PENDENTE' : 'PROVISIONADO', createdById },
        });
        let apEntry = null;
        if (config.contaPassivoId) {
          apEntry = await tx.apEntry.create({
            data: { companyId, title: config.descricao + ' — ' + competencia, amount: config.valor, dueDate: venc, supplierName: config.fornecedorNome ?? undefined, supplierCnpjCpf: config.fornecedorCnpj ?? undefined, status: 'OPEN', createdById },
          });
        }
        let agendaEvent = null;
        if (config.geraAgenda) {
          const planned = await tx.agendaEvent.findFirst({
            where: { provisaoConfigId: config.id, eventType: 'PLANNED_PAYMENT', dueDate: venc },
          });
          if (planned) {
            agendaEvent = await tx.agendaEvent.update({
              where: { id: planned.id },
              data: { eventType: 'PAYMENT', apEntryId: apEntry?.id ?? undefined },
            });
          } else {
            agendaEvent = await tx.agendaEvent.create({
              data: { companyId, provisaoConfigId: config.id, eventType: 'PAYMENT', title: config.descricao + ' — ' + competencia, description: config.fornecedorNome ?? undefined, color: (config.agendaColor as any) ?? 'BLUE', dueDate: venc, amount: config.valor, apEntryId: apEntry?.id ?? undefined, createdById },
            });
          }
        }
        if (config.geraContabil && config.contaDespesaId && config.contaPassivoId) {
          const extraItems: any[] = [];
          if (config.creditaPisCofins) {
            if (valorPis > 0 && config.contaPisId)       { extraItems.push({ accountId: config.contaPisId,    value: valorPis,    type: 'DEBIT' }, { accountId: config.contaDespesaId, value: valorPis,    type: 'CREDIT' }); }
            if (valorCofins > 0 && config.contaCofinsId) { extraItems.push({ accountId: config.contaCofinsId, value: valorCofins, type: 'DEBIT' }, { accountId: config.contaDespesaId, value: valorCofins, type: 'CREDIT' }); }
            if (valorCsll > 0 && config.contaCsllId)     { extraItems.push({ accountId: config.contaCsllId,  value: valorCsll,   type: 'DEBIT' }, { accountId: config.contaDespesaId, value: valorCsll,   type: 'CREDIT' }); }
            if (valorIrpj > 0 && config.contaIrpjId)     { extraItems.push({ accountId: config.contaIrpjId,  value: valorIrpj,   type: 'DEBIT' }, { accountId: config.contaDespesaId, value: valorIrpj,   type: 'CREDIT' }); }
          }
          await tx.journalEntry.create({
            data: { companyId, date: venc, description: config.descricao + ' — ' + competencia, sourceModule: 'FINANCE', createdById,
              items: { create: [
                { accountId: config.contaDespesaId, value: config.valor, type: 'DEBIT' },
                { accountId: config.contaPassivoId, value: config.valor, type: 'CREDIT' },
                ...extraItems,
              ]},
            },
          });
        }
        await tx.provisaoLancamento.update({
          where: { id: lanc.id },
          data: { apEntryId: apEntry?.id, agendaEventId: agendaEvent?.id },
        });
        results.push({ id: config.id, descricao: config.descricao, status: 'gerado', lancId: lanc.id });
      });
    }
    return { competencia, total: configs.length, results };
  }

  async findLancamentos(companyId: string, competencia?: string) {
    return this.prisma.provisaoLancamento.findMany({
      where: { companyId, ...(competencia ? { competencia } : {}) },
      include: { provisao: true },
      orderBy: [{ competencia: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async conferirNF(id: string, dto: { nfNumero?: string; nfChave?: string }) {
    return this.prisma.provisaoLancamento.update({
      where: { id },
      data: { nfNumero: dto.nfNumero, nfChave: dto.nfChave, nfConferida: true, nfConferidaEm: new Date(), status: 'PROVISIONADO' },
    });
  }

  async updateRateioCompetencia(provisaoId: string, competencia: string, rateios: any[]) {
    await this.prisma.provisaoRateioConfig.deleteMany({ where: { provisaoId, competencia } });
    if (rateios.length) {
      await this.prisma.provisaoRateioConfig.createMany({
        data: rateios.map(r => ({ provisaoId, empresaId: r.empresaId, percentual: r.percentual, competencia })),
      });
    }
    return { ok: true };
  }
}
