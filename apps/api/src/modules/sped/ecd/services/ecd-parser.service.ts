// apps/api/src/modules/sped/ecd/ecd-parser.service.ts
//
// Suporte a leiautes:
//   2.00 / 3.00  — anos-base 2008–2013
//   4.00         — anos-base 2014–2015  ← arquivo Sunrise 2015
//   5.00 / 6.00  — anos-base 2016–2017
//   7.00 / 8.00  — anos-base 2018–2020
//   9.00         — anos-base 2021+      ← padrão atual
//
// Detecção: campo I010[2] (COD_VER_LC)
// Encoding: latin1 → deve ser decodificado no controller antes de chamar parse()
//           usar: fileContent = Buffer.from(rawBuffer).toString('latin1')

import { Injectable, Logger } from '@nestjs/common';

// ── Tipos ────────────────────────────────────────────────────────

export interface EcdReg0000 {
  bookCode: string;       // LECD
  periodStart: string;    // DT_INI  ddmmaaaa
  periodEnd: string;      // DT_FIN  ddmmaaaa
  companyName: string;    // NOME
  cnpj: string;           // CNPJ
  state: string;          // UF
  bookPurpose: string;    // IND_FIN_ESC: 0=Original 1=Substituta
  hashSubstituted: string;// COD_HASH_SUB
}

export interface EcdRegI010 {
  bookType: string;       // IND_ESC: G R A B Z
  layoutVersion: string;  // COD_VER_LC ex: "4.00" "9.00"
  layoutMajor: number;    // número inteiro para comparação: 4, 9 …
}

export interface EcdRegI030 {
  bookNumber: string;
  bookNature: string;
  totalLines: string;
  cnpj: string;
  closingDate: string;
}

export interface EcdRegI050 {
  updateDate: string;
  natureCode: string;     // 01=Ativo 02=Passivo 03=PL 04=Resultado 05=Compensação
  accountType: string;    // S=Sintética A=Analítica
  level: number;
  code: string;
  parentCode: string;
  name: string;
}

export interface EcdRegI150 {
  periodStart: string;
  periodEnd: string;
}

export interface EcdRegI155 {
  accountCode: string;
  costCenter: string;
  openingBalance: number;
  openingSign: string;    // D C
  debit: number;
  credit: number;
  closingBalance: number;
  closingSign: string;    // D C
}

export interface EcdRegI200 {
  entryNumber: string;
  date: string;           // ddmmaaaa
  value: number;
  type: string;           // N E X
}

export interface EcdRegI250 {
  accountCode: string;
  costCenter: string;
  value: number;
  sign: string;           // D C
  docRef: string;
  history: string;
}

export interface EcdRegJ100 {
  // |J100|COD_CTA|NIVEL|IND_GRP_BAL|DESCR_CTA|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|
  // leiaute 4.00: f[1]=COD_CTA f[2]=NIVEL f[3]=IND_GRP_BAL f[4]=DESCR f[5]=VL_INI f[6]=DC_INI f[7]=VL_FIN f[8]=DC_FIN
  // leiaute 9.00: acrescenta campos intermediários — mapeado igual pelo posição relativa
  code: string;
  level: number;
  group: string;          // 1=Ativo 2=Passivo
  description: string;
  openingValue: number;
  openingSign: string;
  closingValue: number;
  closingSign: string;
}

export interface EcdRegJ150 {
  // |J150|NU_ORDEM|COD_AGL|NIVEL_AGL|DESCR_COD_AGL|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|IND_GRP_DRE|
  // leiaute 4.00: f[1]=NU_ORDEM f[2]=COD_AGL f[3]=NIVEL f[4]=DESCR f[5]=VL_INI f[6]=DC_INI f[7]=VL_FIN f[8]=DC_FIN f[9]=GRP_DRE
  order: number;
  code: string;
  level: number;
  description: string;
  previousValue: number;
  previousSign: string;
  currentValue: number;
  currentSign: string;
  groupDre: string;       // D N R P
}

/** Tipo do conteúdo do arquivo:
 *  FULL         — tem I050 + I155 + I200/I250
 *  BALANCES_ONLY — tem I050 + I155, sem lançamentos (leiaute 4.00 comum)
 *  STATEMENTS_ONLY — só Bloco J (Demonstrações exportadas separadamente)
 */
export type EcdContentType = 'FULL' | 'BALANCES_ONLY' | 'STATEMENTS_ONLY';

