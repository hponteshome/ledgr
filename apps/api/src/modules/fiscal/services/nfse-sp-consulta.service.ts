import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService }  from '../../../prisma/prisma.service';
import { SigningService }  from '../../../core/certificates/signing.service';
import { NfseSpParserService } from './nfse-sp-parser.service';
import { NfseImportService }   from './nfse-import.service';
import * as https from 'https';
import axios from 'axios';

const SP_WS_URL  = 'https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx';
const SP_WS_URL_HOM = 'https://nfehom.prefeitura.sp.gov.br/ws/lotenfe.asmx';

@Injectable()
export class NfseSpConsultaService {
  private readonly logger = new Logger(NfseSpConsultaService.name);

  constructor(
    private prisma:   PrismaService,
    private signing:  SigningService,
    private parser:   NfseSpParserService,
    private importer: NfseImportService,
  ) {}

  // ── Monta XML interno da consulta (assinado com cert do tomador) ──────────
  private buildConsultaXml(cnpj: string, pagina: number, dtInicio?: string, dtFim?: string): string {
    const periodoBlock = dtInicio && dtFim
      ? `<tc:PeriodoInicial>${dtInicio}</tc:PeriodoInicial>
         <tc:PeriodoFinal>${dtFim}</tc:PeriodoFinal>`
      : '';
    return `<p1:ConsultaNFeRecebidas
      xmlns:p1="http://www.prefeitura.sp.gov.br/nfe"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:tc="http://www.prefeitura.sp.gov.br/nfe/tipos"
      Versao="1">
      <tc:CPFCNPJTomador>
        <tc:CNPJ>${cnpj}</tc:CNPJ>
      </tc:CPFCNPJTomador>
      ${periodoBlock}
      <tc:Pagina>${pagina}</tc:Pagina>
    </p1:ConsultaNFeRecebidas>`;
  }

