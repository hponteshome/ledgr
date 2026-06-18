// apps/api/src/modules/hr/services/esocial-transmission.service.ts
// Transmissao de eventos ao eSocial via webservice SOAP
// Cobre: assinatura XMLDSig (xml-crypto), envelope SOAP, parse de retorno, persistencia

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService }      from '../../../prisma/prisma.service';
import { EsocialEventsService } from './esocial-events.service';
import { SigningService }      from '../../../core/certificates/signing.service';
import { SignedXml }          from 'xml-crypto';
import * as https             from 'https';
import axios                  from 'axios';

export interface TransmissionResult {
  eventId:  string;
  nrRec:    string | null;
  status:   'TRANSMITIDO' | 'ERRO' | 'PENDENTE';
  codigo?:  string;
  descricao?: string;
  erros?:   any;
}

// URLs do webservice eSocial
const URLS = {
  '1': 'https://webservices.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
  '2': 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
};

@Injectable()
export class EsocialTransmissionService {
  private readonly logger = new Logger(EsocialTransmissionService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly events:   EsocialEventsService,
    private readonly signing:  SigningService,
  ) {}

  // ── Transmite S-2299 a partir da rescisao confirmada ───────────────────────
  async transmitirS2299(
    companyId: string,
    employeeId: string,
    tpAmb: '1' | '2' = '2',
  ): Promise<TransmissionResult> {
    // 1. Gerar XML do evento
    const xmlEvento = await this.events.generateS2299FromTermination(companyId, employeeId, tpAmb);

    // 2. Extrair Id do elemento evtDeslig para referencia da assinatura
    const idMatch = xmlEvento.match(/evtDeslig\s+Id="([^"]+)"/);
    if (!idMatch) throw new BadRequestException('Id do evento nao encontrado no XML gerado.');
    const evtId = idMatch[1];

