// apps/api/src/modules/hr/services/pro-labore.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';

// ── Tabela INSS 2026 (Contribuinte Individual) ────────────────────────────────
const INSS_TETO_2026 = 8475.55;
const INSS_ALIQ_DIRETOR = 0.11;   // descontado do diretor
const INSS_ALIQ_EMPRESA = 0.20;   // patronal

// ── Tabela IRPF 2026 (mesma de Mai/2025+) ────────────────────────────────────
const IRPF_2026 = [
  { ate: 2428.80,  aliq: 0,      deducao: 0       },
  { ate: 2826.65,  aliq: 0.075,  deducao: 182.16  },
  { ate: 3751.05,  aliq: 0.15,   deducao: 394.16  },
  { ate: 4664.68,  aliq: 0.225,  deducao: 675.49  },
  { ate: Infinity, aliq: 0.275,  deducao: 908.74  },
];

// Redutor Lei 15.270/2025 - vigente jan/2026 (mesma tabela do folha.service.ts)
const IRRF_REDUTORES_2026 = [
  { ate: 5000.00,  redutor: Infinity },
  { ate: 5500.00,  redutor: 738.46 },
  { ate: 6000.00,  redutor: 619.23 },
  { ate: 6500.00,  redutor: 500.00 },
  { ate: 7000.00,  redutor: 380.77 },
  { ate: 7350.00,  redutor: 261.54 },
  { ate: Infinity, redutor: 0 },
];