  // ── Envelope SOAP ─────────────────────────────────────────────────────────
  private buildSoapEnvelope(versao: string, xmlAssinado: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <ConsultaNFeRecebidas xmlns="http://www.prefeitura.sp.gov.br/nfe/ws/">
      <VersaoSchema>${versao}</VersaoSchema>
      <MensagemXML><![CDATA[${xmlAssinado}]]></MensagemXML>
    </ConsultaNFeRecebidas>
  </soap:Body>
</soap:Envelope>`;
  }

  // ── Extrai notas XML da resposta SOAP ─────────────────────────────────────
  private extractNotasFromResponse(soapResponse: string): string[] {
    const notas: string[] = [];
    // Extrai cada CompNFe ou NFS-e da resposta
    const matches = soapResponse.matchAll(/<CompNfse>([\s\S]*?)<\/CompNfse>/g);
    for (const m of matches) {
      notas.push(`<CompNfse>${m[1]}</CompNfse>`);
    }
    // Fallback: tenta ListaNFeConsultada
    if (!notas.length) {
      const listMatch = soapResponse.match(/<RetornoConsulta[^>]*>([\s\S]*?)<\/RetornoConsulta>/);
      if (listMatch) notas.push(listMatch[1]);
    }
    return notas;
  }

  // ── Extrai erro da resposta SOAP ──────────────────────────────────────────
  private extractErro(resp: string): string | null {
    const m = resp.match(/<Msg>([^<]*)<\/Msg>/);
    const c = resp.match(/<Codigo>([^<]*)<\/Codigo>/);
    if (c?.[1] && c[1] !== '0' && c[1] !== '100') {
      return `Código ${c[1]}: ${m?.[1] ?? 'Erro desconhecido'}`;
    }
    return null;
  }

  // ── Consulta principal ────────────────────────────────────────────────────
  async consultarTomador(params: {
    companyId:   string;
    certId:      string;
    dtInicio?:   string;   // YYYY-MM-DD
    dtFim?:      string;
    paginas?:    number;   // max paginas a buscar (default 5)
    homologacao?:boolean;
    importar?:   boolean;  // se true, salva no banco
    userId:      string;
  }) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: params.companyId },
    });
    const cnpj = (company.taxId ?? '').replace(/\D/g,'');
    if (!cnpj) throw new BadRequestException('Empresa sem CNPJ cadastrado.');

    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(params.certId);
    const agent   = new https.Agent({ key: privateKeyPem, cert: certPem, rejectUnauthorized: true });
    const wsUrl   = params.homologacao ? SP_WS_URL_HOM : SP_WS_URL;
    const maxPags = params.paginas ?? 5;

    const todasNotas: any[] = [];
    let   totalEncontradas  = 0;
    let   importadas        = 0;
    let   duplicatas        = 0;
    const erros: string[]   = [];

    for (let pag = 1; pag <= maxPags; pag++) {
      this.logger.log(`Consultando SP NFS-e tomador ${cnpj} — página ${pag}`);

      // Monta XML da consulta (sem assinatura — autenticacao via mTLS do certificado TLS)
      const consultaXml = this.buildConsultaXml(
        cnpj, pag,
        params.dtInicio ? params.dtInicio.replace(/-/g,'') : undefined,
        params.dtFim    ? params.dtFim.replace(/-/g,'')    : undefined,
      );

      const soap = this.buildSoapEnvelope('1', consultaXml);

      let respData: string;
      try {
        const resp = await axios.post(wsUrl, soap, {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'SOAPAction':   '"http://www.prefeitura.sp.gov.br/nfe/ws/consultaNFeRecebidas"',
          },
          timeout: 30000,
          responseType: 'text',
        });
        respData = String(resp.data);
      } catch(e: any) {
        const msg = e?.response?.data ?? e.message;
        erros.push(`Página ${pag}: ${String(msg).slice(0,200)}`);
        break;
      }

      // Verifica erro na resposta
      const erro = this.extractErro(respData);
      if (erro) {
        if (erro.includes('000') || pag > 1) break; // sem mais paginas
        erros.push(erro); break;
      }

      // Extrai notas
      const notasXml = this.extractNotasFromResponse(respData);
      if (!notasXml.length) break; // sem mais resultados

      totalEncontradas += notasXml.length;

      if (params.importar !== false) {
        // Importa cada nota via NfseImportService (dedup automatico)
        for (const notaXml of notasXml) {
          try {
            const parsed = this.parser.parseXml(
              `<ListaNfse>${notaXml}</ListaNfse>`, cnpj
            );
            if (!parsed.length) continue;

            const n = parsed[0];
            const dup = await this.prisma.fiscalDocument.findFirst({
              where: {
                companyId:    params.companyId,
                documentNumber: n.numero,
                issuerCnpj:   n.prestadorCnpj,
              },
            });
            if (dup) { duplicatas++; continue; }

            const { Decimal } = await import('@prisma/client/runtime/library');
            const net = n.valorLiquido || (n.valorServicos - n.valorDeducoes - n.valorIss);
            await this.prisma.fiscalDocument.create({
              data: {
                companyId:       params.companyId,
                documentType:    'NFSE',
                documentNumber:  n.numero,
                accessKey:       (n.codigoVerificacao + '0'.repeat(44)).slice(0,44),
                issuerCnpj:      n.prestadorCnpj,
                issuerName:      n.prestadorNome,
                issueDate:       new Date(n.dataEmissao + 'T12:00:00Z'),
                dueDate:         new Date(n.dataEmissao + 'T12:00:00Z'),
                competenceMonth: n.competencia,
                grossAmount:     new Decimal(n.valorServicos),
                discountAmount:  new Decimal(n.valorDeducoes),
                netAmount:       new Decimal(net),
                irAmount:        new Decimal(n.valorIr),
                pisAmount:       new Decimal(n.valorPis),
                cofinsAmount:    new Decimal(n.valorCofins),
                csllAmount:      new Decimal(n.valorCsll),
                issAmount:       new Decimal(n.valorIss),
                inssAmount:      new Decimal(n.valorInss),
                integrationStatus: 'PENDING',
                status:          'RASCUNHO',
                notes: `Busca automática SP | Modo: ${n.mode} | ISS retido: ${n.issRetido?'Sim':'Não'} | ${n.itemListaServico}`,
                createdById: params.userId,
              },
            });
            importadas++;
            todasNotas.push(n);
          } catch(e: any) {
            erros.push(`Nota ${e.message?.slice(0,100)}`);
          }
        }
      }

      if (notasXml.length < 50) break; // ultima pagina
    }

    return {
      cnpj,
      totalEncontradas,
      importadas,
      duplicatas,
      erros,
      periodo: { inicio: params.dtInicio, fim: params.dtFim },
    };
  }
}
