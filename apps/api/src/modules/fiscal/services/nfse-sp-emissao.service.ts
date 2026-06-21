// apps/api/src/modules/fiscal/services/nfse-sp-emissao.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService }  from '../../../prisma/prisma.service';
import { SigningService }  from '../../../core/certificates/signing.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as https from 'https';
import axios from 'axios';

const SP_WS  = 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx';
const SP_HOM = 'https://nfehomws.prefeitura.sp.gov.br/lotenfe.asmx';

export interface EmitirNfseSpDto {
  certId:              string;
  ambiente?:           'PRODUCAO' | 'HOMOLOGACAO';
  // RPS
  numeroRps?:          number;
  serieRps?:           string;
  // Tomador
  tomadorCnpj?:        string;
  tomadorCpf?:         string;
  tomadorNome:         string;
  tomadorEmail?:       string;
  // Servico
  itemListaServico:    string;   // ex: "01.07"
  codigoCnae?:         string;
  codigoTributacao?:   string;
  discriminacao:       string;
  codigoMunicipio?:    string;   // default 3550308
  // Valores
  valorServicos:       number;
  valorDeducoes?:      number;
  aliquotaIss?:        number;
  issRetido?:          boolean;
  optanteSimplesNacional?: boolean;
  // v2 Reforma Tributaria
  usarLayoutV2?:       boolean;
  aliquotaIbs?:        number;
  aliquotaCbs?:        number;
}

@Injectable()
export class NfseSpEmissaoService {
  private readonly logger = new Logger(NfseSpEmissaoService.name);

  constructor(
    private prisma:  PrismaService,
    private signing: SigningService,
  ) {}

  private fmt(v: number): string { return v.toFixed(2); }

  private async nextRps(companyId: string): Promise<number> {
    const last = await this.prisma.fiscalDocument.findFirst({
      where: { companyId, documentType: 'NFSE', notes: { contains: 'RPS:' } },
      orderBy: { createdAt: 'desc' },
      select: { notes: true },
    });
    const match = last?.notes?.match(/RPS:(\d+)/);
    return match ? parseInt(match[1]) + 1 : 1;
  }

  // Monta XML RPS v1
  private buildRpsV1(p: {
    nRps: number; serie: string; dataEmissao: string;
    prestCnpj: string; prestIm: string;
    tomCnpj?: string; tomCpf?: string; tomNome: string; tomEmail?: string;
    item: string; cnae: string; codTrib: string; disc: string; codMun: string;
    vServ: string; vDed: string; aliq: string; vIss: string; issRet: boolean;
    optSimples: boolean;
  }): string {
    const tomId = p.tomCnpj
      ? `<CpfCnpj><Cnpj>${p.tomCnpj}</Cnpj></CpfCnpj>`
      : `<CpfCnpj><Cpf>${p.tomCpf}</Cpf></CpfCnpj>`;
    return `<Rps>
  <InfRps Id="rps${p.nRps}">
    <IdentificacaoRps>
      <Numero>${p.nRps}</Numero>
      <Serie>${p.serie}</Serie>
      <Tipo>1</Tipo>
    </IdentificacaoRps>
    <DataEmissao>${p.dataEmissao}</DataEmissao>
    <NaturezaOperacao>1</NaturezaOperacao>
    <OptanteSimplesNacional>${p.optSimples ? '1' : '2'}</OptanteSimplesNacional>
    <IncentivadorCultural>2</IncentivadorCultural>
    <Status>1</Status>
    <Servico>
      <Valores>
        <ValorServicos>${p.vServ}</ValorServicos>
        <ValorDeducoes>${p.vDed}</ValorDeducoes>
        <ValorPis>0.00</ValorPis>
        <ValorCofins>0.00</ValorCofins>
        <ValorInss>0.00</ValorInss>
        <ValorIr>0.00</ValorIr>
        <ValorCsll>0.00</ValorCsll>
        <ISSQNRetido>${p.issRet ? '1' : '2'}</ISSQNRetido>
        <ValorIss>${p.vIss}</ValorIss>
        <Aliquota>${p.aliq}</Aliquota>
      </Valores>
      <ItemListaServico>${p.item}</ItemListaServico>
      <CodigoCnae>${p.cnae}</CodigoCnae>
      <CodigoTributacaoMunicipio>${p.codTrib}</CodigoTributacaoMunicipio>
      <Discriminacao>${p.disc}</Discriminacao>
      <CodigoMunicipio>${p.codMun}</CodigoMunicipio>
    </Servico>
    <Prestador>
      <CpfCnpj><Cnpj>${p.prestCnpj}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${p.prestIm}</InscricaoMunicipal>
    </Prestador>
    <Tomador>
      <IdentificacaoTomador>${tomId}</IdentificacaoTomador>
      <RazaoSocial>${p.tomNome}</RazaoSocial>
      ${p.tomEmail ? `<Contato><Email>${p.tomEmail}</Email></Contato>` : ''}
    </Tomador>
  </InfRps>
</Rps>`;
  }

