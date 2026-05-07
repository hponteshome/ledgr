// apps/api/src/modules/hr/services/pro-labore.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// ── Tabela INSS 2026 (Contribuinte Individual) ────────────────────────────────
const INSS_TETO_2026 = 8157.41;
const INSS_ALIQ_DIRETOR = 0.11;   // descontado do diretor
const INSS_ALIQ_EMPRESA = 0.20;   // patronal

// ── Tabela IRPF 2026 (mesma de Mai/2025+) ────────────────────────────────────
const IRPF_2026 = [
  { ate: 2428.80,  aliq: 0,      deducao: 0       },
  { ate: 2826.65,  aliq: 0.075,  deducao: 182.16  },
  { ate: 3751.05,  aliq: 0.15,   deducao: 394.16  },
  { ate: 4664.68,  aliq: 0.225,  deducao: 675.49  },
  { ate: Infinity, aliq: 0.275,  deducao: 908.73  },
];

const SALARIO_MINIMO_2026 = 1518.00;

function nullIfEmpty(v: any): string | null { return v && v.toString().trim() !== '' ? v : null; }

function calcularINSSDiretor(bruto: number): number {
  const base = Math.min(bruto, INSS_TETO_2026);
  return Math.round(base * INSS_ALIQ_DIRETOR * 100) / 100;
}

function calcularINSSEmpresa(bruto: number): number {
  return Math.round(bruto * INSS_ALIQ_EMPRESA * 100) / 100;
}

function calcularIRRF(baseCalculo: number): { irrf: number; aliq: number; deducao: number } {
  const faixa = IRPF_2026.find(f => baseCalculo <= f.ate)!;
  const irrf = Math.max(0, Math.round((baseCalculo * faixa.aliq - faixa.deducao) * 100) / 100);
  return { irrf, aliq: faixa.aliq, deducao: faixa.deducao };
}

