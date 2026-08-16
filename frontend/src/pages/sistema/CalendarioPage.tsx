// frontend/src/pages/sistema/CalendarioPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';
import { SmartMonthInput } from '../../components/SmartMonthInput';

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = (s: any): Date => new Date(String(s).slice(0,10) + 'T12:00:00');
const fmtBR = (s: any) => parseDate(s).toLocaleDateString('pt-BR');

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const fmtDia = (s: any) => `${fmtBR(s)} ${SEMANA[parseDate(s).getDay()].toLowerCase()}`;
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
  const [filtroOpen, setFiltroOpen]       = useState(false);
  const [filtroInicio, setFiltroInicio]   = useState('');
  const [filtroFim, setFiltroFim]         = useState('');
  const [filtroLoading, setFiltroLoading] = useState(false);
  const [holidaysExtra, setHolidaysExtra] = useState<any[]>([]);


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
    // Extrai nome limpo do feriado: 'Ponte sugerida — Corpus Christi cai na quinta' -> 'Corpus Christi'
    const descricao = pendTip.replace(/Ponte sugerida\s*[—-]\s*/,'').replace(/\s*cai na.*$/,'').trim() || 'Ponte';
    try {
      await api.post('/hr/recesso', {
        tipo:'PONTE', descricao: `Ponte — ${descricao}`,
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

  const todasHolidaysPeriodo = useMemo(() => {
    const seen = new Set<string>();
    return [...holidays, ...holidaysExtra].filter((h:any) => {
      const k = String(h.date).slice(0,10)+'|'+h.type+'|'+h.name;
      return seen.has(k) ? false : (seen.add(k), true);
    });
  }, [holidays, holidaysExtra]);

  const buscarPontesPeriodo = async () => {
    if (!filtroInicio || !filtroFim) return;
    setFiltroLoading(true);
    try {
      const anoIni = parseInt(filtroInicio.slice(0,4));
      const anoFim = parseInt(filtroFim.slice(0,4));
      const anosNecessarios: number[] = [];
      for (let a=anoIni; a<=anoFim; a++) anosNecessarios.push(a);
      const anosCarregados = new Set([year, ...holidaysExtra.map((h:any)=>parseDate(h.date).getFullYear())]);
      const anosFaltantes = anosNecessarios.filter(a => !anosCarregados.has(a));
      if (anosFaltantes.length) {
        const respostas = await Promise.all(
          anosFaltantes.map(a => api.get('/calendar/holidays', { params:{ year:a } }))
        );
        const novos = respostas.flatMap(r => r.data ?? []);
        setHolidaysExtra(prev => [...prev, ...novos]);
      }
    } catch(e:any) {
      alert('Erro ao buscar feriados do período: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setFiltroLoading(false);
    }
  };

  const pontesPeriodo = useMemo(() => {
    if (!filtroInicio || !filtroFim) return [];
    const ini = parseDate(filtroInicio + '-01');
    const [fy, fm] = filtroFim.split('-').map(Number);
    const fim = new Date(fy, fm, 0);
    const dentroDoPeriodo = (d: Date) => d >= ini && d <= fim;

    const rangesRegistrados = recessos
      .filter((r:any) => r.tipo === 'PONTE')
      .map((r:any) => ({ inicio: parseDate(r.dataInicio), fim: parseDate(r.dataFim) }));
    const jaRegistrada = (d: Date) =>
      rangesRegistrados.some(rr => d >= rr.inicio && d <= rr.fim);

    const sugeridas: {data:Date,tipo:'SUGERIDA'|'REGISTRADA',descricao:string,detalhe:string,tip:string}[] = [];
    todasHolidaysPeriodo.forEach((h:any) => {
      if (!['NACIONAL','ESTADUAL','FACULTATIVO'].includes(h.type)) return;
      const d = parseDate(h.date);
      const dow = d.getDay();
      if (dow === 4) {
        const fri = new Date(d); fri.setDate(fri.getDate()+1);
        if (dentroDoPeriodo(fri) && !jaRegistrada(fri)) {
          sugeridas.push({data:fri, tipo:'SUGERIDA', descricao:`Ponte — ${h.name}`,
            detalhe:'Sugerida', tip:`Ponte sugerida — ${h.name} cai na quinta`});
        }
      }
      if (dow === 2) {
        const mon = new Date(d); mon.setDate(mon.getDate()-1);
        if (dentroDoPeriodo(mon) && !jaRegistrada(mon)) {
          sugeridas.push({data:mon, tipo:'SUGERIDA', descricao:`Ponte — ${h.name}`,
            detalhe:'Sugerida', tip:`Ponte sugerida — ${h.name} cai na terça`});
        }
      }
    });

    const registradas: typeof sugeridas = [];
    recessos.filter((r:any) => r.tipo === 'PONTE').forEach((r:any) => {
      const cur = parseDate(r.dataInicio), fimR = parseDate(r.dataFim);
      while (cur <= fimR) {
        if (dentroDoPeriodo(cur)) {
          registradas.push({data:new Date(cur), tipo:'REGISTRADA', descricao:r.descricao,
            detalhe:r.status, tip:`${r.descricao} — ${r.status}`});
        }
        cur.setDate(cur.getDate()+1);
      }
    });

    return [...registradas, ...sugeridas].sort((a,b)=>a.data.getTime()-b.data.getTime());
  }, [filtroInicio, filtroFim, todasHolidaysPeriodo, recessos]);

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
        <button onClick={()=>{setMonth(now.getMonth());setYear(now.getFullYear());}}
          style={{padding:'4px 10px',border:'1px solid #E5E7EB',borderRadius:6,
            background:'#fff',cursor:'pointer',fontSize:12}}>Hoje</button>
        {holidays.length === 0 && !loading && (
          <button onClick={importar}
            style={{padding:'5px 14px',border:'none',borderRadius:6,background:'#6C63FF',
              color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>
            ⬇ Gerar Calendário <b style={{background:'rgba(255,255,255,0.25)',
              padding:'0 5px',borderRadius:3}}>{year}</b>
          </button>
        )}
        {loading && <span style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Carregando...</span>}
        {<>
          <button onClick={()=>{setForm(f=>({...f,type:'MUNICIPAL'}));setModal('feriado');}}
            style={{padding:'5px 12px',border:'1px solid #E5E7EB',borderRadius:6,
              background:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>+ Feriado</button>
          <button onClick={()=>{setForm(f=>({...f,type:'PONTE'}));setModal('ponte');}}
            style={{padding:'5px 12px',border:'1px solid #E5E7EB',borderRadius:6,
              background:'#FFF7ED',color:'#C2410C',cursor:'pointer',fontSize:12,fontWeight:600}}>
            + Ponte
          </button>
          <button onClick={()=>setFiltroOpen(o=>!o)}
            style={{padding:'5px 12px',border:'1px solid '+(filtroOpen?'#6C63FF':'#E5E7EB'),
              borderRadius:6,background:filtroOpen?'#EEF2FF':'#fff',
              color:filtroOpen?'#6C63FF':'#374151',cursor:'pointer',fontSize:12,fontWeight:600}}>
            🔍 Filtrar Período
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

      {filtroOpen && (
        <div style={{background:'#F9FAFB',borderBottom:'1px solid #E5E7EB',padding:'14px 20px',
          flexShrink:0}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
            <div style={{width:150}}>
              <Lbl>De</Lbl>
              <SmartMonthInput value={filtroInicio} onChange={v=>setFiltroInicio(v)}/>
            </div>
            <div style={{width:150}}>
              <Lbl>Até</Lbl>
              <SmartMonthInput value={filtroFim} onChange={v=>setFiltroFim(v)}/>
            </div>
            <button onClick={buscarPontesPeriodo} disabled={!filtroInicio||!filtroFim||filtroLoading}
              style={{padding:'7px 16px',border:'none',borderRadius:6,background:'#6C63FF',
                color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600,
                opacity:(!filtroInicio||!filtroFim)?0.5:1}}>
              {filtroLoading ? 'Buscando...' : 'Buscar'}
            </button>
            <button onClick={()=>{setFiltroOpen(false);setFiltroInicio('');setFiltroFim('');}}
              style={{padding:'7px 14px',border:'1px solid #E5E7EB',borderRadius:6,
                background:'#fff',cursor:'pointer',fontSize:12}}>
              Fechar
            </button>
          </div>

          {filtroInicio && filtroFim && !filtroLoading && (
            <div style={{marginTop:14,maxHeight:260,overflow:'auto',
              border:'1px solid #E5E7EB',borderRadius:8,background:'#fff'}}>
              {pontesPeriodo.length === 0 ? (
                <div style={{padding:'16px',fontSize:12,color:'#9CA3AF',textAlign:'center'}}>
                  Nenhuma ponte encontrada no período selecionado.
                </div>
              ) : pontesPeriodo.map((p,i)=>(
                <div key={i} onClick={()=>{
                    if (p.tipo==='SUGERIDA') {
                      setPendYMD(toYMD(p.data)); setPendTip(p.tip); setModal('confirm');
                    }
                  }}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                    borderBottom:i<pontesPeriodo.length-1?'1px solid #F3F4F6':'none',
                    cursor:p.tipo==='SUGERIDA'?'pointer':'default',fontSize:12}}>
                  <span style={{width:10,height:10,borderRadius:2,flexShrink:0,
                    background:p.tipo==='SUGERIDA'?'#FED7AA':'#F97316',
                    border:p.tipo==='SUGERIDA'?'1px solid #F97316':'none'}}/>
                  <span style={{width:108,fontWeight:600,color:'#374151'}}>{fmtDia(toYMD(p.data))}</span>
                  <span style={{flex:1,color:'#374151'}}>{p.descricao}</span>
                  <span style={{fontSize:11,color:p.tipo==='SUGERIDA'?'#9A3412':'#6B7280',
                    fontWeight:600}}>
                    {p.tipo==='SUGERIDA' ? '🌉 Sugerida — clique p/ confirmar' : `✓ ${p.detalhe}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                      if (ev.isSugg) {
                        setPendYMD(ymd); setPendTip(ev.tip); setModal('confirm');
                      }
                    }}
                    onMouseEnter={e=>{
                      const rc=(e.target as HTMLElement).getBoundingClientRect();
                      setTip({x:rc.left,y:rc.top-32,
                        t:ev.tip+(ev.isSugg?' — clique para confirmar':'')});
                    }}
                    onMouseLeave={()=>setTip(null)}
                    style={{fontSize:10,fontWeight:600,padding:'1px 4px',borderRadius:3,
                      background:ev.bg,color:ev.fg,marginBottom:2,
                      overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',
                      cursor:ev.isSugg?'pointer':'default',
                      outline:ev.isSugg?'1.5px dashed #9A3412':'none',
                      outlineOffset:1}}>
                    {ev.isSugg ? '🌉 ✓ Confirmar ponte' : ev.label}
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
                <SmartDateInput value={form.date}
                  onChange={v=>setForm(f=>({...f,date:v}))}/>
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
