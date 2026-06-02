// frontend/src/pages/finance/ApuracaoImpostosPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const fmtBR = (v: number | null | undefined) =>
  v == null ? 'R$ 0,00' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => (v * 100).toFixed(4).replace('.', ',') + '%';

const S = {
  page:  { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  card:  { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 } as React.CSSProperties,
  secTit:{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', letterSpacing: '.3px', marginBottom: 12 },
  grid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 } as React.CSSProperties,
  kpi:   { background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px' } as React.CSSProperties,
  kpiL:  { fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 4 },
  kpiV:  { fontSize: 17, fontWeight: 600 },
  row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' } as React.CSSProperties,
  label: { fontSize: 12, color: 'var(--color-text-secondary)' },
  value: { fontSize: 13, fontWeight: 500 },
  input: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn:   (c='#111') => ({ height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, cursor: 'pointer', background: c, color: '#fff', fontWeight: 500 } as React.CSSProperties),
  btnO:  { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  tab:   (a: boolean) => ({ height: 30, border: '0.5px solid ' + (a ? '#111' : 'var(--color-border-tertiary)'), borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: a ? '#111' : 'var(--color-background-primary)', color: a ? '#fff' : 'var(--color-text-secondary)' } as React.CSSProperties),
  badge: (c: string) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c + '22', color: c } as React.CSSProperties),
  th:    { background: 'var(--color-background-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, padding: '7px 12px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' },
  td:    { padding: '8px 12px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  tdR:   { padding: '8px 12px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'right' as const },
};

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function ApuracaoImpostosPage() {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const [ano, setAno] = useState(String(anoAtual));
  const [mes, setMes] = useState(String(mesAtual).padStart(2, '0'));
  const [aba, setAba] = useState<'pis'|'irpj'|'lalur'>('pis');
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ajustes editaveis
  const [receitaExcluida, setReceitaExcluida] = useState('0');
  const [creditosPis, setCreditosPis] = useState('0');
  const [creditosCofins, setCreditosCofins] = useState('0');
  const [adicoes, setAdicoes] = useState('0');
  const [exclusoes, setExclusoes] = useState('0');
  const [compensacoes, setCompensacoes] = useState('0');
  const [regime, setRegime] = useState('LUCRO_REAL');

  // Sugestoes LALUR
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [sugestoesLoading, setSugestoesLoading] = useState(false);
  const [sugestoesSelecionadas, setSugestoesSelecionadas] = useState<Set<number>>(new Set());

  async function carregarSugestoes() {
    setSugestoesLoading(true);
    try {
      const { data } = await api.get('/apuracao/lalur/' + comp + '/sugerir');
      setSugestoes(data.sugestoes ?? []);
      setSugestoesSelecionadas(new Set((data.sugestoes ?? []).map((_:any, i:number) => i)));
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao buscar sugestoes'); }
    finally { setSugestoesLoading(false); }
  }

  async function aplicarSugestoes() {
    const selecionadas = sugestoes.filter((_,i) => sugestoesSelecionadas.has(i));
    if (!selecionadas.length) return;
    setSaving(true);
    try {
      await api.post('/apuracao/lalur/' + comp + '/aplicar-sugestoes', { sugestoes: selecionadas });
      setSugestoes([]);
      setSugestoesSelecionadas(new Set());
      await load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao aplicar'); }
    finally { setSaving(false); }
  }

  // LALUR
  const [lalurDesc, setLalurDesc] = useState('');
  const [lalurValor, setLalurValor] = useState('');
  const [lalurTipo, setLalurTipo] = useState('ADICAO');
  const [lalurImposto, setLalurImposto] = useState('AMBOS');

  const comp = ano + '-' + mes;
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  async function openDarfPreview(tipo: string) {
    try {
      const { data } = await api.get('/apuracao/darf/' + comp + '/' + tipo + '/preview');
      setPreviewHtml(data.html ?? '');
      setPreviewTitle('DARF ' + (tipo === 'PIS_COFINS' ? 'PIS/COFINS' : 'IRPJ/CSLL') + ' - ' + comp);
      setShowPreview(true);
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao gerar DARF'); }
  }

  function downloadDarf(tipo: string) {
    const token = localStorage.getItem('@ledgr:token');
    const cid = (window as any).__companyId__ ?? '';
    window.open('http://localhost:3000/apuracao/darf/' + comp + '/' + tipo + '/pdf', '_blank');
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/apuracao/competencia/' + comp);
      setDados(data);
      if (data.pis) {
        setReceitaExcluida(String(data.pis.receitaExcluida ?? 0));
        setCreditosPis(String(data.pis.creditosPis ?? 0));
        setCreditosCofins(String(data.pis.creditosCofins ?? 0));
        setRegime(data.pis.regime ?? 'LUCRO_REAL');
      }
      if (data.irpj) {
        setAdicoes(String(data.irpj.adicoes ?? 0));
        setExclusoes(String(data.irpj.exclusoes ?? 0));
        setCompensacoes(String(data.irpj.compensacoes ?? 0));
      }
    } catch {} finally { setLoading(false); }
  }, [comp]);

  useEffect(() => { load(); }, [load]);

  async function calcularPis() {
    setSaving(true);
    try {
      await api.post('/apuracao/pis-cofins/' + comp, {
        regime, receitaExcluida: parseFloat(receitaExcluida)||0,
        creditosPis: parseFloat(creditosPis)||0,
        creditosCofins: parseFloat(creditosCofins)||0,
      });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    finally { setSaving(false); }
  }

  async function calcularIrpj() {
    setSaving(true);
    try {
      await api.post('/apuracao/irpj-csll/' + comp, {
        regime,
        adicoes: parseFloat(adicoes)||0,
        exclusoes: parseFloat(exclusoes)||0,
        compensacoes: parseFloat(compensacoes)||0,
      });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    finally { setSaving(false); }
  }

  async function addLalur() {
    if (!lalurDesc || !lalurValor) return;
    setSaving(true);
    try {
      await api.post('/apuracao/lalur/' + comp, {
        tipo: lalurTipo, imposto: lalurImposto,
        descricao: lalurDesc, valor: parseFloat(lalurValor.replace(',','.'))||0,
      });
      setLalurDesc(''); setLalurValor('');
      await load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    finally { setSaving(false); }
  }

  async function deleteLalur(id: string) {
    if (!confirm('Excluir este item do LALUR?')) return;
    await api.delete('/apuracao/lalur/' + comp + '/' + id);
    await load();
  }

  const receitas = dados?.receitas?.total ?? 0;
  const resultado = dados?.resultado?.resultado ?? 0;
  const pis = dados?.pis;
  const irpj = dados?.irpj;
  const lalur = dados?.lalur ?? [];

  const aliqPis    = regime === 'LUCRO_REAL' ? 0.0165 : 0.0065;
  const aliqCofins = regime === 'LUCRO_REAL' ? 0.076  : 0.03;
  const baseCalc   = receitas - (parseFloat(receitaExcluida)||0);
  const pisPrev    = Math.max(0, baseCalc * aliqPis - (parseFloat(creditosPis)||0));
  const cofinsPrev = Math.max(0, baseCalc * aliqCofins - (parseFloat(creditosCofins)||0));

  // Modal Preview
  const PreviewModal = showPreview ? (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #ddd' }}>
        <span style={{ fontWeight:600, fontSize:14 }}>{previewTitle}</span>
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ height:30, border:'none', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#004080', color:'#fff', fontWeight:500 }}
            onClick={() => window.open('http://localhost:3000/apuracao/darf/' + comp + '/' + (previewTitle.includes('PIS') ? 'PIS_COFINS' : 'IRPJ_CSLL') + '/pdf','_blank')}>
            Baixar PDF
          </button>
          <button style={{ height:30, border:'0.5px solid #ddd', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#fff' }}
            onClick={() => setShowPreview(false)}>Fechar</button>
        </div>
      </div>
      <iframe srcDoc={previewHtml} style={{ flex:1, border:'none', background:'#f5f5f5' }} />
    </div>
  ) : null;

  return (
    <>{PreviewModal}<div style={S.page}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#0369A1', background:'#EFF6FF', padding:'2px 8px', borderRadius:4 }}>FISCAL</span>
            <h1 style={{ fontSize:18, fontWeight:500, margin:0 }}>Apuração de Impostos</h1>
          </div>
          <p style={{ fontSize:12, color:'var(--color-text-secondary)', margin:0 }}>PIS · COFINS · IRPJ · CSLL · LALUR</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select style={{ ...S.input, width:80 }} value={mes} onChange={e => setMes(e.target.value)}>
            {MESES.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
          </select>
          <select style={{ ...S.input, width:90 }} value={ano} onChange={e => setAno(e.target.value)}>
            {Array.from({length:5},(_,i)=>String(anoAtual-i)).map(a=><option key={a}>{a}</option>)}
          </select>
          <select style={{ ...S.input, width:150 }} value={regime} onChange={e => setRegime(e.target.value)}>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
          </select>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--color-text-secondary)' }}>Carregando...</div> : (
        <>
          {/* KPIs */}
          <div style={S.grid}>
            <div style={S.kpi}>
              <div style={S.kpiL}>Receita Bruta</div>
              <div style={{ ...S.kpiV, color:'#15803D' }}>{fmtBR(receitas)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiL}>Resultado Contábil</div>
              <div style={{ ...S.kpiV, color: resultado >= 0 ? '#15803D' : '#DC2626' }}>{fmtBR(resultado)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiL}>PIS Devido</div>
              <div style={{ ...S.kpiV, color:'#EA580C' }}>{fmtBR(pis ? Number(pis.pisDevido) : pisPrev)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiL}>COFINS Devido</div>
              <div style={{ ...S.kpiV, color:'#EA580C' }}>{fmtBR(pis ? Number(pis.cofinsDevido) : cofinsPrev)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiL}>IRPJ Devido</div>
              <div style={{ ...S.kpiV, color:'#7C3AED' }}>{fmtBR(irpj ? Number(irpj.irpjDevido) : null)}</div>
            </div>
            <div style={S.kpi}>
              <div style={S.kpiL}>CSLL Devida</div>
              <div style={{ ...S.kpiV, color:'#7C3AED' }}>{fmtBR(irpj ? Number(irpj.csllDevida) : null)}</div>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            <button style={S.tab(aba==='pis')} onClick={()=>setAba('pis')}>PIS / COFINS</button>
            <button style={S.tab(aba==='irpj')} onClick={()=>setAba('irpj')}>IRPJ / CSLL</button>
            <button style={S.tab(aba==='lalur')} onClick={()=>setAba('lalur')}>LALUR / LACS</button>
          </div>

          {/* ABA PIS/COFINS */}
          {aba === 'pis' && (
            <div style={S.card}>
              <div style={S.secTit}>Apuração PIS / COFINS — {regime === 'LUCRO_REAL' ? 'Não-Cumulativo' : 'Cumulativo'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                <div>
                  <div style={S.row}><span style={S.label}>Receita Bruta</span><span style={{ ...S.value, color:'#15803D' }}>{fmtBR(receitas)}</span></div>
                  <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                    <span style={S.label}>(-) Receitas Excluídas</span>
                    <input style={S.input} type="text" value={receitaExcluida} onChange={e=>setReceitaExcluida(e.target.value)} placeholder="0,00"/>
                  </div>
                  <div style={S.row}><span style={S.label}>Base de Cálculo</span><span style={S.value}>{fmtBR(baseCalc)}</span></div>
                  <div style={S.row}><span style={S.label}>Alíq. PIS ({fmtPct(aliqPis)})</span><span style={S.value}>{fmtBR(baseCalc * aliqPis)}</span></div>
                  <div style={S.row}><span style={S.label}>Alíq. COFINS ({fmtPct(aliqCofins)})</span><span style={S.value}>{fmtBR(baseCalc * aliqCofins)}</span></div>
                </div>
                <div>
                  {regime === 'LUCRO_REAL' && <>
                    <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                      <span style={S.label}>(-) Créditos PIS</span>
                      <input style={S.input} type="text" value={creditosPis} onChange={e=>setCreditosPis(e.target.value)} placeholder="0,00"/>
                    </div>
                    <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                      <span style={S.label}>(-) Créditos COFINS</span>
                      <input style={S.input} type="text" value={creditosCofins} onChange={e=>setCreditosCofins(e.target.value)} placeholder="0,00"/>
                    </div>
                  </>}
                  <div style={{ ...S.row, borderTop:'2px solid var(--color-border-tertiary)', marginTop:8, paddingTop:12 }}>
                    <span style={{ ...S.label, fontWeight:600, color:'var(--color-text-primary)' }}>PIS a Recolher</span>
                    <span style={{ ...S.value, fontSize:16, color:'#EA580C' }}>{fmtBR(pisPrev)}</span>
                  </div>
                  <div style={S.row}>
                    <span style={{ ...S.label, fontWeight:600, color:'var(--color-text-primary)' }}>COFINS a Recolher</span>
                    <span style={{ ...S.value, fontSize:16, color:'#EA580C' }}>{fmtBR(cofinsPrev)}</span>
                  </div>
                  <div style={{ marginTop:16 }}>
                    <div style={{ display:'flex', gap:8, marginTop:16 }}>
                    <button style={S.btn()} onClick={calcularPis} disabled={saving}>
                      {saving ? 'Calculando...' : 'Calcular e Salvar'}
                    </button>
                    {pis && <button style={S.btn('#004080')} onClick={()=>openDarfPreview('PIS_COFINS')}>
                      Ver DARF PIS/COFINS
                    </button>}
                  </div>
                  <button style={{display:'none'}} onClick={calcularPis} disabled={saving}>
                      {saving ? 'Calculando...' : 'Calcular e Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA IRPJ/CSLL */}
          {aba === 'irpj' && (
            <div style={S.card}>
              <div style={S.secTit}>Apuração IRPJ / CSLL — {regime === 'LUCRO_REAL' ? 'Lucro Real' : 'Lucro Presumido'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                <div>
                  <div style={S.row}><span style={S.label}>Resultado Contábil</span><span style={{ ...S.value, color: resultado >= 0 ? '#15803D' : '#DC2626' }}>{fmtBR(resultado)}</span></div>
                  {regime === 'LUCRO_REAL' && <>
                    <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                      <span style={S.label}>(+) Adições LALUR</span>
                      <input style={S.input} type="text" value={adicoes} onChange={e=>setAdicoes(e.target.value)} placeholder="0,00"/>
                    </div>
                    <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                      <span style={S.label}>(-) Exclusões LALUR</span>
                      <input style={S.input} type="text" value={exclusoes} onChange={e=>setExclusoes(e.target.value)} placeholder="0,00"/>
                    </div>
                    <div style={S.row}><span style={S.label}>Lucro Real</span><span style={S.value}>{fmtBR(resultado + (parseFloat(adicoes)||0) - (parseFloat(exclusoes)||0))}</span></div>
                    <div style={{ ...S.row, alignItems:'flex-start', flexDirection:'column', gap:4 }}>
                      <span style={S.label}>(-) Compensações Prej. Acumulados</span>
                      <input style={S.input} type="text" value={compensacoes} onChange={e=>setCompensacoes(e.target.value)} placeholder="0,00"/>
                    </div>
                  </>}
                </div>
                <div>
                  {irpj ? <>
                    <div style={S.row}><span style={S.label}>Base IRPJ</span><span style={S.value}>{fmtBR(Number(irpj.baseIrpj))}</span></div>
                    <div style={S.row}><span style={S.label}>IRPJ 15%</span><span style={S.value}>{fmtBR(Number(irpj.baseIrpj) * 0.15)}</span></div>
                    <div style={S.row}><span style={S.label}>Adicional 10%</span><span style={S.value}>{fmtBR(Number(irpj.adicionalIrpj))}</span></div>
                    <div style={{ ...S.row, borderTop:'2px solid var(--color-border-tertiary)', marginTop:8, paddingTop:12 }}>
                      <span style={{ ...S.label, fontWeight:600, color:'var(--color-text-primary)' }}>IRPJ Devido</span>
                      <span style={{ ...S.value, fontSize:16, color:'#7C3AED' }}>{fmtBR(Number(irpj.irpjDevido))}</span>
                    </div>
                    <div style={S.row}>
                      <span style={{ ...S.label, fontWeight:600, color:'var(--color-text-primary)' }}>CSLL Devida (9%)</span>
                      <span style={{ ...S.value, fontSize:16, color:'#7C3AED' }}>{fmtBR(Number(irpj.csllDevida))}</span>
                    </div>
                  </> : <div style={{ color:'var(--color-text-secondary)', fontSize:13, padding:16 }}>Clique em "Calcular" para apurar.</div>}
                  <div style={{ display:'flex', gap:8, marginTop:16 }}>
                    <button style={S.btn()} onClick={calcularIrpj} disabled={saving}>
                      {saving ? 'Calculando...' : 'Calcular e Salvar'}
                    </button>
                    {irpj && <button style={S.btn('#004080')} onClick={()=>openDarfPreview('IRPJ_CSLL')}>Ver DARF IRPJ/CSLL</button>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA LALUR */}
          {aba === 'lalur' && (
            <div>
              {/* Painel Sugestoes Automaticas */}
              <div style={S.card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={S.secTit}>Sugestões Automáticas — Contas Não Dedutíveis</div>
                  <button style={S.btn('#7C3AED')} onClick={carregarSugestoes} disabled={sugestoesLoading}>
                    {sugestoesLoading ? 'Buscando...' : '⚡ Gerar Sugestões'}
                  </button>
                </div>
                {sugestoes.length === 0 && !sugestoesLoading && (
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)', padding:'12px 0' }}>
                    Clique em "Gerar Sugestões" para calcular adições/exclusões com base nas contas configuradas como não dedutíveis.
                  </div>
                )}
                {sugestoes.length > 0 && (
                  <>
                    <div style={{ overflowX:'auto', border:'0.5px solid var(--color-border-tertiary)', borderRadius:8, marginBottom:12 }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead><tr>
                          <th style={{ ...S.th, width:32 }}>
                            <input type="checkbox"
                              checked={sugestoesSelecionadas.size === sugestoes.length}
                              onChange={e => setSugestoesSelecionadas(e.target.checked ? new Set(sugestoes.map((_,i)=>i)) : new Set())} />
                          </th>
                          <th style={S.th}>Conta</th>
                          <th style={S.th}>Dedutibilidade</th>
                          <th style={{ ...S.th, textAlign:'right' as const }}>Saldo Período</th>
                          <th style={{ ...S.th, textAlign:'right' as const }}>% Não Dedutível</th>
                          <th style={{ ...S.th, textAlign:'right' as const }}>Valor Ajuste</th>
                          <th style={S.th}>Tipo</th>
                          <th style={S.th}>Descrição</th>
                        </tr></thead>
                        <tbody>
                          {sugestoes.map((s: any, i: number) => (
                            <tr key={i} style={{ background: sugestoesSelecionadas.has(i) ? '#F5F3FF' : 'transparent' }}>
                              <td style={S.td}>
                                <input type="checkbox" checked={sugestoesSelecionadas.has(i)}
                                  onChange={e => {
                                    const ns = new Set(sugestoesSelecionadas);
                                    e.target.checked ? ns.add(i) : ns.delete(i);
                                    setSugestoesSelecionadas(ns);
                                  }} />
                              </td>
                              <td style={S.td}>
                                <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--color-text-secondary)' }}>{s.code}</div>
                                <div style={{ fontSize:12 }}>{s.name}</div>
                              </td>
                              <td style={S.td}>
                                <span style={S.badge(s.dedutibilidade === 'NAO_DEDUTIVEL' ? '#DC2626' : '#EA580C')}>
                                  {s.dedutibilidade === 'NAO_DEDUTIVEL' ? 'Não Dedutível' : 'Parcial'}
                                </span>
                              </td>
                              <td style={S.tdR}>{fmtBR(s.saldoTotal)}</td>
                              <td style={{ ...S.tdR, color:'#DC2626', fontWeight:600 }}>{s.percNaoDedu}%</td>
                              <td style={{ ...S.tdR, color:'#7C3AED', fontWeight:600 }}>{fmtBR(s.valorAjuste)}</td>
                              <td style={S.td}>
                                <span style={S.badge(s.tipo === 'ADICAO' ? '#DC2626' : '#15803D')}>{s.tipo}</span>
                              </td>
                              <td style={{ ...S.td, fontSize:11 }}>
                                <input style={{ ...S.input, fontSize:11 }} value={s.descricao}
                                  onChange={e => setSugestoes(prev => prev.map((x,j) => j===i ? {...x, descricao:e.target.value} : x))} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr>
                          <td colSpan={5} style={{ ...S.td, fontWeight:600 }}>Total selecionado</td>
                          <td style={{ ...S.tdR, fontWeight:700, color:'#7C3AED', fontSize:14 }}>
                            {fmtBR(sugestoes.filter((_,i)=>sugestoesSelecionadas.has(i)).reduce((s:number,x:any)=>s+x.valorAjuste,0))}
                          </td>
                          <td colSpan={2} style={S.td}></td>
                        </tr></tfoot>
                      </table>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button style={S.btn()} onClick={aplicarSugestoes} disabled={saving || sugestoesSelecionadas.size === 0}>
                        {saving ? 'Aplicando...' : 'Aplicar Selecionados ao LALUR'}
                      </button>
                      <button style={S.btnO} onClick={() => { setSugestoes([]); setSugestoesSelecionadas(new Set()); }}>
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div style={S.card}>
                <div style={S.secTit}>Adicionar Item ao LALUR/LACS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 120px 120px auto', gap:10, alignItems:'flex-end' }}>
                  <div>
                    <label style={{ fontSize:10, color:'var(--color-text-secondary)', display:'block', marginBottom:4 }}>Descrição</label>
                    <input style={S.input} value={lalurDesc} onChange={e=>setLalurDesc(e.target.value)} placeholder="Ex: Multas não dedutíveis"/>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'var(--color-text-secondary)', display:'block', marginBottom:4 }}>Tipo</label>
                    <select style={S.input} value={lalurTipo} onChange={e=>setLalurTipo(e.target.value)}>
                      <option value="ADICAO">Adição</option>
                      <option value="EXCLUSAO">Exclusão</option>
                      <option value="COMPENSACAO">Compensação</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'var(--color-text-secondary)', display:'block', marginBottom:4 }}>Imposto</label>
                    <select style={S.input} value={lalurImposto} onChange={e=>setLalurImposto(e.target.value)}>
                      <option value="AMBOS">Ambos</option>
                      <option value="IRPJ">IRPJ</option>
                      <option value="CSLL">CSLL</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'var(--color-text-secondary)', display:'block', marginBottom:4 }}>Valor (R$)</label>
                    <input style={S.input} value={lalurValor} onChange={e=>setLalurValor(e.target.value)} placeholder="0,00"/>
                  </div>
                  <button style={S.btn()} onClick={addLalur} disabled={saving||!lalurDesc||!lalurValor}>+</button>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.secTit}>Itens LALUR/LACS — {comp}</div>
                {lalur.length === 0 ? <div style={{ textAlign:'center', padding:40, color:'var(--color-text-secondary)', fontSize:13 }}>Nenhum ajuste lançado.</div> : (
                  <div style={{ overflowX:'auto', border:'0.5px solid var(--color-border-tertiary)', borderRadius:8 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead><tr>
                        <th style={S.th}>Descrição</th>
                        <th style={S.th}>Tipo</th>
                        <th style={S.th}>Imposto</th>
                        <th style={{ ...S.th, textAlign:'right' as const }}>Valor</th>
                        <th style={S.th}></th>
                      </tr></thead>
                      <tbody>
                        {lalur.map((l: any) => (
                          <tr key={l.id}>
                            <td style={S.td}>{l.descricao}</td>
                            <td style={S.td}>
                              <span style={S.badge(l.tipo==='ADICAO'?'#DC2626':l.tipo==='EXCLUSAO'?'#15803D':'#7C3AED')}>
                                {l.tipo}
                              </span>
                            </td>
                            <td style={S.td}>{l.imposto}</td>
                            <td style={S.tdR}>{fmtBR(Number(l.valor))}</td>
                            <td style={S.td}>
                              <button onClick={()=>deleteLalur(l.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#DC2626', fontSize:12 }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} style={{ ...S.td, fontWeight:600 }}>Total Adições</td>
                          <td style={{ ...S.tdR, fontWeight:600, color:'#DC2626' }}>{fmtBR(lalur.filter((l:any)=>l.tipo==='ADICAO').reduce((s:number,l:any)=>s+Number(l.valor),0))}</td>
                          <td style={S.td}></td>
                        </tr>
                        <tr>
                          <td colSpan={3} style={{ ...S.td, fontWeight:600 }}>Total Exclusões</td>
                          <td style={{ ...S.tdR, fontWeight:600, color:'#15803D' }}>{fmtBR(lalur.filter((l:any)=>l.tipo==='EXCLUSAO').reduce((s:number,l:any)=>s+Number(l.valor),0))}</td>
                          <td style={S.td}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </> );
}