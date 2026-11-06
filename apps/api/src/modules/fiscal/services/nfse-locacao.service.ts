// apps/api/src/modules/fiscal/services/nfse-locacao.service.ts
// 06/11/2026 - NFS-e de locacao de bens imoveis (cTribNac 99.03.01) - Reforma Tributaria (NT 009, Anexos VI e VII).
// Servico ISOLADO: nao altera o NfseNacionalService nem as demais rotinas de emissao (Prefeitura SP, Simples, Pontes).
// Fluxo com certificado A3: preparar() monta a DPS sem assinatura e grava o rascunho; o navegador envia a DPS ao
// LEDGR Agent (porta 7778), que assina com o token, compacta (gzip + base64) e envia por mTLS a Sefin Nacional;
// o navegador devolve o retorno em registrarRetorno().
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';
import { create } from 'xmlbuilder2';
import { gunzipSync, gzipSync } from 'zlib';
import * as https from 'https';
import axios from 'axios';
import { SigningService } from '../../../core/certificates/signing.service';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO_DPS = '1.01';
const VER_APLIC = 'LEDGR-1.0';
const SERIE = '1';
const CTRIBNAC = '990301';          // locacao de bens imoveis
const CIND_OP = '020101';           // operacao com bem imovel - localidade do imovel (E0902: 02XXXX)
const CST_IBSCBS = '200';           // aliquota reduzida
const CCLASSTRIB = '200027';        // locacao, cessao onerosa e arrendamento de bens imoveis (art. 261, reducao 70%)
const NBS_RESIDENCIAL = '1.1002.10.00';
const REDUTOR_SOCIAL = 600;         // art. 260 - valor de referencia; atualizar com o valor corrigido pelo IPCA
// PIS/Cofins e opcao pelo Simples saem do regime vigente na DATA da operacao (resolverRegime).
export const SEFIN_URLS = {
  HOMOLOGACAO: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse',
  PRODUCAO: 'https://sefin.nfse.gov.br/SefinNacional/nfse',
};

export interface DeducaoLocacaoDto {
  fixedAssetId?: string;  // unidade (default: imovel do contrato)
  tipo: string;           // 01 tributos (IPTU) | 02 emolumentos | 03 condominio | 99 outras
  valor: number;
  descricao?: string;     // obrigatoria no tipo 99
}

export interface PrepararLocacaoDto {
  rentalContractId: string;
  competencia?: string;           // AAAA-MM do aluguel (informativo)
  dataPagamento: string;          // AAAA-MM-DD - fato gerador do IBS/CBS (dCompet)
  valorRecebido: number;          // vTotOper
  vencimentoOriginal?: string;    // AAAA-MM-DD (dVencOrig)
  descontoIncondicionado?: number;
  descontoCondicionado?: number;
  unidadesAdicionais?: string[];  // fixedAssetIds (ex.: Landmark 138-A e 139-A)
  deducoes?: DeducaoLocacaoDto[];
  usarRedutorSocial?: boolean;    // default true (so imovel residencial)
  descricao?: string;
  ambiente?: 'HOMOLOGACAO' | 'PRODUCAO';
  arEntryId?: string;
  regimeConfirmado?: string;     // forma do regime confirmada pelo usuario (deve bater com o historico)
}

const dig = (v: any) => String(v ?? '').replace(/\D/g, '');
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => r2(n).toFixed(2);

@Injectable()
export class NfseLocacaoService {
  constructor(private prisma: PrismaService, private signing: SigningService) {}

