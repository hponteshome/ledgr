// frontend/src/pages/finance/FiscalIntegrationModal.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL  = (v:any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = (s:any) => s ? new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const AC = '#6C63FF';

interface Entry {
  accountId: string; accountCode: string; accountName: string;
  type: 'DEBIT'|'CREDIT'; value: number; label: string;
}
interface Preview {
  mode: 'PRESTADOR'|'TOMADOR';
  doc: {
    id:string; documentNumber:string; issuerName:string;
    grossAmount:number; netAmount:number; pisAmount:number;
    cofinsAmount:number; irAmount:number; inssAmount:number;
    csllAmount:number; issAmount:number; competenceMonth:string;
  };
  entries: Entry[];
  warnings: string[];
}
interface Props { docId: string; onClose: ()=>void; onSuccess: ()=>void; }

export const FiscalIntegrationModal: React.FC<Props> = ({ docId, onClose, onSuccess }) => {
  const [tab,      setTab]      = useState<'doc'|'entries'|'taxes'>('doc');
  const [preview,  setPreview]  = useState<Preview|null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [entries,  setEntries]  = useState<Entry[]>([]);

  useEffect(() => {
    api.get(`/finance/fiscal-documents/${docId}/integration-preview`)
      .then(r => { setPreview(r.data); setEntries(r.data.entries); })
      .catch(e => Swal.fire('Erro', e?.response?.data?.message||'Falha ao carregar preview','error').then(onClose))
      .finally(() => setLoading(false));
  }, [docId]);

  const confirm = async () => {
    setSaving(true);
    try {
      await api.post(`/finance/fiscal-documents/${docId}/integrate`);
      Swal.fire('Integrado!','Lançamentos contábeis gerados com sucesso.','success');
      onSuccess();
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message||'Falha na integração','error');
    } finally { setSaving(false); }
  };

  const totalDeb = entries.filter(e=>e.type==='DEBIT').reduce((s,e)=>s+e.value,0);
  const totalCre = entries.filter(e=>e.type==='CREDIT').reduce((s,e)=>s+e.value,0);
  const balanced = Math.abs(totalDeb - totalCre) < 0.01;

  const overlay: React.CSSProperties = {
    position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',
    display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000
  };
  const modal: React.CSSProperties = {
    background:'#fff',borderRadius:14,width:700,maxHeight:'90vh',
    display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.18)',overflow:'hidden'
  };
  const tabStyle = (t:string): React.CSSProperties => ({
    padding:'8px 18px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',
    background: tab===t ? '#fff' : 'transparent',
    color: tab===t ? AC : '#6B7280',
    borderBottom: tab===t ? `2px solid ${AC}` : '2px solid transparent',
  });

  if (loading) return (
    <div style={overlay}>
      <div style={{...modal,alignItems:'center',justifyContent:'center',height:200}}>
        <div style={{color:'#9CA3AF',fontSize:13}}>Calculando lançamentos...</div>
      </div>
    </div>
  );

  const p = preview!;
  const modeColor = p.mode==='PRESTADOR' ? '#1D4ED8' : '#15803D';
  const modeBg    = p.mode==='PRESTADOR' ? '#EFF6FF' : '#F0FDF4';

  return (
    <div style={overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={modal}>

        {/* Header */}
        <div style={{padding:'14px 20px',borderBottom:'0.5px solid #E5E7EB',
          background:'#F9FAFB',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <span style={{fontSize:10,fontWeight:700,color:AC,letterSpacing:1}}>◆ FISCAL — INTEGRAÇÃO</span>
            <h2 style={{margin:'3px 0 4px',fontSize:16,fontWeight:600,color:'#111'}}>
              NFS-e nº {p.doc.documentNumber} — {p.doc.issuerName}
            </h2>
            <span style={{fontSize:11,padding:'2px 10px',borderRadius:20,
              fontWeight:700,background:modeBg,color:modeColor}}>
              {p.mode==='PRESTADOR' ? '↑ Prestador (emitida)' : '↓ Tomador (recebida)'}
            </span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:18,
            cursor:'pointer',color:'#9CA3AF',lineHeight:1}}>✕</button>
        </div>

        {/* Warnings */}
        {p.warnings.length > 0 && (
          <div style={{padding:'8px 20px',background:'#FEF3C7',borderBottom:'0.5px solid #FDE68A',flexShrink:0}}>
            {p.warnings.map((w,i)=>(
              <div key={i} style={{fontSize:11,color:'#92400E'}}>⚠ {w}</div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'0.5px solid #E5E7EB',background:'#F9FAFB',flexShrink:0}}>
          <button style={tabStyle('doc')}     onClick={()=>setTab('doc')}>📄 Documento</button>
          <button style={tabStyle('entries')} onClick={()=>setTab('entries')}>📒 Partidas Contábeis</button>
          <button style={tabStyle('taxes')}   onClick={()=>setTab('taxes')}>% Impostos</button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflow:'auto',padding:'16px 20px'}}>

          {/* ABA DOCUMENTO */}
          {tab==='doc' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {[
                  {l:'Valor Bruto',   v:fmtBRL(p.doc.grossAmount),  c:'#111'},
                  {l:'Valor Líquido', v:fmtBRL(p.doc.netAmount),    c:'#15803D'},
                  {l:'Competência',   v:p.doc.competenceMonth,       c:'#374151'},
                  {l:'Emitente',      v:p.doc.issuerName,            c:'#374151'},
                ].map(k=>(
                  <div key={k.l} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 14px',
                    border:'0.5px solid #E5E7EB'}}>
                    <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{k.l}</div>
                    <div style={{fontSize:14,fontWeight:600,color:k.c,marginTop:2}}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div style={{background:'#F0FDF4',borderRadius:8,padding:'12px 16px',border:'0.5px solid #BBF7D0'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#15803D',marginBottom:8}}>Retenções identificadas</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {l:'ISS',    v:p.doc.issAmount,    note:'guia própria'},
                    {l:'PIS',    v:p.doc.pisAmount,    note:''},
                    {l:'COFINS', v:p.doc.cofinsAmount, note:''},
                    {l:'IR',     v:p.doc.irAmount,     note:'retido fonte'},
                    {l:'INSS',   v:p.doc.inssAmount,   note:'retido'},
                    {l:'CSLL',   v:p.doc.csllAmount,   note:'retido'},
                  ].map(t=>(
                    <div key={t.l} style={{textAlign:'center',background:'#fff',borderRadius:6,
                      padding:'6px 8px',border:'0.5px solid #E5E7EB'}}>
                      <div style={{fontSize:10,color:'#6B7280',fontWeight:600}}>{t.l}</div>
                      <div style={{fontSize:12,fontWeight:700,color:Number(t.v)>0?'#111':'#D1D5DB'}}>
                        {fmtBRL(t.v)}
                      </div>
                      {t.note&&<div style={{fontSize:9,color:'#9CA3AF'}}>{t.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA PARTIDAS */}
          {tab==='entries' && (
            <div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#F9FAFB'}}>
                    {['D/C','Código','Conta','Descrição','Valor'].map(h=>(
                      <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:10,
                        fontWeight:700,color:'#6B7280',textTransform:'uppercase',
                        borderBottom:'0.5px solid #E5E7EB'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e,i)=>(
                    <tr key={i} style={{borderBottom:'0.5px solid #F5F5F5'}}>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,
                          background: e.type==='DEBIT'?'#FEF3C7':'#F0FDF4',
                          color:      e.type==='DEBIT'?'#92400E':'#15803D'}}>
                          {e.type==='DEBIT'?'D':'C'}
                        </span>
                      </td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{e.accountCode}</td>
                      <td style={{padding:'7px 10px',fontWeight:500,color:'#111'}}>{e.accountName}</td>
                      <td style={{padding:'7px 10px',color:'#6B7280'}}>{e.label}</td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',fontWeight:600,
                        textAlign:'right',color: e.type==='DEBIT'?'#92400E':'#15803D'}}>
                        {fmtBRL(e.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'#F9FAFB',borderTop:'0.5px solid #E5E7EB'}}>
                    <td colSpan={4} style={{padding:'8px 10px',fontSize:11,fontWeight:700,color:'#374151'}}>
                      {balanced
                        ? <span style={{color:'#15803D'}}>✓ Lançamento balanceado</span>
                        : <span style={{color:'#DC2626'}}>✗ Desbalanceado — verifique as contas</span>}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontSize:12,fontWeight:700}}>
                      D: {fmtBRL(totalDeb)} / C: {fmtBRL(totalCre)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ABA IMPOSTOS */}
          {tab==='taxes' && (
            <div>
              <div style={{background:'#F0F9FF',borderRadius:8,padding:'14px 16px',
                border:'0.5px solid #BAE6FD',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'#0369A1',marginBottom:10}}>
                  Apuração — {p.doc.competenceMonth} — Lucro Presumido
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {[
                    {l:'Base de Cálculo',      v:fmtBRL(p.doc.grossAmount), c:'#111'},
                    {l:'PIS (0,65%)',           v:fmtBRL(p.doc.pisAmount),   c:'#7C3AED'},
                    {l:'COFINS (3%)',           v:fmtBRL(p.doc.cofinsAmount),c:'#7C3AED'},
                    {l:'ISS (base fixa SUP)',   v:fmtBRL(p.doc.issAmount),   c:'#F97316'},
                    {l:'IRRF Retido (1,5%)',    v:fmtBRL(p.doc.irAmount),    c:'#0369A1'},
                    {l:'CSLL Retida (1%)',      v:fmtBRL(p.doc.csllAmount),  c:'#0369A1'},
                  ].map(t=>(
                    <div key={t.l} style={{background:'#fff',borderRadius:6,padding:'8px 12px',
                      border:'0.5px solid #E5E7EB'}}>
                      <div style={{fontSize:10,color:'#6B7280',fontWeight:600}}>{t.l}</div>
                      <div style={{fontSize:14,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{fontSize:11,color:'#6B7280',padding:'0 4px'}}>
                ℹ ISS recolhido por guia própria (regime SUP/PMSP) — não incluído nos lançamentos desta NFS-e.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'12px 20px',borderTop:'0.5px solid #E5E7EB',
          display:'flex',justifyContent:'flex-end',gap:10,flexShrink:0,background:'#F9FAFB'}}>
          <button onClick={onClose} disabled={saving}
            style={{padding:'8px 18px',borderRadius:8,border:'0.5px solid #E5E7EB',
              background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,color:'#374151'}}>
            Cancelar
          </button>
          <button onClick={confirm} disabled={saving||!balanced||p.warnings.length>0}
            style={{padding:'8px 20px',borderRadius:8,border:'none',
              background: (!balanced||p.warnings.length>0) ? '#D1D5DB' : AC,
              color:'#fff',cursor: (!balanced||p.warnings.length>0)?'not-allowed':'pointer',
              fontSize:12,fontWeight:700}}>
            {saving ? 'Integrando...' : '⚡ Confirmar Integração'}
          </button>
        </div>

      </div>
    </div>
  );
};
export default FiscalIntegrationModal;
