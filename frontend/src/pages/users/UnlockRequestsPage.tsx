import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtDate = (d: any) => d ? new Date(d).toLocaleString('pt-BR') : '—';
const AC = '#6C63FF';

export const UnlockRequestsPage = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/unlock-requests/list', { params: { status: 'PENDING' } });
      setRequests(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const aprovar = async (id: string) => {
    try {
      await api.post(`/users/unlock-requests/${id}/approve`);
      load();
      Swal.fire('Aprovado!', 'Usuário liberado (sem restrição de horário).', 'success');
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message || 'Falha ao aprovar.', 'error');
    }
  };

  const negar = async (id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Negar solicitação?',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#DC2626', confirmButtonText: 'Negar',
      cancelButtonText: 'Cancelar',
    });
    if (!isConfirmed) return;
    try {
      await api.post(`/users/unlock-requests/${id}/deny`);
      load();
      Swal.fire('Negado', 'Solicitação negada.', 'info');
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message || 'Falha ao negar.', 'error');
    }
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ USUÁRIOS</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>
          Solicitações de Desbloqueio
          {requests.length > 0 && <span style={{marginLeft:10,fontSize:13,padding:'2px 10px',borderRadius:20,background:'#FEF3C7',color:'#92400E',fontWeight:700}}>{requests.length} pendente{requests.length > 1 ? 's' : ''}</span>}
        </h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Usuários bloqueados pela Janela de Acesso que pediram liberação</p>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading && <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Carregando...</div>}
        {!loading && requests.length === 0 && (
          <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>
            <div style={{fontSize:32}}>✅</div>
            <div style={{fontWeight:600,marginTop:8}}>Nenhuma solicitação pendente</div>
          </div>
        )}
        {requests.map(r => (
          <div key={r.id} style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:'16px 20px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{r.user?.fullName}</div>
              <div style={{fontSize:12,color:'#6B7280',marginBottom:8}}>📧 {r.user?.email} · 🕐 {fmtDate(r.createdAt)}</div>
              <div style={{padding:'8px 12px',background:'#F9FAFB',borderRadius:6,fontSize:13,color:'#374151'}}>
                {r.message}
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginLeft:16,flexShrink:0}}>
              <button onClick={() => negar(r.id)}
                style={{padding:'7px 16px',borderRadius:8,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:13,fontWeight:600}}>
                ✕ Negar
              </button>
              <button onClick={() => aprovar(r.id)}
                style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#15803D',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
                ✓ Aprovar (libera acesso)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default UnlockRequestsPage;