    return this.transmitirEvento(companyId, employeeId, 'S-2299', xmlEvento, evtId, tpAmb);
  }


  // ── Transmite S-1299 Fechamento de Eventos Periodicos ────────────────────────
  async transmitirS1299(
    companyId: string,
    perApur:   string,
    tpAmb:     '1' | '2' = '2',
  ): Promise<TransmissionResult> {
    const xmlEvento = await this.events.generateS1299(companyId, perApur, tpAmb);
    const idMatch   = xmlEvento.match(/evtFechaEvtsPer\s+Id="([^"]+)"/);
    if (!idMatch) throw new Error('Id do evento S-1299 nao encontrado no XML.');
    const evtId = idMatch[1];
    return this.transmitirEvento(companyId, undefined, 'S-1299', xmlEvento, evtId, tpAmb);
  }

  // ── Metodo generico de transmissao ─────────────────────────────────────────
  async transmitirEvento(
    companyId:  string,
    employeeId: string | undefined,
    tipo:       string,
    xmlEvento:  string,
    evtId:      string,
    tpAmb:      '1' | '2',
  ): Promise<TransmissionResult> {
    // 3. Buscar certificado ativo com uso ESOCIAL ou TRANSMISSION
    const cert = await (this.prisma as any).certificate.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { usage: { has: 'TRANSMISSION' } },
          { usage: { has: 'ESOCIAL' } },
          { usage: { has: 'SIGNING' } },
        ],
      },
      orderBy: { validTo: 'desc' },
      select: { id: true, alias: true, validTo: true },
    });

    if (!cert) {
      throw new NotFoundException(
        'Nenhum certificado A1 ativo encontrado para esta empresa. ' +
        'Acesse Sistema > Certificados Digitais e importe o certificado .pfx da empresa.'
      );
    }

    // 4. Assinar XML com XMLDSig (enveloped, rsa-sha256, sha-256)
    let xmlAssinado: string;
    try {
      xmlAssinado = await this.assinarXmlEsocial(xmlEvento, cert.id, evtId);
    } catch (err: any) {
      this.logger.error('Erro ao assinar XML eSocial', err);
      const ev = await this.persistirEvento(companyId, employeeId, tipo, tpAmb, xmlEvento, null, null, 'ERRO', { etapa: 'ASSINATURA', message: err.message });
      return { eventId: ev.id, nrRec: null, status: 'ERRO', erros: { etapa: 'ASSINATURA', message: err.message } };
    }

    // 5. Montar SOAP envelope
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const cnpj = (company.taxId ?? '').replace(/\D/g, '');
    // Extrai CPF do subject do certificado (formato CN=NOME:CPF11DIGITOS,...)
    const certInfo = await (this.prisma as any).certificate.findFirst({
      where: { id: cert.id }, select: { subject: true }
    });
    const cpfMatch = certInfo?.subject?.match(/:([0-9]{11})/);
    const cpfTransmissor = cpfMatch ? cpfMatch[1] : undefined;
    const soapBody = this.buildSoapEnvelope(xmlAssinado, cnpj, tpAmb, cpfTransmissor);

    // 6. Transmitir
    let nrRec: string | null = null;
    let status: 'TRANSMITIDO' | 'ERRO' = 'ERRO';
    let codigo: string | undefined;
    let descricao: string | undefined;
    let erros: any = null;

    try {
      const url = URLS[tpAmb];
      this.logger.log(`Transmitindo ${tipo} para ${tpAmb === '1' ? 'PRODUCAO' : 'PROD.RESTRITA'}: ${url}`);

      const response = await axios.post(url, soapBody, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/sincrono/v1_1_0/IWsEnviarLoteEventos/EnviarLoteEventos',
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: true }),
        timeout: 30_000,
      });

      const parsed = this.parseRetorno(response.data);
      nrRec     = parsed.nrRec ?? null;
      codigo    = parsed.codigo;
      descricao = parsed.descricao;
      status    = ['201','202'].includes(parsed.codigo ?? '') ? 'TRANSMITIDO' : 'ERRO';
      if (status === 'ERRO') erros = parsed;

      this.logger.log(`Retorno eSocial: ${parsed.codigo} - ${parsed.descricao} | nrRec: ${nrRec}`);

    } catch (err: any) {
      erros = {
        etapa:   'TRANSMISSAO',
        message: err.message,
        code:    err.code,
        status:  err.response?.status,
        data:    err.response?.data?.slice?.(0, 500),
      };
      this.logger.error('Erro na transmissao eSocial', erros);
    }

    // 7. Persistir
    const ev = await this.persistirEvento(companyId, employeeId, tipo, tpAmb, xmlEvento, xmlAssinado, nrRec, status, erros);
    return { eventId: ev.id, nrRec, status, codigo, descricao, erros };
  }

  // ── Assinatura XMLDSig para eSocial ───────────────────────────────────────
  private async assinarXmlEsocial(xml: string, certId: string, evtId: string): Promise<string> {
    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(certId);

    const certClean = certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      signatureAlgorithm:        'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    sig.addReference({
      xpath: `//*[@Id='${evtId}']`,
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: `#${evtId}`,
    });

    // Injeta certificado no KeyInfo
    (sig as any).keyInfoProvider = {
      getKeyInfo: () =>
        `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`,
      getKey: () => Buffer.from(certPem),
    };

    sig.computeSignature(xml, {
      prefix: '',
      location: {
        reference: `//*[@Id='${evtId}']`,
        action: 'append',
      },
    });

    return sig.getSignedXml();
  }

  // ── SOAP Envelope ─────────────────────────────────────────────────────────
  private buildSoapEnvelope(xmlAssinado: string, cnpj: string, tpAmb: string, cpfTransmissor?: string): string {
    // ideTransmissor: responsavel legal usa CPF (tpInsc=2); procurador tb usa CPF
    const tpInscTx  = cpfTransmissor ? '2' : '1';
    const nrInscTx  = cpfTransmissor ? cpfTransmissor : cnpj;
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:v1="http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/sincrono/v1_1_0">
  <soapenv:Header/>
  <soapenv:Body>
    <v1:EnviarLoteEventos>
      <v1:loteEventos>
        <eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">
          <envioLoteEventos grupo="1">
            <ideEmpregador>
              <tpInsc>1</tpInsc>
              <nrInsc>${cnpj}</nrInsc>
            </ideEmpregador>
            <ideTransmissor>
              <tpInsc>${tpInscTx}</tpInsc>
              <nrInsc>${nrInscTx}</nrInsc>
            </ideTransmissor>
            <eventos>
              <evento Id="ev001">
                ${xmlAssinado}
              </evento>
            </eventos>
          </envioLoteEventos>
        </eSocial>
      </v1:loteEventos>
    </v1:EnviarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  // ── Parse do retorno SOAP ─────────────────────────────────────────────────
  private parseRetorno(xml: string): { codigo?: string; descricao?: string; nrRec?: string } {
    const codigo    = xml.match(/<codigo>([^<]+)<\/codigo>/)?.[1];
    const descricao = xml.match(/<descricao>([^<]+)<\/descricao>/)?.[1];
    const nrRec     = xml.match(/<nrRec>([^<]+)<\/nrRec>/)?.[1];
    return { codigo, descricao, nrRec };
  }

  // ── Persistencia ──────────────────────────────────────────────────────────
  private async persistirEvento(
    companyId: string, employeeId: string | undefined, tipo: string, tpAmb: string,
    xmlGerado: string, xmlAssinado: string | null, nrRec: string | null,
    status: string, erros: any,
  ) {
    return this.prisma.esocialEvent.create({
      data: {
        companyId, employeeId: employeeId ?? null,
        tipo, tpAmb, xmlGerado, xmlAssinado, nrRec, status,
        erros: erros ?? undefined,
        transmitidoEm: status !== 'PENDENTE' ? new Date() : null,
      },
    });
  }

  // ── Listar eventos por empresa ────────────────────────────────────────────
  async listarEventos(companyId: string, tipo?: string) {
    return this.prisma.esocialEvent.findMany({
      where: { companyId, ...(tipo ? { tipo } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, tipo: true, tpAmb: true, status: true, nrRec: true,
        erros: true, transmitidoEm: true, createdAt: true, employeeId: true,
      },
    });
  }
}
