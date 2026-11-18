// apps/api/src/modules/hr/esocial-s13/esocial-s13.service.ts
// LEDGR - eSocial S-1.3 (17/11/2026). Reconstrucao integral: o modulo antigo (esocial-events/esocial-transmission) nao e usado.
// Etapa 1: gera, assina (XMLDSig enveloped, Reference URI="", rsa-sha256, c14n - Manual do Desenvolvedor v1.16)
// e valida cada evento contra o XSD oficial (resources/esocial/S-1.3/eventos). Envio/consulta: etapa 2.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as tls from 'tls';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../../prisma/prisma.service';
import { SigningService } from '../../../core/certificates/signing.service';

const VERSAO = 'v_S_01_03_00';
const VER_PROC = 'LEDGR-1.0';
const ALIQ_CI = 0.11;
const ALIQ_PATRONAL_CI = 0.20; // previsao exibida na conferencia (Lei 8.212/91, art. 22, III); a DCTFWeb e a fonte oficial // contribuinte individual - desconto do segurado (Lei 8.212/91, art. 21 e 30)
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
  'S-2300': { evt: 'evtTSVInicio', grupo: 2, etapa: 3 }, // obrigatorio p/ socio remunerado diretamente (erro 312 sem ele)
  'S-1200': { evt: 'evtRemun', grupo: 3, etapa: 4 },
  'S-1210': { evt: 'evtPgtos', grupo: 3, etapa: 5 }, // depois do S-1200 processado (ideDmDev)
  'S-1299': { evt: 'evtFechaEvPer', grupo: 3, etapa: 6 },
  'S-1298': { evt: 'evtReabreEvPer', grupo: 3, etapa: 1 }, // reabertura: acao avulsa (18/11/2026)
};
const RE_COMP = /^\d{4}-(0[1-9]|1[0-2])$/;
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);
// matricula do TSVE no eSocial: obrigatoria no S-2300 e repetida no S-1200 (regra 312)
const matriculaTsve = (cpf: string) => 'PL' + String(cpf).replace(/\D/g, '');
// retificacao (18/11/2026): compara o conteudo ignorando Id, assinatura, indRetif e nrRecibo
const normEvt = (xml: string) => String(xml || '').replace(/<Signature[\s\S]*<\/Signature>/, '').replace(/ Id="[^"]*"/, '')
  .replace(/<indRetif>\d<\/indRetif>/, '').replace(/<nrRecibo>[^<]*<\/nrRecibo>/, '');
