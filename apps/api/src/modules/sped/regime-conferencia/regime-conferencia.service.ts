// apps/api/src/modules/sped/regime-conferencia/regime-conferencia.service.ts
// ============================================================================
// REGIMES x DECLARACOES - CRIADO 16/11/2026
// Confere o regime cadastrado (company_tax_regimes) com o declarado nas ECFs
// do arquivo fiel (registro 0010). REGRAS:
//  - LE: ecf_arquivos, ecf_arq_registros, company_tax_regimes
//  - GRAVA: somente company_tax_regimes, e so em criarRegimes (Master), para
//    exercicios SEM regime cadastrado. Nunca altera nem sobrescreve regime.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

// Tabela FORMA_TRIB do registro 0010 da ECF (padrao unico do LEDGR para forma de tributacao)
export const FORMAS_ECF: Record<string, string> = {
  '1': 'Lucro Real',
  '2': 'Lucro Real/Arbitrado',
  '3': 'Lucro Presumido/Real',
  '4': 'Lucro Presumido/Real/Arbitrado',
  '5': 'Lucro Presumido',
  '6': 'Lucro Arbitrado',
  '7': 'Lucro Presumido/Arbitrado',
  '8': 'Imune do IRPJ',
  '9': 'Isenta do IRPJ',
};

export interface Declarado0010 {
  forma: string;
  apuracao: string | null;
  qualificacao: string | null;
  tipEscPre: string | null;
  indRecReceita: string | null;
}

// A posicao de FORMA_TRIB no 0010 muda com o leiaute (ate o 0004 ha OPT_PAES antes dela).
// Localiza pelo padrao: um digito 1-9, seguido de FORMA_APUR (A/T/vazio) e COD_QUALIF_PJ (2 digitos).
export function ler0010(campos: string[] | null | undefined): Declarado0010 | null {
  const c = campos ?? [];
  let i = -1;
  for (let k = 1; k < c.length - 2; k++) {
    if (/^[1-9]$/.test(c[k] ?? '') && /^[AT]?$/.test(c[k + 1] ?? '') && /^\d{2}$/.test(c[k + 2] ?? '')) {
      i = k;
      break;
    }
  }
  if (i < 0) return null;
  const g = (n: number): string | null => {
    const v = (c[i + n] ?? '').trim();
    return v ? v : null;
  };
  const ind = g(9);
  return {
    forma: c[i],
    apuracao: g(1),
    qualificacao: g(2),
    tipEscPre: g(5),
    indRecReceita: ind === '1' || ind === '2' ? ind : null,
  };
}

export type SituacaoConferencia =
  | 'confere'
  | 'diverge'
  | 'sem_cadastro'
  | 'sem_declaracao'
  | 'no_prazo'
  | 'anterior_ecf'
  | 'sem_dados';

export interface LinhaConferencia {
  ano: number;
  situacao: SituacaoConferencia;
  cadastro: {
    id: string;
    dtIni: string;
    dtFin: string | null;
    forma: string;
    formaDescricao: string;
    apuracao: string | null;
    tipEscPre: string | null;
    criterioReceita: string | null;
  }[];
  declarado: {
    arquivoId: string;
    fileName: string;
    dtIni: string;
    dtFin: string;
    codVer: string | null;
    retificadora: string;
    numRec: string | null;
    loadedAt: string;
    forma: string | null;
    formaDescricao: string | null;
    apuracao: string | null;
    qualificacao: string | null;
    tipEscPre: string | null;
    indRecReceita: string | null;
  } | null;
  observacoes: string[];
}

const anoDe = (d: Date): number => d.getUTCFullYear();
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const PRESUMIDO = ['3', '4', '5', '7'];

