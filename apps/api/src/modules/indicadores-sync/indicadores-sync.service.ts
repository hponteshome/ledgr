// apps/api/src/modules/indicadores-sync/indicadores-sync.service.ts
// CRIADO 23/11/2026 (IND-AUTO-01): atualizacao automatica dos indicadores economicos pelo SGS do Banco Central.
// - CDI diario (serie 12) -> cdi_daily_rates, acumulados calculados no servidor (mes, ano, 30 dias corridos,
//   12 meses e indice acumulado).
// - Series mensais -> indicadores_economicos (+ acumulado no ano e em 12 meses).
// - REGRA: Selic (4390) e CDI (4391) sao "acumulado no mes"; o mes corrente e PARCIAL e nunca e gravado
//   (juros de mora usam 1% no mes do pagamento). Nenhuma competencia e copiada de outra: o que falta
//   continua faltando e vira aviso no Dashboard (GET /indicadores-sync/status).
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { buscarSerieSgs } from './bcb.client';

type Destino = 'CDI_DIARIO' | 'MENSAL';
interface SerieCfg {
  serie: string; codigo: number; destino: Destino; descricao: string;
  parcialNoMes: boolean;  // valor do mes corrente e parcial (descartar)
  diaLimite: number;      // a partir deste dia do mes o dado esperado ja deve existir
  defasagem: number;      // meses de defasagem da publicacao
}

export const SERIES: SerieCfg[] = [
  { serie: 'CDI_DIARIO', codigo: 12,   destino: 'CDI_DIARIO', descricao: 'CDI di\u00e1rio',         parcialNoMes: false, diaLimite: 0,  defasagem: 0 },
  { serie: 'SELIC',      codigo: 4390, destino: 'MENSAL',     descricao: 'Selic (acumulada no m\u00eas)', parcialNoMes: true,  diaLimite: 5,  defasagem: 1 },
  { serie: 'CDI',        codigo: 4391, destino: 'MENSAL',     descricao: 'CDI mensal',             parcialNoMes: true,  diaLimite: 5,  defasagem: 1 },
  { serie: 'IPCA',       codigo: 433,  destino: 'MENSAL',     descricao: 'IPCA',                   parcialNoMes: false, diaLimite: 15, defasagem: 1 },
  { serie: 'INPC',       codigo: 188,  destino: 'MENSAL',     descricao: 'INPC',                   parcialNoMes: false, diaLimite: 15, defasagem: 1 },
  { serie: 'IGPM',       codigo: 189,  destino: 'MENSAL',     descricao: 'IGP-M',                  parcialNoMes: false, diaLimite: 5,  defasagem: 1 },
  { serie: 'IGPDI',      codigo: 190,  destino: 'MENSAL',     descricao: 'IGP-DI',                 parcialNoMes: false, diaLimite: 15, defasagem: 1 },
  { serie: 'TR',         codigo: 7811, destino: 'MENSAL',     descricao: 'TR mensal',              parcialNoMes: false, diaLimite: 3,  defasagem: 0 },
];

const TZ = 'America/Sao_Paulo';
const DIA = 86400000;
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const addMes = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const meioDia = (iso: string) => new Date(iso + 'T12:00:00Z');
const deBR = (s: string) => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; };
const num = (v: string) => Number(String(v).replace(',', '.'));
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const r7 = (v: number) => Math.round(v * 1e7) / 1e7;

type Resultado = { registros: number; ultimoDado: string | null; mensagem: string };

