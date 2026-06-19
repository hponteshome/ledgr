// frontend/src/pages/sistema/CalendarioPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s: any): Date => new Date(String(s).slice(0,10) + 'T12:00:00');
const fmtBR = (s: any) => parseDate(s).toLocaleDateString('pt-BR');

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const TYPE_COLOR: Record<string,{bg:string,fg:string}> = {
  NACIONAL:    {bg:'#1D4ED8',fg:'#fff'},
  ESTADUAL:    {bg:'#15803D',fg:'#fff'},
  MUNICIPAL:   {bg:'#854D0E',fg:'#fff'},
  FACULTATIVO: {bg:'#6B7280',fg:'#fff'},
  JUDAICO:     {bg:'#7E22CE',fg:'#fff'},
};
const LEGENDA = [
  {bg:'#1D4ED8',label:'Feriado Nacional'},
  {bg:'#15803D',label:'Estadual'},
  {bg:'#854D0E',label:'Municipal'},
  {bg:'#FED7AA',label:'Ponte Sugerida'},
  {bg:'#F97316',label:'Ponte Registrada'},
  {bg:'#8B5CF6',label:'Recesso'},
  {bg:'#059669',label:'Férias'},
];

const Inp = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:6,
    padding:'6px 10px',fontSize:13,outline:'none',boxSizing:'border-box',...(p.style??{})}}/>;
const Lbl = ({children}:{children:React.ReactNode}) =>
  <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
    display:'block',marginBottom:4}}>{children}</label>;
const Sel = (p: React.SelectHTMLAttributes<HTMLSelectElement> & {children:React.ReactNode}) =>
  <select {...p} style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:6,
    padding:'6px 10px',fontSize:13,outline:'none',...(p.style??{})}}>{p.children}</select>;

