// apps/api/src/modules/sped/ecd-arquivo/ecd-arq-parser.ts
// ============================================================================
// ARQUIVO FIEL DA ECD - CRIADO 21/09/2026
// Parser PURO (sem Nest, sem banco): le o conteudo de um arquivo SPED ECD e
// devolve os registros que alimentam as tabelas ecd_arq*. Independente do
// EcdParserService (usado na importacao contabil) - nada aqui e compartilhado.
//  - Bloco I (escrituracao do ano) e Bloco C (dados recuperados da ECD
//    anterior: C040/C050/C150/C155) ficam SEPARADOS pelo campo bloco.
//  - Historico padrao = I075. Plano referencial = I051 (ultimo campo preenchido,
//    pois a posicao muda entre leiautes).
//  - Valores monetarios ficam como string decimal (ex: 1964.08): sem float.
// ============================================================================

export type Bloco = 'I' | 'C';

export interface ArqCabecalho {
  cnpj: string;
  nomeEmpresarial: string;
  dtIni: string;
  dtFin: string;
  codVerLc: string | null;
  indEsc: string | null;
  indFinEsc: string | null;
  codHashSub: string | null;
}

export interface ArqConta {
  bloco: Bloco;
  codCta: string;
  codCtaSup: string | null;
  nome: string;
  codNat: string | null;
  indCta: string | null;
  nivel: number | null;
  dtAlt: string | null;
  codCtaRef: string | null;
}

export interface ArqSaldo {
  bloco: Bloco;
  dtIni: string;
  dtFin: string;
  codCta: string;
  codCcus: string | null;
  vlSldIni: string;
  indDcIni: string;
  vlDeb: string;
  vlCred: string;
  vlSldFin: string;
  indDcFin: string;
}

export interface ArqPartida {
  seq: number;
  codCta: string;
  codCcus: string | null;
  vlDc: string;
  indDc: string;
  numArq: string | null;
  codHistPad: string | null;
  hist: string | null;
  codPart: string | null;
}

export interface ArqLancamento {
  seq: number;
  numLcto: string;
  dtLcto: string;
  vlLcto: string | null;
  indLcto: string | null;
  dtLctoExt: string | null;
  partidas: ArqPartida[];
}

export interface ArqHistorico {
  codHist: string;
  descrHist: string | null;
}

export interface ArqParsed {
  cabecalho: ArqCabecalho | null;
  contas: ArqConta[];
  saldos: ArqSaldo[];
  lancamentos: ArqLancamento[];
  historicos: ArqHistorico[];
  recuperado: { dtIni: string | null; dtFin: string | null; codVerLc: string | null } | null;
  totalLinhas: number;
  registros: Record<string, number>;
  avisos: string[];
}

function isoDate(s: string | undefined): string | null {
  if (!s || !/^\d{8}$/.test(s)) return null;
  return s.substring(4, 8) + '-' + s.substring(2, 4) + '-' + s.substring(0, 2);
}

function nz(s: string | undefined): string | null {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
}

function dec(s: string | undefined): string {
  const t = (s ?? '').trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? t : '0';
}

