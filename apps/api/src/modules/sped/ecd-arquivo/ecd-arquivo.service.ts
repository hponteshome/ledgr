// apps/api/src/modules/sped/ecd-arquivo/ecd-arquivo.service.ts
// ============================================================================
// ARQUIVO FIEL DA ECD - CRIADO 21/09/2026
// Carga e consulta das tabelas ecd_arq*. REGRAS:
//  - ESCREVE somente em ecd_arquivos / ecd_arq_* (tabelas exclusivas desta funcao)
//  - Unica leitura fora delas: companies.taxId (validar o CNPJ do arquivo)
//  - NAO le nem grava journal_entries, chart_of_accounts, account_balances etc.
// ============================================================================
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@prisma/prisma.service';
import { parseEcdArquivo } from './ecd-arq-parser';

const LOTE = 3000;

function lotes<T>(arr: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
}
function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso + 'T00:00:00.000Z') : null;
}
function cents(v: unknown): number {
  return Math.round(Number(v ?? 0) * 100);
}
function sgn(v: unknown, dc: string): number {
  return (dc === 'D' ? 1 : -1) * cents(v);
}
function iso10(d: Date): string {
  return d.toISOString().substring(0, 10);
}
function dcDe(saldo: number): { valor: number; dc: 'D' | 'C' } {
  return { valor: Math.abs(saldo) / 100, dc: saldo >= 0 ? 'D' : 'C' };
}

