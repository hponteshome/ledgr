// apps/api/src/modules/tabelas-legais/tabelas-legais.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TabelasLegaisService {
  constructor(private readonly prisma: PrismaService) {}

  // ── INSS ────────────────────────────────────────────────────────────────────
  async getInss(ano?: number) {
    const where = ano ? { ano } : {};
    const rows = await this.prisma.tabelaInss.findMany({ where, orderBy: [{ ano: 'desc' }, { faixaOrdem: 'asc' }] });
    // Agrupar por ano
    const map = new Map<number, any>();
    for (const r of rows) {
      if (!map.has(r.ano)) map.set(r.ano, { ano: r.ano, teto: r.teto, salMinimo: r.salMinimo, vigenciaIni: r.vigenciaIni, faixas: [] });
      map.get(r.ano).faixas.push({ ordem: r.faixaOrdem, limiteAte: r.limiteAte, aliquota: r.aliquota, deducao: r.deducao });
    }
    return Array.from(map.values()).sort((a,b) => b.ano - a.ano);
  }

  async upsertInssLote(ano: number, dto: any) {
    await this.prisma.tabelaInss.deleteMany({ where: { ano } });
    const rows = dto.faixas.map((f: any, i: number) => ({
      ano, faixaOrdem: i + 1,
      limiteAte:  new Prisma.Decimal(f.limiteAte),
      aliquota:   new Prisma.Decimal(f.aliquota),
      deducao:    new Prisma.Decimal(f.deducao ?? 0),
      teto:       dto.teto ? new Prisma.Decimal(dto.teto) : null,
      salMinimo:  dto.salMinimo ? new Prisma.Decimal(dto.salMinimo) : null,
      vigenciaIni: new Date(dto.vigenciaIni),
      vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null,
      observacao: dto.observacao ?? null,
    }));
    await this.prisma.tabelaInss.createMany({ data: rows });
    return this.getInss(ano);
  }

  // ── IRRF ────────────────────────────────────────────────────────────────────
  async getIrrf(ano?: number) {
    const where = ano ? { ano } : {};
    const rows = await this.prisma.tabelaIrrf.findMany({ where, orderBy: [{ ano: 'desc' }, { tipo: 'asc' }, { faixaOrdem: 'asc' }] });
    const map = new Map<number, any>();
    for (const r of rows) {
      if (!map.has(r.ano)) map.set(r.ano, { ano: r.ano, vigenciaIni: r.vigenciaIni, faixas: [], redutores: [] });
      const entry = map.get(r.ano);
      if (r.tipo === 'PROGRESSIVA') entry.faixas.push({ ordem: r.faixaOrdem, limiteAte: r.limiteAte, aliquota: r.aliquota, deducao: r.deducao });
      else entry.redutores.push({ ordem: r.faixaOrdem, limiteAte: r.limiteAte, redutor: r.deducao });
    }
    return Array.from(map.values()).sort((a,b) => b.ano - a.ano);
  }

  async upsertIrrfLote(ano: number, dto: any) {
    await this.prisma.tabelaIrrf.deleteMany({ where: { ano } });
    const rows: any[] = [];
    (dto.faixas ?? []).forEach((f: any, i: number) => rows.push({
      ano, faixaOrdem: i + 1, tipo: 'PROGRESSIVA',
      limiteAte: new Prisma.Decimal(f.limiteAte),
      aliquota:  new Prisma.Decimal(f.aliquota),
      deducao:   new Prisma.Decimal(f.deducao ?? 0),
      vigenciaIni: new Date(dto.vigenciaIni),
    }));
    (dto.redutores ?? []).forEach((r: any, i: number) => rows.push({
      ano, faixaOrdem: i + 1, tipo: 'REDUTOR',
      limiteAte: new Prisma.Decimal(r.limiteAte),
      aliquota:  new Prisma.Decimal(0),
      deducao:   r.redutor === null ? new Prisma.Decimal(999999) : new Prisma.Decimal(r.redutor),
      vigenciaIni: new Date(dto.vigenciaIni),
    }));
    await this.prisma.tabelaIrrf.createMany({ data: rows });
    return this.getIrrf(ano);
  }

  // ── Salario Minimo ───────────────────────────────────────────────────────────
  async getSalarioMinimo() {
    return this.prisma.salarioMinimo.findMany({ orderBy: { vigenciaIni: 'desc' } });
  }

  async upsertSalarioMinimo(dto: any) {
    const vigIni = new Date(dto.vigenciaIni);
    const exists = await this.prisma.salarioMinimo.findFirst({ where: { vigenciaIni: vigIni } });
    if (exists) {
      return this.prisma.salarioMinimo.update({ where: { id: exists.id },
        data: { valor: new Prisma.Decimal(dto.valor), vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null, lei: dto.lei ?? null, observacao: dto.observacao ?? null } });
    }
    return this.prisma.salarioMinimo.create({ data: {
      valor: new Prisma.Decimal(dto.valor), vigenciaIni: vigIni,
      vigenciaFim: dto.vigenciaFim ? new Date(dto.vigenciaFim) : null,
      lei: dto.lei ?? null, observacao: dto.observacao ?? null,
    }});
  }

  async deleteSalarioMinimo(id: string) {
    return this.prisma.salarioMinimo.delete({ where: { id } });
  }

  // ── Indicadores Economicos ───────────────────────────────────────────────────
  async getIndicadores(indicador?: string, ano?: number) {
    const where: any = {};
    if (indicador) where.indicador = indicador.toUpperCase();
    if (ano) where.competencia = { startsWith: String(ano) };
    const rows = await this.prisma.indicadorEconomico.findMany({ where, orderBy: [{ indicador: 'asc' }, { competencia: 'desc' }] });
    return rows;
  }

  async upsertIndicador(dto: any) {
    const indicador = dto.indicador.toUpperCase();
    return this.prisma.indicadorEconomico.upsert({
      where: { indicador_competencia: { indicador, competencia: dto.competencia } },
      create: {
        indicador, competencia: dto.competencia,
        taxaMensal: new Prisma.Decimal(dto.taxaMensal),
        taxaAnual:  dto.taxaAnual  ? new Prisma.Decimal(dto.taxaAnual)  : null,
        acum12m:    dto.acum12m    ? new Prisma.Decimal(dto.acum12m)    : null,
        fonte:      dto.fonte ?? null,
      },
      update: {
        taxaMensal: new Prisma.Decimal(dto.taxaMensal),
        taxaAnual:  dto.taxaAnual  ? new Prisma.Decimal(dto.taxaAnual)  : null,
        acum12m:    dto.acum12m    ? new Prisma.Decimal(dto.acum12m)    : null,
        fonte:      dto.fonte ?? null,
      },
    });
  }

  async upsertIndicadoresLote(dtos: any[]) {
    const results = [];
    for (const dto of dtos) results.push(await this.upsertIndicador(dto));
    return { total: results.length };
  }

  async deleteIndicador(id: string) {
    return this.prisma.indicadorEconomico.delete({ where: { id } });
  }

  // Calculadora de Correcao Monetaria
  private proximaCompetencia(comp: string): string {
    const [y, m] = comp.split('-').map(Number);
    const d = new Date(y, m, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  async calcularCorrecao(dto: any) {
    const indicador = String(dto.indicador ?? '').toUpperCase();
    const competenciaInicio = String(dto.competenciaInicio ?? '');
    const competenciaFim = String(dto.competenciaFim ?? '');
    const incluirInicio = !!dto.incluirInicio;
    const valorOriginal = parseFloat(String(dto.valorOriginal ?? '0').replace(',', '.'));

    if (!indicador || !competenciaInicio || !competenciaFim || competenciaInicio > competenciaFim) {
      throw new Error('Parametros invalidos: indicador, competenciaInicio e competenciaFim sao obrigatorios (competenciaInicio <= competenciaFim).');
    }

    const where: any = {
      indicador,
      competencia: incluirInicio
        ? { gte: competenciaInicio, lte: competenciaFim }
        : { gt: competenciaInicio, lte: competenciaFim },
    };
    const rows = await this.prisma.indicadorEconomico.findMany({ where, orderBy: { competencia: 'asc' } });

    const competenciasFaltantes: string[] = [];
    let cursor = incluirInicio ? competenciaInicio : this.proximaCompetencia(competenciaInicio);
    while (cursor <= competenciaFim) {
      if (!rows.find(r => r.competencia === cursor)) competenciasFaltantes.push(cursor);
      cursor = this.proximaCompetencia(cursor);
    }

    let fator = 1;
    const meses = rows.map(r => {
      fator *= (1 + Number(r.taxaMensal) / 100);
      return { competencia: r.competencia, taxaMensal: Number(r.taxaMensal), fatorAcumulado: Math.round(fator * 1e8) / 1e8 };
    });

    const valorCorrigido = valorOriginal * fator;

    return {
      indicador, competenciaInicio, competenciaFim, incluirInicio,
      valorOriginal,
      fator: Math.round(fator * 1e8) / 1e8,
      percentualAcumulado: Math.round((fator - 1) * 100 * 10000) / 10000,
      valorCorrigido: Math.round(valorCorrigido * 100) / 100,
      variacao: Math.round((valorCorrigido - valorOriginal) * 100) / 100,
      meses,
      competenciasFaltantes,
    };
  }

  // ── Vigente: retorna tabelas do ano corrente para uso nos calculos ───────────
  async getVigente() {
    const ano = new Date().getFullYear();
    const [inss, irrf, salMin] = await Promise.all([
      this.getInss(ano),
      this.getIrrf(ano),
      this.prisma.salarioMinimo.findFirst({ where: { vigenciaFim: null }, orderBy: { vigenciaIni: 'desc' } }),
    ]);
    return { ano, inss: inss[0] ?? null, irrf: irrf[0] ?? null, salarioMinimo: salMin };
  }
}