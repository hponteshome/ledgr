// apps/api/src/modules/locacao/utils/reajuste.util.ts
// REAJ-01 (24/11/2026): regra unica do reajuste de aluguel (Dashboard, Quadro Resumo e Arquivo Digital).
// - Aplica-se a locacao mensal com indice cadastrado; temporada nao tem reajuste.
// - Primeira data-base: a "proxima data de reajuste" do cadastro, se posterior ao inicio; senao, o aniversario
//   (inicio + periodicidade). Datas-base ate o ultimo reajuste registrado ja estao cobertas.
// - Data-base vencida e nao registrada fica PENDENTE ate o reajuste ser registrado (aplicado ou dispensado): nao expira.
const LABEL: Record<string, string> = { IGPM: 'IGP-M', IPCA: 'IPCA', INPC: 'INPC', IGPDI: 'IGP-DI', OUTRO: 'Outro' };
const isoD = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function addMesesIso(s: string, n: number): string {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const r = new Date(Date.UTC(y, m - 1 + n, d));
  if (r.getUTCDate() !== d) r.setUTCDate(0);
  return r.toISOString().slice(0, 10);
}

export interface SituacaoReajuste {
  aplica: boolean; temporada: boolean; semIndice: boolean;
  indice: string | null; indiceLabel: string; periodoMeses: number;
  ultimoAplicado: string | null; dataBasePendente: string | null; pendentes: number; proximaDataBase: string | null;
}

export function situacaoReajuste(c: any, hojeRef?: Date): SituacaoReajuste {
  const hoje = isoD(hojeRef ?? new Date());
  const indice: string | null = c?.readjustmentIndex ?? null;
  const indiceLabel = indice ? (indice === 'OUTRO' && c?.readjustmentIndexOther ? String(c.readjustmentIndexOther) : (LABEL[indice] ?? indice)) : 'sem indice cadastrado';
  const periodoMeses = Number(c?.readjustmentPeriodMonths) || 12;
  const temporada = c?.duePeriodicity !== 'MENSAL';
  const aplica = !temporada && !!indice;
  const s: SituacaoReajuste = {
    aplica, temporada, semIndice: !temporada && !indice, indice, indiceLabel, periodoMeses,
    ultimoAplicado: c?.lastReadjustmentDate ? isoD(c.lastReadjustmentDate) : null,
    dataBasePendente: null, pendentes: 0, proximaDataBase: null,
  };
  if (!aplica || !c?.startDate) return s;
  const ini = isoD(c.startDate);
  const fim = c?.endDate ? isoD(c.endDate) : null;
  const nx = c?.nextReadjustmentDate ? isoD(c.nextReadjustmentDate) : null;
  let db = nx && nx > ini ? nx : addMesesIso(ini, periodoMeses);
  let guarda = 0;
  while (s.ultimoAplicado && db <= s.ultimoAplicado && guarda++ < 300) db = addMesesIso(db, periodoMeses);
  let cur = db; guarda = 0;
  while (cur <= hoje && (!fim || cur <= fim) && guarda++ < 300) {
    if (!s.dataBasePendente) s.dataBasePendente = cur;
    s.pendentes++;
    cur = addMesesIso(cur, periodoMeses);
  }
  s.proximaDataBase = !fim || cur <= fim ? cur : null;
  return s;
}
