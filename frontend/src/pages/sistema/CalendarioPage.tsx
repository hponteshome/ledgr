// frontend/src/pages/sistema/CalendarioPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

interface Holiday {
  id: string; date: string; name: string; type: string;
  state?: string; city?: string; recurring: boolean;
  hebrewName?: string; hebrewDate?: string; erevStart?: boolean;
}

interface BridgeSuggestion {
  date: string;       // YYYY-MM-DD
  label: string;      // ex: "Sexta-feira"
  reason: string;     // ex: "Ponte após Corpus Christi (qui 19/06)"
  criado: boolean;    // ja existe como recesso registrado
}

const fmtDate = (s: string) => new Date(s + 'T12:00:00Z').toLocaleDateString('pt-BR');
const fmtDateYMD = (d: Date) => d.toISOString().slice(0, 10);
const DOW_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOW_FULL   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira',
                    'Quinta-feira','Sexta-feira','Sábado'];

const TYPE_LABELS: Record<string,string> = {
  NACIONAL:'Nacional', ESTADUAL:'Estadual', MUNICIPAL:'Municipal',
  JUDAICO:'Judaico', FACULTATIVO:'Facultativo'
};
const TYPE_COLORS: Record<string,{bg:string,color:string}> = {
  NACIONAL:   {bg:'#EFF6FF',color:'#1D4ED8'},
  ESTADUAL:   {bg:'#F0FDF4',color:'#15803D'},
  MUNICIPAL:  {bg:'#FEFCE8',color:'#854D0E'},
  JUDAICO:    {bg:'#FDF4FF',color:'#7E22CE'},
  FACULTATIVO:{bg:'#F9FAFB',color:'#6B7280'},
  PONTE:      {bg:'#FFF7ED',color:'#C2410C'},
  RECESSO:    {bg:'#EDE9FE',color:'#5B21B6'},
  FERIAS:     {bg:'#F0FDF4',color:'#15803D'},
};

