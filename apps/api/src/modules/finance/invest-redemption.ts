// apps/api/src/modules/finance/invest-redemption.ts
// EXTINV-01 (23/11/2026): deducao de um resgate de renda fixa a partir do valor recebido no extrato.
// CDI diario do LEDGR (cdi_daily_rates) do dia da aplicacao ate a vespera do resgate, % do indexador da ficha,
// IOF regressivo (< 30 dias) e IR regressivo - a mesma conta da conferencia dos resgates 2022-2025 da Jose Silva
// (centavos de diferenca contra Diario/ECD). Rendimento bruto = base do IR (ja liquido de IOF), como nas fichas.
// O principal absorve o arredondamento para fechar exatamente no valor recebido.
import { PrismaService } from '@/prisma/prisma.service';

const IOF_TAB = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];
export const aliquotaIR = (dias: number) => (dias <= 180 ? 0.225 : dias <= 360 ? 0.2 : dias <= 720 ? 0.175 : 0.15);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const DIA = 86400000;

export interface Deducao {
  principal: number; rendimentoBruto: number; iof: number; ir: number; liquido: number;
  fator: number; dias: number; aliqIR: number; aliqIOF: number; cdiAte: string | null; cdiCompleto: boolean;
}

export async function deduzirResgate(
  prisma: PrismaService,
  inv: { applicationDate: Date; indexer: any; indexerRate: any; irrfExempt: boolean },
  dataISO: string,
  valorRecebido: number,
): Promise<Deducao> {
  if (String(inv.indexer) !== 'CDI') {
    throw new Error(`Indexador ${inv.indexer} ainda sem dedu\u00e7\u00e3o autom\u00e1tica - informe os valores do extrato de investimentos.`);
  }
  const app = inv.applicationDate.toISOString().slice(0, 10);
  if (app >= dataISO) throw new Error('Resgate na data da aplica\u00e7\u00e3o ou antes dela.');
  const pct = Number(inv.indexerRate) / 100;
  const rows = await prisma.cdiDailyRate.findMany({
    where: { date: { gte: new Date(app + 'T00:00:00Z'), lt: new Date(dataISO + 'T00:00:00Z') } },
    select: { date: true, dailyRate: true },
    orderBy: { date: 'asc' },
  });
  let fator = 1;
  for (const r of rows) fator *= 1 + (Number(r.dailyRate) / 100) * pct;
  const dias = Math.round((Date.parse(dataISO + 'T00:00:00Z') - Date.parse(app + 'T00:00:00Z')) / DIA);
  const aliqIOF = dias < 30 ? IOF_TAB[Math.max(0, dias - 1)] / 100 : 0;
  const aliqIR = inv.irrfExempt ? 0 : aliquotaIR(dias);
  const k = (fator - 1) * (1 - aliqIOF) * (1 - aliqIR);
  const p0 = valorRecebido / (1 + k);
  const g = p0 * (fator - 1);
  const iof = r2(g * aliqIOF);
  const rendimentoBruto = r2(g * (1 - aliqIOF));
  const ir = r2(rendimentoBruto * aliqIR);
  const liquido = r2(rendimentoBruto - ir);
  const principal = r2(valorRecebido - liquido);
  const cdiAte = rows.length ? rows[rows.length - 1].date.toISOString().slice(0, 10) : null;
  const cdiCompleto = !!cdiAte && Date.parse(dataISO + 'T00:00:00Z') - Date.parse(cdiAte + 'T00:00:00Z') <= 5 * DIA;
  return { principal, rendimentoBruto, iof, ir, liquido, fator: Math.round(fator * 1e8) / 1e8, dias, aliqIR, aliqIOF, cdiAte, cdiCompleto };
}
