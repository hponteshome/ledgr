// apps/api/src/modules/sped/ecf/services/ecf-validator.service.ts
import { Injectable } from '@nestjs/common';
import { EcfParsed } from './ecf-parser.service';

export interface EcfValidationResult {
  valid: boolean;
  errors: Array<{ code: string; block: string; message: string; severity: 'error' | 'warning' }>;
  fileInfo?: {
    cnpj: string;
    companyName: string;
    periodStart: string;
    periodEnd: string;
    bookType: string;
    bookNumber: string;
  };
}

@Injectable()
export class EcfValidatorService {
  validate(parsed: EcfParsed, companyCnpj: string): EcfValidationResult {
    const errors: EcfValidationResult['errors'] = [];

    // ── Bloco 0 ───────────────────────────────────────────────────
    if (!parsed.reg0000) {
      errors.push({ code: 'E001', block: '0000', message: 'Registro 0000 não encontrado.', severity: 'error' });
      return { valid: false, errors };
    }

    const fileCnpj = (parsed.reg0000.cnpj || '').replace(/\D/g, '');
    const expCnpj = (companyCnpj || '').replace(/\D/g, '');
    if (fileCnpj !== expCnpj) {
      errors.push({
        code: 'E002', block: '0000',
        message: `CNPJ do arquivo (${fileCnpj}) diverge da empresa selecionada (${expCnpj}).`,
        severity: 'error',
      });
    }

    if (!parsed.periodStart || !parsed.periodEnd) {
      errors.push({ code: 'E003', block: '0000', message: 'Período da escrituração não informado.', severity: 'error' });
    }

    // ── Bloco J (plano de contas referencial) ────────────────────
    if (parsed.accounts.length === 0) {
      errors.push({ code: 'W020', block: 'J050', message: 'Plano de contas vazio (nenhum registro J050).', severity: 'warning' });
    } else {
      const codes = new Set(parsed.accounts.map(a => a.codCta));
      for (const acc of parsed.accounts) {
        if (acc.codCtaMae && !codes.has(acc.codCtaMae)) {
          errors.push({
            code: 'W021', block: 'J050',
            message: `Conta "${acc.codCta}" referencia pai "${acc.codCtaMae}" que não existe no arquivo.`,
            severity: 'warning',
          });
        }
      }
    }

    // ── Bloco K (períodos e saldos trimestrais) ──────────────────
    if (parsed.periods.length === 0) {
      errors.push({ code: 'W030', block: 'K030', message: 'Nenhum período de saldos encontrado (K030/K155).', severity: 'warning' });
    } else {
      for (const period of parsed.periods) {
        if (period.balances.length === 0) {
          errors.push({
            code: 'W031', block: 'K155',
            message: `Período ${period.perApur} (${period.dtIni}-${period.dtFin}) sem saldos (K155).`,
            severity: 'warning',
          });
          continue;
        }
        const totalDebit = period.balances.reduce((s, b) => s + (b.indSldIni === 'D' ? b.vlSldIni : -b.vlSldIni), 0);
        if (Math.abs(totalDebit) > 0.01) {
          errors.push({
            code: 'W032', block: 'K155',
            message: `Período ${period.perApur}: saldos iniciais desequilibrados (diferença: ${totalDebit.toFixed(2)}).`,
            severity: 'warning',
          });
        }
      }
    }

    // ── Erros de parse originais ──────────────────────────────────
    for (const e of parsed.errors) {
      errors.push({
        code: 'P001', block: e.record,
        message: `Linha ${e.line}: ${e.error}`,
        severity: 'warning',
      });
    }

    const hasBlockingError = errors.some(e => e.severity === 'error');
    return {
      valid: !hasBlockingError,
      errors,
      fileInfo: {
        cnpj: fileCnpj,
        companyName: parsed.reg0000.companyName || '',
        periodStart: parsed.periodStart || '',
        periodEnd: parsed.periodEnd || '',
        bookType: 'ECF',
        bookNumber: parsed.reg0030?.bookNumber || '1',
      },
    };
  }
}