export function CalendarioPage() {
  const [holidays,  setHolidays]  = useState<Holiday[]>([]);
  const [recessos,  setRecessos]  = useState<any[]>([]);
  const [ferias,    setFerias]    = useState<any[]>([]);
  const [year,      setYear]      = useState(new Date().getFullYear());
  const [typeFilter,setTypeFilter]= useState('');
  const [loading,   setLoading]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg,       setMsg]       = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [activeTab, setActiveTab] = useState<'lista'|'pontes'|'recessos'|'ferias'>('pontes');
  const [form, setForm] = useState({
    date:'', name:'', type:'JUDAICO', state:'', city:'',
    recurring:false, hebrewName:'', hebrewDate:'', erevStart:false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [hRes, rRes, fRes] = await Promise.all([
        api.get('/calendar/holidays', { params: { year } }),
        api.get('/hr/recesso').catch(() => ({ data: [] })),
        api.get('/hr/ferias/programacoes').catch(() => ({ data: [] })),
      ]);
      setHolidays(hRes.data ?? []);
      setRecessos(rRes.data ?? []);
      setFerias(fRes.data ?? []);
    } catch { setMsg('Erro ao carregar'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  // ── Sugestoes de pontes automaticas ────────────────────────────────────────
  const recessoDates = useMemo(() => {
    const set = new Set<string>();
    recessos.forEach((r: any) => {
      const cur = new Date(r.dataInicio + 'T12:00:00Z');
      const fim = new Date(r.dataFim   + 'T12:00:00Z');
      while (cur <= fim) {
        set.add(fmtDateYMD(cur));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [recessos]);

  const bridges = useMemo<BridgeSuggestion[]>(() => {
    const result: BridgeSuggestion[] = [];
    const nacionais = holidays.filter(h =>
      ['NACIONAL','FACULTATIVO','ESTADUAL'].includes(h.type)
    );
    nacionais.forEach(h => {
      const d   = new Date(h.date + 'T12:00:00Z');
      const dow = d.getDay(); // 0=Dom...6=Sab
      if (dow === 4) {
        // Quinta → sexta e ponte
        const fri = new Date(d);
        fri.setDate(fri.getDate() + 1);
        const ymd = fmtDateYMD(fri);
        result.push({
          date:   ymd,
          label:  'Sexta-feira',
          reason: `Ponte após ${h.name} (${DOW_LABELS[dow]} ${fmtDate(h.date)})`,
          criado: recessoDates.has(ymd),
        });
      }
      if (dow === 2) {
        // Terca → segunda e ponte
        const mon = new Date(d);
        mon.setDate(mon.getDate() - 1);
        const ymd = fmtDateYMD(mon);
        result.push({
          date:   ymd,
          label:  'Segunda-feira',
          reason: `Ponte antes de ${h.name} (${DOW_LABELS[dow]} ${fmtDate(h.date)})`,
          criado: recessoDates.has(ymd),
        });
      }
    });
    return result.sort((a,b) => a.date.localeCompare(b.date));
  }, [holidays, recessoDates]);

  const importYear = async () => {
    setImporting(true);
    try {
      const r = await api.post('/calendar/holidays/import/' + year);
      setMsg('Importados: ' + r.data.imported + ' feriados');
      load();
    } catch { setMsg('Erro ao importar'); }
    setImporting(false);
  };

  const save = async () => {
    try {
      await api.post('/calendar/holidays', form);
      setMsg('Feriado adicionado');
      setShowForm(false);
      setForm({date:'',name:'',type:'JUDAICO',state:'',city:'',
               recurring:false,hebrewName:'',hebrewDate:'',erevStart:false});
      load();
    } catch { setMsg('Erro ao salvar'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir?')) return;
    try { await api.delete('/calendar/holidays/' + id); load(); }
    catch { setMsg('Erro ao excluir'); }
  };

  // Cria recesso diretamente da sugestao de ponte
  const criarPonte = async (b: BridgeSuggestion) => {
    try {
      await api.post('/hr/recesso', {
        tipo: 'PONTE',
        descricao: b.reason,
        dataInicio: b.date,
        dataFim:    b.date,
      });
      setMsg(`Ponte ${fmtDate(b.date)} registrada!`);
      load();
    } catch(e:any) {
      setMsg('Erro: ' + (e?.response?.data?.message ?? e.message));
    }
  };

  const filtered = typeFilter ? holidays.filter(h => h.type === typeFilter) : holidays;

  const S = {
    page:   {padding:'24px 0',fontFamily:'var(--font-sans,system-ui)',fontSize:14,
              color:'var(--color-text-primary)'} as React.CSSProperties,
    badge:  {display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,
              padding:'3px 10px',borderRadius:20,background:'#F9FAFB',color:'#374151'} as React.CSSProperties,
    card:   {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',
              borderRadius:10,padding:'14px 16px',marginBottom:16} as React.CSSProperties,
    input:  {height:32,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 9px',
              fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',
              outline:'none'} as React.CSSProperties,
    btn:    {height:30,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 12px',
              fontSize:12,cursor:'pointer',background:'var(--color-background-primary)',
              color:'var(--color-text-primary)'} as React.CSSProperties,
    btnP:   {height:30,border:'none',borderRadius:6,padding:'0 14px',fontSize:12,cursor:'pointer',
              background:'#111',color:'#fff',fontWeight:500} as React.CSSProperties,
    btnDng: {height:26,border:'0.5px solid #FCA5A5',borderRadius:5,padding:'0 8px',fontSize:11,
              cursor:'pointer',background:'#FEF2F2',color:'#B91C1C'} as React.CSSProperties,
    th:     {background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontSize:10,
              fontWeight:500,textTransform:'uppercase' as const,letterSpacing:'.3px',padding:'8px 10px',
              textAlign:'left' as const,borderBottom:'0.5px solid var(--color-border-tertiary)'} as React.CSSProperties,
    td:     {padding:'7px 10px',borderBottom:'0.5px solid var(--color-border-tertiary)',
              fontSize:12} as React.CSSProperties,
    label:  {fontSize:10,textTransform:'uppercase' as const,letterSpacing:'.3px',
              color:'var(--color-text-secondary)',display:'block',marginBottom:4},
  };

  const tab = (id: typeof activeTab, label: string, count?: number) => (
    <button key={id} onClick={() => setActiveTab(id)}
      style={{padding:'7px 16px',border:'none',cursor:'pointer',fontSize:13,fontWeight:activeTab===id?600:400,
        borderBottom:activeTab===id?'2px solid #6C63FF':'2px solid transparent',
        color:activeTab===id?'#6C63FF':'#6B7280',background:'transparent'}}>
      {label}{count!=null ? ` (${count})` : ''}
    </button>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <span style={S.badge}>⚙ Sistema</span>
        <span style={{fontSize:15,fontWeight:500}}>Calendário {year}</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <input style={{...S.input,width:80}} type='number' min={2020} max={2035}
            value={year} onChange={e=>setYear(parseInt(e.target.value))}/>
          <button style={S.btn} onClick={importYear} disabled={importing}>
            {importing?'Importando...':'Importar '+year+' (BrasilAPI)'}
          </button>
          <button style={S.btnP} onClick={()=>setShowForm(v=>!v)}>+ Feriado</button>
        </div>
      </div>

      {msg && (
        <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:6,
          padding:'8px 12px',fontSize:12,color:'#15803D',marginBottom:12}}>
          {msg}
          <button style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',color:'#15803D'}}
            onClick={()=>setMsg('')}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'0.5px solid #E5E7EB',marginBottom:16,gap:4}}>
        {tab('pontes',   '🌉 Pontes Sugeridas', bridges.length)}
        {tab('recessos', '🏖️ Recessos & Pontes', recessos.length)}
        {tab('ferias',   '🌴 Férias Programadas', ferias.length)}
        {tab('lista',    '📅 Todos os Feriados', holidays.length)}
      </div>

      {/* ── Tab: Pontes Sugeridas ─────────────────────────────────────────── */}
      {activeTab==='pontes' && (
        <div>
          <p style={{fontSize:12,color:'#6B7280',marginBottom:12}}>
            Detectado automaticamente quando feriados caem em <b>quinta-feira</b> (→ ponte na sexta)
            ou <b>terça-feira</b> (→ ponte na segunda). Clique em <b>Registrar Ponte</b> para criar
            o recesso e aplicar em lote para os funcionários.
          </p>
          {bridges.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>
              Nenhuma ponte sugerida para {year}. Importe os feriados primeiro.
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
              borderRadius:10,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
              <thead><tr>
                <th style={S.th}>Data</th>
                <th style={S.th}>Dia</th>
                <th style={S.th}>Motivo</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr></thead>
              <tbody>{bridges.map((b,i) => (
                <tr key={i} style={{background:b.criado?'#F0FDF4':'#fff'}}>
                  <td style={{...S.td,fontWeight:600}}>{fmtDate(b.date)}</td>
                  <td style={S.td}>{b.label}</td>
                  <td style={{...S.td,color:'#6B7280'}}>{b.reason}</td>
                  <td style={S.td}>
                    {b.criado
                      ? <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                          background:'#DCFCE7',color:'#15803D',fontWeight:600}}>✓ Registrada</span>
                      : <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                          background:'#FFF7ED',color:'#C2410C',fontWeight:600}}>Pendente</span>}
                  </td>
                  <td style={S.td}>
                    {!b.criado && (
                      <button onClick={()=>criarPonte(b)}
                        style={{padding:'3px 10px',borderRadius:6,border:'none',
                          background:'#C2410C',color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600}}>
                        + Registrar Ponte
                      </button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Recessos & Pontes Registrados ──────────────────────────────── */}
      {activeTab==='recessos' && (
        <div>
          {recessos.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>
              Nenhum recesso registrado. Vá em <b>RH → Recessos & Pontes</b> para criar.
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
              borderRadius:10,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
              <thead><tr>
                {['Tipo','Descrição','Início','Fim','Dias Úteis','Status','Funcionários'].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{recessos.map((r:any) => (
                <tr key={r.id}>
                  <td style={S.td}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,
                      background:r.tipo==='PONTE'?'#FFF7ED':'#EDE9FE',
                      color:r.tipo==='PONTE'?'#C2410C':'#5B21B6'}}>
                      {r.tipo==='PONTE'?'🌉 Ponte':'🏖️ Recesso'}
                    </span>
                  </td>
                  <td style={{...S.td,fontWeight:500}}>{r.descricao}</td>
                  <td style={S.td}>{fmtDate(r.dataInicio)}</td>
                  <td style={S.td}>{fmtDate(r.dataFim)}</td>
                  <td style={{...S.td,textAlign:'center' as const,fontWeight:700}}>{r.diasUteis}</td>
                  <td style={S.td}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,
                      background:r.status==='APLICADO'?'#DCFCE7':'#EFF6FF',
                      color:r.status==='APLICADO'?'#15803D':'#2563EB'}}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{...S.td,textAlign:'center' as const}}>
                    {r.status==='APLICADO'?r.totalFuncionarios:'—'}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Ferias Programadas ──────────────────────────────────────────── */}
      {activeTab==='ferias' && (
        <div>
          {ferias.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>
              Nenhuma férias programada. Vá em <b>RH → Férias</b> para agendar.
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
              borderRadius:10,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
              <thead><tr>
                {['Funcionário','Início','Fim','Dias','Abono','Status','Líquido'].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{ferias.map((f:any) => (
                <tr key={f.id}>
                  <td style={{...S.td,fontWeight:500}}>{f.employee?.fullName ?? '—'}</td>
                  <td style={S.td}>{fmtDate(f.dataInicio)}</td>
                  <td style={S.td}>{fmtDate(f.dataFim)}</td>
                  <td style={{...S.td,textAlign:'center' as const}}>{f.diasFerias}d</td>
                  <td style={{...S.td,textAlign:'center' as const}}>{f.diasAbono}d</td>
                  <td style={S.td}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,
                      background:'#F0FDF4',color:'#15803D'}}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{...S.td,fontFamily:'monospace'}}>
                    {Number(f.totalLiquido||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Lista de Feriados ───────────────────────────────────────────── */}
      {activeTab==='lista' && (<>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
          <select style={{...S.input,width:160}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value=''>Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <span style={{fontSize:12,color:'#9CA3AF'}}>{filtered.length} feriado(s)</span>
        </div>
        {showForm && (
          <div style={{...S.card,border:'0.5px solid #7E22CE'}}>
            <p style={{fontSize:11,fontWeight:600,color:'#7E22CE',textTransform:'uppercase',
              letterSpacing:'.3px',marginBottom:12}}>Novo Feriado</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:12}}>
              <div><label style={S.label}>Data *</label>
                <input style={{...S.input,width:'100%'}} type='date' value={form.date}
                  onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div><label style={S.label}>Nome *</label>
                <input style={{...S.input,width:'100%'}} type='text' value={form.name}
                  onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
              <div><label style={S.label}>Tipo</label>
                <select style={{...S.input,width:'100%'}} value={form.type}
                  onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label style={S.label}>Estado (UF)</label>
                <input style={{...S.input,width:'100%'}} type='text' maxLength={2} value={form.state}
                  onChange={e=>setForm(p=>({...p,state:e.target.value.toUpperCase()}))}/></div>
              <div><label style={S.label}>Nome hebraico</label>
                <input style={{...S.input,width:'100%'}} type='text' value={form.hebrewName}
                  onChange={e=>setForm(p=>({...p,hebrewName:e.target.value}))}/></div>
              <div><label style={S.label}>Data hebraica</label>
                <input style={{...S.input,width:'100%'}} placeholder='ex: 15 Nissan' type='text'
                  value={form.hebrewDate} onChange={e=>setForm(p=>({...p,hebrewDate:e.target.value}))}/></div>
              <div style={{display:'flex',alignItems:'flex-end',gap:12,paddingBottom:4}}>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                  <input type='checkbox' checked={form.recurring}
                    onChange={e=>setForm(p=>({...p,recurring:e.target.checked}))}/> Recorrente
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                  <input type='checkbox' checked={form.erevStart}
                    onChange={e=>setForm(p=>({...p,erevStart:e.target.checked}))}/> Inicia na véspera
                </label>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button style={S.btn} onClick={()=>setShowForm(false)}>Cancelar</button>
              <button style={S.btnP} onClick={save}>Salvar feriado</button>
            </div>
          </div>
        )}
        <div style={{border:'0.5px solid var(--color-border-tertiary)',borderRadius:8,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={S.th}>Data</th><th style={S.th}>Dia</th>
              <th style={S.th}>Nome</th><th style={S.th}>Tipo</th>
              <th style={S.th}>Nome hebraico</th><th style={S.th}>Data hebraica</th>
              <th style={S.th}>Recorrente</th><th style={S.th}></th>
            </tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{...S.td,textAlign:'center',padding:'32px',
                    color:'var(--color-text-secondary)'}}>Carregando...</td></tr>
                : filtered.length === 0
                ? <tr><td colSpan={8} style={{...S.td,textAlign:'center',padding:'32px',
                    color:'var(--color-text-secondary)',fontStyle:'italic'}}>
                    Nenhum feriado encontrado para {year}.</td></tr>
                : filtered.map(h => {
                    const tc  = TYPE_COLORS[h.type] ?? {bg:'#F9FAFB',color:'#374151'};
                    const dow = new Date(h.date+'T12:00:00Z').getDay();
                    return (
                      <tr key={h.id}>
                        <td style={{...S.td,fontWeight:500}}>{fmtDate(h.date)}</td>
                        <td style={{...S.td,fontSize:11,color:
                          dow===4?'#C2410C':dow===2?'#C2410C':'#6B7280',
                          fontWeight:dow===4||dow===2?700:400}}>
                          {DOW_LABELS[dow]}
                          {(dow===4||dow===2)&&<span style={{marginLeft:4,fontSize:9,
                            padding:'1px 5px',borderRadius:10,background:'#FFF7ED',color:'#C2410C'}}>
                            PONTE
                          </span>}
                        </td>
                        <td style={{...S.td,fontWeight:500}}>{h.name}</td>
                        <td style={S.td}>
                          <span style={{fontSize:10,fontWeight:500,padding:'1px 7px',borderRadius:4,
                            background:tc.bg,color:tc.color}}>
                            {TYPE_LABELS[h.type]??h.type}
                          </span>
                        </td>
                        <td style={{...S.td,color:'#7E22CE'}}>{h.hebrewName??'--'}</td>
                        <td style={{...S.td,color:'#7E22CE'}}>{h.hebrewDate??'--'}</td>
                        <td style={S.td}>{h.recurring?'✓':'--'}</td>
                        <td style={S.td}>
                          <button style={S.btnDng} onClick={()=>remove(h.id)}>×</button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:12,lineHeight:1.6}}>
          Fonte: BrasilAPI (feriados nacionais). Feriados marcados com <b>PONTE</b> caem em
          quinta ou terça — veja a aba "Pontes Sugeridas" para registrar automaticamente.
        </div>
      </>)}
    </div>
  );
}