@Injectable()
export class RegimeConferenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async conferencia(companyId: string) {
    const regimes = await this.prisma.companyTaxRegime.findMany({ where: { companyId }, orderBy: { dtIni: 'asc' } });
    const arquivos = await this.prisma.ecfArquivo.findMany({
      where: { companyId },
      orderBy: { dtIni: 'asc' },
      select: { id: true, fileName: true, dtIni: true, dtFin: true, codVer: true, retificadora: true, numRec: true, loadedAt: true },
    });
    const r0010 = new Map<string, string[]>();
    if (arquivos.length > 0) {
      const regs = await this.prisma.ecfArqRegistro.findMany({
        where: { arquivoId: { in: arquivos.map((a) => a.id) }, reg: '0010' },
        select: { arquivoId: true, campos: true },
      });
      for (const r of regs) if (!r0010.has(r.arquivoId)) r0010.set(r.arquivoId, r.campos);
    }

    const anoAtual = new Date().getFullYear();
    const anos: number[] = [];
    for (const a of arquivos) anos.push(anoDe(a.dtFin));
    for (const g of regimes) {
      anos.push(anoDe(g.dtIni));
      anos.push(g.dtFin ? anoDe(g.dtFin) : anoAtual);
    }
    const linhas: LinhaConferencia[] = [];
    const resumo: Record<string, number> = {};
    if (anos.length === 0) return { formas: FORMAS_ECF, linhas, resumo };

