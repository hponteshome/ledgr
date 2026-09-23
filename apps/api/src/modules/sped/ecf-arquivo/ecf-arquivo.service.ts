// apps/api/src/modules/sped/ecf-arquivo/ecf-arquivo.service.ts
// ============================================================================
// ARQUIVO FIEL DA ECF - CRIADO 21/09/2026
// Carga e analise (somente leitura) do LALUR. REGRAS:
//  - ESCREVE somente em ecf_arquivos / ecf_arq_periodos / ecf_arq_registros
//  - Unica leitura fora delas: companies.taxId (validar o CNPJ do arquivo)
//  - Guarda 1 versao VIGENTE por empresa e periodo: a retificadora vence a
//    original; copias com acentuacao danificada perdem para a integra.
// ============================================================================
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '@prisma/prisma.service';
import { parseEcfArquivo } from './ecf-arq-parser';

export interface ParteAConsistenciaAno {
  ano: string;
  arquivoId: string;
  m300Cod2: number | null;
  l300: number | null;
  diferenca: number | null;
  ok: boolean;
}

export interface ParteACruzadaLinha {
  ano: string;
  cod: string;
  descricao: string;
  tipo: string;
  valorIrpj: number | null;
  valorCsll: number | null;
  situacao: 'igual' | 'diferem' | 'so_irpj' | 'so_csll';
  semLastroIrpj: boolean;
  semLastroCsll: boolean;
}


export interface ParteBLinhaValidacao {
  ano: string;
  contaB: string;
  saldoInicial: number;
  parteA: number;
  parteB: number;
  saldoFinal: number;
  origem: 'primeiro_ano' | 'continuidade' | 'nova_conta' | 'quebra';
  contaOrigem: string | null;
  diferenca: number | null;
}


const LOTE = 4000;

export type AcaoCarga = 'carregada' | 'substituiu' | 'ignorada' | 'igual' | 'conflito';

interface SaldoB {
  ini: number;
  a: number;
  b: number;
  fim: number;
}

interface ResumoInt {
  arquivoId: string;
  ano: number;
  dtIni: string;
  retificadora: string;
  codVer: string | null;
  numRec: string | null;
  hashAnterior: string | null;
  lucroContabil: number | null;
  lucroAntesIrpj: number | null;
  adicoes: number;
  exclusoes: number;
  baseIrpj: number | null;
  baseCsll: number | null;
  parteB: { I: SaldoB; C: SaldoB };
  m500Ok: number;
  m500Total: number;
}

interface LinhaNorm {
  bloco: string;
  reg: string;
  per: string | null;
  campos: string[];
}

