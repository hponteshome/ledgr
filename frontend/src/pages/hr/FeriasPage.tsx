import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { SmartDateInput } from '../../components/SmartDateInput';

const AC = '#6C63FF';
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtBRL  = (v: any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const STATUS_COLORS: Record<string,string> = {
  ABERTO:'#9CA3AF', DISPONIVEL:'#3B82F6', PROGRAMADO:'#F59E0B',
  GOZADO:'#10B981', VENCIDO:'#EF4444', AGENDADA:'#3B82F6',
  AVISO_EMITIDO:'#8B5CF6', PAGO:'#10B981', EM_GOZO:'#F59E0B',
  CONCLUIDA:'#10B981', CANCELADA:'#EF4444',
};

export const FeriasPage: React.FC = () => {
  const [emps, setEmps]         = useState<any[]>([]);
  const [sel,  setSel]          = useState<any>(null);
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [modal, setModal]       = useState<'agendar'|null>(null);
  const [preview, setPreview]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [dto, setDto] = useState({
    periodoAquisitivoId:'', parcela:1, dataInicio:'', dataFim:'',
    diasFerias:30, diasAbono:0, numDependentes:0, observacao:''
  });

  const S = {
    th:{padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
        textTransform:'uppercase' as const,background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const},
    td:{padding:'10px 12px',fontSize:13,color:'#374151',borderBottom:'0.5px solid #F5F5F5'},
    inp:{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box' as const},
    lbl:{fontSize:11,fontWeight:600 as const,color:'#6B7280',textTransform:'uppercase' as const,marginBottom:4,display:'block' as const},
    btn:(c:string)=>({padding:'6px 14px',borderRadius:8,border:'none',background:c,color:'#fff',cursor:'pointer' as const,fontSize:12,fontWeight:600 as const}),
  };
  const ov = {position:'fixed' as const,inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000};
  const cd = {background:'#fff',borderRadius:14,width:580,padding:24,maxHeight:'90vh',overflowY:'auto' as const,boxShadow:'0 20px 60px rgba(0,0,0,.15)'};

  const loadEmps = useCallback(async () => {
    const r = await api.get('/hr/ferias/funcionarios');
    setEmps(r.data);
  }, []);

  const loadPeriodos = useCallback(async (empId: string) => {
    const r = await api.get(`/hr/ferias/periodos/${empId}`);
    setPeriodos(r.data);
  }, []);

  const inicializar = async (emp: any) => {
    await api.post(`/hr/ferias/periodos/${emp.id}/inicializar`);
    await loadPeriodos(emp.id);
    Swal.fire('Periodos Inicializados','Periodos aquisitivos criados com sucesso','success');
  };

  const calcPreview = async () => {
    if (!dto.diasFerias || !sel) return;
    const r = await api.post('/hr/ferias/calcular', {
      salarioBase: sel.salary, diasFerias: dto.diasFerias,
      diasAbono: dto.diasAbono, numDependentes: dto.numDependentes,
    });
    setPreview(r.data);
  };

  const agendar = async () => {
    if (!sel || !dto.periodoAquisitivoId || !dto.dataInicio || !dto.dataFim) return;
    try {
      await api.post(`/hr/ferias/agendar/${sel.id}`, { ...dto, salarioBase: sel.salary });
      setModal(null); loadPeriodos(sel.id);
      Swal.fire('Agendado!','Ferias agendadas com sucesso','success');
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao agendar', 'error');
    }
  };

  const abrirPdf = (url: string) => window.open(api.defaults.baseURL+url, '_blank');

  useEffect(() => { loadEmps(); }, [loadEmps]);
  useEffect(() => { if (dto.diasFerias) calcPreview(); }, [dto.diasFerias, dto.diasAbono, dto.numDependentes]);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ RH</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Gestão de Férias</h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Períodos aquisitivos, agendamento, avisos e recibos</p>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'16px 24px',display:'flex',gap:16}}>
        {/* Lista de funcionarios */}
        <div style={{width:300,flexShrink:0}}>
          <div style={{background:'#fff',borderRadius:12,border:'0.5px solid #E5E7EB',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'0.5px solid #E5E7EB',fontSize:12,fontWeight:700,color:'#374151'}}>
              Funcionários ({emps.length})
            </div>
            {emps.map(e=>(
              <div key={e.id} onClick={async()=>{setSel(e);await loadPeriodos(e.id);}}
                style={{padding:'10px 16px',cursor:'pointer',borderBottom:'0.5px solid #F5F5F5',
                  background:sel?.id===e.id?'#F0EDFF':'#fff',
                  transition:'background 0.1s'}}>
                <div style={{fontWeight:500,fontSize:13,color:'#111'}}>{e.fullName}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{e.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhe do funcionario */}
        <div style={{flex:1}}>
          {!sel ? (
            <div style={{textAlign:'center',padding:60,color:'#9CA3AF',fontSize:14}}>
              Selecione um funcionário para ver os períodos de férias
            </div>
          ) : (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:'#111'}}>{sel.fullName}</div>
                  <div style={{fontSize:12,color:'#6B7280'}}>
                    Admissão: {fmtDate(sel.hireDate)} · Salário: {fmtBRL(sel.salary)}
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  {periodos.length===0 && (
                    <button onClick={()=>inicializar(sel)} style={S.btn('#6B7280')}>
                      Inicializar Períodos
                    </button>
                  )}
                  <button onClick={()=>setModal('agendar')} style={S.btn(AC)}
                    disabled={!periodos.some((p:any)=>['DISPONIVEL','ABERTO'].includes(p.status))}>
                    + Agendar Férias
                  </button>
                </div>
              </div>

              {/* Periodos aquisitivos */}
              {periodos.map((p:any)=>(
                <div key={p.id} style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,marginBottom:12,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',
                    background:p.status==='VENCIDO'?'#FEF2F2':p.status==='DISPONIVEL'?'#EFF6FF':'#F9FAFB'}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14}}>
                        Período {p.anoAquisitivo}/{p.anoAquisitivo+1}
                      </span>
                      <span style={{marginLeft:8,fontSize:11,padding:'2px 8px',borderRadius:20,
                        background:STATUS_COLORS[p.status]+'22',color:STATUS_COLORS[p.status],fontWeight:600}}>
                        {p.status}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:'#6B7280'}}>
                      Saldo: <b style={{color:p.diasSaldo>0?'#15803D':'#EF4444'}}>{p.diasSaldo} dias</b>
                      {' · '}Concessivo até: {fmtDate(p.dataFimConc)}
                    </div>
                  </div>

                  {/* Programacoes */}
                  {p.programacoes?.length > 0 && (
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr>
                        {['Parcela','Início','Fim','Dias','Abono','Líquido','Status','Docs'].map(h=>(
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{p.programacoes.map((pg:any)=>(
                        <tr key={pg.id}>
                          <td style={S.td}>{pg.parcela}ª</td>
                          <td style={S.td}>{fmtDate(pg.dataInicio)}</td>
                          <td style={S.td}>{fmtDate(pg.dataFim)}</td>
                          <td style={S.td}>{pg.diasFerias}d</td>
                          <td style={S.td}>{pg.diasAbono}d</td>
                          <td style={{...S.td,fontFamily:'monospace'}}>{fmtBRL(pg.totalLiquido)}</td>
                          <td style={S.td}>
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                              background:STATUS_COLORS[pg.status]+'22',color:STATUS_COLORS[pg.status],fontWeight:600}}>
                              {pg.status}
                            </span>
                          </td>
                          <td style={S.td}>
                            <button onClick={()=>abrirPdf(`/hr/ferias/programacoes/${pg.id}/aviso/pdf`)}
                              style={{...S.btn('#8B5CF6'),padding:'3px 8px',marginRight:4,fontSize:11}}>Aviso</button>
                            <button onClick={()=>abrirPdf(`/hr/ferias/programacoes/${pg.id}/recibo/pdf`)}
                              style={{...S.btn('#15803D'),padding:'3px 8px',fontSize:11}}>Recibo</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                  {p.programacoes?.length === 0 && (
                    <div style={{padding:'12px 16px',fontSize:12,color:'#9CA3AF'}}>Nenhuma programação</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal agendar */}
      {modal==='agendar' && sel && (
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 16px'}}>Agendar Férias — {sel.fullName}</h2>
          <div style={{display:'grid',gap:12}}>
            <div><label style={S.lbl}>Período Aquisitivo *</label>
              <select value={dto.periodoAquisitivoId}
                onChange={e=>setDto(d=>({...d,periodoAquisitivoId:e.target.value}))} style={S.inp}>
                <option value="">Selecione...</option>
                {periodos.filter((p:any)=>['DISPONIVEL','PROGRAMADO'].includes(p.status)).map((p:any)=>(
                  <option key={p.id} value={p.id}>
                    {p.anoAquisitivo}/{p.anoAquisitivo+1} — Saldo: {p.diasSaldo} dias
                  </option>
                ))}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div><label style={S.lbl}>Parcela</label>
                <select value={dto.parcela} onChange={e=>setDto(d=>({...d,parcela:+e.target.value}))} style={S.inp}>
                  <option value={1}>1ª</option><option value={2}>2ª</option><option value={3}>3ª</option>
                </select>
              </div>
              <div><label style={S.lbl}>Dias Férias *</label>
                <input type="number" value={dto.diasFerias} min={1} max={30}
                  onChange={e=>setDto(d=>({...d,diasFerias:+e.target.value}))} style={S.inp}/>
              </div>
              <div><label style={S.lbl}>Abono (dias)</label>
                <input type="number" value={dto.diasAbono} min={0} max={10}
                  onChange={e=>setDto(d=>({...d,diasAbono:+e.target.value}))} style={S.inp}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={S.lbl}>Início *</label>
                <SmartDateInput value={dto.dataInicio}
                  onChange={v=>setDto(d=>({...d,dataInicio:v}))} style={S.inp}/>
              </div>
              <div><label style={S.lbl}>Fim *</label>
                <SmartDateInput value={dto.dataFim}
                  onChange={v=>setDto(d=>({...d,dataFim:v}))} style={S.inp}/>
              </div>
            </div>
            <div><label style={S.lbl}>Dependentes (para IRRF)</label>
              <input type="number" value={dto.numDependentes} min={0}
                onChange={e=>setDto(d=>({...d,numDependentes:+e.target.value}))} style={S.inp}/>
            </div>
            {/* Preview do calculo */}
            {preview && (
              <div style={{background:'#F0FDF4',borderRadius:8,padding:12,fontSize:12}}>
                <div style={{fontWeight:700,marginBottom:6,color:'#15803D'}}>Prévia do Cálculo</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
                  <div>Férias: <b>{fmtBRL(preview.valorFerias)}</b></div>
                  <div>1/3: <b>{fmtBRL(preview.valorTerco)}</b></div>
                  {preview.valorAbono>0&&<div>Abono: <b>{fmtBRL(preview.valorAbono)}</b></div>}
                  <div>Bruto: <b>{fmtBRL(preview.totalBruto)}</b></div>
                  <div>INSS: <b style={{color:'#EF4444'}}>({fmtBRL(preview.valorInss)})</b></div>
                  <div>IRRF: <b style={{color:'#EF4444'}}>({fmtBRL(preview.valorIrrf)})</b></div>
                </div>
                <div style={{marginTop:8,fontSize:14,fontWeight:700,color:'#111'}}>
                  Líquido: {fmtBRL(preview.totalLiquido)}
                </div>
              </div>
            )}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)}
              style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>
              Cancelar
            </button>
            <button onClick={agendar}
              disabled={!dto.periodoAquisitivoId||!dto.dataInicio||!dto.dataFim}
              style={{padding:'8px 18px',borderRadius:8,border:'none',background:AC,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>
              Confirmar Agendamento
            </button>
          </div>
        </div></div>
      )}
    </div>
  );
};

export default FeriasPage;
