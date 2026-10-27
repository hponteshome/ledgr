// apps/api/src/modules/integridade/integridade.service.ts
// CRIADO 27/10/2026 - Central de Integridade: verificacoes automaticas de consistencia
// da escrituracao por empresa. Cada execucao grava integrity_runs + integrity_findings
// (trilha de auditoria: quando cada problema apareceu e quando deixou de aparecer).
// Somente leitura sobre os dados contabeis - nenhuma verificacao altera lancamentos.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type Severidade = 'CRITICO' | 'ALERTA' | 'INFO';
export interface Achado {
  code: string; severity: Severidade; title: string; detail: string;
  qtd: number; valor?: number | null; amostra: any[];
}

const AMOSTRA = 60;
const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const limpa = (rows: any[]) => JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));

@Injectable()
export class IntegridadeService {
  constructor(private readonly prisma: PrismaService) {}

  private q(sql: string, companyId: string): Promise<any[]> {
    return this.prisma.$queryRawUnsafe(sql, companyId).then(limpa);
  }

  // ── Verificacoes ────────────────────────────────────────────
  private async c01Desbalanceados(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      SELECT je.id, je.date::text AS data, left(je.description, 90) AS historico, je.source_module AS origem,
             s.deb::float AS debito, s.cred::float AS credito, s.n::int AS partidas
      FROM journal_entries je
      JOIN LATERAL (SELECT coalesce(sum(value) FILTER (WHERE type = 'DEBIT'), 0) AS deb,
                           coalesce(sum(value) FILTER (WHERE type = 'CREDIT'), 0) AS cred, count(*) AS n
                    FROM journal_entry_items WHERE journal_entry_id = je.id) s ON true
      WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL AND (s.deb <> s.cred OR s.n < 2)
      ORDER BY je.date, je.created_at`, cid);
    if (!rows.length) return null;
    const dif = rows.reduce((a, r) => a + num(r.debito) - num(r.credito), 0);
    return {
      code: 'LANC_DESBALANCEADO', severity: 'CRITICO',
      title: `${rows.length} lançamento(s) com débito diferente do crédito ou com uma partida só`,
      detail: 'Todo lançamento deve ter partidas dobradas com débito igual ao crédito. ' +
        (Math.abs(dif) < 0.005 ? 'No conjunto eles se compensam (típico de saldo inicial lançado conta a conta), mas cada lançamento isolado fica desbalanceado no Diário e no Razão.'
                               : `Diferença líquida no conjunto: ${dif.toFixed(2)}.`),
      qtd: rows.length, valor: Math.abs(dif) < 0.005 ? null : dif, amostra: rows.slice(0, AMOSTRA),
    };
  }

  private async c02AberturaSobreposta(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      WITH ab AS (
        SELECT DISTINCT i.account_id, je.date
        FROM journal_entries je JOIN journal_entry_items i ON i.journal_entry_id = je.id
        WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL
          AND (je.source_module = 'ECD_IMPORT' OR je.description ILIKE '%saldo inicial%' OR je.description ILIKE '%saldo de abertura%'))
      SELECT c.code AS conta, left(c.name, 50) AS nome, min(ab.date)::text AS data_abertura,
             count(DISTINCT je2.id)::int AS lanc_anteriores, min(je2.date)::text AS desde,
             sum(CASE WHEN i2.type = 'DEBIT' THEN i2.value ELSE -i2.value END)::float AS saldo_anterior
      FROM ab
      JOIN chart_of_accounts c ON c.id = ab.account_id
      JOIN journal_entry_items i2 ON i2.account_id = ab.account_id
      JOIN journal_entries je2 ON je2.id = i2.journal_entry_id
      WHERE je2.company_id = $1::uuid AND je2.deleted_at IS NULL AND je2.date < ab.date
        AND je2.source_module <> 'ECD_IMPORT' AND je2.description NOT ILIKE '%saldo inicial%'
      GROUP BY c.code, c.name
      HAVING abs(sum(CASE WHEN i2.type = 'DEBIT' THEN i2.value ELSE -i2.value END)) > 0.005
      ORDER BY c.code`, cid);
    if (!rows.length) return null;
    const total = rows.reduce((a, r) => a + Math.abs(num(r.saldo_anterior)), 0);
    return {
      code: 'ABERTURA_SOBREPOSTA', severity: 'CRITICO',
      title: `Saldo de abertura lançado sobre histórico anterior em ${rows.length} conta(s)`,
      detail: 'Estas contas recebem saldo de abertura (importação de ECD ou "saldo inicial") e também têm lançamentos ativos ANTERIORES à data da abertura. ' +
        'O saldo anterior soma-se à abertura e o patrimônio fica duplicado. Mantenha um ponto de partida só: ou o histórico, ou a abertura.',
      qtd: rows.length, valor: total, amostra: rows.slice(0, AMOSTRA),
    };
  }

  private async c03Lacunas(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      WITH lim AS (SELECT date_trunc('month', min(date))::date AS ini, date_trunc('month', max(date))::date AS fim
                   FROM journal_entries WHERE company_id = $1::uuid AND deleted_at IS NULL),
      m AS (SELECT generate_series(ini, fim, interval '1 month')::date AS mes FROM lim WHERE ini IS NOT NULL),
      c AS (SELECT date_trunc('month', date)::date AS mes FROM journal_entries WHERE company_id = $1::uuid AND deleted_at IS NULL GROUP BY 1),
      v AS (SELECT m.mes, (extract(year FROM m.mes) * 12 + extract(month FROM m.mes))::int
                          - row_number() OVER (ORDER BY m.mes)::int AS grp
            FROM m LEFT JOIN c ON c.mes = m.mes WHERE c.mes IS NULL)
      SELECT to_char(min(mes), 'MM/YYYY') AS de, to_char(max(mes), 'MM/YYYY') AS ate, count(*)::int AS meses, max(mes)::text AS ultimo
      FROM v GROUP BY grp ORDER BY min(mes)`, cid);
    if (!rows.length) return null;
    const meses = rows.reduce((a, r) => a + num(r.meses), 0);
    const recente = rows.some(r => new Date(r.ultimo) >= new Date(Date.now() - 730 * 86400000));
    return {
      code: 'LACUNA_ESCRITURACAO', severity: recente ? 'ALERTA' : 'INFO',
      title: `${meses} mês(es) sem nenhum lançamento entre o primeiro e o último mês escriturado`,
      detail: 'Períodos sem lançamento podem ser legítimos (empresa sem movimento) ou escrituração faltando. ' +
        'Confira principalmente as lacunas dos últimos 2 anos: elas impedem gerar ECD/ECF e conciliar extratos.',
      qtd: meses, amostra: rows,
    };
  }

  private async c04SaldoInvertido(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      SELECT c.code AS conta, left(c.name, 50) AS nome, c.type AS tipo, c.nature AS natureza,
             sum(CASE WHEN i.type = 'DEBIT' THEN i.value ELSE -i.value END)::float AS saldo_devedor
      FROM journal_entry_items i JOIN journal_entries je ON je.id = i.journal_entry_id JOIN chart_of_accounts c ON c.id = i.account_id
      WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL AND c.type IN ('ASSET', 'LIABILITY')
        AND c.name NOT LIKE '(-)%' AND c.name NOT ILIKE '%deprecia%' AND c.name NOT ILIKE '%amortiza%' AND c.name NOT ILIKE '%provis%'
      GROUP BY c.code, c.name, c.type, c.nature
      HAVING (c.nature = 'DEBIT'  AND sum(CASE WHEN i.type = 'DEBIT' THEN i.value ELSE -i.value END) < -0.005)
          OR (c.nature = 'CREDIT' AND sum(CASE WHEN i.type = 'DEBIT' THEN i.value ELSE -i.value END) >  0.005)
      ORDER BY c.code`, cid);
    if (!rows.length) return null;
    return {
      code: 'SALDO_INVERTIDO', severity: 'ALERTA',
      title: `${rows.length} conta(s) de ativo/passivo com saldo contrário à natureza`,
      detail: 'Ex.: banco ou caixa credor, passivo devedor. Pode indicar lançamento invertido, conta errada ou um direito/obrigação classificado do lado errado do balanço.',
      qtd: rows.length, amostra: rows,
    };
  }

  private async c05Imobilizado(cid: string): Promise<Achado[]> {
    const out: Achado[] = [];
    const semConta = await this.q(`
      SELECT internal_code AS ativo, left(description, 60) AS descricao, acquisition_cost::float AS custo
      FROM fixed_assets WHERE company_id = $1::uuid AND deleted_at IS NULL AND asset_account_id IS NULL ORDER BY internal_code`, cid);
    if (semConta.length) out.push({
      code: 'IMOB_SEM_CONTA', severity: 'ALERTA',
      title: `${semConta.length} bem(ns) do Ativo Imobilizado sem conta contábil vinculada`,
      detail: 'Sem a conta do bem não é possível conciliar o cadastro com a contabilidade nem contabilizar a depreciação por bem.',
      qtd: semConta.length, valor: semConta.reduce((a, r) => a + num(r.custo), 0), amostra: semConta,
    });
    const rows = await this.q(`
      WITH cad AS (
        SELECT asset_account_id AS acc, sum(acquisition_cost) AS custo, string_agg(internal_code, ', ' ORDER BY internal_code) AS bens
        FROM fixed_assets WHERE company_id = $1::uuid AND deleted_at IS NULL AND asset_account_id IS NOT NULL GROUP BY 1),
      grupo AS (SELECT DISTINCT c.parent_id FROM cad JOIN chart_of_accounts c ON c.id = cad.acc),
      ctb AS (
        SELECT i.account_id AS acc, sum(CASE WHEN i.type = 'DEBIT' THEN i.value ELSE -i.value END) AS saldo
        FROM journal_entry_items i JOIN journal_entries je ON je.id = i.journal_entry_id
        WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL GROUP BY 1)
      SELECT c.code AS conta, left(c.name, 45) AS nome, coalesce(cad.bens, '(sem bem no cadastro)') AS bens,
             coalesce(cad.custo, 0)::float AS custo_cadastro, coalesce(ctb.saldo, 0)::float AS saldo_contabil,
             (coalesce(ctb.saldo, 0) - coalesce(cad.custo, 0))::float AS diferenca
      FROM chart_of_accounts c
      LEFT JOIN cad ON cad.acc = c.id LEFT JOIN ctb ON ctb.acc = c.id
      WHERE c.company_id = $1::uuid AND c.deleted_at IS NULL AND c.type = 'ASSET' AND c.name NOT LIKE '(-)%'
        AND (cad.acc IS NOT NULL OR c.parent_id IN (SELECT parent_id FROM grupo))
        AND abs(coalesce(ctb.saldo, 0) - coalesce(cad.custo, 0)) > 0.005
      ORDER BY c.code`, cid);
    if (rows.length) out.push({
      code: 'IMOB_X_CONTABIL', severity: 'ALERTA',
      title: `Cadastro do Imobilizado diferente da contabilidade em ${rows.length} conta(s)`,
      detail: 'Compara o custo dos bens cadastrados com o saldo contábil de cada conta de imóvel/bem. ' +
        'Diferença indica bem sem cadastro, cadastro sem lançamento, valor divergente ou saldo duplicado.',
      qtd: rows.length, valor: rows.reduce((a, r) => a + num(r.diferenca), 0), amostra: rows,
    });
    return out;
  }

  private async c06DepreciacaoNaoContabilizada(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      SELECT to_char(period, 'YYYY-MM') AS competencia, count(*)::int AS bens, sum(monthly_charge)::float AS valor
      FROM asset_depreciation_logs
      WHERE company_id = $1::uuid AND journal_entry_id IS NULL
      GROUP BY 1 ORDER BY 1`, cid);
    if (!rows.length) return null;
    const total = rows.reduce((a, r) => a + num(r.valor), 0);
    return {
      code: 'DEPRECIACAO_NAO_CONTABILIZADA', severity: 'ALERTA',
      title: `Depreciação calculada e não contabilizada em ${rows.length} competência(s)`,
      detail: 'O módulo de Ativo Imobilizado calculou a depreciação mensal, mas não há lançamento contábil correspondente. ' +
        'No Lucro Real a depreciação é despesa dedutível: sem o lançamento, o resultado e o IRPJ/CSLL ficam errados.',
      qtd: rows.length, valor: total, amostra: rows,
    };
  }

  private async c07TitulosOrfaos(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      SELECT 'A receber' AS tipo, ar.title AS titulo, ar.due_date::date::text AS vencimento, ar.amount::float AS valor, ar.status::text AS status,
             CASE WHEN je.id IS NULL THEN 'lançamento não existe' ELSE 'lançamento excluído' END AS problema
      FROM ar_entries ar LEFT JOIN journal_entries je ON je.id = ar.journal_entry_id
      WHERE ar.company_id = $1::uuid AND ar.deleted_at IS NULL AND ar.journal_entry_id IS NOT NULL AND (je.id IS NULL OR je.deleted_at IS NOT NULL)
      UNION ALL
      SELECT 'A pagar', ap.title, ap.due_date::date::text, ap.amount::float, ap.status::text,
             CASE WHEN je.id IS NULL THEN 'lançamento não existe' ELSE 'lançamento excluído' END
      FROM ap_entries ap LEFT JOIN journal_entries je ON je.id = ap.journal_entry_id
      WHERE ap.company_id = $1::uuid AND ap.deleted_at IS NULL AND ap.journal_entry_id IS NOT NULL AND (je.id IS NULL OR je.deleted_at IS NOT NULL)
      ORDER BY 3`, cid);
    if (!rows.length) return null;
    return {
      code: 'TITULO_ORFAO', severity: 'ALERTA',
      title: `${rows.length} título(s) a receber/pagar apontando para lançamento inexistente ou excluído`,
      detail: 'O título existe no Financeiro, mas o lançamento contábil que o originou foi apagado. O Financeiro e a contabilidade ficam divergentes: decida se o título vale (relançar) ou não (excluir o título).',
      qtd: rows.length, valor: rows.reduce((a, r) => a + num(r.valor), 0), amostra: rows,
    };
  }

  private async c08ApuracaoXContabil(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      WITH rec AS (
        SELECT to_char(je.date, 'YYYY-MM') AS comp, sum(CASE WHEN i.type = 'CREDIT' THEN i.value ELSE -i.value END) AS receita
        FROM journal_entry_items i JOIN journal_entries je ON je.id = i.journal_entry_id JOIN chart_of_accounts c ON c.id = i.account_id
        WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL AND NOT je.is_closing_entry AND c.type = 'REVENUE'
        GROUP BY 1)
      SELECT a.competencia, a.status::text AS status, coalesce(a.receita_bruta, 0)::float AS receita_apuracao,
             coalesce(rec.receita, 0)::float AS receita_contabil, (coalesce(rec.receita, 0) - coalesce(a.receita_bruta, 0))::float AS diferenca
      FROM apuracao_impostos a LEFT JOIN rec ON rec.comp = a.competencia
      WHERE a.company_id = $1::uuid AND a.tipo = 'PIS_COFINS'
        AND abs(coalesce(rec.receita, 0) - coalesce(a.receita_bruta, 0)) > 1
      ORDER BY a.competencia`, cid);
    if (!rows.length) return null;
    return {
      code: 'APURACAO_X_CONTABIL', severity: 'ALERTA',
      title: `Apuração de PIS/COFINS diferente da receita contábil em ${rows.length} competência(s)`,
      detail: 'A receita bruta gravada na apuração não bate com a receita lançada na contabilidade no mês (contas de receita, sem encerramento). ' +
        'Ou a apuração foi feita sobre outra base, ou a escrituração do mês está incompleta.',
      qtd: rows.length, amostra: rows,
    };
  }

  private async c09ContaInvalida(cid: string): Promise<Achado | null> {
    const rows = await this.q(`
      SELECT c.code AS conta, left(c.name, 50) AS nome,
             concat_ws(', ', CASE WHEN NOT c.is_analytic THEN 'sintética' END, CASE WHEN NOT c.is_active THEN 'inativa' END,
                       CASE WHEN c.deleted_at IS NOT NULL THEN 'excluída' END, CASE WHEN c.company_id IS DISTINCT FROM $1::uuid THEN 'de outra empresa' END) AS problema,
             count(*)::int AS partidas
      FROM journal_entry_items i JOIN journal_entries je ON je.id = i.journal_entry_id JOIN chart_of_accounts c ON c.id = i.account_id
      WHERE je.company_id = $1::uuid AND je.deleted_at IS NULL
        AND (NOT c.is_analytic OR NOT c.is_active OR c.deleted_at IS NOT NULL OR c.company_id IS DISTINCT FROM $1::uuid)
      GROUP BY 1, 2, 3 ORDER BY 1`, cid);
    if (!rows.length) return null;
    return {
      code: 'CONTA_INVALIDA', severity: 'CRITICO',
      title: `Lançamentos em ${rows.length} conta(s) sintética(s), inativa(s), excluída(s) ou de outra empresa`,
      detail: 'Lançamentos só podem usar contas analíticas, ativas, da própria empresa. Isso impede a ECD de validar.',
      qtd: rows.length, amostra: rows,
    };
  }

  private async c10Configuracao(cid: string): Promise<Achado | null> {
    const [r] = await this.q(`
      SELECT co.tax_regime AS regime,
             (SELECT count(*) FROM company_tax_regimes t WHERE t.company_id = $1::uuid)::int AS regimes_periodo,
             cfg.id IS NOT NULL AS tem_config,
             cfg.encerramento_conta_apuracao_resultado_id IS NOT NULL AS conta_are,
             cfg.encerramento_conta_lucros_acumulados_id IS NOT NULL AS conta_lucros,
             cfg.encerramento_conta_prejuizos_acumulados_id IS NOT NULL AS conta_prejuizos,
             EXISTS (SELECT 1 FROM rental_contracts rc WHERE rc.company_id = $1::uuid AND rc.deleted_at IS NULL) AS tem_locacao,
             cfg.locacao_conta_receita_alugueis_id IS NOT NULL AND cfg.locacao_conta_alugueis_a_receber_id IS NOT NULL AS contas_locacao
      FROM companies co LEFT JOIN company_accounting_configs cfg ON cfg.company_id = co.id
      WHERE co.id = $1::uuid`, cid);
    if (!r) return null;
    const faltas: any[] = [];
    if (!r.regimes_periodo) faltas.push({ item: 'Regime tributário por período (ECF: forma de tributação e apuração do IRPJ)', situacao: 'não cadastrado', regime_atual: r.regime });
    if (!r.tem_config) faltas.push({ item: 'Configuração contábil da empresa', situacao: 'não existe' });
    if (r.tem_config && !r.conta_are) faltas.push({ item: 'Conta de Apuração do Resultado (encerramento)', situacao: 'não configurada' });
    if (r.tem_config && !r.conta_lucros) faltas.push({ item: 'Conta de Lucros Acumulados (encerramento)', situacao: 'não configurada' });
    if (r.tem_config && !r.conta_prejuizos) faltas.push({ item: 'Conta de Prejuízos Acumulados (encerramento)', situacao: 'não configurada' });
    if (r.tem_locacao && !r.contas_locacao) faltas.push({ item: 'Contas de locação (receita / aluguéis a receber)', situacao: 'não configuradas' });
    if (!faltas.length) return null;
    return {
      code: 'CONFIGURACAO', severity: 'ALERTA',
      title: `${faltas.length} configuração(ões) contábil/fiscal faltando`,
      detail: 'Sem estas configurações o encerramento do exercício, a ECF e algumas rotinas automáticas não funcionam.',
      qtd: faltas.length, amostra: faltas,
    };
  }

  // ── Execucao ────────────────────────────────────────────────
  async executar(companyId: string, userId?: string, origem: 'MANUAL' | 'IMPORTACAO' | 'AGENDADA' = 'MANUAL') {
    if (!companyId) throw new BadRequestException('Empresa nao informada (x-company-id).');
    const inicio = new Date();
    const checks: Array<() => Promise<Achado | Achado[] | null>> = [
      () => this.c01Desbalanceados(companyId),
      () => this.c02AberturaSobreposta(companyId),
      () => this.c09ContaInvalida(companyId),
      () => this.c03Lacunas(companyId),
      () => this.c04SaldoInvertido(companyId),
      () => this.c05Imobilizado(companyId),
      () => this.c06DepreciacaoNaoContabilizada(companyId),
      () => this.c07TitulosOrfaos(companyId),
      () => this.c08ApuracaoXContabil(companyId),
      () => this.c10Configuracao(companyId),
    ];
    const achados: Achado[] = [];
    const erros: any[] = [];
    for (const c of checks) {
      try {
        const r = await c();
        if (Array.isArray(r)) achados.push(...r); else if (r) achados.push(r);
      } catch (e: any) {
        erros.push({ verificacao: c.toString().match(/this\.(c\d+\w*)/)?.[1] ?? '?', erro: String(e?.message ?? e).slice(0, 300) });
      }
    }
    const ordem: Record<Severidade, number> = { CRITICO: 0, ALERTA: 1, INFO: 2 };
    achados.sort((a, b) => ordem[a.severity] - ordem[b.severity]);
    const cont = (s: Severidade) => achados.filter(a => a.severity === s).length;

    const [run] = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO integrity_runs (company_id, started_at, finished_at, triggered_by, user_id, total_findings, criticos, alertas, infos, summary)
       VALUES ($1::uuid, $2, now(), $3, $4::uuid, $5, $6, $7, $8, $9::jsonb) RETURNING id, started_at, finished_at`,
      companyId, inicio, origem, userId || null, achados.length, cont('CRITICO'), cont('ALERTA'), cont('INFO'),
      JSON.stringify({ verificacoes: checks.length, erros }));
    for (const a of achados) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO integrity_findings (run_id, company_id, check_code, severity, title, detail, qtd, valor, amostra)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        run.id, companyId, a.code, a.severity, a.title.slice(0, 200), a.detail, a.qtd, a.valor ?? null, JSON.stringify(a.amostra ?? []));
    }
    return this.ultima(companyId);
  }

  async ultima(companyId: string) {
    const runs = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, started_at, finished_at, triggered_by, total_findings, criticos, alertas, infos, summary
       FROM integrity_runs WHERE company_id = $1::uuid ORDER BY started_at DESC LIMIT 1`, companyId);
    if (!runs.length) return { execucao: null, achados: [] };
    const achados = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT check_code AS code, severity, title, detail, qtd, valor::float AS valor, amostra
       FROM integrity_findings WHERE run_id = $1::uuid
       ORDER BY CASE severity WHEN 'CRITICO' THEN 0 WHEN 'ALERTA' THEN 1 ELSE 2 END, created_at`, runs[0].id);
    return { execucao: limpa(runs)[0], achados: limpa(achados) };
  }

  async historico(companyId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.id, r.started_at, r.triggered_by, r.total_findings, r.criticos, r.alertas, r.infos,
              (SELECT string_agg(DISTINCT f.check_code, ', ') FROM integrity_findings f WHERE f.run_id = r.id) AS verificacoes
       FROM integrity_runs r WHERE r.company_id = $1::uuid ORDER BY r.started_at DESC LIMIT 30`, companyId);
    return limpa(rows);
  }
}
