// apps/api/src/modules/regime-comparativo/regime-comparativo.service.ts
// Comparativo de regimes (Lucro Real x Lucro Presumido) por exercicio - ESTUDOS de apoio a decisao (tax_regime_studies).
// Nunca altera company_tax_regimes nem regimes ja escolhidos.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addMonth(ym: string, k: number): string {
  let [y, m] = ym.split('-').map(Number);
  m += k;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + pad(m);
}
const FORMAS: Record<string, string> = {
  '1': 'Lucro Real', '2': 'Lucro Real/Arbitrado', '3': 'Presumido/Real', '4': 'Presumido/Real/Arbitrado',
  '5': 'Lucro Presumido', '6': 'Lucro Arbitrado', '7': 'Presumido/Arbitrado', '8': 'Imune', '9': 'Isenta',
};

@Injectable()
export class RegimeComparativoService {
  constructor(private readonly prisma: PrismaService) {}

  private async labels() {
    const it: any[] = await this.prisma.$queryRawUnsafe(`SELECT DISTINCT type::text AS t FROM journal_entry_items`);
    const ac: any[] = await this.prisma.$queryRawUnsafe(`SELECT DISTINCT type::text AS t FROM chart_of_accounts`);
    const credit = it.map((x: any) => x.t).find((t: string) => /^C/i.test(t)) ?? 'CREDIT';
    const revenue = ac.map((x: any) => x.t).filter((t: string) => /REVEN|RECEIT/i.test(t));
    const expense = ac.map((x: any) => x.t).filter((t: string) => /EXPEN|DESPES|CUST|COST/i.test(t));
    return { credit, revenue: revenue.length ? revenue : ['REVENUE'], expense: expense.length ? expense : ['EXPENSE'] };
  }

  private async contaARE(companyId: string): Promise<string | null> {
    try {
      const cfg = await (this.prisma as any).companyAccountingConfig.findFirst({ where: { companyId } });
      return cfg?.encerramentoContaApuracaoResultadoId ?? null;
    } catch { return null; }
  }

