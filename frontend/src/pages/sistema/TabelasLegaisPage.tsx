// frontend/src/pages/sistema/TabelasLegaisPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface IrrfFaixa { ordem: number; limiteAte: number; aliquota: number; deducao: number; }
interface IrrfRedutor { ordem: number; limiteAte: number; redutor: number; }
interface IrrfAno { ano: number; vigenciaIni: string; faixas: IrrfFaixa[]; redutores: IrrfRedutor[]; }
interface InssFaixa { ordem: number; limiteAte: number; aliquota: number; deducao: number; }
interface InssAno { ano: number; teto: number; salMinimo: number; vigenciaIni: string; faixas: InssFaixa[]; }
interface SalMin { id: string; valor: number; vigenciaIni: string; vigenciaFim: string | null; lei: string | null; observacao: string | null; }

function calcIRPF(base: number, tab: IrrfAno | null): number {
  if (!tab) return 0;
  let ir = 0;
  for (const f of tab.faixas) {
    if (f.limiteAte >= 999998 || base <= f.limiteAte) {
      ir = base * Number(f.aliquota) - Number(f.deducao);
      break;
    }
  }
  ir = Math.max(0, ir);
  if (tab.redutores.length > 0) {
    for (const r of tab.redutores) {
      if (base <= Number(r.limiteAte)) {
        const red = Number(r.redutor);
        if (red >= 999998) return 0;
        return Math.max(0, ir - red);
      }
    }
    return ir;
  }
  return ir;
}

function calcINSS(salario: number, tab: InssAno | null): number {
  if (!tab) return 0;
  const sal = Math.min(salario, Number(tab.teto));
  let total = 0, prev = 0;
  for (const f of tab.faixas) {
    const lim = Number(f.limiteAte);
    const faixaVal = Math.min(sal, lim) - prev;
    if (faixaVal <= 0) break;
    total += faixaVal * Number(f.aliquota);
    prev = lim;
    if (sal <= lim) break;
  }
  return total;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
const fmtDate = (s: string) => { if (!s) return ''; const d = new Date(s.substring(0, 10) + 'T12:00:00'); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }); };
const parseBR = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;