  // Monta XML RPS v2 (Reforma Tributaria — IBS/CBS)
  private buildRpsV2(p: {
    nRps: number; serie: string; dataEmissao: string;
    prestCnpj: string; prestIm: string;
    tomCnpj?: string; tomCpf?: string; tomNome: string; tomEmail?: string;
    item: string; cnae: string; codTrib: string; disc: string; codMun: string;
    vServ: string; vDed: string; aliqIss: string; vIss: string; issRet: boolean;
    aliqIbs: string; vIbs: string; aliqCbs: string; vCbs: string;
    optSimples: boolean;
  }): string {
    const tomId = p.tomCnpj
      ? `<CpfCnpj><Cnpj>${p.tomCnpj}</Cnpj></CpfCnpj>`
      : `<CpfCnpj><Cpf>${p.tomCpf}</Cpf></CpfCnpj>`;
    return `<Rps versao="2">
  <InfRps Id="rps${p.nRps}">
    <IdentificacaoRps>
      <Numero>${p.nRps}</Numero>
      <Serie>${p.serie}</Serie>
      <Tipo>1</Tipo>
    </IdentificacaoRps>
    <DataEmissao>${p.dataEmissao}</DataEmissao>
    <NaturezaOperacao>1</NaturezaOperacao>
    <OptanteSimplesNacional>${p.optSimples ? '1' : '2'}</OptanteSimplesNacional>
    <IncentivadorCultural>2</IncentivadorCultural>
    <Status>1</Status>
    <Servico>
      <Valores>
        <ValorServicos>${p.vServ}</ValorServicos>
        <ValorDeducoes>${p.vDed}</ValorDeducoes>
        <ValorPis>0.00</ValorPis>
        <ValorCofins>0.00</ValorCofins>
        <ValorInss>0.00</ValorInss>
        <ValorIr>0.00</ValorIr>
        <ValorCsll>0.00</ValorCsll>
        <ISSQNRetido>${p.issRet ? '1' : '2'}</ISSQNRetido>
        <ValorIss>${p.vIss}</ValorIss>
        <Aliquota>${p.aliqIss}</Aliquota>
        <ValorIBS>${p.vIbs}</ValorIBS>
        <AliquotaIBS>${p.aliqIbs}</AliquotaIBS>
        <ValorCBS>${p.vCbs}</ValorCBS>
        <AliquotaCBS>${p.aliqCbs}</AliquotaCBS>
      </Valores>
      <ItemListaServico>${p.item}</ItemListaServico>
      <CodigoCnae>${p.cnae}</CodigoCnae>
      <CodigoTributacaoMunicipio>${p.codTrib}</CodigoTributacaoMunicipio>
      <Discriminacao>${p.disc}</Discriminacao>
      <CodigoMunicipio>${p.codMun}</CodigoMunicipio>
    </Servico>
    <Prestador>
      <CpfCnpj><Cnpj>${p.prestCnpj}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${p.prestIm}</InscricaoMunicipal>
    </Prestador>
    <Tomador>
      <IdentificacaoTomador>${tomId}</IdentificacaoTomador>
      <RazaoSocial>${p.tomNome}</RazaoSocial>
      ${p.tomEmail ? `<Contato><Email>${p.tomEmail}</Email></Contato>` : ''}
    </Tomador>
  </InfRps>
</Rps>`;
  }