function inteiro(s: string | undefined): number | null {
  const n = parseInt((s ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function ultimoPreenchido(f: string[], desde: number): string | null {
  for (let i = f.length - 1; i >= desde; i--) {
    const t = (f[i] ?? '').trim();
    if (t !== '') return t;
  }
  return null;
}

export function parseEcdArquivo(buffer: Buffer): ArqParsed {
  const texto = buffer.toString('latin1');
  const out: ArqParsed = {
    cabecalho: null,
    contas: [],
    saldos: [],
    lancamentos: [],
    historicos: [],
    recuperado: null,
    totalLinhas: 0,
    registros: {},
    avisos: [],
  };
  const aviso = (m: string): void => {
    if (out.avisos.length < 100) out.avisos.push(m);
  };

  let indEsc: string | null = null;
  let codVerLc: string | null = null;
  let periodo: { bloco: Bloco; dtIni: string; dtFin: string } | null = null;
  let contaAtual: ArqConta | null = null;
  let lancAtual: ArqLancamento | null = null;
  const contasVistas = new Set<string>();
  const histVistos = new Set<string>();
  let seqLanc = 0;
  let pos = 0;
  let nLinha = 0;
  const n = texto.length;

  while (pos < n) {
    let fim = texto.indexOf('\n', pos);
    if (fim < 0) fim = n;
    let linha = texto.substring(pos, fim);
    pos = fim + 1;
    nLinha++;
    if (linha.endsWith('\r')) linha = linha.substring(0, linha.length - 1);
    if (linha.length < 6 || linha.charCodeAt(0) !== 124) continue;
    out.totalLinhas++;
    const f = linha.split('|');
    const reg = f[1];
    out.registros[reg] = (out.registros[reg] ?? 0) + 1;

    switch (reg) {
      case '0000': {
        out.cabecalho = {
          cnpj: (f[6] ?? '').trim(),
          nomeEmpresarial: (f[5] ?? '').trim(),
          dtIni: isoDate(f[3]) ?? '',
          dtFin: isoDate(f[4]) ?? '',
          codVerLc: null,
          indEsc: null,
          indFinEsc: nz(f[14]),
          codHashSub: nz(f[15]),
        };
        break;
      }
      case 'I010': {
        indEsc = nz(f[2]);
        codVerLc = nz(f[3]);
        break;
      }
      case 'C040': {
        out.recuperado = { dtIni: isoDate(f[3]), dtFin: isoDate(f[4]), codVerLc: nz(f[7]) };
        break;
      }
      case 'I050':
      case 'C050': {
        const bloco: Bloco = reg === 'I050' ? 'I' : 'C';
        const codCta = (f[6] ?? '').trim();
        if (!codCta) {
          aviso('linha ' + nLinha + ': ' + reg + ' sem COD_CTA');
          break;
        }
        const chave = bloco + '|' + codCta;
        if (contasVistas.has(chave)) {
          aviso('linha ' + nLinha + ': conta duplicada ' + chave);
          contaAtual = null;
          break;
        }
        contasVistas.add(chave);
        const c: ArqConta = {
          bloco,
          codCta,
          codCtaSup: nz(f[7]),
          nome: (f[8] ?? '').trim(),
          codNat: nz(f[3]),
          indCta: nz(f[4]),
          nivel: inteiro(f[5]),
          dtAlt: isoDate(f[2]),
          codCtaRef: null,
        };
        out.contas.push(c);
        contaAtual = bloco === 'I' ? c : null;
        break;
      }
      case 'I051': {
        if (contaAtual && !contaAtual.codCtaRef) {
          contaAtual.codCtaRef = ultimoPreenchido(f, 2);
        }
        break;
      }
      case 'I150':
      case 'C150': {
        const ini = isoDate(f[2]);
        const fin = isoDate(f[3]);
        if (ini && fin) {
          periodo = { bloco: reg === 'I150' ? 'I' : 'C', dtIni: ini, dtFin: fin };
        } else {
          periodo = null;
          aviso('linha ' + nLinha + ': ' + reg + ' com datas invalidas');
        }
        break;
      }
      case 'I155':
      case 'C155': {
        const bloco: Bloco = reg === 'I155' ? 'I' : 'C';
        if (!periodo || periodo.bloco !== bloco) {
          aviso('linha ' + nLinha + ': ' + reg + ' fora de um periodo ' + (bloco === 'I' ? 'I150' : 'C150'));
          break;
        }
        const codCta = (f[2] ?? '').trim();
        if (!codCta) {
          aviso('linha ' + nLinha + ': ' + reg + ' sem COD_CTA');
          break;
        }
        out.saldos.push({
          bloco,
          dtIni: periodo.dtIni,
          dtFin: periodo.dtFin,
          codCta,
          codCcus: nz(f[3]),
          vlSldIni: dec(f[4]),
          indDcIni: (f[5] ?? '').trim() || 'D',
          vlDeb: dec(f[6]),
          vlCred: dec(f[7]),
          vlSldFin: dec(f[8]),
          indDcFin: (f[9] ?? '').trim() || 'D',
        });
        break;
      }
      case 'I200': {
        const dt = isoDate(f[3]);
        if (!dt) {
          aviso('linha ' + nLinha + ': I200 com data invalida');
          lancAtual = null;
          break;
        }
        const l: ArqLancamento = {
          seq: ++seqLanc,
          numLcto: (f[2] ?? '').trim(),
          dtLcto: dt,
          vlLcto: nz(f[4]) === null ? null : dec(f[4]),
          indLcto: nz(f[5]),
          dtLctoExt: isoDate(f[6]),
          partidas: [],
        };
        out.lancamentos.push(l);
        lancAtual = l;
        break;
      }
      case 'I250': {
        if (!lancAtual) {
          aviso('linha ' + nLinha + ': I250 sem I200');
          break;
        }
        const codCta = (f[2] ?? '').trim();
        const ind = (f[5] ?? '').trim();
        if (!codCta || (ind !== 'D' && ind !== 'C')) {
          aviso('linha ' + nLinha + ': I250 invalido');
          break;
        }
        lancAtual.partidas.push({
          seq: lancAtual.partidas.length + 1,
          codCta,
          codCcus: nz(f[3]),
          vlDc: dec(f[4]),
          indDc: ind,
          numArq: nz(f[6]),
          codHistPad: nz(f[7]),
          hist: nz(f[8]),
          codPart: nz(f[9]),
        });
        break;
      }
      case 'I075': {
        const cod = nz(f[2]);
        if (!cod || histVistos.has(cod)) break;
        histVistos.add(cod);
        out.historicos.push({ codHist: cod, descrHist: nz(f[3]) });
        break;
      }
      default:
        break;
    }
  }

  if (out.cabecalho) {
    out.cabecalho.indEsc = indEsc;
    out.cabecalho.codVerLc = codVerLc;
  }
  return out;
}
