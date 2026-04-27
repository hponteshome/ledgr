// apps/api/src/modules/accounting/services/iob-plano-parser.service.ts
import { Injectable } from '@nestjs/common';

export interface IobPlanoRecord {
  classification: string;  // pos 1-20: codigo ECD sem pontos
  reducedCode:    string;  // pos 22-27: codigo reduzido IOB (6 digitos com DV)
  description:    string;  // pos 28-127: nome da conta
  grade:          number;  // pos 128: grau/nivel
  type:           string;  // pos 129-133: tipo DRE (RB, DO, DR, etc)
  nature:         string;  // pos 134: D ou C
  balance:        number;  // pos 135-146: saldo sem decimais / 100
  balanceSign:    string;  // pos 147: + ou -
  spedRef:        string;  // pos 171-220: plano referencial ECD/ECF
}

export interface IobPlanoParsed {
  records:    IobPlanoRecord[];
  errors:     Array<{ line: number; message: string }>;
  totalLines: number;
}

@Injectable()
export class IobPlanoParserService {
  parse(fileContent: string): IobPlanoParsed {
    const lines = fileContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    const records: IobPlanoRecord[] = [];
    const errors:  Array<{ line: number; message: string }> = [];

    lines.forEach((line, idx) => {
      try {
        // Linhas com menos de 27 caracteres nao tem reduzida — ignorar
        if (line.length < 27) return;

        const classification = line.substring(0, 20).trim();
        const reducedCode    = line.substring(21, 27).trim();
        const description    = line.substring(27, 127).trim();
        const grade          = parseInt(line.substring(127, 128)) || 0;
        const type           = line.length > 133 ? line.substring(128, 133).trim() : '';
        const nature         = line.length > 133 ? line.substring(133, 134).trim() : '';
        const balanceRaw     = line.length > 146 ? line.substring(134, 146).trim() : '0';
        const balanceSign    = line.length > 146 ? line.substring(146, 147).trim() : '+';
        const spedRef        = line.length > 220 ? line.substring(170, 220).trim() : '';

        if (!classification || !reducedCode) return;
        // Ignorar contas sinteticas sem reduzida (0000000)
        if (reducedCode === '0000000' || reducedCode === '000000') return;

        const balanceInt = parseInt(balanceRaw.replace(/\s/g, '')) || 0;
        const balance    = (balanceSign === '-' ? -1 : 1) * balanceInt / 100;

        records.push({
          classification,
          reducedCode,
          description,
          grade,
          type,
          nature,
          balance,
          balanceSign,
          spedRef,
        });
      } catch (e: any) {
        errors.push({ line: idx + 1, message: e.message });
      }
    });

    return { records, errors, totalLines: lines.length };
  }
}
