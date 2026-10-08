// frontend/src/pages/projects/workspace/SimuladorRmProjeto.tsx
// Simulador do spread RM (08/10/2026): cenarios da assuncao da divida pela REAL MOUCHAO (aditivo em negociacao).
// Calculo na tela; dados reais (PEPS) vem de /simulador-rm/base; cenarios salvos em proj_simulacoes_rm (imutaveis).
// Nao grava nada na contabilidade, no Fluxo nem no Painel.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, fmtBRL, fmtData, PROJ } from './projetoTema';
import { ModalProjeto, BotaoSec, erroApi } from './ModalProjeto';

const ANOS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
const PADRAO = { pref: 25, res: 5, descMed: 20, descSh: 50, ant: 10, corr: 0, taxa: 12, quota: 1.0606, totBP: 377000000, perfil: 'linear' };
const PASSIVOS_PADRAO = ['Impostos e parcelamentos', 'Acordos e verbas trabalhistas', 'Reembolsos e bloqueios judiciais'];
const CORES: Record<string, string> = { ant: '#2a78d6', desc: '#eb6834', pref: '#1baf7a', res: '#c98500' };
const COMP: [string, string][] = [['ant', 'Antecipação sobre aportes'], ['desc', 'Desconto compartilhado'], ['pref', 'Retorno preferencial'], ['res', 'Participação residual']];

type Params = typeof PADRAO;
type Linha = { ano: number; aportes: number; pagos: number; resultado: number; real?: boolean };

const inp: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: '#fff' };
const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14 };
const secao: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 6px' };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const fmtPct = (v: number, d = 1) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const fmtMi = (v: number) => `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;

function distribuir(total: number, perfil: string): Record<number, number> {
  const anos = ANOS.filter((a) => a >= 2027);
  const w = anos.map((_, i) => (perfil === 'cresc' ? i + 1 : perfil === 'rampa' ? Math.min(i + 1, 4) : 1));
  const s = w.reduce((x, y) => x + y, 0);
  const o: Record<number, number> = {};
  anos.forEach((a, i) => { o[a] = Math.round((total * w[i]) / s * 100) / 100; });
  return o;
}

function reais(base: any, passivos: string[]) {
  const o: Record<number, { aportes: number; pagos: number }> = {};
  for (const r of base?.anos || []) {
    const ano = Math.max(2025, Number(r.ano));
    const x = o[ano] || { aportes: 0, pagos: 0 };
    x.aportes += Number(r.ancora || 0);
    x.pagos += (r.porNatureza || []).filter((n: any) => passivos.includes(n.natureza)).reduce((s: number, n: any) => s + Number(n.pago || 0), 0);
    o[ano] = x;
  }
  return o;
}

function calcular(p: Params, linhas: Linha[], D: number) {
  const c = p.corr / 100, pref = p.pref / 100, res = p.res / 100, dm = Math.min(Math.max(p.descMed, 0), 95) / 100, ds = p.descSh / 100, ant = p.ant / 100, tx = p.taxa / 100;
  let rec = 0, carry = 0;
  let anoRec = 0;
  const out: any[] = [];
  for (const r of linhas) {
    const alvo = D * Math.pow(1 + c, Math.max(0, r.ano - 2025));
    let rem = Math.max(0, alvo - rec);
    const a = Math.min(ant * r.aportes, rem); rec += a; rem -= a;
    const descontoTotal = (r.pagos * dm) / (1 - dm);
    const d = Math.min(ds * descontoTotal, rem); rec += d; rem -= d;
    let Rb = 0;
    if (r.resultado < 0) carry += -r.resultado; else { const u = Math.min(carry, r.resultado); carry -= u; Rb = r.resultado - u; }
    let pf = 0, rs = 0;
    if (rem > 0 && pref > 0) { const full = pref * Rb; if (full <= rem) pf = full; else { pf = rem; rs = res * Math.max(0, Rb - rem / pref); } }
    else rs = res * Rb;
    rec += pf + rs;
    if (!anoRec && alvo > 0 && rec >= alvo - 0.005) anoRec = r.ano;
    const t = Math.max(0.08, r.ano + 0.5 - (2025 + 10 / 12));
    const tot = a + d + pf + rs;
    out.push({ ano: r.ano, ant: a, desc: d, descontoTotal, pref: pf, res: rs, tot, acum: rec, alvo, Rb, vp: tot / Math.pow(1 + tx, t) });
  }
  const S = (k: string) => out.reduce((s, o) => s + o[k], 0);
  const tot = S('tot'), vp = S('vp'), somaRb = S('Rb');
  const custo = somaRb > 0 ? (S('pref') + S('res')) / somaRb : 0;
  return { out, divida: D, tot, vp, spread: tot - D, spreadVp: vp - D, anoRec, custo, quota: custo < 1 ? p.quota / (1 - custo) : 0,
    ant: S('ant'), desc: S('desc'), pref: S('pref'), res: S('res'), foraResultado: S('ant') + S('desc'), alvoFinal: out.length ? out[out.length - 1].alvo : D };
}

