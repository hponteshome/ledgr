// frontend/src/pages/sistema/CalendarioPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

const fmtYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

interface DayEvent {
  label:  string;
  color:  string;
  bg:     string;
  tipo:   string;
  full?:  string;  // tooltip
}

export function CalendarioPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [holidays,  setHolidays]  = useState<any[]>([]);
  const [recessos,  setRecessos]  = useState<any[]>([]);
  const [ferias,    setFerias]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tooltip,   setTooltip]   = useState<{x:number,y:number,text:string}|null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [h, r, f] = await Promise.all([
        api.get('/calendar/holidays', { params: { year } }),
        api.get('/hr/recesso').catch(() => ({ data: [] })),
        api.get('/hr/ferias/programacoes').catch(() => ({ data: [] })),
      ]);
      setHolidays(h.data ?? []);
      setRecessos(r.data ?? []);
      setFerias(f.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year]);

  // ── Monta mapa de eventos por dia ───────────────────────────────────────
  const eventMap = useMemo<Record<string, DayEvent[]>>(() => {
    const map: Record<string, DayEvent[]> = {};
    const add = (ymd: string, ev: DayEvent) => {
      if (!map[ymd]) map[ymd] = [];
      map[ymd].push(ev);
    };

    // Feriados
    holidays.forEach((h: any) => {
      const d = new Date(h.date + 'T12:00:00Z');
      const ymd = fmtYMD(d);
      const dow = d.getDay();
      const colors: Record<string,{bg:string,color:string}> = {
        NACIONAL:    {bg:'#1D4ED8',color:'#fff'},
        ESTADUAL:    {bg:'#15803D',color:'#fff'},
        MUNICIPAL:   {bg:'#854D0E',color:'#fff'},
        FACULTATIVO: {bg:'#6B7280',color:'#fff'},
        JUDAICO:     {bg:'#7E22CE',color:'#fff'},
      };
      const c = colors[h.type] ?? {bg:'#374151',color:'#fff'};
      add(ymd, { label: h.name, bg: c.bg, color: c.color, tipo: 'feriado',
                 full: `${h.name} (${h.type})` });

      // Sugere ponte automaticamente
      if (['NACIONAL','ESTADUAL','FACULTATIVO'].includes(h.type)) {
        if (dow === 4) { // quinta → sexta
          const fri = new Date(d); fri.setDate(fri.getDate()+1);
          add(fmtYMD(fri), { label:'🌉 Ponte sugerida', bg:'#FED7AA', color:'#9A3412',
            tipo:'ponte-sugerida', full:`Ponte sugerida após ${h.name}` });
        }
        if (dow === 2) { // terça → segunda
          const mon = new Date(d); mon.setDate(mon.getDate()-1);
          add(fmtYMD(mon), { label:'🌉 Ponte sugerida', bg:'#FED7AA', color:'#9A3412',
            tipo:'ponte-sugerida', full:`Ponte sugerida antes de ${h.name}` });
        }
      }
    });

    // Recessos e Pontes (por periodo)
    recessos.forEach((r: any) => {
      const ini = new Date(r.dataInicio + 'T12:00:00Z');
      const fim = new Date(r.dataFim   + 'T12:00:00Z');
      const cur = new Date(ini);
      const isPonte = r.tipo === 'PONTE';
      while (cur <= fim) {
        const ymd = fmtYMD(cur);
        // Remove sugestao de ponte se ja registrada
        if (map[ymd]) map[ymd] = map[ymd].filter(e => e.tipo !== 'ponte-sugerida');
        add(ymd, {
          label: isPonte ? `🌉 ${r.descricao}` : `🏖️ ${r.descricao}`,
          bg:    isPonte ? '#F97316' : '#8B5CF6',
          color: '#fff',
          tipo:  isPonte ? 'ponte' : 'recesso',
          full:  `${r.descricao} (${r.status})`,
        });
        cur.setDate(cur.getDate()+1);
      }
    });

    // Ferias (por periodo)
    ferias.forEach((f: any) => {
      const ini = new Date(f.dataInicio + 'T12:00:00Z');
      const fim = new Date(f.dataFim   + 'T12:00:00Z');
      const cur = new Date(ini);
      const nome = f.employee?.fullName?.split(' ')[0] ?? 'Férias';
      while (cur <= fim) {
        const ymd = fmtYMD(cur);
        add(ymd, {
          label: `🌴 ${nome}`,
          bg:    '#059669',
          color: '#fff',
          tipo:  'ferias',
          full:  `Férias: ${f.employee?.fullName} (${f.diasFerias}d)`,
        });
        cur.setDate(cur.getDate()+1);
      }
    });

    return map;
  }, [holidays, recessos, ferias]);

  // ── Gera os dias do mes no grid ─────────────────────────────────────────
  const calDays = useMemo(() => {
    const days: (Date|null)[] = [];
    const first = new Date(year, month, 1);
    const last  = new Date(year, month+1, 0);
    // Preenche dias vazios no inicio (semana comeca domingo)
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    // Preenche dias vazios no fim
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y-1); }
    else setMonth(m => m-1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y+1); }
    else setMonth(m => m+1);
  };

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  };

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)',fontSize:14,color:'#111',
      display:'flex',flexDirection:'column',height:'100%'}}>

      {/* ── Navegacao ─────────────────────────────────────────────────────── */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',
        padding:'12px 24px',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:'#6C63FF'}}>◆ SISTEMA</span>
        <button onClick={prevMonth}
          style={{width:28,height:28,border:'0.5px solid #E5E7EB',borderRadius:6,
            background:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
        <h1 style={{fontSize:18,fontWeight:700,color:'#111',margin:0,minWidth:220,textAlign:'center'}}>
          {MESES[month]} {year}
        </h1>
        <button onClick={nextMonth}
          style={{width:28,height:28,border:'0.5px solid #E5E7EB',borderRadius:6,
            background:'#fff',cursor:'pointer',fontSize:16}}>›</button>
        <button onClick={()=>{setMonth(now.getMonth());setYear(now.getFullYear());}}
          style={{padding:'5px 12px',border:'0.5px solid #E5E7EB',borderRadius:6,
            background:'#fff',cursor:'pointer',fontSize:12}}>Hoje</button>
        {loading && <span style={{fontSize:12,color:'#9CA3AF'}}>Carregando...</span>}

        {/* Legenda */}
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          {[
            {bg:'#1D4ED8',label:'Feriado Nacional'},
            {bg:'#15803D',label:'Estadual'},
            {bg:'#F97316',label:'Ponte Registrada'},
            {bg:'#FED7AA',label:'Ponte Sugerida',color:'#9A3412'},
            {bg:'#8B5CF6',label:'Recesso'},
            {bg:'#059669',label:'Férias'},
          ].map(l=>(
            <span key={l.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}>
              <span style={{width:10,height:10,borderRadius:2,background:l.bg,display:'inline-block'}}/>
              <span style={{color:'#6B7280'}}>{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Grid do calendario ─────────────────────────────────────────────── */}
      <div style={{flex:1,overflow:'auto',padding:'0 24px 24px'}}>
        {/* Cabecalho dos dias da semana */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',
          borderBottom:'0.5px solid #E5E7EB',background:'#F9FAFB'}}>
          {DIAS_SEMANA.map(d=>(
            <div key={d} style={{padding:'8px 0',textAlign:'center',fontSize:11,
              fontWeight:600,color:d==='Dom'?'#EF4444':d==='Sáb'?'#3B82F6':'#6B7280',
              textTransform:'uppercase',letterSpacing:'.5px'}}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',
          border:'0.5px solid #E5E7EB',borderTop:'none'}}>
          {calDays.map((d, idx) => {
            if (!d) return (
              <div key={`e${idx}`} style={{minHeight:100,background:'#FAFAFA',
                borderRight:'0.5px solid #F0F0F0',borderBottom:'0.5px solid #F0F0F0'}}/>
            );
            const ymd    = fmtYMD(d);
            const events = eventMap[ymd] ?? [];
            const dow    = d.getDay();
            const isWknd = dow===0 || dow===6;
            const today  = isToday(d);
            return (
              <div key={ymd}
                style={{minHeight:100,padding:'4px 6px',
                  borderRight:'0.5px solid #E5E7EB',
                  borderBottom:'0.5px solid #E5E7EB',
                  background:today?'#FAFAFF':isWknd?'#FAFAFA':'#fff',
                  position:'relative'}}>
                {/* Numero do dia */}
                <div style={{
                  width:24,height:24,borderRadius:'50%',display:'flex',
                  alignItems:'center',justifyContent:'center',marginBottom:3,
                  background:today?'#6C63FF':'transparent',
                  color:today?'#fff':isWknd?'#9CA3AF':'#374151',
                  fontSize:13,fontWeight:today?700:400,
                }}>
                  {d.getDate()}
                </div>
                {/* Eventos */}
                {events.slice(0,3).map((ev,i)=>(
                  <div key={i}
                    onMouseEnter={e=>setTooltip({
                      x:(e.target as HTMLElement).getBoundingClientRect().left,
                      y:(e.target as HTMLElement).getBoundingClientRect().top-30,
                      text:ev.full??ev.label
                    })}
                    onMouseLeave={()=>setTooltip(null)}
                    style={{
                      fontSize:10,fontWeight:600,padding:'1px 5px',borderRadius:3,
                      background:ev.bg,color:ev.color??'#fff',
                      marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',
                      textOverflow:'ellipsis',cursor:'default',
                    }}>
                    {ev.label}
                  </div>
                ))}
                {events.length > 3 && (
                  <div style={{fontSize:10,color:'#6B7280'}}>+{events.length-3} mais</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{position:'fixed',top:tooltip.y,left:tooltip.x,
          background:'#111',color:'#fff',fontSize:11,padding:'4px 10px',
          borderRadius:6,zIndex:9999,pointerEvents:'none',maxWidth:280,
          boxShadow:'0 4px 12px rgba(0,0,0,.2)'}}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
