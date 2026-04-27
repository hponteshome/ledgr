// apps/api/src/modules/sped/ecf/ecf-validator.service.ts
import { Injectable } from '@nestjs/common'; // <--- ADICIONE ESTA LINHA
import { EcfParsed } from './ecf-parser.service';

@Injectable()
export class EcfValidatorService {
  validate(parsed: any, companyCnpj: string) {
    const errors = [];
    
    if (!parsed.reg0000) {
      errors.push({ code: 'E001', message: 'Registro 0000 não encontrado.', severity: 'error' });
      return { valid: false, errors };
    }

    const fileCnpj = parsed.reg0000.cnpj.replace(/\D/g, '');
    const expCnpj = companyCnpj.replace(/\D/g, '');

    if (fileCnpj !== expCnpj) {
      errors.push({ 
        code: 'E002', 
        message: `CNPJ do arquivo (${fileCnpj}) diverge da empresa selecionada (${expCnpj}).`, 
        severity: 'error' 
      });
    }

    return {
      valid: !errors.some(e => e.severity === 'error'),
      errors,
      fileInfo: parsed.reg0000
    };
  }
}