const SALARIO_MINIMO_2026 = 1621.00;

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
  const irrfBruto = Math.max(0, Math.round((baseCalculo * faixa.aliq - faixa.deducao) * 100) / 100);
  const red = IRRF_REDUTORES_2026.find(r => baseCalculo <= r.ate)!;
  const irrf = red.redutor === Infinity ? 0 : Math.max(0, Math.round((irrfBruto - red.redutor) * 100) / 100);
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
    await this.prisma.proLaboreConfig.findFirstOrThrow({ where: { id, companyId }, select: { id: true } }); // Seguranca 0A (04/10/2026): o registro precisa ser da empresa ativa
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

  // ── Diretoria a partir do QSA (17/11/2026) ──────────────────────────────
  // A tela de pro-labore nao cadastra pessoas: le company_shareholders (PF com Pessoa vinculada)
  // e guarda aqui so o que e proprio do pro-labore (cargo, CBO, categoria, dia e vigencias de valor).
  async diretoria(companyId: string) {
    const socios = await this.prisma.companyShareholder.findMany({
      where: { companyId, shareholderType: 'PF', personId: { not: null } },
      include: { person: { select: { id: true, cpf: true, fullName: true, birthDate: true } } },
      orderBy: { dataEntrada: 'asc' },
    });
    const cfgs = socios.length ? await this.prisma.proLaboreConfig.findMany({
      where: { companyId, deletedAt: null, shareholderId: { in: socios.map(s => s.id) } },
      orderBy: { competenciaIni: 'asc' },
    }) : [];
    return socios.map(s => {
      const q = (s.qualificacao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const vigencias = cfgs.filter(c => c.shareholderId === s.id);
      return {
        shareholderId: s.id, qualificacao: s.qualificacao, dataEntrada: s.dataEntrada, dataRetirada: s.dataRetirada,
        participacao: s.participacaoPercent, administra: /administr|diretor|president|gerente/.test(q),
        person: s.person, recebeProLabore: vigencias.length > 0, vigencias,
      };
    });
  }

  async salvarDiretoria(companyId: string, shareholderId: string, dto: any) {
    const sh = await this.prisma.companyShareholder.findFirst({
      where: { id: shareholderId, companyId },
      select: { id: true, personId: true, shareholderType: true, dataEntrada: true, dataRetirada: true },
    });
    if (!sh || !sh.personId || sh.shareholderType !== 'PF') throw new NotFoundException('Socio pessoa fisica nao encontrado no QSA desta empresa.');
    const personId = sh.personId;
    const ym = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : null);
    const recebe = !!dto?.recebe;
    const vigs: { competenciaIni: string; competenciaFim: string | null; valorBruto: number }[] = recebe && Array.isArray(dto?.vigencias)
      ? dto.vigencias.map((v: any) => ({ competenciaIni: String(v.competenciaIni || ''), competenciaFim: v.competenciaFim ? String(v.competenciaFim) : null, valorBruto: Number(v.valorBruto) }))
      : [];
    let cargo = '', cbo: string | null = null, categoriaEsocial = '723', diaPagamento: number | null = null;
    if (recebe) {
      cargo = String(dto.cargo || '').trim();
      if (!cargo) throw new BadRequestException('Informe o cargo.');
      categoriaEsocial = String(dto.categoriaEsocial || '723');
      if (!['721', '722', '723'].includes(categoriaEsocial)) throw new BadRequestException('Categoria eSocial invalida (721, 722 ou 723).');
      const c = String(dto.cbo || '').replace(/\D/g, '');
      if (c && c.length !== 6) throw new BadRequestException('CBO deve ter 6 digitos.');
      cbo = c || null;
      diaPagamento = dto.diaPagamento ? Number(dto.diaPagamento) : null;
      if (diaPagamento !== null && !(diaPagamento >= 1 && diaPagamento <= 31)) throw new BadRequestException('Dia de pagamento deve estar entre 1 e 31.');
      if (!vigs.length) throw new BadRequestException('Informe ao menos uma vigencia.');
      vigs.sort((a, b) => a.competenciaIni.localeCompare(b.competenciaIni));
      const re = /^\d{4}-(0[1-9]|1[0-2])$/;
      const ini = ym(sh.dataEntrada), fim = ym(sh.dataRetirada);
      vigs.forEach((v, i) => {
        const n = i + 1;
        if (!re.test(v.competenciaIni)) throw new BadRequestException(`Vigencia ${n}: competencia inicial invalida.`);
        if (v.competenciaFim && !re.test(v.competenciaFim)) throw new BadRequestException(`Vigencia ${n}: competencia final invalida.`);
        if (v.competenciaFim && v.competenciaFim < v.competenciaIni) throw new BadRequestException(`Vigencia ${n}: fim anterior ao inicio.`);
        if (!(v.valorBruto > 0)) throw new BadRequestException(`Vigencia ${n}: valor bruto deve ser maior que zero.`);
        if (ini && v.competenciaIni < ini) throw new BadRequestException(`Vigencia ${n}: inicio anterior a entrada no QSA (${ini}).`);
        if (fim && (!v.competenciaFim || v.competenciaFim > fim)) throw new BadRequestException(`Vigencia ${n}: ultrapassa a retirada do QSA (${fim}).`);
        const prox = vigs[i + 1];
        if (prox) {
          if (!v.competenciaFim) throw new BadRequestException(`Vigencia ${n}: informe o fim, pois ha vigencia posterior.`);
          if (v.competenciaFim >= prox.competenciaIni) throw new BadRequestException(`Vigencias ${n} e ${n + 1} sobrepostas.`);
        }
      });
    }
    const atuais = await this.prisma.proLaboreConfig.findMany({
      where: { companyId, shareholderId, deletedAt: null },
      include: { _count: { select: { calculos: true } } },
    });
    const manter = new Set(vigs.map(v => v.competenciaIni));
    const remover = atuais.filter(a => !manter.has(a.competenciaIni));
    const travada = remover.find(a => a._count.calculos > 0)
      || atuais.find(a => a._count.calculos > 0 && vigs.some(v => v.competenciaIni === a.competenciaIni && (v.valorBruto !== Number(a.valorBruto) || v.competenciaFim !== a.competenciaFim)));
    if (travada) throw new BadRequestException(`A vigencia ${travada.competenciaIni} ja tem calculos gerados e nao pode ser alterada ou removida.`);
    return this.prisma.$transaction(async tx => {
      for (const a of remover) await tx.proLaboreConfig.update({ where: { id: a.id }, data: { deletedAt: new Date(), ativo: false } });
      for (const v of vigs) {
        const ex = atuais.find(a => a.competenciaIni === v.competenciaIni);
        const data = { cargo, cbo, categoriaEsocial, diaPagamento, valorBruto: v.valorBruto, competenciaFim: v.competenciaFim, ativo: true };
        if (ex) await tx.proLaboreConfig.update({ where: { id: ex.id }, data });
        else await tx.proLaboreConfig.create({ data: { ...data, companyId, personId, shareholderId, competenciaIni: v.competenciaIni } });
      }
      return { ok: true, vigencias: vigs.length, removidas: remover.length };
    });
  }

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
