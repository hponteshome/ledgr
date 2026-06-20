import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface NfseParsed {
  numero:              string;
  codigoVerificacao:   string;
  dataEmissao:         string;
  competencia:         string;          // YYYY-MM
  prestadorCnpj:       string;
  prestadorNome:       string;
  tomadorCnpj:         string;
  tomadorNome:         string;
  tomadorEmail?:       string;
  discriminacao:       string;
  itemListaServico:    string;
  valorServicos:       number;
  valorDeducoes:       number;
  valorPis:            number;
  valorCofins:         number;
  valorInss:           number;
  valorIr:             number;
  valorCsll:           number;
  issRetido:           boolean;
  valorIss:            number;
  aliquotaIss:         number;
  valorLiquido:        number;
  mode:                'PRESTADOR' | 'TOMADOR' | 'DESCONHECIDO';
}

@Injectable()
export class NfseSpParserService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
    isArray: (name) => ['CompNfse','Nfse'].includes(name),
  });

  private clean(cnpj: any): string {
    return String(cnpj ?? '').replace(/\D/g, '');
  }

  private num(v: any): number {
    return parseFloat(String(v ?? '0').replace(',', '.')) || 0;
  }

  private getCnpj(id: any): string {
    const cpfCnpj = id?.CpfCnpj ?? id?.cpfCnpj ?? {};
    return this.clean(cpfCnpj?.Cnpj ?? cpfCnpj?.Cpf ?? '');
  }

  parseXml(xml: string, companyCnpj: string): NfseParsed[] {
    const obj = this.parser.parse(xml);
    const results: NfseParsed[] = [];

    // Suporta envelope ListaNfse, ConsultarNfseResposta, CompNfse direto
    const root = obj?.ListaNfse ?? obj?.ConsultarNfseResposta?.ListaNfse
      ?? obj?.ConsultaNfseResposta?.ListaNfse ?? obj;

    const comps: any[] = root?.CompNfse ?? (root?.Nfse ? [{ Nfse: root.Nfse }] : []);

    for (const comp of comps) {
      const nfse = comp?.Nfse ?? comp;
      const inf  = nfse?.InfNfse ?? nfse;
      if (!inf) continue;

      const servico  = inf?.Servico ?? inf?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico ?? {};
      const valores  = servico?.Valores ?? {};
      const prest    = inf?.PrestadorServico ?? {};
      const tom      = inf?.TomadorServico ?? {};

      const prestCnpj = this.getCnpj(prest?.IdentificacaoPrestador ?? prest?.Identificacao);
      const tomadorCnpj = this.getCnpj(tom?.IdentificacaoTomador ?? tom?.Identificacao);
      const cnpjClean = this.clean(companyCnpj);

      let mode: 'PRESTADOR' | 'TOMADOR' | 'DESCONHECIDO' = 'DESCONHECIDO';
      if (prestCnpj === cnpjClean) mode = 'PRESTADOR';
      else if (tomadorCnpj === cnpjClean) mode = 'TOMADOR';

      const dataEmissao = String(inf?.DataEmissao ?? inf?.Competencia ?? '').slice(0, 10);
      const competencia = dataEmissao.slice(0, 7);

      results.push({
        numero:            String(inf?.Numero ?? ''),
        codigoVerificacao: String(inf?.CodigoVerificacao ?? inf?.Codigo ?? ''),
        dataEmissao,
        competencia,
        prestadorCnpj:     prestCnpj,
        prestadorNome:     String(prest?.RazaoSocial ?? prest?.NomeRazaoSocial ?? ''),
        tomadorCnpj,
        tomadorNome:       String(tom?.RazaoSocial ?? tom?.NomeRazaoSocial ?? ''),
        tomadorEmail:      String(tom?.Contato?.Email ?? tom?.Email ?? ''),
        discriminacao:     String(servico?.Discriminacao ?? ''),
        itemListaServico:  String(servico?.ItemListaServico ?? ''),
        valorServicos:     this.num(valores?.ValorServicos),
        valorDeducoes:     this.num(valores?.ValorDeducoes),
        valorPis:          this.num(valores?.ValorPIS),
        valorCofins:       this.num(valores?.ValorCOFINS),
        valorInss:         this.num(valores?.ValorINSS),
        valorIr:           this.num(valores?.ValorIR),
        valorCsll:         this.num(valores?.ValorCSLL),
        issRetido:         String(valores?.ISSQNRetido) === '1',
        valorIss:          this.num(valores?.ValorISS ?? valores?.ValorISSQN),
        aliquotaIss:       this.num(valores?.Aliquota),
        valorLiquido:      this.num(valores?.ValorLiquidoNfse),
        mode,
      });
    }
    return results;
  }
}
