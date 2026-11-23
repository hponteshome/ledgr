// apps/api/src/modules/finance/bank-reconciliation.service.ts
// EXTBB-10A (23/11/2026) - Extratos e Conciliacao: linhas, destino unico por linha, previa e geracao.
// - Lancamentos gerados pelo JournalEntryService (trava de competencia fechada, conta do plano da empresa,
//   balanco das partidas, data UTC), sourceModule BANK_IMPORT, reference = id da linha. 1 lancamento por linha.
// - "Ja contabilizado": lancamento existente na conta contabil do banco com mesma data, valor e lado,
//   ainda sem vinculo com outra linha (ex.: dez/2025 contra a ECD importada). So vincula, nao gera.
// - Destinos desta fase: DIRECT_ENTRY, ALREADY_POSTED, IGNORE (baixa de titulo AP/AR: EXTBB-11).
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JournalEntryService } from '../accounting/services/journal-entry.service';
import { SuggestionService } from './suggestion.service';

export type BankLineDestination = 'DIRECT_ENTRY' | 'ALREADY_POSTED' | 'IGNORE';

export interface SetBankLinesDto {
  ids: string[];
  destination: BankLineDestination | null; // null = volta a pendente
  accountId?: string;      // DIRECT_ENTRY: contrapartida
  memo?: string;           // historico do lancamento
  ignoreReason?: string;   // IGNORE: obrigatorio
  matchedEntryId?: string; // ALREADY_POSTED com 1 linha: lancamento escolhido; sem ele, deteccao automatica
  remember?: boolean;      // DIRECT_ENTRY: grava a regra para as proximas importacoes
}