  private buildLoteEnvio(prestCnpj: string, prestIm: string, nLote: number, rpsXml: string): string {
    return `<EnviarLoteRpsEnvio xmlns="http://www.prefeitura.sp.gov.br/nfe">
  <LoteRps>
    <NumeroLote>${nLote}</NumeroLote>
    <CpfCnpj><Cnpj>${prestCnpj}</Cnpj></CpfCnpj>
    <InscricaoMunicipal>${prestIm}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>${rpsXml}</ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
  }

  private buildSoapEnvio(xmlAssinado: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <EnviarLoteRps xmlns="http://www.prefeitura.sp.gov.br/nfe/ws/">
      <VersaoSchema>1</VersaoSchema>
      <MensagemXML><![CDATA[${xmlAssinado}]]></MensagemXML>
    </EnviarLoteRps>
  </soap:Body>
</soap:Envelope>`;
  }

  async emitir(companyId: string, dto: EmitirNfseSpDto, userId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const prestCnpj = (company.taxId ?? '').replace(/\D/g,'');
    const prestIm   = (company as any).municipalRegistration ?? (company as any).inscricaoMunicipal ?? '';
    const ambiente  = dto.ambiente ?? 'HOMOLOGACAO';
    const nRps      = dto.numeroRps ?? await this.nextRps(companyId);
    const serie     = dto.serieRps ?? 'A1';
    const dataEmi   = new Date().toISOString().slice(0,19);
    const codMun    = dto.codigoMunicipio ?? '3550308';
    const vServ     = this.fmt(dto.valorServicos);
    const vDed      = this.fmt(dto.valorDeducoes ?? 0);
    const vBC       = dto.valorServicos - (dto.valorDeducoes ?? 0);
    const aliqIss   = dto.aliquotaIss ?? 0;
    const vIss      = this.fmt(vBC * aliqIss / 100);
    const aliqIbs   = dto.aliquotaIbs ?? 0;
    const vIbs      = this.fmt(vBC * aliqIbs / 100);
    const aliqCbs   = dto.aliquotaCbs ?? 0;
    const vCbs      = this.fmt(vBC * aliqCbs / 100);
    const competencia = dataEmi.slice(0,7);

    const rpsParams = {
      nRps, serie, dataEmissao: dataEmi,
      prestCnpj, prestIm,
      tomCnpj: dto.tomadorCnpj?.replace(/\D/g,''),
      tomCpf:  dto.tomadorCpf?.replace(/\D/g,''),
      tomNome: dto.tomadorNome,
      tomEmail: dto.tomadorEmail,
      item: dto.itemListaServico,
      cnae: dto.codigoCnae ?? '',
      codTrib: dto.codigoTributacao ?? '',
      disc: dto.discriminacao,
      codMun,
      vServ, vDed,
      aliqIss: this.fmt(aliqIss),
      vIss,
      issRet: dto.issRetido ?? false,
      optSimples: dto.optanteSimplesNacional ?? true,
    };

    const rpsXml = dto.usarLayoutV2
      ? this.buildRpsV2({ ...rpsParams, aliqIbs: this.fmt(aliqIbs), vIbs, aliqCbs: this.fmt(aliqCbs), vCbs })
      : this.buildRpsV1(rpsParams);

    // Assina o RPS
    let rpsAssinado: string;
    try {
      rpsAssinado = await this.signing.signXml(rpsXml, dto.certId, `rps${nRps}`);
    } catch(e: any) {
      throw new BadRequestException('Falha ao assinar RPS: ' + e.message);
    }

    const loteXml  = this.buildLoteEnvio(prestCnpj, prestIm, nRps, rpsAssinado);
    let loteAssinado: string;
    try {
      loteAssinado = await this.signing.signXml(loteXml, dto.certId, `lote${nRps}`);
    } catch(e: any) {
      throw new BadRequestException('Falha ao assinar Lote: ' + e.message);
    }

    const soap = this.buildSoapEnvio(loteAssinado);
    const wsUrl = ambiente === 'PRODUCAO' ? SP_WS : SP_HOM;

    // Salva rascunho no banco antes de enviar
    const doc = await this.prisma.fiscalDocument.create({
      data: {
        companyId, documentType: 'NFSE',
        documentNumber: String(nRps),
        issuerCnpj: prestCnpj, issuerName: company.legalName ?? '',
        issueDate: new Date(), dueDate: new Date(),
        competenceMonth: competencia,
        grossAmount: new Decimal(vServ),
        discountAmount: new Decimal(vDed),
        netAmount: new Decimal(vBC - parseFloat(vIss)),
        issAmount: new Decimal(vIss),
        integrationStatus: 'PENDING', status: 'RASCUNHO',
        notes: `RPS:${nRps} | ${dto.usarLayoutV2 ? 'v2' : 'v1'} | ${ambiente} | IBS:${vIbs} CBS:${vCbs}`,
        createdById: userId,
      },
    });

    // Envia para webservice SP
    try {
      const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(dto.certId);
      const agent = new https.Agent({ key: privateKeyPem, cert: certPem });
      const resp  = await axios.post(wsUrl, soap, {
        httpsAgent: agent,
        headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '"http://www.prefeitura.sp.gov.br/nfe/ws/enviarLoteRps"' },
        timeout: 30000, responseType: 'text',
      });
      const body = String(resp.data);
      const numNfse = body.match(/<Numero>(\d+)<\/Numero>/)?.[1];
      const codVerif = body.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/)?.[1];
      const protocolo = body.match(/<Protocolo>([^<]+)<\/Protocolo>/)?.[1];
      const erro = body.match(/<Mensagem>([^<]+)<\/Mensagem>/)?.[1];