export function TabelasLegaisPage() {
  const [aba, setAba] = useState<'irpf' | 'inss' | 'salmin'>('irpf');
  const [irrfData, setIrrfData] = useState<IrrfAno[]>([]);
  const [inssData, setInssData] = useState<InssAno[]>([]);
  const [salData, setSalData] = useState<SalMin[]>([]);
  const [loading, setLoading] = useState(false);
  const [irpfAno, setIrpfAno] = useState<number>(2026);
  const [inssAno, setInssAno] = useState<number>(2026);
  const [simSalario, setSimSalario] = useState('');
  const [simDep, setSimDep] = useState('0');
  const [simSimplif, setSimSimplif] = useState(true);
  const [simAno, setSimAno] = useState<number>(2026);

  // Modais edicao
  const [showEditInss, setShowEditInss] = useState(false);
  const [showEditIrrf, setShowEditIrrf] = useState(false);
  const [showEditSalMin, setShowEditSalMin] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  type InssFaixaForm = { limiteAte: string; aliquota: string };
  type IrrfFaixaForm = { limiteAte: string; aliquota: string; deducao: string };
  type IrrfRedutorForm = { limiteAte: string; redutor: string };

  const [editInssForm, setEditInssForm] = useState<{
    ano: number; vigenciaIni: string; teto: string; salMinimo: string; faixas: InssFaixaForm[];
  }>({ ano: 2026, vigenciaIni: '', teto: '', salMinimo: '', faixas: [{limiteAte:'',aliquota:'7.5'},{limiteAte:'',aliquota:'9'},{limiteAte:'',aliquota:'12'},{limiteAte:'',aliquota:'14'}] });

  const [editIrrfForm, setEditIrrfForm] = useState<{
    ano: number; vigenciaIni: string; faixas: IrrfFaixaForm[]; redutores: IrrfRedutorForm[];
  }>({ ano: 2026, vigenciaIni: '', faixas: [], redutores: [] });

  const [editSalMinForm, setEditSalMinForm] = useState({ id: '', valor: '', vigenciaIni: '', vigenciaFim: '', lei: '', observacao: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get('/tabelas-legais/irrf'),
        api.get('/tabelas-legais/inss'),
        api.get('/tabelas-legais/salario-minimo'),
      ]);
      setIrrfData(r1.data ?? []);
      setInssData(r2.data ?? []);
      setSalData(r3.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Helpers calculo simulador
  const irpfTab   = irrfData.find(d => d.ano === irpfAno) ?? null;
  const inssTab   = inssData.find(d => d.ano === inssAno) ?? null;
  const simIrpfTab = irrfData.find(d => d.ano === simAno) ?? null;
  const simInssTab = inssData.find(d => d.ano === simAno) ?? null;
  const sal = parseBR(simSalario);
  const dep = parseInt(simDep) || 0;
  const DEDUC_DEP = 189.59;
  const DESC_SIMPLIF = simAno >= 2026 ? 607.20 : 528.00;
  const inssVal = calcINSS(sal, simInssTab);
  const deducDep = dep * DEDUC_DEP;
  const baseIR = simSimplif ? Math.max(0, sal - inssVal - DESC_SIMPLIF) : Math.max(0, sal - inssVal - deducDep);
  const irVal = calcIRPF(baseIR, simIrpfTab);
  const liquido = sal - inssVal - irVal;

  // Helper: calcula deducao INSS automaticamente das faixas
  function calcDeducaoInss(faixas: InssFaixaForm[]): number[] {
    const d: number[] = [0];
    for (let i = 1; i < faixas.length; i++) {
      const lim = parseBR(faixas[i - 1].limiteAte);
      const a1 = parseBR(faixas[i - 1].aliquota) / 100;
      const a2 = parseBR(faixas[i].aliquota) / 100;
      d.push(Math.round((d[i - 1] + lim * (a2 - a1)) * 100) / 100);
    }
    return d;
  }

  // Abre modal INSS
  function openEditInss(ano: number) {
    const tab = inssData.find(d => d.ano === ano);
    if (tab) {
      setEditInssForm({
        ano,
        vigenciaIni: tab.vigenciaIni ? tab.vigenciaIni.substring(0, 10) : '',
        teto: String(Number(tab.teto) || ''),
        salMinimo: String(Number(tab.salMinimo) || ''),
        faixas: tab.faixas.map(f => ({ limiteAte: String(Number(f.limiteAte)), aliquota: String(Math.round(Number(f.aliquota) * 10000) / 100) })),
      });
    } else {
      setEditInssForm({ ano, vigenciaIni: ano + '-01-01', teto: '', salMinimo: '', faixas: [{limiteAte:'',aliquota:'7.5'},{limiteAte:'',aliquota:'9'},{limiteAte:'',aliquota:'12'},{limiteAte:'',aliquota:'14'}] });
    }
    setShowEditInss(true);
  }

  async function saveInss() {
    setSaving(true);
    try {
      const ded = calcDeducaoInss(editInssForm.faixas);
      await api.put('/tabelas-legais/inss/' + editInssForm.ano, {
        vigenciaIni: editInssForm.vigenciaIni,
        teto: parseBR(editInssForm.teto),
        salMinimo: parseBR(editInssForm.salMinimo),
        faixas: editInssForm.faixas.map((f, i) => ({ limiteAte: parseBR(f.limiteAte), aliquota: parseBR(f.aliquota) / 100, deducao: ded[i] })),
      });
      setShowEditInss(false);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao salvar INSS'); }
    finally { setSaving(false); }
  }

  // Abre modal IRRF
  function openEditIrrf(ano: number) {
    const tab = irrfData.find(d => d.ano === ano);
    if (tab) {
      setEditIrrfForm({
        ano,
        vigenciaIni: tab.vigenciaIni ? tab.vigenciaIni.substring(0, 10) : '',
        faixas: tab.faixas.map(f => ({ limiteAte: String(Number(f.limiteAte)), aliquota: String(Math.round(Number(f.aliquota) * 10000) / 100), deducao: String(Number(f.deducao)) })),
        redutores: tab.redutores.map(r => ({ limiteAte: String(Number(r.limiteAte)), redutor: Number(r.redutor) >= 999998 ? '' : String(Number(r.redutor)) })),
      });
    } else {
      setEditIrrfForm({ ano, vigenciaIni: ano + '-01-01', faixas: [{limiteAte:'999999',aliquota:'0',deducao:'0'}], redutores: [] });
    }
    setShowEditIrrf(true);
  }

  async function saveIrrf() {
    setSaving(true);
    try {
      await api.put('/tabelas-legais/irrf/' + editIrrfForm.ano, {
        vigenciaIni: editIrrfForm.vigenciaIni,
        faixas: editIrrfForm.faixas.map(f => ({ limiteAte: parseBR(f.limiteAte) || 999999, aliquota: parseBR(f.aliquota) / 100, deducao: parseBR(f.deducao) })),
        redutores: editIrrfForm.redutores.map(r => ({ limiteAte: parseBR(r.limiteAte) || 999999, redutor: r.redutor === '' ? null : parseBR(r.redutor) })),
      });
      setShowEditIrrf(false);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao salvar IRRF'); }
    finally { setSaving(false); }
  }

  // Abre modal Salario Minimo
  function openEditSalMin(id: string | null) {
    if (id) {
      const s = salData.find(x => x.id === id);
      if (s) setEditSalMinForm({ id, valor: String(Number(s.valor)), vigenciaIni: s.vigenciaIni.substring(0, 10), vigenciaFim: s.vigenciaFim ? s.vigenciaFim.substring(0, 10) : '', lei: s.lei ?? '', observacao: s.observacao ?? '' });
    } else {
      setEditSalMinForm({ id: '', valor: '', vigenciaIni: '', vigenciaFim: '', lei: '', observacao: '' });
    }
    setShowEditSalMin(id ?? 'new');
  }

  async function saveSalMin() {
    setSaving(true);
    try {
      await api.post('/tabelas-legais/salario-minimo', { valor: parseBR(editSalMinForm.valor), vigenciaIni: editSalMinForm.vigenciaIni, vigenciaFim: editSalMinForm.vigenciaFim || undefined, lei: editSalMinForm.lei || undefined, observacao: editSalMinForm.observacao || undefined });
      setShowEditSalMin(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao salvar'); }
    finally { setSaving(false); }
  }

  async function deleteSalMin(id: string) {
    if (!window.confirm('Excluir este registro de salario minimo?')) return;
    try { await api.delete('/tabelas-legais/salario-minimo/' + id); load(); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao excluir'); }
  }

  const anos = [...new Set([...irrfData.map(d => d.ano), ...inssData.map(d => d.ano)])].sort((a, b) => b - a);

  const S = {
    page:  { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
    badge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F9FAFB', color: '#374151' } as React.CSSProperties,
    card:  { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 16 } as React.CSSProperties,
    th:    { background: '#F9FAFB', color: '#6B7280', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 12px', textAlign: 'left' as const, borderBottom: '0.5px solid #E5E7EB' } as React.CSSProperties,
    thR:   { background: '#F9FAFB', color: '#6B7280', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 12px', textAlign: 'right' as const, borderBottom: '0.5px solid #E5E7EB' } as React.CSSProperties,
    td:    { padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 13 } as React.CSSProperties,
    tdR:   { padding: '8px 12px', textAlign: 'right' as const, borderBottom: '0.5px solid #E5E7EB', fontSize: 13 } as React.CSSProperties,
    input: { height: 32, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 9px', fontSize: 13, background: '#fff', width: '100%', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
    label: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 4 },
    tabBtn:  (active: boolean) => ({ height: 30, border: '0.5px solid ' + (active ? '#111' : '#E5E7EB'), borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: active ? '#111' : '#fff', color: active ? '#fff' : '#6B7280' } as React.CSSProperties),
    anoBtn:  (active: boolean) => ({ height: 26, border: '0.5px solid ' + (active ? '#2563EB' : '#E5E7EB'), borderRadius: 6, padding: '0 10px', fontSize: 11, cursor: 'pointer', background: active ? '#EFF6FF' : '#fff', color: active ? '#2563EB' : '#6B7280', fontWeight: active ? 600 : 400 } as React.CSSProperties),
    editBtn: { height: 26, border: '0.5px solid #0891B2', borderRadius: 6, padding: '0 10px', fontSize: 11, cursor: 'pointer', background: '#ECFEFF', color: '#0891B2', fontWeight: 600 } as React.CSSProperties,
    newBtn:  { height: 26, border: 'none', borderRadius: 6, padding: '0 12px', fontSize: 11, cursor: 'pointer', background: '#0891B2', color: '#fff', fontWeight: 600 } as React.CSSProperties,
  };

  // Estilos modal
  const ov  = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
  const mb  = (w = 600) => ({ background: '#fff', borderRadius: 14, width: w, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,.18)' });
  const mh  = { background: '#0891B2', borderRadius: '14px 14px 0 0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const mb2 = { padding: 20 };
  const mf  = { padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA', borderRadius: '0 0 14px 14px' };
  const inp = S.input;
  const lbl = S.label;
  const cancelBtn = { height: 32, border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '0 16px', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#374151' } as React.CSSProperties;
  const saveBtn   = { height: 32, border: 'none', borderRadius: 8, padding: '0 20px', fontSize: 13, cursor: 'pointer', background: '#0891B2', color: '#fff', fontWeight: 600 } as React.CSSProperties;
  const thinp     = { ...inp, width: '100%', height: 30, fontSize: 12, padding: '0 6px' };
  const thInputRO = { ...thinp, background: '#FFFBEB', color: '#92400E', fontWeight: 600 };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={S.badge}>\u2699 Sistema</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Tabelas Legais</span>
        {loading && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Carregando...</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={S.tabBtn(aba === 'irpf')}   onClick={() => setAba('irpf')}>Tabela IRPF</button>
        <button style={S.tabBtn(aba === 'inss')}   onClick={() => setAba('inss')}>Tabela INSS</button>
        <button style={S.tabBtn(aba === 'salmin')} onClick={() => setAba('salmin')}>Sal\u00e1rio M\u00ednimo</button>
      </div>

      {/* ─── IRPF ─── */}
      {aba === 'irpf' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {irrfData.map(d => <button key={d.ano} style={S.anoBtn(irpfAno === d.ano)} onClick={() => setIrpfAno(d.ano)}>{d.ano}</button>)}
            <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
              <button style={S.editBtn} onClick={() => openEditIrrf(irpfAno)}>\u270e Editar {irpfAno}</button>
              <button style={S.newBtn}  onClick={() => { setEditIrrfForm({ ano: new Date().getFullYear(), vigenciaIni: new Date().getFullYear()+'-01-01', faixas:[{limiteAte:'999999',aliquota:'0',deducao:'0'}], redutores:[] }); setShowEditIrrf(true); }}>+ Novo Ano</button>
            </div>
          </div>
          {irpfTab && (
            <>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Vig\u00eancia: {fmtDate(irpfTab.vigenciaIni)} em diante
              </div>
              <div style={S.card}>
                <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500 }}>Tabela Progressiva</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={S.th}>Base de C\u00e1lculo</th>
                    <th style={S.thR}>Al\u00edquota</th>
                    <th style={S.thR}>Parcela a Deduzir</th>
                  </tr></thead>
                  <tbody>
                    {irpfTab.faixas.map((f, i) => (
                      <tr key={i}>
                        <td style={S.td}>{f.limiteAte >= 999998 ? 'Acima de R$ ' + fmtBRL(irpfTab.faixas[i-1]?.limiteAte ?? 0) : 'At\u00e9 R$ ' + fmtBRL(f.limiteAte)}</td>
                        <td style={S.tdR}>{fmtPct(Number(f.aliquota)*100)}</td>
                        <td style={S.tdR}>R$ {fmtBRL(f.deducao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {irpfTab.redutores.length > 0 && (
                <div style={S.card}>
                  <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500 }}>Redutor Progressivo (Lei 15.270/2025)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={S.th}>Renda Bruta at\u00e9</th>
                      <th style={S.thR}>Desconto Simplificado</th>
                    </tr></thead>
                    <tbody>
                      {irpfTab.redutores.map((r, i) => (
                        <tr key={i}>
                          <td style={S.td}>{r.limiteAte >= 999998 ? 'Acima de R$ 7.350,00' : 'R$ ' + fmtBRL(r.limiteAte)}</td>
                          <td style={S.tdR}>{r.redutor >= 999998 ? 'Isento' : 'R$ ' + fmtBRL(r.redutor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <div style={{ ...S.card, padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Simulador de IRRF</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
              <div><span style={lbl}>Ano base</span><select value={simAno} onChange={e => setSimAno(Number(e.target.value))} style={{ ...S.input }}>{anos.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
              <div><span style={lbl}>Sal\u00e1rio Bruto (R$)</span><input value={simSalario} onChange={e => setSimSalario(e.target.value)} style={S.input} placeholder="Ex: 5.000,00" /></div>
              <div><span style={lbl}>Dependentes</span><input type="number" value={simDep} onChange={e => setSimDep(e.target.value)} style={S.input} min={0} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={simSimplif} onChange={e => setSimSimplif(e.target.checked)} />
                  Desconto Simplificado (R$ {fmtBRL(DESC_SIMPLIF)})
                </label>
              </div>
            </div>
            {sal > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                <div><div style={lbl}>INSS</div><div style={{ fontWeight: 600, color: '#DC2626' }}>R$ {fmtBRL(inssVal)}</div></div>
                <div><div style={lbl}>Base IRRF</div><div style={{ fontWeight: 600 }}>R$ {fmtBRL(baseIR)}</div></div>
                <div><div style={lbl}>IRRF</div><div style={{ fontWeight: 600, color: '#DC2626' }}>R$ {fmtBRL(irVal)}</div></div>
                <div><div style={lbl}>L\u00edquido</div><div style={{ fontWeight: 600, color: '#16A34A' }}>R$ {fmtBRL(liquido)}</div></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── INSS ─── */}
      {aba === 'inss' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {inssData.map(d => <button key={d.ano} style={S.anoBtn(inssAno === d.ano)} onClick={() => setInssAno(d.ano)}>{d.ano}</button>)}
            <div style={{ marginLeft: 8, display: 'flex', gap: 6 }}>
              <button style={S.editBtn} onClick={() => openEditInss(inssAno)}>\u270e Editar {inssAno}</button>
              <button style={S.newBtn}  onClick={() => { setEditInssForm({ ano: new Date().getFullYear(), vigenciaIni: new Date().getFullYear()+'-01-01', teto:'', salMinimo:'', faixas:[{limiteAte:'',aliquota:'7.5'},{limiteAte:'',aliquota:'9'},{limiteAte:'',aliquota:'12'},{limiteAte:'',aliquota:'14'}] }); setShowEditInss(true); }}>+ Novo Ano</button>
            </div>
          </div>
          {inssTab && (
            <>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Vig\u00eancia: {fmtDate(inssTab.vigenciaIni)} | Teto: R$ {fmtBRL(Number(inssTab.teto))} | Sal. M\u00ednimo: R$ {fmtBRL(Number(inssTab.salMinimo))}
              </div>
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={S.th}>Faixa Salarial</th>
                    <th style={S.thR}>Al\u00edquota</th>
                    <th style={S.thR}>Dedu\u00e7\u00e3o (simplif.)</th>
                  </tr></thead>
                  <tbody>
                    {inssTab.faixas.map((f, i) => (
                      <tr key={i}>
                        <td style={S.td}>{i === 0 ? 'At\u00e9 R$ ' : 'De R$ ' + fmtBRL(Number(inssTab.faixas[i-1]?.limiteAte ?? 0)) + ' at\u00e9 R$ '}{fmtBRL(Number(f.limiteAte))}</td>
                        <td style={S.tdR}>{fmtPct(Number(f.aliquota)*100)}</td>
                        <td style={S.tdR}>R$ {fmtBRL(Number(f.deducao))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Salario Minimo ─── */}
      {aba === 'salmin' && (
        <div style={S.card}>
          <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Hist\u00f3rico do Sal\u00e1rio M\u00ednimo Nacional</span>
            <button style={S.newBtn} onClick={() => openEditSalMin(null)}>+ Novo Registro</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={S.th}>Vig\u00eancia</th>
              <th style={S.thR}>Valor</th>
              <th style={S.th}>Lei / Decreto</th>
              <th style={S.th}>A\u00e7\u00f5es</th>
            </tr></thead>
            <tbody>
              {salData.map(s => (
                <tr key={s.id}>
                  <td style={S.td}>{fmtDate(s.vigenciaIni)}{s.vigenciaFim ? ' a ' + fmtDate(s.vigenciaFim) : ' em diante'}</td>
                  <td style={S.tdR}>R$ {fmtBRL(Number(s.valor))}</td>
                  <td style={S.td}>{s.lei ?? '\u2014'}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditSalMin(s.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '0.5px solid #0891B2', background: '#ECFEFF', color: '#0891B2', cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => deleteSalMin(s.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '0.5px solid #DC2626', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ MODAL INSS ═══ */}
      {showEditInss && (() => {
        const ded = calcDeducaoInss(editInssForm.faixas);
        return (
          <div style={ov}><div style={mb(660)}>
            <div style={mh}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Tabela INSS — Ano {editInssForm.ano}</span>
              <button onClick={() => setShowEditInss(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 16 }}>\u00d7</button>
            </div>
            <div style={mb2}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <span style={lbl}>Ano</span>
                  <input type="number" value={editInssForm.ano} onChange={e => setEditInssForm(f => ({...f, ano: parseInt(e.target.value)||f.ano}))} style={inp}/>
                </div>
                <div>
                  <span style={lbl}>Vig\u00eancia In\u00edcio</span>
                  <input type="date" value={editInssForm.vigenciaIni} onChange={e => setEditInssForm(f => ({...f, vigenciaIni: e.target.value}))} style={inp}/>
                </div>
                <div>
                  <span style={lbl}>Teto (R$)</span>
                  <input value={editInssForm.teto} onChange={e => setEditInssForm(f => ({...f, teto: e.target.value}))} style={inp} placeholder="Ex: 8475.55"/>
                </div>
                <div>
                  <span style={lbl}>Sal\u00e1rio M\u00ednimo (R$)</span>
                  <input value={editInssForm.salMinimo} onChange={e => setEditInssForm(f => ({...f, salMinimo: e.target.value}))} style={inp} placeholder="Ex: 1621.00"/>
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Faixas de Contribui\u00e7\u00e3o</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={{ ...S.th, width: 60 }}>Faixa</th>
                    <th style={S.th}>Limite At\u00e9 (R$)</th>
                    <th style={S.th}>Al\u00edquota (%)</th>
                    <th style={{ ...S.th, background: '#FFFBEB', color: '#92400E' }}>Dedu\u00e7\u00e3o (auto)</th>
                  </tr>
                </thead>
                <tbody>
                  {editInssForm.faixas.map((f, i) => (
                    <tr key={i}>
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: '#6B7280', fontSize: 12 }}>{i+1}</td>
                      <td style={S.td}><input value={f.limiteAte} onChange={e => setEditInssForm(fm => ({...fm, faixas: fm.faixas.map((x,j)=>j===i?{...x,limiteAte:e.target.value}:x)}))} style={thinp} placeholder="0.00"/></td>
                      <td style={S.td}><input value={f.aliquota} onChange={e => setEditInssForm(fm => ({...fm, faixas: fm.faixas.map((x,j)=>j===i?{...x,aliquota:e.target.value}:x)}))} style={thinp} placeholder="7.5"/></td>
                      <td style={{ ...S.td, background: '#FFFBEB' }}><input value={fmtBRL(ded[i])} readOnly style={{ ...thInputRO, textAlign: 'right' as const }}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                \u24d8 Dedu\u00e7\u00e3o calculada automaticamente a partir dos limites e al\u00edquotas.
              </div>
            </div>
            <div style={mf}>
              <button onClick={() => setShowEditInss(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={saveInss} disabled={saving} style={saveBtn}>{saving ? 'Salvando...' : 'Salvar Tabela INSS'}</button>
            </div>
          </div></div>
        );
      })()}

      {/* ═══ MODAL IRRF ═══ */}
      {showEditIrrf && (
        <div style={ov}><div style={mb(700)}>
          <div style={mh}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Tabela IRRF — Ano {editIrrfForm.ano}</span>
            <button onClick={() => setShowEditIrrf(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 16 }}>\u00d7</button>
          </div>
          <div style={mb2}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div>
                <span style={lbl}>Ano</span>
                <input type="number" value={editIrrfForm.ano} onChange={e => setEditIrrfForm(f=>({...f,ano:parseInt(e.target.value)||f.ano}))} style={inp}/>
              </div>
              <div>
                <span style={lbl}>Vig\u00eancia In\u00edcio</span>
                <input type="date" value={editIrrfForm.vigenciaIni} onChange={e => setEditIrrfForm(f=>({...f,vigenciaIni:e.target.value}))} style={inp}/>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Tabela Progressiva</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                <th style={S.th}>Limite At\u00e9 (R$) — 999999 = \u00faltima faixa</th>
                <th style={S.th}>Al\u00edquota (%)</th>
                <th style={S.th}>Dedu\u00e7\u00e3o (R$)</th>
                <th style={{ ...S.th, width: 40 }}></th>
              </tr></thead>
              <tbody>
                {editIrrfForm.faixas.map((f, i) => (
                  <tr key={i}>
                    <td style={S.td}><input value={f.limiteAte} onChange={e => setEditIrrfForm(fm=>({...fm,faixas:fm.faixas.map((x,j)=>j===i?{...x,limiteAte:e.target.value}:x)}))} style={thinp}/></td>
                    <td style={S.td}><input value={f.aliquota} onChange={e => setEditIrrfForm(fm=>({...fm,faixas:fm.faixas.map((x,j)=>j===i?{...x,aliquota:e.target.value}:x)}))} style={thinp}/></td>
                    <td style={S.td}><input value={f.deducao}  onChange={e => setEditIrrfForm(fm=>({...fm,faixas:fm.faixas.map((x,j)=>j===i?{...x,deducao:e.target.value}:x)}))}  style={thinp}/></td>
                    <td style={S.td}><button onClick={()=>setEditIrrfForm(fm=>({...fm,faixas:fm.faixas.filter((_,j)=>j!==i)}))} style={{fontSize:14,color:'#DC2626',background:'none',border:'none',cursor:'pointer'}}>\u00d7</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={()=>setEditIrrfForm(f=>({...f,faixas:[...f.faixas,{limiteAte:'999999',aliquota:'27.5',deducao:'0'}]}))} style={{ fontSize: 11, padding: '4px 10px', border: '0.5px solid #0891B2', borderRadius: 6, background: '#ECFEFF', color: '#0891B2', cursor: 'pointer', marginBottom: 20 }}>+ Adicionar Faixa</button>

            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Redutor Progressivo (Lei 15.270/2025) — em branco = sem redutor</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                <th style={S.th}>Renda Bruta At\u00e9 (R$)</th>
                <th style={S.th}>Dedu\u00e7\u00e3o (R$) — vazio = isento total</th>
                <th style={{ ...S.th, width: 40 }}></th>
              </tr></thead>
              <tbody>
                {editIrrfForm.redutores.map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}><input value={r.limiteAte} onChange={e=>setEditIrrfForm(fm=>({...fm,redutores:fm.redutores.map((x,j)=>j===i?{...x,limiteAte:e.target.value}:x)}))} style={thinp}/></td>
                    <td style={S.td}><input value={r.redutor}   onChange={e=>setEditIrrfForm(fm=>({...fm,redutores:fm.redutores.map((x,j)=>j===i?{...x,redutor:e.target.value}:x)}))}   style={thinp} placeholder="vazio = isento"/></td>
                    <td style={S.td}><button onClick={()=>setEditIrrfForm(fm=>({...fm,redutores:fm.redutores.filter((_,j)=>j!==i)}))} style={{fontSize:14,color:'#DC2626',background:'none',border:'none',cursor:'pointer'}}>\u00d7</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={()=>setEditIrrfForm(f=>({...f,redutores:[...f.redutores,{limiteAte:'',redutor:''}]}))} style={{ fontSize: 11, padding: '4px 10px', border: '0.5px solid #0891B2', borderRadius: 6, background: '#ECFEFF', color: '#0891B2', cursor: 'pointer' }}>+ Adicionar Faixa de Redutor</button>
          </div>
          <div style={mf}>
            <button onClick={() => setShowEditIrrf(false)} style={cancelBtn}>Cancelar</button>
            <button onClick={saveIrrf} disabled={saving} style={saveBtn}>{saving ? 'Salvando...' : 'Salvar Tabela IRRF'}</button>
          </div>
        </div></div>
      )}

      {/* ═══ MODAL SALARIO MINIMO ═══ */}
      {showEditSalMin && (
        <div style={ov}><div style={mb(480)}>
          <div style={mh}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{editSalMinForm.id ? 'Editar' : 'Novo'} Sal\u00e1rio M\u00ednimo</span>
            <button onClick={() => setShowEditSalMin(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 16 }}>\u00d7</button>
          </div>
          <div style={mb2}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={lbl}>Valor (R$) *</span>
                <input value={editSalMinForm.valor} onChange={e=>setEditSalMinForm(f=>({...f,valor:e.target.value}))} style={inp} placeholder="Ex: 1621.00"/>
              </div>
              <div>
                <span style={lbl}>Vig\u00eancia In\u00edcio *</span>
                <input type="date" value={editSalMinForm.vigenciaIni} onChange={e=>setEditSalMinForm(f=>({...f,vigenciaIni:e.target.value}))} style={inp}/>
              </div>
              <div>
                <span style={lbl}>Vig\u00eancia Fim (opcional)</span>
                <input type="date" value={editSalMinForm.vigenciaFim} onChange={e=>setEditSalMinForm(f=>({...f,vigenciaFim:e.target.value}))} style={inp}/>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={lbl}>Lei / Decreto</span>
                <input value={editSalMinForm.lei} onChange={e=>setEditSalMinForm(f=>({...f,lei:e.target.value}))} style={inp} placeholder="Ex: Lei 15.270/2025"/>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={lbl}>Observa\u00e7\u00e3o</span>
                <input value={editSalMinForm.observacao} onChange={e=>setEditSalMinForm(f=>({...f,observacao:e.target.value}))} style={inp}/>
              </div>
            </div>
          </div>
          <div style={mf}>
            <button onClick={() => setShowEditSalMin(null)} style={cancelBtn}>Cancelar</button>
            <button onClick={saveSalMin} disabled={saving||!editSalMinForm.valor||!editSalMinForm.vigenciaIni} style={{ ...saveBtn, opacity: (!editSalMinForm.valor||!editSalMinForm.vigenciaIni)?0.5:1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div></div>
      )}

    </div>
  );
}