const ACC = { id: true, code: true, reducedCode: true, name: true };
const TRAVADAS = ['POSTED', 'RECONCILED'];
// Data da linha (gravada em hora local pelo parser) -> 'YYYY-MM-DD'
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const utcDia = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalEntryService,
    private readonly suggestion: SuggestionService,
  ) {}

  private async loadStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId, deletedAt: null },
      include: { bankAccount: { include: { ledgerAccount: { select: ACC }, investmentAccount: { select: ACC } } } },
    });
    if (!stmt) throw new NotFoundException('Extrato não encontrado.');
    return stmt;
  }

  private loadLines(statementId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { statementId, deletedAt: null },
      orderBy: [{ lineNo: 'asc' }, { transactionDate: 'asc' }],
    });
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
  async getLines(companyId: string, statementId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
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
      lines: lines.map(l => ({
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
      })),
    };
  }

  // ── Destino em lote ────────────────────────────────────────────────────────
  async setLines(companyId: string, statementId: string, dto: SetBankLinesDto, userId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    const ids = Array.isArray(dto?.ids) ? [...new Set(dto.ids)] : [];
    if (!ids.length) throw new BadRequestException('Selecione ao menos uma linha.');
    const lines = await this.prisma.bankTransaction.findMany({ where: { id: { in: ids }, statementId, deletedAt: null } });
    if (lines.length !== ids.length) throw new BadRequestException('Linha(s) não encontrada(s) neste extrato.');
    const travadas = lines.filter(l => TRAVADAS.includes(String(l.status)));
    if (travadas.length) throw new BadRequestException(`${travadas.length} linha(s) já contabilizada(s) ou conciliada(s) não podem ser alteradas.`);
    const where = { id: { in: ids } };
    const d = dto.destination ?? null;

    if (d === null) {
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: null, accountId: null, journalEntryId: null, ignoreReason: null, status: 'PENDING' as any } });
    } else if (d === 'IGNORE') {
      const motivo = (dto.ignoreReason ?? '').trim();
      if (!motivo) throw new BadRequestException('Informe o motivo para ignorar.');
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: 'IGNORE' as any, ignoreReason: motivo.slice(0, 255), accountId: null, journalEntryId: null, status: 'CLASSIFIED' as any } });
    } else if (d === 'DIRECT_ENTRY') {
      if (!dto.accountId) throw new BadRequestException('Informe a conta de contrapartida.');
      const conta = await this.prisma.chartOfAccounts.findFirst({ where: { id: dto.accountId, companyId, deletedAt: null }, select: { id: true, isAnalytic: true, isActive: true } });
      if (!conta) throw new BadRequestException('Conta não encontrada no plano da empresa.');
      if (!conta.isAnalytic || !conta.isActive) throw new BadRequestException('Escolha uma conta analítica ativa.');
      if (stmt.bankAccount?.ledgerAccountId === dto.accountId) throw new BadRequestException('A contrapartida não pode ser a própria conta do banco.');
      const memo = dto.memo?.trim();
      await this.prisma.bankTransaction.updateMany({ where, data: { destination: 'DIRECT_ENTRY' as any, accountId: dto.accountId, ...(memo ? { memo } : {}), journalEntryId: null, ignoreReason: null, status: 'CLASSIFIED' as any } });
      if (dto.remember) {
        const vistos = new Set<string>();
        for (const l of lines) {
          const k = `${l.descriptionNorm}|${l.type}`;
          if (vistos.has(k)) continue;
          vistos.add(k);
          await this.suggestion.learn(companyId, l.descriptionNorm, l.type as any, dto.accountId, memo || l.memo || l.description, userId, stmt.bankCode as any);
        }
      }
    } else if (d === 'ALREADY_POSTED') {
      const ledgerId = stmt.bankAccount?.ledgerAccountId ?? null;
      if (!ledgerId) throw new BadRequestException('A conta bancária não tem conta contábil no cadastro.');
      let mapa: Map<string, string>;
      if (dto.matchedEntryId) {
        if (ids.length !== 1) throw new BadRequestException('Escolha o lançamento existente para uma linha por vez.');
        const ok = await this.prisma.journalEntryItem.findFirst({ where: { journalEntryId: dto.matchedEntryId, accountId: ledgerId, journalEntry: { companyId, deletedAt: null } }, select: { id: true } });
        if (!ok) throw new BadRequestException('O lançamento escolhido não movimenta a conta contábil do banco.');
        const outra = await this.prisma.bankTransaction.findFirst({ where: { journalEntryId: dto.matchedEntryId, deletedAt: null, id: { notIn: ids } }, select: { id: true } });
        if (outra) throw new BadRequestException('Esse lançamento já está vinculado a outra linha de extrato.');
        mapa = new Map([[ids[0], dto.matchedEntryId]]);
      } else {
        mapa = await this.detectPosted(companyId, ledgerId, lines.map(l => ({ ...l, journalEntryId: null, status: 'PENDING' })));
      }
      const sem = lines.filter(l => !mapa.has(l.id));
      if (sem.length) {
        throw new BadRequestException(`${sem.length} linha(s) sem lançamento correspondente na conta do banco (mesma data, valor e lado). Use lançamento direto ou escolha o lançamento.`);
      }
      for (const l of lines) {
        await this.prisma.bankTransaction.update({ where: { id: l.id }, data: { destination: 'ALREADY_POSTED' as any, journalEntryId: mapa.get(l.id) as string, accountId: null, ignoreReason: null, status: 'CLASSIFIED' as any } });
      }
    } else {
      throw new BadRequestException('Destino inválido.');
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
    const { gerar, conciliar, ignorar, pendentes } = this.split(lines);
    const accIds = [...new Set(gerar.map(l => l.accountId as string))];
    const accs = accIds.length ? await this.prisma.chartOfAccounts.findMany({ where: { id: { in: accIds } }, select: ACC }) : [];
    const accMap = new Map(accs.map(a => [a.id, a]));
    const entries = gerar.map(l => {
      const contra = accMap.get(l.accountId as string) ?? null;
      return {
        lineId: l.id, lineNo: l.lineNo, date: dia(l.transactionDate), description: l.memo || l.description, value: Number(l.amount),
        debit: l.type === 'CREDIT' ? ledger : contra,
        credit: l.type === 'CREDIT' ? contra : ledger,
      };
    });
    const ate = dia(stmt.periodTo);
    const antes = ledgerId ? await this.ledgerBalanceUntil(companyId, ledgerId, ate) : null;
    const efeito = r2(gerar.reduce((s, l) => s + (l.type === 'CREDIT' ? 1 : -1) * Number(l.amount), 0));
    const extrato = stmt.closingBalance != null ? Number(stmt.closingBalance) : null;
    const depois = antes != null ? r2(antes + efeito) : null;
    const comps = [...new Set(entries.map(e => e.date.slice(0, 7)))];
    const fech = comps.length ? await this.prisma.fechamentoMensal.findMany({ where: { companyId, competencia: { in: comps } }, select: { competencia: true, status: true } }) : [];
    const fechadas = fech.filter(f => ['FECHADO', 'FECHADO_PREVIO'].includes(String(f.status))).map(f => f.competencia);
    return {
      counts: { gerar: gerar.length, conciliar: conciliar.length, ignorar: ignorar.length, pendentes: pendentes.length, total: lines.length },
      entries,
      saldo: { ate, contabilAntes: antes, efeito, contabilDepois: depois, extratoFinal: extrato, diferenca: depois != null && extrato != null ? r2(extrato - depois) : null },
      avisos: [
        ...(!ledgerId ? ['A conta bancária não tem conta contábil no cadastro.'] : []),
        ...fechadas.map(c => `Competência ${c} está fechada: os lançamentos desse mês serão recusados.`),
        ...(pendentes.length ? [`${pendentes.length} linha(s) ainda sem destino.`] : []),
      ],
    };
  }

  // ── Geracao ───────────────────────────────────────────────────────────────
  async post(companyId: string, statementId: string, userId: string) {
    const stmt = await this.loadStatement(companyId, statementId);
    const lines = await this.loadLines(statementId);
    const ledgerId = stmt.bankAccount?.ledgerAccountId ?? null;
    const { gerar, conciliar, ignorar } = this.split(lines);
    if (gerar.length && !ledgerId) throw new BadRequestException('A conta bancária não tem conta contábil no cadastro (Financeiro > Contas Bancárias).');
    if (!gerar.length && !conciliar.length && !ignorar.length) throw new BadRequestException('Nenhuma linha com destino definido para processar.');

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
