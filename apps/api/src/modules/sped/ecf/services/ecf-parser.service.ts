// src/modules/sped/ecf/services/ecf-parser.service.ts
import { Injectable } from '@nestjs/common';

export interface EcfAccount {
  codCta: string;
  dtAlt: string;
  codCcus: string;
  indCta: string;
  nivel: number;
  codCtaMae: string;
  nomeCta: string;
  codCtaRef?: string;
}

export interface EcfBalance {
  codCta: string;
  codCcus: string;
  vlSldIni: number;
  indSldIni: string;
  vlDeb: number;
  vlCred: number;
  vlSldFin: number;
  indSldFin: string;
}

export interface EcfPeriod {
  dtIni: string;
  dtFin: string;
  perApur: string;
  accounts: EcfAccount[];
  balances: EcfBalance[];
}

export interface EcfLalurEntry {
  codCta: string;
  indProcJud: string;
  descLanc: string;
  dtLanc: string;
  vlLanc: number;
  indLancLalur: string;
  indRec: string;
}

export interface EcfTaxCalc {
  perApur: string;
  vlLucroReal?: number;
  vlPrejAcomp?: number;
  vlPrejPer?: number;
  vlBaseIrpj?: number;
  vlIrpj?: number;
  vlAdicIrpj?: number;
  vlDeducoes?: number;
  vlIrpjDev?: number;
  vlBaseCs?: number;
  vlCsll?: number;
}

export interface EcfParsed {
  reg0000: any;
  reg0030?: any;
  fileInfo?: any;
  periodStart: string;
  periodEnd: string;
  accounts: EcfAccount[];
  periods: EcfPeriod[];
  lalurParteA: EcfLalurEntry[];
  taxCalcs: EcfTaxCalc[];
  socios: any[];
  journalEntries: string[];
  registrosParteA?: string[];
  registrosParteB?: string[];
  errors: any[];
}