const RETIFICAVEIS = ['S-1200', 'S-1210'];

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
  async gerarPacote(companyId: string, dto: any, simular = false) {
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
    // por enquanto so pro-labore: com folha na competencia, o fechamento (S-1299 unico) exige a rotina da folha
    const folhaDesdeRaw = emp.folhaDesde ?? emp.folha_desde;
    const folhaDesde = folhaDesdeRaw ? new Date(folhaDesdeRaw).toISOString().slice(0, 7) : null;
    if (folhaDesde ? folhaDesde <= perApur : !!(emp.temFolha ?? emp.tem_folha))
      throw new BadRequestException(`Empresa com folha de pagamento em ${perApur}: o fechamento (S-1299 unico) exige a rotina da folha, ainda nao disponivel no LEDGR.`);
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
    const resumoRemun: any[] = [];

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

    // S-2300: inicio do TSVE - socio remunerado diretamente pela empresa precisa estar no cadastro do eSocial.
    // Dados da Pessoa (cadastro centralizado) e do pro-labore; dtInicio = inicio da primeira vigencia do socio.
    const pessoas = await this.prisma.person.findMany({ where: { id: { in: Array.from(new Set(configs.map(c => c.personId))) } } });
    const EST_CIV: Record<string, string> = { SOLTEIRO: '1', CASADO: '2', DIVORCIADO: '3', SEPARADO: '4', VIUVO: '5' };
    for (const p of pessoas) {
      const cfgsP = configs.filter(c => c.personId === p.id);
      const ult = cfgsP[cfgsP.length - 1];
      const falta: string[] = [];
      const sexo = p.gender === 'Masculino' ? 'M' : p.gender === 'Feminino' ? 'F' : '';
      if (!sexo) falta.push('sexo');
      if (!p.racaCor) falta.push('raça/cor');
      if (!p.grauInstrucao) falta.push('grau de instrução');
      if (!p.birthDate) falta.push('data de nascimento');
      if (!p.street) falta.push('logradouro');
      const cep = String(p.zipCode || '').replace(/\D/g, '');
      if (cep.length !== 8) falta.push('CEP');
      if (!p.state) falta.push('UF');
      if (!ult.cbo) falta.push('CBO (configuração do pró-labore)');
      if (!ult.cargo) falta.push('cargo (configuração do pró-labore)');
      if (falta.length) throw new BadRequestException(`S-2300 de ${p.fullName}: falta ${falta.join(', ')}.`);
      if (!/^brasil/i.test(String(p.birthCountry || 'Brasil').trim()) || !/^brasil/i.test(String(p.nationality || 'Brasil').trim()))
        throw new BadRequestException(`S-2300 de ${p.fullName}: pais de nascimento/nacionalidade fora do Brasil exige codigo da Tabela 6 (ainda nao suportado).`);
      let codMun = '';
      try { const rc = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 10000 }); codMun = String(rc.data?.ibge || ''); } catch { codMun = ''; }
      if (!/^\d{7}$/.test(codMun)) throw new BadRequestException(`S-2300 de ${p.fullName}: nao foi possivel obter o codigo IBGE do municipio pelo CEP ${cep}.`);
      const estCiv = EST_CIV[String(p.maritalStatus || '')] || '';
      evts.push({ tipo: 'S-2300', chave: `S-2300:${p.cpf}:${ult.categoriaEsocial}`, perApur: null, corpo:
        `<ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>` + ideEmp +
        `<trabalhador><cpfTrab>${p.cpf}</cpfTrab><nmTrab>${esc(p.fullName)}</nmTrab><sexo>${sexo}</sexo><racaCor>${p.racaCor}</racaCor>` +
        (estCiv ? `<estCiv>${estCiv}</estCiv>` : '') + `<grauInstr>${p.grauInstrucao}</grauInstr>` +
        `<nascimento><dtNascto>${ymd(p.birthDate as Date)}</dtNascto><paisNascto>105</paisNascto><paisNac>105</paisNac></nascimento>` +
        `<endereco><brasil><dscLograd>${esc(p.street)}</dscLograd><nrLograd>${esc(p.number || 'S/N')}</nrLograd>` +
        (p.complement ? `<complemento>${esc(p.complement)}</complemento>` : '') + (p.neighborhood ? `<bairro>${esc(p.neighborhood)}</bairro>` : '') +
        `<cep>${cep}</cep><codMunic>${codMun}</codMunic><uf>${esc(p.state)}</uf></brasil></endereco></trabalhador>` +
        `<infoTSVInicio><cadIni>N</cadIni><matricula>${matriculaTsve(p.cpf)}</matricula><codCateg>${ult.categoriaEsocial}</codCateg><dtInicio>${cfgsP[0].competenciaIni}-01</dtInicio>` +
        `<infoComplementares><cargoFuncao><nmCargo>${esc(ult.cargo)}</nmCargo><CBOCargo>${ult.cbo}</CBOCargo></cargoFuncao>` +
        `<localTrabGeral><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></localTrabGeral></infoComplementares>` +
        `</infoTSVInicio>` });
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
      resumoRemun.push({ comp, cpf: pes.cpf, nome: pes.fullName, categoria: cfg.categoriaEsocial, bruto, inssSegurado: inss,
        inssPatronal: ['01', '02', '03', '04'].includes(par.classTrib) ? null : Math.round(bruto * ALIQ_PATRONAL_CI * 100) / 100 });
      evts.push({ tipo: 'S-1200', chave: `S-1200:${comp}:${pes.cpf}`, perApur: comp, corpo:
        `<ideEvento><indRetif>1</indRetif><indApuracao>1</indApuracao><perApur>${comp}</perApur><tpAmb>${tpAmb}</tpAmb>${ideTab}</ideEvento>` + ideEmp +
        `<ideTrabalhador><cpfTrab>${pes.cpf}</cpfTrab></ideTrabalhador>` +
        `<dmDev><ideDmDev>PL${comp.replace('-', '')}</ideDmDev><codCateg>${cfg.categoriaEsocial}</codCateg>` +
        `<infoPerApur><ideEstabLot><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc><codLotacao>${esc(par.codLotacao)}</codLotacao>` +
        `<remunPerApur><matricula>${matriculaTsve(pes.cpf)}</matricula>${item('PL001', bruto)}${item('PL002', inss)}</remunPerApur></ideEstabLot></infoPerApur>` +
        // com S-2300 do socio, o S-1200 nao repete dados cadastrais/contratuais (infoComplem/infoComplCont)
        `</dmDev>` });
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

    // conferencia (processamento mensal): devolve o que sera gerado, sem gravar nem assinar
    if (simular) {
      const ex = await this.prisma.esocialS13Evento.findMany({ where: { companyId, tpAmb, chave: { in: evts.map(e => e.chave) } },
        select: { id: true, chave: true, status: true, nrRecibo: true, descResposta: true, validacao: true, updatedAt: true, xml: true } });
      return { tpAmb, perApur,
        eventos: await Promise.all(evts.map(async e => {
          const x: any = ex.find(y => y.chave === e.chave);
          const b: any = { tipo: e.tipo, chave: e.chave, perApur: e.perApur, etapa: DEF[e.tipo].etapa, ...(x || {}) };
          delete b.xml;
          if (x && x.status === 'PROCESSADO' && RETIFICAVEIS.includes(e.tipo) && normEvt(this.envelope(e.tipo, 'X', e.corpo)) !== normEvt(x.xml)) {
            if (await this.periodoAberto(companyId, tpAmb, e.perApur)) b.retificar = true; else b.divergente = true;
          }
          return b;
        })),
        remuneracoes: resumoRemun,
        pagamentos: pgs.map(p => ({ dtPagamento: p.dtPagamento, competencia: p.competencia, valorLiquido: Number(p.valorLiquido) })) };
    }

    // grava: assina e valida; eventos ja enviados/processados nao sao regerados
    const out: any[] = [];
    for (const e of evts) {
      const ex = await this.prisma.esocialS13Evento.findUnique({ where: { companyId_tpAmb_chave: { companyId, tpAmb, chave: e.chave } } });
      let corpo = e.corpo; let anterior: any = null;
      if (ex && ex.status === 'PROCESSADO' && RETIFICAVEIS.includes(e.tipo) && ex.nrRecibo
          && normEvt(this.envelope(e.tipo, 'X', e.corpo)) !== normEvt(ex.xml)) {
        if (await this.periodoAberto(companyId, tpAmb, e.perApur)) {
          corpo = e.corpo.replace('<ideEvento><indRetif>1</indRetif>', `<ideEvento><indRetif>2</indRetif><nrRecibo>${ex.nrRecibo}</nrRecibo>`);
          anterior = ex;
        } else { out.push({ chave: e.chave, status: ex.status, mantido: true, divergente: true }); continue; }
      } else if (ex && !['ENVIADO', 'PROCESSADO'].includes(ex.status) && /<indRetif>2<\/indRetif>/.test(ex.xml)) {
        const nr = (ex.xml.match(/<nrRecibo>([^<]+)<\/nrRecibo>/) || [])[1];
        if (nr) corpo = e.corpo.replace('<ideEvento><indRetif>1</indRetif>', `<ideEvento><indRetif>2</indRetif><nrRecibo>${nr}</nrRecibo>`);
      } else if (ex && ['ENVIADO', 'PROCESSADO'].includes(ex.status)) { out.push({ chave: e.chave, status: ex.status, mantido: true }); continue; }
      const id = this.novoId(raiz);
      let xml = this.envelope(e.tipo, id, corpo);
      let status = 'VALIDADO'; let validacao: string | null = null;
      try {
        xml = await this.assinar(xml, certId);
        validacao = await this.validar(xml, DEF[e.tipo].evt + '.xsd');
        if (validacao) status = 'INVALIDO';
      } catch (err: any) { status = 'INVALIDO'; validacao = 'Falha: ' + (err?.message || String(err)); }
      const data = { tipo: e.tipo, perApur: e.perApur, eventoId: id, grupo: DEF[e.tipo].grupo, etapa: DEF[e.tipo].etapa, xml, status, validacao,
        loteId: null, nrRecibo: null, cdResposta: null, descResposta: null };
      if (anterior) {
        // retificacao: preserva o original (com recibo) e cria o retificador com a mesma chave
        await this.prisma.esocialS13Evento.update({ where: { id: anterior.id }, data: { chave: `${anterior.chave}#${anterior.nrRecibo}`, status: 'SUBSTITUIDO' } });
        await this.prisma.esocialS13Evento.create({ data: { ...data, companyId, tpAmb, chave: e.chave } });
      } else if (ex) await this.prisma.esocialS13Evento.update({ where: { id: ex.id }, data });
      else await this.prisma.esocialS13Evento.create({ data: { ...data, companyId, tpAmb, chave: e.chave } });
      out.push({ chave: e.chave, status, validacao });
    }
    return { tpAmb, perApur, eventos: out };
  }

  // ── transmissao (etapa 2 - 17/11/2026) ───────────────────────────────────
  // Envio assincrono: lote por etapa (S-1000 > tabelas > S-1200 > S-1210 > S-1299); a etapa seguinte so sai
  // depois de a anterior ser processada. SOAP 1.1 com TLS mutuo (A1 da empresa) e cadeia ICP-Brasil verificada.
  private readonly URLS: Record<number, { envio: string; consulta: string }> = {
    1: { envio: 'https://webservices.envio.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
         consulta: 'https://webservices.consulta.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc' },
    2: { envio: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
         consulta: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc' },
  };
  private readonly NS_WS_ENVIO = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0';
  private readonly NS_WS_CONSULTA = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0';

  private dirRes(sub: string): string | null {
    const cands = [
      path.join(process.cwd(), 'resources', sub),
      path.join(process.cwd(), 'apps', 'api', 'resources', sub),
      path.join(__dirname, '..', '..', '..', '..', 'resources', sub),
      path.join(__dirname, '..', '..', '..', '..', '..', 'resources', sub),
    ];
    return cands.find(c => fs.existsSync(c)) || null;
  }

  private caIcp(): string[] {
    const d = this.dirRes(path.join('esocial', 'icp-brasil'));
    const out: string[] = [];
    if (!d) return out;
    const varre = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { varre(p); continue; }
        if (!/\.(crt|cer|pem)$/i.test(f)) continue;
        const b = fs.readFileSync(p); const t = b.toString('latin1');
        if (t.includes('-----BEGIN CERTIFICATE-----')) out.push(...(t.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || []));
        else out.push('-----BEGIN CERTIFICATE-----\n' + (b.toString('base64').match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----');
      }
    };
    varre(d);
    return out;
  }

  private async agente(certId: string): Promise<https.Agent> {
    const { privateKeyPem, certPem } = await this.signing.getKeyMaterial(certId);
    return new https.Agent({ key: privateKeyPem, cert: certPem, ca: [...tls.rootCertificates, ...this.caIcp()], minVersion: 'TLSv1.2', keepAlive: false });
  }

  private async soap(url: string, acao: string, ns: string, op: string, param: string, conteudo: string, agent: https.Agent) {
    const env = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="${ns}">` +
      `<soapenv:Header/><soapenv:Body><v1:${op}><v1:${param}>${conteudo}</v1:${param}></v1:${op}></soapenv:Body></soapenv:Envelope>`;
    try {
      const r = await axios.post(url, env, {
        httpsAgent: agent, timeout: 90000, responseType: 'text', transformResponse: (x: any) => x, validateStatus: () => true,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${ns}/${op === 'EnviarLoteEventos' ? 'ServicoEnviarLoteEventos' : 'ServicoConsultarLoteEventos'}/${op}"` },
      });
      return { http: r.status, body: String(r.data ?? '') };
    } catch (err: any) {
      throw new BadRequestException(`Falha de comunicacao com o eSocial (${err?.code || ''} ${err?.message || err}). Se o erro for de cadeia de certificado, confira resources/esocial/icp-brasil.`);
    }
  }

  private parse(xml: string): any {
    return new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, attributeNamePrefix: '@_', parseTagValue: false }).parse(xml);
  }
  private achar(o: any, chave: string): any {
    if (!o || typeof o !== 'object') return undefined;
    if (chave in o) return o[chave];
    for (const k of Object.keys(o)) { const r = this.achar(o[k], chave); if (r !== undefined) return r; }
    return undefined;
  }
  private lista(x: any): any[] { return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]; }
  private ocorr(x: any): { codigo: string; tipo: string; descricao: string; localizacao: string }[] {
    return this.lista(x?.ocorrencias?.ocorrencia).map((o: any) => ({ codigo: String(o.codigo ?? ''), tipo: String(o.tipo ?? ''), descricao: String(o.descricao ?? ''), localizacao: String(o.localizacao ?? '') }));
  }
  private txtOcorr(oc: { codigo: string; descricao: string; localizacao: string }[]): string {
    return oc.map(o => `${o.codigo} ${o.descricao}${o.localizacao ? ' [' + o.localizacao + ']' : ''}`).join(' | ');
  }

  private async validarLote(xml: string): Promise<string | null> {
    const d = this.dirRes(path.join('esocial', 'S-1.3', 'comunicacao'));
    const f = d ? path.join(d, 'EnvioLoteEventos-v1_1_1.xsd') : '';
    if (!d || !fs.existsSync(f)) return 'XSD do lote (EnvioLoteEventos-v1_1_1.xsd) nao encontrado.';
    const lib: any = await (new Function('m', 'return import(m)'))('xmllint-wasm');
    const r = await lib.validateXML({ xml: [{ fileName: 'lote.xml', contents: xml }], schema: [{ fileName: 'EnvioLoteEventos-v1_1_1.xsd', contents: fs.readFileSync(f, 'utf8') }] });
    return r.valid ? null : (r.errors || []).map((e: any) => e.message || e.rawMessage || String(e)).join(' | ');
  }

  // trava: o validador precisa recusar XML invalido e cada assinatura precisa conferir
  private async autoteste(xmls: string[], certPem: string): Promise<void> {
    const ruim = await this.validar(`<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtFechaEvPer/${VERSAO}"><evtFechaEvPer Id="X"/></eSocial>`, 'evtFechaEvPer.xsd');
    if (!ruim) throw new BadRequestException('Autoteste: o validador XSD aceitou um XML invalido. Envio bloqueado.');
    const { SignedXml } = await import('xml-crypto');
    for (const x of xmls) {
      const i = x.indexOf('<Signature'), f = x.indexOf('</Signature>');
      if (i < 0 || f < 0) throw new BadRequestException('Autoteste: evento sem assinatura. Envio bloqueado.');
      let ok = false;
      try { const v: any = new (SignedXml as any)({ publicCert: certPem }); v.loadSignature(x.slice(i, f + 12)); ok = v.checkSignature(x); } catch { ok = false; }
      if (!ok) throw new BadRequestException('Autoteste: assinatura de evento nao confere. Envio bloqueado.');
    }
  }

  async enviar(companyId: string, dto: any) {
    const tpAmb = Number(dto?.tpAmb);
    if (![1, 2].includes(tpAmb)) throw new BadRequestException('Ambiente invalido.');
    if (tpAmb === 1 && String(dto?.confirmacao || '').trim() !== 'ENVIAR PRODUCAO')
      throw new BadRequestException('Envio a PRODUCAO exige digitar a confirmacao "ENVIAR PRODUCAO".');
    if (await this.prisma.esocialS13Lote.count({ where: { companyId, tpAmb, status: 'ENVIADO' } }))
      throw new BadRequestException('Ha lote aguardando processamento. Consulte o retorno antes de enviar a proxima etapa.');
    const evs = await this.prisma.esocialS13Evento.findMany({ where: { companyId, tpAmb, status: { not: 'SUBSTITUIDO' } }, orderBy: [{ etapa: 'asc' }, { chave: 'asc' }] });
    let base = evs;
    if (dto?.perApur) {
      // processamento mensal: so os eventos do pacote da competencia aprovada
      const prev: any = await this.gerarPacote(companyId, { tpAmb, perApur: dto.perApur }, true);
      const chaves = new Set<string>(prev.eventos.map((e: any) => e.chave));
      const ap = await this.prisma.esocialS13Aprovacao.findUnique({ where: { companyId_tpAmb_perApur: { companyId, tpAmb, perApur: String(dto.perApur) } } });
      if (!ap) throw new BadRequestException('Competencia nao aprovada: faca a conferencia e aprove antes de transmitir.');
      base = evs.filter(e => chaves.has(e.chave));
      const alterado = base.find(e => e.status !== 'PROCESSADO' && e.status !== 'ENVIADO' && e.updatedAt > ap.aprovadoEm);
      if (alterado) throw new BadRequestException(`O evento ${alterado.chave} foi alterado depois da aprovacao. Aprove a conferencia novamente.`);
    }
    const abertos = base.filter(e => e.status !== 'PROCESSADO');
    if (!abertos.length) return { mensagem: 'Nada a enviar: todos os eventos ja foram processados.', lotes: [] };
    const etapa = Math.min(...abertos.map(e => e.etapa));
    const daEtapa = abertos.filter(e => e.etapa === etapa);
    const bloq = daEtapa.filter(e => e.status !== 'VALIDADO');
    if (bloq.length) throw new BadRequestException(`Etapa ${etapa} com evento(s) nao validado(s): ${bloq.map(b => b.chave + ' (' + b.status + ')').join(', ')}. Regere o pacote antes de enviar.`);

    const emp: any = await this.prisma.company.findUnique({ where: { id: companyId } });
    const cnpj = String(emp?.taxId || '').replace(/\D/g, '');
    if (cnpj.length !== 14) throw new BadRequestException('CNPJ da empresa invalido no cadastro.');
    const certId = await this.certId(companyId);
    const { certPem } = await this.signing.getKeyMaterial(certId);
    await this.autoteste(daEtapa.map(e => e.xml), certPem);
    const agent = await this.agente(certId);
    const grupo = daEtapa[0].grupo;
    const res: any[] = [];
    for (let i = 0; i < daEtapa.length; i += 50) {
      const parte = daEtapa.slice(i, i + 50);
      const lote = `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1"><envioLoteEventos grupo="${grupo}">` +
        `<ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj.slice(0, 8)}</nrInsc></ideEmpregador>` +
        `<ideTransmissor><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideTransmissor>` +
        `<eventos>${parte.map(e => `<evento Id="${e.eventoId}">${e.xml.replace(/^<\?xml[^>]*\?>/, '')}</evento>`).join('')}</eventos>` +
        `</envioLoteEventos></eSocial>`;
      const errLote = await this.validarLote(lote);
      if (errLote) throw new BadRequestException('Lote invalido no XSD oficial (nada foi enviado): ' + errLote);
      const r = await this.soap(this.URLS[tpAmb].envio, '', this.NS_WS_ENVIO, 'EnviarLoteEventos', 'loteEventos', lote, agent);
      const ret = this.achar(this.parse(r.body), 'retornoEnvioLoteEventos');
      const cd = Number(ret?.status?.cdResposta ?? 0);
      const oc = this.ocorr(ret?.status);
      const desc = (ret?.status?.descResposta ? String(ret.status.descResposta) : `HTTP ${r.http} - resposta sem retorno do eSocial`) + (oc.length ? ' | ' + this.txtOcorr(oc) : '');
      const prot = ret?.dadosRecepcaoLote?.protocoloEnvio ? String(ret.dadosRecepcaoLote.protocoloEnvio) : null;
      const ok = cd === 201 && !!prot;
      const l = await this.prisma.esocialS13Lote.create({ data: {
        companyId, tpAmb, grupo, etapa, protocolo: prot, status: ok ? 'ENVIADO' : 'REJEITADO', cdResposta: cd || null,
        descResposta: desc, xmlEnvio: lote, xmlRetornoEnvio: r.body, enviadoEm: new Date() } });
      if (ok) await this.prisma.esocialS13Evento.updateMany({ where: { id: { in: parte.map(p => p.id) } }, data: { status: 'ENVIADO', loteId: l.id } });
      res.push({ etapa, protocolo: prot, cdResposta: cd, descResposta: desc, eventos: parte.length, ok });
    }
    return { etapa, lotes: res };
  }

  async consultar(companyId: string, dto: any) {
    const tpAmb = Number(dto?.tpAmb);
    if (![1, 2].includes(tpAmb)) throw new BadRequestException('Ambiente invalido.');
    const lotes = await this.prisma.esocialS13Lote.findMany({ where: { companyId, tpAmb, status: 'ENVIADO' }, orderBy: { createdAt: 'asc' } });
    if (!lotes.length) return { mensagem: 'Nenhum lote aguardando processamento.', lotes: [] };
    const agent = await this.agente(await this.certId(companyId));
    const res: any[] = [];
    for (const l of lotes) {
      const cons = `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0">` +
        `<consultaLoteEventos><protocoloEnvio>${esc(l.protocolo)}</protocoloEnvio></consultaLoteEventos></eSocial>`;
      const r = await this.soap(this.URLS[tpAmb].consulta, '', this.NS_WS_CONSULTA, 'ConsultarLoteEventos', 'consulta', cons, agent);
      const ret = this.achar(this.parse(r.body), 'retornoProcessamentoLoteEventos');
      const cd = Number(ret?.status?.cdResposta ?? 0);
      const ocL = this.ocorr(ret?.status);
      const desc = (ret?.status?.descResposta ? String(ret.status.descResposta) : `HTTP ${r.http} - resposta sem retorno do eSocial`) + (ocL.length ? ' | ' + this.txtOcorr(ocL) : '');
      if (cd === 101 || !ret) {
        const tempo = Number(ret?.status?.tempoEstimadoConclusao) || null;
        await this.prisma.esocialS13Lote.update({ where: { id: l.id }, data: { cdResposta: cd || null, descResposta: desc, tempoEstimado: tempo, consultadoEm: new Date(), xmlRetornoProc: r.body } });
        res.push({ etapa: l.etapa, protocolo: l.protocolo, situacao: 'EM PROCESSAMENTO', tempoEstimado: tempo, descResposta: desc });
        continue;
      }
      const evRet = this.lista(this.achar(ret, 'retornoEventos')?.evento);
      let okN = 0, errN = 0;
      for (const ev of evRet) {
        const id = String(ev?.['@_Id'] ?? '');
        const inner = this.achar(ev?.retornoEvento?.eSocial ?? ev?.retornoEvento ?? ev, 'retornoEvento') ?? ev?.retornoEvento;
        const proc = inner?.processamento;
        const cdE = Number(proc?.cdResposta ?? 0);
        const oc = this.ocorr(proc);
        const okE = cdE === 201 || cdE === 202;
        await this.prisma.esocialS13Evento.updateMany({ where: { companyId, tpAmb, eventoId: id, loteId: l.id }, data: {
          status: okE ? 'PROCESSADO' : 'REJEITADO', cdResposta: cdE || null,
          descResposta: String(proc?.descResposta ?? '') + (oc.length ? ' | ' + this.txtOcorr(oc) : ''),
          nrRecibo: inner?.recibo?.nrRecibo ? String(inner.recibo.nrRecibo) : null, ocorrencias: oc as any } });
        if (okE) {
          const row = await this.prisma.esocialS13Evento.findFirst({ where: { companyId, tpAmb, eventoId: id }, select: { tipo: true, perApur: true } });
          if (row?.tipo === 'S-1298' && row.perApur) {
            const f = await this.prisma.esocialS13Evento.findUnique({ where: { companyId_tpAmb_chave: { companyId, tpAmb, chave: `S-1299:${row.perApur}` } } });
            if (f && f.status === 'PROCESSADO')
              await this.prisma.esocialS13Evento.update({ where: { id: f.id }, data: { chave: `${f.chave}#${f.nrRecibo || f.id}`, status: 'SUBSTITUIDO' } });
          }
        }
        if (okE) okN++; else errN++;
      }
      if (!evRet.length) {
        await this.prisma.esocialS13Evento.updateMany({ where: { companyId, tpAmb, loteId: l.id }, data: { status: 'REJEITADO', cdResposta: cd || null, descResposta: 'Lote: ' + desc } });
      }
      await this.prisma.esocialS13Lote.update({ where: { id: l.id }, data: {
        status: evRet.length ? 'PROCESSADO' : 'REJEITADO', cdResposta: cd || null, descResposta: desc, consultadoEm: new Date(), xmlRetornoProc: r.body } });
      res.push({ etapa: l.etapa, protocolo: l.protocolo, situacao: evRet.length ? 'PROCESSADO' : 'REJEITADO', aceitos: okN, rejeitados: errN, descResposta: desc });
    }
    return { lotes: res };
  }

  listarLotes(companyId: string, tpAmb: number) {
    return this.prisma.esocialS13Lote.findMany({
      where: { companyId, tpAmb },
      select: { id: true, etapa: true, grupo: true, protocolo: true, status: true, cdResposta: true, descResposta: true, tempoEstimado: true, enviadoEm: true, consultadoEm: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── processamento mensal (18/11/2026) ────────────────────────────────────
  async competencias(companyId: string, tpAmb: number) {
    const cfgs = await this.prisma.proLaboreConfig.findMany({ where: { companyId, deletedAt: null, shareholderId: { not: null } },
      orderBy: { competenciaIni: 'asc' }, select: { competenciaIni: true } });
    if (!cfgs.length) return [];
    const fim = new Date().toISOString().slice(0, 7);
    const lista: string[] = [];
    let [a, m] = cfgs[0].competenciaIni.split('-').map(Number);
    for (let i = 0; i < 240; i++) {
      const c = `${a}-${String(m).padStart(2, '0')}`;
      if (c > fim) break;
      lista.push(c); m++; if (m > 12) { m = 1; a++; }
    }
    const fechs = await this.prisma.esocialS13Evento.findMany({ where: { companyId, tpAmb, tipo: 'S-1299', status: { not: 'SUBSTITUIDO' } }, select: { perApur: true, status: true, nrRecibo: true, descResposta: true } });
    const reabs = await this.prisma.esocialS13Evento.findMany({ where: { companyId, tpAmb, tipo: 'S-1298', status: 'PROCESSADO' }, select: { perApur: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } });
    const aps = await this.prisma.esocialS13Aprovacao.findMany({ where: { companyId, tpAmb } });
    return lista.reverse().map(c => {
      const f = fechs.find(x => x.perApur === c); const ap = aps.find(x => x.perApur === c);
      const rb = reabs.find(x => x.perApur === c);
      return { perApur: c, fechamento: f?.status || null, recibo: f?.nrRecibo || null, descResposta: f?.descResposta || null, aprovadoEm: ap?.aprovadoEm || null,
        reabertaEm: rb && f?.status !== 'PROCESSADO' ? rb.updatedAt : null };
    });
  }

  async aprovar(companyId: string, userId: string | null, dto: any) {
    const tpAmb = Number(dto?.tpAmb); const perApur = String(dto?.perApur || '');
    const g: any = await this.gerarPacote(companyId, dto);
    const inv = (g.eventos || []).filter((e: any) => e.status === 'INVALIDO');
    if (inv.length) throw new BadRequestException('Eventos invalidos no XSD oficial: ' + inv.map((e: any) => `${e.chave} - ${e.validacao}`).join(' | '));
    const p: any = await this.gerarPacote(companyId, dto, true);
    const resumo: any = { remuneracoes: p.remuneracoes, pagamentos: p.pagamentos, eventos: p.eventos.map((e: any) => ({ chave: e.chave, status: e.status })) };
    const agora = new Date();
    await this.prisma.esocialS13Aprovacao.upsert({
      where: { companyId_tpAmb_perApur: { companyId, tpAmb, perApur } },
      create: { companyId, tpAmb, perApur, aprovadoPor: userId || null, aprovadoEm: agora, resumo },
      update: { aprovadoPor: userId || null, aprovadoEm: agora, resumo },
    });
    return { ok: true, aprovadoEm: agora };
  }

  async sugestaoLiquido(companyId: string, personId: string, comp: string) {
    if (!RE_COMP.test(String(comp || ''))) throw new BadRequestException('Competencia invalida.');
    const cfg = await this.prisma.proLaboreConfig.findFirst({ where: { companyId, personId, deletedAt: null, shareholderId: { not: null },
      competenciaIni: { lte: comp }, OR: [{ competenciaFim: null }, { competenciaFim: { gte: comp } }] } });
    if (!cfg) throw new BadRequestException('Sem vigencia de pro-labore para a competencia.');
    const teto = TETO_INSS[comp.slice(0, 4)];
    if (!teto) throw new BadRequestException(`Teto do INSS de ${comp.slice(0, 4)} nao cadastrado.`);
    const bruto = Number(cfg.valorBruto);
    const inss = Math.round(Math.min(bruto, teto) * ALIQ_CI * 100) / 100;
    return { bruto, inss, liquido: Math.round((bruto - inss) * 100) / 100 };
  }

  private async mesFechadoProducao(companyId: string, ym: string): Promise<boolean> {
    return !!(await this.prisma.esocialS13Evento.findFirst({ where: { companyId, tpAmb: 1, chave: `S-1299:${ym}`, status: 'PROCESSADO' }, select: { id: true } }));
  }

  async registrarPagamento(companyId: string, dto: any) {
    const tipo = dto?.tipo === 'ADIANTAMENTO' ? 'ADIANTAMENTO' : 'PRO_LABORE';
    const personId = String(dto?.personId || '');
    const dt = String(dto?.dtPagamento || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) throw new BadRequestException('Data de pagamento invalida.');
    const valor = Number(dto?.valorLiquido);
    if (!(valor > 0)) throw new BadRequestException('Informe o valor liquido pago.');
    const cfgs = await this.prisma.proLaboreConfig.findMany({ where: { companyId, personId, deletedAt: null, shareholderId: { not: null } } });
    if (!cfgs.length) throw new BadRequestException('Pessoa sem pro-labore configurado nesta empresa (QSA).');
    let competencia: string | null = null; let configId: string | null = null;
    if (tipo === 'PRO_LABORE') {
      const c = String(dto?.competencia || '');
      if (!RE_COMP.test(c)) throw new BadRequestException('Informe a competencia paga (AAAA-MM).');
      const cfg = cfgs.find(x => x.competenciaIni <= c && (!x.competenciaFim || x.competenciaFim >= c));
      if (!cfg) throw new BadRequestException(`Sem vigencia de pro-labore para ${c}.`);
      if (dt.slice(0, 7) < c) throw new BadRequestException('Pagamento anterior a competencia paga: registre como Adiantamento.');
      const dup = await this.prisma.proLaborePagamento.findFirst({ where: { companyId, personId, tipo: 'PRO_LABORE', competencia: c, deletedAt: null } });
      if (dup) throw new BadRequestException(`Ja existe pagamento de pro-labore da competencia ${c}.`);
      competencia = c; configId = cfg.id;
    }
    if (await this.mesFechadoProducao(companyId, dt.slice(0, 7)))
      throw new BadRequestException('O mes do pagamento ja foi fechado no eSocial (producao): a inclusao exige retificacao.');
    // compensacao de adiantamentos (so em pagamento de pro-labore)
    const comps: { adiantamentoId: string; valor: number }[] = tipo === 'PRO_LABORE' && Array.isArray(dto?.compensacoes)
      ? dto.compensacoes.map((c: any) => ({ adiantamentoId: String(c?.adiantamentoId || ''), valor: Math.round(Number(c?.valor) * 100) / 100 }))
          .filter((c: { valor: number }) => c.valor > 0)
      : [];
    if (new Set(comps.map(c => c.adiantamentoId)).size !== comps.length) throw new BadRequestException('Adiantamento repetido na compensacao.');
    if (comps.length) {
      const soma = comps.reduce((a, c) => a + c.valor, 0);
      if (soma - valor > 0.005) throw new BadRequestException('A compensacao de adiantamentos excede o valor liquido do pagamento.');
      for (const c of comps) {
        const sd = await this.saldoAdiantamento(companyId, c.adiantamentoId, personId);
        if (c.valor - sd > 0.005) throw new BadRequestException(`Compensacao de R$ ${c.valor.toFixed(2)} maior que o saldo do adiantamento (R$ ${sd.toFixed(2)}).`);
      }
    }
    return this.prisma.$transaction(async tx => {
      const pg = await tx.proLaborePagamento.create({ data: { companyId, personId, configId, tipo, competencia,
        dtPagamento: new Date(dt + 'T00:00:00Z'), valorLiquido: valor, observacao: dto?.observacao ? String(dto.observacao).slice(0, 300) : null } });
      for (const c of comps) await tx.proLaboreCompensacao.create({ data: { companyId, pagamentoId: pg.id, adiantamentoId: c.adiantamentoId, valor: c.valor } });
      return pg;
    });
  }

  async excluirPagamento(companyId: string, id: string) {
    const p = await this.prisma.proLaborePagamento.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!p) throw new NotFoundException('Pagamento nao encontrado.');
    if (await this.mesFechadoProducao(companyId, ymd(p.dtPagamento).slice(0, 7)))
      throw new BadRequestException('Pagamento ja declarado em mes fechado no eSocial (producao): a exclusao exige retificacao.');
    if (p.tipo === 'ADIANTAMENTO' && await this.prisma.proLaboreCompensacao.count({ where: { adiantamentoId: id, deletedAt: null } }))
      throw new BadRequestException('Adiantamento ja compensado em pagamento de pro-labore: exclua primeiro esse pagamento.');
    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.proLaboreCompensacao.updateMany({ where: { pagamentoId: id, deletedAt: null }, data: { deletedAt: agora } }),
      this.prisma.proLaborePagamento.update({ where: { id }, data: { deletedAt: agora } }),
    ]);
    return { ok: true };
  }

  // ── adiantamentos: saldo e compensacao (18/11/2026) ─────────────────────
  private async saldoAdiantamento(companyId: string, adiantamentoId: string, personId?: string): Promise<number> {
    const a = await this.prisma.proLaborePagamento.findFirst({ where: { id: adiantamentoId, companyId, tipo: 'ADIANTAMENTO', deletedAt: null, ...(personId ? { personId } : {}) } });
    if (!a) throw new BadRequestException('Adiantamento nao encontrado para este socio.');
    const agg = await this.prisma.proLaboreCompensacao.aggregate({ where: { adiantamentoId, deletedAt: null }, _sum: { valor: true } });
    return Math.round((Number(a.valorLiquido) - Number(agg._sum.valor || 0)) * 100) / 100;
  }

  async adiantamentosDisponiveis(companyId: string, personId: string) {
    const ads = await this.prisma.proLaborePagamento.findMany({ where: { companyId, personId, tipo: 'ADIANTAMENTO', deletedAt: null }, orderBy: { dtPagamento: 'asc' } });
    const out: any[] = [];
    for (const a of ads) {
      const saldo = await this.saldoAdiantamento(companyId, a.id);
      if (saldo > 0.005) out.push({ id: a.id, dtPagamento: a.dtPagamento, valorLiquido: Number(a.valorLiquido), saldo, observacao: a.observacao });
    }
    return out;
  }

  // ── reabertura (S-1298) e periodo aberto - 18/11/2026 ─────────────────────
  private async periodoAberto(companyId: string, tpAmb: number, per: string | null): Promise<boolean> {
    if (!per) return false;
    const f = await this.prisma.esocialS13Evento.findUnique({ where: { companyId_tpAmb_chave: { companyId, tpAmb, chave: `S-1299:${per}` } }, select: { status: true } });
    return !f || f.status !== 'PROCESSADO';
  }

  async reabrir(companyId: string, dto: any) {
    const tpAmb = Number(dto?.tpAmb); const perApur = String(dto?.perApur || '');
    if (![1, 2].includes(tpAmb) || !RE_COMP.test(perApur)) throw new BadRequestException('Ambiente ou competencia invalidos.');
    if (tpAmb === 1 && String(dto?.confirmacao || '').trim() !== 'REABRIR PRODUCAO')
      throw new BadRequestException('Reabertura em PRODUCAO exige digitar a confirmacao "REABRIR PRODUCAO".');
    if (await this.prisma.esocialS13Lote.count({ where: { companyId, tpAmb, status: 'ENVIADO' } }))
      throw new BadRequestException('Ha lote aguardando processamento. Consulte o retorno antes.');
    const f = await this.prisma.esocialS13Evento.findUnique({ where: { companyId_tpAmb_chave: { companyId, tpAmb, chave: `S-1299:${perApur}` } } });
    if (!f || f.status !== 'PROCESSADO') throw new BadRequestException('A competencia nao esta fechada: nao ha o que reabrir.');
    const emp: any = await this.prisma.company.findUnique({ where: { id: companyId } });
    const cnpj = String(emp?.taxId || '').replace(/\D/g, ''); const raiz = cnpj.slice(0, 8);
    if (cnpj.length !== 14) throw new BadRequestException('CNPJ da empresa invalido no cadastro.');
    const certId = await this.certId(companyId);
    const id = this.novoId(raiz);
    let xml = this.envelope('S-1298', id,
      `<ideEvento><indApuracao>1</indApuracao><perApur>${perApur}</perApur><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>${VER_PROC}</verProc></ideEvento>` +
      `<ideEmpregador><tpInsc>1</tpInsc><nrInsc>${raiz}</nrInsc></ideEmpregador>`);
    xml = await this.assinar(xml, certId);
    const inval = await this.validar(xml, 'evtReabreEvPer.xsd');
    if (inval) throw new BadRequestException('S-1298 invalido no XSD oficial (nada foi enviado): ' + inval);
    const { certPem } = await this.signing.getKeyMaterial(certId);
    await this.autoteste([xml], certPem);
    const ev = await this.prisma.esocialS13Evento.create({ data: { companyId, tpAmb, tipo: 'S-1298', perApur, chave: `S-1298:${perApur}:${id}`,
      eventoId: id, grupo: 3, etapa: 1, xml, status: 'VALIDADO' } });
    const lote = `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1"><envioLoteEventos grupo="3">` +
      `<ideEmpregador><tpInsc>1</tpInsc><nrInsc>${raiz}</nrInsc></ideEmpregador><ideTransmissor><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideTransmissor>` +
      `<eventos><evento Id="${id}">${xml}</evento></eventos></envioLoteEventos></eSocial>`;
    const errLote = await this.validarLote(lote);
    if (errLote) throw new BadRequestException('Lote invalido no XSD oficial (nada foi enviado): ' + errLote);
    const agent = await this.agente(certId);
    const r = await this.soap(this.URLS[tpAmb].envio, '', this.NS_WS_ENVIO, 'EnviarLoteEventos', 'loteEventos', lote, agent);
    const ret = this.achar(this.parse(r.body), 'retornoEnvioLoteEventos');
    const cd = Number(ret?.status?.cdResposta ?? 0); const oc = this.ocorr(ret?.status);
    const desc = (ret?.status?.descResposta ? String(ret.status.descResposta) : `HTTP ${r.http} - resposta sem retorno do eSocial`) + (oc.length ? ' | ' + this.txtOcorr(oc) : '');
    const prot = ret?.dadosRecepcaoLote?.protocoloEnvio ? String(ret.dadosRecepcaoLote.protocoloEnvio) : null;
    const ok = cd === 201 && !!prot;
    const l = await this.prisma.esocialS13Lote.create({ data: { companyId, tpAmb, grupo: 3, etapa: 1, protocolo: prot, status: ok ? 'ENVIADO' : 'REJEITADO',
      cdResposta: cd || null, descResposta: desc, xmlEnvio: lote, xmlRetornoEnvio: r.body, enviadoEm: new Date() } });
    await this.prisma.esocialS13Evento.update({ where: { id: ev.id }, data: ok ? { status: 'ENVIADO', loteId: l.id } : { status: 'REJEITADO', descResposta: 'Lote: ' + desc } });
    return { ok, protocolo: prot, descResposta: desc };
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

  async pagamentos(companyId: string) {
    const ps = await this.prisma.proLaborePagamento.findMany({ where: { companyId, deletedAt: null }, orderBy: { dtPagamento: 'desc' } });
    const pes = await this.prisma.person.findMany({ where: { id: { in: Array.from(new Set(ps.map(p => p.personId))) } }, select: { id: true, fullName: true } });
    const cps = await this.prisma.proLaboreCompensacao.findMany({ where: { companyId, deletedAt: null } });
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return ps.map(p => {
      const v = Number(p.valorLiquido);
      const usado = cps.filter(c => c.adiantamentoId === p.id).reduce((a, c) => a + Number(c.valor), 0);
      const comp = cps.filter(c => c.pagamentoId === p.id).reduce((a, c) => a + Number(c.valor), 0);
      return { ...p, valorLiquido: v, nome: pes.find(x => x.id === p.personId)?.fullName || '',
        compensado: r2(comp), emDinheiro: r2(v - comp), saldo: p.tipo === 'ADIANTAMENTO' ? r2(v - usado) : null };
    });
  }
}