  /** Dados do razao do exercicio: receitas por conta e mes, resultado contabil, regime cadastrado e cobertura da Selic */
  async base(companyId: string, ano: number) {
    if (!companyId) throw new BadRequestException('Empresa nao selecionada');
    if (!ano || ano < 2000 || ano > 2100) throw new BadRequestException('Exercicio invalido');
    const L = await this.labels();
    const are = await this.contaARE(companyId);
    const ini = `${ano}-01-01`, fim = `${ano}-12-31`;
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT a.id::text AS id, a.code, a.name, a.type::text AS tipo, extract(month FROM je.date)::int AS mes,
             sum(CASE WHEN i.type::text = $4 THEN i.value ELSE -i.value END)::float8 AS saldo
        FROM journal_entry_items i
        JOIN journal_entries je ON je.id = i.journal_entry_id
        JOIN chart_of_accounts a ON a.id = i.account_id
       WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL
         AND je.date BETWEEN $2::date AND $3::date
         AND a.type::text = ANY($5::text[])
         AND ($6::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM journal_entry_items x WHERE x.journal_entry_id = je.id AND x.account_id = $6::uuid))
       GROUP BY 1, 2, 3, 4, 5
       ORDER BY 2, 5`, companyId, ini, fim, L.credit, [...L.revenue, ...L.expense], are);

    const contas = new Map<string, any>();
    let resultadoContabil = 0;
    for (const r of rows) {
      resultadoContabil += Number(r.saldo);
      if (!L.revenue.includes(r.tipo)) continue;
      if (!contas.has(r.id)) contas.set(r.id, { id: r.id, code: r.code, name: r.name, meses: Array(12).fill(0), total: 0 });
      const c = contas.get(r.id);
      c.meses[r.mes - 1] = r2(c.meses[r.mes - 1] + Number(r.saldo));
      c.total = r2(c.total + Number(r.saldo));
    }
    const receitas = [...contas.values()].map((c) => ({
      ...c,
      sugestao: c.total <= 0 ? 'IGNORAR' : /rendiment|juros|aplica|financ|varia|cambi/i.test(c.name) ? 'OUTRAS' : 'BRUTA',
    }));

    const regimes: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT to_char(dt_ini, 'YYYY-MM-DD') AS dt_ini, to_char(dt_fin, 'YYYY-MM-DD') AS dt_fin, forma_tributacao, periodo_apuracao_irpj
        FROM company_tax_regimes
       WHERE company_id = $1::uuid AND dt_ini <= $3::date AND (dt_fin IS NULL OR dt_fin >= $2::date)
       ORDER BY dt_ini`, companyId, ini, fim);

    const hoje = new Date();
    const ateYm = hoje.getFullYear() + '-' + pad(hoje.getMonth() + 1);
    const selic = await this.selicMap(ano + '-01', ateYm);
    const faltantes: string[] = [];
    for (let ym = ano + '-01'; ym < ateYm; ym = addMonth(ym, 1)) if (!(ym in selic)) faltantes.push(ym);
    const ultima = Object.keys(selic).sort().pop() ?? null;

    return {
      ano,
      receitas,
      resultadoContabil: r2(resultadoContabil),
      contaApuracaoExcluida: !!are,
      regimesCadastrados: regimes.map((g) => ({ ...g, descricao: FORMAS[g.forma_tributacao] ?? ('Forma ' + g.forma_tributacao) })),
      selic: { ultima, faltantes },
    };
  }

  private async selicMap(de: string, ate: string): Promise<Record<string, number>> {
    const rows: any[] = await (this.prisma as any).indicadorEconomico.findMany({
      where: { indicador: 'SELIC', competencia: { gte: de, lte: ate } },
      select: { competencia: true, taxaMensal: true },
    });
    const m: Record<string, number> = {};
    for (const r of rows) m[r.competencia] = Number(r.taxaMensal);
    return m;
  }

  /** Calculo completo dos dois regimes a partir do razao + premissas */
  async calcular(companyId: string, p: any) {
    const ano = Number(p?.ano);
    const base = await this.base(companyId, ano);
    const pagamento: string = /^\d{4}-\d{2}$/.test(p?.pagamento ?? '') ? p.pagamento : (new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1));
    const presuncao = p?.presuncao != null ? Number(p.presuncao) / 100 : 0.32;
    const classif: Record<string, string> = p?.classificacao ?? {};
    const excl: number[] = Array.from({ length: 12 }, (_, i) => Number(p?.exclusoes?.[i] ?? 0) || 0);
    const lr = p?.lucroReal ?? {};
    const adicoes = Number(lr.adicoes) || 0, exclLalur = Number(lr.exclusoes) || 0, compInf = Number(lr.compensacao) || 0;
    const credPis = Number(lr.creditosPis) || 0, credCofins = Number(lr.creditosCofins) || 0;
    const distrib = !!p?.distribuicaoAcimaBase;
    const overrides: Record<string, any> = p?.multas ?? {};
    const selicManual: Record<string, number> = p?.selicManual ?? {};
    const alertas: string[] = [];

    // receita mensal
    const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, bruta: 0, outras: 0, exclusao: excl[i], tributavel: 0 }));
    for (const c of base.receitas) {
      const cl = classif[c.id] ?? c.sugestao;
      if (cl === 'IGNORAR') continue;
      c.meses.forEach((v: number, i: number) => { if (cl === 'OUTRAS') meses[i].outras += v; else meses[i].bruta += v; });
    }
    for (const m of meses) {
      m.bruta = r2(m.bruta); m.outras = r2(m.outras);
      m.tributavel = r2(m.bruta - m.exclusao);
      if (m.tributavel < 0) { alertas.push(`${pad(m.mes)}/${ano}: exclusoes maiores que a receita do razao - receita tributavel considerada zero`); m.tributavel = 0; }
    }
    const totBruta = r2(meses.reduce((s, m) => s + m.bruta, 0));
    const totExcl = r2(meses.reduce((s, m) => s + m.exclusao, 0));
    const totTrib = r2(meses.reduce((s, m) => s + m.tributavel, 0));
    const totOutras = r2(meses.reduce((s, m) => s + m.outras, 0));

    // Selic (juros de mora: Selic acumulada do mes seguinte ao vencimento ate o mes anterior ao pagamento + 1% no mes do pagamento)
    const selic = { ...(await this.selicMap(ano + '-01', pagamento)), ...selicManual };
    const faltantes = new Set<string>();
    const juros = (venc: string) => {
      const vm = venc.slice(0, 7);
      if (pagamento <= vm) return 0;
      let pct = 1;
      for (let ym = addMonth(vm, 1); ym < pagamento; ym = addMonth(ym, 1)) {
        if (ym in selic) pct += Number(selic[ym]); else faltantes.add(ym);
      }
      return pct;
    };
    const darfs: any[] = [];
    const add = (regime: string, tributo: string, codigo: string, periodo: string, venc: string, principal: number) => {
      principal = r2(principal);
      if (principal < 0.005) return;
      const pct = juros(venc);
      const j = r2(principal * pct / 100);
      darfs.push({ regime, tributo, codigo, periodo, vencimento: venc, principal, selicPct: r2(pct), juros: j, total: r2(principal + j) });
    };
    const venc25 = (m: number) => { const ym = addMonth(`${ano}-${pad(m)}`, 1); return ym + '-25'; };

    // ---- Lucro Presumido
    for (const m of meses) {
      add('PRESUMIDO', 'PIS cumulativo 0,65%', '8109', `${pad(m.mes)}/${ano}`, venc25(m.mes), m.tributavel * 0.0065);
      add('PRESUMIDO', 'Cofins cumulativa 3%', '2172', `${pad(m.mes)}/${ano}`, venc25(m.mes), m.tributavel * 0.03);
    }
    for (let q = 1; q <= 4; q++) {
      const ms = meses.slice((q - 1) * 3, q * 3);
      const brutaQ = ms.reduce((s, m) => s + m.tributavel, 0), outrasQ = ms.reduce((s, m) => s + m.outras, 0);
      const baseIr = presuncao * brutaQ + outrasQ;
      const vy = q === 4 ? ano + 1 : ano, vmo = q === 4 ? 1 : q * 3 + 1;
      const venc = `${vy}-${pad(vmo)}-${pad(lastDay(vy, vmo))}`;
      add('PRESUMIDO', 'IRPJ presumido', '2089', `${q}T/${ano}`, venc, baseIr * 0.15 + Math.max(0, baseIr - 60000) * 0.10);
      add('PRESUMIDO', 'CSLL presumido', '2372', `${q}T/${ano}`, venc, baseIr * 0.09);
    }

    // ---- Lucro Real (anual)
    const debPis = meses.map((m) => m.tributavel * 0.0165 + m.outras * 0.0065);
    const debCof = meses.map((m) => m.tributavel * 0.076 + m.outras * 0.04);
    const sPis = debPis.reduce((s, v) => s + v, 0) || 1, sCof = debCof.reduce((s, v) => s + v, 0) || 1;
    meses.forEach((m, i) => {
      add('REAL', 'PIS nao cumulativo', '6912', `${pad(m.mes)}/${ano}`, venc25(m.mes), Math.max(0, debPis[i] - credPis * debPis[i] / sPis));
      add('REAL', 'Cofins nao cumulativa', '5856', `${pad(m.mes)}/${ano}`, venc25(m.mes), Math.max(0, debCof[i] - credCofins * debCof[i] / sCof));
    });
    const lucroAntes = r2(base.resultadoContabil - totExcl + adicoes - exclLalur);
    const compensacao = r2(Math.min(compInf, Math.max(0, lucroAntes) * 0.3));
    const lucroReal = r2(lucroAntes - compensacao);
    const vencAnual = `${ano + 1}-03-${pad(lastDay(ano + 1, 3))}`;
    if (lucroReal > 0) {
      add('REAL', 'IRPJ lucro real anual', '2430', `${ano}`, vencAnual, lucroReal * 0.15 + Math.max(0, lucroReal - 240000) * 0.10);
      add('REAL', 'CSLL lucro real anual', '6773', `${ano}`, vencAnual, lucroReal * 0.09);
    }

    // ---- Obrigacoes acessorias (multas estimadas, editaveis)
    const receitaAnual = r2(totTrib + totOutras);
    const mesesDeb = (rg: string) => new Set(darfs.filter((d) => d.regime === rg).map((d) => d.vencimento.slice(0, 7))).size;
    const ov = (k: string, v: number) => (overrides[k] != null && overrides[k] !== '' ? r2(Number(overrides[k])) : r2(v));
    const obrigacoes = [
      { key: 'ECD', nome: 'ECD', fundamento: 'Lei 8.218/1991 art. 12 III - 0,02% ao dia sobre a receita, limite 1%, reducao de 50% antes de procedimento de oficio',
        REAL: { exigida: true, multa: ov('ECD_REAL', receitaAnual * 0.005) },
        PRESUMIDO: { exigida: distrib, multa: ov('ECD_PRESUMIDO', distrib ? receitaAnual * 0.005 : 0), obs: distrib ? 'Obrigatoria (distribuicao acima da base presumida)' : 'Dispensada se nao houver distribuicao acima da base presumida (IN RFB 2.003/2021 art. 3)' } },
      { key: 'ECF', nome: 'ECF', fundamento: 'DL 1.598/1977 art. 8-A - estimativa; conferir na multa calculada pelo PGE da ECF',
        REAL: { exigida: true, multa: ov('ECF_REAL', receitaAnual * 0.005) }, PRESUMIDO: { exigida: true, multa: ov('ECF_PRESUMIDO', receitaAnual * 0.005) } },
      { key: 'EFD', nome: 'EFD-Contribuicoes', fundamento: 'Lei 8.218/1991 art. 12 III - estimativa; meses sem receita informados no registro 0120',
        REAL: { exigida: true, multa: ov('EFD_REAL', receitaAnual * 0.005) }, PRESUMIDO: { exigida: true, multa: ov('EFD_PRESUMIDO', receitaAnual * 0.005) } },
      { key: 'DCTF', nome: 'DCTF', fundamento: 'Lei 10.426/2002 art. 7 - minimo R$ 500 por declaracao, reduzido em 50% (estimativa por mes com debito)',
        REAL: { exigida: true, multa: ov('DCTF_REAL', mesesDeb('REAL') * 250) }, PRESUMIDO: { exigida: true, multa: ov('DCTF_PRESUMIDO', mesesDeb('PRESUMIDO') * 250) } },
    ];

    const tot = (rg: 'REAL' | 'PRESUMIDO') => {
      const ds = darfs.filter((d) => d.regime === rg);
      const principal = r2(ds.reduce((s, d) => s + d.principal, 0));
      const jur = r2(ds.reduce((s, d) => s + d.juros, 0));
      const multas = r2(obrigacoes.reduce((s, o: any) => s + (o[rg].exigida ? o[rg].multa : 0), 0));
      return { principal, juros: jur, multas, total: r2(principal + jur + multas) };
    };
    const totais = { REAL: tot('REAL'), PRESUMIDO: tot('PRESUMIDO') };
    const diferenca = r2(totais.REAL.total - totais.PRESUMIDO.total);

    if (faltantes.size) alertas.push('Selic nao cadastrada em Tabelas Legais para: ' + [...faltantes].sort().join(', ') + ' (juros subestimados - informe a taxa ou cadastre o indice)');
    if (lucroAntes < 0) alertas.push(`Lucro Real: resultado ajustado negativo (${lucroAntes.toLocaleString('pt-BR')}) - sem IRPJ/CSLL; prejuizo fiscal a controlar no LALUR`);
    if (!base.contaApuracaoExcluida) alertas.push('Conta de apuracao do resultado nao configurada: lancamentos de encerramento podem estar somados ao resultado');
    alertas.unshift('ESTUDO: nao altera o regime cadastrado da empresa nem declaracoes ja entregues; serve de apoio a decisao para exercicio ainda nao definido ou mudanca em exercicio futuro.');
    alertas.push('Vencimentos aproximados (dia 25 e ultimo dia do mes); os juros dependem so do mes. Valores finais pelo Sicalc na data do pagamento.');

    return {
      geradoEm: new Date().toISOString(),
      ano, pagamento, presuncao: r2(presuncao * 100),
      receita: { meses, totBruta, totExcl, totTrib, totOutras, receitaAnual },
      lucroReal: { resultadoContabil: base.resultadoContabil, exclusoesReceita: totExcl, adicoes, exclusoes: exclLalur, lucroAntes, compensacao, lucroReal },
      darfs, obrigacoes, totais, diferenca,
      maisVantajoso: diferenca > 0 ? 'PRESUMIDO' : diferenca < 0 ? 'REAL' : 'EMPATE',
      regimesCadastrados: base.regimesCadastrados,
      alertas,
    };
  }

  // ---------------- historico de estudos ----------------
  async listar(companyId: string, ano?: string) {
    const a = ano ? Number(ano) : null;
    return this.prisma.$queryRawUnsafe(`
      SELECT id::text AS id, ano, versao, titulo, status, regime_recomendado, justificativa,
             to_char(concluido_em, 'YYYY-MM-DD"T"HH24:MI:SS') AS concluido_em, concluido_por_nome, autor_nome,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
             resultado->'totais' AS totais, resultado->>'maisVantajoso' AS mais_vantajoso, resultado->>'pagamento' AS pagamento
        FROM tax_regime_studies
       WHERE company_id = $1::uuid AND deleted_at IS NULL AND ($2::int IS NULL OR ano = $2::int)
       ORDER BY ano DESC, versao DESC`, companyId, a);
  }

  async obter(companyId: string, id: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id::text AS id, ano, versao, titulo, status, regime_recomendado, justificativa, premissas, resultado,
             to_char(concluido_em, 'YYYY-MM-DD"T"HH24:MI:SS') AS concluido_em, concluido_por_nome, autor_nome,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
        FROM tax_regime_studies WHERE id = $1::uuid AND company_id = $2::uuid AND deleted_at IS NULL`, id, companyId);
    if (!rows.length) throw new NotFoundException('Estudo nao encontrado');
    return rows[0];
  }

  async salvar(companyId: string, body: any, user: any) {
    const premissas = body?.premissas ?? {};
    const resultado = await this.calcular(companyId, premissas);
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      INSERT INTO tax_regime_studies (company_id, ano, versao, titulo, premissas, resultado, status, created_by_id, autor_nome)
      SELECT $1::uuid, $2::int, coalesce(max(versao), 0) + 1, $3, $4::jsonb, $5::jsonb, 'RASCUNHO', $6::uuid, $7
        FROM tax_regime_studies WHERE company_id = $1::uuid AND ano = $2::int
      RETURNING id::text AS id, versao`,
      companyId, resultado.ano, (body?.titulo || `Estudo ${resultado.ano}`).slice(0, 200), JSON.stringify(premissas), JSON.stringify(resultado),
      user?.id ?? null, (user?.name ?? user?.nome ?? user?.email ?? null));
    return { ...rows[0], resultado };
  }

  async concluir(companyId: string, id: string, body: any, user: any) {
    const regime = body?.regime;
    if (!['LUCRO_REAL', 'LUCRO_PRESUMIDO'].includes(regime)) throw new BadRequestException('Regime invalido');
    if (!body?.justificativa || String(body.justificativa).trim().length < 5) throw new BadRequestException('Informe a justificativa da conclusao');
    const est = await this.obter(companyId, id);
    await this.prisma.$executeRawUnsafe(`
      UPDATE tax_regime_studies SET status = 'SUBSTITUIDO', updated_at = now()
       WHERE company_id = $1::uuid AND ano = $2::int AND status = 'CONCLUIDO' AND id <> $3::uuid AND deleted_at IS NULL`, companyId, est.ano, id);
    await this.prisma.$executeRawUnsafe(`
      UPDATE tax_regime_studies SET status = 'CONCLUIDO', regime_recomendado = $3, justificativa = $4, concluido_em = now(),
             concluido_por_id = $5::uuid, concluido_por_nome = $6, updated_at = now()
       WHERE id = $1::uuid AND company_id = $2::uuid`,
      id, companyId, regime, String(body.justificativa).trim(), user?.id ?? null, (user?.name ?? user?.nome ?? user?.email ?? null));
    return this.obter(companyId, id);
  }

  async excluir(companyId: string, id: string) {
    await this.obter(companyId, id);
    await this.prisma.$executeRawUnsafe(`UPDATE tax_regime_studies SET deleted_at = now(), updated_at = now() WHERE id = $1::uuid AND company_id = $2::uuid`, id, companyId);
    return { ok: true };
  }
}
