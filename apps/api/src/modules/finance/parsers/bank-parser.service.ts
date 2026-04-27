// ============================================================
// LEDGR — apps/api/src/modules/bank-import/parsers/bank-parser.service.ts
// Parser multi-banco com detecção automática de layout
// Suporta: Itaú XLS, Bradesco XLS, Banco do Brasil XLS, OFX, CSV
// ============================================================
import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ParsedTransaction {
  transactionDate: Date;
  description:     string;
  descriptionNorm: string;
  amount:          number;
  type:            'DEBIT' | 'CREDIT';
  balance?:        number;
  bankRef?:        string;
  agency?:         string;
}

export interface ParsedStatement {
  bankCode:       string;
  bankName:       string;
  agency?:        string;
  account?:       string;
  periodFrom:     Date;
  periodTo:       Date;
  openingBalance?: number;
  closingBalance?: number;
  transactions:   ParsedTransaction[];
}

// ── Normalização de texto ─────────────────────────────────────
export function normalizeText(text: string): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 \/\-\.]/g, '')
    .trim();
}

// ── Chave de agrupamento (primeiros tokens significativos) ───
export function buildGroupKey(norm: string): string {
  const tokens = norm.split(' ').filter(t => t.length > 2);
  return tokens.slice(0, 3).join(' ');
}

// ── Parser de data BR (DD/MM/YYYY) ───────────────────────────
function parseDateBR(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // Excel serial
  if (/^\d+$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  return null;
}

// ── Parser de valor BR (1.234,56) ────────────────────────────
function parseBRL(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.abs(val);
  const s = String(val).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(s) || 0);
}

@Injectable()
export class BankParserService {

