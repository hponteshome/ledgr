// apps/api/src/modules/hr/esocial-s13/esocial-s13.service.ts
// LEDGR - eSocial S-1.3 (17/11/2026). Reconstrucao integral: o modulo antigo (esocial-events/esocial-transmission) nao e usado.
// Etapa 1: gera, assina (XMLDSig enveloped, Reference URI="", rsa-sha256, c14n - Manual do Desenvolvedor v1.16)
// e valida cada evento contra o XSD oficial (resources/esocial/S-1.3/eventos). Envio/consulta: etapa 2.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { SigningService } from '../../../core/certificates/signing.service';

const VERSAO = 'v_S_01_03_00';
const VER_PROC = 'LEDGR-1.0';
const ALIQ_CI = 0.11; // contribuinte individual - desconto do segurado (Lei 8.212/91, art. 21 e 30)
const TETO_INSS: Record<string, number> = { '2026': 8475.55 }; // teto do salario de contribuicao por ano
const RUBRICAS = [
  { cod: 'PL001', dsc: 'Pró-labore', nat: '3508', tp: '1', cp: '11', ir: '11', fgts: '00' },
  { cod: 'PL002', dsc: 'INSS contribuinte individual', nat: '9201', tp: '2', cp: '31', ir: '41', fgts: '00' },
];
const DEF: Record<string, { evt: string; grupo: number; etapa: number }> = {
  'S-1000': { evt: 'evtInfoEmpregador', grupo: 1, etapa: 1 },
  'S-1005': { evt: 'evtTabEstab', grupo: 1, etapa: 2 },
  'S-1020': { evt: 'evtTabLotacao', grupo: 1, etapa: 2 },
  'S-1010': { evt: 'evtTabRubrica', grupo: 1, etapa: 2 },
  'S-1200': { evt: 'evtRemun', grupo: 3, etapa: 3 },
  'S-1210': { evt: 'evtPgtos', grupo: 3, etapa: 3 },
  'S-1299': { evt: 'evtFechaEvPer', grupo: 3, etapa: 4 },
};
const RE_COMP = /^\d{4}-(0[1-9]|1[0-2])$/;
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);

interface EvtDef { tipo: string; chave: string; perApur: string | null; corpo: string }

@Injectable()
export class EsocialS13Service {
  private seq = 0;
  constructor(private readonly prisma: PrismaService, private readonly signing: SigningService) {}

  // ── infraestrutura ────────────────────────────────────────────────────────
  private novoId(raiz8: string): string {
    const d = new Date(); const p = (n: number, l = 2) => String(n).padStart(l, '0');
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    this.seq = (this.seq % 99999) + 1;
    return `ID1${raiz8}000000${ts}${p(this.seq, 5)}`; // ID + tpInsc + CNPJ base completado com zeros + data/hora + sequencial
  }

  private dirXsd(): string {
    const cands = [
      path.join(process.cwd(), 'resources', 'esocial', 'S-1.3', 'eventos'),
      path.join(process.cwd(), 'apps', 'api', 'resources', 'esocial', 'S-1.3', 'eventos'),
      path.join(__dirname, '..', '..', '..', '..', 'resources', 'esocial', 'S-1.3', 'eventos'),
      path.join(__dirname, '..', '..', '..', '..', '..', 'resources', 'esocial', 'S-1.3', 'eventos'),
    ];
    const d = cands.find(c => fs.existsSync(path.join(c, 'tipos.xsd')));
    if (!d) throw new BadRequestException('XSD do eSocial S-1.3 nao encontrado em resources/esocial/S-1.3/eventos.');
    return d;
  }

  private async validar(xml: string, xsd: string): Promise<string | null> {
    const dir = this.dirXsd();
    const ler = (f: string) => ({ fileName: f, contents: fs.readFileSync(path.join(dir, f), 'utf8') });
    const lib: any = await (new Function('m', 'return import(m)'))('xmllint-wasm');
    const r = await lib.validateXML({
      xml: [{ fileName: 'evento.xml', contents: xml }],
      schema: [ler(xsd)],
      preload: [ler('tipos.xsd'), ler('xmldsig-core-schema.xsd')],
    });
    if (r.valid) return null;
    return (r.errors || []).map((e: any) => e.message || e.rawMessage || String(e)).join(' | ') || 'XML invalido (sem detalhe do validador).';
  }