function marcas(max: number) {
  const bruto = max / 4; const p = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
  const passo = ([1, 2, 2.5, 5, 10].find((x) => x * p >= bruto) || 10) * p;
  const t: number[] = []; for (let v = 0; v <= max + 1e-9; v += passo) t.push(v);
  if (t[t.length - 1] < max) t.push(t[t.length - 1] + passo);
  return t;
}

function Barras({ out }: { out: any[] }) {
  const W = 520, H = 230, L = 56, R = 8, T = 10, B = 24, iw = W - L - R, ih = H - T - B;
  const tk = marcas(Math.max(1, ...out.map((o) => o.tot))); const top = tk[tk.length - 1];
  const y = (v: number) => T + ih - (v / top) * ih; const bw = iw / out.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Recebimentos anuais da RM por componente">
      {tk.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E5E7EB" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#6B7280">{fmtMi(t)}</text></g>))}
      {out.map((o, i) => {
        const x = L + i * bw + bw * 0.18, w = bw * 0.64; let acc = 0;
        return (
          <g key={o.ano}>
            <title>{`${o.ano}\n` + COMP.map(([k, n]) => `${n}: ${fmtBRL(o[k])}`).join('\n') + `\nTotal: ${fmtBRL(o.tot)}`}</title>
            <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent" />
            {COMP.map(([k]) => {
              const v = o[k]; if (v <= 0) return null;
              const y0 = y(acc), y1 = y(acc + v); const h = Math.max(0, y0 - y1 - (acc > 0 ? 2 : 0)); acc += v;
              return <rect key={k} x={x} y={y1} width={w} height={h} fill={CORES[k]} rx={2} />;
            })}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#6B7280">{String(o.ano).slice(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Acumulado({ m }: { m: any }) {
  const W = 520, H = 230, L = 56, R = 8, T = 10, B = 24, iw = W - L - R, ih = H - T - B;
  const n = m.out.length; if (!n) return null;
  const tk = marcas(Math.max(m.out[n - 1].acum, m.alvoFinal) * 1.05); const top = tk[tk.length - 1];
  const y = (v: number) => T + ih - (v / top) * ih; const x = (i: number) => L + (i + 0.5) * iw / n;
  const linha = m.out.map((o: any, i: number) => `${i ? 'L' : 'M'}${x(i)},${y(o.acum)}`).join('');
  const ref = m.out.map((o: any, i: number) => `${i ? 'L' : 'M'}${x(i)},${y(o.alvo)}`).join('');
  const iRec = m.anoRec ? m.out.findIndex((o: any) => o.ano === m.anoRec) : -1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Recuperação acumulada contra a dívida">
      {tk.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E5E7EB" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#6B7280">{fmtMi(t)}</text></g>))}
      <path d={ref} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="5 4" />
      <path d={`${linha}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="#2a78d6" opacity={0.12} />
      <path d={linha} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(m.out[n - 1].acum)} r={4} fill="#2a78d6" stroke="#fff" strokeWidth={2} />
      {iRec >= 0 && (<g><line x1={x(iRec)} x2={x(iRec)} y1={T} y2={T + ih} stroke="#9CA3AF" strokeDasharray="2 3" /><text x={x(iRec) + 4} y={T + 10} fontSize={10} fill="#374151">recupera em {m.anoRec}</text></g>)}
      {m.out.map((o: any, i: number) => (
        <g key={o.ano}><title>{`${o.ano}\nAcumulado: ${fmtBRL(o.acum)}\nDívida: ${fmtBRL(o.alvo)}\nDiferença: ${fmtBRL(o.acum - o.alvo)}`}</title>
          <rect x={L + (i * iw) / n} y={T} width={iw / n} height={ih} fill="transparent" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#6B7280">{String(o.ano).slice(2)}</text></g>))}
    </svg>
  );
}

function Campo({ rot, sub, v, step, on }: { rot: string; sub?: string; v: number; step?: number; on: (x: number) => void }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#374151' }}>{rot}{sub && <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF' }}>{sub}</span>}</span>
      <input type="number" step={step ?? 1} value={Number.isFinite(v) ? v : 0} onChange={(e) => on(parseFloat(e.target.value) || 0)} style={inp} />
    </label>
  );
}

export default function SimuladorRmProjeto({ projetoId }: { projetoId: string }) {
  const [base, setBase] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [p, setP] = useState<Params>({ ...PADRAO });
  const [passivos, setPassivos] = useState<string[]>(PASSIVOS_PADRAO);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cenarios, setCenarios] = useState<any[]>([]);
  const [comparar, setComparar] = useState<string[]>([]);
  const [modal, setModal] = useState<'' | 'salvar' | 'encerrar'>('');
  const [alvo, setAlvo] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [erroModal, setErroModal] = useState('');
  const [aviso, setAviso] = useState('');

  const carregarCenarios = () => api.get(`/projects-relatorios/projetos/${projetoId}/simulador-rm/cenarios`).then((r: any) => setCenarios(r.data || [])).catch(() => setCenarios([]));
  const montar = (b: any, pas: string[], prm: Params, resultadoAtual?: Record<number, number>) => {
    const rl = reais(b, pas); const dist = resultadoAtual || distribuir(prm.totBP, prm.perfil);
    return ANOS.map((ano) => ({ ano, aportes: Math.round((rl[ano]?.aportes || 0) * 100) / 100, pagos: Math.round((rl[ano]?.pagos || 0) * 100) / 100, resultado: dist[ano] || 0, real: !!rl[ano] }));
  };
  useEffect(() => {
    api.get(`/projects-relatorios/projetos/${projetoId}/simulador-rm/base`).then((r: any) => { setBase(r.data); setLinhas(montar(r.data, PASSIVOS_PADRAO, PADRAO)); })
      .catch((e: any) => setErro(erroApi(e, 'Falha ao carregar os dados do projeto.')));
    carregarCenarios();
  }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const D = Number(base?.divida || 54418451);
  const m = useMemo(() => calcular(p, linhas, D), [p, linhas, D]);
  const naturezas = useMemo(() => { const s = new Set<string>(); for (const a of base?.anos || []) for (const n of a.porNatureza || []) s.add(n.natureza); return [...s]; }, [base]);
  const set = (k: keyof Params) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const editar = (i: number, k: 'aportes' | 'pagos' | 'resultado', v: number) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const resultadoAtual = () => Object.fromEntries(linhas.map((l) => [l.ano, l.resultado])) as Record<number, number>;
  const alternarPassivo = (n: string) => {
    const novo = passivos.includes(n) ? passivos.filter((x) => x !== n) : [...passivos, n];
    setPassivos(novo); const rl = reais(base, novo);
    setLinhas((ls) => ls.map((l) => (l.real ? { ...l, pagos: Math.round((rl[l.ano]?.pagos || 0) * 100) / 100 } : l)));
  };
  const resumoDe = (x: any) => ({ tot: x.tot, vp: x.vp, spread: x.spread, spreadVp: x.spreadVp, anoRec: x.anoRec, custo: x.custo, quota: x.quota, foraResultado: x.foraResultado, ant: x.ant, desc: x.desc, pref: x.pref, res: x.res, divida: x.divida });

  const salvar = async () => {
    setErroModal('');
    try {
      await api.post(`/projects-relatorios/projetos/${projetoId}/simulador-rm/cenarios`, { nome: texto.trim(), parametros: { ...p, passivos, dataBase: base?.ate }, anual: linhas, resumo: resumoDe(m) });
      setModal(''); setTexto(''); setAviso('Cenário salvo.'); carregarCenarios();
    } catch (e) { setErroModal(erroApi(e, 'Falha ao salvar o cenário.')); }
  };
  const encerrar = async () => {
    setErroModal('');
    try {
      await api.post(`/projects-relatorios/projetos/${projetoId}/simulador-rm/cenarios/${alvo.id}/encerrar`, { motivo: texto.trim() });
      setModal(''); setTexto(''); setComparar((c) => c.filter((x) => x !== alvo.id)); setAviso(`Cenário "${alvo.nome}" encerrado.`); carregarCenarios();
    } catch (e) { setErroModal(erroApi(e, 'Falha ao encerrar o cenário.')); }
  };
  const carregar = (c: any) => {
    const prm = { ...PADRAO, ...(c.parametros || {}) }; delete (prm as any).passivos; delete (prm as any).dataBase;
    setP(prm as Params); setPassivos(c.parametros?.passivos || PASSIVOS_PADRAO);
    setLinhas((c.anual || []).map((l: any) => ({ ano: Number(l.ano), aportes: Number(l.aportes || 0), pagos: Number(l.pagos || 0), resultado: Number(l.resultado || 0), real: !!l.real })));
    setAviso(`Cenário "${c.nome}" carregado (dados de ${c.parametros?.dataBase ? fmtData(c.parametros.dataBase) : 'data não registrada'}).`);
  };

  const card = (rot: string, val: string, sub?: string, cor?: string) => (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: cor || '#0F2747', whiteSpace: 'nowrap' }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: '#6B7280' }}>{sub}</div>}
    </div>
  );
  const sinal = (v: number) => (v >= 0 ? '+' : '') + fmtBRL(v);
  const corV = (v: number) => (v >= 0 ? '#166534' : '#A32D2D');
  const comparados = cenarios.filter((c) => comparar.includes(c.id));
  const LINHAS_COMP: [string, (r: any) => string][] = [
    ['Total recebido', (r) => fmtBRL(r.tot)], ['Spread nominal', (r) => sinal(r.spread)], ['Valor presente', (r) => fmtBRL(r.vp)], ['Spread em VP', (r) => sinal(r.spreadVp)],
    ['Ano de recuperação', (r) => (r.anoRec ? String(r.anoRec) : 'não recupera')], ['Custo aos cotistas', (r) => fmtPct(r.custo)], ['Novo % por quota', (r) => `${(r.quota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`],
    ['Fora do resultado', (r) => fmtBRL(r.foraResultado)]];
  const PARAMS_COMP: [string, (q: any) => string][] = [
    ['Preferencial', (q) => `${q.pref}%`], ['Residual', (q) => `${q.res}%`], ['Desconto médio / parte à RM', (q) => `${q.descMed}% / ${q.descSh}%`], ['Antecipação', (q) => `${q.ant}%`],
    ['Correção da dívida', (q) => `${q.corr}% a.a.`], ['Taxa do VP', (q) => `${q.taxa}% a.a.`], ['Resultado do BP', (q) => fmtBRL(q.totBP)]];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0F2747' }}>Simulador do spread RM</h1>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Assunção da dívida de {fmtBRL(D)} pela REAL MOUCHÃO em {fmtData(base?.dataConfissao || '2025-10-31')} · aditivo em negociação · dados reais do LEDGR até {base?.ate ? fmtData(base.ate) : '...'} · nada é gravado na contabilidade
        </div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {aviso && <div style={{ fontSize: 12, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '6px 12px', display: 'flex' }}><span style={{ flex: 1 }}>{aviso}</span><span style={{ cursor: 'pointer' }} onClick={() => setAviso('')}>×</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={painel}>
          <div style={{ fontWeight: 700, color: '#0F2747' }}>Parâmetros do aditivo</div>
          <div style={secao}>Participação no resultado (antes do CDE)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Retorno preferencial" sub="cl. 2.1 · % do resultado" v={p.pref} step={0.5} on={set('pref')} />
            <Campo rot="Participação residual" sub="cl. 3.1 · % após recuperar" v={p.res} step={0.5} on={set('res')} />
          </div>
          <div style={secao}>Reestruturação dos passivos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Desconto médio obtido" sub="% sobre a face · hipótese" v={p.descMed} on={set('descMed')} />
            <Campo rot="Parte do desconto à RM" sub="cl. 4.3 · %" v={p.descSh} step={5} on={set('descSh')} />
          </div>
          <div style={secao}>Antecipação e dívida</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Antecipação sobre aportes" sub="cl. 5.1 · % da parte do Âncora (PEPS)" v={p.ant} step={0.5} on={set('ant')} />
            <Campo rot="Correção da dívida" sub="cl. 1.2 · % ao ano · 0 = sem" v={p.corr} step={0.1} on={set('corr')} />
          </div>
          <div style={secao}>Avaliação</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Taxa do valor presente" sub="% ao ano · base 31/10/2025" v={p.taxa} step={0.5} on={set('taxa')} />
            <Campo rot="% por quota atual" sub="premissas v2" v={p.quota} step={0.0001} on={set('quota')} />
          </div>
          <div style={secao}>Resultado do projeto (BP)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Resultado total" sub="R$ · distribuído de 2027 a 2035" v={p.totBP} step={1000000} on={set('totBP')} />
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#374151' }}>Perfil</span>
              <select value={p.perfil} onChange={(e) => setP((x) => ({ ...x, perfil: e.target.value }))} style={{ ...inp, textAlign: 'left' }}>
                <option value="linear">Linear</option><option value="cresc">Crescente</option><option value="rampa">Rampa até 2030</option></select>
            </label>
            <button type="button" style={{ ...botaoPri, background: '#fff', color: PROJ, border: `1px solid ${PROJ}` }}
              onClick={() => { const d = distribuir(p.totBP, p.perfil); setLinhas((ls) => ls.map((l) => ({ ...l, resultado: d[l.ano] || 0 }))); }}>Distribuir na tabela</button>
          </div>
          <div style={secao}>Naturezas que pagam passivo</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Geram desconto (cl. 4). A antecipação usa todos os pagamentos.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {naturezas.map((n) => { const on = passivos.includes(n); return (
              <button key={n} type="button" onClick={() => alternarPassivo(n)}
                style={{ fontSize: 12, borderRadius: 14, padding: '3px 10px', cursor: 'pointer', border: `1px solid ${on ? PROJ : '#D1D5DB'}`, background: on ? '#E6F4F1' : '#fff', color: on ? PROJ : '#6B7280' }}>{on ? '✓ ' : ''}{n}</button>); })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={botaoPri} onClick={() => { setTexto(''); setErroModal(''); setModal('salvar'); }}>Salvar cenário</button>
            <BotaoSec onClick={() => { setP({ ...PADRAO }); setPassivos(PASSIVOS_PADRAO); if (base) setLinhas(montar(base, PASSIVOS_PADRAO, PADRAO)); setAviso('Proposta inicial restaurada.'); }}>Proposta inicial</BotaoSec>
            <BotaoSec onClick={() => { if (base) setLinhas(montar(base, passivos, p, resultadoAtual())); setAviso('Aportes e pagamentos reais recarregados; o resultado foi mantido.'); }}>Recarregar dados reais</BotaoSec>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {card('Total recebido', fmtBRL(m.tot), 'nominal')}
            {card('Spread nominal', sinal(m.spread), `sobre ${fmtBRL(D)}`, corV(m.spread))}
            {card('Valor presente', fmtBRL(m.vp), `a ${p.taxa}% ao ano`)}
            {card('Spread em VP', sinal(m.spreadVp), 'VP menos a dívida', corV(m.spreadVp))}
            {card('Recuperação', m.anoRec ? String(m.anoRec) : 'Não recupera', 'ano em que atinge a dívida', m.anoRec ? undefined : '#A32D2D')}
            {card('Custo aos cotistas', fmtPct(m.custo), 'do resultado vai à RM')}
            {card('Novo % por quota', `${m.quota.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`, 'mantém a meta do Âncora')}
            {card('Fora do resultado', fmtBRL(m.foraResultado), 'antecipação + desconto')}
          </div>
          <div style={{ fontSize: 13, background: m.spreadVp >= 0 ? '#F0FDF4' : '#FFFBEB', border: `0.5px solid ${m.spreadVp >= 0 ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 8, padding: '8px 12px' }}>
            {m.anoRec
              ? <>A RM recupera a dívida em <b>{m.anoRec}</b> com spread nominal de <b>{sinal(m.spread)}</b>. Em valor presente o spread é <b>{sinal(m.spreadVp)}</b>: {m.spreadVp >= 0 ? 'a proposta remunera o prazo e o risco à taxa escolhida.' : 'a taxa escolhida ainda não é coberta; o que chega cedo (desconto, antecipação, preferencial) pesa mais que o residual.'}</>
              : <>Com estes parâmetros a RM não recupera a dívida até 2035.</>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <div style={painel}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Recebimentos da RM por ano</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Por componente, nominal · passe o mouse para os valores</div>
              <Barras out={m.out} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: '#374151', marginTop: 4 }}>
                {COMP.map(([k, n]) => <span key={k}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: CORES[k], marginRight: 4, verticalAlign: -1 }} />{n}</span>)}
              </div>
            </div>
            <div style={painel}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Recuperação acumulada</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Total recebido acumulado contra a dívida</div>
              <Acumulado m={m} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: '#374151', marginTop: 4 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#2a78d6', marginRight: 4, verticalAlign: -1 }} />Recebido acumulado</span>
                <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #111827', marginRight: 4, verticalAlign: 3 }} />Dívida{p.corr ? ' corrigida' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={painel}>
        <div style={{ fontWeight: 700, color: '#0F2747' }}>Fluxo anual</div>
        <div style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 8px' }}>
          Colunas em verde são editáveis. Anos marcados como "real" vêm do LEDGR (2025 inclui ago a dez/2024); o ano corrente traz só o realizado até a data-base. Resultado negativo é compensado com os anos seguintes (cl. 7.2).
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead><tr>
              <th style={thSt}>Ano</th><th style={{ ...dir, background: '#E6F4F1' }}>Aportes aplicados (Âncora)</th><th style={{ ...dir, background: '#E6F4F1' }}>Passivos pagos</th><th style={{ ...dir, background: '#E6F4F1' }}>Resultado do projeto</th>
              <th style={dir}>Antecipação</th><th style={dir}>Desconto à RM</th><th style={dir}>Preferencial</th><th style={dir}>Residual</th><th style={dir}>Total à RM</th><th style={dir}>Acumulado</th><th style={dir}>VP</th>
            </tr></thead>
            <tbody>{linhas.map((l, i) => { const o = m.out[i] || {}; return (
              <tr key={l.ano}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{l.ano}{l.real && <span style={{ marginLeft: 6, fontSize: 10, color: PROJ, border: `1px solid ${PROJ}`, borderRadius: 8, padding: '0 5px' }}>real</span>}</td>
                {(['aportes', 'pagos', 'resultado'] as const).map((k) => (
                  <td key={k} style={{ ...tdSt, background: '#F3FAF8', width: 150 }}><input type="number" step={1000} value={l[k]} onChange={(e) => editar(i, k, parseFloat(e.target.value) || 0)} style={inp} aria-label={`${k} ${l.ano}`} /></td>))}
                <td style={num}>{fmtBRL(o.ant || 0)}</td><td style={num} title={`Desconto total estimado: ${fmtBRL(o.descontoTotal || 0)}`}>{fmtBRL(o.desc || 0)}</td>
                <td style={num}>{fmtBRL(o.pref || 0)}</td><td style={num}>{fmtBRL(o.res || 0)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(o.tot || 0)}</td>
                <td style={num}>{fmtBRL(o.acum || 0)}</td><td style={num}>{fmtBRL(o.vp || 0)}</td>
              </tr>); })}</tbody>
            <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}>
              <td style={{ ...tdSt, fontWeight: 700 }}>Total</td>
              {(['aportes', 'pagos', 'resultado'] as const).map((k) => <td key={k} style={{ ...num, fontWeight: 700 }}>{fmtBRL(linhas.reduce((s, l) => s + l[k], 0))}</td>)}
              {['ant', 'desc', 'pref', 'res', 'tot'].map((k) => <td key={k} style={{ ...num, fontWeight: 700 }}>{fmtBRL((m as any)[k])}</td>)}
              <td style={tdSt}></td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(m.vp)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>

      <div style={painel}>
        <div style={{ fontWeight: 700, color: '#0F2747' }}>Cenários salvos</div>
        <div style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 8px' }}>Marque até 3 para comparar com o cenário em tela. Cenários são imutáveis; para descartar, encerre com motivo.</div>
        {!cenarios.length && <div style={{ fontSize: 13, color: '#6B7280' }}>Nenhum cenário salvo ainda. Ajuste os parâmetros e use "Salvar cenário".</div>}
        {!!cenarios.length && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Comparar</th><th style={thSt}>Nome</th><th style={thSt}>Salvo em</th><th style={dir}>Spread nominal</th><th style={dir}>Spread em VP</th><th style={dir}>Recuperação</th><th style={thSt}></th></tr></thead>
            <tbody>{cenarios.map((c) => (
              <tr key={c.id}>
                <td style={tdSt}><input type="checkbox" checked={comparar.includes(c.id)} disabled={!comparar.includes(c.id) && comparar.length >= 3}
                  onChange={() => setComparar((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} aria-label={`Comparar ${c.nome}`} /></td>
                <td style={{ ...tdSt, fontWeight: 600 }}>{c.nome}</td><td style={tdSt}>{fmtData(String(c.criadoEm).slice(0, 10))}</td>
                <td style={{ ...num, color: corV(c.resumo?.spread || 0) }}>{sinal(c.resumo?.spread || 0)}</td><td style={{ ...num, color: corV(c.resumo?.spreadVp || 0) }}>{sinal(c.resumo?.spreadVp || 0)}</td>
                <td style={num}>{c.resumo?.anoRec || 'não recupera'}</td>
                <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <BotaoSec onClick={() => carregar(c)}>Carregar</BotaoSec>{' '}
                  <BotaoSec onClick={() => { setAlvo(c); setTexto(''); setErroModal(''); setModal('encerrar'); }}>Encerrar</BotaoSec>
                </td>
              </tr>))}</tbody>
          </table>)}
        {!!comparados.length && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={thSt}>Comparação</th><th style={{ ...dir, background: '#E6F4F1' }}>Em tela (não salvo)</th>{comparados.map((c) => <th key={c.id} style={dir}>{c.nome}</th>)}</tr></thead>
              <tbody>
                {PARAMS_COMP.map(([rot, f]) => (<tr key={rot}><td style={{ ...tdSt, color: '#6B7280' }}>{rot}</td><td style={{ ...num, background: '#F3FAF8' }}>{f(p)}</td>{comparados.map((c) => <td key={c.id} style={num}>{f({ ...PADRAO, ...(c.parametros || {}) })}</td>)}</tr>))}
                {LINHAS_COMP.map(([rot, f]) => (<tr key={rot}><td style={{ ...tdSt, fontWeight: 600 }}>{rot}</td><td style={{ ...num, background: '#F3FAF8', fontWeight: 600 }}>{f(resumoDe(m))}</td>{comparados.map((c) => <td key={c.id} style={{ ...num, fontWeight: 600 }}>{f(c.resumo || {})}</td>)}</tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      {modal === 'salvar' && (
        <ModalProjeto titulo="Salvar cenário" subtitulo="Grava parâmetros, fluxo anual e resultado; o cenário não pode ser alterado depois" largura={520} onClose={() => setModal('')}
          rodape={<><span style={{ flex: 1 }} /><BotaoSec onClick={() => setModal('')}>Cancelar</BotaoSec><button type="button" style={botaoPri} onClick={salvar}>Salvar</button></>}>
          {erroModal && <div style={erroSt}>⚠ {erroModal}</div>}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Nome do cenário
            <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={120} placeholder="Ex.: Proposta 1 - 25/5, desconto 50%" style={{ ...inp, textAlign: 'left' }} /></label>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Spread nominal {sinal(m.spread)} · em VP {sinal(m.spreadVp)} · recuperação {m.anoRec || 'não recupera'}</div>
        </ModalProjeto>)}
      {modal === 'encerrar' && alvo && (
        <ModalProjeto titulo="Encerrar cenário" subtitulo={alvo.nome} largura={520} onClose={() => setModal('')}
          rodape={<><span style={{ flex: 1 }} /><BotaoSec onClick={() => setModal('')}>Cancelar</BotaoSec><button type="button" style={{ ...botaoPri, background: '#A32D2D' }} onClick={encerrar}>Encerrar</button></>}>
          {erroModal && <div style={erroSt}>⚠ {erroModal}</div>}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Motivo (mínimo de 10 caracteres)
            <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} style={{ ...inp, textAlign: 'left', resize: 'vertical' }} /></label>
        </ModalProjeto>)}
    </div>
  );
}
