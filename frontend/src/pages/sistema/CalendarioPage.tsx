// frontend/src/pages/sistema/CalendarioPage.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface Holiday {
  id: string; date: string; name: string; type: string;
  state?: string; city?: string; recurring: boolean;
  hebrewName?: string; hebrewDate?: string; erevStart?: boolean;
}

const fmtDate = (s: string) => new Date(s+'T12:00:00Z').toLocaleDateString('pt-BR');
const TYPE_LABELS: Record<string,string> = {
  NACIONAL:'Nacional', ESTADUAL:'Estadual', MUNICIPAL:'Municipal',
  JUDAICO:'Judaico', FACULTATIVO:'Facultativo'
};
const TYPE_COLORS: Record<string,{bg:string,color:string}> = {
  NACIONAL: {bg:'#EFF6FF',color:'#1D4ED8'},
  ESTADUAL: {bg:'#F0FDF4',color:'#15803D'},
  MUNICIPAL:{bg:'#FEFCE8',color:'#854D0E'},
  JUDAICO:  {bg:'#FDF4FF',color:'#7E22CE'},
  FACULTATIVO:{bg:'#F9FAFB',color:'#6B7280'},
};

export function CalendarioPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date:'', name:'', type:'JUDAICO', state:'', city:'',
    recurring:false, hebrewName:'', hebrewDate:'', erevStart:false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/calendar/holidays', { params: { year } });
      setHolidays(r.data ?? []);
    } catch { setMsg('Erro ao carregar'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

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
      setForm({date:'',name:'',type:'JUDAICO',state:'',city:'',recurring:false,hebrewName:'',hebrewDate:'',erevStart:false});
      load();
    } catch { setMsg('Erro ao salvar'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir?')) return;
    try {
      await api.delete('/calendar/holidays/' + id);
      load();
    } catch { setMsg('Erro ao excluir'); }
  };

  const filtered = typeFilter ? holidays.filter(h => h.type === typeFilter) : holidays;
  const S = {
    page: {padding:'24px 0', fontFamily:'var(--font-sans,system-ui)', fontSize:14, color:'var(--color-text-primary)'} as React.CSSProperties,
    badge: {display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:'#F9FAFB',color:'#374151'} as React.CSSProperties,
    card: {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:10,padding:'14px 16px',marginBottom:16} as React.CSSProperties,
    input: {height:32,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 9px',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'} as React.CSSProperties,
    btn: {height:30,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 12px',fontSize:12,cursor:'pointer',background:'var(--color-background-primary)',color:'var(--color-text-primary)'} as React.CSSProperties,
    btnP: {height:30,border:'none',borderRadius:6,padding:'0 14px',fontSize:12,cursor:'pointer',background:'#111',color:'#fff',fontWeight:500} as React.CSSProperties,
    btnDng: {height:26,border:'0.5px solid #FCA5A5',borderRadius:5,padding:'0 8px',fontSize:11,cursor:'pointer',background:'#FEF2F2',color:'#B91C1C'} as React.CSSProperties,
    th: {background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontSize:10,fontWeight:500,textTransform:'uppercase' as const,letterSpacing:'.3px',padding:'8px 10px',textAlign:'left' as const,borderBottom:'0.5px solid var(--color-border-tertiary)'} as React.CSSProperties,
    td: {padding:'7px 10px',borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12} as React.CSSProperties,
    label: {fontSize:10,textTransform:'uppercase' as const,letterSpacing:'.3px',color:'var(--color-text-secondary)',display:'block',marginBottom:4},
  };

  return (
    <div style={S.page}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <span style={S.badge}>⚙ Sistema</span>
        <span style={{fontSize:15,fontWeight:500}}>Calendario de Feriados</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <input style={{...S.input,width:80}} type='number' min={2020} max={2030} value={year} onChange={e=>setYear(parseInt(e.target.value))}/>
          <select style={{...S.input,width:140}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value=''>Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <button style={S.btn} onClick={importYear} disabled={importing}>{importing?'Importando...':'Importar '+year+' (BrasilAPI)'}</button>
          <button style={S.btnP} onClick={()=>setShowForm(v=>!v)}>+ Adicionar</button>
        </div>
      </div>

      {msg && <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#15803D',marginBottom:12}}>{msg}<button style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',color:'#15803D'}} onClick={()=>setMsg('')}>x</button></div>}

      {showForm && (
        <div style={{...S.card,border:'0.5px solid #7E22CE'}}>
          <p style={{fontSize:11,fontWeight:600,color:'#7E22CE',textTransform:'uppercase' as const,letterSpacing:'.3px',marginBottom:12}}>Novo Feriado</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:12}}>
            <div><label style={S.label}>Data *</label><input style={{...S.input,width:'100%'}} type='date' value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
            <div><label style={S.label}>Nome *</label><input style={{...S.input,width:'100%'}} type='text' value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
            <div><label style={S.label}>Tipo</label>
              <select style={{...S.input,width:'100%'}} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Estado (UF)</label><input style={{...S.input,width:'100%'}} type='text' maxLength={2} value={form.state} onChange={e=>setForm(p=>({...p,state:e.target.value.toUpperCase()}))}/></div>
            <div><label style={S.label}>Nome hebraico</label><input style={{...S.input,width:'100%'}} type='text' value={form.hebrewName} onChange={e=>setForm(p=>({...p,hebrewName:e.target.value}))}/></div>
            <div><label style={S.label}>Data hebraica</label><input style={{...S.input,width:'100%'}} placeholder='ex: 15 Nissan' type='text' value={form.hebrewDate} onChange={e=>setForm(p=>({...p,hebrewDate:e.target.value}))}/></div>
            <div style={{display:'flex',alignItems:'flex-end',gap:12,paddingBottom:4}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                <input type='checkbox' checked={form.recurring} onChange={e=>setForm(p=>({...p,recurring:e.target.checked}))}/> Recorrente
              </label>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                <input type='checkbox' checked={form.erevStart} onChange={e=>setForm(p=>({...p,erevStart:e.target.checked}))}/> Inicia na vespera
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
            <th style={S.th}>Data</th><th style={S.th}>Nome</th><th style={S.th}>Tipo</th>
            <th style={S.th}>Nome hebraico</th><th style={S.th}>Data hebraica</th>
            <th style={S.th}>Vespera</th><th style={S.th}>Recorrente</th><th style={S.th}></th>
          </tr></thead>
          <tbody>
            {loading
              ? <tr><td colSpan={8} style={{...S.td,textAlign:'center' as const,padding:'32px',color:'var(--color-text-secondary)'}}>Carregando...</td></tr>
              : filtered.length === 0
              ? <tr><td colSpan={8} style={{...S.td,textAlign:'center' as const,padding:'32px',color:'var(--color-text-secondary)',fontStyle:'italic'}}>Nenhum feriado encontrado para {year}.</td></tr>
              : filtered.map(h => {
                  const tc = TYPE_COLORS[h.type] ?? {bg:'#F9FAFB',color:'#374151'};
                  return (
                    <tr key={h.id} style={{background:'transparent'}}>
                      <td style={S.td}>{fmtDate(h.date)}</td>
                      <td style={{...S.td,fontWeight:500}}>{h.name}</td>
                      <td style={S.td}><span style={{fontSize:10,fontWeight:500,padding:'1px 7px',borderRadius:4,background:tc.bg,color:tc.color}}>{TYPE_LABELS[h.type]??h.type}</span></td>
                      <td style={{...S.td,color:'#7E22CE'}}>{h.hebrewName??'--'}</td>
                      <td style={{...S.td,color:'#7E22CE'}}>{h.hebrewDate??'--'}</td>
                      <td style={S.td}>{h.erevStart?'✓':'--'}</td>
                      <td style={S.td}>{h.recurring?'✓':'--'}</td>
                      <td style={S.td}><button style={S.btnDng} onClick={()=>remove(h.id)}>X</button></td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
      <div style={{fontSize:11,color:'var(--color-text-secondary)',marginTop:12,lineHeight:1.6}}>
        Fonte: BrasilAPI (feriados nacionais). Feriados judaicos devem ser adicionados manualmente.
        Feriados estaduais e municipais podem ser adicionados conforme necessidade de cada empresa.
      </div>
    </div>
  );
}
