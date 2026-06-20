import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface NfeParsed {
  chave:        string;   // 44 digitos
  numero:       string;
  serie:        string;
  dataEmissao:  string;   // YYYY-MM-DD
  competencia:  string;   // YYYY-MM
  natOp:        string;
  emitenteCnpj: string;
  emitenteNome: string;
  destinCnpj:   string;
  destinNome:   string;
  valorNF:      number;
  valorPis:     number;
  valorCofins:  number;
  valorIpi:     number;
  valorIcms:    number;
  valorFrete:   number;
  valorDesconto:number;
  mode:         'ENTRADA' | 'SAIDA' | 'DESCONHECIDO';
}

@Injectable()
export class NfeParserService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
    isArray: (n) => ['nfeProc','NFe','det'].includes(n),
  });

  private clean(v: any) { return String(v??'').replace(/\D/g,''); }
  private num(v: any)   { return parseFloat(String(v??'0').replace(',','.')) || 0; }
  private date(v: any)  { return String(v??'').slice(0,10); }

  parseXml(xml: string, companyCnpj: string): NfeParsed[] {
    const obj = this.parser.parse(xml);
    const results: NfeParsed[] = [];
    const cnpjClean = this.clean(companyCnpj);

    // Suporta nfeProc (com protocolo) e NFe direta
    const procs: any[] = obj?.nfeProc ?? (obj?.NFe ? [{ NFe: obj.NFe }] : []);

    for (const proc of procs) {
      const nfe  = proc?.NFe ?? proc;
      const inf  = nfe?.infNFe ?? nfe;
      if (!inf) continue;

      const ide   = inf?.ide ?? {};
      const emit  = inf?.emit ?? {};
      const dest  = inf?.dest ?? {};
      const total = inf?.total?.ICMSTot ?? {};
      const transp = inf?.transp ?? {};

      const emitCnpj = this.clean(emit?.CNPJ ?? emit?.CPF ?? '');
      const destinCnpj = this.clean(dest?.CNPJ ?? dest?.CPF ?? '');

      let mode: 'ENTRADA'|'SAIDA'|'DESCONHECIDO' = 'DESCONHECIDO';
      if (destinCnpj === cnpjClean) mode = 'ENTRADA';
      else if (emitCnpj === cnpjClean) mode = 'SAIDA';

      // chave da NF-e: de protNFe ou de infNFe Id
      const chave = this.clean(
        proc?.protNFe?.infProt?.chNFe
        ?? inf?.['@_Id']?.replace('NFe','')
        ?? ''
      ).slice(0,44);

      const dataEmissao = this.date(ide?.dhEmi ?? ide?.dEmi);
      const competencia = dataEmissao.slice(0,7);

      results.push({
        chave,
        numero:        String(ide?.nNF ?? ''),
        serie:         String(ide?.serie ?? ''),
        dataEmissao,
        competencia,
        natOp:         String(ide?.natOp ?? ''),
        emitenteCnpj:  emitCnpj,
        emitenteNome:  String(emit?.xNome ?? ''),
        destinCnpj,
        destinNome:    String(dest?.xNome ?? ''),
        valorNF:       this.num(total?.vNF ?? total?.vProd),
        valorPis:      this.num(total?.vPIS),
        valorCofins:   this.num(total?.vCOFINS),
        valorIpi:      this.num(total?.vIPI),
        valorIcms:     this.num(total?.vICMS),
        valorFrete:    this.num(total?.vFrete ?? transp?.modFrete),
        valorDesconto: this.num(total?.vDesc),
        mode,
      });
    }
    return results;
  }
}