@Injectable()
export class EcfParserService {
  async parse(content: string): Promise<EcfParsed> {
    const lines = content.split('\n').filter(l => l.trim() && l.startsWith('|'));
    const result: EcfParsed = {
      reg0000: null, reg0030: null, fileInfo: null,
      periodStart: '', periodEnd: '',
      accounts: [], periods: [], lalurParteA: [],
      taxCalcs: [], socios: [],
      journalEntries: [], registrosParteA: [], registrosParteB: [],
      errors: [],
    };
    let currentKPeriod: EcfPeriod | null = null;
    let currentTaxCalc: EcfTaxCalc | null = null;
    const lastJ050CodCta: { codCta: string } = { codCta: '' };

    for (const line of lines) {
      const f = line.split('|');
      const rec = f[1]?.trim();
      if (!rec) continue;
      try {
        switch (rec) {

          case '0000': {
            const cnpj = f[4]?.trim() ?? '';
            const nome = f[5]?.trim() ?? '';
            const dtIni = f[9]?.trim() ?? '';
            const dtFin = f[10]?.trim() ?? '';
            result.reg0000 = { cnpj, companyName: nome, periodStart: dtIni, periodEnd: dtFin };
            result.periodStart = dtIni;
            result.periodEnd = dtFin;
            result.fileInfo = { cnpj, companyName: nome, periodStart: dtIni, periodEnd: dtFin, bookNumber: '1', bookType: 'ECF' };
            break;
          }

          case '0030': {
            result.reg0030 = { codIncTrib: f[2]?.trim()??''  , indRefPj: f[3]?.trim()??''  , indAtiv: f[4]?.trim()??''   };
            break;
          }

          case 'J050': {
            const account: EcfAccount = {
              dtAlt: f[2]?.trim()??''  , codCcus: f[3]?.trim()??''  , indCta: f[4]?.trim()??''  ,
              nivel: parseInt(f[5]??'0',10), codCta: f[6]?.trim()??''  ,
              codCtaMae: f[7]?.trim()??''  , nomeCta: f[8]?.trim()??''  ,
            };
            result.accounts.push(account);
            lastJ050CodCta.codCta = account.codCta;
            break;
          }

          case 'J051': {
            const codRef = f[3]?.trim()??f[2]?.trim()??''  ;
            if (lastJ050CodCta.codCta && result.accounts.length > 0)
              result.accounts[result.accounts.length-1].codCtaRef = codRef;
            break;
          }

          case 'K030': {
            currentKPeriod = { dtIni: f[2]?.trim()??''  , dtFin: f[3]?.trim()??''  , perApur: f[4]?.trim()??''  , accounts: [], balances: [] };
            result.periods.push(currentKPeriod);
            break;
          }

          case 'K155': {
            if (!currentKPeriod) break;
            currentKPeriod.balances.push({
              codCta: f[2]?.trim()??''  , codCcus: f[3]?.trim()??''  ,
              vlSldIni: this.parseDecimal(f[4]), indSldIni: f[5]?.trim()??'D'  ,
              vlDeb: this.parseDecimal(f[6]), vlCred: this.parseDecimal(f[7]),
              vlSldFin: this.parseDecimal(f[8]), indSldFin: f[9]?.trim()??'D'  ,
            });
            break;
          }

          case 'K355': {
            if (!currentKPeriod) break;
            currentKPeriod.balances.push({
              codCta: f[2]?.trim()??''  , codCcus: f[3]?.trim()??''  ,
              vlSldIni: 0, indSldIni: 'D'  , vlDeb: 0, vlCred: 0,
              vlSldFin: this.parseDecimal(f[4]), indSldFin: f[5]?.trim()??'D'  ,
            });
            break;
          }

          case 'M300': {
            result.lalurParteA.push({
              codCta: f[2]?.trim()??''  , indProcJud: f[3]?.trim()??''  ,
              descLanc: f[4]?.trim()??''  , dtLanc: f[5]?.trim()??''  ,
              vlLanc: this.parseDecimal(f[6]),
              indLancLalur: f[7]?.trim()??''  , indRec: f[8]?.trim()??''  ,
            });
            result.registrosParteA!.push(line);
            break;
          }

          case 'M350': { result.registrosParteB!.push(line); break; }

          case 'N030': {
            currentTaxCalc = { perApur: f[4]?.trim()??''   };
            result.taxCalcs.push(currentTaxCalc);
            break;
          }

          case 'N500': {
            if (!currentTaxCalc) break;
            currentTaxCalc.vlLucroReal = this.parseDecimal(f[3]);
            currentTaxCalc.vlPrejAcomp = this.parseDecimal(f[4]);
            currentTaxCalc.vlBaseIrpj  = this.parseDecimal(f[7]??f[6]);
            break;
          }

          case 'N620': { result.journalEntries.push(line); break; }

          case 'N630': {
            if (!currentTaxCalc) break;
            currentTaxCalc.vlIrpj     = this.parseDecimal(f[3]);
            currentTaxCalc.vlAdicIrpj = this.parseDecimal(f[4]);
            currentTaxCalc.vlDeducoes = this.parseDecimal(f[5]);
            currentTaxCalc.vlIrpjDev  = this.parseDecimal(f[9]??f[8]);
            break;
          }

          case 'N650': {
            if (!currentTaxCalc) break;
            currentTaxCalc.vlBaseCs = this.parseDecimal(f[4]??f[3]);
            break;
          }

          case 'N660': { result.journalEntries.push(line); break; }

          case 'N670': {
            if (!currentTaxCalc) break;
            currentTaxCalc.vlCsll = this.parseDecimal(f[3]);
            break;
          }

          case 'Y600': {
            result.socios.push({ cpfCnpj: f[2]?.trim()??''  , nome: f[3]?.trim()??''  , indRelacao: f[4]?.trim()??''  , vlLucros: this.parseDecimal(f[9]??'0'  ) });
            break;
          }

          case '0001': case '0990':
          case 'C001': case 'C990':
          case 'E001': case 'E990':
          case 'J001': case 'J990':
          case 'K001': case 'K990':
          case 'L001': case 'L990':
          case 'M001': case 'M990':
          case 'N001': case 'N990':
          case 'P001': case 'P990':
          case 'Q001': case 'Q990':
          case 'T001': case 'T990':
          case 'U001': case 'U990':
          case 'W001': case 'W990':
          case 'X001': case 'X990':
          case 'Y001': case 'Y990':
          case '9001': case '9099': case '9100': case '9900': case '9999':
            break;

          default: break;
        }
      } catch (err: any) {
        result.errors.push({ record: rec, line, error: err?.message??String(err) });
      }
    }
    return result;
  }

  private parseDecimal(raw: string | undefined): number {
    if (!raw) return 0;
    const val = parseFloat(raw.trim().replace(',', '.'));
    return isNaN(val) ? 0 : val;
  }
}


