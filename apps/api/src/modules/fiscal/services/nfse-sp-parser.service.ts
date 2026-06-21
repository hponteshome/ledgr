// apps/api/src/modules/fiscal/services/nfse-sp-parser.service.ts
import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface NfseParsed {
  numero:              string;
  codigoVerificacao:   string;
  dataEmissao:         string;
  competencia:         string;
  prestadorCnpj:       string;
  prestadorNome:       string;
  prestadorIm:         string;    // Inscricao Municipal
  tomadorCnpj:         string;
  tomadorNome:         string;
  tomadorEmail?:       string;
  discriminacao:       string;
  itemListaServico:    string;
  codigoCnae:          string;
  // Valores principais
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
  // v2 — Reforma Tributaria 2026 (IBS/CBS)
  versaoLayout:        '1' | '2';
  valorIbs:            number;
  aliquotaIbs:         number;
  valorCbs:            number;
  aliquotaCbs:         number;
  valorTotalTributos:  number;
  ibsRetido:           boolean;
  cbsRetido:           boolean;
  // Modo
  mode: 'PRESTADOR' | 'TOMADOR' | 'DESCONHECIDO';
}

@Injectable()
export class NfseSpParserService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
    isArray: (name) => ['CompNfse','Nfse','Rps'].includes(name),
  });

  private clean(v: any): string { return String(v ?? '').replace(/\D/g,''); }
  private num(v: any): number   { return parseFloat(String(v ?? '0').replace(',','.')) || 0; }
  private str(v: any): string   { return String(v ?? ''); }

  private getCnpj(id: any): string {
    const cc = id?.CpfCnpj ?? id?.cpfCnpj ?? {};
    return this.clean(cc?.Cnpj ?? cc?.Cpf ?? '');
  }

  // Detecta versao do layout pelo atributo Versao ou presenca de campos IBS
  private detectVersion(inf: any, valores: any): '1'|'2' {
    if (inf?.['@_versao'] === '2' || inf?.['@_Versao'] === '2') return '2';
    if (valores?.ValorIBS !== undefined || valores?.valorIbs !== undefined) return '2';
    if (inf?.TributosReforma !== undefined) return '2';
    return '1';
  }

  // Extrai campos IBS/CBS do layout v2
  private extractIbsCbs(valores: any, tributosReforma: any): {
    valorIbs: number; aliquotaIbs: number; ibsRetido: boolean;
    valorCbs: number; aliquotaCbs: number; cbsRetido: boolean;
    valorTotalTributos: number;
  } {
    // v2 pode ter os valores diretamente em Valores ou em TributosReforma
    const ibs = tributosReforma?.IBS ?? tributosReforma?.Ibs ?? {};
    const cbs = tributosReforma?.CBS ?? tributosReforma?.Cbs ?? {};
    return {
      valorIbs:          this.num(valores?.ValorIBS ?? ibs?.ValorIBS ?? ibs?.Valor),
      aliquotaIbs:       this.num(valores?.AliquotaIBS ?? ibs?.Aliquota),
      ibsRetido:         String(ibs?.ISSQNRetido ?? ibs?.Retido ?? '2') === '1',
      valorCbs:          this.num(valores?.ValorCBS ?? cbs?.ValorCBS ?? cbs?.Valor),
      aliquotaCbs:       this.num(valores?.AliquotaCBS ?? cbs?.Aliquota),
      cbsRetido:         String(cbs?.Retido ?? '2') === '1',
      valorTotalTributos:this.num(valores?.ValorTotalTributos ?? tributosReforma?.ValorTotal),
    };
  }

  parseXml(xml: string, companyCnpj: string): NfseParsed[] {
    const obj = this.parser.parse(xml);
    const results: NfseParsed[] = [];
    const cnpjClean = this.clean(companyCnpj);

    // Suporta multiplos envelopes SP (v1 e v2)
    const root = obj?.ListaNfse
      ?? obj?.ConsultarNfseResposta?.ListaNfse
      ?? obj?.ConsultaNfseResposta?.ListaNfse
      ?? obj?.RetornoEnviarLoteRps?.ListaNfse
      ?? obj;

    const comps: any[] = root?.CompNfse ?? (root?.Nfse ? [{ Nfse: root.Nfse }] : []);

    for (const comp of comps) {
      const nfse = comp?.Nfse ?? comp;
      const inf  = nfse?.InfNfse ?? nfse;
      if (!inf) continue;

      // v2: campos podem estar em DeclaracaoPrestacaoServico
      const dps     = inf?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico;
      const servico = inf?.Servico ?? dps?.Servico ?? {};
      const valores = servico?.Valores ?? {};
      const tribReforma = servico?.TributosReforma ?? inf?.TributosReforma ?? dps?.TributosReforma;

      const prest = inf?.PrestadorServico ?? dps?.Prestador ?? {};
      const tom   = inf?.TomadorServico   ?? dps?.Tomador   ?? {};

      const prestCnpj   = this.getCnpj(prest?.IdentificacaoPrestador ?? prest?.Identificacao ?? prest);
      const tomadorCnpj = this.getCnpj(tom?.IdentificacaoTomador     ?? tom?.Identificacao   ?? tom);

      let mode: 'PRESTADOR'|'TOMADOR'|'DESCONHECIDO' = 'DESCONHECIDO';
      if (prestCnpj === cnpjClean) mode = 'PRESTADOR';
      else if (tomadorCnpj === cnpjClean) mode = 'TOMADOR';

      const dataEmissao = this.str(inf?.DataEmissao ?? inf?.Competencia ?? dps?.DataEmissao ?? '').slice(0,10);
      const versaoLayout = this.detectVersion(inf, valores);
      const ibsCbs = this.extractIbsCbs(valores, tribReforma);

      results.push({
        numero:            this.str(inf?.Numero ?? ''),
        codigoVerificacao: this.str(inf?.CodigoVerificacao ?? inf?.Codigo ?? ''),
        dataEmissao,
        competencia:       dataEmissao.slice(0,7),
        prestadorCnpj:     prestCnpj,
        prestadorNome:     this.str(prest?.RazaoSocial ?? prest?.NomeRazaoSocial ?? ''),
        prestadorIm:       this.str(prest?.IdentificacaoPrestador?.InscricaoMunicipal ?? prest?.InscricaoMunicipal ?? ''),
        tomadorCnpj,
        tomadorNome:       this.str(tom?.RazaoSocial ?? tom?.NomeRazaoSocial ?? ''),
        tomadorEmail:      this.str(tom?.Contato?.Email ?? tom?.Email ?? ''),
        discriminacao:     this.str(servico?.Discriminacao ?? ''),
        itemListaServico:  this.str(servico?.ItemListaServico ?? ''),
        codigoCnae:        this.str(servico?.CodigoCnae ?? ''),
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
        versaoLayout,
        ...ibsCbs,
        mode,
      });
    }
    return results;
  }
}
