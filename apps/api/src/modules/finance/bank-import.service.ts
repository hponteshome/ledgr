// ============================================================
// LEDGR — apps/api/src/modules/bank-import/bank-import.service.ts
// ============================================================
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BankParserService, buildGroupKey } from './parsers/bank-parser.service';
import { SuggestionService } from './suggestion.service';
import { Prisma } from '@prisma/client';

import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';

// Converte worksheet exceljs em array de objetos (chave = cabecalho da
// primeira linha) - equivalente ao XLSX.utils.sheet_to_json(ws) do SheetJS
async function readRowsAsObjects(buffer) {
  const stream = Readable.from(buffer);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});
  const allRows = [];
  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      const vals = (row.values as any[]).slice(1).map((v: any) => {
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          if ('result' in v) return (v).result;
          if ('richText' in v) return (v).richText.map((t) => t.text).join('');
          if ('text' in v) return (v).text;
          return String(v);
        }
        return v;
      });
      allRows[row.number - 1] = vals;
    }
    break;
  }
  // Detecta a linha real de cabecalho (algumas planilhas LM tem uma linha de
  // titulo/agencia-conta antes do cabecalho de verdade - procura pela celula 'Data'
  // entre as 5 primeiras linhas, mesmo padrao usado no parser XLS generico)
  const normKey = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(allRows.length, 5); i++) {
    if (allRows[i] && allRows[i].some((v) => normKey(v) === 'data')) {
      headerRowIdx = i;
      break;
    }
  }
  const headers = (allRows[headerRowIdx] || []).map((h) => (h != null ? String(h).trim() : ''));
  const rows = [];
  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const vals = allRows[i] || [];
    const obj = {};
    headers.forEach((h, idx) => {
      // mantem so a 1a ocorrencia de um nome de coluna duplicado (planilhas LM
      // as vezes tem uma segunda mini-tabela/legenda mais a direita na mesma linha)
      if (h && !(h in obj)) obj[h] = vals[idx] ?? undefined;
    });
    rows.push(obj);
  }
  return rows;
}

function parseFlexibleDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // serial Excel: dia 0 = 1899-12-30 (compensa bug do ano bissexto de 1900)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2;
}

export interface ClassifyGroupDto {
  groupKey:    string;
  accountId:   string;
  counterAccountId: string; // conta bancária
  memo:        string;
  costCenter?: string;
  transactionIds?: string[]; // se null: aplica a todo o grupo
}

export interface PostStatementDto {
  statementId:    string;
  groups:         ClassifyGroupDto[];
  journalDate?:   string; // default: data de cada transação
}