@Injectable()
export class IndicadoresSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndicadoresSyncService.name);
  private executando = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    setTimeout(() => {
      this.status()
        .then(s => (s.alertas.length ? this.executar('INICIO') : null))
        .catch(e => this.logger.error(`[IndicadoresSync] verificacao inicial: ${e?.message ?? e}`));
    }, 30000);
  }

  @Cron('40 8 * * 1-5', { timeZone: TZ })
  manha() { return this.executar('AGENDADA'); }

  @Cron('10 18 * * 1-5', { timeZone: TZ })
  tarde() { return this.executar('AGENDADA'); }

  async executar(origem: 'AGENDADA' | 'MANUAL' | 'INICIO') {
    if (this.executando) return { ok: false, mensagem: 'Atualiza\u00e7\u00e3o j\u00e1 em andamento', resultados: [] as any[] };
    this.executando = true;
    const resultados: { serie: string; ok: boolean; registros: number; mensagem: string }[] = [];
    try {
      for (const s of SERIES) {
        const quando = new Date();
        try {
          const r = s.destino === 'CDI_DIARIO' ? await this.syncCdiDiario(s) : await this.syncMensal(s);
          await this.gravarStatus(s, origem, quando, null, r);
          resultados.push({ serie: s.serie, ok: true, registros: r.registros, mensagem: r.mensagem });
        } catch (e: any) {
          const msg = String(e?.message ?? e).slice(0, 500);
          this.logger.error(`[IndicadoresSync] ${s.serie}: ${msg}`);
          await this.gravarStatus(s, origem, quando, msg, null);
          resultados.push({ serie: s.serie, ok: false, registros: 0, mensagem: msg });
        }
      }
    } finally {
      this.executando = false;
    }
    this.logger.log(`[IndicadoresSync] ${origem}: ` + resultados.map(r => `${r.serie}=${r.ok ? r.registros : 'ERRO'}`).join(' '));
    return { ok: resultados.every(r => r.ok), resultados };
  }

  private async gravarStatus(s: SerieCfg, origem: string, quando: Date, erro: string | null, r: Resultado | null) {
    const atual = await this.prisma.indicadorSyncStatus.findUnique({ where: { serie: s.serie } });
    const base = { codigoSgs: s.codigo, destino: s.destino, ultimaExecucao: quando, origemUltima: origem };
    const dados: any = erro
      ? { ...base, ultimoErro: erro, falhasSeguidas: (atual?.falhasSeguidas ?? 0) + 1, registrosUltima: 0 }
      : { ...base, ultimoErro: null, falhasSeguidas: 0, ultimoSucesso: quando, registrosUltima: r!.registros, ultimoDado: r!.ultimoDado };
    await this.prisma.indicadorSyncStatus.upsert({ where: { serie: s.serie }, create: { serie: s.serie, ...dados }, update: dados });
  }

  // ---------------------------------------------------------------- series mensais
  private async syncMensal(s: SerieCfg): Promise<Resultado> {
    const ultima = await this.prisma.indicadorEconomico.findFirst({
      where: { indicador: s.serie }, orderBy: { competencia: 'desc' }, select: { competencia: true },
    });
    const hoje = hojeSP();
    const compAtual = hoje.slice(0, 7);
    const deComp = ultima ? addMes(ultima.competencia, -2) : '2000-01';
    const pontos = await buscarSerieSgs(s.codigo, meioDia(deComp + '-01'), meioDia(hoje));
    let gravados = 0, parciais = 0;
    for (const p of pontos) {
      const comp = deBR(p.data).slice(0, 7);
      if (s.parcialNoMes && comp >= compAtual) { parciais++; continue; }
      const valor = r6(num(p.valor));
      if (!Number.isFinite(valor)) continue;
      const chave = { indicador_competencia: { indicador: s.serie, competencia: comp } };
      const ex = await this.prisma.indicadorEconomico.findUnique({ where: chave });
      // IND-AUTO-03: valor igual so e pulado se a fonte ja for o SGS; senao registra a fonte (valor conferido)
      if (ex && Math.abs(Number(ex.taxaMensal) - valor) < 0.0000005 && ex.fonte === `BCB-SGS ${s.codigo}`) continue;
      await this.prisma.indicadorEconomico.upsert({
        where: chave,
        create: { indicador: s.serie, competencia: comp, taxaMensal: valor, fonte: `BCB-SGS ${s.codigo}` },
        update: { taxaMensal: valor, fonte: `BCB-SGS ${s.codigo}` },
      });
      gravados++;
    }
    await this.recalcularAcumuladosMensais(s.serie);
    const ult = await this.prisma.indicadorEconomico.findFirst({
      where: { indicador: s.serie }, orderBy: { competencia: 'desc' }, select: { competencia: true },
    });
    return {
      registros: gravados, ultimoDado: ult?.competencia ?? null,
      mensagem: `${gravados} compet\u00eancia(s) gravada(s)` + (parciais ? `; ${parciais} parcial(is) do m\u00eas corrente descartada(s)` : ''),
    };
  }

  private async recalcularAcumuladosMensais(indicador: string) {
    const rows = await this.prisma.indicadorEconomico.findMany({ where: { indicador }, orderBy: { competencia: 'asc' } });
    let ano = '', fatorAno = 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.competencia.slice(0, 4) !== ano) { ano = r.competencia.slice(0, 4); fatorAno = 1; }
      fatorAno *= 1 + Number(r.taxaMensal) / 100;
      let a12: number | null = null;
      if (i >= 11 && rows[i - 11].competencia === addMes(r.competencia, -11)) {
        let f = 1;
        for (let k = i - 11; k <= i; k++) f *= 1 + Number(rows[k].taxaMensal) / 100;
        a12 = r6((f - 1) * 100);
      }
      const anual = r6((fatorAno - 1) * 100);
      const difA = r.taxaAnual === null || Math.abs(Number(r.taxaAnual) - anual) > 0.0000005;
      const dif12 = (a12 === null) !== (r.acum12m === null) || (a12 !== null && Math.abs(Number(r.acum12m) - a12) > 0.0000005);
      if (difA || dif12) await this.prisma.indicadorEconomico.update({ where: { id: r.id }, data: { taxaAnual: anual, acum12m: a12 } });
    }
  }

  // ---------------------------------------------------------------- CDI diario
  private async preencherIndiceCdi() {
    const zerados = await this.prisma.cdiDailyRate.count({ where: { accumIndex: 0 } });
    if (!zerados) return;
    const rows = await this.prisma.cdiDailyRate.findMany({ orderBy: { date: 'asc' }, select: { id: true, dailyRate: true } });
    let ind = 1;
    for (const r of rows) {
      ind *= 1 + Number(r.dailyRate) / 100;
      await this.prisma.cdiDailyRate.update({ where: { id: r.id }, data: { accumIndex: r7(ind) } });
    }
    this.logger.log(`[IndicadoresSync] indice acumulado do CDI preenchido em ${rows.length} dias`);
  }

  private async syncCdiDiario(s: SerieCfg): Promise<Resultado> {
    await this.preencherIndiceCdi();
    const ultima = await this.prisma.cdiDailyRate.findFirst({ orderBy: { date: 'desc' } });
    const ultIso = ultima ? isoUTC(ultima.date) : null;
    const hoje = hojeSP();
    const de = ultIso ? new Date(meioDia(ultIso).getTime() + DIA) : meioDia('2000-01-03');
    if (isoUTC(de) > hoje) return { registros: 0, ultimoDado: ultIso, mensagem: 'em dia' };
    const pontos = (await buscarSerieSgs(s.codigo, de, meioDia(hoje)))
      .map(p => ({ iso: deBR(p.data), taxa: num(p.valor) }))
      .filter(p => Number.isFinite(p.taxa) && (!ultIso || p.iso > ultIso))
      .sort((a, b) => a.iso.localeCompare(b.iso));
    if (!pontos.length) return { registros: 0, ultimoDado: ultIso, mensagem: 'sem dias novos publicados' };

    const desde = new Date(meioDia(pontos[0].iso).getTime() - 400 * DIA);
    const serie = (await this.prisma.cdiDailyRate.findMany({ where: { date: { gte: desde } }, orderBy: { date: 'asc' } }))
      .map(r => ({ iso: isoUTC(r.date), taxa: Number(r.dailyRate), indice: Number(r.accumIndex) }));
    let indice = serie.length ? serie[serie.length - 1].indice : 1;
    for (const p of pontos) {
      indice *= 1 + p.taxa / 100;
      serie.push({ iso: p.iso, taxa: p.taxa, indice });
      const lim30 = isoUTC(new Date(meioDia(p.iso).getTime() - 30 * DIA));
      const d12 = meioDia(p.iso); d12.setUTCFullYear(d12.getUTCFullYear() - 1);
      const lim12 = isoUTC(d12);
      let fm = 1, fa = 1, f30 = 1, f12 = 1;
      for (const q of serie) {
        if (q.iso > p.iso) continue;
        const f = 1 + q.taxa / 100;
        if (q.iso.slice(0, 7) === p.iso.slice(0, 7)) fm *= f;
        if (q.iso.slice(0, 4) === p.iso.slice(0, 4)) fa *= f;
        if (q.iso > lim30) f30 *= f;
        if (q.iso > lim12) f12 *= f;
      }
      const [y, m, d] = p.iso.split('-').map(Number);
      await this.prisma.cdiDailyRate.create({
        data: {
          date: new Date(Date.UTC(y, m - 1, d, 12)), dailyRate: r6(p.taxa),
          monthlyAccum: r4((fm - 1) * 100), yearAccum: r4((fa - 1) * 100),
          accum30d: r4((f30 - 1) * 100), accum12m: r4((f12 - 1) * 100), accumIndex: r7(indice),
        },
      });
    }
    return { registros: pontos.length, ultimoDado: pontos[pontos.length - 1].iso, mensagem: `${pontos.length} dia(s) de CDI gravado(s)` };
  }

  // ---------------------------------------------------------------- status / alertas
  async status() {
    const hoje = hojeSP();
    const compAtual = hoje.slice(0, 7);
    const dia = Number(hoje.slice(8, 10));
    const st = new Map((await this.prisma.indicadorSyncStatus.findMany()).map(x => [x.serie, x]));
    const series: any[] = [];
    for (const s of SERIES) {
      let ultimoDado: string | null;
      let esperado: string;
      if (s.destino === 'CDI_DIARIO') {
        const u = await this.prisma.cdiDailyRate.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
        ultimoDado = u ? isoUTC(u.date) : null;
        esperado = isoUTC(new Date(meioDia(hoje).getTime() - 5 * DIA));
      } else {
        const u = await this.prisma.indicadorEconomico.findFirst({
          where: { indicador: s.serie, ...(s.parcialNoMes ? { competencia: { lt: compAtual } } : {}) },
          orderBy: { competencia: 'desc' }, select: { competencia: true },
        });
        ultimoDado = u?.competencia ?? null;
        esperado = addMes(compAtual, -(s.defasagem + (dia >= s.diaLimite ? 0 : 1)));
      }
      const atrasado = !ultimoDado || ultimoDado < esperado;
      const x = st.get(s.serie);
      const situacao = x && x.falhasSeguidas > 0 ? 'ERRO' : atrasado ? 'ATRASADO' : 'OK';
      const mensagem = situacao === 'ERRO'
        ? `Falha na atualiza\u00e7\u00e3o (${x!.falhasSeguidas}x seguida${x!.falhasSeguidas > 1 ? 's' : ''}): ${x!.ultimoErro}`
        : situacao === 'ATRASADO'
          ? `\u00cdndice indispon\u00edvel: \u00faltimo dado ${ultimoDado ?? 'nenhum'}, esperado at\u00e9 ${esperado}`
          : 'Em dia';
      series.push({
        serie: s.serie, descricao: s.descricao, codigoSgs: s.codigo, ultimoDado, esperado, situacao, mensagem,
        ultimaExecucao: x?.ultimaExecucao ?? null, ultimoSucesso: x?.ultimoSucesso ?? null, origemUltima: x?.origemUltima ?? null,
      });
    }
    return { hoje, executando: this.executando, series, alertas: series.filter(s => s.situacao !== 'OK') };
  }
}
