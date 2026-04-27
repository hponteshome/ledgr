// apps/api/src/modules/sped/ecd/ecd-validator.service.ts

import { Injectable } from '@nestjs/common';
import { EcdParsed } from './ecd-parser.service';


// ── Interface de resultado da validação ───────────────────────
export interface EcdValidationResult {
  valid: boolean;
  errors: Array<{ code: string; block: string; message: string; severity: 'error' | 'warning' }>;
  fileInfo?: {
    cnpj:        string;
    companyName: string;
    periodStart: string; // ddmmaaaa
    periodEnd:   string; // ddmmaaaa
    bookType:    string;
    bookNumber:  string;
  };
}

@Injectable()
export class EcdValidatorService {

  validate(parsed: EcdParsed, companyCnpj: string): EcdValidationResult {
    const errors: EcdValidationResult['errors'] = [];

    // ── Bloco 0 ───────────────────────────────────────────────────
    if (!parsed.reg0000) {
      errors.push({ code: 'E001', block: '0000', message: 'Registro 0000 não encontrado. Arquivo inválido.', severity: 'error' });
      return { valid: false, errors };
    }

    // CNPJ
    const fileCnpj = parsed.reg0000.cnpj.replace(/\D/g, '');
    const expCnpj = companyCnpj.replace(/\D/g, '');
    if (fileCnpj !== expCnpj) {
      errors.push({
        code: 'E002', block: '0000',
        message: `CNPJ do arquivo (${fileCnpj}) difere da empresa ativa (${expCnpj}).`,
        severity: 'error',
      });
    }

    // Período
    if (!parsed.reg0000.periodStart || !parsed.reg0000.periodEnd) {
      errors.push({ code: 'E003', block: '0000', message: 'Período da escrituração não informado.', severity: 'error' });
    }

    // ── Bloco I ───────────────────────────────────────────────────
    if (!parsed.regI010) {
      errors.push({ code: 'E010', block: 'I010', message: 'Registro I010 não encontrado.', severity: 'error' });
    } else {
      const validBookTypes = ['G', 'R', 'A', 'B', 'Z'];
      if (!validBookTypes.includes(parsed.regI010.bookType)) {
        errors.push({
          code: 'E011', block: 'I010',
          message: `Tipo de escrituração inválido: "${parsed.regI010.bookType}". Válidos: ${validBookTypes.join(', ')}.`,
          severity: 'error',
        });
      }
    }

    if (!parsed.regI030) {
      errors.push({ code: 'E012', block: 'I030', message: 'Termo de abertura (I030) não encontrado.', severity: 'warning' });
    }

    // Plano de contas
    if (parsed.regI050.length === 0) {
      errors.push({ code: 'E020', block: 'I050', message: 'Plano de contas vazio (nenhum registro I050).', severity: 'warning' });
    } else {
      // Valida hierarquia: pai deve existir antes do filho
      const codes = new Set(parsed.regI050.map(a => a.code));
      for (const acc of parsed.regI050) {
        if (acc.parentCode && !codes.has(acc.parentCode)) {
          errors.push({
            code: 'E021', block: 'I050',
            message: `Conta "${acc.code}" referencia pai "${acc.parentCode}" que não existe no arquivo.`,
            severity: 'warning',
          });
        }
      }

      // Valida mínimo de 4 níveis para contas patrimoniais (exigência SPED)
      const analyticPatrimonial = parsed.regI050.filter(
        a => a.accountType === 'A' && ['01', '02', '03'].includes(a.natureCode)
      );
      const maxLevel = Math.max(...analyticPatrimonial.map(a => a.level), 0);
      if (analyticPatrimonial.length > 0 && maxLevel < 4) {
        errors.push({
          code: 'W021', block: 'I050',
          message: `O CTG 2001 exige mínimo de 4 níveis para contas patrimoniais. Máximo encontrado: ${maxLevel}.`,
          severity: 'warning',
        });
      }
    }

    // Saldos
    if (parsed.periods.length === 0) {
      errors.push({ code: 'W030', block: 'I150', message: 'Nenhum período de saldos encontrado (I150/I155).', severity: 'warning' });
    } else {
      for (const { period, balances } of parsed.periods) {
        if (balances.length === 0) {
          errors.push({
            code: 'W031', block: 'I155',
            message: `Período ${period.periodStart}-${period.periodEnd} sem saldos (I155).`,
            severity: 'warning',
          });
        }

        // Valida balanceamento: soma débitos = soma créditos (para cada período)
        const totalDebit = balances.reduce((s, b) => {
          return b.openingSign === 'D' ? s + b.openingBalance : s - b.openingBalance;
        }, 0);
        if (Math.abs(totalDebit) > 0.01) {
          errors.push({
            code: 'W032', block: 'I155',
            message: `Período ${period.periodStart}: saldos iniciais desequilibrados (diferença: ${totalDebit.toFixed(2)}).`,
            severity: 'warning',
          });
        }
      }
    }

    // Lançamentos
    for (const { entry, items } of parsed.journalEntries) {
      if (items.length < 2) {
        errors.push({
          code: 'W040', block: 'I250',
          message: `Lançamento ${entry.entryNumber} com menos de 2 partidas.`,
          severity: 'warning',
        });
        continue;
      }

      // Valida partidas balanceadas
      const totalDebit = items.filter(i => i.sign === 'D').reduce((s, i) => s + i.value, 0);
      const totalCredit = items.filter(i => i.sign === 'C').reduce((s, i) => s + i.value, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        errors.push({
          code: 'W041', block: 'I250',
          message: `Lançamento ${entry.entryNumber} desbalanceado: D=${totalDebit.toFixed(2)} C=${totalCredit.toFixed(2)}.`,
          severity: 'warning',
        });
      }
    }

    // Erros de parse originais
    for (const e of parsed.errors) {
      errors.push({
        code: 'P001', block: e.record,
        message: `Linha ${e.line}: ${e.message}`,
        severity: 'warning',
      });
    }

// ── Retorno final ─────────────────────────────────────────────
const hasBlockingError = errors.some(e => e.severity === 'error');
return {
  valid: !hasBlockingError,
  errors,
  fileInfo: parsed.reg0000 ? {
    cnpj:        parsed.reg0000.cnpj.replace(/\D/g, ''),
    companyName: parsed.reg0000.companyName,
    periodStart: parsed.reg0000.periodStart,
    periodEnd:   parsed.reg0000.periodEnd,
    bookType:    parsed.regI010?.bookType   || '',
    bookNumber:  parsed.regI030?.bookNumber || '',
  } : undefined,
};
  }
}