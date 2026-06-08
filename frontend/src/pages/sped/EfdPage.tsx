// src/pages/sped/EfdPage.tsx
import React, { useState } from 'react';
import { FiDownload, FiEye, FiCheckCircle, FiAlertCircle, FiFileText, FiInfo } from 'react-icons/fi';
import api from '../../services/api';

const fmtBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface PreviewData {
  totalLinhas: number;
  competencia: string;
  regime: string;
  incidencia: string;
  preview: string[];
}

export default function EfdPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno]           = useState(String(anoAtual));
  const [mes, setMes]           = useState(String(new Date().getMonth() + 1).padStart(2,'0'));
  const [regime, setRegime]     = useState('LUCRO_REAL');
  const [incidencia, setInc]    = useState('NAO_CUMULATIVO');
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState<PreviewData | null>(null);
  const [error, setError]       = useState('');
  const [showAll, setShowAll]   = useState(false);

  async function gerarPreview() {
    setLoading(true); setError(''); setPreview(null);
    try {
      const { data } = await api.get('/sped/efd-contribuicoes/preview', {
        params: { ano, mes, regime, incidencia },
      });
      setPreview(data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao gerar preview');
    } finally { setLoading(false); }
  }

  // ── Lote anual ────────────────────────────────────────────────────
  const [loadingLote, setLoadingLote] = useState(false);
  const [resultadosLote, setResultadosLote] = useState<{mes:string;linhas:number;status:string}[]>([]);

  async function gerarLote() {
    setLoadingLote(true); setResultadosLote([]); setError('');
    try {
      const token = localStorage.getItem('@ledgr:token');
      const r = await api.get('/sped/efd-contribuicoes/export-lote', {
        params: { ano, regime, incidencia },
        responseType: 'blob',
      });
      const resultados = JSON.parse(r.headers['x-efd-resultados'] || '[]');
      setResultadosLote(resultados);
      const url  = URL.createObjectURL(new Blob([r.data], { type: 'application/zip' }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `EFD_${ano}_${regime === 'LUCRO_REAL' ? 'LR' : 'LP'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao gerar lote');
    } finally { setLoadingLote(false); }
  }

  async function downloadEfd() {
    setLoading(true);
    try {
      const token = localStorage.getItem('@ledgr:token');
      const headers: any = { Authorization: 'Bearer ' + token };
      // Pegar company do contexto via api instance
      const r = await api.get('/sped/efd-contribuicoes/export', {
        params: { ano, mes, regime, incidencia },
        responseType: 'blob',
      });
      // Nome padrao: EFD_jan25_17970759
      const mesNome = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(mes)-1];
      const anoShort = ano.slice(-2);
      const cnpjRaiz = (r.headers['x-company-cnpj'] || '').replace(/\D/g,'').slice(0,8) || '00000000';
      const filename = `EFD_${mesNome}${anoShort}_${cnpjRaiz}.txt`;
      const blob = new Blob([r.data], { type: 'text/plain;charset=latin1' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao gerar EFD');
    } finally { setLoading(false); }
  }

  const linhasVisiveis = preview ? (showAll ? preview.preview : preview.preview.slice(0, 30)) : [];

  // Classificar linhas por bloco para colorir
  const blocoColor = (l: string) => {
    if (l.startsWith('|0')) return '#1D4ED8';
    if (l.startsWith('|A') || l.startsWith('|C') || l.startsWith('|D')) return '#64748B';
    if (l.startsWith('|F')) return '#059669';
    if (l.startsWith('|M')) return '#7C3AED';
    if (l.startsWith('|1')) return '#EA580C';
    if (l.startsWith('|9')) return '#DC2626';
    return '#1E293B';
  };

  return (
    <div className="space-y-4 p-4" style={{ fontFamily:'var(--font-sans,system-ui)', fontSize:14 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#7C3AED', background:'#F5F3FF', padding:'2px 8px', borderRadius:4 }}>SPED FISCAL</span>
            <h1 style={{ fontSize:20, fontWeight:500, margin:0 }}>EFD-Contribuições</h1>
          </div>
          <p style={{ fontSize:12, color:'#6B7280', margin:0 }}>
            Escrituração Fiscal Digital — PIS/COFINS · Leiaute 1.34
          </p>
        </div>
      </div>

      {/* Parametros */}
      <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:10, padding:'16px 20px' }}>
        <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', color:'#6B7280', letterSpacing:'.3px', marginBottom:12 }}>
          Parâmetros de Geração
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', display:'block', marginBottom:4 }}>Mês</label>
            <select value={mes} onChange={e=>setMes(e.target.value)}
              style={{ height:32, border:'0.5px solid #D1D5DB', borderRadius:6, padding:'0 10px', fontSize:13, background:'#fff' }}>
              {MESES.map((m,i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', display:'block', marginBottom:4 }}>Ano</label>
            <select value={ano} onChange={e=>setAno(e.target.value)}
              style={{ height:32, border:'0.5px solid #D1D5DB', borderRadius:6, padding:'0 10px', fontSize:13, background:'#fff' }}>
              {Array.from({length:5},(_,i)=>String(anoAtual-i)).map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', display:'block', marginBottom:4 }}>Regime</label>
            <select value={regime} onChange={e=>setRegime(e.target.value)}
              style={{ height:32, border:'0.5px solid #D1D5DB', borderRadius:6, padding:'0 10px', fontSize:13, background:'#fff' }}>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', display:'block', marginBottom:4 }}>Incidência</label>
            <select value={incidencia} onChange={e=>setInc(e.target.value)}
              style={{ height:32, border:'0.5px solid #D1D5DB', borderRadius:6, padding:'0 10px', fontSize:13, background:'#fff' }}>
              <option value="NAO_CUMULATIVO">Não-Cumulativo (LR)</option>
              <option value="CUMULATIVO">Cumulativo (LP)</option>
            </select>
          </div>
          <button onClick={gerarPreview} disabled={loading}
            style={{ height:32, border:'none', borderRadius:6, padding:'0 16px', fontSize:12, cursor:'pointer', background:'#7C3AED', color:'#fff', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <FiEye size={13}/> {loading ? 'Gerando...' : 'Pré-visualizar'}
          </button>
          <button onClick={gerarLote} disabled={loadingLote}
            style={{ height:32, border:'none', borderRadius:6, padding:'0 16px', fontSize:12, cursor:'pointer', background:'#059669', color:'#fff', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <FiDownload size={13}/> {loadingLote ? 'Gerando ZIP...' : `Lote ${ano} (12 meses)`}
          </button>
          {preview && (
            <button onClick={downloadEfd}
              style={{ height:32, border:'none', borderRadius:6, padding:'0 16px', fontSize:12, cursor:'pointer', background:'#111', color:'#fff', fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
              <FiDownload size={13}/> Gerar EFD
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div style={{ background:'#FEF2F2', border:'0.5px solid #FECACA', borderRadius:8, padding:'10px 14px', display:'flex', gap:8, alignItems:'center', color:'#DC2626', fontSize:13 }}>
          <FiAlertCircle size={14}/> {error}
        </div>
      )}

      {/* Resultados lote */}
      {resultadosLote.length > 0 && (
        <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'#F8FAFC', borderBottom:'0.5px solid #E5E7EB', fontSize:12, fontWeight:600, color:'#374151' }}>
            Lote {ano} — {resultadosLote.filter(r=>r.status==='OK').length}/12 meses gerados
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Competência','Linhas','Status'].map(h=>(
                  <th key={h} style={{ padding:'8px 16px', textAlign:'left', color:'#6B7280', fontWeight:500, borderBottom:'0.5px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultadosLote.map((r,i)=>(
                <tr key={i} style={{ borderBottom:'0.5px solid #F3F4F6' }}>
                  <td style={{ padding:'7px 16px', fontWeight:500 }}>{r.mes}</td>
                  <td style={{ padding:'7px 16px', color:'#6B7280' }}>{r.linhas}</td>
                  <td style={{ padding:'7px 16px' }}>
                    <span style={{ background: r.status==='OK' ? '#D1FAE5' : '#FEE2E2', color: r.status==='OK' ? '#065F46' : '#DC2626', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600 }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <>
          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
            {[
              { label:'Total de Linhas', value:preview.totalLinhas, color:'#1D4ED8' },
              { label:'Competência',     value:preview.competencia, color:'#059669' },
              { label:'Regime',          value:preview.regime === 'LUCRO_REAL' ? 'Lucro Real' : 'Lucro Presumido', color:'#7C3AED' },
              { label:'Incidência',      value:preview.incidencia === 'NAO_CUMULATIVO' ? 'Não-Cumulativo' : 'Cumulativo', color:'#EA580C' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:8, padding:'12px 14px' }}>
                <div style={{ fontSize:10, textTransform:'uppercase', color:'#6B7280', marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:16, fontWeight:600, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Legenda blocos */}
          <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:8, padding:'10px 14px', display:'flex', gap:16, flexWrap:'wrap' }}>
            {[
              { bloco:'Bloco 0', cor:'#1D4ED8', desc:'Abertura/Identificação' },
              { bloco:'Bloco F', cor:'#059669', desc:'Demais Documentos (Receitas)' },
              { bloco:'Bloco M', cor:'#7C3AED', desc:'Apuração PIS/COFINS' },
              { bloco:'Bloco 1', cor:'#EA580C', desc:'Complemento' },
              { bloco:'Bloco 9', cor:'#DC2626', desc:'Encerramento' },
            ].map(b => (
              <div key={b.bloco} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:b.cor }}/>
                <span style={{ fontWeight:600, color:b.cor }}>{b.bloco}</span>
                <span style={{ color:'#6B7280' }}>{b.desc}</span>
              </div>
            ))}
          </div>

          {/* Linhas do arquivo */}
          <div style={{ background:'#F8FAFC', border:'0.5px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F1F5F9' }}>
              <span style={{ fontSize:12, color:'#475569', fontFamily:'monospace' }}>
                EFD_CONTRIB_{String(mes).padStart(2,'0')}{ano}.txt — {preview.totalLinhas} registros
              </span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'#64748B' }}>
                  {showAll ? preview.preview.length : Math.min(30,preview.preview.length)} de {preview.preview.length} linhas
                </span>
                {preview.preview.length > 30 && (
                  <button onClick={()=>setShowAll(!showAll)}
                    style={{ fontSize:11, color:'#7C3AED', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                    {showAll ? 'Ver menos' : 'Ver todas'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding:'12px 16px', maxHeight:480, overflowY:'auto', background:'#fff' }}>
              {linhasVisiveis.map((l,i) => (
                <div key={i} style={{ fontFamily:'monospace', fontSize:11, lineHeight:'1.8', color: blocoColor(l) }}>
                  <span style={{ color:'#CBD5E1', marginRight:12, userSelect:'none', fontWeight:400 }}>{String(i+1).padStart(3,'0')}</span>
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div style={{ background:'#EFF6FF', border:'0.5px solid #BFDBFE', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#1D4ED8', display:'flex', gap:8 }}>
            <FiInfo size={14} style={{ marginTop:1, flexShrink:0 }}/>
            <span>
              Arquivo gerado com base nos lançamentos contábeis e apuração de impostos do período.
              Verifique os valores antes de transmitir ao SPED.
              Códigos de receita: PIS 6912 (não-cumulativo) / 8109 (cumulativo) · COFINS 5856 / 2172.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
