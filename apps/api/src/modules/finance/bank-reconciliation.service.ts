// apps/api/src/modules/finance/bank-reconciliation.service.ts
// EXTBB-10A (23/11/2026) - Extratos e Conciliacao: linhas, destino unico por linha, previa e geracao.
// - Lancamentos gerados pelo JournalEntryService (trava de competencia fechada, conta do plano da empresa,
//   balanco das partidas, data UTC), sourceModule BANK_IMPORT, reference = id da linha. 1 lancamento por linha.
// - "Ja contabilizado": lancamento existente na conta contabil do banco com mesma data, valor e lado,
//   ainda sem vinculo com outra linha (ex.: dez/2025 contra a ECD importada). So vincula, nao gera.
// - Destinos desta fase: DIRECT_ENTRY, ALREADY_POSTED, IGNORE (baixa de titulo AP/AR: EXTBB-11).
// EXTINV-01 (23/11/2026) - destino INVEST_REDEMPTION: resgate de aplicacao de renda fixa (ficha da carteira).
// - A linha guarda a ficha (investmentId) e a divisao confirmada (investSplit: principal, rendimento bruto
//   [base do IR, ja liquido de IOF], IOF, IR, liquido; origem CDI ou MANUAL). Principal + liquido = valor da linha.
// - Ao gerar: 1 lancamento (D banco valor recebido, D IRRF, C conta da aplicacao principal, C receita rendimento
//   bruto) + resgate gravado na ficha (FixedIncomeService.applyRedemption), tudo ligado (linha, lancamento, evento).
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { JournalEntryService } from '../accounting/services/journal-entry.service';
import { FixedIncomeService } from '../accounting/fixed-income/fixed-income.service';
import { SuggestionService } from './suggestion.service';
import { deduzirResgate, Deducao } from './invest-redemption';

export type BankLineDestination = 'DIRECT_ENTRY' | 'ALREADY_POSTED' | 'IGNORE' | 'INVEST_REDEMPTION';

export interface InvestSplitDto { principal: number; rendimentoBruto: number; ir: number; iof?: number }

export interface SetBankLinesDto {
  ids: string[];
  destination: BankLineDestination | null; // null = volta a pendente
  accountId?: string;      // DIRECT_ENTRY: contrapartida
  memo?: string;           // historico do lancamento
  ignoreReason?: string;   // IGNORE: obrigatorio
  matchedEntryId?: string; // ALREADY_POSTED com 1 linha: lancamento escolhido; sem ele, deteccao automatica
  remember?: boolean;      // DIRECT_ENTRY: grava a regra para as proximas importacoes
  investmentId?: string;   // INVEST_REDEMPTION: ficha da Renda Fixa
  split?: InvestSplitDto;  // INVEST_REDEMPTION: valores informados (sem eles, deducao pelo CDI)
}

