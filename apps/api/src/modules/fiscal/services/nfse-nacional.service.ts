// apps/api/src/modules/fiscal/services/nfse-nacional.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService }  from '../../../prisma/prisma.service';
import { SigningService }  from '../../../core/certificates/signing.service';
import { Decimal } from '@prisma/client/runtime/library';
import { create } from 'xmlbuilder2';
import * as https from 'https';
import axios from 'axios';

// ── Ambientes RFB ──────────────────────────────────────────────────────────────
const RFB_URLS = {
  HOMOLOGACAO: 'https://hom.api.nfse.gov.br/v1',
  PRODUCAO:    'https://api.nfse.gov.br/v1',
};

export interface EmitirNfseDto {
  serieRps?:         string;
  dataEmissao?:      string;    // YYYY-MM-DD; default: hoje
  tomadorCnpj?:      string;
  tomadorCpf?:       string;
  tomadorNome:       string;
  tomadorEmail?:     string;
  codigoServico:     string;    // cTribNac ex: "01.07"
  descricaoServico:  string;
  valorServico:      number;
  valorDeducoes?:    number;
  aliquotaIss?:      number;    // percentual: 2.0 = 2%
  issRetido?:        boolean;
  codigoIbge?:       string;    // default 3550308 (SP)
  certId:            string;    // UUID do certificado
  ambiente?:         'HOMOLOGACAO' | 'PRODUCAO';
}

@Injectable()
export class NfseNacionalService {
  private readonly logger = new Logger(NfseNacionalService.name);

  constructor(
    private prisma:  PrismaService,
    private signing: SigningService,
  ) {}

  // ── Proximo numero de RPS ──────────────────────────────────────────────────
  private async nextRps(companyId: string): Promise<number> {
    const last = await this.prisma.nfseNacionalEmissao.findFirst({
      where:   { companyId },
      orderBy: { numeroRps: 'desc' },
      select:  { numeroRps: true },
    });
    return (last?.numeroRps ?? 0) + 1;
  }

  // ── Monta XML DPS (Declaracao de Prestacao de Servicos) ───────────────────
  private buildDpsXml(params: {
    id:             string;
    nRps:           number;
    serie:          string;
    dhEmi:          string;
    cLocEmi:        string;
    tpAmb:          number;
    prestCnpj:      string;
    tomCnpj?:       string;
    tomCpf?:        string;
    tomNome:        string;
    tomEmail?:      string;
    cServ:          string;
    xDescServ:      string;
    vServ:          string;
    vDeducoes:      string;
    vBC:            string;
    pAliq:          string;
    vISSQN:         string;
    tpRet:          string;   // 1=retido 2=nao retido
    vLiq:           string;
    cLocIncid:      string;
  }): string {
    const ns = 'http://www.sped.fazenda.gov.br/nfse';
    const root = create({ version:'1.0', encoding:'UTF-8' })
      .ele(ns, 'DPS', { versao:'1.00', xmlns: ns })
        .ele('infDPS', { Id: `DPS${params.id}` })
          .ele('tpAmb').txt(String(params.tpAmb)).up()
          .ele('cLocEmi').txt(params.cLocEmi).up()
          .ele('serie').txt(params.serie).up()
          .ele('nDPS').txt(String(params.nRps)).up()
          .ele('dhEmi').txt(params.dhEmi).up()
          .ele('vpLiq').txt(params.vLiq).up()
          .ele('prest')
            .ele('CNPJ').txt(params.prestCnpj).up()
          .up()
          .ele('toma')
            .ele(params.tomCnpj ? 'CNPJ' : 'CPF')
              .txt(params.tomCnpj ?? params.tomCpf ?? '').up()
            .ele('xNome').txt(params.tomNome).up();

    if (params.tomEmail) {
      root.root().find(n => n.node.nodeName === 'toma')
        ?.ele('email').txt(params.tomEmail);
    }

    root.root().find(n => n.node.nodeName === 'infDPS')
      ?.ele('serv')
        .ele('cServ')
          .ele('cTribNac').txt(params.cServ).up()
          .ele('xDescServ').txt(params.xDescServ).up()
        .up()
      .up()
      .ele('valores')
        .ele('vServPrest')
          .ele('vServ').txt(params.vServ).up()
        .up()
        .ele('vDescCondIncond')
          .ele('vDescIncond').txt(params.vDeducoes).up()
        .up()
        .ele('tributos')
          .ele('tribMun')
            .ele('tribISSQN')
              .ele('cLocIncid').txt(params.cLocIncid).up()
              .ele('vBC').txt(params.vBC).up()
              .ele('pAliq').txt(params.pAliq).up()
              .ele('vISSQN').txt(params.vISSQN).up()
              .ele('tpRetISSQN').txt(params.tpRet).up()
            .up()
          .up()
        .up()
      .up();

    return root.end({ prettyPrint: false });
  }