export function CalendarioPage() {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth());
  const [holidays,setHolidays]= useState<any[]>([]);
  const [recessos,setRecessos]= useState<any[]>([]);
  const [ferias,  setFerias]  = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tip,     setTip]     = useState<{x:number,y:number,t:string}|null>(null);
  const [modal,   setModal]   = useState<'feriado'|'ponte'|'confirm'|null>(null);
  const [pendYMD, setPendYMD] = useState('');
  const [pendTip, setPendTip] = useState('');
  const [form, setForm] = useState({
    date:'', name:'', type:'MUNICIPAL', state:'', city:'', recurring:false
  });

  const { user } = useAuth() as any;
  // Checa permissao master — permissions.all ou profileName
  const isMaster = user?.permissions?.all === true
    || (user as any)?.profileName === 'Administrador Master'
    || (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('@ledgr:user') ?? '{}');
        return stored?.permissions?.all === true
          || stored?.profileName === 'Administrador Master';
      } catch { return false; }
    })();

  const load = async () => {
    setLoading(true);
    try {
      const [h,r,f] = await Promise.all([
        api.get('/calendar/holidays', { params:{ year } }),
        api.get('/hr/recesso').catch(()=>({data:[]})),
        api.get('/hr/ferias/programacoes').catch(()=>({data:[]})),
      ]);
      const seen = new Set<string>();
      const deduped = (h.data ?? []).filter((x:any) => {
        const k = String(x.date).slice(0,10)+'|'+x.type+'|'+x.name;
        return seen.has(k) ? false : (seen.add(k), true);
      });
      setHolidays(deduped);
      setRecessos(r.data ?? []);
      setFerias(f.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year]);

  const importar = async () => {
    setLoading(true);
    try {
      const r = await api.post('/calendar/holidays/import/' + year);
      alert(`Importados ${r.data.imported ?? 0} feriados de ${year}`);
      await load();
    } catch(e:any) {
      alert('Erro: ' + (e?.response?.data?.message ?? e.message));
      setLoading(false);
    }
  };

  const confirmarPonte = async () => {
    try {
      await api.post('/hr/recesso', {
        tipo:'PONTE', descricao: pendTip || 'Ponte',
        dataInicio: pendYMD, dataFim: pendYMD,
      });
      setModal(null); load();
    } catch(e:any) { alert('Erro: ' + (e?.response?.data?.message ?? e.message)); }
  };

  const salvar = async () => {
    if (!form.date || !form.name) return;
    try {
      if (modal === 'ponte') {
        await api.post('/hr/recesso', {
          tipo:'PONTE', descricao:form.name,
          dataInicio:form.date, dataFim:form.date,
        });
      } else {
        await api.post('/calendar/holidays', form);
      }
      setModal(null);
      setForm({date:'',name:'',type:'MUNICIPAL',state:'',city:'',recurring:false});
      load();
    } catch(e:any) { alert('Erro: ' + (e?.response?.data?.message ?? e.message)); }
  };

  const evMap = useMemo(() => {
    const map: Record<string, {label:string,bg:string,fg:string,tip:string,isSugg?:boolean}[]> = {};
    const add = (ymd:string, ev:typeof map[string][0]) => {
      (map[ymd] = map[ymd] ?? []).push(ev);
    };
    const recessoDays = new Set<string>();
    recessos.forEach((r:any) => {
      const cur = parseDate(r.dataInicio), fim = parseDate(r.dataFim);
      while (cur <= fim) { recessoDays.add(toYMD(cur)); cur.setDate(cur.getDate()+1); }
    });
    holidays.forEach((h:any) => {
      const d   = parseDate(h.date);
      const ymd = toYMD(d);
      const dow = d.getDay();
      const c   = TYPE_COLOR[h.type] ?? {bg:'#374151',fg:'#fff'};
      add(ymd, { label:h.name, bg:c.bg, fg:c.fg, tip:`${h.name} — ${h.type}` });
      if (['NACIONAL','ESTADUAL','FACULTATIVO'].includes(h.type)) {
        if (dow === 4) {
          const fri = new Date(d); fri.setDate(fri.getDate()+1);
          const fy = toYMD(fri);
          if (!recessoDays.has(fy))
            add(fy, {label:'🌉 Ponte sugerida',bg:'#FED7AA',fg:'#9A3412',
              tip:`Ponte sugerida — ${h.name} cai na quinta`,isSugg:true});
        }
        if (dow === 2) {
          const mon = new Date(d); mon.setDate(mon.getDate()-1);
          const my = toYMD(mon);
          if (!recessoDays.has(my))
            add(my, {label:'🌉 Ponte sugerida',bg:'#FED7AA',fg:'#9A3412',
              tip:`Ponte sugerida — ${h.name} cai na terça`,isSugg:true});
        }
      }
    });
    recessos.forEach((r:any) => {
      const cur = parseDate(r.dataInicio), fim = parseDate(r.dataFim);
      const isPonte = r.tipo === 'PONTE';
      while (cur <= fim) {
        add(toYMD(cur), {
          label: isPonte ? `🌉 ${r.descricao}` : `🏖️ ${r.descricao}`,
          bg: isPonte ? '#F97316' : '#8B5CF6', fg:'#fff',
          tip:`${r.descricao} — ${r.status}`,
        });
        cur.setDate(cur.getDate()+1);
      }
    });
    ferias.forEach((f:any) => {
      const cur = parseDate(f.dataInicio), fim = parseDate(f.dataFim);
      const nome = (f.employee?.fullName ?? 'Férias').split(' ')[0];
      while (cur <= fim) {
        add(toYMD(cur), {
          label:`🌴 ${nome}`, bg:'#059669', fg:'#fff',
          tip:`Férias: ${f.employee?.fullName} — ${f.diasFerias}d`,
        });
        cur.setDate(cur.getDate()+1);
      }
    });
    return map;
  }, [holidays, recessos, ferias]);

  const grade = useMemo(() => {
    const cells: (Date|null)[] = [];
    const ini = new Date(year, month, 1);
    const fim = new Date(year, month+1, 0);
    for (let i=0; i<ini.getDay(); i++) cells.push(null);
    for (let d=1; d<=fim.getDate(); d++) cells.push(new Date(year,month,d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [year, month]);

  const hoje = toYMD(new Date());
  const prev = () => month===0 ? (setMonth(11), setYear(y=>y-1)) : setMonth(m=>m-1);
  const next = () => month===11 ? (setMonth(0),  setYear(y=>y+1)) : setMonth(m=>m+1);

  const ov = {position:'fixed' as const,inset:0,background:'rgba(0,0,0,0.4)',
    display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000};
  const box = {background:'#fff',borderRadius:14,width:460,padding:24,
    boxShadow:'0 20px 60px rgba(0,0,0,.2)'} as React.CSSProperties;

  return (
    <div style={{fontFamily:'system-ui',display:'flex',flexDirection:'column',height:'100%'}}>

      {/* Barra */}
      <div style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'10px 20px',
        display:'flex',alignItems:'center',gap:8,flexShrink:0,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#6C63FF'}}>◆ SISTEMA</span>
        <button onClick={prev} style={{width:26,height:26,border:'1px solid #E5E7EB',
          borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
        <span style={{fontSize:16,fontWeight:700,minWidth:140,textAlign:'center'}}>
          {MESES[month]}
        </span>
        <input type='number' min={2020} max={2035} value={year}
          onChange={e=>setYear(parseInt(e.target.value)||year)}
          style={{width:68,border:'1px solid #E5E7EB',borderRadius:6,padding:'4px 8px',
            fontSize:14,fontWeight:700,textAlign:'center',outline:'none'}}/>
        <button onClick={next} style={{width:26,height:26,border:'1px solid #E5E7EB',
          borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16}}>›</button>
        {isMaster && holidays.some((_:any)=>true) && (
          <span style={{fontSize:11,color:'#9A3412',background:'#FFF7ED',
            padding:'3px 8px',borderRadius:6,border:'1px dashed #F97316'}}>
            💡 Clique nas pontes sugeridas para confirmar
          </span>
        )}
        <button onClick={()=>{setMonth(now.getMonth());setYear(now.getFullYear());}}
          style={{padding:'4px 10px',border:'1px solid #E5E7EB',borderRadius:6,
            background:'#fff',cursor:'pointer',fontSize:12}}>Hoje</button>
        <button onClick={importar} disabled={loading}
          style={{padding:'5px 14px',border:'none',borderRadius:6,background:'#6C63FF',
            color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,opacity:loading?0.6:1}}>
          {loading ? 'Aguarde...' : ('⬇ Gerar Calendário ' + year)}
        </button>
        {isMaster && <>
          <button onClick={()=>{setForm(f=>({...f,type:'MUNICIPAL'}));setModal('feriado');}}
            style={{padding:'5px 12px',border:'1px solid #E5E7EB',borderRadius:6,
              background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>+ Feriado</button>
          <button onClick={()=>{setForm(f=>({...f,type:'PONTE'}));setModal('ponte');}}
            style={{padding:'5px 12px',border:'1px solid #E5E7EB',borderRadius:6,
              background:'#FFF7ED',color:'#C2410C',cursor:'pointer',fontSize:12,fontWeight:600}}>
            + Ponte
          </button>
        </>}
        <div style={{marginLeft:'auto',display:'flex',gap:8,flexWrap:'wrap'}}>
          {LEGENDA.map(l=>(
            <span key={l.label} style={{display:'flex',alignItems:'center',gap:3,fontSize:11}}>
              <span style={{width:10,height:10,borderRadius:2,background:l.bg,
                border:l.bg==='#FED7AA'?'1px solid #F97316':'none',display:'inline-block'}}/>
              <span style={{color:'#6B7280'}}>{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Grade */}
      <div style={{flex:1,overflow:'auto',padding:'0 20px 20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',
          background:'#F9FAFB',borderBottom:'1px solid #E5E7EB'}}>
          {SEMANA.map((d,i)=>(
            <div key={d} style={{padding:'8px 0',textAlign:'center',fontSize:11,fontWeight:600,
              color:i===0?'#EF4444':i===6?'#3B82F6':'#6B7280',textTransform:'uppercase'}}>
              {d}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',
          border:'1px solid #E5E7EB',borderTop:'none'}}>
          {grade.map((d,idx)=>{
            if (!d) return <div key={`x${idx}`} style={{minHeight:90,background:'#F9FAFB',
              borderRight:'1px solid #E5E7EB',borderBottom:'1px solid #E5E7EB'}}/>;
            const ymd = toYMD(d);
            const evs = evMap[ymd] ?? [];
            const dow = d.getDay();
            const isHj= ymd===hoje;
            return (
              <div key={ymd} style={{minHeight:90,padding:'4px 5px',
                borderRight:'1px solid #E5E7EB',borderBottom:'1px solid #E5E7EB',
                background:isHj?'#FAFAFF':(dow===0||dow===6)?'#FAFAFA':'#fff'}}>
                <div style={{width:22,height:22,borderRadius:'50%',display:'flex',
                  alignItems:'center',justifyContent:'center',marginBottom:2,
                  background:isHj?'#6C63FF':'transparent',
                  color:isHj?'#fff':dow===0?'#EF4444':dow===6?'#3B82F6':'#374151',
                  fontSize:12,fontWeight:isHj?700:400}}>
                  {d.getDate()}
                </div>
                {evs.slice(0,3).map((ev,i)=>(
                  <div key={i}
                    onClick={()=>{
                      if (isMaster && ev.isSugg) {
                        setPendYMD(ymd); setPendTip(ev.tip); setModal('confirm');
                      }
                    }}
                    onMouseEnter={e=>{
                      const rc=(e.target as HTMLElement).getBoundingClientRect();
                      setTip({x:rc.left,y:rc.top-32,
                        t:ev.tip+(ev.isSugg&&isMaster?' — clique para confirmar':'')});
                    }}
                    onMouseLeave={()=>setTip(null)}
                    style={{fontSize:10,fontWeight:600,padding:'1px 4px',borderRadius:3,
                      background:ev.bg,color:ev.fg,marginBottom:2,
                      overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',
                      cursor:ev.isSugg&&isMaster?'pointer':'default',
                      outline:ev.isSugg&&isMaster?'1.5px dashed #9A3412':'none',
                      outlineOffset:1}}>
                    {ev.isSugg && isMaster ? '🌉 ✓ Confirmar ponte' : ev.label}
                  </div>
                ))}
                {evs.length>3&&<div style={{fontSize:9,color:'#9CA3AF'}}>+{evs.length-3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal confirmar ponte sugerida */}
      {modal==='confirm' && (
        <div style={ov}><div style={box}>
          <h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700}}>Confirmar Ponte</h3>
          <p style={{fontSize:13,color:'#6B7280',margin:'0 0 8px'}}>{pendTip}</p>
          <p style={{fontSize:13,margin:'0 0 16px'}}>
            Data: <b>{fmtBR(pendYMD)}</b>
          </p>
          <p style={{fontSize:12,color:'#374151',background:'#FFF7ED',borderRadius:8,
            padding:'10px 12px',margin:'0 0 16px'}}>
            A ponte será registrada como Recesso e poderá ser aplicada para todos
            os funcionários em <b>RH → Recessos &amp; Pontes</b>.
          </p>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <button onClick={()=>setModal(null)}
              style={{padding:'7px 16px',borderRadius:8,border:'1px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={confirmarPonte}
              style={{padding:'7px 18px',borderRadius:8,border:'none',background:'#F97316',
                color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
              ✓ Confirmar Ponte
            </button>
          </div>
        </div></div>
      )}

      {/* Modal adicionar feriado ou ponte manual */}
      {(modal==='feriado'||modal==='ponte') && (
        <div style={ov}><div style={box}>
          <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700}}>
            {modal==='ponte' ? '🌉 Registrar Ponte' : '📅 Adicionar Feriado'}
          </h3>
          <div style={{display:'grid',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><Lbl>Data *</Lbl>
                <Inp type="date" value={form.date}
                  onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
              </div>
              {modal==='feriado' && (
                <div><Lbl>Tipo</Lbl>
                  <Sel value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option value="NACIONAL">Nacional</option>
                    <option value="ESTADUAL">Estadual</option>
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="FACULTATIVO">Facultativo</option>
                  </Sel>
                </div>
              )}
            </div>
            <div><Lbl>Nome *</Lbl>
              <Inp type="text" value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder={modal==='ponte'
                  ? 'Ex: Ponte Corpus Christi'
                  : 'Ex: Aniversário de Curitiba'}/>
            </div>
            {modal==='feriado' && ['ESTADUAL','MUNICIPAL'].includes(form.type) && (
              <div>
                <Lbl>Localidade</Lbl>
                <div style={{display:'grid',
                  gridTemplateColumns:form.type==='MUNICIPAL'?'110px 1fr':'1fr',gap:8}}>
                  <Sel value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))}>
                    <option value="">UF</option>
                    {UF_LIST.map((uf:string)=>(
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </Sel>
                  {form.type==='MUNICIPAL' && (
                    <Inp type="text" value={form.city}
                      onChange={e=>setForm(f=>({...f,city:e.target.value}))}
                      placeholder="Nome do município"/>
                  )}
                </div>
                <div style={{fontSize:11,color:'#9CA3AF',marginTop:4}}>
                  {form.type==='ESTADUAL'
                    ? 'Aparecerá para empresas no estado selecionado'
                    : 'Aparecerá para empresas no município selecionado'}
                </div>
              </div>
            )}
            {modal==='feriado' && (
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
                <input type="checkbox" checked={form.recurring}
                  onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}/>
                Recorrente (repete todo ano)
              </label>
            )}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)}
              style={{padding:'7px 16px',borderRadius:8,border:'1px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={salvar} disabled={!form.date||!form.name}
              style={{padding:'7px 18px',borderRadius:8,border:'none',
                background:modal==='ponte'?'#F97316':'#6C63FF',
                color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
              {modal==='ponte' ? 'Registrar Ponte' : 'Salvar Feriado'}
            </button>
          </div>
        </div></div>
      )}

      {tip && (
        <div style={{position:'fixed',top:tip.y,left:tip.x,background:'rgba(0,0,0,.85)',
          color:'#fff',fontSize:11,padding:'4px 10px',borderRadius:6,zIndex:9999,
          pointerEvents:'none',maxWidth:280}}>
          {tip.t}
        </div>
      )}
    </div>
  );
}