@Injectable()
export class EcdArquivoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Carga: le o arquivo em memoria (nada e gravado em disco) ─────────────
  async carregar(companyId: string, userId: string | null, fileName: string, buffer: Buffer) {
    const p = parseEcdArquivo(buffer);
    const cab = p.cabecalho;
    if (!cab || !cab.dtIni || !cab.dtFin) {
      throw new BadRequestException('Arquivo invalido: registro 0000 ausente ou sem periodo.');
    }
    const contasI = p.contas.filter((c) => c.bloco === 'I').length;
    if (contasI === 0) throw new BadRequestException('Arquivo sem plano de contas (I050).');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true },
    });
    const cnpjEmpresa = (company?.taxId ?? '').replace(/\D/g, '');
    const cnpjArquivo = cab.cnpj.replace(/\D/g, '');
    if (cnpjEmpresa && cnpjArquivo !== cnpjEmpresa) {
      throw new BadRequestException(
        'CNPJ do arquivo (' + cnpjArquivo + ') diferente do CNPJ da empresa ativa (' + cnpjEmpresa + ').',
      );
    }

    const saldosI = p.saldos.filter((s) => s.bloco === 'I').length;
    let nPart = 0;
    const tipos: Record<string, number> = {};
    for (const l of p.lancamentos) {
      nPart += l.partidas.length;
      const k = l.indLcto ?? '?';
      tipos[k] = (tipos[k] ?? 0) + 1;
    }
    const stats = {
      contasI,
      contasC: p.contas.length - contasI,
      saldosI,
      saldosC: p.saldos.length - saldosI,
      lancamentos: p.lancamentos.length,
      lancamentosPorTipo: tipos,
      partidas: nPart,
      historicos: p.historicos.length,
      avisos: p.avisos.length,
      recuperado: p.recuperado,
      linhas: p.totalLinhas,
    };

    const arquivoId = randomUUID();
    const dtIniD = toDate(cab.dtIni) as Date;
    const dtFinD = toDate(cab.dtFin) as Date;

    const removidos = await this.prisma.$transaction(
      async (tx) => {
        const del = await tx.ecdArquivo.deleteMany({ where: { companyId, dtIni: dtIniD, dtFin: dtFinD } });

        await tx.ecdArquivo.create({
          data: {
            id: arquivoId,
            companyId,
            fileName,
            fileSize: buffer.length,
            cnpj: cnpjArquivo,
            nomeEmpresarial: cab.nomeEmpresarial,
            dtIni: dtIniD,
            dtFin: dtFinD,
            codVerLc: cab.codVerLc,
            indEsc: cab.indEsc,
            indFinEsc: cab.indFinEsc,
            codHashSub: cab.codHashSub,
            stats: stats as any,
            loadedBy: userId,
          },
        });

        for (const ch of lotes(p.contas, LOTE)) {
          await tx.ecdArqConta.createMany({
            data: ch.map((c) => ({
              arquivoId,
              bloco: c.bloco,
              codCta: c.codCta,
              codCtaSup: c.codCtaSup,
              nome: c.nome,
              codNat: c.codNat,
              indCta: c.indCta,
              nivel: c.nivel,
              dtAlt: toDate(c.dtAlt),
              codCtaRef: c.codCtaRef,
            })),
          });
        }

        for (const ch of lotes(p.saldos, LOTE)) {
          await tx.ecdArqSaldo.createMany({
            data: ch.map((s) => ({
              arquivoId,
              bloco: s.bloco,
              dtIni: toDate(s.dtIni) as Date,
              dtFin: toDate(s.dtFin) as Date,
              codCta: s.codCta,
              codCcus: s.codCcus,
              vlSldIni: s.vlSldIni,
              indDcIni: s.indDcIni,
              vlDeb: s.vlDeb,
              vlCred: s.vlCred,
              vlSldFin: s.vlSldFin,
              indDcFin: s.indDcFin,
            })),
          });
        }

        for (const ch of lotes(p.historicos, LOTE)) {
          await tx.ecdArqHistorico.createMany({
            data: ch.map((h) => ({ arquivoId, codHist: h.codHist, descrHist: h.descrHist })),
          });
        }

        for (const lote of lotes(p.lancamentos, 1000)) {
          const lancRows: any[] = [];
          const partRows: any[] = [];
          for (const l of lote) {
            const id = randomUUID();
            lancRows.push({
              id,
              arquivoId,
              seq: l.seq,
              numLcto: l.numLcto,
              dtLcto: toDate(l.dtLcto) as Date,
              vlLcto: l.vlLcto,
              indLcto: l.indLcto,
              dtLctoExt: toDate(l.dtLctoExt),
            });
            for (const x of l.partidas) {
              partRows.push({
                arquivoId,
                lancamentoId: id,
                seq: x.seq,
                codCta: x.codCta,
                codCcus: x.codCcus,
                vlDc: x.vlDc,
                indDc: x.indDc,
                numArq: x.numArq,
                codHistPad: x.codHistPad,
                hist: x.hist,
                codPart: x.codPart,
              });
            }
          }
          await tx.ecdArqLancamento.createMany({ data: lancRows });
          for (const pl of lotes(partRows, LOTE)) {
            await tx.ecdArqPartida.createMany({ data: pl });
          }
        }
        return del.count;
      },
      { maxWait: 30000, timeout: 900000 },
    );

    return {
      arquivoId,
      dtIni: cab.dtIni,
      dtFin: cab.dtFin,
      codVerLc: cab.codVerLc,
      substituiu: removidos > 0,
      ...stats,
      avisosAmostra: p.avisos.slice(0, 20),
    };
  }

  // ── Consultas (somente leitura) ──────────────────────────────────────────
  async listar(companyId: string) {
    return this.prisma.ecdArquivo.findMany({
      where: { companyId },
      orderBy: { dtIni: 'asc' },
      select: {
        id: true,
        fileName: true,
        dtIni: true,
        dtFin: true,
        codVerLc: true,
        indFinEsc: true,
        nomeEmpresarial: true,
        cnpj: true,
        stats: true,
        loadedAt: true,
      },
    });
  }

  async contas(companyId: string, arquivoId: string, bloco: string) {
    await this.garantirArquivo(companyId, arquivoId);
    return this.prisma.ecdArqConta.findMany({
      where: { arquivoId, bloco: bloco === 'C' ? 'C' : 'I' },
      orderBy: { codCta: 'asc' },
      select: {
        codCta: true,
        codCtaSup: true,
        nome: true,
        codNat: true,
        indCta: true,
        nivel: true,
        codCtaRef: true,
      },
    });
  }

  async razao(companyId: string, arquivoId: string, codCta: string, dtIniQ?: string, dtFinQ?: string) {
    const arq = await this.garantirArquivo(companyId, arquivoId);
    if (!codCta) throw new BadRequestException('Informe a conta.');
    const conta = await this.prisma.ecdArqConta.findFirst({ where: { arquivoId, bloco: 'I', codCta } });
    if (!conta) throw new NotFoundException('Conta nao encontrada no plano deste arquivo.');

    const arqIni = iso10(arq.dtIni);
    const arqFin = iso10(arq.dtFin);
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if ((dtIniQ && !re.test(dtIniQ)) || (dtFinQ && !re.test(dtFinQ))) {
      throw new BadRequestException('Datas devem estar no formato aaaa-mm-dd.');
    }
    let dtIni = dtIniQ || arqIni;
    let dtFin = dtFinQ || arqFin;
    if (dtIni < arqIni) dtIni = arqIni;
    if (dtFin > arqFin) dtFin = arqFin;
    if (dtIni > dtFin) throw new BadRequestException('Periodo invalido.');

    // Saldos mensais (I155) da conta, somando centros de custo
    const saldosDb = await this.prisma.ecdArqSaldo.findMany({
      where: { arquivoId, bloco: 'I', codCta },
      orderBy: { dtIni: 'asc' },
    });
    const mapa = new Map<string, { ini: string; fin: string; sldIni: number; sldFin: number }>();
    for (const s of saldosDb) {
      const ini = iso10(s.dtIni);
      const fin = iso10(s.dtFin);
      const k = ini + '|' + fin;
      const e = mapa.get(k) ?? { ini, fin, sldIni: 0, sldFin: 0 };
      e.sldIni += sgn(s.vlSldIni, s.indDcIni);
      e.sldFin += sgn(s.vlSldFin, s.indDcFin);
      mapa.set(k, e);
    }
    const periodos = Array.from(mapa.values());

    // Saldo inicial = saldo inicial do I155 do mes que contem dtIni + movimento do inicio do mes ate dtIni-1
    const pIni = periodos.find((x) => x.ini <= dtIni && dtIni <= x.fin);
    const baseData = pIni ? pIni.ini : arqIni;
    const base = pIni ? pIni.sldIni : 0;
    let antes = 0;
    if (baseData < dtIni) {
      const d = await this.somaPartidas(arquivoId, codCta, 'D', baseData, dtIni, true);
      const c = await this.somaPartidas(arquivoId, codCta, 'C', baseData, dtIni, true);
      antes = d - c;
    }
    const saldoInicial = base + antes;

    // Movimento do periodo
    const rows = await this.prisma.ecdArqPartida.findMany({
      where: {
        arquivoId,
        codCta,
        lancamento: { dtLcto: { gte: toDate(dtIni) as Date, lte: toDate(dtFin) as Date } },
      },
      select: {
        seq: true,
        vlDc: true,
        indDc: true,
        hist: true,
        codHistPad: true,
        lancamentoId: true,
        lancamento: { select: { numLcto: true, dtLcto: true, indLcto: true, seq: true } },
      },
    });
    rows.sort(
      (a, b) =>
        a.lancamento.dtLcto.getTime() - b.lancamento.dtLcto.getTime() ||
        a.lancamento.seq - b.lancamento.seq ||
        a.seq - b.seq,
    );

    // Historico padrao (I075)
    const codsHist = Array.from(new Set(rows.map((r) => r.codHistPad).filter((x): x is string => !!x)));
    const histMap = new Map<string, string>();
    if (codsHist.length > 0) {
      const hs = await this.prisma.ecdArqHistorico.findMany({ where: { arquivoId, codHist: { in: codsHist } } });
      for (const h of hs) histMap.set(h.codHist, h.descrHist ?? '');
    }

    // Contrapartida (outras contas do mesmo lancamento)
    const contra = new Map<string, string[]>();
    const ids = Array.from(new Set(rows.map((r) => r.lancamentoId)));
    for (const ch of lotes(ids, 5000)) {
      const outras = await this.prisma.ecdArqPartida.findMany({
        where: { lancamentoId: { in: ch }, codCta: { not: codCta } },
        select: { lancamentoId: true, codCta: true },
      });
      for (const o of outras) {
        const a = contra.get(o.lancamentoId) ?? [];
        if (!a.includes(o.codCta)) a.push(o.codCta);
        contra.set(o.lancamentoId, a);
      }
    }

    let saldo = saldoInicial;
    let totD = 0;
    let totC = 0;
    let movE = 0;
    const linhas = rows.map((r) => {
      const v = cents(r.vlDc);
      const deb = r.indDc === 'D' ? v : 0;
      const cred = r.indDc === 'C' ? v : 0;
      saldo += deb - cred;
      totD += deb;
      totC += cred;
      if (r.lancamento.indLcto === 'E') movE += deb - cred;
      const cp = contra.get(r.lancamentoId) ?? [];
      const s = dcDe(saldo);
      const padrao = r.codHistPad ? histMap.get(r.codHistPad) ?? '' : '';
      return {
        data: iso10(r.lancamento.dtLcto),
        numLcto: r.lancamento.numLcto,
        indLcto: r.lancamento.indLcto,
        historico: r.hist ?? padrao,
        codHistPad: r.codHistPad,
        contrapartida: cp.slice(0, 3).join(', ') + (cp.length > 3 ? ' (+' + (cp.length - 3) + ')' : ''),
        debito: deb / 100,
        credito: cred / 100,
        saldo: s.valor,
        saldoDc: s.dc,
      };
    });

    // Conferencia com o saldo final do I155 (quando dtFin e fim de um periodo mensal)
    const pFin = periodos.find((x) => x.fin === dtFin);
    let conferencia: null | {
      esperado: number;
      esperadoDc: string;
      calculado: number;
      calculadoDc: string;
      criterio: string;
      ok: boolean;
    } = null;
    if (pFin) {
      const esp = pFin.sldFin;
      const com = saldo;
      const sem = saldo - movE;
      const criterio = esp === sem ? 'sem_encerramento' : esp === com ? 'com_encerramento' : 'divergente';
      const cal = dcDe(criterio === 'com_encerramento' ? com : sem);
      const e = dcDe(esp);
      conferencia = {
        esperado: e.valor,
        esperadoDc: e.dc,
        calculado: cal.valor,
        calculadoDc: cal.dc,
        criterio,
        ok: criterio !== 'divergente',
      };
    }

    return {
      arquivo: { id: arq.id, fileName: arq.fileName, dtIni: arqIni, dtFin: arqFin, codVerLc: arq.codVerLc },
      conta: {
        codCta: conta.codCta,
        nome: conta.nome,
        indCta: conta.indCta,
        nivel: conta.nivel,
        codNat: conta.codNat,
        codCtaRef: conta.codCtaRef,
      },
      periodo: { dtIni, dtFin },
      saldoInicial: dcDe(saldoInicial),
      linhas,
      totais: { debitos: totD / 100, creditos: totC / 100, lancamentos: linhas.length },
      saldoFinal: dcDe(saldo),
      conferencia,
    };
  }

  // -- Razao de varias contas / intervalo / geral (somente leitura) ----------
  async razaoGeral(
    companyId: string,
    arquivoId: string,
    opts: { contas?: string; de?: string; ate?: string; dtIni?: string; dtFin?: string; soComMovimento?: boolean },
  ) {
    const arq = await this.garantirArquivo(companyId, arquivoId);
    const arqIni = iso10(arq.dtIni);
    const arqFin = iso10(arq.dtFin);
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if ((opts.dtIni && !re.test(opts.dtIni)) || (opts.dtFin && !re.test(opts.dtFin))) {
      throw new BadRequestException('Datas devem estar no formato aaaa-mm-dd.');
    }
    let dtIni = opts.dtIni || arqIni;
    let dtFin = opts.dtFin || arqFin;
    if (dtIni < arqIni) dtIni = arqIni;
    if (dtFin > arqFin) dtFin = arqFin;
    if (dtIni > dtFin) throw new BadRequestException('Periodo invalido.');

    // Plano do arquivo (mesma ordem da lista de contas)
    const plano = await this.prisma.ecdArqConta.findMany({
      where: { arquivoId, bloco: 'I' },
      orderBy: { codCta: 'asc' },
      select: { codCta: true, codCtaSup: true, indCta: true },
    });
    const indice = new Map<string, number>();
    const analitica = new Map<string, boolean>();
    const filhos = new Map<string, string[]>();
    plano.forEach((c, i) => {
      indice.set(c.codCta, i);
      analitica.set(c.codCta, c.indCta === 'A');
      if (c.codCtaSup) {
        const a = filhos.get(c.codCtaSup) ?? [];
        a.push(c.codCta);
        filhos.set(c.codCtaSup, a);
      }
    });

    const alvo = new Set<string>();
    const addConta = (cod: string): void => {
      if (analitica.get(cod)) {
        alvo.add(cod);
        return;
      }
      for (const f of filhos.get(cod) ?? []) addConta(f);
    };

    const lista = (opts.contas ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
    let modo: 'contas' | 'intervalo' | 'geral' = 'geral';
    if (lista.length > 0) {
      if (lista.length > 500) throw new BadRequestException('Selecione no maximo 500 contas.');
      modo = 'contas';
      for (const cod of lista) {
        if (!indice.has(cod)) throw new NotFoundException('Conta ' + cod + ' nao existe no plano deste arquivo.');
        addConta(cod);
      }
    } else if (opts.de || opts.ate) {
      modo = 'intervalo';
      const iDe = opts.de ? indice.get(opts.de) : 0;
      const iAte = opts.ate ? indice.get(opts.ate) : plano.length - 1;
      if (iDe === undefined) throw new NotFoundException('Conta inicial ' + opts.de + ' nao existe no plano deste arquivo.');
      if (iAte === undefined) throw new NotFoundException('Conta final ' + opts.ate + ' nao existe no plano deste arquivo.');
      const a = Math.min(iDe, iAte);
      const b = Math.max(iDe, iAte);
      for (let i = a; i <= b; i++) {
        if (analitica.get(plano[i].codCta)) alvo.add(plano[i].codCta);
      }
    } else {
      for (const c of plano) {
        if (c.indCta === 'A') alvo.add(c.codCta);
      }
    }

    // Movimento por conta no periodo (SELECT com parametros ligados)
    const mov = await this.prisma.$queryRawUnsafe<{ cod_cta: string; n: number }[]>(
      'SELECT p.cod_cta AS cod_cta, COUNT(*)::int AS n FROM ecd_arq_partidas p ' +
        'JOIN ecd_arq_lancamentos l ON l.id = p.lancamento_id ' +
        'WHERE p.arquivo_id = $1::uuid AND l.dt_lcto >= $2::date AND l.dt_lcto <= $3::date GROUP BY p.cod_cta',
      arquivoId,
      dtIni,
      dtFin,
    );
    const movPorConta = new Map<string, number>();
    for (const m of mov) movPorConta.set(m.cod_cta, Number(m.n));

    const soMov = opts.soComMovimento !== false;
    let candidatas = Array.from(alvo).sort((x, y) => (indice.get(x) as number) - (indice.get(y) as number));
    if (soMov) candidatas = candidatas.filter((c) => (movPorConta.get(c) ?? 0) > 0);

    let totalPartidas = 0;
    for (const c of candidatas) totalPartidas += movPorConta.get(c) ?? 0;
    const LIMITE = 20000;
    if (totalPartidas > LIMITE) {
      throw new BadRequestException(
        'Resultado com ' + totalPartidas + ' partidas (limite ' + LIMITE + '). Restrinja as contas ou o periodo.',
      );
    }

    const blocos: Awaited<ReturnType<EcdArquivoService['razao']>>[] = [];
    for (const ch of lotes(candidatas, 6)) {
      const parc = await Promise.all(ch.map((cod) => this.razao(companyId, arquivoId, cod, dtIni, dtFin)));
      for (const r of parc) {
        if (soMov && r.linhas.length === 0) continue;
        blocos.push(r);
      }
    }

    let cD = 0;
    let cC = 0;
    let nPart = 0;
    let div = 0;
    for (const r of blocos) {
      cD += Math.round(r.totais.debitos * 100);
      cC += Math.round(r.totais.creditos * 100);
      nPart += r.linhas.length;
      if (r.conferencia && !r.conferencia.ok) div++;
    }

    return {
      arquivo: { id: arq.id, fileName: arq.fileName, dtIni: arqIni, dtFin: arqFin, codVerLc: arq.codVerLc },
      periodo: { dtIni, dtFin },
      modo,
      soComMovimento: soMov,
      contasSelecionadas: alvo.size,
      blocos,
      resumo: { contas: blocos.length, partidas: nPart, debitos: cD / 100, creditos: cC / 100, divergentes: div },
    };
  }

  private async somaPartidas(
    arquivoId: string,
    codCta: string,
    indDc: string,
    ini: string,
    fim: string,
    fimExclusivo: boolean,
  ): Promise<number> {
    const r = await this.prisma.ecdArqPartida.aggregate({
      where: {
        arquivoId,
        codCta,
        indDc,
        lancamento: {
          dtLcto: fimExclusivo
            ? { gte: toDate(ini) as Date, lt: toDate(fim) as Date }
            : { gte: toDate(ini) as Date, lte: toDate(fim) as Date },
        },
      },
      _sum: { vlDc: true },
    });
    return cents(r._sum.vlDc);
  }

  private async garantirArquivo(companyId: string, arquivoId: string) {
    const a = await this.prisma.ecdArquivo.findFirst({ where: { id: arquivoId, companyId } });
    if (!a) throw new NotFoundException('Arquivo ECD nao encontrado.');
    return a;
  }
}
