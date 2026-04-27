import { Injectable } from '@nestjs/common';
import * as ofx from 'ofx-js'; 

@Injectable()
export class BankImportService {
  async parseOfx(fileBuffer: Buffer) {
    const ofxString = fileBuffer.toString();
    
    // O ofx-js retorna uma Promise com o objeto parseado
    const data = await ofx.parse(ofxString);
    
    // Navegando na estrutura padrão do OFX
    const transactions = data.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

    // Garantir que seja um array (se houver só 1 transação, o parser pode retornar objeto único)
    const transArray = Array.isArray(transactions) ? transactions : [transactions];

    return transArray.map((tr) => ({
      id: tr.FITID,
      date: this.parseOfxDate(tr.DTPOSTED),
      amount: parseFloat(tr.TRNAMT),
      description: tr.MEMO || tr.NAME,
      type: tr.TRNTYPE, // DEBIT ou CREDIT no arquivo
    }));
  }

  private parseOfxDate(dateStr: string): Date {
    // Ex: 20260312120000
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }
}