// frontend/src/pages/finance/ProvisoesPage.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPOS = ['ALUGUEL','CONDOMINIO','ENERGIA','SERVICO','HONORARIOS','OUTROS'];
const PERIODICIDADES = ['MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL'];
const STATUS_COLORS: Record<string, {bg:string;color:string;label:string}> = {
  PROVISIONADO: { bg:'#EFF6FF', color:'#1D4ED8', label:'Provisionado' },
  NF_PENDENTE:  { bg:'#FEFCE8', color:'#854D0E', label:'NF Pendente' },
  NF_CONFERIDA: { bg:'#F0FDF4', color:'#15803D', label:'NF Conferida' },
  PAGO:         { bg:'#F0FDF4', color:'#15803D', label:'Pago' },
  CANCELADO:    { bg:'#FEF2F2', color:'#991B1B', label:'Cancelado' },
};

interface Account { id: string; code: string; name: string; }
function AccountPicker({ label, value, onChange, accounts }: { label:string; value:string; onChange:(id:string)=>void; accounts:Account[] }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const safe = Array.isArray(accounts) ? accounts : [];
  const selected = safe.find(a => a.id === value);
  const display = selected ? selected.code + ' — ' + selected.name : '';
  const filtered = q.length >= 1 ? safe.filter(a => a.code.replace(/\./g,'').includes(q.replace(/\./g,'')) || a.name.toLowerCase().includes(q.toLowerCase())).slice(0,12) : [];
  return (
    <div style={{ position:'relative' }}>
      <label style={{ fontSize:10, textTransform:'uppercase' as const, color:'#6B7280', display:'block', marginBottom:3 }}>{label}</label>
      <input style={{ height:32, border:`0.5px solid ${value?'#86EFAC':'#E5E7EB'}`, borderRadius:6, padding:'0 9px', fontSize:12, width:'100%', boxSizing:'border-box' as const }}
        value={open?q:display} placeholder="Cód. ou nome..."
        onFocus={()=>{setOpen(true);setQ('');}} onBlur={()=>setTimeout(()=>setOpen(false),250)}
        onChange={e=>setQ(e.target.value)} />
      {value&&!open&&<button onClick={()=>onChange('')} style={{position:'absolute',right:6,top:22,background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:12}}>x</button>}
      {open&&filtered.length>0&&(
        <div style={{position:'absolute',zIndex:999,background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:6,width:'100%',maxHeight:200,overflowY:'auto' as const,boxShadow:'0 4px 12px rgba(0,0,0,.08)'}}>
          {filtered.map(a=>(
            <div key={a.id} onMouseDown={()=>{onChange(a.id);setOpen(false);setQ('');}}
              style={{padding:'7px 12px',fontSize:12,cursor:'pointer',borderBottom:'0.5px solid #F5F5F5'}}
              onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#F0F9FF'}
              onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='#fff'}>
              <span style={{fontWeight:500,color:'#1D4ED8'}}>{a.code}</span>
              <span style={{color:'#6B7280',marginLeft:8}}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  page:  { padding:24, background:'#F9FAFB', minHeight:'100vh' },
  card:  { background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:10, padding:'16px 20px', marginBottom:16 },
  badge: { display:'inline-flex' as const, alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, background:'#F0F9FF', color:'#0369A1' },
  h1:    { fontSize:18, fontWeight:500, color:'#111' },
  input: { height:32, border:'0.5px solid #E5E7EB', borderRadius:6, padding:'0 9px', fontSize:12, width:'100%', boxSizing:'border-box' as const },
  btn:   { height:30, border:'0.5px solid #D1D5DB', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#fff', color:'#374151' },
  btnP:  { height:30, border:'none', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#111', color:'#fff' },
  th:    { background:'#F9FAFB', color:'#6B7280', fontSize:10, textTransform:'uppercase' as const, padding:'8px 12px', borderBottom:'0.5px solid #E5E7EB', textAlign:'left' as const },
  thR:   { background:'#F9FAFB', color:'#6B7280', fontSize:10, textTransform:'uppercase' as const, padding:'8px 12px', borderBottom:'0.5px solid #E5E7EB', textAlign:'right' as const },
  td:    { padding:'8px 12px', borderBottom:'0.5px solid #F5F5F5', fontSize:12, color:'#374151' },
  tdR:   { padding:'8px 12px', borderBottom:'0.5px solid #F5F5F5', fontSize:12, color:'#374151', textAlign:'right' as const },
};

function ConfigModal({ config, accounts, onClose, onSaved }: { config?: any; accounts: Account[]; onClose:()=>void; onSaved:()=>void }) {
  const isEdit = !!config;
  const [form, setForm] = useState({
    descricao:       config?.descricao ?? '',
    tipo:            config?.tipo ?? 'SERVICO',
    periodicidade:   config?.periodicidade ?? 'MENSAL',
    diaVencimento:   String(config?.diaVencimento ?? '10'),
    valor:           String(config?.valor ?? ''),
    contaDespesaId:  config?.contaDespesaId ?? '',
    contaPassivoId:  config?.contaPassivoId ?? '',
    fornecedorNome:  config?.fornecedorNome ?? '',
    fornecedorCnpj:  config?.fornecedorCnpj ?? '',
    exigirNF:        config?.exigirNF ?? false,
    dedutivel:       config?.dedutivel ?? true,
    creditaPisCofins:config?.creditaPisCofins ?? false,
    aliqPis:         String(config?.aliqPis ?? '0.0065'),
    aliqCofins:      String(config?.aliqCofins ?? '0.03'),
    competenciaIni:  config?.competenciaIni ?? '',
    competenciaFim:  config?.competenciaFim ?? '',
    ativo:           config?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.descricao || !form.valor || !form.competenciaIni) {
      Swal.fire({ icon:'warning', title:'Atenção', text:'Preencha descrição, valor e competência inicial.' }); return;
    }
    setSaving(true);
    try {
      const dto = { ...form, valor: parseFloat(form.valor), diaVencimento: parseInt(form.diaVencimento), aliqPis: parseFloat(form.aliqPis), aliqCofins: parseFloat(form.aliqCofins) };
      if (isEdit) await api.put('/finance/provisoes/configs/' + config.id, dto);
      else await api.post('/finance/provisoes/configs', dto);
      onSaved();
    } catch (e: any) { Swal.fire({ icon:'error', title:'Erro', text: e?.response?.data?.message ?? 'Erro ao salvar' }); }
    setSaving(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:12,padding:24,width:'100%',maxWidth:680,maxHeight:'90vh',overflowY:'auto' as const}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:15,fontWeight:500}}>{isEdit?'Editar Provisão':'Nova Provisão Recorrente'}</span>
          <button style={{...S.btn,padding:'0 8px'}} onClick={onClose}>x</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Descrição *</label>
            <input style={S.input} value={form.descricao} onChange={e=>set('descricao',e.target.value)} placeholder="Ex: Aluguel sede, Honorários contábeis..." />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Tipo</label>
            <select style={S.input} value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
              {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Periodicidade</label>
            <select style={S.input} value={form.periodicidade} onChange={e=>set('periodicidade',e.target.value)}>
              {PERIODICIDADES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Valor (R$) *</label>
            <input style={S.input} type="number" value={form.valor} onChange={e=>set('valor',e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Dia Vencimento</label>
            <input style={S.input} type="number" min={1} max={31} value={form.diaVencimento} onChange={e=>set('diaVencimento',e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Competência Inicial *</label>
            <input style={S.input} type="month" value={form.competenciaIni} onChange={e=>set('competenciaIni',e.target.value)} disabled={isEdit} />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Competência Final</label>
            <input style={S.input} type="month" value={form.competenciaFim} onChange={e=>set('competenciaFim',e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Fornecedor</label>
            <input style={S.input} value={form.fornecedorNome} onChange={e=>set('fornecedorNome',e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div>
            <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>CNPJ Fornecedor</label>
            <input style={S.input} value={form.fornecedorCnpj} onChange={e=>set('fornecedorCnpj',e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <AccountPicker label="Conta Despesa (D)" value={form.contaDespesaId} onChange={v=>set('contaDespesaId',v)} accounts={accounts} />
          <AccountPicker label="Conta Passivo (C)" value={form.contaPassivoId} onChange={v=>set('contaPassivoId',v)} accounts={accounts} />
          <div style={{gridColumn:'1/-1',borderTop:'0.5px solid #E5E7EB',paddingTop:12,display:'flex',gap:20,flexWrap:'wrap' as const}}>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={form.exigirNF} onChange={e=>set('exigirNF',e.target.checked)} />
              Exigir NF para conferência
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={form.dedutivel} onChange={e=>set('dedutivel',e.target.checked)} />
              Dedutível (LALUR)
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
              <input type="checkbox" checked={form.creditaPisCofins} onChange={e=>set('creditaPisCofins',e.target.checked)} />
              Credita PIS/COFINS
            </label>
          </div>
          {form.creditaPisCofins && (
            <>
              <div>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Alíq. PIS</label>
                <input style={S.input} type="number" step={0.0001} value={form.aliqPis} onChange={e=>set('aliqPis',e.target.value)} />
              </div>
              <div>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Alíq. COFINS</label>
                <input style={S.input} type="number" step={0.0001} value={form.aliqCofins} onChange={e=>set('aliqCofins',e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={S.btnP} onClick={save} disabled={saving}>{saving?'Salvando...':isEdit?'Salvar':'Criar provisão'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ProvisoesPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'configs'|'lancamentos'>('configs');
  const [showModal, setShowModal] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [gerarComp, setGerarComp] = useState('');
  const [filterComp, setFilterComp] = useState('');
  const [loading, setLoading] = useState(false);
  const [nfModal, setNfModal] = useState<any>(null);
  const [nfForm, setNfForm] = useState({ nfNumero:'', nfChave:'' });

  const load = async () => {
    try {
      const [cfgR, accR] = await Promise.all([
        api.get('/finance/provisoes/configs'),
        api.get('/chart-of-accounts', { params:{ limit:500 } }),
      ]);
      setConfigs(cfgR.data ?? []);
      const raw = accR.data; setAccounts(Array.isArray(raw) ? raw : raw?.items ?? []);
    } catch { Swal.fire({ icon:'error', title:'Erro', text:'Erro ao carregar dados' }); }
  };

  const loadLancamentos = async () => {
    try {
      const r = await api.get('/finance/provisoes/lancamentos', { params: filterComp ? { competencia: filterComp } : {} });
      setLancamentos(r.data ?? []);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'lancamentos') loadLancamentos(); }, [tab, filterComp]);

  const gerar = async () => {
    if (!gerarComp) { Swal.fire({ icon:'warning', title:'Atenção', text:'Informe a competência.' }); return; }
    setLoading(true);
    try {
      const r = await api.post('/finance/provisoes/gerar', { competencia: gerarComp });
      const ok = r.data.results.filter((x:any) => x.status === 'gerado').length;
      const skip = r.data.results.filter((x:any) => x.status === 'ja_existia').length;
      Swal.fire({ icon:'success', title:'Concluído', text:`${ok} gerado(s) · ${skip} já existia(m).` });
      loadLancamentos();
    } catch (e:any) { Swal.fire({ icon:'error', title:'Erro', text: e?.response?.data?.message ?? 'Erro' }); }
    setLoading(false);
  };

  const conferirNF = async () => {
    try {
      await api.put('/finance/provisoes/lancamentos/' + nfModal.id + '/conferir-nf', nfForm);
      Swal.fire({ icon:'success', title:'NF conferida!', text:'Lançamento atualizado.' });
      setNfModal(null); loadLancamentos();
    } catch { Swal.fire({ icon:'error', title:'Erro', text:'Erro ao conferir NF.' }); }
  };

  const excluirConfig = async (id: string, desc: string) => {
    const r = await Swal.fire({ icon:'warning', title:'Excluir?', text:`Inativar provisão "${desc}"?`, showCancelButton:true, confirmButtonText:'Sim', cancelButtonText:'Cancelar' });
    if (r.isConfirmed) {
      await api.delete('/finance/provisoes/configs/' + id);
      load();
    }
  };

  const tabStyle = (t: string) => ({ height:30, border:`0.5px solid ${tab===t?'#111':'#D1D5DB'}`, borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:tab===t?'#111':'#fff', color:tab===t?'#fff':'#374151' });

  return (
    <div style={S.page}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <span style={S.badge}>◆ Finance</span>
        <span style={S.h1}>Provisões Recorrentes</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button style={tabStyle('configs')} onClick={()=>setTab('configs')}>Configurações</button>
          <button style={tabStyle('lancamentos')} onClick={()=>setTab('lancamentos')}>Lançamentos</button>
        </div>
      </div>

      {tab === 'configs' && (
        <>
          <div style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontSize:11,fontWeight:500,color:'#6B7280',textTransform:'uppercase' as const,letterSpacing:'.3px'}}>Provisões cadastradas</span>
              <button style={S.btnP} onClick={()=>{setEditConfig(null);setShowModal(true);}}>+ Nova provisão</button>
            </div>
            {configs.length === 0
              ? <p style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Nenhuma provisão cadastrada.</p>
              : <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>
                    <th style={S.th}>Descrição</th>
                    <th style={S.th}>Tipo</th>
                    <th style={S.th}>Periodicidade</th>
                    <th style={S.thR}>Valor</th>
                    <th style={S.th}>Venc.</th>
                    <th style={S.th}>Vigência</th>
                    <th style={S.th}>NF</th>
                    <th style={S.th}>LALUR</th>
                    <th style={S.th}>PIS/COFINS</th>
                    <th style={S.th}></th>
                  </tr></thead>
                  <tbody>
                    {configs.map(c => (
                      <tr key={c.id}>
                        <td style={{...S.td,fontWeight:500}}>{c.descricao}</td>
                        <td style={S.td}>{c.tipo}</td>
                        <td style={S.td}>{c.periodicidade}</td>
                        <td style={S.tdR}>R$ {fmtBRL(c.valor)}</td>
                        <td style={S.td}>Dia {c.diaVencimento}</td>
                        <td style={S.td}>{c.competenciaIni}{c.competenciaFim ? ` → ${c.competenciaFim}` : ' →'}</td>
                        <td style={S.td}>{c.exigirNF ? <span style={{color:'#854D0E'}}>Exigida</span> : '—'}</td>
                        <td style={S.td}>{c.dedutivel ? <span style={{color:'#15803D'}}>✓</span> : '—'}</td>
                        <td style={S.td}>{c.creditaPisCofins ? <span style={{color:'#1D4ED8'}}>✓</span> : '—'}</td>
                        <td style={S.td}>
                          <div style={{display:'flex',gap:6}}>
                            <button style={{...S.btn,fontSize:11}} onClick={()=>{setEditConfig(c);setShowModal(true);}}>Editar</button>
                            <button style={{...S.btn,fontSize:11,color:'#DC2626',borderColor:'#FCA5A5'}} onClick={()=>excluirConfig(c.id,c.descricao)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </>
      )}

      {tab === 'lancamentos' && (
        <>
          <div style={S.card}>
            <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap' as const}}>
              <div>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Gerar para competência</label>
                <input style={{...S.input,width:160}} type="month" value={gerarComp} onChange={e=>setGerarComp(e.target.value)} />
              </div>
              <button style={S.btnP} onClick={gerar} disabled={loading}>{loading?'Gerando...':'Gerar lançamentos'}</button>
              <div style={{marginLeft:'auto'}}>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Filtrar competência</label>
                <input style={{...S.input,width:160}} type="month" value={filterComp} onChange={e=>setFilterComp(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={S.card}>
            <span style={{fontSize:11,fontWeight:500,color:'#6B7280',textTransform:'uppercase' as const,letterSpacing:'.3px'}}>Histórico de lançamentos</span>
            {lancamentos.length === 0
              ? <p style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic',marginTop:12}}>Nenhum lançamento encontrado.</p>
              : <table style={{width:'100%',borderCollapse:'collapse',marginTop:12}}>
                  <thead><tr>
                    <th style={S.th}>Competência</th>
                    <th style={S.th}>Descrição</th>
                    <th style={S.thR}>Valor</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>NF</th>
                    <th style={S.th}>AP</th>
                    <th style={S.th}>Lançamento</th>
                    <th style={S.th}></th>
                  </tr></thead>
                  <tbody>
                    {lancamentos.map(l => {
                      const st = STATUS_COLORS[l.status] ?? STATUS_COLORS.PROVISIONADO;
                      return (
                        <tr key={l.id}>
                          <td style={{...S.td,fontWeight:500}}>{l.competencia}</td>
                          <td style={S.td}>{l.provisao?.descricao}</td>
                          <td style={S.tdR}>R$ {fmtBRL(l.valor)}</td>
                          <td style={S.td}><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,background:st.bg,color:st.color}}>{st.label}</span></td>
                          <td style={S.td}>{l.nfConferida ? <span style={{color:'#15803D'}}>✓ {l.nfNumero}</span> : l.provisao?.exigirNF ? <span style={{color:'#854D0E'}}>Pendente</span> : '—'}</td>
                          <td style={S.td}>{l.apEntryId ? <span style={{color:'#15803D'}}>✓</span> : '—'}</td>
                          <td style={S.td}>{l.journalEntryId ? <span style={{color:'#15803D'}}>✓</span> : '—'}</td>
                          <td style={S.td}>
                            {!l.nfConferida && (l.provisao?.exigirNF || true) && (
                              <button style={{...S.btn,fontSize:11,background:'#F0FDF4',color:'#15803D',borderColor:'#86EFAC'}}
                                onClick={()=>{setNfModal(l);setNfForm({nfNumero:l.nfNumero??'',nfChave:l.nfChave??''});}}>
                                Conferir NF
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
          </div>
        </>
      )}

      {/* Modal NF */}
      {nfModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e=>e.target===e.currentTarget&&setNfModal(null)}>
          <div style={{background:'#fff',borderRadius:12,padding:24,width:'100%',maxWidth:440}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:15,fontWeight:500}}>Conferir Nota Fiscal</span>
              <button style={{...S.btn,padding:'0 8px'}} onClick={()=>setNfModal(null)}>x</button>
            </div>
            <p style={{fontSize:12,color:'#6B7280',marginBottom:16}}>{nfModal.provisao?.descricao} · {nfModal.competencia} · R$ {fmtBRL(nfModal.valor)}</p>
            <div style={{display:'grid',gap:12,marginBottom:20}}>
              <div>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Número da NF</label>
                <input style={S.input} value={nfForm.nfNumero} onChange={e=>setNfForm(p=>({...p,nfNumero:e.target.value}))} placeholder="Ex: 12345" />
              </div>
              <div>
                <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>Chave de Acesso (opcional)</label>
                <input style={S.input} value={nfForm.nfChave} onChange={e=>setNfForm(p=>({...p,nfChave:e.target.value}))} placeholder="44 dígitos" />
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button style={S.btn} onClick={()=>setNfModal(null)}>Cancelar</button>
              <button style={{...S.btnP,background:'#15803D'}} onClick={conferirNF}>✓ Conferida!</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ConfigModal
          config={editConfig??undefined}
          accounts={accounts}
          onClose={()=>{setShowModal(false);setEditConfig(null);}}
          onSaved={()=>{setShowModal(false);setEditConfig(null);load();}}
        />
      )}
    </div>
  );
}
