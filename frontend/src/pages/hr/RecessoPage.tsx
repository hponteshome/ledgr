import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const AC = '#6C63FF';
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtBRL  = (v: any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

const STATUS_COLORS: Record<string,{bg:string;text:string}> = {
  PLANEJADO:  {bg:'#EFF6FF',text:'#2563EB'},
  APLICADO:   {bg:'#F0FDF4',text:'#15803D'},
  CANCELADO:  {bg:'#FEF2F2',text:'#DC2626'},
};

const TIPO_LABELS: Record<string,string> = {
  RECESSO_COLETIVO: 'Recesso Coletivo',
  PONTE:            'Ponte de Feriado',
};

export const RecessoPage: React.FC = () => {
  const [recessos, setRecessos] = useState<any[]>([]);
  const [modal, setModal]       = useState<'criar'|'preview'|null>(null);
  const [selId, setSelId]       = useState<string|null>(null);
  const [preview, setPreview]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [applying, setApplying] = useState(false);
  const [dto, setDto] = useState({
    tipo:'RECESSO_COLETIVO', descricao:'', dataInicio:'', dataFim:'', observacao:''
  });

  const S = {
    inp:{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:13,
         outline:'none',width:'100%',boxSizing:'border-box' as const},
    lbl:{fontSize:11,fontWeight:600 as const,color:'#6B7280',
         textTransform:'uppercase' as const,marginBottom:4,display:'block' as const},
    th:{padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
        textTransform:'uppercase' as const,background:'#F9FAFB',
        borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const},
    td:{padding:'10px 12px',fontSize:13,color:'#374151',borderBottom:'0.5px solid #F5F5F5'},
    btn:(c:string,sm?:boolean)=>({
      padding:sm?'4px 10px':'8px 18px',borderRadius:8,border:'none',
      background:c,color:'#fff',cursor:'pointer' as const,
      fontSize:sm?11:13,fontWeight:600 as const,
    }),
  };
  const ov = {position:'fixed' as const,inset:0,background:'rgba(0,0,0,0.45)',
    display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000};

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/hr/recesso'); setRecessos(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    if (!dto.descricao || !dto.dataInicio || !dto.dataFim) return;
    try {
      await api.post('/hr/recesso', dto);
      setModal(null);
      setDto({tipo:'RECESSO_COLETIVO',descricao:'',dataInicio:'',dataFim:'',observacao:''});
      load();
      Swal.fire('Criado!','Recesso registrado com sucesso','success');
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao criar', 'error');
    }
  };

  const abrirPreview = async (id: string) => {
    setSelId(id); setPreview(null); setModal('preview');
    const r = await api.get(`/hr/recesso/${id}/preview`);
    setPreview(r.data);
  };

  const aplicar = async () => {
    if (!selId) return;
    const confirm = await Swal.fire({
      title: 'Aplicar recesso?',
      text: `Isso criará programações de férias para ${preview?.funcionarios?.length ?? 'todos os'} funcionários ativos. Esta ação não pode ser desfeita.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, aplicar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;
    setApplying(true);
    try {
      const r = await api.post(`/hr/recesso/${selId}/aplicar`);
      setModal(null);
      load();
      const semSaldo = r.data.resultados.filter((x:any)=>x.status==='SEM_SALDO').length;
      const erros    = r.data.resultados.filter((x:any)=>x.status.startsWith('ERRO')).length;
      Swal.fire(
        'Aplicado!',
        `${r.data.totalAplicado} funcionário(s) com férias registradas.`
        + (semSaldo ? ` ${semSaldo} sem saldo.` : '')
        + (erros    ? ` ${erros} com erro.`     : ''),
        'success'
      );
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao aplicar', 'error');
    } finally { setApplying(false); }
  };

  const downloadZip = (id: string) => {
    window.open((api.defaults.baseURL ?? '') + `/hr/recesso/${id}/recibos/zip`, '_blank');
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0,
        display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div>
          <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ RH</span>
          <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>
            Recessos Coletivos & Pontes
          </h1>
          <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
            Registre e aplique recessos/pontes debitando automaticamente do saldo de férias
          </p>
        </div>
        <button onClick={()=>setModal('criar')} style={S.btn(AC)}>+ Novo Recesso / Ponte</button>
      </div>

      {/* Lista */}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Carregando...</div>
        ) : recessos.length === 0 ? (
          <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>
            <div style={{fontSize:32,marginBottom:8}}>🏖️</div>
            <div style={{fontWeight:600}}>Nenhum recesso cadastrado</div>
            <div style={{fontSize:12,marginTop:4}}>Crie o primeiro recesso coletivo ou ponte de feriado</div>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
            borderRadius:12,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
            <thead><tr>
              {['Tipo','Descrição','Início','Fim','Dias Úteis','Status','Funcionários','Ações'].map(h=>(
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{recessos.map((r:any)=>{
              const sc = STATUS_COLORS[r.status] ?? {bg:'#F9FAFB',text:'#374151'};
              return (
                <tr key={r.id}>
                  <td style={S.td}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:r.tipo==='PONTE'?'#FEF3C7':'#EDE9FE',
                      color:r.tipo==='PONTE'?'#92400E':'#5B21B6',fontWeight:600}}>
                      {TIPO_LABELS[r.tipo]}
                    </span>
                  </td>
                  <td style={{...S.td,fontWeight:500}}>{r.descricao}</td>
                  <td style={S.td}>{fmtDate(r.dataInicio)}</td>
                  <td style={S.td}>{fmtDate(r.dataFim)}</td>
                  <td style={{...S.td,textAlign:'center' as const,fontWeight:700}}>{r.diasUteis}</td>
                  <td style={S.td}>
                    <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                      background:sc.bg,color:sc.text,fontWeight:600}}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{...S.td,textAlign:'center' as const}}>
                    {r.status==='APLICADO' ? r.totalFuncionarios : '—'}
                  </td>
                  <td style={S.td}>
                    <div style={{display:'flex',gap:6}}>
                      {r.status==='PLANEJADO' && (
                        <button onClick={()=>abrirPreview(r.id)}
                          style={S.btn('#0369A1',true)}>Preview / Aplicar</button>
                      )}
                      {r.status==='APLICADO' && (
                        <button onClick={()=>downloadZip(r.id)}
                          style={S.btn('#15803D',true)}>📥 Recibos ZIP</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {/* Modal Criar */}
      {modal==='criar' && (
        <div style={ov}><div style={{background:'#fff',borderRadius:14,width:520,padding:24,
          boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
          <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 16px'}}>Novo Recesso / Ponte</h2>
          <div style={{display:'grid',gap:12}}>
            <div><label style={S.lbl}>Tipo *</label>
              <select value={dto.tipo} onChange={e=>setDto(d=>({...d,tipo:e.target.value}))} style={S.inp}>
                <option value="RECESSO_COLETIVO">Recesso Coletivo (ex: fim de ano)</option>
                <option value="PONTE">Ponte de Feriado</option>
              </select>
            </div>
            <div><label style={S.lbl}>Descrição *</label>
              <input value={dto.descricao}
                onChange={e=>setDto(d=>({...d,descricao:e.target.value}))} style={S.inp}
                placeholder="Ex: Recesso Natal/Ano Novo 2026, Ponte Corpus Christi"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={S.lbl}>Data Início *</label>
                <input type="date" value={dto.dataInicio}
                  onChange={e=>setDto(d=>({...d,dataInicio:e.target.value}))} style={S.inp}/>
              </div>
              <div><label style={S.lbl}>Data Fim *</label>
                <input type="date" value={dto.dataFim}
                  onChange={e=>setDto(d=>({...d,dataFim:e.target.value}))} style={S.inp}/>
              </div>
            </div>
            <div><label style={S.lbl}>Observação</label>
              <input value={dto.observacao}
                onChange={e=>setDto(d=>({...d,observacao:e.target.value}))} style={S.inp}
                placeholder="Opcional"/>
            </div>
            <div style={{background:'#F0F7FF',borderRadius:8,padding:10,fontSize:12,color:'#0369A1'}}>
              ℹ️ Os dias úteis serão calculados automaticamente excluindo finais de semana e feriados cadastrados.
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)}
              style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={criar} disabled={!dto.descricao||!dto.dataInicio||!dto.dataFim}
              style={S.btn(AC)}>Criar Recesso</button>
          </div>
        </div></div>
      )}

      {/* Modal Preview + Aplicar */}
      {modal==='preview' && (
        <div style={ov}><div style={{background:'#fff',borderRadius:14,width:700,padding:24,
          maxHeight:'85vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
          {!preview ? (
            <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>Carregando preview...</div>
          ) : (<>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 4px'}}>
                  Preview — {preview.recesso?.descricao}
                </h2>
                <div style={{fontSize:12,color:'#6B7280'}}>
                  {fmtDate(preview.recesso?.dataInicio)} a {fmtDate(preview.recesso?.dataFim)}
                  {' · '}<b>{preview.recesso?.diasUteis} dias úteis</b>
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                  background:'#F0FDF4',color:'#15803D'}}>
                  {preview.funcionarios?.filter((f:any)=>f.temSaldo).length} com saldo
                </span>
                <span style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                  background:'#FEF2F2',color:'#DC2626'}}>
                  {preview.funcionarios?.filter((f:any)=>!f.temSaldo).length} sem saldo
                </span>
              </div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
              <thead><tr>
                {['Funcionário','Salário','Período','Saldo Atual','A Debitar'].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{preview.funcionarios?.map((f:any)=>(
                <tr key={f.employeeId} style={{background:f.temSaldo?'#fff':'#FEF2F2'}}>
                  <td style={S.td}>{f.nome}</td>
                  <td style={{...S.td,fontFamily:'monospace'}}>{fmtBRL(f.salario)}</td>
                  <td style={{...S.td,fontSize:12,color:'#6B7280'}}>{f.periodo}</td>
                  <td style={{...S.td,textAlign:'center' as const,
                    color:f.diasSaldo>0?'#15803D':'#DC2626',fontWeight:700}}>
                    {f.diasSaldo}d
                  </td>
                  <td style={{...S.td,textAlign:'center' as const,fontWeight:700}}>
                    {f.diasADebitar>0
                      ? <span style={{color:'#0369A1'}}>{f.diasADebitar}d</span>
                      : <span style={{color:'#DC2626',fontSize:11}}>Sem saldo</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>setModal(null)}
                style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',
                  background:'#fff',cursor:'pointer',fontSize:13}}>Fechar</button>
              <button onClick={aplicar} disabled={applying}
                style={S.btn('#15803D')}>
                {applying ? 'Aplicando...' : `✓ Aplicar para ${preview.funcionarios?.filter((f:any)=>f.temSaldo).length} funcionários`}
              </button>
            </div>
          </>)}
        </div></div>
      )}
    </div>
  );
};

export default RecessoPage;