  // Regime tributario vigente NA DATA da operacao (pode mudar de um exercicio para outro):
  // Somente company_tax_regimes (dt_ini <= data <= dt_fin). Sem fallback: o regime deve estar cadastrado e e confirmado na emissao.
  // Aceita texto (LUCRO_REAL, LUCRO_PRESUMIDO, SIMPLES...) e codigos da ECF (0010 FORMA_TRIB: 1/2 real, 3/4/5/7 presumido).
  private async resolverRegime(companyId: string, company: any, data: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      'SELECT forma_tributacao FROM company_tax_regimes WHERE company_id = $1::uuid AND dt_ini <= $2::date AND (dt_fin IS NULL OR dt_fin >= $2::date) ORDER BY dt_ini DESC LIMIT 1',
      companyId, data);
    const historico = !!rows[0]?.forma_tributacao;
    const f = String(historico ? rows[0].forma_tributacao : '').toUpperCase().trim();
    const fonte = historico ? 'historico de regimes (company_tax_regimes)' : 'sem regime cadastrado para a data';
    const base = { fonte, historico, erro: null as string | null };
    if (f.includes('REAL') || f === '1' || f === '2') return { ...base, forma: 'LUCRO_REAL', opSimpNac: 1, pis: 1.65, cofins: 7.6 };
    if (f.includes('PRESUMIDO') || ['3', '4', '5', '7'].includes(f)) return { ...base, forma: 'LUCRO_PRESUMIDO', opSimpNac: 1, pis: 0.65, cofins: 3.0 };
    if (f.includes('SIMPLES')) return { ...base, forma: 'SIMPLES_NACIONAL', opSimpNac: 3, pis: 0, cofins: 0 };
    return { ...base, forma: f || 'NAO_INFORMADO', opSimpNac: 1, pis: 0, cofins: 0,
      erro: historico ? 'Regime tributario nao suportado na data ' + data + ' (' + f + ').'
        : 'Regime tributario nao cadastrado no historico da empresa para a data ' + data + '. Cadastre o regime do exercicio.' };
  }

  private async proximoNDps(companyId: string): Promise<number> {
    const last = await this.prisma.nfseNacionalEmissao.findFirst({
      where: { companyId, serieRps: SERIE },
      orderBy: { numeroRps: 'desc' },
      select: { numeroRps: true },
    });
    return (last?.numeroRps ?? 0) + 1;
  }

  // Regime vigente na data - exibido no modal para confirmacao antes de preparar a DPS
  async consultarRegime(companyId: string, data: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? '')) throw new BadRequestException('Data inválida (AAAA-MM-DD).');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return this.resolverRegime(companyId, company, data);
  }

  async preparar(companyId: string, dto: PrepararLocacaoDto, userId: string) {
    if (!dto?.rentalContractId) throw new BadRequestException('Informe o contrato de locação.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.dataPagamento ?? '')) throw new BadRequestException('Data do pagamento inválida (AAAA-MM-DD).');
    if (dto.vencimentoOriginal && !/^\d{4}-\d{2}-\d{2}$/.test(dto.vencimentoOriginal)) throw new BadRequestException('Vencimento original inválido (AAAA-MM-DD).');
    const vTotOper = r2(Number(dto.valorRecebido));
    if (!(vTotOper > 0)) throw new BadRequestException('Informe o valor recebido.');
    const ambiente: 'HOMOLOGACAO' | 'PRODUCAO' = dto.ambiente === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

    const contrato = await this.prisma.rentalContract.findFirst({
      where: { id: dto.rentalContractId, companyId, deletedAt: null },
      include: { fixedAsset: true },
    });
    if (!contrato) throw new NotFoundException('Contrato de locação não encontrado nesta empresa.');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });

    const erros: string[] = [];
    const extras = Array.from(new Set((dto.unidadesAdicionais ?? []).filter(x => x && x !== contrato.fixedAssetId)));
    const outras = extras.length
      ? await this.prisma.fixedAsset.findMany({ where: { id: { in: extras }, companyId, deletedAt: null } })
      : [];
    if (outras.length !== extras.length) erros.push('Unidade adicional não encontrada nesta empresa.');
    const unidades = [contrato.fixedAsset, ...outras];

    for (const u of unidades) {
      const cod = u.internalCode;
      if (String(u.cib ?? '').length !== 8) erros.push(cod + ': CIB ausente ou inválido (8 caracteres, 7 + DV).');
      if (dig(u.zipCode).length !== 8) erros.push(cod + ': CEP inválido.');
      if (!u.street) erros.push(cod + ': logradouro não informado.');
      if (!u.number) erros.push(cod + ': número não informado.');
      if (dig(u.ibgeCode).length !== 7) erros.push(cod + ': município (IBGE) não informado.');
      if (!u.nbsLocacao) erros.push(cod + ': uso na NFS-e (residencial / não residencial) não informado.');
      if (dig(u.iptuRegistration).length > 30) erros.push(cod + ': inscrição imobiliária com mais de 30 dígitos.');
    }
    const cMun = dig(contrato.fixedAsset.ibgeCode);
    if (unidades.some(u => dig(u.ibgeCode) !== cMun)) erros.push('Todas as unidades da nota devem ser do mesmo município.');
    const nbs = contrato.fixedAsset.nbsLocacao ?? '';
    if (unidades.some(u => (u.nbsLocacao ?? '') !== nbs)) erros.push('Todas as unidades da nota devem ter o mesmo uso (residencial / não residencial).');

    const prestCnpj = dig(company.taxId);
    if (prestCnpj.length !== 14) erros.push('CNPJ da empresa inválido.');
    const cLocEmi = dig(company.codMun);
    const regime = await this.resolverRegime(companyId, company, dto.dataPagamento);
    if (regime.erro) erros.push(regime.erro);
    else if (dto.regimeConfirmado !== regime.forma) erros.push('Confirme o regime tributario vigente na data do pagamento (' + regime.forma + ').');
    if (cLocEmi.length !== 7) erros.push('Código IBGE do município da empresa (cod_mun) não informado no cadastro.');

    const tomDoc = dig(contrato.tenantTaxId);
    if (tomDoc.length !== 11 && tomDoc.length !== 14) erros.push('CPF/CNPJ do locatário inválido no contrato.');

    if (erros.length) throw new BadRequestException('Cadastro incompleto para a NFS-e de locação: ' + erros.join(' | '));

    const descInc = r2(Number(dto.descontoIncondicionado ?? 0));
    const descCond = r2(Number(dto.descontoCondicionado ?? 0));
    const vServ = vTotOper; // pCopropriedade 100% (E0433)
    const residencial = nbs === NBS_RESIDENCIAL;

    // Ajustes da base do IBS/CBS por unidade (gAjusteBCLocImoveis)
    const ajustes = new Map<string, { tp: string; x?: string; v: number }[]>();
    unidades.forEach(u => ajustes.set(u.id, []));
    for (const d of dto.deducoes ?? []) {
      const v = r2(Number(d.valor));
      if (!(v > 0)) continue;
      const tp = String(d.tipo ?? '').padStart(2, '0');
      if (!['01', '02', '03', '99'].includes(tp)) throw new BadRequestException('Tipo de dedução inválido: ' + d.tipo);
      if (tp === '99' && !d.descricao) throw new BadRequestException('Descreva a dedução do tipo 99.');
      const alvo = d.fixedAssetId && ajustes.has(d.fixedAssetId) ? d.fixedAssetId : contrato.fixedAssetId;
      ajustes.get(alvo)!.push({ tp, x: tp === '99' ? d.descricao : undefined, v });
    }
    let totalAjustes = 0;
    ajustes.forEach(l => l.forEach(a => { totalAjustes = r2(totalAjustes + a.v); }));
    if (residencial && dto.usarRedutorSocial !== false) {
      for (const u of unidades) {
        const disponivel = r2(vServ - descInc - totalAjustes);
        const red = r2(Math.min(REDUTOR_SOCIAL, Math.max(disponivel, 0)));
        if (red > 0) { ajustes.get(u.id)!.push({ tp: '04', v: red }); totalAjustes = r2(totalAjustes + red); }
      }
    }
    if (totalAjustes > vServ) throw new BadRequestException('As deduções superam o valor do serviço (E1564).');

    const vBCPisCofins = r2(vServ - descInc);
    const vPis = r2(vBCPisCofins * regime.pis / 100);
    const vCofins = r2(vBCPisCofins * regime.cofins / 100);

    const nDps = await this.proximoNDps(companyId);
    const idDps = 'DPS' + cLocEmi + '2' + prestCnpj + SERIE.padStart(5, '0') + String(nDps).padStart(15, '0');
    const agora = new Date();
    const dhEmi = new Date(agora.getTime() - 3 * 3600 * 1000 - 60 * 1000).toISOString().slice(0, 19) + '-03:00';
    const dCompet = dto.dataPagamento;
    if (dCompet > dhEmi.slice(0, 10)) throw new BadRequestException('A data do pagamento não pode ser futura (E0015).');
    const competAluguel = dto.competencia && /^\d{4}-\d{2}$/.test(dto.competencia) ? dto.competencia : dCompet.slice(0, 7);
    const descServ = (dto.descricao ?? '').trim()
      || ('Locação de imóvel ' + (residencial ? 'residencial' : 'não residencial') + ' - '
        + unidades.map(u => u.internalCode).join(', ') + ' - aluguel ' + competAluguel.slice(5, 7) + '/' + competAluguel.slice(0, 4)
        + (contrato.contractNumber ? ' - contrato ' + contrato.contractNumber : ''));

    // ── DPS (ordem dos elementos conforme Anexo VI - Leiaute DPS_NFS-e RT) ──
    const el = (p: any, n: string, v: any) => { if (v !== undefined && v !== null && v !== '') p.ele(n).txt(String(v)).up(); };
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(NS, 'DPS', { versao: VERSAO_DPS, xmlns: NS });
    const inf = root.ele('infDPS', { Id: idDps });
    el(inf, 'tpAmb', ambiente === 'PRODUCAO' ? 1 : 2);
    el(inf, 'dhEmi', dhEmi);
    el(inf, 'verAplic', VER_APLIC);
    el(inf, 'serie', SERIE);
    el(inf, 'nDPS', nDps);
    el(inf, 'dCompet', dCompet);
    el(inf, 'tpEmit', 1);
    el(inf, 'finNFSe', 0);
    el(inf, 'cLocEmi', cLocEmi);
    const prest = inf.ele('prest');
    el(prest, 'CNPJ', prestCnpj);
    const regTrib = prest.ele('regTrib');
    el(regTrib, 'opSimpNac', regime.opSimpNac);
    if (regime.opSimpNac === 3) el(regTrib, 'regApTribSN', 1);
    el(regTrib, 'regEspTrib', 0);
    const toma = inf.ele('toma');
    el(toma, tomDoc.length === 14 ? 'CNPJ' : 'CPF', tomDoc);
    el(toma, 'xNome', String(contrato.tenantName).slice(0, 150));
    const serv = inf.ele('serv');
    el(serv.ele('locPrest'), 'cLocPrestacao', cMun);
    const cServ = serv.ele('cServ');
    el(cServ, 'cTribNac', CTRIBNAC);
    el(cServ, 'cNBS', dig(nbs));
    el(cServ, 'xDescServ', descServ.slice(0, 2000));
    const val = inf.ele('valores');
    el(val.ele('vServPrest'), 'vServ', money(vServ));
    if (descInc > 0 || descCond > 0) {
      const dc = val.ele('vDescCondIncond');
      if (descInc > 0) el(dc, 'vDescIncond', money(descInc));
      if (descCond > 0) el(dc, 'vDescCond', money(descCond));
    }
    const trib = val.ele('trib');
    const tribMun = trib.ele('tribMun');
    el(tribMun, 'tribISSQN', 4);      // nao incidencia do ISS na locacao
    el(tribMun, 'tpRetISSQN', 1);
    if (regime.pis > 0 || regime.cofins > 0) {
    const pc = trib.ele('tribFed').ele('piscofins');
    el(pc, 'CST', '01');
    el(pc, 'vBCPisCofins', money(vBCPisCofins));
    el(pc, 'pAliqPis', regime.pis.toFixed(2));
    el(pc, 'pAliqCofins', regime.cofins.toFixed(2));
    el(pc, 'vPis', money(vPis));
    el(pc, 'vCofins', money(vCofins));
    }
    el(trib.ele('totTrib'), 'indTotTrib', 0);
    const ibscbs = inf.ele('IBSCBS');
    el(ibscbs, 'indFinal', tomDoc.length === 11 ? 1 : 0);
    el(ibscbs, 'cIndOp', CIND_OP);
    // INDDEST_NO_IBSCBS: o XSD da prod. restrita de 20/10/2026 (NT 009 release 1) exige indDest dentro de IBSCBS, apos tpEnteGov.
    // Revisar quando o release 2 (NT 009 item 2.11: indDest/dest na raiz do infDPS, apos toma) entrar no ar.
    el(ibscbs, 'indDest', 0);
    const imovel = ibscbs.ele('imovel');
    el(imovel, 'cMun', cMun);
    const gLoc = imovel.ele('gLocacao');
    el(gLoc, 'pCopropriedade', '100.00');
    el(gLoc, 'vTotOper', money(vTotOper));
    if (descInc > 0) el(gLoc, 'vDescIncondTot', money(descInc));
    if (descCond > 0) el(gLoc, 'vDescCondTot', money(descCond));
    if (dto.vencimentoOriginal) el(gLoc, 'dVencOrig', dto.vencimentoOriginal);
    for (const u of unidades) {
      const gu = imovel.ele('gUnidImob');
      el(gu, 'inscImobFisc', dig(u.iptuRegistration));
      el(gu, 'cCIB', u.cib);
      // END_SO_SEM_CIB: no XSD da prod. restrita (20/10/2026) o endereco da unidade so entra quando nao ha CIB.
      if (!u.cib) {
        const end = gu.ele('end');
        el(end, 'CEP', dig(u.zipCode));
        el(end, 'xLgr', String(u.street).slice(0, 255));
        el(end, 'nro', String(u.number).slice(0, 60));
        el(end, 'xCpl', u.complement ? String(u.complement).slice(0, 156) : '');
        el(end, 'xBairro', u.neighborhood ? String(u.neighborhood).slice(0, 60) : '');
      }
      for (const a of ajustes.get(u.id) ?? []) {
        const ga = gu.ele('gAjusteBCLocImoveis');
        el(ga, 'tpAjusteBCLocImoveis', a.tp);
        if (a.x) el(ga, 'xTpAjusteBCLocImoveis', String(a.x).slice(0, 150));
        el(ga, 'vAjusteBCLocImoveis', money(a.v));
      }
    }
    const itrib = ibscbs.ele('valores').ele('trib');
    el(itrib, 'CST', CST_IBSCBS);
    el(itrib, 'cClassTrib', CCLASSTRIB);
    const xml = root.end({ prettyPrint: false });

    const vBCIbsCbs = r2(vServ - descInc - totalAjustes - vPis - vCofins);
    const resumo = {
      idDps, nDps, ambiente, url: SEFIN_URLS[ambiente], dCompet, competenciaAluguel: competAluguel,
      vServ, descontoIncondicionado: descInc, descontoCondicionado: descCond, totalAjustes, vPis, vCofins, vBCIbsCbs,
      cbsEstimada: r2(vBCIbsCbs * 0.009 * 0.3), ibsEstimado: r2(vBCIbsCbs * 0.001 * 0.3),
      regime: { forma: regime.forma, fonte: regime.fonte, historico: regime.historico, pis: regime.pis, cofins: regime.cofins },
      unidades: unidades.map(u => ({ codigo: u.internalCode, cib: u.cib, ajustes: ajustes.get(u.id) })),
    };

    const reg = await this.prisma.nfseNacionalEmissao.create({
      data: {
        companyId,
        numeroRps: nDps,
        serieRps: SERIE,
        dataEmissao: agora,
        competencia: dCompet.slice(0, 7),
        prestadorCnpj: prestCnpj,
        tomadorCnpj: tomDoc.length === 14 ? tomDoc : null,
        tomadorCpf: tomDoc.length === 11 ? tomDoc : null,
        tomadorNome: String(contrato.tenantName).slice(0, 150),
        codigoServico: CTRIBNAC,
        descricaoServico: descServ,
        valorServico: new Decimal(money(vServ)),
        valorDeducoes: new Decimal(money(totalAjustes)),
        valorIss: new Decimal('0'),
        aliquotaIss: new Decimal('0'),
        issRetido: false,
        valorLiquido: new Decimal(money(vServ - descInc - descCond)),
        codigoIbge: cMun,
        ambiente,
        status: 'PREPARADA',
        xmlDps: xml,
        createdById: userId,
        tipoOperacao: 'LOCACAO',
        rentalContractId: contrato.id,
        arEntryId: dto.arEntryId || null,
        idDps,
        dCompet: new Date(dCompet + 'T12:00:00Z'),
        dataPagamento: new Date(dCompet + 'T12:00:00Z'),
        vTotOper: new Decimal(money(vTotOper)),
        vAjusteBcLoc: new Decimal(money(totalAjustes)),
        vPis: new Decimal(money(vPis)),
        vCofins: new Decimal(money(vCofins)),
        cstIbsCbs: CST_IBSCBS,
        cClassTrib: CCLASSTRIB,
        dadosOperacao: { ...dto, resumo } as any,
      },
    });
    return { id: reg.id, idDps, xml, url: SEFIN_URLS[ambiente], resumo };
  }

  // A1 (padrao): a API assina a DPS e envia a Sefin Nacional por mTLS. A3: LEDGR Agent (etapa 3b) -> registrarRetorno.
  // Assinatura A1 da DPS (xml-crypto 6): RSA-SHA256, c14n, enveloped; Signature como ultimo filho de <DPS>.
  // Propria desta rotina para nao alterar SigningService.signXml (usado por outras rotinas de NFS-e).
  private async assinarDpsA1(xml: string, certId: string, idDps: string): Promise<string> {
    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(certId);
    try {
      const { SignedXml } = await import('xml-crypto');
      const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certPem,
        signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      });
      sig.addReference({
        xpath: `//*[@Id='${idDps}']`,
        transforms: [
          'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        ],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });
      sig.computeSignature(xml, { location: { reference: "/*[local-name(.)='DPS']", action: 'append' } });
      return sig.getSignedXml();
    } catch (err: any) {
      throw new BadRequestException(`Falha na assinatura A1 da DPS: ${err.message}`);
    }
  }

  async enviar(companyId: string, id: string, certIdInformado?: string) {
    const em = await this.prisma.nfseNacionalEmissao.findFirst({ where: { id, companyId, tipoOperacao: 'LOCACAO' } });
    if (!em) throw new NotFoundException('Emissão de locação não encontrada.');
    if (em.status !== 'PREPARADA') throw new BadRequestException('Só é possível enviar uma DPS preparada (status atual: ' + em.status + '). Prepare novamente.');
    if (!em.xmlDps || !em.idDps) throw new BadRequestException('DPS sem XML. Prepare novamente.');
    const cert = await this.prisma.certificate.findFirst({
      where: { companyId, isActive: true, type: 'A1', validTo: { gt: new Date() }, ...(certIdInformado ? { id: certIdInformado } : {}) },
      orderBy: { validTo: 'desc' },
      select: { id: true, subject: true },
    });
    if (!cert) throw new BadRequestException('Nenhum certificado A1 ativo e válido desta empresa. Carregue o A1 em Certificados ou use o A3 pelo LEDGR Agent.');
    if (em.prestadorCnpj && !dig(cert.subject).includes(em.prestadorCnpj)) throw new BadRequestException('O certificado selecionado não é do CNPJ ' + em.prestadorCnpj + '.');
    const xmlAssinado = await this.assinarDpsA1(em.xmlDps, cert.id, em.idDps);
    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(cert.id);
    const httpsAgent = new https.Agent({ key: privateKeyPem, cert: certPem });
    const url = SEFIN_URLS[em.ambiente === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO'];
    const payload = { dpsXmlGZipB64: gzipSync(Buffer.from(xmlAssinado, 'utf-8')).toString('base64') };
    await this.prisma.nfseNacionalEmissao.update({ where: { id }, data: { status: 'ENVIANDO', certId: cert.id, xmlDps: xmlAssinado } });
    let httpStatus = 0;
    let resposta: any = null;
    try {
      const resp = await axios.post(url, payload, {
        httpsAgent, timeout: 60000, validateStatus: () => true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      httpStatus = resp.status;
      resposta = resp.data;
    } catch (e: any) {
      resposta = 'Falha de comunicação com a Sefin Nacional: ' + (e?.message ?? String(e));
    }
    return this.registrarRetorno(companyId, id, { httpStatus, resposta, xmlAssinado });
  }

  // Retorno da Sefin Nacional (A1 pela API ou A3 trazido pelo navegador/Agent)
  async registrarRetorno(companyId: string, id: string, body: any) {
    const em = await this.prisma.nfseNacionalEmissao.findFirst({ where: { id, companyId, tipoOperacao: 'LOCACAO' } });
    if (!em) throw new NotFoundException('Emissão de locação não encontrada.');
    let r: any = body?.resposta;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { /* resposta em texto */ } }
    const comum: any = {
      xmlDps: body?.xmlAssinado || em.xmlDps,
      certThumbprint: body?.thumbprint ? String(body.thumbprint).slice(0, 64) : em.certThumbprint,
    };
    const chave = r?.chaveAcesso ?? r?.ChaveAcesso;
    if (chave) {
      let xmlNfse: string | null = null;
      const gz = r?.nfseXmlGZipB64;
      if (gz) { try { xmlNfse = gunzipSync(Buffer.from(String(gz), 'base64')).toString('utf-8'); } catch (e) { xmlNfse = null; } }
      const nNfse = xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] ?? null;
      return this.prisma.nfseNacionalEmissao.update({
        where: { id },
        data: { ...comum, status: 'AUTORIZADA', chaveNfse: String(chave).slice(0, 50), numeroNfse: nNfse, xmlNfse, motivoRejeicao: null },
      });
    }
    const errs: any[] = Array.isArray(r?.erros) ? r.erros : Array.isArray(r?.Erros) ? r.Erros : [];
    const motivo = errs.length
      ? errs.map((e: any) => [e.Codigo ?? e.codigo, e.Descricao ?? e.descricao, e.Complemento ?? e.complemento].filter(Boolean).join(' - ')).join(' | ')
      : 'HTTP ' + (body?.httpStatus ?? '?') + ': ' + (typeof r === 'string' ? r : JSON.stringify(r ?? body ?? {})).slice(0, 1500);
    return this.prisma.nfseNacionalEmissao.update({
      where: { id },
      data: { ...comum, status: 'REJEITADA', motivoRejeicao: motivo.slice(0, 4000) },
    });
  }

  listar(companyId: string, rentalContractId?: string) {
    return this.prisma.nfseNacionalEmissao.findMany({
      where: { companyId, tipoOperacao: 'LOCACAO', ...(rentalContractId ? { rentalContractId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, numeroRps: true, idDps: true, status: true, ambiente: true, dCompet: true, competencia: true,
        tomadorNome: true, vTotOper: true, vAjusteBcLoc: true, vPis: true, vCofins: true, chaveNfse: true,
        numeroNfse: true, motivoRejeicao: true, rentalContractId: true, createdAt: true,
      },
    });
  }
}
