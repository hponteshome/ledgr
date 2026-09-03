// apps/api/src/modules/accounting/services/journal-manual-import.service.ts
//
// CRIADO 03/09/2026 (Etapa 3 - historico por partida / importacao manual).
// Formato de arquivo dedicado, DIFERENTE do journal-importer.service.ts
// existente (que agrupa por lote|data|historico ja vindo pronto no arquivo).
// Aqui o NrLancto vem sempre vazio - a LEDGR gera a referencia
// (MANUAL-{ano}-{seq}) e agrupa automaticamente por acumulacao ate D=C
// bater, dentro da MESMA data. Nao reaproveita a logica de agrupamento do
// importador antigo de proposito: mudar aquela logica alteraria o
// comportamento de quem ja usa o formato antigo hoje.
//
// Layout esperado (pipe-delimitado):
//   Linha 1 (cabecalho): CNPJ|Tipo
//   Linhas seguintes:    Data|NrLancto|ContaDebito|ContaCredito|Historico|HP|Complemento|Valor
//     - Data: DDMMAAAA (sem separador)
//     - NrLancto: sempre vazio, ignorado na leitura (LEDGR atribui)
//     - ContaDebito/ContaCredito: uma das duas (partida simples fecha na
//       propria linha) ou so uma (partida dobrada - acumula ate D=C bater,
//       mesma data obrigatoria dentro do mesmo grupo)
//     - HP e Complemento: ignorados por ora (Historico Padrao - pendencia
//       registrada em LEDGR-contexto.md, tabela ainda nao existe)
//     - Valor: formato pt-BR (1.234,56 ou 1234,56)

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface ManualImportIssue {
  severity: 'error' | 'warning';
  ref: string;
  lineNum?: number;
  reason: string;
}

interface RawManualLine {
  lineNum: number;
  date: Date;
  dateStr: string;   // YYYY-MM-DD
  dateBR: string;    // DD/MM/YYYY
  contaDebito: string;
  contaCredito: string;
  historico: string;
  valor: Decimal;
}

interface ParsedManualItem {
  code: string;
  type: 'DEBIT' | 'CREDIT';
  value: Decimal;
  description: string;
}

interface ParsedManualEntry {
  date: Date;
  dateBR: string;
  items: ParsedManualItem[];
  descriptions: string[];
  lineNums: number[];
}

export interface ManualPreviewEntry {
  index: number; date: string; description: string;
  itemCount: number; debitTotal: string; creditTotal: string; balanced: boolean;
}

export interface ManualImportPreviewResult {
  entries: ManualPreviewEntry[]; issues: ManualImportIssue[]; hasErrors: boolean;
  totalEntries: number; totalLines: number;
}

export interface ManualImportResult {
  inserted: number;
  errors: Array<{ ref: string; reason: string }>;
  issues: ManualImportIssue[];
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

function parseDecimalBR(raw: string): Decimal | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  try { return new Decimal(cleaned); } catch { return null; }
}

