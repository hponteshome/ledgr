// apps/api/src/modules/accounting/services/iob-lotd-parser.service.ts
import { Injectable } from '@nestjs/common';

export interface LotdHeader {
  batchType:   string;  // D=Diario M=Mensal A=Anual
  date:        string;  // DDMMAAAA
  total:       number;
  description: string;
  origin:      string;
  identifier:  string;
  situation:   string;  // L=Liberado N=Nao Liberado
  cnpj:        string;
}

export interface LotdEntry {
  date:          string;  // DDMMAAAA (zerado se Diario)
  debitAccount:  string;  // 6 digitos conta reduzida debito
  creditAccount: string;  // 6 digitos conta reduzida credito
  historyCode:   string;  // 3 digitos
  complement:    string;  // 25 chars
  value:         number;  // valor / 100
  costCenter:    string;
  classDeb:      string;
  classCred:     string;
  sequence:      number;
  observation:   string;
  identifier:    string;  // identificador de contrapartida (pos 201-232)
}

export interface LotdParsed {
  header:  LotdHeader | null;
  entries: LotdEntry[];
  errors:  Array<{ line: number; message: string }>;
  totalLines: number;
}

@Injectable()
export class IobLotdParserService {
  parse(fileContent: string): LotdParsed {
    const lines = fileContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    let header:  LotdHeader | null = null;
    const entries: LotdEntry[]     = [];
    const errors:  Array<{ line: number; message: string }> = [];

    lines.forEach((line, idx) => {
      try {
        const type = line.substring(0, 1);

        if (type === 'C') {
          header = {
            batchType:   line.substring(1, 2).trim(),
            date:        line.substring(2, 10).trim(),
            total:       this.parseDecimal(line.substring(10, 27)),
            description: line.substring(25, 45).trim(),
            origin:      line.substring(45, 48).trim(),
            identifier:  line.substring(48, 58).trim(),
            situation:   line.substring(58, 59).trim(),
            cnpj:        line.substring(59, 73).trim(),
          };
          return;
        }

        if (type === 'L') {
          const date         = line.substring(1, 9).trim();
          const debitAccount = line.substring(9, 15).trim();
          const creditAccount= line.substring(15, 21).trim();
          const historyCode  = line.substring(21, 24).trim();
          const complement   = line.substring(24, 49).trim();
          const valueRaw     = line.substring(49, 64).trim();
          const costCenter   = line.substring(64, 67).trim();
          const classDeb     = line.substring(67, 81).trim();
          const classCred    = line.substring(81, 95).trim();
          const sequence     = parseInt(line.substring(95, 100)) || 0;

          // Campos opcionais apos posicao 100
          let observation = '';
          let identifier  = '';
          if (line.length > 232) {
            observation = line.substring(232, Math.min(422, line.length)).trim();
          }
          if (line.length > 422) {
            identifier = line.substring(422, Math.min(454, line.length)).trim();
          }

          const value = this.parseDecimal(valueRaw);

          if (!debitAccount && !classDeb) return;
          if (!creditAccount && !classCred) return;

          entries.push({
            date, debitAccount, creditAccount,
            historyCode, complement, value,
            costCenter, classDeb, classCred,
            sequence, observation, identifier,
          });
        }
      } catch (e: any) {
        errors.push({ line: idx + 1, message: e.message });
      }
    });

    return { header, entries, errors, totalLines: lines.length };
  }

  parseDate(ddmmaaaa: string): Date {
    if (!ddmmaaaa || ddmmaaaa === '00000000') return new Date();
    const dd = ddmmaaaa.substring(0, 2);
    const mm = ddmmaaaa.substring(2, 4);
    const yy = ddmmaaaa.substring(4, 8);
    return new Date(Date.UTC(parseInt(yy), parseInt(mm) - 1, parseInt(dd)));
  }

  private parseDecimal(raw: string): number {
    const clean = (raw ?? '').replace(/\s/g, '');
    if (!clean || clean === '') return 0;
    return parseInt(clean) / 100;
  }
}