  private async certId(companyId: string): Promise<string> {
    const c = await (this.prisma as any).certificate.findFirst({
      where: { companyId, isActive: true, validTo: { gt: new Date() } },
      orderBy: { validTo: 'desc' }, select: { id: true },
    });
    if (!c) throw new BadRequestException('Empresa sem certificado digital A1 ativo (Sistema > Certificados Digitais).');
    return c.id;
  }

  private async assinar(xml: string, certId: string): Promise<string> {
    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(certId);
    const { SignedXml } = await import('xml-crypto');
    const sig: any = new (SignedXml as any)({
      privateKey: privateKeyPem,
      publicCert: certPem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });
    sig.addReference({
      xpath: '/*',
      isEmptyUri: true,
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    });
    sig.computeSignature(xml, { location: { reference: '/*', action: 'append' } });
    return sig.getSignedXml();
  }

  private envelope(tipo: string, id: string, corpo: string): string {
    const evt = DEF[tipo].evt;
    return `<eSocial xmlns="http://www.esocial.gov.br/schema/evt/${evt}/${VERSAO}"><${evt} Id="${id}">${corpo}</${evt}></eSocial>`;
  }

  // ── geracao do pacote de uma competencia ───────────────────────────────────
  async gerarPacote(companyId: string, dto: any) {
    const tpAmb = Number(dto?.tpAmb);
    if (![1, 2].includes(tpAmb)) throw new BadRequestException('Ambiente invalido (1 = producao, 2 = producao restrita).');
    const perApur = String(dto?.perApur || '');
    if (!RE_COMP.test(perApur)) throw new BadRequestException('Competencia invalida (AAAA-MM).');

    const emp: any = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!emp) throw new NotFoundException('Empresa nao encontrada.');
    const cnpj = String(emp.taxId || '').replace(/\D/g, '');
    if (cnpj.length !== 14) throw new BadRequestException('CNPJ da empresa invalido no cadastro.');
    const raiz = cnpj.slice(0, 8);
    const cnae = String(emp.mainActivity || '').replace(/\D/g, '').slice(0, 7);
    if (cnae.length !== 7) throw new BadRequestException('CNAE principal ausente no cadastro da empresa (cartao CNPJ).');
    const par = await this.prisma.esocialS13Config.findUnique({ where: { companyId } });
    if (!par) throw new BadRequestException('Parametros eSocial da empresa nao cadastrados (FPAS, terceiros, lotacao).');

    const configs = await this.prisma.proLaboreConfig.findMany({
      where: { companyId, deletedAt: null, shareholderId: { not: null } },
      include: { person: { select: { id: true, cpf: true, fullName: true, birthDate: true } } },
      orderBy: { competenciaIni: 'asc' },
    });
    if (!configs.length) throw new BadRequestException('Nenhuma vigencia de pro-labore cadastrada (tela Pro-labore).');
    const iniValid = configs[0].competenciaIni; // primeira competencia com remuneracao da empresa
    const vigente = (personId: string, comp: string) =>
      configs.find(c => c.personId === personId && c.competenciaIni <= comp && (!c.competenciaFim || c.competenciaFim >= comp));