const ACC = { id: true, code: true, reducedCode: true, name: true };
const TRAVADAS = ['POSTED', 'RECONCILED'];
// Data da linha (gravada em hora local pelo parser) -> 'YYYY-MM-DD'
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const utcDia = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const soDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');
const ehResgateAplicacao = (l: any) =>
  String(l.type) === 'CREDIT' && /RESG/i.test(String(l.description ?? '')) && /CDB|RDB|LCI|LCA|LF |DEB/i.test(String(l.description ?? ''));

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalEntryService,
    private readonly suggestion: SuggestionService,
    private readonly fixedIncome: FixedIncomeService,
  ) {}

  private async loadStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId, deletedAt: null },
      include: { bankAccount: { include: { ledgerAccount: { select: ACC }, investmentAccount: { select: ACC } } } },
    });
    if (!stmt) throw new NotFoundException('Extrato n\u00e3o encontrado.');
    return stmt;
  }

  private loadLines(statementId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { statementId, deletedAt: null },
      orderBy: [{ lineNo: 'asc' }, { transactionDate: 'asc' }],
    });
  }

  // ── EXTINV-01: fichas da Renda Fixa ────────────────────────────────────────
  private fichas(companyId: string, soAtivas: boolean) {
    return this.prisma.fixedIncomeInvestment.findMany({
      where: { companyId, deletedAt: null, ...(soAtivas ? { status: 'ATIVO' as any } : {}) },
      select: {
        id: true, description: true, externalCode: true, type: true, status: true, applicationDate: true, maturityDate: true,
        capitalBalance: true, indexer: true, indexerRate: true, irrfExempt: true,
        assetAccountId: true, revenueAccountId: true, irrfAccountId: true,
      },
      orderBy: { applicationDate: 'asc' },
    });
  }

  private fichaDoDocumento(fichas: { id: string; externalCode: string | null; description: string }[], bankRef: string | null | undefined) {
    const d = soDigitos(bankRef);
    if (d.length < 8) return null;
    const hit = fichas.filter(f => soDigitos(f.externalCode || f.description) === d);
    return hit.length === 1 ? hit[0] : null;
  }

  // principal ja reservado por outras linhas classificadas do mesmo extrato, por ficha
  private async reservado(statementId: string, excetoLinha: string) {
    const outras = await this.prisma.bankTransaction.findMany({
      where: { statementId, deletedAt: null, destination: 'INVEST_REDEMPTION' as any, status: 'CLASSIFIED' as any, id: { not: excetoLinha } },
      select: { investmentId: true, investSplit: true },
    });
    const m = new Map<string, number>();
    for (const o of outras) if (o.investmentId) m.set(o.investmentId, r2((m.get(o.investmentId) ?? 0) + Number((o.investSplit as any)?.principal ?? 0)));
    return m;
  }

  // Lancamentos existentes na conta do banco que casam com linhas abertas (data, valor, lado), ainda sem vinculo
  private async detectPosted(companyId: string, ledgerId: string | null | undefined, lines: any[]) {
    const out = new Map<string, string>();
    const abertas = lines.filter(l => !l.journalEntryId && !TRAVADAS.includes(String(l.status)) && String(l.status) !== 'IGNORED');
    if (!ledgerId || abertas.length === 0) return out;
    const dias = abertas.map(l => dia(l.transactionDate)).sort();
    const itens = await this.prisma.journalEntryItem.findMany({
      where: { accountId: ledgerId, journalEntry: { companyId, deletedAt: null, date: { gte: utcDia(dias[0]), lte: utcDia(dias[dias.length - 1]) } } },
      select: { journalEntryId: true, type: true, value: true, journalEntry: { select: { date: true } } },
    });
    if (!itens.length) return out;
    const ligados = await this.prisma.bankTransaction.findMany({
      where: { deletedAt: null, journalEntryId: { in: [...new Set(itens.map(i => i.journalEntryId))] } },
      select: { journalEntryId: true },
    });
    const usados = new Set<string>(ligados.map(x => x.journalEntryId as string));
    for (const l of abertas) {
      const lado = l.type === 'CREDIT' ? 'DEBIT' : 'CREDIT'; // entrada no banco = debito na conta do banco
      const hit = itens.find(i => !usados.has(i.journalEntryId) && String(i.type) === lado
        && Math.abs(Number(i.value) - Number(l.amount)) < 0.005
        && i.journalEntry.date.toISOString().slice(0, 10) === dia(l.transactionDate));
      if (hit) { usados.add(hit.journalEntryId); out.set(l.id, hit.journalEntryId); }
    }
    return out;
  }

  private async ledgerBalanceUntil(companyId: string, ledgerId: string, ate: string) {
    const g = await this.prisma.journalEntryItem.groupBy({
      by: ['type'],
      where: { accountId: ledgerId, journalEntry: { companyId, deletedAt: null, date: { lte: utcDia(ate) } } },
      _sum: { value: true },
    });
    const v = (t: string) => Number(g.find(x => String(x.type) === t)?._sum?.value ?? 0);
    return r2(v('DEBIT') - v('CREDIT'));
  }

  // ── Linhas do extrato ──────────────────────────────────────────────────────
  // REGRA-01: recalcula a sugestao (regra aprendida/fixa/similar) das linhas pendentes e sem destino.
  // Nao mexe em sugestao por documento ou aplicacao automatica, nem em linha de resgate; so grava quando ha conta.
  private async refreshSuggestions(companyId: string, statementId?: string) {
    const abertas = await this.prisma.bankTransaction.findMany({
      where: {
        companyId, deletedAt: null, destination: null, status: 'PENDING' as any,
        ...(statementId ? { statementId } : {}),
        OR: [{ suggestionSource: null }, { suggestionSource: { in: ['FIXED', 'LEARNED', 'FUZZY'] } }],
      },
      select: { id: true, type: true, description: true, descriptionNorm: true, suggestedAccountId: true, suggestionSource: true, suggestionConfidence: true },
    });
    const alvo = abertas.filter(l => !ehResgateAplicacao(l));
    if (!alvo.length) return 0;
    const res = await this.suggestion.suggestBatch(companyId, alvo.map(l => ({ descriptionNorm: l.descriptionNorm, type: l.type as any })));
    let n = 0;
    for (let i = 0; i < alvo.length; i++) {
      const r = res[i];
      const l = alvo[i];
      if (!r?.accountId) continue;
      if (r.accountId === l.suggestedAccountId && r.source === l.suggestionSource && r.confidence === l.suggestionConfidence) continue;
      await this.prisma.bankTransaction.update({ where: { id: l.id }, data: { suggestedAccountId: r.accountId, suggestionSource: r.source, suggestionConfidence: r.confidence } });
      n++;
    }
    return n;
  }

  async getLines(companyId: string, statementId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    await this.refreshSuggestions(companyId, statementId); // REGRA-01
    const lines = await this.loadLines(statementId);
    const accIds = [...new Set(lines.flatMap(l => [l.accountId, l.suggestedAccountId]).filter(Boolean))] as string[];
    const accs = accIds.length ? await this.prisma.chartOfAccounts.findMany({ where: { id: { in: accIds } }, select: ACC }) : [];
    const accMap = new Map(accs.map(a => [a.id, a]));
    const matches = await this.detectPosted(companyId, stmt.bankAccount?.ledgerAccountId, lines);
    const entryIds = [...new Set([...lines.map(l => l.journalEntryId), ...matches.values()].filter(Boolean))] as string[];
    const entries = entryIds.length
      ? await this.prisma.journalEntry.findMany({ where: { id: { in: entryIds } }, select: { id: true, date: true, description: true, sourceModule: true, reference: true } })
      : [];
    const entMap = new Map(entries.map(e => [e.id, e]));
    const todas = await this.fichas(companyId, false);
    const fMap = new Map(todas.map(f => [f.id, f]));
    const ativas = todas.filter(f => String(f.status) === 'ATIVO');
    return {
      statement: {
        id: stmt.id, fileName: stmt.fileName, layout: stmt.layout, status: stmt.status,
        bankName: stmt.bankName, agency: stmt.agency, account: stmt.account,
        periodFrom: stmt.periodFrom, periodTo: stmt.periodTo,
        openingBalance: stmt.openingBalance != null ? Number(stmt.openingBalance) : null,
        closingBalance: stmt.closingBalance != null ? Number(stmt.closingBalance) : null,
        bankAccount: stmt.bankAccount ? {
          id: stmt.bankAccount.id, nickname: stmt.bankAccount.nickname,
          ledgerAccount: stmt.bankAccount.ledgerAccount, investmentAccount: stmt.bankAccount.investmentAccount,
        } : null,
      },
      lines: lines.map(l => {
        const f = l.investmentId ? fMap.get(l.investmentId) : undefined;
        const porDoc = !l.destination && ehResgateAplicacao(l) ? this.fichaDoDocumento(ativas, l.bankRef) : null;
        return {
          id: l.id, lineNo: l.lineNo, date: dia(l.transactionDate), type: l.type,
          amount: Number(l.amount), balance: l.balance != null ? Number(l.balance) : null,
          description: l.description, bankRef: l.bankRef, bankHistCode: l.bankHistCode,
          counterpartyName: l.counterpartyName, counterpartyDoc: l.counterpartyDoc,
          status: l.status, destination: l.destination, ignoreReason: l.ignoreReason, memo: l.memo,
          account: l.accountId ? accMap.get(l.accountId) ?? null : null,
          suggestion: l.suggestionSource || l.suggestedAccountId
            ? { account: l.suggestedAccountId ? accMap.get(l.suggestedAccountId) ?? null : null, source: l.suggestionSource, confidence: l.suggestionConfidence, memo: l.memo }
            : null,
          journalEntry: l.journalEntryId ? entMap.get(l.journalEntryId) ?? null : null,
          possibleMatch: !l.journalEntryId && matches.get(l.id) ? entMap.get(matches.get(l.id) as string) ?? null : null,
          invest: l.investmentId ? { investmentId: l.investmentId, cdb: f?.description ?? null, tipo: f?.type ?? null, split: l.investSplit ?? null, eventId: l.fixedIncomeEventId ?? null } : null,
          investHint: !l.destination && ehResgateAplicacao(l)
            ? { investmentId: porDoc?.id ?? null, cdb: porDoc?.description ?? null, porDocumento: !!porDoc }
            : null,
        };
      }),
    };
  }

  // ── EXTINV-01: opcoes de resgate para uma linha ───────────────────────────
  async investOptions(companyId: string, statementId: string, lineId: string) {
    await this.loadStatement(companyId, statementId);
    const l = await this.prisma.bankTransaction.findFirst({ where: { id: lineId, statementId, deletedAt: null } });
    if (!l) throw new NotFoundException('Linha n\u00e3o encontrada neste extrato.');
    if (String(l.type) !== 'CREDIT') throw new BadRequestException('Resgate de investimento s\u00f3 para entradas (cr\u00e9dito) no extrato.');
    const data = dia(l.transactionDate);
    const valor = Number(l.amount);
    const fichas = (await this.fichas(companyId, true)).filter(f => (iso(f.applicationDate) as string) < data);
    const porDoc = this.fichaDoDocumento(fichas, l.bankRef);
    const reservado = await this.reservado(statementId, l.id);
    const candidatos: any[] = [];
    for (const f of fichas) {
      const disponivel = r2(Number(f.capitalBalance) - (reservado.get(f.id) ?? 0));
      let deducao: Deducao | null = null;
      let erro: string | null = null;
      try { deducao = await deduzirResgate(this.prisma, f, data, valor); } catch (e: any) { erro = e?.message ?? String(e); }
      candidatos.push({
        investmentId: f.id, cdb: f.description, tipo: f.type, aplicacao: iso(f.applicationDate), vencimento: iso(f.maturityDate),
        indexador: `${Number(f.indexerRate)}% ${f.indexer}`, saldoCapital: Number(f.capitalBalance), disponivel,
        porDocumento: porDoc?.id === f.id, deducao, erro,
        cabe: !!deducao && deducao.principal <= disponivel + 0.01,
        contasOk: !!(f.assetAccountId && f.revenueAccountId && f.irrfAccountId),
      });
    }
    candidatos.sort((a, b) => Number(b.porDocumento) - Number(a.porDocumento) || Number(b.cabe) - Number(a.cabe) || String(a.aplicacao).localeCompare(String(b.aplicacao)));
    const avisos: string[] = [];
    if (candidatos.some(c => c.deducao && !c.deducao.cdiCompleto)) avisos.push('CDI di\u00e1rio incompleto at\u00e9 a data do resgate: valores estimados com o CDI dispon\u00edvel.');
    if (!porDoc && ehResgateAplicacao(l)) avisos.push('O documento da linha n\u00e3o identifica a aplica\u00e7\u00e3o: confira no extrato de investimentos do banco.');
    return {
      linha: { id: l.id, lineNo: l.lineNo, data, valor, description: l.description, bankRef: l.bankRef },
      atual: String(l.destination ?? '') === 'INVEST_REDEMPTION' ? { investmentId: l.investmentId, split: l.investSplit } : null,
      candidatos, avisos,
    };
  }

  // ── Destino em lote ────────────────────────────────────────────────────────
  async setLines(companyId: string, statementId: string, dto: SetBankLinesDto, userId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    const ids = Array.isArray(dto?.ids) ? [...new Set(dto.ids)] : [];
    if (!ids.length) throw new BadRequestException('Selecione ao menos uma linha.');
    const lines = await this.prisma.bankTransaction.findMany({ where: { id: { in: ids }, statementId, deletedAt: null } });
    if (lines.length !== ids.length) throw new BadRequestException('Linha(s) n\u00e3o encontrada(s) neste extrato.');
    const travadas = lines.filter(l => TRAVADAS.includes(String(l.status)));
    if (travadas.length) throw new BadRequestException(`${travadas.length} linha(s) j\u00e1 contabilizada(s) ou conciliada(s) n\u00e3o podem ser alteradas.`);
    const where = { id: { in: ids } };
    const d = dto.destination ?? null;
    const semInvest = { investmentId: null, investSplit: Prisma.DbNull };

    if (d === null) {
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: null, accountId: null, journalEntryId: null, ignoreReason: null, status: 'PENDING' as any, ...semInvest } });
    } else if (d === 'IGNORE') {
      const motivo = (dto.ignoreReason ?? '').trim();
      if (!motivo) throw new BadRequestException('Informe o motivo para ignorar.');
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: 'IGNORE' as any, ignoreReason: motivo.slice(0, 255), accountId: null, journalEntryId: null, status: 'CLASSIFIED' as any, ...semInvest } });
    } else if (d === 'DIRECT_ENTRY') {
      if (!dto.accountId) throw new BadRequestException('Informe a conta de contrapartida.');
      const conta = await this.prisma.chartOfAccounts.findFirst({ where: { id: dto.accountId, companyId, deletedAt: null }, select: { id: true, isAnalytic: true, isActive: true } });
      if (!conta) throw new BadRequestException('Conta n\u00e3o encontrada no plano da empresa.');
      if (!conta.isAnalytic || !conta.isActive) throw new BadRequestException('Escolha uma conta anal\u00edtica ativa.');
      if (stmt.bankAccount?.ledgerAccountId === dto.accountId) throw new BadRequestException('A contrapartida n\u00e3o pode ser a pr\u00f3pria conta do banco.');
      // EXTINV-03: resgate de aplicacao nao vai como lancamento direto na conta da aplicacao (perderia rendimento e IR)
      const fichaDaConta = await this.prisma.fixedIncomeInvestment.findFirst({ where: { companyId, deletedAt: null, assetAccountId: dto.accountId }, select: { type: true, description: true } });
      const resgates = lines.filter(l => ehResgateAplicacao(l));
      if (fichaDaConta && resgates.length) {
        throw new BadRequestException(`${resgates.length === 1 ? 'A linha' : `${resgates.length} linhas`} de resgate n\u00e3o pode(m) ir direto para a conta do ${fichaDaConta.type} ${fichaDaConta.description}: use "Resgate de investimento..." para separar principal, rendimento e IR.`);
      }
      const memo = dto.memo?.trim();
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: 'DIRECT_ENTRY' as any, accountId: dto.accountId, ...(memo ? { memo } : {}), journalEntryId: null, ignoreReason: null, status: 'CLASSIFIED' as any, ...semInvest } });
      if (dto.remember) {
        const vistos = new Set<string>();
        for (const l of lines) {
          const k = `${l.descriptionNorm}|${l.type}`;
          if (vistos.has(k)) continue;
          vistos.add(k);
          await this.suggestion.learn(companyId, l.descriptionNorm, l.type as any, dto.accountId, memo || l.memo || l.description, userId, stmt.bankCode as any);
        }
        await this.refreshSuggestions(companyId); // REGRA-01: regra nova vale para os extratos abertos
      }
    } else if (d === 'ALREADY_POSTED') {
      const ledgerId = stmt.bankAccount?.ledgerAccountId ?? null;
      if (!ledgerId) throw new BadRequestException('A conta banc\u00e1ria n\u00e3o tem conta cont\u00e1bil no cadastro.');
      let mapa: Map<string, string>;
      if (dto.matchedEntryId) {
        if (ids.length !== 1) throw new BadRequestException('Escolha o lan\u00e7amento existente para uma linha por vez.');
        const ok = await this.prisma.journalEntryItem.findFirst({ where: { journalEntryId: dto.matchedEntryId, accountId: ledgerId, journalEntry: { companyId, deletedAt: null } }, select: { id: true } });
        if (!ok) throw new BadRequestException('O lan\u00e7amento escolhido n\u00e3o movimenta a conta cont\u00e1bil do banco.');
        const outra = await this.prisma.bankTransaction.findFirst({ where: { journalEntryId: dto.matchedEntryId, deletedAt: null, id: { notIn: ids } }, select: { id: true } });
        if (outra) throw new BadRequestException('Esse lan\u00e7amento j\u00e1 est\u00e1 vinculado a outra linha de extrato.');
        mapa = new Map([[ids[0], dto.matchedEntryId]]);
      } else {
        mapa = await this.detectPosted(companyId, ledgerId, lines.map(l => ({ ...l, journalEntryId: null, status: 'PENDING' })));
      }
      const sem = lines.filter(l => !mapa.has(l.id));
      if (sem.length) {
        throw new BadRequestException(`${sem.length} linha(s) sem lan\u00e7amento correspondente na conta do banco (mesma data, valor e lado). Use lan\u00e7amento direto ou escolha o lan\u00e7amento.`);
      }
      for (const l of lines) {
        await this.prisma.bankTransaction.update({ where: { id: l.id }, data: { destination: 'ALREADY_POSTED' as any, journalEntryId: mapa.get(l.id) as string, accountId: null, ignoreReason: null, status: 'CLASSIFIED' as any, ...semInvest } });
      }
    } else if (d === 'INVEST_REDEMPTION') {
      if (ids.length !== 1) throw new BadRequestException('Resgate de investimento: uma linha por vez.');
      const l = lines[0];
      if (String(l.type) !== 'CREDIT') throw new BadRequestException('Resgate de investimento s\u00f3 para entradas (cr\u00e9dito) no extrato.');
      if (!dto.investmentId) throw new BadRequestException('Escolha a aplica\u00e7\u00e3o (ficha da Renda Fixa).');
      const f = await this.prisma.fixedIncomeInvestment.findFirst({ where: { id: dto.investmentId, companyId, deletedAt: null } });
      if (!f) throw new BadRequestException('Aplica\u00e7\u00e3o n\u00e3o encontrada.');
      if (String(f.status) !== 'ATIVO') throw new BadRequestException('Aplica\u00e7\u00e3o j\u00e1 encerrada.');
      if (!f.assetAccountId || !f.revenueAccountId || !f.irrfAccountId) {
        throw new BadRequestException('Complete as contas da ficha (aplica\u00e7\u00e3o, receita e IRRF) na Renda Fixa antes de usar no extrato.');
      }
      const data = dia(l.transactionDate);
      const valor = Number(l.amount);
      let s: any;
      if (dto.split) {
        s = { principal: r2(Number(dto.split.principal)), rendimentoBruto: r2(Number(dto.split.rendimentoBruto)), ir: r2(Number(dto.split.ir)), iof: r2(Number(dto.split.iof ?? 0)), origem: 'MANUAL' };
      } else {
        const dd = await deduzirResgate(this.prisma, f, data, valor);
        s = { principal: dd.principal, rendimentoBruto: dd.rendimentoBruto, ir: dd.ir, iof: dd.iof, origem: 'CDI', fator: dd.fator, dias: dd.dias, aliqIR: dd.aliqIR, cdiAte: dd.cdiAte };
      }
      if ([s.principal, s.rendimentoBruto, s.ir, s.iof].some((v: number) => !Number.isFinite(v) || v < 0)) throw new BadRequestException('Valores inv\u00e1lidos na divis\u00e3o do resgate.');
      if (s.ir > s.rendimentoBruto) throw new BadRequestException('IR maior que o rendimento bruto.');
      s.liquido = r2(s.rendimentoBruto - s.ir);
      const dif = r2(s.principal + s.liquido - valor);
      if (Math.abs(dif) > 0.01) throw new BadRequestException(`Principal + rendimento l\u00edquido (${r2(s.principal + s.liquido)}) difere do valor da linha (${valor}).`);
      s.principal = r2(valor - s.liquido); // fecha exatamente no valor da linha (ajuste de ate 1 centavo)
      const reservado = await this.reservado(statementId, l.id);
      const disponivel = r2(Number(f.capitalBalance) - (reservado.get(f.id) ?? 0));
      if (s.principal > disponivel + 0.01) throw new BadRequestException(`Principal ${s.principal} maior que o saldo dispon\u00edvel da aplica\u00e7\u00e3o (${disponivel}).`);
      await this.prisma.bankTransaction.update({
        where: { id: l.id },
        data: {
          destination: 'INVEST_REDEMPTION' as any, investmentId: f.id, investSplit: s, accountId: f.assetAccountId,
          memo: dto.memo?.trim() || `Resgate ${f.type} ${f.description}`, journalEntryId: null, ignoreReason: null, status: 'CLASSIFIED' as any,
        },
      });
    } else {
      throw new BadRequestException('Destino inv\u00e1lido.');
    }
    if (String(stmt.status) === 'IMPORTED') {
      await this.prisma.bankStatement.update({ where: { id: statementId }, data: { status: 'IN_PROGRESS' as any } });
    }
    return { updated: ids.length };
  }

  private split(lines: any[]) {
    const st = (l: any) => String(l.status);
    const de = (l: any) => String(l.destination ?? '');
    return {
      gerar:     lines.filter(l => de(l) === 'DIRECT_ENTRY' && st(l) === 'CLASSIFIED' && l.accountId),
      investir:  lines.filter(l => de(l) === 'INVEST_REDEMPTION' && st(l) === 'CLASSIFIED' && l.investmentId && l.investSplit),
      conciliar: lines.filter(l => de(l) === 'ALREADY_POSTED' && st(l) === 'CLASSIFIED' && l.journalEntryId),
      ignorar:   lines.filter(l => de(l) === 'IGNORE' && st(l) === 'CLASSIFIED'),
      pendentes: lines.filter(l => !['POSTED', 'RECONCILED', 'IGNORED', 'CLASSIFIED'].includes(st(l))),
    };
  }

  // ── Previa ────────────────────────────────────────────────────────────────
  async preview(companyId: string, statementId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    const lines = await this.loadLines(statementId);
    const ledgerId = stmt.bankAccount?.ledgerAccountId ?? null;
    const ledger = stmt.bankAccount?.ledgerAccount ?? null;
    const { gerar, investir, conciliar, ignorar, pendentes } = this.split(lines);
    const fichas = investir.length ? await this.prisma.fixedIncomeInvestment.findMany({ where: { id: { in: investir.map(l => l.investmentId as string) } } }) : [];
    const fMap = new Map(fichas.map(f => [f.id, f]));
    const accIds = [...new Set([...gerar.map(l => l.accountId as string), ...fichas.flatMap(f => [f.assetAccountId, f.revenueAccountId, f.irrfAccountId])].filter(Boolean))] as string[];
    const accs = accIds.length ? await this.prisma.chartOfAccounts.findMany({ where: { id: { in: accIds } }, select: ACC }) : [];
    const accMap = new Map(accs.map(a => [a.id, a]));
    const entries: any[] = gerar.map(l => {
      const contra = accMap.get(l.accountId as string) ?? null;
      return {
        lineId: l.id, lineNo: l.lineNo, date: dia(l.transactionDate), description: l.memo || l.description, value: Number(l.amount),
        debit: l.type === 'CREDIT' ? ledger : contra,
        credit: l.type === 'CREDIT' ? contra : ledger,
      };
    });
    for (const l of investir) {
      const s: any = l.investSplit;
      const f = fMap.get(l.investmentId as string);
      const conta = (id: string | null | undefined) => (id ? accMap.get(id) ?? null : null);
      entries.push({
        lineId: l.id, lineNo: l.lineNo, date: dia(l.transactionDate), description: l.memo || l.description, value: Number(l.amount),
        debit: ledger, credit: conta(f?.assetAccountId),
        partidas: [
          { tipo: 'D', conta: ledger, valor: Number(l.amount) },
          ...(s.ir > 0 ? [{ tipo: 'D', conta: conta(f?.irrfAccountId), valor: s.ir }] : []),
          { tipo: 'C', conta: conta(f?.assetAccountId), valor: s.principal },
          ...(s.rendimentoBruto > 0 ? [{ tipo: 'C', conta: conta(f?.revenueAccountId), valor: s.rendimentoBruto }] : []),
        ],
        resgate: { cdb: f?.description ?? null, ...s },
      });
    }
    entries.sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0));
    const ate = dia(stmt.periodTo);
    const antes = ledgerId ? await this.ledgerBalanceUntil(companyId, ledgerId, ate) : null;
    const efeito = r2([...gerar, ...investir].reduce((s, l) => s + (l.type === 'CREDIT' ? 1 : -1) * Number(l.amount), 0));
    const extrato = stmt.closingBalance != null ? Number(stmt.closingBalance) : null;
    const depois = antes != null ? r2(antes + efeito) : null;
    const comps = [...new Set(entries.map(e => e.date.slice(0, 7)))];
    const fech = comps.length ? await this.prisma.fechamentoMensal.findMany({ where: { companyId, competencia: { in: comps } }, select: { competencia: true, status: true } }) : [];
    const fechadas = fech.filter(f => ['FECHADO', 'FECHADO_PREVIO'].includes(String(f.status))).map(f => f.competencia);
    return {
      counts: { gerar: gerar.length + investir.length, investir: investir.length, conciliar: conciliar.length, ignorar: ignorar.length, pendentes: pendentes.length, total: lines.length },
      entries,
      saldo: { ate, contabilAntes: antes, efeito, contabilDepois: depois, extratoFinal: extrato, diferenca: depois != null && extrato != null ? r2(extrato - depois) : null },
      avisos: [
        ...(!ledgerId ? ['A conta banc\u00e1ria n\u00e3o tem conta cont\u00e1bil no cadastro.'] : []),
        ...fechadas.map(c => `Compet\u00eancia ${c} est\u00e1 fechada: os lan\u00e7amentos desse m\u00eas ser\u00e3o recusados.`),
        ...(pendentes.length ? [`${pendentes.length} linha(s) ainda sem destino.`] : []),
      ],
    };
  }

  // ── Geracao ───────────────────────────────────────────────────────────────
  async post(companyId: string, statementId: string, userId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    const lines = await this.loadLines(statementId);
    const ledgerId = stmt.bankAccount?.ledgerAccountId ?? null;
    const { gerar, investir, conciliar, ignorar } = this.split(lines);
    if ((gerar.length || investir.length) && !ledgerId) throw new BadRequestException('A conta banc\u00e1ria n\u00e3o tem conta cont\u00e1bil no cadastro (Financeiro > Contas Banc\u00e1rias).');
    if (!gerar.length && !investir.length && !conciliar.length && !ignorar.length) throw new BadRequestException('Nenhuma linha com destino definido para processar.');

    let posted = 0;
    const errors: { lineNo: number | null; error: string }[] = [];
    for (const l of gerar) {
      const v = Number(l.amount);
      const items: any[] = l.type === 'CREDIT'
        ? [{ accountId: ledgerId, accountCode: '', value: v, type: 'DEBIT' }, { accountId: l.accountId, accountCode: '', value: v, type: 'CREDIT' }]
        : [{ accountId: l.accountId, accountCode: '', value: v, type: 'DEBIT' }, { accountId: ledgerId, accountCode: '', value: v, type: 'CREDIT' }];
      let jeId: string | null = null;
      try {
        const je = await this.journal.create(companyId, userId, {
          date: dia(l.transactionDate), description: l.memo || l.description, reference: l.id, sourceModule: 'BANK_IMPORT', items,
        });
        jeId = je.id;
        await this.prisma.bankTransaction.update({ where: { id: l.id }, data: { status: 'POSTED' as any, journalEntryId: je.id, counterAccountId: ledgerId } });
        posted++;
      } catch (e: any) {
        // lancamento criado mas vinculo nao gravado: estorna (soft-delete) para nao ficar orfao
        if (jeId) await this.prisma.journalEntry.update({ where: { id: jeId }, data: { deletedAt: new Date() } }).catch(() => undefined);
        errors.push({ lineNo: l.lineNo ?? null, error: e?.message ?? String(e) });
      }
    }

    // EXTINV-01: resgates de investimento - lancamento + resgate na ficha
    for (const l of investir) {
      const s: any = l.investSplit;
      let jeId: string | null = null;
      let evId: string | null = null;
      let fichaId: string | null = null;
      try {
        const f = await this.prisma.fixedIncomeInvestment.findFirst({ where: { id: l.investmentId as string, companyId, deletedAt: null } });
        if (!f) throw new Error('Ficha da aplica\u00e7\u00e3o n\u00e3o encontrada.');
        if (String(f.status) !== 'ATIVO') throw new Error('Aplica\u00e7\u00e3o j\u00e1 encerrada.');
        if (s.principal > Number(f.capitalBalance) + 0.01) throw new Error(`Principal ${s.principal} maior que o saldo de capital da aplica\u00e7\u00e3o (${Number(f.capitalBalance)}).`);
        fichaId = f.id;
        const items: any[] = [
          { accountId: ledgerId, accountCode: '', value: Number(l.amount), type: 'DEBIT' },
          ...(s.ir > 0 ? [{ accountId: f.irrfAccountId, accountCode: '', value: s.ir, type: 'DEBIT' }] : []),
          { accountId: f.assetAccountId, accountCode: '', value: s.principal, type: 'CREDIT' },
          ...(s.rendimentoBruto > 0 ? [{ accountId: f.revenueAccountId, accountCode: '', value: s.rendimentoBruto, type: 'CREDIT' }] : []),
        ];
        const je = await this.journal.create(companyId, userId, {
          date: dia(l.transactionDate), description: l.memo || l.description, reference: l.id, sourceModule: 'BANK_IMPORT', items,
        });
        jeId = je.id;
        const r: any = await this.fixedIncome.applyRedemption(f.id, companyId, userId, {
          redemptionDate: dia(l.transactionDate), redemptionPrincipal: s.principal, redemptionYield: s.rendimentoBruto,
          irrfAmount: s.ir, netAmount: r2(s.principal + s.liquido),
          notes: `Extrato banc\u00e1rio - linha ${l.lineNo ?? ''}: ${l.description}`.slice(0, 480),
        } as any);
        evId = r?.event?.id ?? null;
        if (evId) await this.prisma.fixedIncomeEvent.update({ where: { id: evId }, data: { journalEntryId: je.id } });
        await this.prisma.bankTransaction.update({ where: { id: l.id }, data: { status: 'POSTED' as any, journalEntryId: je.id, counterAccountId: ledgerId, fixedIncomeEventId: evId } });
        posted++;
      } catch (e: any) {
        if (evId && fichaId) await this.fixedIncome.deleteEvent(fichaId, evId, companyId).catch(() => undefined);
        if (jeId) await this.prisma.journalEntry.update({ where: { id: jeId }, data: { deletedAt: new Date() } }).catch(() => undefined);
        errors.push({ lineNo: l.lineNo ?? null, error: e?.message ?? String(e) });
      }
    }

    const rec = conciliar.length
      ? await this.prisma.bankTransaction.updateMany({ where: { id: { in: conciliar.map(l => l.id) } }, data: { status: 'RECONCILED' as any } })
      : { count: 0 };
    const ign = ignorar.length
      ? await this.prisma.bankTransaction.updateMany({ where: { id: { in: ignorar.map(l => l.id) } }, data: { status: 'IGNORED' as any } })
      : { count: 0 };
    const abertas = await this.prisma.bankTransaction.count({ where: { statementId, deletedAt: null, status: { notIn: ['POSTED', 'RECONCILED', 'IGNORED'] as any } } });
    const statementStatus = abertas === 0 ? 'COMPLETED' : 'IN_PROGRESS';
    await this.prisma.bankStatement.update({ where: { id: statementId }, data: { status: statementStatus as any } });
    return { posted, reconciled: rec.count, ignored: ign.count, errors, pending: abertas, statementStatus };
  }
}
