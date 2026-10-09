// frontend/src/pages/projects/workspace/SimuladorRmProjeto.tsx
// Simulador do spread RM (08-09/10/2026): cenarios da assuncao da divida pela REAL MOUCHAO (aditivo em negociacao).
// Dois modos: Simplificado (espelha a planilha Simulador_Spread_RM.xlsx) e Detalhado (moeda com variacao cambial,
// atualizacao e juros configuraveis, compensacao de prejuizo, graficos). Calculo na tela pelo saldo da divida;
// dados reais (PEPS) de /simulador-rm/base; cenarios em proj_simulacoes_rm (imutaveis). Nada vai para a contabilidade.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, fmtBRL, fmtData, PROJ } from './projetoTema';
import { ModalProjeto, BotaoSec, erroApi } from './ModalProjeto';

const ANOS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
const PADRAO = {
  modo: 'simplificado', pref: 25, res: 5, descMed: 20, descSh: 20, ant: 10, taxa: 12, quota: 1.0606, totBP: 376200000, perfil: 'linear',
  moeda: 'BRL', dividaEur: 8748947.11, cambio0: 6.22, varCambio: 0, atual: 0, juros: 0, compensaPrejuizo: 1,
};
const PASSIVOS_PADRAO = ['Impostos e parcelamentos', 'Acordos e verbas trabalhistas', 'Reembolsos e bloqueios judiciais'];
const CORES: Record<string, string> = { ant: '#2a78d6', desc: '#eb6834', pref: '#1baf7a', res: '#c98500' };
const COMP: [string, string][] = [['ant', 'Antecipação sobre aportes'], ['desc', 'Desconto compartilhado'], ['pref', 'Retorno preferencial'], ['res', 'Participação residual']];

type Params = typeof PADRAO;
type Linha = { ano: number; aportes: number; pagos: number; resultado: number; real?: boolean };
type Col = { k: string; rot: string; soma?: boolean; f: (o: any) => string };

const inp: React.CSSProperties = { width: '100%', padding: '5px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: '#fff' };
const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14 };
const secao: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 6px' };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const fmtPct = (v: number, d = 1) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const fmtMi = (v: number) => `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
const fmtNum = (v: number, d = 4) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

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