    const [ano, mes] = perApur.split('-').map(Number);
    const pgs = await this.prisma.proLaborePagamento.findMany({
      where: { companyId, deletedAt: null, tipo: 'PRO_LABORE', dtPagamento: { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) } },
      orderBy: { dtPagamento: 'asc' },
    });
    const certId = await this.certId(companyId);

    const ideTab = `<procEmi>1</procEmi><verProc>${VER_PROC}</verProc>`;
    const ideEvtTab = `<ideEvento><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>`;
    const ideEmp = `<ideEmpregador><tpInsc>1</tpInsc><nrInsc>${raiz}</nrInsc></ideEmpregador>`;
    const tab = esc(par.ideTabRubr);
    const evts: EvtDef[] = [];

    // tabelas
    if (tpAmb === 2) {
      evts.push({ tipo: 'S-1000', chave: 'S-1000:' + raiz, perApur: null, corpo: ideEvtTab + ideEmp +
        `<infoEmpregador><inclusao><idePeriodo><iniValid>${par.iniValidS1000}</iniValid></idePeriodo>` +
        `<infoCadastro><classTrib>${par.classTrib}</classTrib><indCoop>0</indCoop><indConstr>0</indConstr><indDesFolha>0</indDesFolha><indOptRegEletron>0</indOptRegEletron></infoCadastro>` +
        `</inclusao></infoEmpregador>` });
    }
    evts.push({ tipo: 'S-1005', chave: 'S-1005:' + cnpj, perApur: null, corpo: ideEvtTab + ideEmp +
      `<infoEstab><inclusao><ideEstab><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc><iniValid>${iniValid}</iniValid></ideEstab>` +
      `<dadosEstab><cnaePrep>${cnae}</cnaePrep></dadosEstab></inclusao></infoEstab>` });
    evts.push({ tipo: 'S-1020', chave: 'S-1020:' + par.codLotacao, perApur: null, corpo: ideEvtTab + ideEmp +
      `<infoLotacao><inclusao><ideLotacao><codLotacao>${esc(par.codLotacao)}</codLotacao><iniValid>${iniValid}</iniValid></ideLotacao>` +
      `<dadosLotacao><tpLotacao>01</tpLotacao><fpasLotacao><fpas>${par.fpas}</fpas><codTercs>${par.codTercs}</codTercs></fpasLotacao></dadosLotacao>` +
      `</inclusao></infoLotacao>` });
    for (const rb of RUBRICAS) {
      evts.push({ tipo: 'S-1010', chave: 'S-1010:' + rb.cod, perApur: null, corpo: ideEvtTab + ideEmp +
        `<infoRubrica><inclusao><ideRubrica><codRubr>${rb.cod}</codRubr><ideTabRubr>${tab}</ideTabRubr><iniValid>${iniValid}</iniValid></ideRubrica>` +
        `<dadosRubrica><dscRubr>${esc(rb.dsc)}</dscRubr><natRubr>${rb.nat}</natRubr><tpRubr>${rb.tp}</tpRubr><codIncCP>${rb.cp}</codIncCP><codIncIRRF>${rb.ir}</codIncIRRF><codIncFGTS>${rb.fgts}</codIncFGTS></dadosRubrica>` +
        `</inclusao></infoRubrica>` });
    }

    // S-1200: competencia do pacote + competencias pagas dentro do mes (exigidas pelo S-1210)
    const pares = new Map<string, { personId: string; comp: string }>();
    for (const c of configs) if (vigente(c.personId, perApur)) pares.set(c.personId + '|' + perApur, { personId: c.personId, comp: perApur });
    for (const p of pgs) {
      if (!p.competencia) throw new BadRequestException(`Pagamento de ${ymd(p.dtPagamento)} sem competencia informada.`);
      pares.set(p.personId + '|' + p.competencia, { personId: p.personId, comp: p.competencia });
    }
    const item = (cod: string, v: number) => `<itensRemun><codRubr>${cod}</codRubr><ideTabRubr>${tab}</ideTabRubr><vrRubr>${dec(v)}</vrRubr><indApurIR>0</indApurIR></itensRemun>`;
    for (const { personId, comp } of Array.from(pares.values())) {
      const cfg = vigente(personId, comp);
      if (!cfg) throw new BadRequestException(`Sem vigencia de pro-labore para ${comp}.`);
      const teto = TETO_INSS[comp.slice(0, 4)];
      if (!teto) throw new BadRequestException(`Teto do INSS de ${comp.slice(0, 4)} nao cadastrado.`);
      if (!cfg.cbo) throw new BadRequestException('Informe o CBO na configuracao do pro-labore.');
      const pes = cfg.person;
      if (!pes.birthDate) throw new BadRequestException(`Data de nascimento ausente na ficha da Pessoa (${pes.fullName}).`);
      const bruto = Number(cfg.valorBruto);
      const inss = Math.round(Math.min(bruto, teto) * ALIQ_CI * 100) / 100;
      evts.push({ tipo: 'S-1200', chave: `S-1200:${comp}:${pes.cpf}`, perApur: comp, corpo:
        `<ideEvento><indRetif>1</indRetif><indApuracao>1</indApuracao><perApur>${comp}</perApur><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>` + ideEmp +
        `<ideTrabalhador><cpfTrab>${pes.cpf}</cpfTrab><infoComplem><nmTrab>${esc(pes.fullName)}</nmTrab><dtNascto>${ymd(pes.birthDate)}</dtNascto></infoComplem></ideTrabalhador>` +
        `<dmDev><ideDmDev>PL${comp.replace('-', '')}</ideDmDev><codCateg>${cfg.categoriaEsocial}</codCateg>` +
        `<infoPerApur><ideEstabLot><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc><codLotacao>${esc(par.codLotacao)}</codLotacao>` +
        `<remunPerApur>${item('PL001', bruto)}${item('PL002', inss)}</remunPerApur></ideEstabLot></infoPerApur>` +
        // sem S-2300: categoria 7XX informa os dados contratuais no proprio S-1200
        `<infoComplCont><codCBO>${cfg.cbo}</codCBO></infoComplCont></dmDev>` });
    }

    // S-1210: pagamentos feitos dentro do mes (regime de caixa)
    const porPessoa = new Map<string, typeof pgs>();
    for (const p of pgs) porPessoa.set(p.personId, [...(porPessoa.get(p.personId) || []), p]);
    for (const [personId, lista] of Array.from(porPessoa.entries())) {
      const pes = configs.find(c => c.personId === personId)!.person;
      evts.push({ tipo: 'S-1210', chave: `S-1210:${perApur}:${pes.cpf}`, perApur, corpo:
        `<ideEvento><indRetif>1</indRetif><perApur>${perApur}</perApur><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>` + ideEmp +
        `<ideBenef><cpfBenef>${pes.cpf}</cpfBenef>` +
        lista.map(p => `<infoPgto><dtPgto>${ymd(p.dtPagamento)}</dtPgto><tpPgto>1</tpPgto><perRef>${p.competencia}</perRef><ideDmDev>PL${String(p.competencia).replace('-', '')}</ideDmDev><vrLiq>${dec(Number(p.valorLiquido))}</vrLiq></infoPgto>`).join('') +
        `</ideBenef>` });
    }

    // S-1299: fechamento com envio a DCTFWeb
    const temRemun = Array.from(pares.values()).some(x => x.comp === perApur);
    evts.push({ tipo: 'S-1299', chave: `S-1299:${perApur}`, perApur, corpo:
      `<ideEvento><indApuracao>1</indApuracao><perApur>${perApur}</perApur><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>` + ideEmp +
      `<infoFech><evtRemun>${temRemun ? 'S' : 'N'}</evtRemun><evtPgtos>${pgs.length ? 'S' : 'N'}</evtPgtos><evtComProd>N</evtComProd>` +
      `<evtContratAvNP>N</evtContratAvNP><evtInfoComplPer>N</evtInfoComplPer><transDCTFWeb>S</transDCTFWeb></infoFech>` });

    // grava: assina e valida; eventos ja enviados/processados nao sao regerados
    const out: any[] = [];
    for (const e of evts) {
      const ex = await this.prisma.esocialS13Evento.findUnique({ where: { companyId_tpAmb_chave: { companyId, tpAmb, chave: e.chave } } });
      if (ex && ['ENVIADO', 'PROCESSADO'].includes(ex.status)) { out.push({ chave: e.chave, status: ex.status, mantido: true }); continue; }
      const id = this.novoId(raiz);
      let xml = this.envelope(e.tipo, id, e.corpo);
      let status = 'VALIDADO'; let validacao: string | null = null;
      try {
        xml = await this.assinar(xml, certId);
        validacao = await this.validar(xml, DEF[e.tipo].evt + '.xsd');
        if (validacao) status = 'INVALIDO';
      } catch (err: any) { status = 'INVALIDO'; validacao = 'Falha: ' + (err?.message || String(err)); }
      const data = { tipo: e.tipo, perApur: e.perApur, eventoId: id, grupo: DEF[e.tipo].grupo, etapa: DEF[e.tipo].etapa, xml, status, validacao,
        loteId: null, nrRecibo: null, cdResposta: null, descResposta: null };
      if (ex) await this.prisma.esocialS13Evento.update({ where: { id: ex.id }, data });
      else await this.prisma.esocialS13Evento.create({ data: { ...data, companyId, tpAmb, chave: e.chave } });
      out.push({ chave: e.chave, status, validacao });
    }
    return { tpAmb, perApur, eventos: out };
  }

  // ── consultas ──────────────────────────────────────────────────────────────
  listar(companyId: string, tpAmb: number) {
    return this.prisma.esocialS13Evento.findMany({
      where: { companyId, tpAmb },
      select: { id: true, tipo: true, perApur: true, chave: true, eventoId: true, status: true, validacao: true, nrRecibo: true,
        cdResposta: true, descResposta: true, etapa: true, updatedAt: true },
      orderBy: [{ etapa: 'asc' }, { chave: 'asc' }],
    });
  }

  async xml(companyId: string, id: string) {
    const e = await this.prisma.esocialS13Evento.findFirst({ where: { id, companyId }, select: { xml: true, chave: true } });
    if (!e) throw new NotFoundException('Evento nao encontrado.');
    return e;
  }

  pagamentos(companyId: string) {
    return this.prisma.proLaborePagamento.findMany({ where: { companyId, deletedAt: null }, orderBy: { dtPagamento: 'asc' } });
  }
}
