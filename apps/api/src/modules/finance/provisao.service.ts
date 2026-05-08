// apps/api/src/modules/finance/provisao.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProvisaoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD Config ───────────────────────────────────────────────────────────

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

  async createConfig(companyId: string, dto: any) {
    const { rateios, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      const config = await tx.provisaoConfig.create({
        data: { ...data, companyId },
      });
      if (rateios?.length) {
        await tx.provisaoRateioConfig.createMany({
          data: rateios.map((r: any) => ({
            provisaoId: config.id,
            empresaId:  r.empresaId,
            percentual: r.percentual,
            competencia: r.competencia ?? null,
          })),
        });
      }
      return config;
    });
  }

  async updateConfig(id: string, companyId: string, dto: any) {
    const { rateios, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      const config = await tx.provisaoConfig.update({
        where: { id },
        data,
      });
      if (rateios) {
        // Remover rateios sem competencia especifica e recriar
        await tx.provisaoRateioConfig.deleteMany({
          where: { provisaoId: id, competencia: null },
        });
        if (rateios.length) {
          await tx.provisaoRateioConfig.createMany({
            data: rateios.filter((r: any) => !r.competencia).map((r: any) => ({
              provisaoId: id,
              empresaId:  r.empresaId,
              percentual: r.percentual,
              competencia: null,
            })),
          });
        }
      }
      return config;
    });
  }

  async deleteConfig(id: string) {
    return this.prisma.provisaoConfig.update({
      where: { id },
      data: { deletedAt: new Date(), ativo: false },
    });
  }

  // ── Geracao de Lancamentos ────────────────────────────────────────────────

  async gerarLancamentos(companyId: string, createdById: string, competencia: string) {
    const configs = await this.prisma.provisaoConfig.findMany({
      where: { companyId, ativo: true, deletedAt: null },
      include: { rateios: true },
    });

    const results: any[] = [];

    for (const config of configs) {
      // Verificar idempotencia
      const existing = await this.prisma.provisaoLancamento.findUnique({
        where: { provisaoId_companyId_competencia: { provisaoId: config.id, companyId, competencia } },
      });
      if (existing) { results.push({ id: config.id, descricao: config.descricao, status: 'ja_existia' }); continue; }

      // Calcular vencimento
      const [y, m] = competencia.split('-').map(Number);
      const venc = new Date(Date.UTC(y, m - 1, config.diaVencimento, 12));
      if (venc.getUTCMonth() !== m - 1) venc.setUTCDate(0); // ultimo dia do mes se dia > dias do mes

      // Calcular PIS/COFINS
      const valor = Number(config.valor);
      const valorPis    = config.creditaPisCofins ? Math.round(valor * Number(config.aliqPis) * 100) / 100 : 0;
      const valorCofins = config.creditaPisCofins ? Math.round(valor * Number(config.aliqCofins) * 100) / 100 : 0;

      await this.prisma.$transaction(async tx => {
        // Criar lancamento de provisao
        const lanc = await tx.provisaoLancamento.create({
          data: {
            provisaoId:  config.id,
            companyId,
            competencia,
            valor:       config.valor,
            valorPis,
            valorCofins,
            status:      config.exigirNF ? 'NF_PENDENTE' : 'PROVISIONADO',
            createdById,
          },
        });

        // Criar AP
        let apEntry = null;
        if (config.contaPassivoId) {
          apEntry = await tx.apEntry.create({
            data: {
              companyId,
              title:         config.descricao + ' — ' + competencia,
              amount:        config.valor,
              dueDate:       venc,
              supplierName:  config.fornecedorNome ?? undefined,
              supplierCnpjCpf: config.fornecedorCnpj ?? undefined,
              status:        'OPEN',
              createdById,
            },
          });
        }

        // Criar lancamento contabil
        let journalEntry = null;
        if (config.contaDespesaId && config.contaPassivoId) {
          journalEntry = await tx.journalEntry.create({
            data: {
              companyId,
              date:         venc,
              description:  config.descricao + ' — ' + competencia,
              sourceModule: 'FINANCE',
              createdById,
              items: { create: [
                { accountId: config.contaDespesaId, value: config.valor, type: 'DEBIT'  },
                { accountId: config.contaPassivoId,  value: config.valor, type: 'CREDIT' },
              ]},
            },
          });
        }

        // Atualizar lancamento com vinculos
        await tx.provisaoLancamento.update({
          where: { id: lanc.id },
          data: {
            apEntryId:      apEntry?.id,
            journalEntryId: journalEntry?.id,
          },
        });

        results.push({ id: config.id, descricao: config.descricao, status: 'gerado', lancId: lanc.id });
      });
    }

    return { competencia, total: configs.length, results };
  }

  // ── NF e Status ───────────────────────────────────────────────────────────

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
      data: {
        nfNumero:    dto.nfNumero,
        nfChave:     dto.nfChave,
        nfConferida: true,
        nfConferidaEm: new Date(),
        status:      'PROVISIONADO',
      },
    });
  }

  async updateRateioCompetencia(provisaoId: string, competencia: string, rateios: any[]) {
    // Remover rateios override desta competencia e recriar
    await this.prisma.provisaoRateioConfig.deleteMany({
      where: { provisaoId, competencia },
    });
    if (rateios.length) {
      await this.prisma.provisaoRateioConfig.createMany({
        data: rateios.map(r => ({
          provisaoId,
          empresaId:  r.empresaId,
          percentual: r.percentual,
          competencia,
        })),
      });
    }
    return { ok: true };
  }
}
