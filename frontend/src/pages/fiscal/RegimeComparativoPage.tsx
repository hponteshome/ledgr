// frontend/src/pages/fiscal/RegimeComparativoPage.tsx
// Comparativo de Regimes - Lucro Real x Lucro Presumido. ESTUDOS de apoio a decisao: nao alteram o regime cadastrado nem regimes ja escolhidos.
import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import DarfModal from '../../components/fiscal/DarfModal';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const parseBR = (v: string) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const fmtD = (iso?: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '-');
const fmtDH = (iso?: string | null) => (iso ? fmtD(iso) + ' ' + iso.slice(11, 16) : '-');
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const REG: Record<string, string> = { REAL: 'Lucro Real', PRESUMIDO: 'Lucro Presumido', LUCRO_REAL: 'Lucro Real', LUCRO_PRESUMIDO: 'Lucro Presumido' };
const FIN = '#111827', FIN_ACCENT = '#2563EB', FIN_LIGHT = '#EFF6FF';
const COR_REAL = '#7C3AED', COR_PRES = '#0891B2';

const S = {
  page: { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  card: { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 } as React.CSSProperties,
  secTit: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', letterSpacing: '.3px', marginBottom: 12 },
  kpi: { background: 'var(--color-background-secondary)', borderRadius: 8, padding: '10px 12px' } as React.CSSProperties,
  kpiL: { fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 4 },
  kpiV: { fontSize: 16, fontWeight: 600 },
  label: { fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' } as React.CSSProperties,
  input: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' as const },
  inputSm: { height: 28, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 8px', fontSize: 12, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', textAlign: 'right' as const, boxSizing: 'border-box' as const },
  btn: (c = '#111') => ({ height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, cursor: 'pointer', background: c, color: '#fff', fontWeight: 500 } as React.CSSProperties),
  btnO: { height: 30, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  badge: (c: string) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c + '22', color: c, whiteSpace: 'nowrap' as const } as React.CSSProperties),
  th: { background: 'var(--color-background-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' },
  thR: { background: 'var(--color-background-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' },
  td: { padding: '6px 10px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  tdR: { padding: '6px 10px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const },
};

function NumInput({ value, onChange, width = 120, disabled = false }: { value: number; onChange: (n: number) => void; width?: number; disabled?: boolean }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input style={{ ...S.inputSm, width, opacity: disabled ? 0.6 : 1 }} disabled={disabled}
      value={txt ?? fmtN(value)}
      onFocus={() => setTxt(value ? fmtN(value) : '')}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { onChange(parseBR(txt ?? '')); setTxt(null); }} />
  );
}

const LR0 = { adicoes: 0, exclusoes: 0, compensacao: 0, creditosPis: 0, creditosCofins: 0 };

