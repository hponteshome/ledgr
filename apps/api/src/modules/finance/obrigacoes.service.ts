// apps/api/src/modules/finance/obrigacoes.service.ts
// ============================================================================
// CATALOGO DE OBRIGACOES - REESCRITO 16/11/2026 (Agenda de Obrigacoes, Fase 1)
// - Regime pela data (company_tax_regimes, tabela FORMA_TRIB da ECF + S/M)
// - Perfil da empresa: tem_folha, tem_pro_labore; locacao deduzida dos contratos
// - Regras com vigencia (competencia de/ate) e prazo pelos feriados (holidays)
// - gerarHistorico: cria o que falta desde a abertura; nunca altera o existente
// ============================================================================
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type ObrigacaoStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "OVERDUE" | "DISPENSED" | "RECTIFY";
export interface UpsertObrigacaoDto { code: string; competence: string; dueDate: string; status: ObrigacaoStatus; notes?: string; }

type Ajuste = 'ANTECIPA' | 'POSTERGA';
interface Ctx { regime: string | null; apuracao: string | null; temFolha: boolean; temProLabore: boolean; temLocacao: (ano: number) => boolean; }
export interface Regra {
  code: string; label: string; tipo: 'TRIBUTO' | 'ACESSORIA'; periodicidade: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL';
  vigencia?: { de?: string; ate?: string };
  aplica: (c: Ctx, ano: number, mes: number) => boolean;
  prazo: (ano: number, mes: number, u: Util) => Date;
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const comp = (y: number, m: number) => y + '-' + String(m).padStart(2, '0');
const mais = (y: number, m: number, add: number): [number, number] => { const d = utc(y, m + add, 1); return [d.getUTCFullYear(), d.getUTCMonth() + 1]; };

export class Util {
  constructor(private feriados: Set<string>) {}
  ehUtil(d: Date) { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !this.feriados.has(iso(d)); }
  proximoUtil(d: Date) { const x = new Date(d); while (!this.ehUtil(x)) x.setUTCDate(x.getUTCDate() + 1); return x; }
  anteriorUtil(d: Date) { const x = new Date(d); while (!this.ehUtil(x)) x.setUTCDate(x.getUTCDate() - 1); return x; }
  ultimoUtil(y: number, m: number) { return this.anteriorUtil(utc(y, m + 1, 0)); }
  nUtil(y: number, m: number, n: number) { const d = utc(y, m, 1); let c = 0; for (;;) { if (this.ehUtil(d)) { c++; if (c === n) return new Date(d); } d.setUTCDate(d.getUTCDate() + 1); } }
  dia(y: number, m: number, dia: number, aj: Ajuste) { const d = utc(y, m, dia); return aj === 'ANTECIPA' ? this.anteriorUtil(d) : this.proximoUtil(d); }
}

const LUCRO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const REAL_PRES = ['1', '2', '3', '4', '5', '6', '7'];
const PRES_ARB = ['3', '4', '5', '6', '7'];
const folha = (c: Ctx) => c.temFolha || c.temProLabore;
const em = (c: Ctx, lista: string[]) => !!c.regime && lista.includes(c.regime);

export const CATALOGO: Regra[] = [
  // ---- mensais ----
  { code: 'FGTS', label: 'FGTS', tipo: 'TRIBUTO', periodicidade: 'MENSAL', aplica: (c) => c.temFolha,
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, comp(y, m) >= '2024-01' ? 20 : 7, 'ANTECIPA'); } },
  { code: 'ESOCIAL', label: 'eSocial (folha)', tipo: 'ACESSORIA', periodicidade: 'MENSAL', aplica: folha,
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, 15, 'ANTECIPA'); } },
  { code: 'GPS_INSS', label: 'GPS (INSS)', tipo: 'TRIBUTO', periodicidade: 'MENSAL', vigencia: { ate: '2021-09' }, aplica: folha,
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, 20, 'ANTECIPA'); } },
  { code: 'INSS_DARF', label: 'INSS (DARF da DCTFWeb)', tipo: 'TRIBUTO', periodicidade: 'MENSAL', vigencia: { de: '2021-10' }, aplica: folha,
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, 20, 'ANTECIPA'); } },
  { code: 'DCTFWEB', label: 'DCTFWeb/MIT', tipo: 'ACESSORIA', periodicidade: 'MENSAL', vigencia: { de: '2021-10' },
    aplica: (c, y, m) => folha(c) || (comp(y, m) >= '2025-01' && em(c, LUCRO)),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, comp(y, m) >= '2025-01' ? 25 : 15, 'ANTECIPA'); } },
  { code: 'DCTF', label: 'DCTF (PGD)', tipo: 'ACESSORIA', periodicidade: 'MENSAL', vigencia: { ate: '2024-12' }, aplica: (c) => em(c, LUCRO),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 2); return u.nUtil(ny, nm, 15); } },
  { code: 'PIS_COFINS', label: 'PIS/Cofins (DARF)', tipo: 'TRIBUTO', periodicidade: 'MENSAL', aplica: (c) => em(c, REAL_PRES),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, 25, 'ANTECIPA'); } },
  { code: 'EFD_CONTRIB', label: 'EFD-Contribuicoes', tipo: 'ACESSORIA', periodicidade: 'MENSAL', aplica: (c) => em(c, REAL_PRES),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 2); return u.nUtil(ny, nm, 10); } },
  { code: 'DAS', label: 'DAS (Simples Nacional)', tipo: 'TRIBUTO', periodicidade: 'MENSAL', aplica: (c) => em(c, ['S', 'M']),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.dia(ny, nm, 20, 'POSTERGA'); } },
  // ---- trimestrais (competencia = mes de fim do trimestre) ----
  { code: 'IRPJ_CSLL_TRI', label: 'IRPJ/CSLL trimestral (DARF)', tipo: 'TRIBUTO', periodicidade: 'TRIMESTRAL',
    aplica: (c) => em(c, PRES_ARB) || (c.regime === '1' && c.apuracao === 'T'),
    prazo: (y, m, u) => { const [ny, nm] = mais(y, m, 1); return u.ultimoUtil(ny, nm); } },
  // ---- anuais (competencia = ano) ----
  { code: 'IRPJ_CSLL_AJUSTE', label: 'IRPJ/CSLL ajuste anual (DARF)', tipo: 'TRIBUTO', periodicidade: 'ANUAL',
    aplica: (c) => c.regime === '1' && c.apuracao !== 'T', prazo: (y, _m, u) => u.ultimoUtil(y + 1, 3) },
  { code: 'ECD', label: 'ECD', tipo: 'ACESSORIA', periodicidade: 'ANUAL', aplica: (c) => c.regime === '1',
    prazo: (y, _m, u) => u.ultimoUtil(y + 1, y >= 2020 ? 6 : 5) },
  { code: 'ECF', label: 'ECF', tipo: 'ACESSORIA', periodicidade: 'ANUAL', vigencia: { de: '2014' }, aplica: (c) => em(c, LUCRO), prazo: (y, _m, u) => u.ultimoUtil(y + 1, 7) },
  { code: 'DIMOB', label: 'DIMOB', tipo: 'ACESSORIA', periodicidade: 'ANUAL', aplica: (c, y) => c.temLocacao(y), prazo: (y, _m, u) => u.ultimoUtil(y + 1, 2) },
  { code: 'DIRF', label: 'DIRF', tipo: 'ACESSORIA', periodicidade: 'ANUAL', vigencia: { ate: '2024' }, aplica: folha, prazo: (y, _m, u) => u.ultimoUtil(y + 1, 2) },
  { code: 'DEFIS', label: 'DEFIS', tipo: 'ACESSORIA', periodicidade: 'ANUAL', aplica: (c) => c.regime === 'S', prazo: (y, _m, u) => u.dia(y + 1, 3, 31, 'POSTERGA') },
];