function lotes<T>(arr: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso + 'T00:00:00.000Z') : null;
}
function iso10(d: Date): string {
  return d.toISOString().substring(0, 10);
}
function num(s: string | undefined): number {
  const v = parseFloat((s ?? '').trim().replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}
function cents(s: string | undefined): number {
  return Math.round(num(s) * 100);
}
function sgn(v: string | undefined, dc: string | undefined): number {
  return ((dc ?? '').trim() === 'D' ? 1 : -1) * cents(v);
}
function qualidade(buf: Buffer): number {
  let q = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >= 0xc0) q++;
  return q;
}
function normLinha(l: LinhaNorm): string {
  return l.reg + '|' + (l.per ?? '') + '|' + l.campos.map((c) => c.replace(/[^0-9A-Za-z,.\-]/g, '')).join('|');
}
function conjunto(linhas: LinhaNorm[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) {
    if (l.bloco === '9' || l.reg === '0000' || l.reg === '0010') continue;
    const k = normLinha(l);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
function diferencas(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];
  a.forEach((n, k) => {
    const d = n - (b.get(k) ?? 0);
    for (let i = 0; i < d; i++) out.push(k);
  });
  b.forEach((n, k) => {
    const d = n - (a.get(k) ?? 0);
    for (let i = 0; i < d; i++) out.push(k);
  });
  return out;
}

@Injectable()
export class EcfArquivoService {
  constructor(private readonly prisma: PrismaService) {}

  // -- Carga: le o arquivo em memoria (nada e gravado em disco) --------------
  async carregar(companyId: string, userId: string | null, fileName: string, buffer: Buffer) {
    const p = parseEcfArquivo(buffer);
    const cab = p.cabecalho;
    if (!cab || !cab.dtIni || !cab.dtFin || !cab.cnpj) {
      throw new BadRequestException('Arquivo invalido: registro 0000 ausente ou sem periodo/CNPJ.');
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { taxId: true } });
    const cnpjEmpresa = (company?.taxId ?? '').replace(/\D/g, '');
    const cnpjArquivo = cab.cnpj.replace(/\D/g, '');
    if (cnpjEmpresa && cnpjArquivo !== cnpjEmpresa) {
      throw new BadRequestException(
        'CNPJ do arquivo (' + cnpjArquivo + ') diferente do CNPJ da empresa ativa (' + cnpjEmpresa + ').',
      );
    }

    const sha = createHash('sha256').update(buffer).digest('hex');
    const qual = qualidade(buffer);
    const dtIniD = toDate(cab.dtIni) as Date;
    const dtFinD = toDate(cab.dtFin) as Date;
    const info = (motivo: string) => ({
      fileName,
      sha256: sha,
      retificadora: cab.retificadora,
      numRec: cab.numRec,
      qualidade: qual,
      motivo,
      em: new Date().toISOString(),
    });
    const base = {
      periodo: cab.dtIni + ' a ' + cab.dtFin,
      retificadora: cab.retificadora,
      codVer: cab.codVer,
      linhas: p.totalLinhas,
      avisos: p.avisos.length,
    };

    let descartadas: unknown[] = [];
    let acao: AcaoCarga = 'carregada';
    let motivoAcao = '';

    const ex = await this.prisma.ecfArquivo.findFirst({ where: { companyId, dtIni: dtIniD, dtFin: dtFinD } });
    if (ex) {
      const desc: unknown[] = Array.isArray(ex.versoesDescartadas) ? (ex.versoesDescartadas as unknown[]) : [];
      if (ex.sha256 === sha) {
        return { acao: 'igual' as AcaoCarga, motivo: 'Este arquivo ja esta carregado.', ...base };
      }
      const rEx = ex.retificadora === 'S' ? 1 : 0;
      const rNew = cab.retificadora === 'S' ? 1 : 0;
      let novaVence = false;
      if (rNew !== rEx) {
        novaVence = rNew > rEx;
        motivoAcao = novaVence
          ? 'a retificadora substitui a original'
          : 'ja existe a retificadora deste periodo; a original nao interessa';
      } else {
        const rows = await this.prisma.ecfArqRegistro.findMany({
          where: { arquivoId: ex.id },
          select: { bloco: true, reg: true, per: true, campos: true },
        });
        const dif = diferencas(conjunto(rows), conjunto(p.linhas));
        const critico = dif.filter((k) => /^[MNLP]/.test(k));
        if (dif.length > 6 || critico.length > 0) {
          return {
            acao: 'conflito' as AcaoCarga,
            motivo:
              'Ja existe outra versao ' + (rEx ? 'retificadora' : 'original') + ' deste periodo com conteudo diferente (' +
              dif.length + ' linha(s) divergentes, ' + critico.length + ' nos blocos M/N/L/P). Nada foi alterado.',
            ...base,
          };
        }
        novaVence = qual > ex.qualidade;
        motivoAcao = novaVence
          ? 'mesmo conteudo com acentuacao preservada'
          : 'copia equivalente (mesmo conteudo, acentuacao igual ou pior)';
      }
      if (!novaVence) {
        await this.prisma.ecfArquivo.update({
          where: { id: ex.id },
          data: { versoesDescartadas: desc.concat([info(motivoAcao)]) as any },
        });
        return { acao: 'ignorada' as AcaoCarga, motivo: motivoAcao, ...base };
      }
      acao = 'substituiu';
      descartadas = desc.concat([
        {
          fileName: ex.fileName,
          sha256: ex.sha256,
          retificadora: ex.retificadora,
          numRec: ex.numRec,
          qualidade: ex.qualidade,
          motivo: motivoAcao,
        },
      ]);
    }

    const arquivoId = randomUUID();
    const stats = {
      linhas: p.totalLinhas,
      periodos: p.periodos.length,
      registros: p.registros,
      avisos: p.avisos.length,
      avisosAmostra: p.avisos.slice(0, 5),
    };

    await this.prisma.$transaction(
      async (tx) => {
        if (ex) await tx.ecfArquivo.deleteMany({ where: { id: ex.id } });
        await tx.ecfArquivo.create({
          data: {
            id: arquivoId,
            companyId,
            fileName,
            fileSize: buffer.length,
            sha256: sha,
            codVer: cab.codVer,
            cnpj: cnpjArquivo,
            nome: cab.nome,
            dtIni: dtIniD,
            dtFin: dtFinD,
            retificadora: cab.retificadora || 'N',
            numRec: cab.numRec,
            hashAnterior: cab.hashAnterior,
            qualidade: qual,
            versoesDescartadas: descartadas.length > 0 ? (descartadas as any) : undefined,
            stats: stats as any,
            loadedBy: userId,
          },
        });
        for (const ch of lotes(p.periodos, LOTE)) {
          await tx.ecfArqPeriodo.createMany({
            data: ch.map((x) => ({
              arquivoId,
              bloco: x.bloco,
              reg: x.reg,
              per: x.per,
              dtIni: toDate(x.dtIni) as Date,
              dtFin: toDate(x.dtFin) as Date,
              ordem: x.ordem,
            })),
          });
        }
        for (const ch of lotes(p.linhas, LOTE)) {
          await tx.ecfArqRegistro.createMany({
            data: ch.map((l) => ({
              arquivoId,
              ordem: l.ordem,
              bloco: l.bloco,
              reg: l.reg,
              per: l.per,
              campos: l.campos,
            })),
          });
        }
      },
      { maxWait: 30000, timeout: 900000 },
    );

    return { acao, motivo: motivoAcao, arquivoId, ...base, versoesDescartadas: descartadas.length };
  }

  // -- Consultas (somente leitura) -------------------------------------------
  async listar(companyId: string) {
    return this.prisma.ecfArquivo.findMany({
      where: { companyId },
      orderBy: { dtIni: 'asc' },
      select: {
        id: true,
        fileName: true,
        dtIni: true,
        dtFin: true,
        codVer: true,
        retificadora: true,
        numRec: true,
        hashAnterior: true,
        qualidade: true,
        versoesDescartadas: true,
        stats: true,
        loadedAt: true,
      },
    });
  }

  private async resumoInt(companyId: string): Promise<ResumoInt[]> {
    const arqs = await this.prisma.ecfArquivo.findMany({ where: { companyId }, orderBy: { dtIni: 'asc' } });
    const out: ResumoInt[] = [];
    for (const a of arqs) {
      const rows = await this.prisma.ecfArqRegistro.findMany({
        where: {
          arquivoId: a.id,
          OR: [{ reg: 'M500' }, { per: 'A00', reg: { in: ['L300', 'M300', 'M350', 'N630', 'N670'] } }],
        },
        orderBy: { ordem: 'asc' },
        select: { reg: true, per: true, campos: true },
      });
      const pB: { I: SaldoB; C: SaldoB } = {
        I: { ini: 0, a: 0, b: 0, fim: 0 },
        C: { ini: 0, a: 0, b: 0, fim: 0 },
      };
      let okN = 0;
      let totN = 0;
      let l301: number | null = null;
      let l3: number | null = null;
      let lucroAntes: number | null = null;
      let adic = 0;
      let excl = 0;
      let baseI: number | null = null;
      let baseC: number | null = null;
      for (const r of rows) {
        const c = r.campos;
        if (r.reg === 'M500') {
          const ini = sgn(c[2], c[3]);
          const pa = sgn(c[4], c[5]);
          const pb = sgn(c[6], c[7]);
          const fim = sgn(c[8], c[9]);
          totN++;
          if (ini + pa + pb === fim) okN++;
          if (r.per === 'A00' && (c[1] === 'I' || c[1] === 'C')) {
            const t = pB[c[1] as 'I' | 'C'];
            t.ini += ini;
            t.a += pa;
            t.b += pb;
            t.fim += fim;
          }
        } else if (r.reg === 'L300') {
          const v = ((c[7] ?? '').trim() === 'C' ? 1 : -1) * num(c[6]);
          if (c[0] === '3.01') l301 = v;
          else if (c[0] === '3') l3 = v;
        } else if (r.reg === 'M300') {
          if (c[0] === '2') lucroAntes = num(c[4]);
          if (c[2] === 'A') adic += cents(c[4]);
          else if (c[2] === 'E') excl += cents(c[4]);
        } else if (r.reg === 'N630' && c[0] === '1') {
          baseI = (c[2] ?? '').trim() === '' ? null : num(c[2]);
        } else if (r.reg === 'N670' && c[0] === '1') {
          baseC = (c[2] ?? '').trim() === '' ? null : num(c[2]);
        }
      }
      out.push({
        arquivoId: a.id,
        ano: Number(iso10(a.dtIni).substring(0, 4)),
        dtIni: iso10(a.dtIni),
        retificadora: a.retificadora,
        codVer: a.codVer,
        numRec: a.numRec,
        hashAnterior: a.hashAnterior,
        lucroContabil: l301 !== null ? l301 : l3,
        lucroAntesIrpj: lucroAntes,
        adicoes: adic / 100,
        exclusoes: excl / 100,
        baseIrpj: baseI,
        baseCsll: baseC,
        parteB: pB,
        m500Ok: okN,
        m500Total: totN,
      });
    }
    return out;
  }

  async resumo(companyId: string) {
    const itens = await this.resumoInt(companyId);
    const r2 = (s: SaldoB) => ({ ini: s.ini / 100, a: s.a / 100, b: s.b / 100, fim: s.fim / 100 });
    return itens.map((x) => ({
      arquivoId: x.arquivoId,
      ano: String(x.ano),
      retificadora: x.retificadora,
      codVer: x.codVer,
      lucroContabil: x.lucroContabil,
      lucroAntesIrpj: x.lucroAntesIrpj,
      adicoes: x.adicoes,
      exclusoes: x.exclusoes,
      baseIrpj: x.baseIrpj,
      baseCsll: x.baseCsll,
      parteB: { I: r2(x.parteB.I), C: r2(x.parteB.C) },
      m500Ok: x.m500Ok,
      m500Total: x.m500Total,
    }));
  }

  // Cadeia da Parte B: fechamento do ano anterior x abertura, e recalculo (fechamento + movimentos)
  async cadeia(companyId: string) {
    const itens = await this.resumoInt(companyId);
    const r2 = (c: number): number => c / 100;
    const montar = (trib: 'I' | 'C') => {
      const linhas: {
        ano: number;
        arquivoId: string;
        retificadora: string;
        iniDeclarado: number;
        fimAnteriorDeclarado: number | null;
        saltoAnterior: number | null;
        iniEsperado: number;
        dif: number;
        parteA: number;
        parteB: number;
        fimDeclarado: number;
        fimRecalculado: number;
        lacuna: boolean;
        anoAnterior: number | null;
      }[] = [];
      let recFim: number | null = null;
      let prev: ResumoInt | null = null;
      for (const it of itens) {
        const b = it.parteB[trib];
        const contiguo = prev !== null && it.ano === prev.ano + 1;
        const recIni: number = contiguo && recFim !== null ? recFim : b.ini;
        const recFinal = recIni + b.a + b.b;
        linhas.push({
          ano: it.ano,
          arquivoId: it.arquivoId,
          retificadora: it.retificadora,
          iniDeclarado: r2(b.ini),
          fimAnteriorDeclarado: prev ? r2(prev.parteB[trib].fim) : null,
          saltoAnterior: prev ? r2(b.ini - prev.parteB[trib].fim) : null,
          iniEsperado: r2(recIni),
          dif: r2(b.ini - recIni),
          parteA: r2(b.a),
          parteB: r2(b.b),
          fimDeclarado: r2(b.fim),
          fimRecalculado: r2(recFinal),
          lacuna: prev !== null && !contiguo,
          anoAnterior: prev ? prev.ano : null,
        });
        recFim = recFinal;
        prev = it;
      }
      return linhas;
    };
    const linhagem = itens.map((it) => {
      const ha = (it.hashAnterior ?? '').toUpperCase();
      const baseArq = ha.length >= 10 ? itens.find((x) => !!x.numRec && x.numRec.toUpperCase().startsWith(ha)) : undefined;
      return {
        ano: it.ano,
        retificadora: it.retificadora,
        numRec: it.numRec,
        hashAnterior: it.hashAnterior,
        partiuDe: baseArq ? String(baseArq.ano) : null,
        baseadoNaOriginal: !!baseArq && baseArq.retificadora === 'S',
      };
    });
    return { I: montar('I'), C: montar('C'), linhagem };
  }

  // -- Validacao completa da Parte B, conta a conta (sem agregar) -----------
  // Para cada (conta de controle, tributo, ano): confere se o saldo inicial
  // bate com o fechamento da MESMA conta no ano anterior (continuidade), ou
  // se bate com o fechamento de OUTRA conta do ano anterior (heranca, quando
  // o contador troca de conta de controle), ou se nao bate com nada (quebra
  // real, com a diferenca calculada).
  async parteBValidacao(companyId: string) {
    const arqs = await this.prisma.ecfArquivo.findMany({ where: { companyId }, orderBy: { dtIni: 'asc' } });
    const porTrib: Record<'I' | 'C', { ano: number; contaB: string; ini: number; a: number; b: number; fim: number }[]> = {
      I: [],
      C: [],
    };
    for (const arq of arqs) {
      const rows = await this.prisma.ecfArqRegistro.findMany({
        where: { arquivoId: arq.id, reg: 'M500', per: 'A00' },
        select: { campos: true },
      });
      const ano = Number(iso10(arq.dtIni).substring(0, 4));
      for (const r of rows) {
        const c = r.campos;
        const trib = c[1] === 'C' ? 'C' : c[1] === 'I' ? 'I' : null;
        if (!trib) continue;
        porTrib[trib].push({
          ano,
          contaB: c[0] ?? '',
          ini: sgn(c[2], c[3]),
          a: sgn(c[4], c[5]),
          b: sgn(c[6], c[7]),
          fim: sgn(c[8], c[9]),
        });
      }
    }

const montar = (trib: 'I' | 'C'): ParteBLinhaValidacao[] => {
      const porAno = new Map<number, typeof porTrib['I']>();
      for (const l of porTrib[trib]) {
        const arr = porAno.get(l.ano) ?? [];
        arr.push(l);
        porAno.set(l.ano, arr);
      }
      const anos = Array.from(porAno.keys()).sort((x, y) => x - y);
      const ultimoPorConta = new Map<string, number>();
      let fechamentosAnoAnterior = new Map<string, number>();
      const out: ParteBLinhaValidacao[] = [];

      for (const ano of anos) {
        const linhasAno = (porAno.get(ano) ?? []).sort((x, y) => x.contaB.localeCompare(y.contaB));
        const fechamentosDesteAno = new Map<string, number>();

        for (const l of linhasAno) {
          let origem: ParteBLinhaValidacao['origem'];
          let contaOrigem: string | null = null;
          let diferenca: number | null = null;
          const ultimoDestaConta = fechamentosAnoAnterior.get(l.contaB);

          if (ultimoDestaConta !== undefined) {
            const dif = l.ini - ultimoDestaConta;
            origem = Math.abs(dif) <= 1 ? 'continuidade' : 'quebra';
            if (origem === 'quebra') diferenca = dif / 100;
          } else if (fechamentosAnoAnterior.size === 0) {
            origem = 'primeiro_ano';
          } else {
            let achou: string | null = null;
            fechamentosAnoAnterior.forEach((v, k) => {
              if (achou === null && Math.abs(v - l.ini) <= 1) achou = k;
            });
            if (achou !== null) {
              origem = 'nova_conta';
              contaOrigem = achou;
            } else {
              origem = 'quebra';
              let melhor = Infinity;
              fechamentosAnoAnterior.forEach((v) => {
                const d = Math.abs(v - l.ini);
                if (d < melhor) melhor = d;
              });
              diferenca = melhor === Infinity ? null : melhor / 100;
            }
          }

          out.push({
            ano: String(ano),
            contaB: l.contaB,
            saldoInicial: l.ini / 100,
            parteA: l.a / 100,
            parteB: l.b / 100,
            saldoFinal: l.fim / 100,
            origem,
            contaOrigem,
            diferenca,
          });

          fechamentosDesteAno.set(l.contaB, l.fim);
          ultimoPorConta.set(l.contaB, l.fim);
        }

        fechamentosAnoAnterior = fechamentosDesteAno;
      }

      return out;
    };

    return { I: montar('I'), C: montar('C') };
  }

  // -- Parte A: validacao completa (consistencia interna + cruzamento IRPJ x CSLL) ---
  async parteAValidacao(companyId: string) {
    const arqs = await this.prisma.ecfArquivo.findMany({ where: { companyId }, orderBy: { dtIni: 'asc' } });

    const consistencia: ParteAConsistenciaAno[] = [];
    const cruzada: ParteACruzadaLinha[] = [];

    for (const arq of arqs) {
      const ano = iso10(arq.dtIni).substring(0, 4);

      // -- consistencia interna: M300 cod=2 (lucro antes do IRPJ) x L300 cod=3 --
      const rowsCod2 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId: arq.id, reg: 'M300', per: 'A00' } });
      const linhaCod2 = rowsCod2.find((r) => r.campos[0] === '2');
      const valorM300 = linhaCod2 ? num(linhaCod2.campos[4]) : null;

      const rowsL300 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId: arq.id, reg: 'L300', per: 'A00' } });
      const linhaL300 = rowsL300.find((r) => r.campos[0] === '3.01');
      const valorL300 = linhaL300 ? num(linhaL300.campos[6]) * (linhaL300.campos[7] === 'C' ? 1 : -1) : null;

      const dif = valorM300 !== null && valorL300 !== null ? valorM300 - valorL300 : null;
      consistencia.push({
        ano,
        arquivoId: arq.id,
        m300Cod2: valorM300,
        l300: valorL300,
        diferenca: dif,
        ok: dif !== null && Math.abs(dif) <= 0.01,
      });

      // -- cruzamento IRPJ (M300/M310) x CSLL (M350/M360) --
      const montaMapa = async (regPai: string, regFilho: string) => {
        const rows = await this.prisma.ecfArqRegistro.findMany({
          where: { arquivoId: arq.id, reg: { in: [regPai, regFilho] }, per: 'A00' },
          orderBy: { ordem: 'asc' },
        });
        const valores = new Map<string, { descr: string; tipo: string; valor: number }>();
        const contas = new Map<string, number>();
        let curCod: string | null = null;
        for (const r of rows) {
          if (r.reg === regPai) {
            const cod = r.campos[0] ?? '';
            curCod = cod;
            valores.set(cod, { descr: r.campos[1] ?? '', tipo: r.campos[2] ?? '', valor: num(r.campos[4]) });
          } else if (curCod) {
            contas.set(curCod, (contas.get(curCod) ?? 0) + 1);
          }
        }
        return { valores, contas };
      };

      const irpj = await montaMapa('M300', 'M310');
      const csll = await montaMapa('M350', 'M360');
      const codigos = new Set<string>([...irpj.valores.keys(), ...csll.valores.keys()]);

      for (const cod of Array.from(codigos).sort()) {
        if (cod === '2') continue;
        const vi = irpj.valores.get(cod);
        const vc = csll.valores.get(cod);
        if (!vi && !vc) continue;
        if ((vi && vi.valor === 0) && (!vc || vc.valor === 0)) continue;
        if ((vc && vc.valor === 0) && (!vi || vi.valor === 0)) continue;

        let situacao: ParteACruzadaLinha['situacao'];
        if (vi && vc) situacao = Math.abs(vi.valor - vc.valor) <= 0.01 ? 'igual' : 'diferem';
        else if (vi) situacao = 'so_irpj';
        else situacao = 'so_csll';

        cruzada.push({
          ano,
          cod,
          descricao: (vi ?? vc)!.descr,
          tipo: (vi ?? vc)!.tipo,
          valorIrpj: vi ? vi.valor : null,
          valorCsll: vc ? vc.valor : null,
          situacao,
          semLastroIrpj: !!vi && vi.valor !== 0 && (irpj.contas.get(cod) ?? 0) === 0,
          semLastroCsll: !!vc && vc.valor !== 0 && (csll.contas.get(cod) ?? 0) === 0,
        });
      }
    }

    return { consistencia, cruzada };
  }

  async parteA(companyId: string, arquivoId: string, per?: string, trib?: string) {
    const a = await this.garantirArquivo(companyId, arquivoId);
    const t = trib === 'C' ? 'C' : 'I';
    const regP = t === 'C' ? 'M350' : 'M300';
    const regF = t === 'C' ? 'M360' : 'M310';
    const p = per && /^[A-Z]\d{2}$/.test(per) ? per : 'A00';
    const rows = await this.prisma.ecfArqRegistro.findMany({
      where: { arquivoId, per: p, reg: { in: [regP, regF] } },
      orderBy: { ordem: 'asc' },
      select: { reg: true, campos: true },
    });
    type Conta = { codCta: string; codCcus: string; valor: number; dc: string };
    type Linha = {
      cod: string;
      descricao: string;
      tipo: string;
      indRelacao: string;
      valor: number;
      historico: string;
      contas: Conta[];
    };
    const linhas: Linha[] = [];
    let cur: Linha | null = null;
    for (const r of rows) {
      const c = r.campos;
      if (r.reg === regP) {
        cur = {
          cod: c[0] ?? '',
          descricao: c[1] ?? '',
          tipo: c[2] ?? '',
          indRelacao: c[3] ?? '',
          valor: num(c[4]),
          historico: c[5] ?? '',
          contas: [],
        };
        linhas.push(cur);
      } else if (cur) {
        cur.contas.push({ codCta: c[0] ?? '', codCcus: c[1] ?? '', valor: num(c[2]), dc: c[3] ?? '' });
      }
    }
    let adicoes = 0;
    let exclusoes = 0;
    for (const l of linhas) {
      if (l.tipo === 'A') adicoes += Math.round(l.valor * 100);
      else if (l.tipo === 'E') exclusoes += Math.round(l.valor * 100);
    }
    return {
      arquivo: { id: a.id, ano: iso10(a.dtIni).substring(0, 4), retificadora: a.retificadora, fileName: a.fileName },
      trib: t,
      per: p,
      periodos: await this.periodosM(arquivoId),
      linhas: linhas.filter((l) => l.valor !== 0 || l.contas.length > 0),
      totais: { adicoes: adicoes / 100, exclusoes: exclusoes / 100 },
    };
  }

  async parteB(companyId: string, arquivoId: string, per?: string) {
    const a = await this.garantirArquivo(companyId, arquivoId);
    const p = per && /^[A-Z]\d{2}$/.test(per) ? per : 'A00';
    const sel = { ordem: true, per: true, campos: true };
    const m010 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId, reg: 'M010' }, orderBy: { ordem: 'asc' }, select: sel });
    const m410 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId, reg: 'M410', per: p }, orderBy: { ordem: 'asc' }, select: sel });
    const m500 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId, reg: 'M500', per: p }, orderBy: { ordem: 'asc' }, select: sel });
    const m510 = await this.prisma.ecfArqRegistro.findMany({ where: { arquivoId, reg: 'M510', per: p }, orderBy: { ordem: 'asc' }, select: sel });
    return {
      arquivo: { id: a.id, ano: iso10(a.dtIni).substring(0, 4), retificadora: a.retificadora, fileName: a.fileName },
      per: p,
      periodos: await this.periodosM(arquivoId),
      m010,
      m410,
      m500,
      m510,
    };
  }

  async indice(companyId: string, arquivoId: string) {
    await this.garantirArquivo(companyId, arquivoId);
    const regs = await this.prisma.$queryRawUnsafe<{ bloco: string; reg: string; n: number }[]>(
      'SELECT bloco, reg, COUNT(*)::int AS n FROM ecf_arq_registros WHERE arquivo_id = $1::uuid GROUP BY bloco, reg ORDER BY bloco, reg',
      arquivoId,
    );
    const pers = await this.prisma.$queryRawUnsafe<{ per: string }[]>(
      'SELECT DISTINCT per FROM ecf_arq_registros WHERE arquivo_id = $1::uuid AND per IS NOT NULL ORDER BY per',
      arquivoId,
    );
    return {
      registros: regs.map((r) => ({ bloco: r.bloco, reg: r.reg, n: Number(r.n) })),
      periodos: pers.map((x) => x.per),
    };
  }

  async registros(
    companyId: string,
    arquivoId: string,
    reg: string,
    per?: string,
    q?: string,
    limite?: string,
    offset?: string,
  ) {
    await this.garantirArquivo(companyId, arquivoId);
    if (!/^[0-9A-Z]\d{3}$/.test(reg ?? '')) throw new BadRequestException('Registro invalido.');
    const lim = Math.min(Math.max(parseInt(limite ?? '200', 10) || 200, 1), 2000);
    const off = Math.max(parseInt(offset ?? '0', 10) || 0, 0);
    const perP = per && per !== '' ? per : null;
    const qP = q && q.trim() !== '' ? q.trim() : null;
    const filtro =
      "FROM ecf_arq_registros WHERE arquivo_id = $1::uuid AND reg = $2 AND ($3::text IS NULL OR per = $3::text) AND ($4::text IS NULL OR array_to_string(campos, '|') ILIKE '%' || $4::text || '%')";
    const dados = await this.prisma.$queryRawUnsafe<{ ordem: number; per: string | null; campos: string[] }[]>(
      'SELECT ordem, per, campos ' + filtro + ' ORDER BY ordem LIMIT ' + lim + ' OFFSET ' + off,
      arquivoId,
      reg,
      perP,
      qP,
    );
    const tot = await this.prisma.$queryRawUnsafe<{ n: number }[]>('SELECT COUNT(*)::int AS n ' + filtro, arquivoId, reg, perP, qP);
    return {
      reg,
      per: perP,
      total: Number(tot[0]?.n ?? 0),
      limite: lim,
      offset: off,
      linhas: dados.map((d) => ({ ordem: Number(d.ordem), per: d.per, campos: d.campos })),
    };
  }

  private async periodosM(arquivoId: string) {
    const ps = await this.prisma.ecfArqPeriodo.findMany({
      where: { arquivoId, bloco: 'M' },
      orderBy: { ordem: 'asc' },
      select: { per: true, dtIni: true, dtFin: true },
    });
    return ps.map((x) => ({ per: x.per, dtIni: iso10(x.dtIni), dtFin: iso10(x.dtFin) }));
  }

  private async garantirArquivo(companyId: string, arquivoId: string) {
    const a = await this.prisma.ecfArquivo.findFirst({ where: { id: arquivoId, companyId } });
    if (!a) throw new NotFoundException('Arquivo ECF nao encontrado.');
    return a;
  }
}