export interface EcdParsed {
  reg0000: EcdReg0000 | null;
  regI010: EcdRegI010 | null;
  regI030: EcdRegI030 | null;
  regI050: EcdRegI050[];
  periods: Array<{ period: EcdRegI150; balances: EcdRegI155[] }>;
  journalEntries: Array<{ entry: EcdRegI200; items: EcdRegI250[] }>;
  balanceSheet: EcdRegJ100[];
  incomeStatement: EcdRegJ150[];
  contentType: EcdContentType;
  errors: Array<{ line: number; record: string; message: string }>;
  totalLines: number;
}

// ── Parser ────────────────────────────────────────────────────────

@Injectable()
export class EcdParserService {
  private readonly logger = new Logger(EcdParserService.name);

  // ── Entrada principal ─────────────────────────────────────────

  /**
   * @param fileContent string já decodificado em latin1 ou utf-8.
   *   No controller/service de upload, use:
   *     const content = rawBuffer.toString('latin1');
   */
  parse(fileContent: string): EcdParsed {
    const result: EcdParsed = {
      reg0000: null,
      regI010: null,
      regI030: null,
      regI050: [],
      periods: [],
      journalEntries: [],
      balanceSheet: [],
      incomeStatement: [],
      contentType: 'STATEMENTS_ONLY',
      errors: [],
      totalLines: 0,
    };

    // Normaliza BOM e quebras de linha
    const content = fileContent
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    const lines = content.split('\n').filter(l => l.trim().length > 0);
    result.totalLines = lines.length;

    let currentPeriod: { period: EcdRegI150; balances: EcdRegI155[] } | null = null;
    let currentEntry:  { entry: EcdRegI200;  items: EcdRegI250[]   } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('|')) continue;

      // Remove pipe inicial e final, split
      const inner = line.slice(1, line.endsWith('|') ? -1 : undefined);
      const fields = inner.split('|');
      const reg = fields[0]?.toUpperCase();