      if (erro && !numNfse) {
        await this.prisma.fiscalDocument.update({ where: { id: doc.id }, data: { status: 'REJEITADA' as any } });
        return { id: doc.id, status: 'REJEITADA', erro, xmlRetorno: body.slice(0,500) };
      }

      await this.prisma.fiscalDocument.update({
        where: { id: doc.id },
        data: {
          documentNumber: numNfse ?? String(nRps),
          accessKey: (codVerif ?? '').padEnd(44,'0').slice(0,44),
          status: 'AUTORIZADA' as any,
          notes: `RPS:${nRps} | NFS-e:${numNfse} | ${protocolo} | ${dto.usarLayoutV2?'v2':'v1'} | ${ambiente}`,
        },
      });
      return { id: doc.id, status: 'AUTORIZADA', numeroNfse: numNfse, codigoVerificacao: codVerif, protocolo };
    } catch(e: any) {
      await this.prisma.fiscalDocument.update({ where: { id: doc.id }, data: { status: 'REJEITADA' as any } });
      return { id: doc.id, status: 'ERRO', erro: String(e?.response?.data ?? e.message).slice(0,500) };
    }
  }

  // ── Cancelamento NFS-e SP ─────────────────────────────────────────────────
  async cancelar(companyId: string, params: {
    certId: string; numeroNfse: string; codigoVerificacao: string;
    inscricaoMunicipal: string; motivo?: string; ambiente?: string;
  }) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const prestCnpj = (company.taxId ?? '').replace(/\D/g,'');
    const wsUrl = params.ambiente === 'PRODUCAO' ? SP_WS : SP_HOM;

    const cancelXml = `<CancelarNfseEnvio xmlns="http://www.prefeitura.sp.gov.br/nfe">
  <Pedido>
    <InfPedidoCancelamento Id="cancel${params.numeroNfse}">
      <IdentificacaoNfse>
        <Numero>${params.numeroNfse}</Numero>
        <CpfCnpj><Cnpj>${prestCnpj}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${params.inscricaoMunicipal}</InscricaoMunicipal>
        <CodigoMunicipio>3550308</CodigoMunicipio>
        <CodigoVerificacao>${params.codigoVerificacao}</CodigoVerificacao>
      </IdentificacaoNfse>
      <CodigoCancelamento>2</CodigoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
</CancelarNfseEnvio>`;

    const cancelAssinado = await this.signing.signXml(cancelXml, params.certId, `cancel${params.numeroNfse}`);
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CancelarNfse xmlns="http://www.prefeitura.sp.gov.br/nfe/ws/">
      <VersaoSchema>1</VersaoSchema>
      <MensagemXML><![CDATA[${cancelAssinado}]]></MensagemXML>
    </CancelarNfse>
  </soap:Body>
</soap:Envelope>`;

    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(params.certId);
    const agent = new https.Agent({ key: privateKeyPem, cert: certPem });
    const resp  = await axios.post(wsUrl, soap, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '"http://www.prefeitura.sp.gov.br/nfe/ws/cancelarNfse"' },
      timeout: 15000, responseType: 'text',
    });
    const body = String(resp.data);
    const sucesso = body.includes('<Sucesso>') || body.includes('CancelarNfseResposta');

    if (sucesso) {
      await this.prisma.fiscalDocument.updateMany({
        where: { companyId, documentNumber: params.numeroNfse },
        data:  { status: 'CANCELADA' as any },
      });
    }
    return { sucesso, xmlRetorno: body.slice(0,1000) };
  }
}