  // ── Entry point: detecta formato e delega ──────────────────
  parse(buffer: Buffer, fileName: string): ParsedStatement {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'ofx' || ext === 'ofc') {
      return this.parseOFX(buffer.toString('utf-8'));
    }
    if (ext === 'csv') {
      return this.parseCSV(buffer.toString('utf-8'));
    }
    if (ext === 'xls' || ext === 'xlsx') {
      return this.parseXLS(buffer);
    }
    throw new BadRequestException(`Formato não suportado: .${ext}. Use XLS, XLSX, OFX ou CSV.`);
  }

  // ── Parser XLS/XLSX — detecta banco pelo conteúdo ─────────
  private parseXLS(buffer: Buffer): ParsedStatement {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Detecção do banco pela presença de células-chave
    const flatText = rows.slice(0, 15).map(r => r.join(' ')).join(' ').toUpperCase();

    if (flatText.includes('BANCO DO BRASIL') || flatText.includes('BB.COM.BR')) {
      return this.parseBB(rows);
    }
    if (flatText.includes('BRADESCO') || flatText.includes('NET EMPRESA')) {
      return this.parseBradesco(rows);
    }
    if (flatText.includes('ITAU') || flatText.includes('ITAÚ')) {
      return this.parseItau(rows);
    }
    if (flatText.includes('SANTANDER')) {
      return this.parseSantander(rows);
    }
    // Fallback: tenta layout genérico
    return this.parseGenericXLS(rows);
  }

  // ── Itaú XLS ──────────────────────────────────────────────
  // Layout: col A=data, B=lançamento, C=ag./origem, D=valor(+/-), E=saldo
  // Linhas de saldo têm "SALDO" na coluna B
  private parseItau(rows: any[][]): ParsedStatement {
    const stmt: ParsedStatement = {
      bankCode: 'ITAU', bankName: 'Banco Itaú S/A',
      periodFrom: new Date(), periodTo: new Date(),
      transactions: [],
    };

    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;
    let openingBalance: number | undefined;

    // Lê cabeçalho
    for (const row of rows.slice(0, 15)) {
      const flat = row.join(' ').toUpperCase();
      if (flat.includes('AGENCIA') || flat.includes('AGÊNCIA')) {
        const ag = String(row[1] ?? '').trim();
        if (ag) stmt.agency = ag;
      }
      if (flat.includes('CONTA')) {
        const ct = String(row[1] ?? '').trim();
        if (ct) stmt.account = ct;
      }
      // "Período: 17/12/2024 até 17/03/2025"
      const periodMatch = flat.match(/(\d{2}\/\d{2}\/\d{4})\s+AT[EÉ]\s+(\d{2}\/\d{2}\/\d{4})/);
      if (periodMatch) {
        periodFrom = parseDateBR(periodMatch[1]);
        periodTo   = parseDateBR(periodMatch[2]);
      }
    }

    // Processa linhas de lançamento
    for (const row of rows) {
      const dateVal = row[0];
      const desc    = String(row[1] ?? '').trim();
      const agency  = String(row[2] ?? '').trim();
      const valRaw  = row[3];
      const saldo   = row[4];

      if (!dateVal || !desc) continue;
      const dt = parseDateBR(dateVal);
      if (!dt) continue;

      // Linhas de saldo total — ignora como transação
      if (desc.includes('SALDO')) {
        if (desc.includes('ANTERIOR') && openingBalance === undefined) {
          openingBalance = parseBRL(saldo ?? valRaw);
        }
        if (desc.includes('DISPONÍVEL')) {
          stmt.closingBalance = parseBRL(saldo ?? valRaw);
        }
        if (!periodFrom) periodFrom = dt;
        periodTo = dt;
        continue;
      }

      const amount = parseBRL(valRaw);
      if (amount === 0) continue;

      // No Itaú, negativos são débito
      const rawNum = typeof valRaw === 'number' ? valRaw
        : parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.'));
      const type: 'DEBIT' | 'CREDIT' = rawNum < 0 ? 'DEBIT' : 'CREDIT';

      const norm = normalizeText(desc);
      stmt.transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount,
        type,
        balance:  saldo ? parseBRL(saldo) : undefined,
        agency:   agency || undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    stmt.periodFrom     = periodFrom ?? new Date();
    stmt.periodTo       = periodTo   ?? new Date();
    stmt.openingBalance = openingBalance;
    return stmt;
  }

  // ── Bradesco XLS (Net Empresa) ────────────────────────────
  // Layout: col A=data, B=lançamento, C=Dcto, D=crédito, E=débito, F=saldo
  // Linha 7: "Extrato de: Agência: 133  Conta: 425406-6"
  private parseBradesco(rows: any[][]): ParsedStatement {
    const stmt: ParsedStatement = {
      bankCode: 'BRADESCO', bankName: 'Banco Bradesco S/A',
      periodFrom: new Date(), periodTo: new Date(),
      transactions: [],
    };

    // Extrai agência/conta do cabeçalho
    for (const row of rows.slice(0, 12)) {
      const flat = row.join(' ');
      const m = flat.match(/Ag[êe]ncia[:\s]+(\d+)\s+Conta[:\s]+([\d\-]+)/i);
      if (m) {
        stmt.agency  = m[1];
        stmt.account = m[2];
      }
    }

    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;

    for (const row of rows) {
      const dateVal = row[0];
      const desc    = String(row[1] ?? '').trim();
      const docto   = String(row[2] ?? '').trim();
      const credRaw = row[3];
      const debRaw  = row[4];
      const saldo   = row[5];

      if (!dateVal || !desc) continue;
      const dt = parseDateBR(dateVal);
      if (!dt) continue;

      if (desc.toUpperCase().includes('SALDO')) {
        if (desc.toUpperCase().includes('ANTERIOR')) {
          stmt.openingBalance = parseBRL(credRaw || debRaw || saldo);
        }
        continue;
      }

      const credit = parseBRL(credRaw);
      const debit  = parseBRL(debRaw);

      if (credit === 0 && debit === 0) continue;

      const amount = credit > 0 ? credit : debit;
      const type: 'DEBIT' | 'CREDIT' = debit > 0 ? 'DEBIT' : 'CREDIT';
      const norm = normalizeText(desc);

      stmt.transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount,
        type,
        balance:  saldo ? parseBRL(saldo) : undefined,
        bankRef:  docto || undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    stmt.periodFrom = periodFrom ?? new Date();
    stmt.periodTo   = periodTo   ?? new Date();
    if (stmt.transactions.length > 0) {
      stmt.closingBalance = stmt.transactions[stmt.transactions.length - 1].balance;
    }
    return stmt;
  }

  // ── Banco do Brasil XLS ───────────────────────────────────
  // Layout BB: col A=data, B=dependência origem, C=número doc., D=descrição, E=valor, F=saldo
  // Positivo = crédito, negativo = débito
  private parseBB(rows: any[][]): ParsedStatement {
    const stmt: ParsedStatement = {
      bankCode: 'BB', bankName: 'Banco do Brasil S/A',
      periodFrom: new Date(), periodTo: new Date(),
      transactions: [],
    };

    // Cabeçalho BB: "Agência: 1234-5   C/C: 12345-6"
    for (const row of rows.slice(0, 20)) {
      const flat = row.join(' ').toUpperCase();
      const ag = flat.match(/AG[EÊ]NCIA[:\s]+([\d\-]+)/i);
      if (ag) stmt.agency = ag[1];
      const ct = flat.match(/C\/C[:\s]+([\d\-]+)/i);
      if (ct) stmt.account = ct[1];
    }

    // Encontra linha de cabeçalho de dados (contém "Data" e "Histórico")
    let dataStartRow = 0;
    for (let i = 0; i < rows.length; i++) {
      const flat = rows[i].join(' ').toUpperCase();
      if (flat.includes('DATA') && (flat.includes('HIST') || flat.includes('DESC'))) {
        dataStartRow = i + 1;
        break;
      }
    }

    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;

    for (const row of rows.slice(dataStartRow)) {
      const dateVal = row[0];
      const agency  = String(row[1] ?? '').trim();
      const docNum  = String(row[2] ?? '').trim();
      const desc    = String(row[3] ?? '').trim();
      const valRaw  = row[4];
      const saldo   = row[5];

      if (!dateVal || !desc) continue;
      const dt = parseDateBR(dateVal);
      if (!dt) continue;

      if (desc.toUpperCase().includes('SALDO')) {
        if (desc.toUpperCase().includes('ANTERIOR') || desc.toUpperCase().includes('INICIAL')) {
          stmt.openingBalance = parseBRL(saldo ?? valRaw);
        }
        continue;
      }

      const rawNum = typeof valRaw === 'number' ? valRaw
        : parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.'));

      if (!rawNum) continue;

      const amount = Math.abs(rawNum);
      const type: 'DEBIT' | 'CREDIT' = rawNum < 0 ? 'DEBIT' : 'CREDIT';
      const norm = normalizeText(desc);

      stmt.transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount,
        type,
        balance:  saldo ? parseBRL(saldo) : undefined,
        bankRef:  docNum || undefined,
        agency:   agency || undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    stmt.periodFrom = periodFrom ?? new Date();
    stmt.periodTo   = periodTo   ?? new Date();
    if (stmt.transactions.length > 0) {
      stmt.closingBalance = stmt.transactions[stmt.transactions.length - 1].balance;
    }
    return stmt;
  }

  // ── Santander XLS ─────────────────────────────────────────
  // Layout: col A=data, B=descrição, C=valor, D=saldo
  private parseSantander(rows: any[][]): ParsedStatement {
    const stmt: ParsedStatement = {
      bankCode: 'SANTANDER', bankName: 'Banco Santander S/A',
      periodFrom: new Date(), periodTo: new Date(),
      transactions: [],
    };

    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;
    let headerFound = false;

    for (const row of rows) {
      const flat = row.join(' ').toUpperCase();
      if (!headerFound && flat.includes('DATA') && flat.includes('DESCRI')) {
        headerFound = true;
        continue;
      }
      if (!headerFound) continue;

      const dateVal = row[0];
      const desc    = String(row[1] ?? '').trim();
      const valRaw  = row[2];
      const saldo   = row[3];

      if (!dateVal || !desc) continue;
      const dt = parseDateBR(dateVal);
      if (!dt) continue;
      if (desc.toUpperCase().includes('SALDO')) continue;

      const rawNum = typeof valRaw === 'number' ? valRaw
        : parseFloat(String(valRaw).replace(/\./g, '').replace(',', '.'));
      if (!rawNum) continue;

      const norm = normalizeText(desc);
      stmt.transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount:  Math.abs(rawNum),
        type:    rawNum < 0 ? 'DEBIT' : 'CREDIT',
        balance: saldo ? parseBRL(saldo) : undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    stmt.periodFrom = periodFrom ?? new Date();
    stmt.periodTo   = periodTo   ?? new Date();
    return stmt;
  }

  // ── OFX Parser ────────────────────────────────────────────
  // Padrão OFX/QIF bancário brasileiro — detecta banco pelo FID
  private parseOFX(content: string): ParsedStatement {
    const get = (tag: string) => {
      const m = content.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const fid      = get('FID');
    const bankCode = this.bankCodeFromFID(fid);
    const bankName = get('ORG') || get('BANKNAME') || 'Banco (OFX)';
    const acctid   = get('ACCTID');
    const branchid = get('BRANCHID');

    const dtstart = this.parseOFXDate(get('DTSTART'));
    const dtend   = this.parseOFXDate(get('DTEND'));
    const ledger  = get('LEDGERBAL') ? parseBRL(get('LEDGERBAL')) : undefined;

    // Extrai todas as transações <STMTTRN>...</STMTTRN>
    const txBlocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
    const transactions: ParsedTransaction[] = [];

    for (const block of txBlocks) {
      const trntype = get.call({ content: block } as any, 'TRNTYPE')
        || (block.match(/<TRNTYPE>([^<\n\r]+)/i)?.[1]?.trim() ?? '');
      const dtposted = block.match(/<DTPOSTED>([^<\n\r]+)/i)?.[1]?.trim() ?? '';
      const trnamt   = block.match(/<TRNAMT>([^<\n\r]+)/i)?.[1]?.trim() ?? '0';
      const fitid    = block.match(/<FITID>([^<\n\r]+)/i)?.[1]?.trim() ?? '';
      const memo     = block.match(/<MEMO>([^<\n\r]+)/i)?.[1]?.trim()
                    ?? block.match(/<NAME>([^<\n\r]+)/i)?.[1]?.trim() ?? '';
      const checknum = block.match(/<CHECKNUM>([^<\n\r]+)/i)?.[1]?.trim() ?? '';

      const dt     = this.parseOFXDate(dtposted);
      if (!dt) continue;

      const rawNum = parseFloat(trnamt.replace(',', '.'));
      if (isNaN(rawNum)) continue;

      // OFX usa DEBIT/CREDIT ou sinal do valor
      let type: 'DEBIT' | 'CREDIT';
      if (trntype.toUpperCase() === 'DEBIT' || trntype.toUpperCase() === 'CHECK') {
        type = 'DEBIT';
      } else if (trntype.toUpperCase() === 'CREDIT' || trntype.toUpperCase() === 'INT') {
        type = 'CREDIT';
      } else {
        type = rawNum < 0 ? 'DEBIT' : 'CREDIT';
      }

      const norm = normalizeText(memo);
      transactions.push({
        transactionDate: dt,
        description:     memo,
        descriptionNorm: norm,
        amount:          Math.abs(rawNum),
        type,
        bankRef:         fitid || checknum || undefined,
      });
    }

    return {
      bankCode,
      bankName,
      agency:          branchid || undefined,
      account:         acctid   || undefined,
      periodFrom:      dtstart  ?? (transactions[0]?.transactionDate ?? new Date()),
      periodTo:        dtend    ?? (transactions[transactions.length - 1]?.transactionDate ?? new Date()),
      closingBalance:  ledger,
      transactions,
    };
  }

  // ── CSV genérico ──────────────────────────────────────────
  // Detecta colunas automaticamente pelo cabeçalho
  private parseCSV(content: string): ParsedStatement {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('CSV sem dados suficientes.');

    // Separador: ; ou ,
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => normalizeText(h));

    // Mapeamento flexível de colunas
    const colIdx = {
      date:    headers.findIndex(h => /DATA/.test(h)),
      desc:    headers.findIndex(h => /DESC|HIST|LANCAMENTO|LANÇAMENTO/.test(h)),
      amount:  headers.findIndex(h => /VALOR/.test(h)),
      credit:  headers.findIndex(h => /CREDIT/.test(h)),
      debit:   headers.findIndex(h => /DEBIT|DEBITO/.test(h)),
      balance: headers.findIndex(h => /SALDO/.test(h)),
      ref:     headers.findIndex(h => /DOC|REF|FITID/.test(h)),
      type:    headers.findIndex(h => /TIPO|TYPE/.test(h)),
    };

    if (colIdx.date === -1 || colIdx.desc === -1) {
      throw new BadRequestException('CSV não reconhecido: colunas Data e Descrição são obrigatórias.');
    }

    const transactions: ParsedTransaction[] = [];
    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;

    for (const line of lines.slice(1)) {
      const cols = line.split(sep);
      const dt   = parseDateBR(cols[colIdx.date]);
      if (!dt) continue;

      const desc = String(cols[colIdx.desc] ?? '').replace(/^"|"$/g, '').trim();
      if (!desc) continue;

      let amount: number;
      let type:   'DEBIT' | 'CREDIT';

      if (colIdx.credit >= 0 && colIdx.debit >= 0) {
        const cr = parseBRL(cols[colIdx.credit]);
        const db = parseBRL(cols[colIdx.debit]);
        amount = cr > 0 ? cr : db;
        type   = db > 0 ? 'DEBIT' : 'CREDIT';
      } else {
        const raw = parseFloat(String(cols[colIdx.amount]).replace(/\./g, '').replace(',', '.'));
        amount = Math.abs(raw);
        type   = raw < 0 ? 'DEBIT' : 'CREDIT';
      }

      if (amount === 0) continue;

      // Coluna tipo explícita sobrescreve
      if (colIdx.type >= 0) {
        const t = normalizeText(cols[colIdx.type]);
        if (t.includes('DBIT') || t.includes('D')) type = 'DEBIT';
        if (t.includes('CRED') || t.includes('C')) type = 'CREDIT';
      }

      const norm = normalizeText(desc);
      transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount,
        type,
        balance:  colIdx.balance >= 0 ? parseBRL(cols[colIdx.balance]) : undefined,
        bankRef:  colIdx.ref    >= 0 ? cols[colIdx.ref]?.trim()        : undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    return {
      bankCode: 'GENERIC', bankName: 'Extrato CSV',
      periodFrom: periodFrom ?? new Date(),
      periodTo:   periodTo   ?? new Date(),
      transactions,
    };
  }

  // ── Layout XLS genérico ───────────────────────────────────
  private parseGenericXLS(rows: any[][]): ParsedStatement {
    // Tenta encontrar linha de cabeçalho com Data + Descrição
    let headerRow = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const flat = rows[i].join(' ').toUpperCase();
      if (flat.match(/DATA/) && flat.match(/DESC|HIST/)) {
        headerRow = i;
        break;
      }
    }

    if (headerRow === -1) {
      throw new BadRequestException(
        'Layout do arquivo não reconhecido. Tente exportar como OFX ou CSV.',
      );
    }

    const headers = rows[headerRow].map((h: any) => normalizeText(String(h)));
    const colDate  = headers.findIndex((h: string) => /DATA/.test(h));
    const colDesc  = headers.findIndex((h: string) => /DESC|HIST|LANCAM/.test(h));
    const colVal   = headers.findIndex((h: string) => /VALOR/.test(h));
    const colCred  = headers.findIndex((h: string) => /CRED/.test(h));
    const colDeb   = headers.findIndex((h: string) => /DEB/.test(h));
    const colSaldo = headers.findIndex((h: string) => /SALDO/.test(h));

    const transactions: ParsedTransaction[] = [];
    let periodFrom: Date | null = null;
    let periodTo:   Date | null = null;

    for (const row of rows.slice(headerRow + 1)) {
      const dt   = parseDateBR(row[colDate]);
      const desc = String(row[colDesc] ?? '').trim();
      if (!dt || !desc) continue;

      let amount: number;
      let type: 'DEBIT' | 'CREDIT';

      if (colCred >= 0 && colDeb >= 0) {
        const cr = parseBRL(row[colCred]);
        const db = parseBRL(row[colDeb]);
        amount = cr > 0 ? cr : db;
        type   = db > 0 ? 'DEBIT' : 'CREDIT';
      } else {
        const raw = typeof row[colVal] === 'number' ? row[colVal]
          : parseFloat(String(row[colVal]).replace(/\./g, '').replace(',', '.'));
        amount = Math.abs(raw || 0);
        type   = (raw || 0) < 0 ? 'DEBIT' : 'CREDIT';
      }

      if (amount === 0) continue;

      const norm = normalizeText(desc);
      transactions.push({
        transactionDate: dt,
        description:     desc,
        descriptionNorm: norm,
        amount,
        type,
        balance: colSaldo >= 0 ? parseBRL(row[colSaldo]) : undefined,
      });

      if (!periodFrom || dt < periodFrom) periodFrom = dt;
      if (!periodTo   || dt > periodTo)   periodTo   = dt;
    }

    return {
      bankCode: 'GENERIC', bankName: 'Extrato (genérico)',
      periodFrom: periodFrom ?? new Date(),
      periodTo:   periodTo   ?? new Date(),
      transactions,
    };
  }

  // ── Helpers ───────────────────────────────────────────────
  private parseOFXDate(s: string): Date | null {
    if (!s) return null;
    // OFX: 20241216120000[-3:BRT]
    const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return null;
  }

  private bankCodeFromFID(fid: string): string {
    const map: Record<string, string> = {
      '341': 'ITAU',
      '237': 'BRADESCO',
      '001': 'BB',
      '033': 'SANTANDER',
      '104': 'CAIXA',
      '748': 'SICREDI',
      '756': 'SICOOB',
      '260': 'NUBANK',
      '077': 'INTER',
    };
    return map[fid] ?? 'GENERIC';
  }
}