const vigente = (r: Regra, c: string) => (!r.vigencia?.de || c >= r.vigencia.de) && (!r.vigencia?.ate || c <= r.vigencia.ate);

@Injectable()
export class ObrigacoesService {
  constructor(private readonly prisma: PrismaService) {}

  catalogo() { return CATALOGO.map(r => ({ code: r.code, label: r.label, tipo: r.tipo, periodicidade: r.periodicidade, vigencia: r.vigencia ?? null })); }

  private async contexto(companyId: string) {
    const [company, regimes, contratos, feriados] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { openingDate: true, temFolha: true, temProLabore: true, obrigacoesDesde: true } }),
      this.prisma.companyTaxRegime.findMany({ where: { companyId }, orderBy: { dtIni: 'asc' } }),
      this.prisma.rentalContract.findMany({ where: { companyId }, select: { startDate: true, endDate: true } }),
      this.prisma.holiday.findMany({ where: { type: 'NACIONAL' as any }, select: { date: true } }),
    ]);
    const util = new Util(new Set(feriados.map(f => iso(f.date))));
    const regimeEm = (d: Date) => {
      const t = d.getTime();
      const r = regimes.filter(g => g.dtIni.getTime() <= t && (!g.dtFin || g.dtFin.getTime() >= t));
      return r.length ? r[r.length - 1] : null;
    };
    const temLocacao = (ano: number) => contratos.some(k => k.startDate && k.startDate.getTime() <= utc(ano, 12, 31).getTime() && (!k.endDate || k.endDate.getTime() >= utc(ano, 1, 1).getTime()));
    return { company, regimes, util, regimeEm, temLocacao };
  }

  /** Gera (createMany, sem sobrescrever) todas as obrigacoes aplicaveis desde a abertura ate a competencia atual. */
  async gerarHistorico(companyId: string) {
    const { company, regimes, util, regimeEm, temLocacao } = await this.contexto(companyId);
    if (!company) return { criadas: 0, total: 0 };
    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear(), mesAtual = hoje.getUTCMonth() + 1;
    // Inicio: obrigacoes_desde da empresa ou ultimos 5 anos; nunca antes da abertura.
    // Tributos (DARF) so a partir do ano corrente - os pagos ficam controlados em tax_darfs.
    const abertura = company.openingDate;
    const padrao = utc(anoAtual - 5, 1, 1);
    const desde = company.obrigacoesDesde ?? (abertura > padrao ? abertura : padrao);
    const ini = desde < abertura ? abertura : desde;
    const compIniTributo = comp(anoAtual, 1);
    const pode = (r: Regra, cp: string) => r.tipo !== 'TRIBUTO' || cp >= compIniTributo;
    let y = ini.getUTCFullYear(), m = ini.getUTCMonth() + 1;
    const novas: { code: string; competence: string; dueDate: Date }[] = [];
    const ctxDe = (d: Date): Ctx => {
      const g = regimeEm(d);
      return { regime: g?.formaTributacao ?? null, apuracao: g?.periodoApuracaoIRPJ ?? null, temFolha: company.temFolha, temProLabore: company.temProLabore, temLocacao };
    };
    while (y < anoAtual || (y === anoAtual && m <= mesAtual)) {
      const c = ctxDe(utc(y, m, 1)); const cp = comp(y, m);
      for (const r of CATALOGO) {
        if (r.periodicidade === 'MENSAL' && vigente(r, cp) && pode(r, cp) && r.aplica(c, y, m)) novas.push({ code: r.code, competence: cp, dueDate: r.prazo(y, m, util) });
        if (r.periodicidade === 'TRIMESTRAL' && m % 3 === 0 && vigente(r, cp) && pode(r, cp) && r.aplica(c, y, m)) novas.push({ code: r.code, competence: cp, dueDate: r.prazo(y, m, util) });
      }
      [y, m] = mais(y, m, 1);
    }
    for (let a = ini.getUTCFullYear(); a < anoAtual; a++) {
      const c = ctxDe(utc(a, 12, 31));
      for (const r of CATALOGO) {
        if (r.periodicidade === 'ANUAL' && vigente(r, String(a)) && pode(r, String(a)) && r.aplica(c, a, 12)) novas.push({ code: r.code, competence: String(a), dueDate: r.prazo(a, 12, util) });
      }
    }
    // Reconciliacao: apaga o que o proprio gerador criou e deixou de valer (PENDING sem nenhuma intervencao do usuario).
    const devidas = new Set(novas.map(n => n.code + '|' + n.competence));
    const codigos = CATALOGO.map(r => r.code);
    const pendentes = await this.prisma.fiscalObligation.findMany({
      where: { companyId, status: 'PENDING' as any, code: { in: codigos } },
      select: { id: true, code: true, competence: true, notes: true, receiptNumber: true, deliveredAt: true, doneAt: true, dependsOn: true },
    });
    const remover = pendentes
      .filter(p => !p.notes && !p.receiptNumber && !p.deliveredAt && !p.doneAt && !p.dependsOn && !devidas.has(p.code + '|' + p.competence))
      .map(p => p.id);
    if (remover.length) await this.prisma.fiscalObligation.deleteMany({ where: { id: { in: remover } } });
    const existentes = await this.prisma.fiscalObligation.findMany({ where: { companyId }, select: { code: true, competence: true } });
    const chave = new Set(existentes.map(e => e.code + '|' + e.competence));
    const data = novas.filter(n => !chave.has(n.code + '|' + n.competence)).map(n => ({ companyId, code: n.code, competence: n.competence, dueDate: n.dueDate, status: 'PENDING' as any }));
    if (data.length) await this.prisma.fiscalObligation.createMany({ data, skipDuplicates: true });
    return { criadas: data.length, removidas: remover.length, total: existentes.length + data.length, desde: iso(ini), regimes: regimes.length };
  }

  // Compatibilidade: gera o historico e devolve a competencia pedida
  async gerarObrigacoes(companyId: string, competence: string) {
    await this.gerarHistorico(companyId);
    return this.findByCompetence(companyId, competence);
  }

  async findByCompetence(companyId: string, competence: string) {
    return this.prisma.fiscalObligation.findMany({ where: { companyId, competence }, orderBy: { dueDate: "asc" } });
  }

  async findAll(companyId: string) {
    return this.prisma.fiscalObligation.findMany({ where: { companyId }, orderBy: [{ competence: "desc" }, { dueDate: "asc" }] });
  }

  async updateStatus(companyId: string, userId: string, code: string, competence: string, status: ObrigacaoStatus, notes?: string) {
    return this.prisma.fiscalObligation.upsert({
      where: { companyId_code_competence: { companyId, code, competence } },
      create: { companyId, code, competence, dueDate: new Date(), status, notes: notes ?? null, doneAt: status === "DONE" ? new Date() : null, doneById: status === "DONE" ? userId : null },
      update: { status, notes: notes ?? null, doneAt: status === "DONE" ? new Date() : null, doneById: status === "DONE" ? userId : null },
    });
  }

  async upsertMany(companyId: string, userId: string, items: UpsertObrigacaoDto[]) {
    return Promise.all(items.map((dto) => this.prisma.fiscalObligation.upsert({
      where: { companyId_code_competence: { companyId, code: dto.code, competence: dto.competence } },
      create: { companyId, code: dto.code, competence: dto.competence, dueDate: new Date(dto.dueDate), status: dto.status, notes: dto.notes ?? null, doneAt: dto.status === "DONE" ? new Date() : null, doneById: dto.status === "DONE" ? userId : null },
      update: { status: dto.status, dueDate: new Date(dto.dueDate), notes: dto.notes ?? null, doneAt: dto.status === "DONE" ? new Date() : null, doneById: dto.status === "DONE" ? userId : null },
    })));
  }
}
