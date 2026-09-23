// apps/api/src/modules/sped/ecf-arquivo/ecf-arq-parser.ts
// ============================================================================
// ARQUIVO FIEL DA ECF - CRIADO 21/09/2026
// Parser PURO (sem Nest, sem banco): le um arquivo SPED ECF (latin1) e devolve
// TODAS as linhas (bloco, registro, ordem, periodo e campos em texto), mais o
// cabecalho (0000/0010) e os periodos (M030/N030/L030/K030/E030/P030...).
//  - Os campos mudam entre os leiautes (0004..0012): por isso a guarda e fiel,
//    linha a linha; as colunas com nome ficam so nas visoes do LALUR.
//  - Cada linha recebe o periodo (A00 anual, A01..A12 balancos, T01.. trimestres)
//    do ultimo registro X030 do MESMO bloco.
//  - Independente do EcfParserService usado na importacao contabil.
// ============================================================================

export interface EcfCabecalho {
  codVer: string;
  cnpj: string;
  nome: string;
  dtIni: string;
  dtFin: string;
  retificadora: string;
  numRec: string | null;
  hashAnterior: string | null;
}

export interface EcfPeriodo {
  bloco: string;
  reg: string;
  dtIni: string;
  dtFin: string;
  per: string;
  ordem: number;
}

export interface EcfLinha {
  ordem: number;
  bloco: string;
  reg: string;
  per: string | null;
  campos: string[];
}

export interface EcfParsed {
  cabecalho: EcfCabecalho | null;
  periodos: EcfPeriodo[];
  linhas: EcfLinha[];
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

export function parseEcfArquivo(buffer: Buffer): EcfParsed {
  const texto = buffer.toString('latin1');
  const out: EcfParsed = {
    cabecalho: null,
    periodos: [],
    linhas: [],
    totalLinhas: 0,
    registros: {},
    avisos: [],
  };
  const aviso = (m: string): void => {
    if (out.avisos.length < 100) out.avisos.push(m);
  };

  const atual: Record<string, string> = {};
  let cab: EcfCabecalho | null = null;
  let hashAnterior: string | null = null;
  let ordem = 0;
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
    const f = linha.split('|');
    if (f.length < 3 || !/^[0-9A-Z]\d{3}$/.test(f[1])) {
      aviso('linha ' + nLinha + ': registro malformado');
      continue;
    }
    const reg = f[1];
    const bloco = reg.substring(0, 1);
    const campos = f[f.length - 1] === '' ? f.slice(2, f.length - 1) : f.slice(2);
    ordem++;
    out.totalLinhas++;
    out.registros[reg] = (out.registros[reg] ?? 0) + 1;

    if (reg === '0000') {
      cab = {
        codVer: (campos[1] ?? '').trim(),
        cnpj: (campos[2] ?? '').trim(),
        nome: (campos[3] ?? '').trim(),
        dtIni: isoDate(campos[8]) ?? '',
        dtFin: isoDate(campos[9]) ?? '',
        retificadora: (campos[10] ?? '').trim(),
        numRec: nz(campos[11]),
        hashAnterior: null,
      };
    } else if (reg === '0010' && hashAnterior === null) {
      hashAnterior = nz(campos[0]);
    }

    if (/^[A-Z]030$/.test(reg)) {
      const ini = isoDate(campos[0]);
      const fin = isoDate(campos[1]);
      const per = (campos[2] ?? '').trim();
      if (ini && fin && per) {
        out.periodos.push({ bloco, reg, dtIni: ini, dtFin: fin, per, ordem });
        atual[bloco] = per;
      } else {
        aviso('linha ' + nLinha + ': ' + reg + ' com periodo invalido');
      }
    }

    const per = /^[A-Z](001|990)$/.test(reg) ? null : atual[bloco] ?? null;
    out.linhas.push({ ordem, bloco, reg, per, campos });
  }

  if (cab) cab.hashAnterior = hashAnterior;
  out.cabecalho = cab;
  return out;
}