@Injectable()
export class ProLaboreService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD Configuracao ─────────────────────────────────────────────────────

  async findAllConfigs(companyId: string) {
    return this.prisma.proLaboreConfig.findMany({
      where: { companyId, deletedAt: null },
      include: {
        person: { select: { id: true, cpf: true, fullName: true } },
        calculos: { orderBy: { competencia: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createConfig(companyId: string, dto: any) {
    // Validar minimo legal
    if (Number(dto.valorBruto) < SALARIO_MINIMO_2026) {
      throw new BadRequestException(
        `Valor abaixo do minimo legal (R$ ${SALARIO_MINIMO_2026.toFixed(2)}). Pró-labore deve ser >= 1 salário mínimo.`
      );
    }
    return this.prisma.proLaboreConfig.create({
      data: {
        companyId,
        personId:           dto.personId,
        cargo:              dto.cargo,
        valorBruto:         dto.valorBruto,
        competenciaIni:     dto.competenciaIni,
        competenciaFim:     nullIfEmpty(dto.competenciaFim),
        contaDespesaId:     nullIfEmpty(dto.contaDespesaId),
        contaPassivoId:     nullIfEmpty(dto.contaPassivoId),
        contaInssEmpId:     nullIfEmpty(dto.contaInssEmpId),
        contaInssDir:       dto.contaInssDir   || null,
        contaIrrfId:        dto.contaIrrfId    || null,
        contaInssRecolherId:nullIfEmpty(dto.contaInssRecolherId),
        contaIrrfRecolherId:nullIfEmpty(dto.contaIrrfRecolherId),
        documentoId:        dto.documentoId    || null,
      },
    });
  }

  async updateConfig(id: string, companyId: string, dto: any) {
    if (dto.valorBruto && Number(dto.valorBruto) < SALARIO_MINIMO_2026) {
      throw new BadRequestException(
        `Valor abaixo do minimo legal (R$ ${SALARIO_MINIMO_2026.toFixed(2)}).`
      );
    }
    return this.prisma.proLaboreConfig.update({
      where: { id },
      data: {
        cargo:               dto.cargo,
        valorBruto:          dto.valorBruto,
        competenciaFim:      nullIfEmpty(dto.competenciaFim),
        contaDespesaId:      nullIfEmpty(dto.contaDespesaId),
        contaPassivoId:      nullIfEmpty(dto.contaPassivoId),
        contaInssEmpId:      nullIfEmpty(dto.contaInssEmpId),
        contaInssDir:        dto.contaInssDir   || null,
        contaIrrfId:         dto.contaIrrfId    || null,
        contaInssRecolherId: nullIfEmpty(dto.contaInssRecolherId),
        contaIrrfRecolherId: nullIfEmpty(dto.contaIrrfRecolherId),
        documentoId:         dto.documentoId    || null,
        ativo:               dto.ativo,
      },
    });
  }

  // ── Calculo Mensal ────────────────────────────────────────────────────────

  calcularPrevia(valorBruto: number) {
    const inssDiretor  = calcularINSSDiretor(valorBruto);
    const inssEmpresa  = calcularINSSEmpresa(valorBruto);
    const baseIrrf     = valorBruto - inssDiretor;
    const { irrf, aliq, deducao } = calcularIRRF(baseIrrf);
    const valorLiquido = valorBruto - inssDiretor - irrf;
    const abaixoMinimo = valorBruto < SALARIO_MINIMO_2026;

    return {
      valorBruto, inssDiretor, inssEmpresa,
      baseIrrf, irrf, aliqIrrf: aliq, deducaoIrrf: deducao,
      valorLiquido, abaixoMinimo,
      minimoLegal: SALARIO_MINIMO_2026,
    };
  }

  async gerarCalculo(companyId: string, createdById: string, dto: { configId: string; competencia: string; gerarLancamento: boolean }) {
    const config = await this.prisma.proLaboreConfig.findFirst({
      where: { id: dto.configId, companyId, deletedAt: null },
      include: { person: true },
    });
    if (!config) throw new NotFoundException('Configuracao nao encontrada');

    // Idempotencia
    const existing = await this.prisma.proLaboreCalculo.findUnique({
      where: { configId_competencia: { configId: dto.configId, competencia: dto.competencia } },
    });
    if (existing) throw new BadRequestException(`Competencia ${dto.competencia} ja calculada`);

    // Verificar ata
    if (!config.documentoId) {
      // Aviso — nao bloqueia mas retorna flag
    }

    const bruto = Number(config.valorBruto);
    const preview = this.calcularPrevia(bruto);

    return this.prisma.$transaction(async tx => {
      const calculo = await tx.proLaboreCalculo.create({
        data: {
          configId:    dto.configId,
          companyId,
          competencia: dto.competencia,
          valorBruto:  preview.valorBruto,
          inssEmpresa: preview.inssEmpresa,
          inssDiretor: preview.inssDiretor,
          baseIrrf:    preview.baseIrrf,
          irrf:        preview.irrf,
          aliqIrrf:    preview.aliqIrrf,
          deducaoIrrf: preview.deducaoIrrf,
          valorLiquido:preview.valorLiquido,
          createdById,
          geradoEm:    new Date(),
        },
      });

      let journalEntry = null;

      if (dto.gerarLancamento &&
          config.contaDespesaId && config.contaPassivoId &&
          config.contaInssEmpId && config.contaInssRecolherId &&
          config.contaIrrfId    && config.contaIrrfRecolherId) {

        const [y, m] = dto.competencia.split('-').map(Number);
        const dataComp = new Date(Date.UTC(y, m, 0, 12, 0, 0)); // ultimo dia do mes

        journalEntry = await tx.journalEntry.create({
          data: {
            companyId,
            date:         dataComp,
            description:  `Pro-labore ${config.person.fullName} — ${dto.competencia}`,
            sourceModule: 'HR',
            createdById,
            items: { create: [
              // D Despesa Pro-labore / C Pro-labore a Pagar
              { accountId: config.contaDespesaId!, value: preview.valorBruto, type: 'DEBIT'  },
              { accountId: config.contaPassivoId!, value: preview.valorBruto, type: 'CREDIT' },
              // D Despesa INSS Patronal / C INSS a Recolher
              { accountId: config.contaInssEmpId!,     value: preview.inssEmpresa, type: 'DEBIT'  },
              { accountId: config.contaInssRecolherId!, value: preview.inssEmpresa, type: 'CREDIT' },
              // D Pro-labore a Pagar / C INSS a Recolher (parte diretor)
              { accountId: config.contaPassivoId!,     value: preview.inssDiretor, type: 'DEBIT'  },
              { accountId: config.contaInssRecolherId!, value: preview.inssDiretor, type: 'CREDIT' },
              // D Pro-labore a Pagar / C IRRF a Recolher
              ...(preview.irrf > 0 ? [
                { accountId: config.contaPassivoId!,      value: preview.irrf, type: 'DEBIT'  as any },
                { accountId: config.contaIrrfRecolherId!, value: preview.irrf, type: 'CREDIT' as any },
              ] : []),
            ]},
          },
        });

        await tx.proLaboreCalculo.update({
          where: { id: calculo.id },
          data: { journalEntryId: journalEntry.id },
        });
      }

      return {
        calculo,
        journalEntry,
        preview,
        avisoAta: !config.documentoId,
      };
    });
  }

  async findCalculos(companyId: string, competencia?: string) {
    return this.prisma.proLaboreCalculo.findMany({
      where: {
        companyId,
        ...(competencia ? { competencia } : {}),
      },
      include: {
        config: { include: { person: { select: { fullName: true, cpf: true } } } },
      },
      orderBy: [{ competencia: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ── Gerar lancamentos retroativos para calculos sem journalEntryId ──────────
  async gerarLancamentosRetroativos(companyId: string, createdById: string, competenceFrom?: string, competenceTo?: string) {
    const calculos = await this.prisma.proLaboreCalculo.findMany({
      where: {
        companyId,
        journalEntryId: null,
        ...(competenceFrom ? { competencia: { gte: competenceFrom } } : {}),
        ...(competenceTo   ? { competencia: { lte: competenceTo   } } : {}),
        config: {
          contaDespesaId:      { not: null },
          contaPassivoId:      { not: null },
          contaInssEmpId:      { not: null },
          contaInssRecolherId: { not: null },
        },
      },
      include: { config: { include: { person: true } } },
      orderBy: { competencia: 'asc' },
    });

    const results: any[] = [];
    for (const calc of calculos) {
      const config = calc.config;
      try {
        const [y, m] = calc.competencia.split('-').map(Number);
        const dataComp = new Date(Date.UTC(y, m, 0, 12, 0, 0));
        const journalEntry = await this.prisma.journalEntry.create({
          data: {
            companyId,
            date:         dataComp,
            description:  `Pro-labore ${config.person.fullName} — ${calc.competencia}`,
            sourceModule: 'HR',
            createdById,
            items: { create: [
              { accountId: config.contaDespesaId!,      value: Number(calc.valorBruto),  type: 'DEBIT'  },
              { accountId: config.contaPassivoId!,      value: Number(calc.valorBruto),  type: 'CREDIT' },
              { accountId: config.contaInssEmpId!,      value: Number(calc.inssEmpresa), type: 'DEBIT'  },
              { accountId: config.contaInssRecolherId!, value: Number(calc.inssEmpresa), type: 'CREDIT' },
              { accountId: config.contaPassivoId!,      value: Number(calc.inssDiretor), type: 'DEBIT'  },
              { accountId: config.contaInssRecolherId!, value: Number(calc.inssDiretor), type: 'CREDIT' },
              ...(Number(calc.irrf) > 0 && config.contaIrrfId && config.contaIrrfRecolherId ? [
                { accountId: config.contaPassivoId!,       value: Number(calc.irrf), type: 'DEBIT'  as any },
                { accountId: config.contaIrrfRecolherId!,  value: Number(calc.irrf), type: 'CREDIT' as any },
              ] : []),
            ]},
          },
        });
        await this.prisma.proLaboreCalculo.update({
          where: { id: calc.id },
          data:  { journalEntryId: journalEntry.id },
        });
        results.push({ id: calc.id, competencia: calc.competencia, success: true });
      } catch (e: any) {
        results.push({ id: calc.id, competencia: calc.competencia, success: false, error: e.message });
      }
    }
    return { total: calculos.length, results };
  }
}