// Saldo da divida na moeda escolhida: corrigido por atualizacao e juros a partir de 2026 e convertido pelo cambio do ano.
// Ordem em cada ano: antecipacao, desconto, preferencial (abatem o saldo); com o saldo zerado, vale o residual.
function calcular(p: Params, linhas: Linha[], D: number) {
  const det = p.modo === 'detalhado';
  const eur = det && p.moeda === 'EUR';
  const pref = p.pref / 100, res = p.res / 100, dm = Math.min(Math.max(p.descMed, 0), 95) / 100, ds = p.descSh / 100, ant = p.ant / 100, tx = p.taxa / 100;
  const fator = det ? (1 + p.atual / 100) * (1 + p.juros / 100) : 1;
  const compensa = det && !!p.compensaPrejuizo;
  const divida0 = eur ? p.dividaEur * p.cambio0 : D;
  let saldo = eur ? p.dividaEur : D;
  let cambioAnt = eur ? p.cambio0 : 1;
  let acum = 0, carry = 0, anoRec = 0, encAcum = 0;
  const out: any[] = [];
  for (const r of linhas) {
    const cambio = eur ? p.cambio0 * Math.pow(1 + p.varCambio / 100, Math.max(0, r.ano - 2025)) : 1;
    const saldoAntes = saldo * cambioAnt;
    if (r.ano > 2025) saldo = saldo * fator;
    const saldoIni = saldo * cambio;
    const encargos = saldoIni - saldoAntes; encAcum += encargos;
    let rem = Math.max(0, saldoIni);
    const a = Math.min(ant * r.aportes, rem); rem -= a;
    const descontoTotal = (r.pagos * dm) / (1 - dm);
    const d = Math.min(ds * descontoTotal, rem); rem -= d;
    let Rb = 0;
    if (r.resultado < 0) { if (compensa) carry += -r.resultado; }
    else { const u = compensa ? Math.min(carry, r.resultado) : 0; carry -= u; Rb = r.resultado - u; }
    let pf = 0, rs = 0;
    if (rem > 0.005 && pref > 0) { const full = pref * Rb; if (full <= rem) pf = full; else { pf = rem; rs = res * Math.max(0, Rb - rem / pref); } }
    else rs = res * Rb;
    rem = Math.max(0, rem - pf);
    if (!anoRec && saldoIni > 0.005 && rem <= 0.005) anoRec = r.ano;
    saldo = cambio > 0 ? rem / cambio : 0;
    cambioAnt = cambio;
    const tot = a + d + pf + rs; acum += tot;
    const t = Math.max(0.08, r.ano + 0.5 - (2025 + 10 / 12));
    out.push({ ano: r.ano, cambio, saldoIni, encargos, ant: a, desc: d, descontoTotal, pref: pf, res: rs, tot, acum, alvo: divida0 + encAcum, saldoFim: rem, Rb, vp: tot / Math.pow(1 + tx, t) });
  }
  const S = (k: string) => out.reduce((s, o) => s + o[k], 0);
  const tot = S('tot'), vp = S('vp'), somaRb = S('Rb');
  const custo = somaRb > 0 ? (S('pref') + S('res')) / somaRb : 0;
  return { out, divida: divida0, tot, vp, spread: tot - divida0, spreadVp: vp - divida0, anoRec, custo, quota: custo < 1 ? p.quota / (1 - custo) : 0,
    ant: S('ant'), desc: S('desc'), pref: S('pref'), res: S('res'), encargos: S('encargos'), foraResultado: S('ant') + S('desc'),
    saldoFinal: out.length ? out[out.length - 1].saldoFim : divida0, alvoFinal: out.length ? out[out.length - 1].alvo : divida0 };
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
  const tk = marcas(Math.max(m.out[n - 1].acum, m.alvoFinal, 1) * 1.05); const top = tk[tk.length - 1];
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
        <g key={o.ano}><title>{`${o.ano}\nAcumulado: ${fmtBRL(o.acum)}\nDívida com encargos: ${fmtBRL(o.alvo)}\nSaldo no fim do ano: ${fmtBRL(o.saldoFim)}`}</title>
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
  const det = p.modo === 'detalhado';
  const eur = det && p.moeda === 'EUR';
  const m = useMemo(() => calcular(p, linhas, D), [p, linhas, D]);
  const temEnc = det && Math.abs(m.encargos) > 0.005;
  const naturezas = useMemo(() => { const s = new Set<string>(); for (const a of base?.anos || []) for (const n of a.porNatureza || []) s.add(n.natureza); return [...s]; }, [base]);
  const set = (k: keyof Params) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const editar = (i: number, k: 'aportes' | 'pagos' | 'resultado', v: number) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const resultadoAtual = () => Object.fromEntries(linhas.map((l) => [l.ano, l.resultado])) as Record<number, number>;
  const alternarPassivo = (n: string) => {
    const novo = passivos.includes(n) ? passivos.filter((x) => x !== n) : [...passivos, n];
    setPassivos(novo); const rl = reais(base, novo);
    setLinhas((ls) => ls.map((l) => (l.real ? { ...l, pagos: Math.round((rl[l.ano]?.pagos || 0) * 100) / 100 } : l)));
  };
  const resumoDe = (x: any) => ({ tot: x.tot, vp: x.vp, spread: x.spread, spreadVp: x.spreadVp, anoRec: x.anoRec, custo: x.custo, quota: x.quota, foraResultado: x.foraResultado,
    ant: x.ant, desc: x.desc, pref: x.pref, res: x.res, divida: x.divida, encargos: x.encargos, saldoFinal: x.saldoFinal });

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
  const paramsDe = (c: any) => {
    const q: any = { ...PADRAO, ...(c?.parametros || {}) };
    if (c?.parametros && c.parametros.corr !== undefined && c.parametros.atual === undefined) { q.atual = Number(c.parametros.corr) || 0; if (q.atual) q.modo = 'detalhado'; }
    if (c?.parametros && c.parametros.modo === undefined && !q.atual) q.modo = 'detalhado';
    delete q.passivos; delete q.dataBase; delete q.corr;
    return q as Params;
  };
  const carregar = (c: any) => {
    setP(paramsDe(c)); setPassivos(c.parametros?.passivos || PASSIVOS_PADRAO);
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
    ['Ano de recuperação', (r) => (r.anoRec ? String(r.anoRec) : 'não recupera')], ['Custo aos cotistas', (r) => fmtPct(r.custo || 0)], ['Novo % por quota', (r) => `${fmtNum(r.quota)}%`],
    ['Fora do resultado', (r) => fmtBRL(r.foraResultado || 0)], ['Encargos sobre a dívida', (r) => fmtBRL(r.encargos || 0)]];
  const PARAMS_COMP: [string, (q: any) => string][] = [
    ['Modo', (q) => (q.modo === 'detalhado' ? 'Detalhado' : 'Simplificado')], ['Preferencial / residual', (q) => `${q.pref}% / ${q.res}%`],
    ['Desconto médio / parte à RM', (q) => `${q.descMed}% / ${q.descSh}%`], ['Antecipação', (q) => `${q.ant}%`],
    ['Moeda da dívida', (q) => (q.modo === 'detalhado' && q.moeda === 'EUR' ? `€ a ${fmtNum(q.cambio0)}, ${q.varCambio}% a.a.` : 'R$ fixa')],
    ['Atualização / juros', (q) => (q.modo === 'detalhado' ? `${q.atual}% / ${q.juros}% a.a.` : 'sem')], ['Taxa do VP', (q) => `${q.taxa}% a.a.`], ['Resultado do BP', (q) => fmtBRL(q.totBP)]];

  const cols: Col[] = [{ k: 'saldoIni', rot: 'Saldo da dívida no início', f: (o) => fmtBRL(o.saldoIni) }];
  if (eur) cols.push({ k: 'cambio', rot: 'Câmbio (R$/€)', f: (o) => fmtNum(o.cambio) });
  if (temEnc) cols.push({ k: 'encargos', rot: 'Encargos e variação do ano', soma: true, f: (o) => fmtBRL(o.encargos) });
  cols.push({ k: 'ant', rot: 'Antecipação', soma: true, f: (o) => fmtBRL(o.ant) }, { k: 'desc', rot: 'Desconto à RM', soma: true, f: (o) => fmtBRL(o.desc) },
    { k: 'pref', rot: 'Preferencial', soma: true, f: (o) => fmtBRL(o.pref) }, { k: 'res', rot: 'Residual', soma: true, f: (o) => fmtBRL(o.res) },
    { k: 'tot', rot: 'Total à RM', soma: true, f: (o) => fmtBRL(o.tot) }, { k: 'acum', rot: 'Acumulado', f: (o) => fmtBRL(o.acum) }, { k: 'vp', rot: 'Valor presente', soma: true, f: (o) => fmtBRL(o.vp) });
  const abaSt = (on: boolean): React.CSSProperties => ({ padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${PROJ}`, background: on ? PROJ : '#fff', color: on ? '#fff' : PROJ });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0F2747' }}>Simulador do spread RM</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Assunção da dívida pela REAL MOUCHÃO em {fmtData(base?.dataConfissao || '2025-10-31')} · aditivo em negociação · dados reais do LEDGR até {base?.ate ? fmtData(base.ate) : '...'} · nada é gravado na contabilidade
          </div>
        </div>
        <div style={{ display: 'flex' }} role="tablist" aria-label="Modo do simulador">
          <button type="button" role="tab" aria-selected={!det} style={{ ...abaSt(!det), borderRadius: '6px 0 0 6px' }} onClick={() => setP((x) => ({ ...x, modo: 'simplificado' }))}>Simplificado</button>
          <button type="button" role="tab" aria-selected={det} style={{ ...abaSt(det), borderRadius: '0 6px 6px 0', borderLeft: 'none' }} onClick={() => setP((x) => ({ ...x, modo: 'detalhado' }))}>Detalhado</button>
        </div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {aviso && <div style={{ fontSize: 12, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '6px 12px', display: 'flex' }}><span style={{ flex: 1 }}>{aviso}</span><span style={{ cursor: 'pointer' }} onClick={() => setAviso('')}>×</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div style={painel}>
          <div style={{ fontWeight: 700, color: '#0F2747' }}>Parâmetros do aditivo</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            {eur ? <>Dívida de € {fmtNum(p.dividaEur, 2)} (R$ {fmtNum(m.divida, 2)} a {fmtNum(p.cambio0)})</> : <>Dívida de {fmtBRL(D)}, fixa em reais{det && (p.atual || p.juros) ? ', com encargos' : ''}</>}
          </div>
          <div style={secao}>Participação no resultado (antes do CDE)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Retorno preferencial" sub="% do resultado, até recuperar" v={p.pref} step={0.5} on={set('pref')} />
            <Campo rot="Participação residual" sub="% do resultado, após recuperar" v={p.res} step={0.5} on={set('res')} />
          </div>
          <div style={secao}>Antecipação e reestruturação</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Antecipação sobre aportes" sub="% da parte do Âncora (PEPS)" v={p.ant} step={0.5} on={set('ant')} />
            <Campo rot="Desconto médio obtido" sub="% da face · hipótese" v={p.descMed} on={set('descMed')} />
            <Campo rot="Parte do desconto à RM" sub="%" v={p.descSh} step={5} on={set('descSh')} />
          </div>
          {det && (<>
            <div style={secao}>Dívida: moeda, atualização e juros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Moeda da dívida</span>
                <select value={p.moeda} onChange={(e) => setP((x) => ({ ...x, moeda: e.target.value }))} style={{ ...inp, textAlign: 'left' }}>
                  <option value="BRL">R$ fixa</option><option value="EUR">Euro (variação)</option></select>
              </label>
              {eur && (<>
                <Campo rot="Dívida em euros" sub="€" v={p.dividaEur} step={1000} on={set('dividaEur')} />
                <Campo rot="Câmbio inicial" sub="R$ por € em 31/10/2025" v={p.cambio0} step={0.01} on={set('cambio0')} />
                <Campo rot="Variação cambial" sub="% ao ano (negativo = real valoriza)" v={p.varCambio} step={0.5} on={set('varCambio')} />
              </>)}
              <Campo rot="Atualização monetária" sub="% ao ano sobre o saldo, desde 2026" v={p.atual} step={0.5} on={set('atual')} />
              <Campo rot="Juros" sub="% ao ano sobre o saldo, desde 2026" v={p.juros} step={0.5} on={set('juros')} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={!!p.compensaPrejuizo} onChange={(e) => setP((x) => ({ ...x, compensaPrejuizo: e.target.checked ? 1 : 0 }))} />
                Compensar prejuízo com os anos seguintes
              </label>
            </div>
          </>)}
          <div style={secao}>Avaliação</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Taxa do valor presente" sub="% ao ano · base 31/10/2025" v={p.taxa} step={0.5} on={set('taxa')} />
            <Campo rot="% por quota atual" sub="premissas v2" v={p.quota} step={0.0001} on={set('quota')} />
          </div>
          <div style={secao}>Resultado do projeto (BP)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Campo rot="Resultado total" sub="R$ · de 2027 a 2035" v={p.totBP} step={1000000} on={set('totBP')} />
            {det && (
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 104px', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#374151' }}>Perfil</span>
                <select value={p.perfil} onChange={(e) => setP((x) => ({ ...x, perfil: e.target.value }))} style={{ ...inp, textAlign: 'left' }}>
                  <option value="linear">Linear</option><option value="cresc">Crescente</option><option value="rampa">Rampa até 2030</option></select>
              </label>)}
            <button type="button" style={{ ...botaoPri, background: '#fff', color: PROJ, border: `1px solid ${PROJ}` }}
              onClick={() => { const d = distribuir(p.totBP, det ? p.perfil : 'linear'); setLinhas((ls) => ls.map((l) => ({ ...l, resultado: d[l.ano] || 0 }))); }}>Distribuir na tabela</button>
          </div>
          {det && (<>
            <div style={secao}>Naturezas que pagam passivo</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Geram desconto. A antecipação usa todos os pagamentos.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {naturezas.map((n) => { const on = passivos.includes(n); return (
                <button key={n} type="button" onClick={() => alternarPassivo(n)}
                  style={{ fontSize: 12, borderRadius: 14, padding: '3px 10px', cursor: 'pointer', border: `1px solid ${on ? PROJ : '#D1D5DB'}`, background: on ? '#E6F4F1' : '#fff', color: on ? PROJ : '#6B7280' }}>{on ? '✓ ' : ''}{n}</button>); })}
            </div>
          </>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={botaoPri} onClick={() => { setTexto(''); setErroModal(''); setModal('salvar'); }}>Salvar cenário</button>
            <BotaoSec onClick={() => { setP({ ...PADRAO, modo: p.modo }); setPassivos(PASSIVOS_PADRAO); if (base) setLinhas(montar(base, PASSIVOS_PADRAO, PADRAO)); setAviso('Proposta inicial restaurada.'); }}>Proposta inicial</BotaoSec>
            <BotaoSec onClick={() => { if (base) setLinhas(montar(base, passivos, p, resultadoAtual())); setAviso('Aportes e pagamentos reais recarregados; o resultado foi mantido.'); }}>Recarregar dados reais</BotaoSec>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {card('Total recebido', fmtBRL(m.tot), 'nominal')}
            {card('Spread nominal', sinal(m.spread), `sobre ${fmtBRL(m.divida)}`, corV(m.spread))}
            {card('Valor presente', fmtBRL(m.vp), `a ${p.taxa}% ao ano`)}
            {card('Spread em VP', sinal(m.spreadVp), 'VP menos a dívida', corV(m.spreadVp))}
            {card('Recuperação', m.anoRec ? String(m.anoRec) : 'Não recupera', 'ano em que o saldo zera', m.anoRec ? undefined : '#A32D2D')}
            {card('Custo aos cotistas', fmtPct(m.custo), 'do resultado vai à RM')}
            {card('Novo % por quota', `${fmtNum(m.quota)}%`, 'mantém a meta do Âncora')}
            {card('Fora do resultado', fmtBRL(m.foraResultado), 'antecipação + desconto')}
          </div>
          <div style={{ fontSize: 13, background: m.spreadVp >= 0 ? '#F0FDF4' : '#FFFBEB', border: `0.5px solid ${m.spreadVp >= 0 ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 8, padding: '8px 12px' }}>
            {m.anoRec
              ? <>A RM recupera a dívida em <b>{m.anoRec}</b> com spread nominal de <b>{sinal(m.spread)}</b>. Em valor presente o spread é <b>{sinal(m.spreadVp)}</b>: {m.spreadVp >= 0 ? 'a proposta remunera o prazo e o risco à taxa escolhida.' : 'a taxa escolhida ainda não é coberta; o que chega cedo (desconto, antecipação, preferencial) pesa mais que o residual.'}</>
              : <>Com estes parâmetros a RM não recupera a dívida até 2035; saldo final de <b>{fmtBRL(m.saldoFinal)}</b>.</>}
            {temEnc && <> Encargos e variação cambial incorporados à dívida no período: <b>{fmtBRL(m.encargos)}</b>.</>}
          </div>
          {det && (
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
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Total recebido acumulado contra a dívida{temEnc ? ' com encargos' : ''}</div>
                <Acumulado m={m} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: '#374151', marginTop: 4 }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#2a78d6', marginRight: 4, verticalAlign: -1 }} />Recebido acumulado</span>
                  <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #111827', marginRight: 4, verticalAlign: 3 }} />Dívida{temEnc ? ' com encargos' : ''}</span>
                </div>
              </div>
            </div>)}
        </div>
      </div>

      <div style={painel}>
        <div style={{ fontWeight: 700, color: '#0F2747' }}>Fluxo anual</div>
        <div style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 8px' }}>
          Colunas em verde são editáveis. Anos marcados como "real" vêm do LEDGR (2025 inclui ago a dez/2024); o ano corrente traz só o realizado até a data-base.
          {det ? (p.compensaPrejuizo ? ' Resultado negativo é compensado com os anos seguintes.' : ' Resultado negativo conta como zero.') : ' Modo simplificado: dívida fixa em reais, sem encargos; resultado negativo conta como zero.'}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead><tr>
              <th style={thSt}>Ano</th><th style={{ ...dir, background: '#E6F4F1' }}>Aportes aplicados (Âncora)</th><th style={{ ...dir, background: '#E6F4F1' }}>Passivos pagos</th><th style={{ ...dir, background: '#E6F4F1' }}>Resultado do projeto</th>
              {cols.map((c) => <th key={c.k} style={dir}>{c.rot}</th>)}
            </tr></thead>
            <tbody>{linhas.map((l, i) => { const o = m.out[i] || {}; return (
              <tr key={l.ano}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{l.ano}{l.real && <span style={{ marginLeft: 6, fontSize: 10, color: PROJ, border: `1px solid ${PROJ}`, borderRadius: 8, padding: '0 5px' }}>real</span>}</td>
                {(['aportes', 'pagos', 'resultado'] as const).map((k) => (
                  <td key={k} style={{ ...tdSt, background: '#F3FAF8', width: 150 }}><input type="number" step={1000} value={l[k]} onChange={(e) => editar(i, k, parseFloat(e.target.value) || 0)} style={inp} aria-label={`${k} ${l.ano}`} /></td>))}
                {cols.map((c) => <td key={c.k} style={{ ...num, fontWeight: c.k === 'tot' ? 700 : undefined }} title={c.k === 'desc' ? `Desconto total estimado: ${fmtBRL(o.descontoTotal || 0)}` : undefined}>{o.ano ? c.f(o) : ''}</td>)}
              </tr>); })}</tbody>
            <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}>
              <td style={{ ...tdSt, fontWeight: 700 }}>Total</td>
              {(['aportes', 'pagos', 'resultado'] as const).map((k) => <td key={k} style={{ ...num, fontWeight: 700 }}>{fmtBRL(linhas.reduce((s, l) => s + l[k], 0))}</td>)}
              {cols.map((c) => <td key={c.k} style={{ ...num, fontWeight: 700 }}>{c.soma ? fmtBRL(m.out.reduce((s: number, o: any) => s + o[c.k], 0)) : ''}</td>)}
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
            <thead><tr><th style={thSt}>Comparar</th><th style={thSt}>Nome</th><th style={thSt}>Modo</th><th style={thSt}>Salvo em</th><th style={dir}>Spread nominal</th><th style={dir}>Spread em VP</th><th style={dir}>Recuperação</th><th style={thSt}></th></tr></thead>
            <tbody>{cenarios.map((c) => (
              <tr key={c.id}>
                <td style={tdSt}><input type="checkbox" checked={comparar.includes(c.id)} disabled={!comparar.includes(c.id) && comparar.length >= 3}
                  onChange={() => setComparar((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} aria-label={`Comparar ${c.nome}`} /></td>
                <td style={{ ...tdSt, fontWeight: 600 }}>{c.nome}</td><td style={tdSt}>{paramsDe(c).modo === 'detalhado' ? 'Detalhado' : 'Simplificado'}</td><td style={tdSt}>{fmtData(String(c.criadoEm).slice(0, 10))}</td>
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
                {PARAMS_COMP.map(([rot, f]) => (<tr key={rot}><td style={{ ...tdSt, color: '#6B7280' }}>{rot}</td><td style={{ ...num, background: '#F3FAF8' }}>{f(p)}</td>{comparados.map((c) => <td key={c.id} style={num}>{f(paramsDe(c))}</td>)}</tr>))}
                {LINHAS_COMP.map(([rot, f]) => (<tr key={rot}><td style={{ ...tdSt, fontWeight: 600 }}>{rot}</td><td style={{ ...num, background: '#F3FAF8', fontWeight: 600 }}>{f(resumoDe(m))}</td>{comparados.map((c) => <td key={c.id} style={{ ...num, fontWeight: 600 }}>{f(c.resumo || {})}</td>)}</tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      {modal === 'salvar' && (
        <ModalProjeto titulo="Salvar cenário" subtitulo="Grava modo, parâmetros, fluxo anual e resultado; o cenário não pode ser alterado depois" largura={520} onClose={() => setModal('')}
          rodape={<><span style={{ flex: 1 }} /><BotaoSec onClick={() => setModal('')}>Cancelar</BotaoSec><button type="button" style={botaoPri} onClick={salvar}>Salvar</button></>}>
          {erroModal && <div style={erroSt}>⚠ {erroModal}</div>}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Nome do cenário
            <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={120} placeholder="Ex.: Proposta 2 - 25/5, desconto 20%" style={{ ...inp, textAlign: 'left' }} /></label>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>{det ? 'Detalhado' : 'Simplificado'} · spread nominal {sinal(m.spread)} · em VP {sinal(m.spreadVp)} · recuperação {m.anoRec || 'não recupera'}</div>
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