@Injectable()
export class BankImportService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly parser:      BankParserService,
    private readonly suggestion:  SuggestionService,
  ) {}

  // ── 1. Upload e parse ────────────────────────────────────────
  async uploadStatement(
    companyId: string,
    buffer:    Buffer,
    fileName:  string,
    userId:    string,
  ) {
    const parsed = await this.parser.parse(buffer, fileName);

    if (parsed.transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    // Calcula totais
    const totalDebits  = parsed.transactions.filter(t => t.type === 'DEBIT')
      .reduce((s, t) => s + t.amount, 0);
    const totalCredits = parsed.transactions.filter(t => t.type === 'CREDIT')
      .reduce((s, t) => s + t.amount, 0);

    // Cria o cabeçalho do extrato
    const statement = await this.prisma.bankStatement.create({
      data: {
        companyId,
        bankCode:       parsed.bankCode as any,
        bankName:       parsed.bankName,
        agency:         parsed.agency,
        account:        parsed.account,
        periodFrom:     parsed.periodFrom,
        periodTo:       parsed.periodTo,
        fileName,
        fileFormat:     fileName.split('.').pop()?.toUpperCase() ?? 'XLS',
        totalLines:     parsed.transactions.length,
        totalDebits:    new Prisma.Decimal(totalDebits.toFixed(2)),
        totalCredits:   new Prisma.Decimal(totalCredits.toFixed(2)),
        openingBalance: parsed.openingBalance != null ? new Prisma.Decimal(parsed.openingBalance.toFixed(2)) : null,
        closingBalance: parsed.closingBalance != null ? new Prisma.Decimal(parsed.closingBalance.toFixed(2)) : null,
        createdById:    userId,
      },
    });

    // Busca sugestões para todas as transações de uma vez
    const suggestions = await this.suggestion.suggestBatch(
      companyId,
      parsed.transactions.map(t => ({ descriptionNorm: t.descriptionNorm, type: t.type })),
    );

    // Salva as transações com sugestões
    const txData = parsed.transactions.map((tx, i) => ({
      companyId,
      statementId:         statement.id,
      transactionDate:     tx.transactionDate,
      description:         tx.description,
      descriptionNorm:     tx.descriptionNorm,
      amount:              new Prisma.Decimal(tx.amount.toFixed(2)),
      type:                tx.type as any,
      balance:             tx.balance != null ? new Prisma.Decimal(tx.balance.toFixed(2)) : null,
      bankRef:             tx.bankRef,
      agency:              tx.agency,
      groupKey:            buildGroupKey(tx.descriptionNorm),
      suggestedAccountId:  suggestions[i].accountId,
      suggestionSource:    suggestions[i].source,
      suggestionConfidence: suggestions[i].confidence,
      // Memo template como sugestão de histórico
      memo:                suggestions[i].memoTemplate ?? tx.description,
    }));

    await this.prisma.bankTransaction.createMany({ data: txData });

    // ── Pre-classificar transacoes LM (com debitCode/creditCode do extrato) ──
    const txsComCodigo = parsed.transactions.filter((t: any) => t.debitCode && t.creditCode);
    if (txsComCodigo.length > 0) {
      const codigos = [...new Set([
        ...txsComCodigo.map((t: any) => String(t.debitCode).trim().padStart(6,'0')),
        ...txsComCodigo.map((t: any) => String(t.creditCode).trim().padStart(6,'0')),
      ])];
      const contas = await this.prisma.chartOfAccounts.findMany({
        where: { companyId, reducedCode: { in: codigos } },
        select: { id: true, reducedCode: true },
      });
      const contaMap = new Map(contas.map((c: any) => [c.reducedCode, c.id]));

      const txsCriadas = await this.prisma.bankTransaction.findMany({
        where: { statementId: statement.id },
        orderBy: { transactionDate: 'asc' },
        select: { id: true },
      });

      let preClass = 0;
      for (let i = 0; i < parsed.transactions.length; i++) {
        const tx = parsed.transactions[i] as any;
        if (!tx.debitCode || !tx.creditCode) continue;
        const debitId  = contaMap.get(String(tx.debitCode).trim().padStart(6,'0'));
        const creditId = contaMap.get(String(tx.creditCode).trim().padStart(6,'0'));
        if (!debitId || !creditId) continue;
        const criada = txsCriadas[i];
        if (!criada) continue;
        await this.prisma.bankTransaction.update({
          where: { id: criada.id },
          data: {
            accountId:        tx.type === 'DEBIT' ? debitId  : creditId,
            counterAccountId: tx.type === 'DEBIT' ? creditId : debitId,
            status: 'CLASSIFIED' as any,
          },
        });
        preClass++;
      }
      console.log(`[LM] Pre-classificadas ${preClass}/${txsComCodigo.length} transacoes`);
    }

    return {
      statementId:  statement.id,
      bankName:     parsed.bankName,
      bankCode:     parsed.bankCode,
      totalLines:   parsed.transactions.length,
      totalDebits,
      totalCredits,
      periodFrom:   parsed.periodFrom,
      periodTo:     parsed.periodTo,
    };
  }

  // ── 2. Retorna grupos para a tela de classificação ───────────
  async getGroups(companyId: string, statementId: string) {
    await this.verifyStatement(companyId, statementId);

    const transactions = await this.prisma.bankTransaction.findMany({
      where:   { statementId, status: { in: ['PENDING', 'CLASSIFIED'] as any } },
      orderBy: [{ type: 'asc' }, { groupKey: 'asc' }, { transactionDate: 'asc' }],
    });

    // Agrupa por groupKey
    const groups: Record<string, {
      groupKey:            string;
      type:                string;
      description:         string;   // descrição mais comum do grupo
      count:               number;
      totalAmount:         number;
      transactions:        typeof transactions;
      suggestedAccountId:  string | null;
      suggestionSource:    string | null;
      suggestionConfidence: number | null;
      memo:                string | null;
      accountId:           string | null;
      counterAccountId:    string | null;
    }> = {};

    for (const tx of transactions) {
      const key = tx.groupKey ?? tx.descriptionNorm.slice(0, 30);
      if (!groups[key]) {
        groups[key] = {
          groupKey:             key,
          type:                 tx.type,
          description:          tx.description,
          count:                0,
          totalAmount:          0,
          transactions:         [],
          suggestedAccountId:   tx.accountId ?? tx.suggestedAccountId,
          suggestionSource:     tx.accountId ? 'PRE_CLASSIFIED' : tx.suggestionSource,
          suggestionConfidence: tx.accountId ? 100 : tx.suggestionConfidence,
          memo:                 tx.memo,
          accountId:            tx.accountId,
          counterAccountId:     tx.counterAccountId,
        };
      }
      groups[key].count++;
      groups[key].totalAmount += Number(tx.amount);
      groups[key].transactions.push(tx);
    }

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // ── 3. Classifica grupo (salva conta + histórico) ─────────────
  async classifyGroup(
    companyId:   string,
    statementId: string,
    dto:         ClassifyGroupDto,
    userId:      string,
  ) {
    await this.verifyStatement(companyId, statementId);

    const where: any = {
      statementId,
      companyId,
      groupKey: dto.groupKey,
    };
    if (dto.transactionIds?.length) {
      where.id = { in: dto.transactionIds };
    }

    const updated = await this.prisma.bankTransaction.updateMany({
      where,
      data: {
        accountId:       dto.accountId,
        counterAccountId: dto.counterAccountId,
        memo:            dto.memo,
        costCenter:      dto.costCenter,
        status:          'CLASSIFIED' as any,
      },
    });

    // Aprende a regra para futuras importações
    const sample = await this.prisma.bankTransaction.findFirst({ where });
    if (sample) {
      await this.suggestion.learn(
        companyId,
        sample.descriptionNorm,
        sample.type as 'DEBIT' | 'CREDIT',
        dto.accountId,
        dto.memo,
        userId,
      );
    }

    return { updated: updated.count };
  }

  // ── 4. Confirma e gera JournalEntries ────────────────────────
  async postStatement(
    companyId: string,
    dto:       PostStatementDto,
    userId:    string,
  ) {
    const stmt = await this.verifyStatement(companyId, dto.statementId);

    // Primeiro aplica todas as classificações pendentes
    for (const group of dto.groups) {
      await this.classifyGroup(companyId, dto.statementId, group, userId);
    }

    // Busca todas as transações classificadas
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { statementId: dto.statementId, status: 'CLASSIFIED' as any },
      orderBy: { transactionDate: 'asc' },
    });

    if (transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação classificada para lançar.');
    }

    // Verifica se todas têm conta contábil
    const sem = transactions.filter(t => !t.accountId || !t.counterAccountId);
    if (sem.length > 0) {
      throw new BadRequestException(
        `${sem.length} transação(ões) sem conta contábil. Classifique todos os grupos antes de confirmar.`
      );
    }

    let posted = 0;
    const errors: { id: string; error: string }[] = [];

    for (const tx of transactions) {
      try {
        await this.prisma.$transaction(async (prisma) => {
          // Gera lançamento contábil duplo
          const journalEntry = await prisma.journalEntry.create({
            data: {
              companyId,
              date:        tx.transactionDate,
              description: tx.memo ?? tx.description,
              reference:   tx.bankRef ?? tx.id,
              sourceModule: 'BANK_IMPORT',
              createdById:  userId,
            },
          });

          // Débito e crédito conforme tipo da transação
          // DEBIT: dinheiro SAI da conta bancária → débito na despesa, crédito na conta banco
          // CREDIT: dinheiro ENTRA na conta bancária → débito na conta banco, crédito na receita
          await prisma.journalEntryItem.createMany({
            data: tx.type === 'DEBIT'
              ? [
                  { journalEntryId: journalEntry.id, accountId: tx.accountId!,        type: 'DEBIT',  value: tx.amount },
                  { journalEntryId: journalEntry.id, accountId: tx.counterAccountId!, type: 'CREDIT', value: tx.amount },
                ]
              : [
                  { journalEntryId: journalEntry.id, accountId: tx.counterAccountId!, type: 'DEBIT',  value: tx.amount },
                  { journalEntryId: journalEntry.id, accountId: tx.accountId!,        type: 'CREDIT', value: tx.amount },
                ],
          });

          // Atualiza transação como POSTED
          await prisma.bankTransaction.update({
            where: { id: tx.id },
            data:  { status: 'POSTED' as any, journalEntryId: journalEntry.id },
          });
        });
        posted++;
      } catch (e: any) {
        errors.push({ id: tx.id, error: e.message });
      }
    }

    return {
      posted,
      errors,
      total: transactions.length,
      statementId: dto.statementId,
    };
  }

  // ── 5. Lista extratos importados ─────────────────────────────
  async listStatements(companyId: string) {
    return this.prisma.bankStatement.findMany({
      where:   { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  }

  // ── Helper ────────────────────────────────────────────────────
  private async verifyStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId, deletedAt: null },
    });
    if (!stmt) throw new NotFoundException('Extrato não encontrado.');
    return stmt;
  }


  async deleteStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!stmt) throw new BadRequestException('Extrato nao encontrado.');

    // Buscar journal entries gerados pelas transacoes deste statement
    const txs = await this.prisma.bankTransaction.findMany({
      where: { statementId },
      select: { journalEntryId: true },
    });
    const journalIds = txs.map(t => t.journalEntryId).filter(Boolean) as string[];

    // Excluir em cascata
    await this.prisma.bankTransaction.deleteMany({ where: { statementId } });

    if (journalIds.length > 0) {
      await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: { in: journalIds } } });
      await this.prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    }

    await this.prisma.bankStatement.delete({ where: { id: statementId } });
    return { deleted: true, statementId, journalsDeleted: journalIds.length };
  }

  async previewExcelMapped(companyId: string, buffer: Buffer) {
    const rows = await readRowsAsObjects(buffer);

    if (!rows || rows.length === 0) throw new BadRequestException('Planilha vazia.');

    const normKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rowKeys = (r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normKey(k), v]));

    const findAccount = async (code: any) => {
      if (!code) return null;
      const c = String(code).trim().padStart(6, '0');
      return this.prisma.chartOfAccounts.findFirst({
        where: { companyId, deletedAt: null, OR: [{ reducedCode: c }, { code: c }] },
        select: { id: true, code: true, name: true, reducedCode: true },
      });
    };

    const lines: Array<{
      row: number;
      date: string;
      description: string;
      value: number;
      type: string;
      debitCode: string;
      creditCode: string;
      debitAccount: any;
      creditAccount: any;
      status: 'ok' | 'warn' | 'error';
      issues: string[];
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rowKeys(rows[i]);
      const issues: string[] = [];
      const dateRaw    = r['data'] as any;
      const memoRaw    = r['historico'] ?? r['complemento'] ?? r['descricao'] ?? r['lancamento'] ?? '';
      const valorCred  = r['credito (r$)'] ?? r['credito(r$)'] ?? null;
      const valorDeb   = r['debito (r$)'] ?? r['debito(r$)'] ?? null;
      const valorRaw   = r['valor'] ?? null;
      const debitCode  = r['debito'] ?? r['conta debito'] ?? r['conta'] ?? null;
      const creditCode = r['credito'] ?? r['conta credito'] ?? r['contrapartida'] ?? null;
      const referenciaRaw = r['referencia'] ?? r['chave'] ?? '';

      if (!debitCode)  issues.push('Conta Débito ausente');
      if (!creditCode) issues.push('Conta Crédito ausente');

      const credNum = valorCred ? Math.abs(typeof valorCred === 'number' ? valorCred : parseFloat(String(valorCred).replace(/[()]/g,'').replace(/,/g,'.'))) : 0;
      const debNum  = valorDeb  ? Math.abs(typeof valorDeb  === 'number' ? valorDeb  : parseFloat(String(valorDeb ).replace(/[()]/g,'').replace(/,/g,'.'))) : 0;
      let valorNum: number;
      let type: string;
      if (credNum > 0 || debNum > 0) {
        valorNum = credNum > 0 ? credNum : debNum;
        type = credNum > 0 ? 'CREDIT' : 'DEBIT';
      } else {
        const raw = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw ?? '0').replace(/[()]/g,'').replace(/,/g,'.'));
        valorNum = Math.abs(raw);
        type = raw < 0 ? 'DEBIT' : 'CREDIT';
      }

      const [debitAccount, creditAccount] = await Promise.all([
        findAccount(debitCode),
        findAccount(creditCode),
      ]);

      if (debitCode  && !debitAccount)  issues.push(`Conta Débito '${debitCode}' não encontrada`);
      if (creditCode && !creditAccount) issues.push(`Conta Crédito '${creditCode}' não encontrada`);

      const status = issues.length === 0 ? 'ok' : (debitAccount && creditAccount ? 'warn' : 'error');

      lines.push({
        row: i + 2,
        date: (() => { const _d = parseFlexibleDate(dateRaw); return _d ? _d.toISOString().slice(0, 10) : ''; })(),
        description: String(memoRaw),
        value: Math.abs(valorNum),
        type,
        debitCode:    String(debitCode  ?? ''),
        creditCode:   String(creditCode ?? ''),
        debitAccount,
        creditAccount,
        status,
        issues,
      });
    }

    const total   = lines.length;
    const ok      = lines.filter(l => l.status === 'ok').length;
    const errors  = lines.filter(l => l.status === 'error').length;
    const warns   = lines.filter(l => l.status === 'warn').length;
    const totalDebits  = lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + l.value, 0);
    const totalCredits = lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + l.value, 0);

    return { total, ok, errors, warns, totalDebits, totalCredits, lines };
  }

  async uploadExcelMapped(
    companyId: string,
    buffer:    Buffer,
    fileName:  string,
    userId:    string,
  ) {

    // ── Mapa Referencia LM -> propertyTag + internal_code ──────────────────
    // ── Mapa Referencia LM -> propertyTag + internal_code ─────────────────
    // Chave = valor normalizado (sem acentos, lowercase) da coluna Referencia
    const PROPERTY_TAG_MAP: Array<{ pattern: RegExp; tag: string; internalCode: string | null }> = [
      // Receitas de locacao
      { pattern: /locac[aã]o mare 62|locacao mare 62/i,      tag: 'MARE_62',    internalCode: 'Mare 62-12015' },
      { pattern: /locac[aã]o mare 88|locacao mare 88/i,      tag: 'MARE_88',    internalCode: 'Mare 88-12016' },
      { pattern: /locac[aã]o mare 92|locacao mare 92/i,      tag: 'MARE_92',    internalCode: 'Mare 92-12017' },
      { pattern: /locac[aã]o landmark/i,                     tag: 'LANDMARK',   internalCode: null },
      { pattern: /locac[aã]o conj\s*32/i,                    tag: 'CONJ_32',    internalCode: 'Conj 32-12002' },
      { pattern: /locac[aã]o conj\s*33/i,                    tag: 'CONJ_33',    internalCode: 'Conj 33-12003' },
      { pattern: /locac[aã]o loft/i,                         tag: 'LOFT_SP',    internalCode: 'Loft São Paulo-12005' },
      { pattern: /locac[aã]o ecoville|locac[aã]o ctba/i,     tag: 'ECOVILLE',   internalCode: 'Ecoville-12006' },
      { pattern: /locac[aã]o grj|locac[aã]o guaruj/i,        tag: 'GUARUJA',    internalCode: 'Guarujá-12010' },
      // Caucoes
      { pattern: /cau[cç][aã]o mare 88/i,                    tag: 'MARE_88',    internalCode: 'Mare 88-12016' },
      { pattern: /cau[cç][aã]o landmark/i,                   tag: 'LANDMARK',   internalCode: null },
      { pattern: /cau[cç][aã]o conj\s*32/i,                  tag: 'CONJ_32',    internalCode: 'Conj 32-12002' },
      // Condomínios por ativo
      { pattern: /cond mare 62|mare 62/i,                    tag: 'MARE_62',    internalCode: 'Mare 62-12015' },
      { pattern: /cond mare 88|mare 88/i,                    tag: 'MARE_88',    internalCode: 'Mare 88-12016' },
      { pattern: /cond mare 92|mare 92/i,                    tag: 'MARE_92',    internalCode: 'Mare 92-12017' },
      { pattern: /cond floripa|iptu floripa|taxa.*floripa/i,  tag: 'FLORIPA',    internalCode: 'Floripa-12007' },
      { pattern: /cond.*conj\s*33/i,                         tag: 'CONJ_33',    internalCode: 'Conj 33-12003' },
      // IPTU por ativo
      { pattern: /iptu\s*137/i,                              tag: 'LANDMARK',   internalCode: '137-A-12013' },
      { pattern: /iptu\s*138/i,                              tag: 'LANDMARK',   internalCode: '138-A-12011' },
      { pattern: /iptu\s*139/i,                              tag: 'LANDMARK',   internalCode: '139-A-12012' },
      { pattern: /iptu conj\s*32/i,                          tag: 'CONJ_32',    internalCode: 'Conj 32-12002' },
      { pattern: /iptu conj\s*33/i,                          tag: 'CONJ_33',    internalCode: 'Conj 33-12003' },
      { pattern: /iptu.*guaruj|iptu grj/i,                   tag: 'GUARUJA',    internalCode: 'Guarujá-12010' },
      { pattern: /iptu bertioga/i,                           tag: 'MARE',       internalCode: null },
      { pattern: /iptu.*cotia/i,                             tag: 'COTIA',      internalCode: 'Cotia-12014' },
      { pattern: /iptu cj|campos do jord/i,                  tag: 'CAMPOS_JORDAO', internalCode: 'Campos do Jordão-12021' },
      { pattern: /iptu.*lomenha|lamenha/i,                   tag: 'LAMENHA',    internalCode: 'Lamenha Lins-12004' },
      { pattern: /iptu.*lombardi|d amrmando|palais/i,        tag: 'PALAIS',     internalCode: 'Palays-12008' },
      // Manutencoes por ativo
      { pattern: /manutenc[aã]o cotia/i,                     tag: 'COTIA',      internalCode: 'Cotia-12014' },
      { pattern: /manutenc[aã]o mare/i,                      tag: 'MARE',       internalCode: null },
      { pattern: /m[oó]veis grj|lampadas gj|dep[oó]sito iporanga/i, tag: 'GUARUJA', internalCode: 'Guarujá-12010' },
      // Despesas gerais sem ativo especifico
      { pattern: /condom[ií]nio|cond\s/i,                    tag: 'CONDOMINIO', internalCode: null },
      { pattern: /manutenção cotia/i,                        tag: 'COTIA',      internalCode: 'Cotia-12014' },
    ];

    // Resolve propertyTag e assetId a partir da referencia
    const normRef2 = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    // Normaliza referencia para lookup (remove acentos, lowercase)
    const normRef = (s: string) => (s ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim();

    // Busca assetId pelo internalCode (cache por companyId)
    const assetCache = new Map<string, string | null>();
    const resolveAssetId = async (internalCode: string | null): Promise<string | null> => {
      if (!internalCode) return null;
      if (assetCache.has(internalCode)) return assetCache.get(internalCode)!;
      const asset = await this.prisma.fixedAsset.findFirst({
        where: { companyId, internalCode, deletedAt: null },
        select: { id: true },
      });
      assetCache.set(internalCode, asset?.id ?? null);
      return asset?.id ?? null;
    };

    // Resolve propertyTag e assetId a partir da referencia
    const resolveProperty = async (referencia: string): Promise<{ propertyTag: string | null; assetId: string | null }> => {
      if (!referencia) return { propertyTag: null, assetId: null };
      // Reembolsos e caucoes NAO sao receita de locacao
      const refClean = referencia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      if (refClean.includes('reembolso') || refClean.includes('caucao') || refClean.includes('cauca') || refClean.startsWith('deposito')) {
        return { propertyTag: 'REEMBOLSO', assetId: null };
      }
      // Testa com texto original E com texto normalizado (sem acentos)
      const refNorm = referencia.normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const entry of PROPERTY_TAG_MAP) {
        if (entry.pattern.test(referencia) || entry.pattern.test(refNorm)) {
          return { propertyTag: entry.tag, assetId: await resolveAssetId(entry.internalCode) };
        }
      }
      // Fallback: retorna a referencia original como tag
      return { propertyTag: referencia, assetId: null };
    };
    const rows = await readRowsAsObjects(buffer);

    if (!rows || rows.length === 0) {
      throw new BadRequestException('A planilha enviada esta vazia.');
    }

    // ── Verificar sobreposicao de periodo ──────────────────────────────────
    // Primeiro parsear para saber o periodo antes de criar o statement
    // A verificacao sera feita apos o parse, antes do createMany

    const today = new Date();
    const statement = await this.prisma.bankStatement.create({
      data: {
        companyId,
        bankCode:     'GENERIC' as any,
        bankName:     'Planilha Mapeada Contabil',
        periodFrom:   today,
        periodTo:     today,
        fileName,
        fileFormat:   'XLSX',
        totalLines:   rows.length,
        totalDebits:  new Prisma.Decimal(0),
        totalCredits: new Prisma.Decimal(0),
        createdById:  userId,
      },
    });

    // ── Detectar periodo real das transacoes ───────────────────────────────
    const dates = rows.map((r: any) => {
      const rk = Object.fromEntries(Object.entries(r).map(([k,v]) => [String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(), v]));
      return parseFlexibleDate(rk['data']);
    }).filter(Boolean) as Date[];

    const periodFrom = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
    const periodTo   = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;

    // Verificar sobreposicao com imports existentes
    const overlapping = await this.prisma.bankStatement.findMany({
      where: {
        companyId,
        deletedAt: null,
        id: { not: statement.id },
        AND: [
          { periodFrom: { lte: periodTo } },
          { periodTo:   { gte: periodFrom } },
        ],
      },
      select: { id: true, bankName: true, periodFrom: true, periodTo: true, totalLines: true },
    });

    if (overlapping.length > 0) {
      // Deletar statement criado (rollback manual)
      await this.prisma.bankStatement.delete({ where: { id: statement.id } });
      const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
      const detail = overlapping.map(o => `"${o.bankName}" (${fmt(o.periodFrom)} → ${fmt(o.periodTo)}, ${o.totalLines} lançamentos)`).join('; ');
      throw new BadRequestException(
        `Período sobreposto com importação existente: ${detail}. Exclua o extrato anterior antes de reimportar.`
      );
    }

    // Atualizar periodo real no statement
    await this.prisma.bankStatement.update({
      where: { id: statement.id },
      data: { periodFrom, periodTo },
    });

    let importedCount = 0;
    let accumulatedDebits  = 0;
    let accumulatedCredits = 0;
    const errors: Array<{ row: number; error: string }> = [];

    const toNum = (v: any) =>
      typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));

    const findAccount = async (code: any) => {
      if (!code) return null;
      const c = String(code).trim().padStart(6, '0');
      return this.prisma.chartOfAccounts.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { reducedCode: c },
            { code: c },
            { code: c },
          ],
        },
      });
    };
    const normKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rowKeys = (r: any) => Object.fromEntries(Object.entries(r).map(([k,v]) => [normKey(k), v]));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const r = rowKeys(row);
      if (i === 0) console.log('COLUNAS XLSX:', Object.keys(row));
      const rowNumber = i + 2;
      try {
        const dateRaw    = r['data'] as any;
        const memoRaw    = r['historico'] ?? r['complemento'] ?? r['descricao'] ?? r['lancamento'] ?? null;
        const valorCred  = r['credito (r$)'] ?? r['credito(r$)'] ?? null;
        const valorDeb   = r['debito (r$)'] ?? r['debito(r$)'] ?? null;
        const valorRaw   = r['valor'] ?? null;
        // codigos de conta: colunas "debito" e "credito" (sem sufixo R$)
        const debitCode  = r['debito'] ?? r['conta debito'] ?? r['conta'] ?? null;
        const creditCode = r['credito'] ?? r['conta credito'] ?? r['contrapartida'] ?? null;
        const referenciaRaw = r['referencia'] ?? r['chave'] ?? '';
        const { propertyTag, assetId } = await resolveProperty(String(referenciaRaw));

        const transactionDate = parseFlexibleDate(dateRaw);
        if (!transactionDate) throw new Error('Data invalida: ' + dateRaw);

        // Layout LM: colunas separadas Credito(R$) e Debito(R$)
        let amountNum: number;
        let type: 'DEBIT' | 'CREDIT';
        const credNum = valorCred !== null && valorCred !== undefined && valorCred !== ''
          ? Math.abs(typeof valorCred === 'number' ? valorCred : parseFloat(String(valorCred).replace(/[()]/g,'').replace(/,/g,'.')))
          : 0;
        const debNum  = valorDeb  !== null && valorDeb  !== undefined && valorDeb  !== ''
          ? Math.abs(typeof valorDeb  === 'number' ? valorDeb  : parseFloat(String(valorDeb ).replace(/[()]/g,'').replace(/,/g,'.')))
          : 0;
        if (credNum > 0 || debNum > 0) {
          amountNum = credNum > 0 ? credNum : debNum;
          type = credNum > 0 ? 'CREDIT' : 'DEBIT';
        } else {
          // fallback coluna Valor
          if (valorRaw === null || valorRaw === undefined) throw new Error('Coluna Valor ausente.');
          const valorNum = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/[()]/g,'').replace(/,/g,'.'));
          if (isNaN(valorNum)) throw new Error('Valor invalido na linha.');
          amountNum = Math.abs(valorNum);
          type = valorNum < 0 ? 'DEBIT' : 'CREDIT';
        }
        if (amountNum === 0) continue;

        if (type === 'DEBIT') accumulatedDebits  += amountNum;
        else                  accumulatedCredits += amountNum;

        const debitAcc  = await findAccount(debitCode);
        const creditAcc = await findAccount(creditCode);

        if (debitCode  && !debitAcc)  throw new Error('Conta Debito '  + debitCode  + ' nao encontrada.');
        if (creditCode && !creditAcc) throw new Error('Conta Credito ' + creditCode + ' nao encontrada.');

        const isAutoPostable = debitAcc !== null && creditAcc !== null;
        const amount = new Prisma.Decimal(amountNum.toFixed(2));

        await this.prisma.$transaction(async (tx) => {
          const bankTx = await tx.bankTransaction.create({
            data: {
              companyId,
              statementId:      statement.id,
              transactionDate,
              description:      String(memoRaw),
              descriptionNorm:  String(memoRaw).trim().toUpperCase(),
              amount,
              type:             type as any,
              status:           isAutoPostable ? ('POSTED' as any) : ('PENDING' as any),
              accountId:        type === 'DEBIT' ? debitAcc?.id ?? null : creditAcc?.id ?? null,
              counterAccountId: type === 'DEBIT' ? creditAcc?.id ?? null : debitAcc?.id ?? null,
              memo:             String(memoRaw),
              groupKey:         String(memoRaw).trim().toUpperCase().slice(0, 50),
              propertyTag:      propertyTag ?? null,
              assetId:          assetId ?? null,
            },
          });

          if (isAutoPostable) {
            const journal = await tx.journalEntry.create({
              data: {
                companyId,
                date:         transactionDate,
                description:  String(memoRaw),
                sourceModule: 'BANK_IMPORT' as any,
                createdById:  userId,
              },
            });
            const abs = amount.abs();
            await tx.journalEntryItem.createMany({
              data: [
                { journalEntryId: journal.id, accountId: debitAcc!.id,  type: 'DEBIT'  as any, value: abs, propertyTag: propertyTag ?? null, assetId: assetId ?? null },
                { journalEntryId: journal.id, accountId: creditAcc!.id, type: 'CREDIT' as any, value: abs, propertyTag: propertyTag ?? null, assetId: assetId ?? null },
              ],
            });
            await tx.bankTransaction.update({
              where: { id: bankTx.id },
              data:  { journalEntryId: journal.id },
            });
          }
        });

        importedCount++;
      } catch (e: any) {
        errors.push({ row: rowNumber, error: e.message });
      }
    }

    await this.prisma.bankStatement.update({
      where: { id: statement.id },
      data: {
        totalDebits:  new Prisma.Decimal(accumulatedDebits.toFixed(2)),
        totalCredits: new Prisma.Decimal(accumulatedCredits.toFixed(2)),
      },
    });

    return {
      statementId:   statement.id,
      imported:      importedCount,
      errors,
      totalDebits:   accumulatedDebits,
      totalCredits:  accumulatedCredits,
    };
  }
}