function parseManualFile(content: string): {
  companyTaxId: string; tipo: string; entries: ParsedManualEntry[]; issues: ManualImportIssue[];
} {
  const lines = content.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0);
  const issues: ManualImportIssue[] = [];

  if (lines.length === 0) {
    issues.push({ severity: 'error', ref: '?', reason: 'Arquivo vazio.' });
    return { companyTaxId: '', tipo: '', entries: [], issues };
  }

  // ── Linha 1: cabecalho CNPJ|Tipo ──────────────────────────────
  const headerParts = lines[0].split('|');
  const companyTaxId = (headerParts[0] || '').replace(/\D/g, '');
  const tipo = (headerParts[1] || '').trim() || 'Manual';

  if (companyTaxId.length !== 14) {
    issues.push({ severity: 'error', ref: '?', lineNum: 1, reason: `CNPJ inválido no cabeçalho: "${headerParts[0] || ''}" (esperado 14 dígitos)` });
  }

  const rawLines: RawManualLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|');
    if (parts.length < 8) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Linha com ${parts.length} campos (esperado 8: Data|NrLancto|Debito|Credito|Historico|HP|Complemento|Valor)` });
      continue;
    }

    const [rawDate, , contaDebitoRaw, contaCreditoRaw, rawHistorico, , , rawValor] = parts;
    const d = rawDate.trim();

    if (!/^\d{8}$/.test(d)) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Data inválida: "${rawDate}" (esperado DDMMAAAA)` });
      continue;
    }
    const day = parseInt(d.slice(0, 2), 10);
    const month = parseInt(d.slice(2, 4), 10);
    const year = parseInt(d.slice(4, 8), 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(date.getTime())) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Data inválida: "${rawDate}"` });
      continue;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateBR  = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    const contaDebito  = contaDebitoRaw.trim();
    const contaCredito = contaCreditoRaw.trim();
    const historico    = rawHistorico.trim();

    const valor = parseDecimalBR(rawValor);
    if (valor === null) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Valor inválido: "${rawValor}"` });
      continue;
    }
    if (valor.lessThanOrEqualTo(0)) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Valor deve ser maior que zero: "${rawValor}"` });
      continue;
    }
    if (!contaDebito && !contaCredito) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: 'Linha sem conta de débito nem de crédito.' });
      continue;
    }
    if (contaDebito && contaCredito && contaDebito === contaCredito) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Conta de débito e crédito iguais: "${contaDebito}"` });
      continue;
    }
    if (!historico) {
      issues.push({ severity: 'warning', ref: '?', lineNum: i + 1, reason: 'Linha sem histórico.' });
    }

    rawLines.push({ lineNum: i + 1, date, dateStr, dateBR, contaDebito, contaCredito, historico, valor });
  }

  // ── Agrupamento: partida simples fecha sozinha; partida dobrada
  //    acumula (mesma data obrigatoria) ate debito = credito ──────
  const entries: ParsedManualEntry[] = [];
  let openGroup: {
    dateStr: string; dateBR: string; items: ParsedManualItem[];
    descriptions: string[]; lineNums: number[]; runDebit: Decimal; runCredit: Decimal;
  } | null = null;

  const closeGroupIfBalanced = () => {
    if (openGroup && openGroup.runDebit.greaterThan(0) && openGroup.runDebit.equals(openGroup.runCredit)) {
      entries.push({
        date: new Date(`${openGroup.dateStr}T00:00:00.000Z`),
        dateBR: openGroup.dateBR,
        items: openGroup.items,
        descriptions: [...new Set(openGroup.descriptions)],
        lineNums: openGroup.lineNums,
      });
      openGroup = null;
    }
  };

  for (const l of rawLines) {
    const isSimples = !!l.contaDebito && !!l.contaCredito;

    if (isSimples) {
      entries.push({
        date: l.date,
        dateBR: l.dateBR,
        items: [
          { code: l.contaDebito,  type: 'DEBIT',  value: l.valor, description: l.historico },
          { code: l.contaCredito, type: 'CREDIT', value: l.valor, description: l.historico },
        ],
        descriptions: [l.historico],
        lineNums: [l.lineNum],
      });
      continue;
    }

    if (openGroup && (openGroup as any).dateStr !== l.dateStr) {
      issues.push({
        severity: 'error', ref: `grupo linha ${(openGroup as any).lineNums[0]}`, lineNum: l.lineNum,
        reason: `Data divergente dentro do mesmo grupo de partida dobrada: grupo em ${(openGroup as any).dateBR}, linha com ${l.dateBR}.`,
      });
      continue;
    }

    if (!openGroup) {
      openGroup = { dateStr: l.dateStr, dateBR: l.dateBR, items: [], descriptions: [], lineNums: [], runDebit: new Decimal(0), runCredit: new Decimal(0) };
    }

    if (l.contaDebito) {
      openGroup.items.push({ code: l.contaDebito, type: 'DEBIT', value: l.valor, description: l.historico });
      openGroup.runDebit = openGroup.runDebit.add(l.valor);
    } else {
      openGroup.items.push({ code: l.contaCredito, type: 'CREDIT', value: l.valor, description: l.historico });
      openGroup.runCredit = openGroup.runCredit.add(l.valor);
    }
    openGroup.descriptions.push(l.historico);
    openGroup.lineNums.push(l.lineNum);

    closeGroupIfBalanced();
  }

  if (openGroup) {
    const g = openGroup as any;
    issues.push({
      severity: 'error', ref: `grupo linha ${g.lineNums[0]}`,
      reason: `Grupo de partida dobrada não fechou: débito ${g.runDebit.toFixed(2)} ≠ crédito ${g.runCredit.toFixed(2)}.`,
    });
  }

  return { companyTaxId, tipo, entries, issues };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class JournalManualImportService {
  private readonly logger = new Logger(JournalManualImportService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async validateCompanyTaxId(companyId: string, fileTaxId: string, issues: ManualImportIssue[]) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { taxId: true, legalName: true } });
    if (!company) {
      issues.push({ severity: 'error', ref: '?', reason: 'Empresa não encontrada.' });
      return;
    }
    const storedDigits = (company.taxId || '').replace(/\D/g, '');
    if (fileTaxId && storedDigits && fileTaxId !== storedDigits) {
      issues.push({
        severity: 'error', ref: '?', lineNum: 1,
        reason: `CNPJ do arquivo (${fileTaxId}) não corresponde à empresa ativa "${company.legalName}" (${storedDigits}).`,
      });
    }
  }

  async preview(content: string, companyId: string): Promise<ManualImportPreviewResult> {
    const { companyTaxId, entries, issues } = parseManualFile(content);
    await this.validateCompanyTaxId(companyId, companyTaxId, issues);

    // NOVO (03/09/2026): aceita code OU reducedCode como identificador de
    // conta na coluna Debito/Credito do arquivo.
    const allCodes = [...new Set(entries.flatMap(e => e.items.map(i => i.code)))];
    const found = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, OR: [{ code: { in: allCodes } }, { reducedCode: { in: allCodes } }] },
      select: { code: true, reducedCode: true, isAnalytic: true },
    });
    const foundMap = new Map<string, { code: string; reducedCode: string | null; isAnalytic: boolean }>();
    for (const a of found) {
      foundMap.set(a.code, a);
      if (a.reducedCode) foundMap.set(a.reducedCode, a);
    }

    entries.forEach((entry, idx) => {
      entry.items.forEach((item, itemIdx) => {
        const acc = foundMap.get(item.code);
        if (!acc) {
          issues.push({ severity: 'error', ref: `lançamento ${idx + 1}`, lineNum: entry.lineNums[itemIdx], reason: `Conta ${item.code} não cadastrada no plano de contas.` });
        } else if (!acc.isAnalytic) {
          issues.push({ severity: 'warning', ref: `lançamento ${idx + 1}`, lineNum: entry.lineNums[itemIdx], reason: `Conta ${item.code} é sintética.` });
        }
      });
    });

    const hasErrors = issues.some(i => i.severity === 'error');

    const previewEntries: ManualPreviewEntry[] = entries.slice(0, 20).map((e, idx) => {
      const totalDebit  = e.items.filter(i => i.type === 'DEBIT').reduce((s, i) => s.add(i.value), new Decimal(0));
      const totalCredit = e.items.filter(i => i.type === 'CREDIT').reduce((s, i) => s.add(i.value), new Decimal(0));
      return {
        index: idx + 1,
        date: e.date.toISOString().slice(0, 10),
        description: e.descriptions.join('; '),
        itemCount: e.items.length,
        debitTotal: totalDebit.toFixed(2),
        creditTotal: totalCredit.toFixed(2),
        balanced: totalDebit.equals(totalCredit),
      };
    });

    return {
      entries: previewEntries, issues, hasErrors,
      totalEntries: entries.length,
      totalLines: entries.reduce((s, e) => s + e.items.length, 0),
    };
  }

  async import(content: string, companyId: string, createdById: string): Promise<ManualImportResult> {
    const { companyTaxId, entries, issues } = parseManualFile(content);
    await this.validateCompanyTaxId(companyId, companyTaxId, issues);

    if (issues.some(i => i.severity === 'error')) {
      throw new BadRequestException('Arquivo contém erros. Corrija antes de importar.');
    }

    // NOVO (03/09/2026): aceita code OU reducedCode como identificador de
    // conta - mesma logica do preview().
    const allCodes = [...new Set(entries.flatMap(e => e.items.map(i => i.code)))];
    const found = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, OR: [{ code: { in: allCodes } }, { reducedCode: { in: allCodes } }] },
      select: { id: true, code: true, reducedCode: true },
    });
    const codeToId = new Map<string, string>();
    for (const a of found) {
      codeToId.set(a.code, a.id);
      if (a.reducedCode) codeToId.set(a.reducedCode, a.id);
    }
    const missingCodes = allCodes.filter(c => !codeToId.has(c));
    if (missingCodes.length > 0) {
      throw new BadRequestException(`Contas não encontradas: ${missingCodes.join(', ')}`);
    }

    // Numeracao sequencial MANUAL-{ano}-{seq}, continua de onde parou por ano
    const seqByYear = new Map<number, number>();
    const getNextRef = async (year: number): Promise<string> => {
      if (!seqByYear.has(year)) {
        const prefix = `MANUAL-${year}-`;
        const last = await this.prisma.journalEntry.findFirst({
          where: { companyId, reference: { startsWith: prefix } },
          orderBy: { reference: 'desc' },
          select: { reference: true },
        });
        const lastSeq = last?.reference ? (parseInt(last.reference.replace(prefix, ''), 10) || 0) : 0;
        seqByYear.set(year, lastSeq);
      }
      const next = (seqByYear.get(year) as number) + 1;
      seqByYear.set(year, next);
      return `MANUAL-${year}-${String(next).padStart(4, '0')}`;
    };

    const result: ManualImportResult = { inserted: 0, errors: [], issues };

    for (const entry of entries) {
      const year = entry.date.getUTCFullYear();
      const reference = await getNextRef(year);
      try {
        await this.prisma.journalEntry.create({
          data: {
            companyId,
            date: entry.date,
            description: entry.descriptions.join('; '),
            reference,
            sourceModule: 'ACCOUNTING',
            createdById,
            items: {
              create: entry.items.map(i => ({
                accountId: codeToId.get(i.code)!,
                type: i.type,
                value: i.value.toNumber(),
                description: i.description || null,
              })),
            },
          },
        });
        result.inserted++;
      } catch (e: any) {
        result.errors.push({ ref: reference, reason: e.message });
      }
    }

    this.logger.log(`[JournalManualImport] inseridos: ${result.inserted} | erros: ${result.errors.length}`);
    return result;
  }
}