export default function RegimeComparativoPage() {
  const ctx: any = useCompany();
  const companyId = ctx?.activeCompany?.id ?? ctx?.company?.id ?? ctx?.selectedCompany?.id ?? ctx?.companyId ?? null;
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear() - 1);
  const [pagMes, setPagMes] = useState<number>(hoje.getMonth() + 1);
  const [pagAno, setPagAno] = useState<number>(hoje.getFullYear());
  const [base, setBase] = useState<any>(null);
  const [classif, setClassif] = useState<Record<string, string>>({});
  const [exclusoes, setExclusoes] = useState<number[]>(Array(12).fill(0));
  const [presuncao, setPresuncao] = useState<number>(32);
  const [lr, setLr] = useState<any>(LR0);
  const [distrib, setDistrib] = useState(false);
  const [multas, setMultas] = useState<Record<string, number | null>>({});
  const [res, setRes] = useState<any>(null);
  const [titulo, setTitulo] = useState('');
  const [estudos, setEstudos] = useState<any[]>([]);
  const [aberto, setAberto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dec, setDec] = useState<any>(null);
  const reqRef = useRef(0); // so vale a resposta do ultimo exercicio pedido
  const [darfModal, setDarfModal] = useState<any>(null);
  const ultimoDia = (y: number, m: number) => y + '-' + String(m).padStart(2, '0') + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
  const paDe = (p: string) => (/^\d{2}\/\d{4}$/.test(p) ? ultimoDia(Number(p.slice(3)), Number(p.slice(0, 2)))
    : /^\dT\/\d{4}$/.test(p) ? ultimoDia(Number(p.slice(3)), Number(p[0]) * 3) : p.slice(0, 4) + '-12-31');
  const ORD_COD = ['2089', '2372', '2430', '6773', '8109', '2172', '6912', '5856'];
  function abrirDarfs(rg: 'REAL' | 'PRESUMIDO') {
    const itens = (res?.darfs ?? []).filter((d: any) => d.regime === rg)
      .map((d: any) => ({ codigo: d.codigo, descricao: d.tributo + ' ' + d.periodo, periodoApuracao: paDe(d.periodo), vencimento: d.vencimento, principal: d.principal }))
      .sort((a: any, b: any) => a.periodoApuracao.localeCompare(b.periodoApuracao) || ORD_COD.indexOf(a.codigo) - ORD_COD.indexOf(b.codigo));
    setDarfModal({ itens, quotaOpcao: rg === 'PRESUMIDO', titulo: 'DARFs ' + ano + ' - ' + REG[rg], subtitulo: (aberto?.versao ? 'Estudo v' + aberto.versao + ' - ' : '') + 'multa de mora e juros Selic calculados para a data de pagamento' });
  }

  const anos: number[] = [];
  for (let a = hoje.getFullYear(); a >= 2013; a--) anos.push(a);

  async function carregar(a = ano) {
    setLoading(true); setErro(null);
    const req = ++reqRef.current;
    setBase(null); setRes(null); setEstudos([]);
    try {
      const [b, e] = await Promise.all([api.get('/regime-comparativo/base/' + a), api.get('/regime-comparativo/estudos', { params: { ano: a } })]);
      if (req !== reqRef.current || Number(b.data?.ano) !== Number(a)) return; // resposta atrasada de outro exercicio
      setBase(b.data); setEstudos(e.data ?? []);
      const c: Record<string, string> = {};
      (b.data?.receitas ?? []).forEach((r: any) => { c[r.id] = r.sugestao; });
      setClassif(c); setExclusoes(Array(12).fill(0)); setLr(LR0); setDistrib(false); setMultas({}); setRes(null); setAberto(null);
      setTitulo('Estudo ' + a);
      const conc = (e.data ?? []).find((x: any) => x.status === 'CONCLUIDO'); // estudo concluido do exercicio abre direto, com as exclusoes salvas
      if (conc) abrir(conc.id);
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao carregar o exercicio'); }
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(ano); /* eslint-disable-next-line */ }, [ano, companyId]);

  const premissas = () => ({
    ano, pagamento: pagAno + '-' + String(pagMes).padStart(2, '0'), presuncao,
    classificacao: classif, exclusoes, lucroReal: lr, distribuicaoAcimaBase: distrib, multas,
  });

  async function calcular() {
    setLoading(true); setErro(null);
    try { const { data } = await api.post('/regime-comparativo/calcular', premissas()); setRes(data); setAberto(null); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro no calculo'); }
    finally { setLoading(false); }
  }

  async function salvar() {
    setLoading(true); setErro(null);
    try {
      const { data } = await api.post('/regime-comparativo/estudos', { titulo, premissas: premissas() });
      setRes(data.resultado);
      const e = await api.get('/regime-comparativo/estudos', { params: { ano } });
      setEstudos(e.data ?? []);
      setAberto({ id: data.id, versao: data.versao, status: 'RASCUNHO' });
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao salvar o estudo'); }
    finally { setLoading(false); }
  }

  async function abrir(id: string) {
    setLoading(true); setErro(null);
    try {
      const { data } = await api.get('/regime-comparativo/estudos/' + id);
      const p = data.premissas ?? {};
      setClassif(p.classificacao ?? {}); setExclusoes(Array.from({ length: 12 }, (_, i) => Number(p.exclusoes?.[i] ?? 0)));
      setPresuncao(p.presuncao ?? 32); setLr({ ...LR0, ...(p.lucroReal ?? {}) }); setDistrib(!!p.distribuicaoAcimaBase); setMultas(p.multas ?? {});
      if (p.pagamento) { setPagAno(Number(p.pagamento.slice(0, 4))); setPagMes(Number(p.pagamento.slice(5, 7))); }
      setTitulo(data.titulo ?? ''); setRes(data.resultado); setAberto(data);
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao abrir o estudo'); }
    finally { setLoading(false); }
  }

  async function excluir(id: string, versao: number) {
    if (!window.confirm('Excluir o estudo v' + versao + '? (exclusao logica)')) return;
    try { await api.delete('/regime-comparativo/estudos/' + id); const e = await api.get('/regime-comparativo/estudos', { params: { ano } }); setEstudos(e.data ?? []); if (aberto?.id === id) setAberto(null); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao excluir'); }
  }

  async function registrarConclusao() {
    if (!dec) return;
    setDec({ ...dec, saving: true, erro: null });
    try {
      await api.post('/regime-comparativo/estudos/' + dec.id + '/conclusao', { regime: dec.regime, justificativa: dec.justificativa });
      const e = await api.get('/regime-comparativo/estudos', { params: { ano } });
      setEstudos(e.data ?? []); setDec(null);
      if (aberto?.id === dec.id) abrir(dec.id);
    } catch (e: any) { setDec({ ...dec, saving: false, erro: e?.response?.data?.message ?? 'Erro ao registrar a conclusao' }); }
  }

  const r = res;
  const mesesRazao = (i: number, tipo: 'BRUTA' | 'OUTRAS') =>
    (base?.receitas ?? []).reduce((s: number, c: any) => s + ((classif[c.id] ?? c.sugestao) === tipo ? Number(c.meses[i] || 0) : 0), 0);
  const totRaz = (tipo: 'BRUTA' | 'OUTRAS') => Array.from({ length: 12 }, (_, i) => mesesRazao(i, tipo)).reduce((s, v) => s + v, 0);
  const totExcl = exclusoes.reduce((s, v) => s + (Number(v) || 0), 0);
  const concluido = estudos.find((e) => e.status === 'CONCLUIDO');

  const ColTot = ({ rg, cor }: { rg: 'REAL' | 'PRESUMIDO'; cor: string }) => {
    const t = r?.totais?.[rg];
    const melhor = r?.maisVantajoso === rg;
    return (
      <div style={{ ...S.card, marginBottom: 0, borderTop: '3px solid ' + cor, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: cor }}>{REG[rg]}</div>
          {melhor && <span style={S.badge('#16A34A')}>Menor custo</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={S.kpi}><div style={S.kpiL}>Tributos (principal)</div><div style={S.kpiV}>{fmt(t?.principal)}</div></div>
          <div style={S.kpi}><div style={S.kpiL}>Juros Selic</div><div style={S.kpiV}>{fmt(t?.juros)}</div></div>
          <div style={S.kpi}><div style={S.kpiL}>Multas acessorias (est.)</div><div style={S.kpiV}>{fmt(t?.multas)}</div></div>
          <div style={{ ...S.kpi, background: cor + '14' }}><div style={S.kpiL}>Total a desembolsar</div><div style={{ ...S.kpiV, color: cor }}>{fmt(t?.total)}</div></div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Fiscal · Operação</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Comparativo de Regimes - Lucro Real x Lucro Presumido</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Receita lida do razão do exercício; tributos, Selic até o pagamento e multas das obrigações em atraso. Cada estudo salvo vira uma versão no histórico; nenhum estudo altera o regime cadastrado.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div><span style={S.label}>Exercício</span>
            <select style={{ ...S.input, width: 100 }} value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          <div><span style={S.label}>Pagamento previsto</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <select style={{ ...S.input, width: 76 }} value={pagMes} onChange={(e) => setPagMes(Number(e.target.value))}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <select style={{ ...S.input, width: 84 }} value={pagAno} onChange={(e) => setPagAno(Number(e.target.value))}>{[hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => <option key={a} value={a}>{a}</option>)}</select>
            </div></div>
          <button style={S.btnO} onClick={() => setDarfModal({ itens: [], titulo: 'DARFs gerados' })}>DARFs gerados</button>
          <button style={S.btn(FIN_ACCENT)} onClick={calcular} disabled={loading || !base}>Calcular</button>
        </div>
      </div>

      <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
        <b>Estudo de apoio à decisão.</b> Esta tela não altera o regime cadastrado da empresa, regimes já escolhidos nem declarações entregues. Serve para avaliar a opção em exercício ainda não definido ou uma mudança de regime em exercício futuro.
        {(base?.regimesCadastrados ?? []).length > 0 && <> Para {ano} há regime cadastrado: o resultado aqui é apenas comparativo.</>}
      </div>

      {erro && <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
      {aberto && <div style={{ background: FIN_LIGHT, borderLeft: '3px solid ' + FIN_ACCENT, borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
        Visualizando o estudo salvo <b>v{aberto.versao}</b>{aberto.titulo ? ' - ' + aberto.titulo : ''} ({aberto.status}). Alterar premissas e clicar em Calcular gera um novo cálculo; para registrar, salve como nova versão.</div>}

      <div style={{ ...S.card, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><span style={S.label}>Regime cadastrado no exercício</span>
          {(base?.regimesCadastrados ?? []).length === 0 ? <span style={S.badge('#B45309')}>Sem cadastro</span>
            : base.regimesCadastrados.map((g: any, i: number) => <span key={i} style={{ ...S.badge(FIN_ACCENT), marginRight: 6 }}>{g.descricao} ({fmtD(g.dt_ini)} a {g.dt_fin ? fmtD(g.dt_fin) : 'atual'})</span>)}</div>
        <div><span style={S.label}>Conclusão do estudo</span>
          {concluido ? <span style={S.badge('#16A34A')}>{REG[concluido.regime_recomendado]} - v{concluido.versao} em {fmtD(concluido.concluido_em)}</span> : <span style={S.badge('#6B7280')}>Nenhuma</span>}</div>
        <div><span style={S.label}>Selic (Tabelas Legais)</span>
          <span style={S.badge(base?.selic?.faltantes?.length ? '#B45309' : '#16A34A')}>até {base?.selic?.ultima ?? '-'}{base?.selic?.faltantes?.length ? ' - faltam ' + base.selic.faltantes.length + ' mes(es)' : ''}</span></div>
        <div><span style={S.label}>Resultado contábil {base?.ano ?? ''}</span><b>{fmt(base?.resultadoContabil)}</b></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 16 }}>
        <div style={S.card}>
          <div style={S.secTit}>Receita mensal (razão) e exclusões</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={S.th}>Mês</th><th style={S.thR}>Receita bruta</th><th style={S.thR}>Exclusões</th><th style={S.thR}>Tributável</th><th style={S.thR}>Outras receitas</th></tr></thead>
            <tbody>
              {MESES.map((m, i) => (
                <tr key={m}>
                  <td style={S.td}>{m}/{ano}</td>
                  <td style={S.tdR}>{fmtN(mesesRazao(i, 'BRUTA'))}</td>
                  <td style={S.tdR}><NumInput value={exclusoes[i]} onChange={(n) => setExclusoes(exclusoes.map((v, k) => (k === i ? n : v)))} width={110} /></td>
                  <td style={S.tdR}>{fmtN(Math.max(0, mesesRazao(i, 'BRUTA') - (exclusoes[i] || 0)))}</td>
                  <td style={S.tdR}>{fmtN(mesesRazao(i, 'OUTRAS'))}</td>
                </tr>))}
              <tr style={{ fontWeight: 600 }}>
                <td style={S.td}>Total</td><td style={S.tdR}>{fmtN(totRaz('BRUTA'))}</td><td style={S.tdR}>{fmtN(totExcl)}</td>
                <td style={S.tdR}>{fmtN(Math.max(0, totRaz('BRUTA') - totExcl))}</td><td style={S.tdR}>{fmtN(totRaz('OUTRAS'))}</td></tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>Exclusões: receitas lançadas no razão que não pertencem à empresa (ex.: estornadas por ajuste de exercícios anteriores). "Outras receitas" (financeiras) entram integralmente na base do Presumido.</div>
        </div>

        <div>
          <div style={S.card}>
            <div style={S.secTit}>Contas de receita do exercício</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={S.th}>Conta</th><th style={S.thR}>Total no ano</th><th style={S.th}>Tratamento</th></tr></thead>
              <tbody>{(base?.receitas ?? []).map((c: any) => (
                <tr key={c.id}>
                  <td style={S.td}><div style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.code}</div><div>{c.name}</div></td>
                  <td style={S.tdR}>{fmtN(c.total)}</td>
                  <td style={S.td}><select style={{ ...S.input, height: 28, fontSize: 12 }} value={classif[c.id] ?? c.sugestao} onChange={(e) => setClassif({ ...classif, [c.id]: e.target.value })}>
                    <option value="BRUTA">Receita bruta</option><option value="OUTRAS">Outras (financeiras)</option><option value="IGNORAR">Ignorar</option></select></td>
                </tr>))}
                {(base?.receitas ?? []).length === 0 && <tr><td style={S.td} colSpan={3}>Sem contas de receita movimentadas no exercício.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={S.card}>
            <div style={S.secTit}>Premissas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={S.label}>Presunção IRPJ/CSLL (%)</span><NumInput value={presuncao} onChange={setPresuncao} width={90} /></div>
              <div><span style={S.label}>Distribuição acima da base presumida</span>
                <label style={{ fontSize: 12 }}><input type="checkbox" checked={distrib} onChange={(e) => setDistrib(e.target.checked)} /> Sim (ECD obrigatória no Presumido)</label></div>
              <div><span style={S.label}>Lucro Real - adições (LALUR)</span><NumInput value={lr.adicoes} onChange={(n) => setLr({ ...lr, adicoes: n })} /></div>
              <div><span style={S.label}>Lucro Real - exclusões (LALUR)</span><NumInput value={lr.exclusoes} onChange={(n) => setLr({ ...lr, exclusoes: n })} /></div>
              <div><span style={S.label}>Compensação de prejuízo (limite 30%)</span><NumInput value={lr.compensacao} onChange={(n) => setLr({ ...lr, compensacao: n })} /></div>
              <div />
              <div><span style={S.label}>Créditos de PIS no ano (Real)</span><NumInput value={lr.creditosPis} onChange={(n) => setLr({ ...lr, creditosPis: n })} /></div>
              <div><span style={S.label}>Créditos de Cofins no ano (Real)</span><NumInput value={lr.creditosCofins} onChange={(n) => setLr({ ...lr, creditosCofins: n })} /></div>
            </div>
          </div>
        </div>
      </div>

      {r && <>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <ColTot rg="REAL" cor={COR_REAL} />
          <ColTot rg="PRESUMIDO" cor={COR_PRES} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 10 }}>
          {(['PRESUMIDO', 'REAL'] as const).map((rg) => (
            <button key={rg} style={S.btn(rg === 'REAL' ? COR_REAL : COR_PRES)} onClick={() => abrirDarfs(rg)}>Gerar DARFs - {REG[rg]}</button>))}
        </div>
        <div style={{ background: r.maisVantajoso === 'EMPATE' ? '#F3F4F6' : '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {r.maisVantajoso === 'EMPATE' ? 'Os dois regimes têm o mesmo custo estimado.'
            : <><b>{REG[r.maisVantajoso]}</b> custa <b>{fmt(Math.abs(r.diferenca))}</b> a menos (pagamento em {String(r.pagamento).slice(5, 7)}/{String(r.pagamento).slice(0, 4)}). Lucro Real ajustado: {fmt(r.lucroReal?.lucroReal)}.</>}
        </div>

        <div style={S.card}>
          <div style={S.secTit}>Obrigações acessórias em atraso (multas estimadas - editáveis)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={S.th}>Obrigação</th><th style={S.th}>Fundamento</th><th style={S.thR}>Lucro Real</th><th style={S.thR}>Lucro Presumido</th></tr></thead>
            <tbody>{(r.obrigacoes ?? []).map((o: any) => (
              <tr key={o.key}>
                <td style={S.td}><b>{o.nome}</b></td>
                <td style={{ ...S.td, fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: 380 }}>{o.fundamento}{o.PRESUMIDO?.obs ? <div>Presumido: {o.PRESUMIDO.obs}</div> : null}</td>
                {(['REAL', 'PRESUMIDO'] as const).map((rg) => (
                  <td key={rg} style={S.tdR}>{o[rg].exigida
                    ? <NumInput value={multas[o.key + '_' + rg] ?? o[rg].multa} onChange={(n) => setMultas({ ...multas, [o.key + '_' + rg]: n })} width={110} />
                    : <span style={S.badge('#6B7280')}>Dispensada</span>}</td>))}
              </tr>))}</tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>Ao editar uma multa, clique em Calcular para atualizar os totais.</div>
        </div>

        <div style={S.card}>
          <div style={S.secTit}>DARFs - Lucro Presumido x Lucro Real</div>
          {(() => {
            const FAM: Record<string, string> = { '8109': 'PIS', '6912': 'PIS', '2172': 'Cofins', '5856': 'Cofins', '2089': 'IRPJ', '2430': 'IRPJ', '2372': 'CSLL', '6773': 'CSLL' };
            const ORD = ['PIS', 'Cofins', 'IRPJ', 'CSLL'];
            const chave = (p: string) => (/^\d{2}\/\d{4}$/.test(p) ? p.slice(3) + p.slice(0, 2) : /^\dT\/\d{4}$/.test(p) ? p.slice(3) + 'T' + p[0] : p + 'Z');
            const linhas: Record<string, any> = {};
            (r.darfs ?? []).forEach((d: any) => {
              const f = FAM[d.codigo] ?? d.tributo;
              const k = f + '|' + d.periodo;
              if (!linhas[k]) linhas[k] = { fam: f, periodo: d.periodo, PRESUMIDO: null, REAL: null };
              linhas[k][d.regime] = d;
            });
            const todas: any[] = Object.values(linhas);
            const fams: string[] = ORD.concat(todas.map((l: any) => l.fam)).filter((f: string, i: number, a: string[]) => a.indexOf(f) === i);
            const grupos = fams
              .map((f) => ({ fam: f, rows: todas.filter((l: any) => l.fam === f).sort((a: any, b: any) => chave(a.periodo).localeCompare(chave(b.periodo))) }))
              .filter((g) => g.rows.length > 0);
            const soma = (rows: any[], rg: string, campo: string) => rows.reduce((s: number, l: any) => s + (Number(l[rg]?.[campo]) || 0), 0);
            const cel = (d: any, campo: string) => (d ? fmtN(d[campo]) : '-');
            const sep = { borderLeft: '2px solid var(--color-border-secondary)' };
            const thG = (cor: string) => ({ ...S.th, textAlign: 'center' as const, color: cor, borderLeft: '2px solid var(--color-border-secondary)' });
            const REGS = ['PRESUMIDO', 'REAL'] as const;
            const linhaSoma = (rows: any[], rotulo: string, destaque: boolean) => (
              <tr style={{ background: destaque ? FIN_LIGHT : 'var(--color-background-secondary)', fontWeight: 600 }}>
                <td style={S.td} colSpan={2}>{rotulo}</td>
                {REGS.map((rg) => (
                  <React.Fragment key={rg}>
                    <td style={{ ...S.td, ...sep }} colSpan={2}></td>
                    <td style={S.tdR}>{fmtN(soma(rows, rg, 'principal'))}</td>
                    <td style={S.tdR}>{fmtN(soma(rows, rg, 'juros'))}</td>
                    <td style={S.tdR}>{fmtN(soma(rows, rg, 'total'))}</td>
                  </React.Fragment>))}
              </tr>
            );
            if (!todas.length) return <div style={{ fontSize: 12 }}>Nenhum tributo devido nas premissas informadas.</div>;
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th} colSpan={2}></th>
                    <th style={thG(COR_PRES)} colSpan={5}>Lucro Presumido</th>
                    <th style={thG(COR_REAL)} colSpan={5}>Lucro Real</th>
                  </tr>
                  <tr>
                    <th style={S.th}>Tributo</th><th style={S.th}>Período</th>
                    {REGS.map((rg) => (
                      <React.Fragment key={rg}>
                        <th style={{ ...S.th, ...sep }}>Código</th><th style={S.th}>Vencimento</th>
                        <th style={S.thR}>Principal</th><th style={S.thR}>Juros</th><th style={S.thR}>Total</th>
                      </React.Fragment>))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <React.Fragment key={g.fam}>
                      {g.rows.map((l: any, i: number) => (
                        <tr key={g.fam + '|' + l.periodo}>
                          <td style={S.td}>{i === 0 ? <b>{g.fam}</b> : ''}</td>
                          <td style={S.td}>{l.periodo}</td>
                          {REGS.map((rg) => {
                            const d = l[rg];
                            return (
                              <React.Fragment key={rg}>
                                <td style={{ ...S.td, ...sep, fontFamily: 'monospace' }}>{d?.codigo ?? '-'}</td>
                                <td style={S.td}>{d ? fmtD(d.vencimento) : '-'}</td>
                                <td style={S.tdR}>{cel(d, 'principal')}</td>
                                <td style={S.tdR} title={d ? 'Selic acumulada ' + fmtP(d.selicPct) : ''}>{cel(d, 'juros')}</td>
                                <td style={S.tdR}><b>{cel(d, 'total')}</b></td>
                              </React.Fragment>);
                          })}
                        </tr>))}
                      {linhaSoma(g.rows, 'Subtotal ' + g.fam, false)}
                    </React.Fragment>))}
                  {linhaSoma(todas, 'Total dos DARFs', true)}
                </tbody>
              </table>
            );
          })()}
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>Juros: Selic acumulada do mês seguinte ao vencimento até o mês anterior ao pagamento + 1% (passe o mouse sobre o valor dos juros para ver a taxa). No Lucro Real, IRPJ e CSLL são anuais e só aparecem se houver lucro real positivo.</div>
        </div>

        {(r.alertas ?? []).length > 0 && <div style={{ ...S.card, background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div style={S.secTit}>Observações</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{r.alertas.map((a: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}</ul>
        </div>}

        <div style={{ ...S.card, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><span style={S.label}>Título do estudo</span><input style={{ ...S.input, width: '100%' }} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: LM 2022 - receita após ajustes de terceiros" /></div>
          <button style={S.btn(FIN)} onClick={salvar} disabled={loading}>Salvar estudo (nova versão)</button>
        </div>
      </>}

      <div style={S.card}>
        <div style={S.secTit}>Histórico de estudos - exercício {ano}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={S.th}>Versão</th><th style={S.th}>Salvo em</th><th style={S.th}>Autor</th><th style={S.th}>Título</th><th style={S.thR}>Lucro Real</th><th style={S.thR}>Lucro Presumido</th><th style={S.th}>Situação</th><th style={S.th}></th></tr></thead>
          <tbody>{estudos.map((e) => (
            <tr key={e.id} style={aberto?.id === e.id ? { background: FIN_LIGHT } : undefined}>
              <td style={S.td}><b>v{e.versao}</b></td><td style={S.td}>{fmtDH(e.created_at)}</td><td style={S.td}>{e.autor_nome ?? '-'}</td><td style={S.td}>{e.titulo}</td>
              <td style={S.tdR}>{fmtN(e.totais?.REAL?.total)}</td><td style={S.tdR}>{fmtN(e.totais?.PRESUMIDO?.total)}</td>
              <td style={S.td}>{e.status === 'CONCLUIDO'
                ? <span title={e.justificativa ?? ''} style={S.badge('#16A34A')}>Recomenda: {REG[e.regime_recomendado]} ({fmtD(e.concluido_em)}{e.concluido_por_nome ? ' - ' + e.concluido_por_nome : ''})</span>
                : <span style={S.badge(e.status === 'SUBSTITUIDO' ? '#B45309' : '#6B7280')}>{e.status === 'SUBSTITUIDO' ? 'Conclusão substituída' : 'Rascunho'}</span>}</td>
              <td style={{ ...S.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button style={S.btnO} onClick={() => abrir(e.id)}>Abrir</button>{' '}
                <button style={S.btnO} onClick={() => setDec({ id: e.id, versao: e.versao, regime: e.mais_vantajoso === 'REAL' ? 'LUCRO_REAL' : 'LUCRO_PRESUMIDO', justificativa: e.justificativa ?? '', erro: null })}>Registrar conclusão</button>{' '}
                <button style={{ ...S.btnO, color: '#B91C1C' }} onClick={() => excluir(e.id, e.versao)}>Excluir</button>
              </td>
            </tr>))}
            {estudos.length === 0 && <tr><td style={S.td} colSpan={8}>Nenhum estudo salvo para {ano}.</td></tr>}
          </tbody>
        </table>
        {concluido?.justificativa && <div style={{ fontSize: 12, marginTop: 10, borderLeft: '3px solid #16A34A', paddingLeft: 10 }}><b>Justificativa da conclusão (v{concluido.versao}):</b> {concluido.justificativa}</div>}
      </div>

      {darfModal && <DarfModal onClose={() => setDarfModal(null)} titulo={darfModal.titulo} subtitulo={darfModal.subtitulo} itensIniciais={darfModal.itens} origem={darfModal.itens.length ? 'ESTUDO_REGIME' : 'MANUAL'} origemId={aberto?.id ?? null} abaInicial={darfModal.itens.length ? 'GERAR' : 'GERADOS'} quotaOpcaoPresumido={!!darfModal.quotaOpcao} />}

      {dec && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: 560, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
            <div style={{ background: FIN, color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><div style={{ fontSize: 15, fontWeight: 600 }}>Registrar conclusão do estudo</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Exercício {ano} - estudo v{dec.versao}</div></div>
              <button onClick={() => setDec(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ borderLeft: '3px solid ' + FIN_ACCENT, paddingLeft: 12 }}>
                <span style={S.label}>Regime recomendado pelo estudo</span>
                <select style={{ ...S.input, width: '100%', marginBottom: 12 }} value={dec.regime} onChange={(e) => setDec({ ...dec, regime: e.target.value })}>
                  <option value="LUCRO_REAL">Lucro Real</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option></select>
                <span style={S.label}>Justificativa (fica registrada no histórico do estudo)</span>
                <textarea style={{ ...S.input, width: '100%', height: 110, padding: 8, resize: 'vertical' }} value={dec.justificativa} onChange={(e) => setDec({ ...dec, justificativa: e.target.value })} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 10 }}>É uma conclusão de estudo: não altera o regime cadastrado da empresa nem regimes já escolhidos. A opção de regime se formaliza pelo pagamento e pelas declarações. A conclusão anterior do mesmo exercício, se houver, fica marcada como substituída.</div>
              {dec.erro && <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 6, padding: '8px 10px', fontSize: 12, marginTop: 10 }}>{dec.erro}</div>}
            </div>
            <div style={{ background: '#FAFAFA', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '0.5px solid #E5E7EB' }}>
              <button style={S.btnO} onClick={() => setDec(null)}>Cancelar</button>
              <button style={S.btn(FIN_ACCENT)} disabled={dec.saving} onClick={registrarConclusao}>{dec.saving ? 'Registrando...' : 'Registrar conclusão'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
