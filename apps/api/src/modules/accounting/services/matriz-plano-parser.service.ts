// apps/api/src/modules/accounting/services/matriz-plano-parser.service.ts
import { Injectable } from '@nestjs/common';

export interface MatrizPlanoRecord {
  classification: string;  // pos 1-20: codigo ECD sem pontos
  reducedCode:    string;  // pos 22-27: codigo reduzido (6 digitos com DV)
  description:    string;  // pos 28-127: nome da conta
  grade:          number;  // pos 128: grau/nivel
  type:           string;  // pos 129-133: tipo DRE (RB, DO, DR, etc)
  nature:         string;  // pos 134: D ou C
  balance:        number;  // pos 135-146: saldo sem decimais / 100
  balanceSign:    string;  // pos 147: + ou -
  spedRef:        string;  // pos 171-220: plano referencial ECD/ECF
  bloco:          string;  // CRIADO 24/08/2026: "NUCLEO" (sempre importado) ou
                            // identificador de bloco opcional (ex: "HOTELARIA"),
                            // lido de linhas marcadoras "### BLOCO: <NOME>" no
                            // arquivo mestre. Ver MatrizImportService.importPlano.
}

export interface MatrizPlanoParsed {
  records:    MatrizPlanoRecord[];
  blocos:     string[]; // lista de blocos opcionais encontrados no arquivo (exclui NUCLEO)
  errors:     Array<{ line: number; message: string }>;
  totalLines: number;
}

const BLOCO_MARKER = /^###\s*BLOCO:\s*(\S+)/i;
const BLOCO_NUCLEO = 'NUCLEO';

@Injectable()
export class MatrizPlanoParserService {
  parse(fileContent: string): MatrizPlanoParsed {
    const lines = fileContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    const records: MatrizPlanoRecord[] = [];
    const errors:  Array<{ line: number; message: string }> = [];
    const blocosVistos = new Set<string>();

    let blocoAtual = BLOCO_NUCLEO;

    lines.forEach((line, idx) => {
      try {
        // CRIADO 24/08/2026: linha marcadora de bloco opcional - nao vira
        // registro, so muda o bloco corrente para as linhas seguintes.
        const marker = line.trim().match(BLOCO_MARKER);
        if (marker) {
          blocoAtual = marker[1].toUpperCase();
          blocosVistos.add(blocoAtual);
          return;
        }

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

        if (!classification) return;

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
          bloco: blocoAtual,
        });
      } catch (e: any) {
        errors.push({ line: idx + 1, message: e.message });
      }
    });

    return { records, blocos: Array.from(blocosVistos), errors, totalLines: lines.length };
  }
}