      try {
        switch (reg) {

          // ── Bloco 0 ──────────────────────────────────────────
          case '0000':
            result.reg0000 = this.parse0000(fields);
            break;

          // ── Bloco I ──────────────────────────────────────────
          case 'I010':
            result.regI010 = this.parseI010(fields);
            break;

          case 'I030':
            result.regI030 = this.parseI030(fields, result.regI010?.layoutMajor ?? 9);
            break;

          case 'I050':
          case 'C050': // leiautes antigos usam bloco C
            result.regI050.push(this.parseI050(fields));
            break;

          case 'I150':
          case 'C150':
            if (currentPeriod) result.periods.push(currentPeriod);
            currentPeriod = { period: this.parseI150(fields), balances: [] };
            break;

          case 'I155':
          case 'C155':
            if (currentPeriod) {
              currentPeriod.balances.push(this.parseI155(fields));
            }
            break;

          case 'I200':
            if (currentEntry) result.journalEntries.push(currentEntry);
            currentEntry = { entry: this.parseI200(fields), items: [] };
            break;

          case 'I250':
            if (currentEntry) {
              currentEntry.items.push(this.parseI250(fields));
            }
            break;

          // ── Bloco J ──────────────────────────────────────────
          case 'J100':
            result.balanceSheet.push(
              this.parseJ100(fields, result.regI010?.layoutMajor ?? 9)
            );
            break;

          case 'J150':
            result.incomeStatement.push(
              this.parseJ150(fields, result.regI010?.layoutMajor ?? 9)
            );
            break;
        }
      } catch (err) {
        result.errors.push({ line: i + 1, record: reg, message: err.message });
      }
    }

    // Fecha contextos abertos
    if (currentPeriod) result.periods.push(currentPeriod);
    if (currentEntry)  result.journalEntries.push(currentEntry);

    // ── Determina contentType ─────────────────────────────────
    const hasAccounts  = result.regI050.length > 0;
    const hasBalances  = result.periods.length > 0;
    const hasJournal   = result.journalEntries.length > 0;

    if (hasAccounts && hasBalances && hasJournal) {
      result.contentType = 'FULL';
    } else if (hasAccounts && hasBalances) {
      result.contentType = 'BALANCES_ONLY';
    } else {
      result.contentType = 'STATEMENTS_ONLY';
    }

    this.logger.log(
      `ECD parsed [leiaute ${result.regI010?.layoutVersion ?? '?'}] ` +
      `contas=${result.regI050.length} ` +
      `períodos=${result.periods.length} ` +
      `lançamentos=${result.journalEntries.length} ` +
      `BP=${result.balanceSheet.length} ` +
      `DRE=${result.incomeStatement.length} ` +
      `tipo=${result.contentType} ` +
      `erros=${result.errors.length}`
    );

    return result;
  }

  // ── Parsers de registro ───────────────────────────────────────

  /**
   * |0000|LECD|DT_INI|DT_FIN|NOME|CNPJ|UF|IE|COD_MUN|TEL|FAX|IND_SIT|IND_FIN_ESC|IND_ESC_CONS|COD_HASH_SUB|...|
   * Posições idênticas em todos os leiautes.
   */
  private parse0000(f: string[]): EcdReg0000 {
    return {
      bookCode:        f[1] || '',   // LECD
      periodStart:     f[2] || '',   // ddmmaaaa
      periodEnd:       f[3] || '',   // ddmmaaaa
      companyName:     f[4] || '',
      cnpj:            f[5] || '',
      state:           f[6] || '',
      bookPurpose:     f[12] || '0',
      hashSubstituted: f[14] || '',
    };
  }

  /**
   * |I010|IND_ESC|COD_VER_LC|
   * Idêntico em todos os leiautes.
   */
  private parseI010(f: string[]): EcdRegI010 {
    const ver = f[2] || '9.00';
    const major = parseInt(ver.split('.')[0]) || 9;
    return {
      bookType:      f[1] || 'G',
      layoutVersion: ver,
      layoutMajor:   major,
    };
  }

  /**
   * Leiaute 4.00: |I030|NOME_LIVR|NUM_ORD|NAT_LIVR|QTD_LIN|...|CNPJ|...|DT_EX_SOCIAL|
   * Leiaute 9.00: |I030|NOME_LIVR|NUM_ORD|NAT_LIVR|QTD_LIN|...|CNPJ|...|DT_EX_SOCIAL|
   * Posições relevantes são as mesmas — mantemos índices conservadores.
   */
  private parseI030(f: string[], _layoutMajor: number): EcdRegI030 {
    return {
      bookNumber:  f[3] || '',
      bookNature:  f[4] || '',
      totalLines:  f[5] || '0',
      cnpj:        f[8] || '',
      closingDate: f[12] || '',
    };
  }

  /**
   * Leiaute 4.00 e 9.00 — mesma estrutura:
   * |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|CTA|
   *   f[0]  f[1]   f[2]   f[3]    f[4]   f[5]     f[6]      f[7]
   */
  private parseI050(f: string[]): EcdRegI050 {
    return {
      updateDate:  f[1] || '',
      natureCode:  f[2] || '',
      accountType: f[3] || 'A',
      level:       parseInt(f[4]) || 1,
      code:        f[5] || '',
      parentCode:  f[6] || '',
      name:        f[7] || '',
    };
  }

  /** |I150|DT_INI|DT_FIN| */
  private parseI150(f: string[]): EcdRegI150 {
    return {
      periodStart: f[1] || '',
      periodEnd:   f[2] || '',
    };
  }

  /**
   * |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
   *   f[0]  f[1]    f[2]      f[3]       f[4]      f[5]   f[6]     f[7]       f[8]
   */
  private parseI155(f: string[]): EcdRegI155 {
    return {
      accountCode:    f[1] || '',
      costCenter:     f[2] || '',
      openingBalance: this.parseDecimal(f[3]),
      openingSign:    f[4] || 'D',
      debit:          this.parseDecimal(f[5]),
      credit:         this.parseDecimal(f[6]),
      closingBalance: this.parseDecimal(f[7]),
      closingSign:    f[8] || 'D',
    };
  }

  /**
   * |I200|NUM_LCTO|DT_LCTO|VL_LCTO|IND_LCTO|
   *   f[0]  f[1]    f[2]     f[3]    f[4]
   */
  private parseI200(f: string[]): EcdRegI200 {
    return {
      entryNumber: f[1] || '',
      date:        f[2] || '',
      value:       this.parseDecimal(f[3]),
      type:        f[4] || 'N',
    };
  }

  /**
   * |I250|COD_CTA|COD_CCUS|VL_DC|IND_DC|NUM_ARQ|COD_HIST|HIST|
   *   f[0]  f[1]    f[2]    f[3]   f[4]   f[5]    f[6]    f[7]
   */
  private parseI250(f: string[]): EcdRegI250 {
    return {
      accountCode: f[1] || '',
      costCenter:  f[2] || '',
      value:       this.parseDecimal(f[3]),
      sign:        f[4] || 'D',
      docRef:      f[5] || '',
      history:     f[7] || f[6] || '',
    };
  }

  /**
   * J100 leiaute 4.00:
   * |J100|COD_CTA|NIVEL|IND_GRP_BAL|DESCR_CTA|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|
   *   f[0]  f[1]   f[2]    f[3]       f[4]       f[5]        f[6]       f[7]       f[8]
   *
   * J100 leiaute 9.00:
   * |J100|COD_AGL|NIVEL_AGL|IND_COD_AGL|IND_GRP_BAL|DESCR_COD_AGL|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|
   *   f[0]  f[1]    f[2]      f[3]         f[4]         f[5]          f[6]        f[7]       f[8]       f[9]
   *
   * Diferença: leiaute 9 insere IND_COD_AGL (f[3]) e empurra os demais +1.
   */
  private parseJ100(f: string[], layoutMajor: number): EcdRegJ100 {
    if (layoutMajor <= 4) {
      // leiautes 2, 3, 4
      return {
        code:         f[1] || '',
        level:        parseInt(f[2]) || 1,
        group:        f[3] || '1',
        description:  f[4] || '',
        openingValue: this.parseDecimal(f[5]),
        openingSign:  f[6] || 'D',
        closingValue: this.parseDecimal(f[7]),
        closingSign:  f[8] || 'D',
      };
    }
    // leiautes 5, 6, 7, 8, 9
    return {
      code:         f[1] || '',
      level:        parseInt(f[2]) || 1,
      group:        f[4] || '1',    // f[3] = IND_COD_AGL
      description:  f[5] || '',
      openingValue: this.parseDecimal(f[6]),
      openingSign:  f[7] || 'D',
      closingValue: this.parseDecimal(f[8]),
      closingSign:  f[9] || 'D',
    };
  }

  /**
   * J150 leiaute 4.00:
   * |J150|NU_ORDEM|COD_AGL|NIVEL_AGL|DESCR_COD_AGL|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|IND_GRP_DRE|
   *   f[0]  f[1]    f[2]     f[3]       f[4]          f[5]        f[6]       f[7]       f[8]       f[9]
   *
   * J150 leiaute 9.00: acrescenta IND_COD_AGL em f[3], empurra +1
   * |J150|NU_ORDEM|COD_AGL|NIVEL_AGL|IND_COD_AGL|DESCR_COD_AGL|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|IND_GRP_DRE|
   *   f[0]  f[1]    f[2]     f[3]       f[4]          f[5]         f[6]       f[7]       f[8]       f[9]       f[10]
   */
  private parseJ150(f: string[], layoutMajor: number): EcdRegJ150 {
    if (layoutMajor <= 4) {
      return {
        order:         parseInt(f[1]) || 0,
        code:          f[2] || '',
        level:         parseInt(f[3]) || 1,
        description:   f[4] || '',
        previousValue: this.parseDecimal(f[5]),
        previousSign:  f[6] || 'D',
        currentValue:  this.parseDecimal(f[7]),
        currentSign:   f[8] || 'D',
        groupDre:      f[9] || 'D',
      };
    }
    return {
      order:         parseInt(f[1]) || 0,
      code:          f[2] || '',
      level:         parseInt(f[3]) || 1,
      description:   f[5] || '',
      previousValue: this.parseDecimal(f[6]),
      previousSign:  f[7] || 'D',
      currentValue:  this.parseDecimal(f[8]),
      currentSign:   f[9] || 'D',
      groupDre:      f[10] || 'D',
    };
  }

  // ── Helpers públicos ──────────────────────────────────────────

  /** "1.234,56" ou "1234,56" → number */
  parseDecimal(value: string): number {
    if (!value || value.trim() === '') return 0;
    // Remove separador de milhar (ponto) e troca vírgula decimal por ponto
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }

  /** "ddmmaaaa" → Date (local) */
  parseDate(dateStr: string): Date {
    if (!dateStr || dateStr.length !== 8) {
      throw new Error(`Data inválida no formato ECD: "${dateStr}"`);
    }
    const d = parseInt(dateStr.substring(0, 2));
    const m = parseInt(dateStr.substring(2, 4));
    const y = parseInt(dateStr.substring(4, 8));
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) throw new Error(`Data inexistente: ${dateStr}`);
    return date;
  }

  /** D/C → 'DEBIT' | 'CREDIT' */
  toAccountNature(sign: string): 'DEBIT' | 'CREDIT' {
    return sign?.toUpperCase() === 'C' ? 'CREDIT' : 'DEBIT';
  }

  /** COD_NAT → AccountType do LEDGR */
  toAccountType(natureCode: string): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
    switch (natureCode) {
      case '01': return 'ASSET';
      case '02': return 'LIABILITY';
      case '03': return 'EQUITY';
      case '04': return 'REVENUE';  // refinado no importer por nome da conta
      case '05': return 'ASSET';    // compensação
      default:   return 'ASSET';
    }
  }

  /** Saldo com sinal D/C → número com sinal contábil (+débito, -crédito) */
  toSignedBalance(value: number, sign: string): number {
    return sign?.toUpperCase() === 'C' ? -Math.abs(value) : Math.abs(value);
  }
}