    const de = Math.min(...anos);
    const ate = Math.min(Math.max(...anos), anoAtual);
    for (let y = de; y <= ate; y++) {
      const ini = new Date(Date.UTC(y, 0, 1));
      const fim = new Date(Date.UTC(y, 11, 31));
      const cad = regimes.filter((g) => g.dtIni <= fim && (!g.dtFin || g.dtFin >= ini));
      const arqs = arquivos.filter((a) => anoDe(a.dtFin) === y);
      const arq = arqs.length > 0 ? arqs[arqs.length - 1] : null;
      const dec = arq ? ler0010(r0010.get(arq.id)) : null;
      const observacoes: string[] = [];
      if (arq && !dec) observacoes.push('Registro 0010 n\u00e3o localizado no arquivo carregado.');
      if (arqs.length > 1) observacoes.push('Mais de uma ECF no exerc\u00edcio; conferida a de per\u00edodo mais recente.');
      if (cad.length > 1) observacoes.push('Mais de um regime cadastrado no exerc\u00edcio.');

      let situacao: SituacaoConferencia;
      if (arq && dec && cad.length > 0) {
        const vig = cad.filter((g) => g.dtIni <= arq.dtFin && (!g.dtFin || g.dtFin >= arq.dtFin));
        const ref = vig.length > 0 ? vig[vig.length - 1] : cad[cad.length - 1];
        if (ref.formaTributacao === dec.forma) {
          situacao = 'confere';
          if (dec.apuracao && ref.periodoApuracaoIRPJ && dec.apuracao !== ref.periodoApuracaoIRPJ) {
            observacoes.push('Apura\u00e7\u00e3o do IRPJ: cadastro ' + ref.periodoApuracaoIRPJ + ', declarado ' + dec.apuracao + '.');
          }
          if (PRESUMIDO.includes(dec.forma) && (dec.tipEscPre ?? '') !== (ref.tipEscPre ?? '')) {
            observacoes.push('Escritura\u00e7\u00e3o (TIP_ESC_PRE): cadastro ' + (ref.tipEscPre ?? '-') + ', declarado ' + (dec.tipEscPre ?? '-') + '.');
          }
        } else {
          situacao = 'diverge';
        }
      } else if (arq && dec) {
        situacao = 'sem_cadastro';
      } else if (cad.length > 0) {
        situacao = y < 2014 ? 'anterior_ecf' : y >= anoAtual ? 'no_prazo' : 'sem_declaracao';
      } else {
        situacao = 'sem_dados';
      }
      resumo[situacao] = (resumo[situacao] ?? 0) + 1;

      linhas.push({
        ano: y,
        situacao,
        cadastro: cad.map((g) => ({
          id: g.id,
          dtIni: iso(g.dtIni),
          dtFin: g.dtFin ? iso(g.dtFin) : null,
          forma: g.formaTributacao,
          formaDescricao: FORMAS_ECF[g.formaTributacao] ?? g.formaTributacao,
          apuracao: g.periodoApuracaoIRPJ ?? null,
          tipEscPre: g.tipEscPre ?? null,
          criterioReceita: g.criterioReceita ?? null,
        })),
        declarado: arq
          ? {
              arquivoId: arq.id,
              fileName: arq.fileName,
              dtIni: iso(arq.dtIni),
              dtFin: iso(arq.dtFin),
              codVer: arq.codVer ?? null,
              retificadora: arq.retificadora,
              numRec: arq.numRec ?? null,
              loadedAt: arq.loadedAt.toISOString(),
              forma: dec ? dec.forma : null,
              formaDescricao: dec ? FORMAS_ECF[dec.forma] ?? dec.forma : null,
              apuracao: dec ? dec.apuracao : null,
              qualificacao: dec ? dec.qualificacao : null,
              tipEscPre: dec ? dec.tipEscPre : null,
              indRecReceita: dec ? dec.indRecReceita : null,
            }
          : null,
        observacoes,
      });
    }
    return { formas: FORMAS_ECF, linhas, resumo };
  }

  // Cria regimes SOMENTE para exercicios sem cadastro, a partir do 0010 das ECFs carregadas.
  // Exercicios seguidos com a mesma declaracao viram um unico regime. Nao altera regime existente.
  async criarRegimes(companyId: string) {
    const { linhas } = await this.conferencia(companyId);
    const cand = linhas.filter((l) => l.situacao === 'sem_cadastro' && l.declarado && l.declarado.forma);
    const criados: { dtIni: string; dtFin: string | null; forma: string; formaDescricao: string }[] = [];
    if (cand.length === 0) return { criados };

    const chave = (l: LinhaConferencia): string => {
      const d = l.declarado;
      return [d?.forma ?? '', d?.apuracao ?? '', d?.tipEscPre ?? '', d?.indRecReceita ?? ''].join('|');
    };
    const grupos: LinhaConferencia[][] = [];
    for (const l of cand) {
      const g = grupos.length > 0 ? grupos[grupos.length - 1] : null;
      const ult = g ? g[g.length - 1] : null;
      if (g && ult && l.ano === ult.ano + 1 && chave(l) === chave(ult)) g.push(l);
      else grupos.push([l]);
    }

    const existentes = await this.prisma.companyTaxRegime.findMany({ where: { companyId }, select: { dtIni: true } });
    const anoAtual = new Date().getFullYear();
    await this.prisma.$transaction(async (tx) => {
      for (let n = 0; n < grupos.length; n++) {
        const g = grupos[n];
        const pri = g[0].declarado;
        const ult = g[g.length - 1].declarado;
        if (!pri || !ult || !pri.forma) continue;
        const dtIni = new Date(pri.dtIni + 'T00:00:00.000Z');
        const dtFimDecl = new Date(ult.dtFin + 'T00:00:00.000Z');
        const haPosterior = existentes.some((r) => r.dtIni > dtFimDecl);
        const aberto = n === grupos.length - 1 && g[g.length - 1].ano >= anoAtual - 1 && !haPosterior;
        await tx.companyTaxRegime.create({
          data: {
            companyId,
            dtIni,
            dtFin: aberto ? null : dtFimDecl,
            formaTributacao: pri.forma,
            periodoApuracaoIRPJ: pri.apuracao,
            qualificacaoPJ: pri.qualificacao,
            tipEscPre: pri.tipEscPre,
            criterioReceita: pri.indRecReceita === '1' ? 'CAIXA' : null,
          },
        });
        criados.push({
          dtIni: pri.dtIni,
          dtFin: aberto ? null : ult.dtFin,
          forma: pri.forma,
          formaDescricao: FORMAS_ECF[pri.forma] ?? pri.forma,
        });
      }
    });
    return { criados };
  }
}