  // ── Emite NFS-e Nacional ─────────────────────────────────────────────────
  async emitir(companyId: string, dto: EmitirNfseDto, userId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const prestCnpj = (company.taxId ?? '').replace(/\D/g,'');
    const tomCnpj   = dto.tomadorCnpj?.replace(/\D/g,'');
    const tomCpf    = dto.tomadorCpf?.replace(/\D/g,'');
    const ambiente  = dto.ambiente ?? 'HOMOLOGACAO';
    const tpAmb     = ambiente === 'PRODUCAO' ? 1 : 2;
    const nRps      = await this.nextRps(companyId);
    const serie     = dto.serieRps ?? '1';
    const dataEmi   = dto.dataEmissao ?? new Date().toISOString().slice(0,10);
    const dhEmi     = `${dataEmi}T${new Date().toISOString().slice(11,19)}`;
    const cLocIncid = dto.codigoIbge ?? '3550308';
    const vServ     = Number(dto.valorServico).toFixed(2);
    const vDed      = Number(dto.valorDeducoes ?? 0).toFixed(2);
    const pAliq     = Number(dto.aliquotaIss ?? 0) / 100;
    const vBC       = (Number(vServ) - Number(vDed)).toFixed(2);
    const vISS      = (Number(vBC) * pAliq).toFixed(2);
    const vLiq      = dto.issRetido
      ? (Number(vBC) - Number(vISS)).toFixed(2)
      : Number(vBC).toFixed(2);
    const tpRet     = dto.issRetido ? '1' : '2';
    const competencia = dataEmi.slice(0,7);

    // Cria rascunho no banco
    const emissao = await this.prisma.nfseNacionalEmissao.create({
      data: {
        companyId,
        certId:           dto.certId,
        numeroRps:        nRps,
        serieRps:         serie,
        dataEmissao:      new Date(`${dataEmi}T12:00:00Z`),
        competencia,
        prestadorCnpj:   prestCnpj,
        tomadorCnpj:     tomCnpj,
        tomadorCpf:      tomCpf,
        tomadorNome:     dto.tomadorNome,
        tomadorEmail:    dto.tomadorEmail,
        codigoServico:   dto.codigoServico,
        descricaoServico:dto.descricaoServico,
        valorServico:    new Decimal(vServ),
        valorDeducoes:   new Decimal(vDed),
        valorIss:        new Decimal(vISS),
        aliquotaIss:     new Decimal(pAliq.toFixed(4)),
        issRetido:       dto.issRetido ?? false,
        valorLiquido:    new Decimal(vLiq),
        codigoIbge:      cLocIncid,
        ambiente,
        status:          'RASCUNHO',
        createdById:     userId,
      },
    });

    // Monta e assina DPS
    const dpsXml = this.buildDpsXml({
      id: emissao.id.replace(/-/g,'').slice(0,20),
      nRps, serie, dhEmi,
      cLocEmi: cLocIncid,
      tpAmb,
      prestCnpj,
      tomCnpj, tomCpf,
      tomNome:   dto.tomadorNome,
      tomEmail:  dto.tomadorEmail,
      cServ:     dto.codigoServico,
      xDescServ: dto.descricaoServico,
      vServ, vDeducoes: vDed, vBC, pAliq: (pAliq*100).toFixed(2),
      vISSQN: vISS, tpRet, vLiq, cLocIncid,
    });

    let xmlAssinado: string;
    try {
      xmlAssinado = await this.signing.signXml(dpsXml, dto.certId, `DPS${emissao.id.replace(/-/g,'').slice(0,20)}`);
    } catch(e: any) {
      await this.prisma.nfseNacionalEmissao.update({
        where: { id: emissao.id },
        data:  { status: 'REJEITADA', motivoRejeicao: 'Falha na assinatura: ' + e.message },
      });
      throw new BadRequestException('Falha ao assinar DPS: ' + e.message);
    }

    // Persiste XML assinado
    await this.prisma.nfseNacionalEmissao.update({
      where: { id: emissao.id },
      data:  { xmlDps: xmlAssinado, status: 'ASSINADA' },
    });

    // Envia para RFB
    try {
      const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(dto.certId);
      const agent = new https.Agent({ key: privateKeyPem, cert: certPem });
      const baseUrl = RFB_URLS[ambiente];

      const resp = await axios.post(
        `${baseUrl}/nfse`,
        xmlAssinado,
        {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Accept':        'application/xml',
          },
          timeout: 30000,
        }
      );

      // Extrai numero e chave da resposta
      const body = String(resp.data ?? '');
      const numNfse  = body.match(/<Numero>(\d+)<\/Numero>/)?.[1];
      const chaveNfse = body.match(/<ChNFSe>([^<]+)<\/ChNFSe>/)?.[1];
      const protocolo = body.match(/<nProt>([^<]+)<\/nProt>/)?.[1];

      await this.prisma.nfseNacionalEmissao.update({
        where: { id: emissao.id },
        data:  {
          status:    'AUTORIZADA',
          numeroNfse: numNfse,
          chaveNfse,
          protocolo,
          xmlNfse:   body,
        },
      });

      return { id: emissao.id, status: 'AUTORIZADA', numeroNfse: numNfse, chaveNfse };

    } catch(e: any) {
      const msg = e?.response?.data ?? e.message;
      await this.prisma.nfseNacionalEmissao.update({
        where: { id: emissao.id },
        data:  { status: 'REJEITADA', motivoRejeicao: String(msg).slice(0,500) },
      });
      // Retorna o rascunho assinado mesmo com erro de comunicacao
      return {
        id: emissao.id, status: 'REJEITADA',
        motivo: String(msg).slice(0,300),
        dica: 'Verifique conectividade com a RFB e tente reenviar via /fiscal/nfse-nacional/:id/reenviar',
      };
    }
  }

  // ── Reenvio ───────────────────────────────────────────────────────────────
  async reenviar(companyId: string, id: string) {
    const em = await this.prisma.nfseNacionalEmissao.findFirstOrThrow({
      where: { id, companyId },
    });
    if (!em.xmlDps) throw new BadRequestException('DPS não assinado. Recrie a NFS-e.');
    if (!em.certId) throw new BadRequestException('Certificado não vinculado.');

    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(em.certId);
    const agent   = new https.Agent({ key: privateKeyPem, cert: certPem });
    const baseUrl = RFB_URLS[em.ambiente as 'HOMOLOGACAO' | 'PRODUCAO'];

    const resp = await axios.post(`${baseUrl}/nfse`, em.xmlDps, {
      httpsAgent: agent,
      headers: { 'Content-Type': 'application/xml; charset=UTF-8', Accept: 'application/xml' },
      timeout: 30000,
    });

    const body     = String(resp.data ?? '');
    const numNfse  = body.match(/<Numero>(\d+)<\/Numero>/)?.[1];
    const chaveNfse = body.match(/<ChNFSe>([^<]+)<\/ChNFSe>/)?.[1];

    return this.prisma.nfseNacionalEmissao.update({
      where: { id },
      data:  { status: 'AUTORIZADA', numeroNfse: numNfse, chaveNfse, xmlNfse: body },
    });
  }

  // ── Cancelamento ─────────────────────────────────────────────────────────
  async cancelar(companyId: string, id: string, motivo: string) {
    const em = await this.prisma.nfseNacionalEmissao.findFirstOrThrow({
      where: { id, companyId, status: 'AUTORIZADA' },
    });
    if (!em.chaveNfse) throw new BadRequestException('NFS-e não autorizada.');

    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(em.certId!);
    const agent   = new https.Agent({ key: privateKeyPem, cert: certPem });
    const baseUrl = RFB_URLS[em.ambiente as 'HOMOLOGACAO' | 'PRODUCAO'];

    await axios.delete(`${baseUrl}/nfse/${em.chaveNfse}`, {
      httpsAgent: agent,
      data: `<pedidoCancelamento><xJust>${motivo}</xJust></pedidoCancelamento>`,
      headers: { 'Content-Type': 'application/xml' },
      timeout: 15000,
    });

    return this.prisma.nfseNacionalEmissao.update({
      where: { id },
      data:  { status: 'CANCELADA', canceladaEm: new Date(), motivoCanc: motivo },
    });
  }

  // ── Listagem ──────────────────────────────────────────────────────────────
  async listar(companyId: string, competencia?: string, status?: string) {
    const where: any = { companyId };
    if (competencia) where.competencia = competencia;
    if (status)      where.status      = status;
    return this.prisma.nfseNacionalEmissao.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 100,
    });
  }
}
