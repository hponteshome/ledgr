// frontend/src/pages/sistema/TabelasLegaisPage.tsx
import React, { useState } from 'react';

// ── Dados das tabelas ─────────────────────────────────────────────────────────

const IRPF_TABELAS: Record<string, {
  vigencia: string; faixas: {limite: number|null; aliq: number; deducao: number}[];
  deducaoDependente: number; descontoSimplificado: number;
  redutor2026?: boolean;
}> = {
  '2024_jan_abr': {
    vigencia: 'Fev/2024 a Abr/2025',
    faixas: [
      { limite: 2259.20, aliq: 0,    deducao: 0       },
      { limite: 2826.65, aliq: 7.5,  deducao: 169.44  },
      { limite: 3751.05, aliq: 15,   deducao: 381.44  },
      { limite: 4664.68, aliq: 22.5, deducao: 662.77  },
      { limite: null,    aliq: 27.5, deducao: 896.00  },
    ],
    deducaoDependente: 189.59,
    descontoSimplificado: 528.00,
  },
  '2025_mai': {
    vigencia: 'Mai/2025 em diante',
    faixas: [
      { limite: 2428.80, aliq: 0,    deducao: 0       },
      { limite: 2826.65, aliq: 7.5,  deducao: 182.16  },
      { limite: 3751.05, aliq: 15,   deducao: 394.16  },
      { limite: 4664.68, aliq: 22.5, deducao: 675.49  },
      { limite: null,    aliq: 27.5, deducao: 908.73  },
    ],
    deducaoDependente: 189.59,
    descontoSimplificado: 607.20,
  },
  '2026': {
    vigencia: 'Jan/2026 em diante',
    faixas: [
      { limite: 2428.80, aliq: 0,    deducao: 0       },
      { limite: 2826.65, aliq: 7.5,  deducao: 182.16  },
      { limite: 3751.05, aliq: 15,   deducao: 394.16  },
      { limite: 4664.68, aliq: 22.5, deducao: 675.49  },
      { limite: null,    aliq: 27.5, deducao: 908.73  },
    ],
    deducaoDependente: 189.59,
    descontoSimplificado: 607.20,
    redutor2026: true,
  },
};

const INSS_TABELAS: Record<string, {
  vigencia: string; salarioMinimo: number; teto: number;
  faixas: {limite: number; aliq: number}[];
}> = {
  '2024': {
    vigencia: '2024',
    salarioMinimo: 1412.00,
    teto: 7786.02,
    faixas: [
      { limite: 1412.00, aliq: 7.5  },
      { limite: 2666.68, aliq: 9.0  },
      { limite: 4000.03, aliq: 12.0 },
      { limite: 7786.02, aliq: 14.0 },
    ],
  },
  '2025': {
    vigencia: '2025',
    salarioMinimo: 1518.00,
    teto: 8157.41,
    faixas: [
      { limite: 1518.00, aliq: 7.5  },
      { limite: 2793.88, aliq: 9.0  },
      { limite: 4190.83, aliq: 12.0 },
      { limite: 8157.41, aliq: 14.0 },
    ],
  },
  '2026': {
    vigencia: '2026',
    salarioMinimo: 1621.00,
    teto: 8475.55,
    faixas: [
      { limite: 1621.00, aliq: 7.5  },
      { limite: 2902.84, aliq: 9.0  },
      { limite: 4354.27, aliq: 12.0 },
      { limite: 8475.55, aliq: 14.0 },
    ],
  },
};

// ── Calculos ──────────────────────────────────────────────────────────────────

function calcIRPF(base: number, tabKey: string): number {
  const tab = IRPF_TABELAS[tabKey];
  if (!tab) return 0;
  for (const f of tab.faixas) {
    if (f.limite === null || base <= f.limite) {
      const ir = base * (f.aliq / 100) - f.deducao;
      if (tab.redutor2026 && base <= 7350) {
        const redutor = Math.min(ir, Math.max(0, 978.62 - 0.133145 * base));
        return Math.max(0, ir - redutor);
      }
      return Math.max(0, ir);
    }
  }
  return 0;
}

function calcINSS(salario: number, tabKey: string): number {
  const tab = INSS_TABELAS[tabKey];
  if (!tab) return 0;
  const sal = Math.min(salario, tab.teto);
  let total = 0, prev = 0;
  for (const f of tab.faixas) {
    const faixaVal = Math.min(sal, f.limite) - prev;
    if (faixaVal <= 0) break;
    total += faixaVal * (f.aliq / 100);
    prev = f.limite;
    if (sal <= f.limite) break;
  }
  return total;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

// ── Componente ────────────────────────────────────────────────────────────────

export function TabelasLegaisPage() {
  const [aba, setAba] = useState<'irpf'|'inss'>('irpf');
  const [irpfTab, setIrpfTab] = useState('2026');
  const [inssTab, setInssTab] = useState('2026');
  const [simSalario, setSimSalario] = useState('');
  const [simDep, setSimDep] = useState('0');
  const [simSimplif, setSimSimplif] = useState(true);

  const S = {
    page:  {padding:'24px 0', fontFamily:'var(--font-sans,system-ui)', fontSize:14, color:'var(--color-text-primary)'} as React.CSSProperties,
    badge: {display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'#F9FAFB', color:'#374151'} as React.CSSProperties,
    card:  {background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'16px', marginBottom:16} as React.CSSProperties,
    th:    {background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontSize:10, fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'.3px', padding:'8px 12px', textAlign:'left' as const, borderBottom:'0.5px solid var(--color-border-tertiary)'} as React.CSSProperties,
    thR:   {background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontSize:10, fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'.3px', padding:'8px 12px', textAlign:'right' as const, borderBottom:'0.5px solid var(--color-border-tertiary)'} as React.CSSProperties,
    td:    {padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:13} as React.CSSProperties,
    tdR:   {padding:'8px 12px', textAlign:'right' as const, borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:13} as React.CSSProperties,
    btn:   {height:30, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'0 12px', fontSize:12, cursor:'pointer', background:'var(--color-background-primary)', color:'var(--color-text-primary)'} as React.CSSProperties,
    btnA:  {height:30, border:'none', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#111', color:'#fff', fontWeight:500} as React.CSSProperties,
    input: {height:32, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'0 9px', fontSize:13, background:'var(--color-background-primary)', color:'var(--color-text-primary)', width:'100%', outline:'none'} as React.CSSProperties,
    label: {fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', display:'block', marginBottom:4},
    tabBtn: (active: boolean) => ({height:30, border:'0.5px solid '+(active?'#111':'var(--color-border-tertiary)'), borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:active?'#111':'var(--color-background-primary)', color:active?'#fff':'var(--color-text-secondary)'} as React.CSSProperties),
  };

  // Simulador
  const sal = parseFloat(simSalario.replace(/\./g,'').replace(',','.')) || 0;
  const dep = parseInt(simDep) || 0;
  const inssKey = inssTab;
  const irpfKey = irpfTab;
  const inssVal = calcINSS(sal, inssKey);
  const deducDep = dep * (IRPF_TABELAS[irpfKey]?.deducaoDependente ?? 189.59);
  const descSimpl = IRPF_TABELAS[irpfKey]?.descontoSimplificado ?? 607.20;
  const baseIR = simSimplif
    ? Math.max(0, sal - inssVal - descSimpl)
    : Math.max(0, sal - inssVal - deducDep);
  const irVal = calcIRPF(baseIR, irpfKey);
  const liquido = sal - inssVal - irVal;

  return (
    <div style={S.page}>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
        <span style={S.badge}>⚙ Sistema</span>
        <span style={{fontSize:15, fontWeight:500}}>Tabelas Legais</span>
        <span style={{fontSize:11, color:'var(--color-text-secondary)'}}>IRPF e INSS — Fonte: RFB / MPS</span>
      </div>

      <div style={{display:'flex', gap:4, marginBottom:20}}>
        <button style={S.tabBtn(aba==='irpf')} onClick={()=>setAba('irpf')}>Tabela IRPF</button>
        <button style={S.tabBtn(aba==='inss')} onClick={()=>setAba('inss')}>Tabela INSS</button>
        <button style={S.tabBtn(false)} onClick={()=>{}}>Simulador</button>
      </div>

      {/* ── IRPF ── */}
      {aba==='irpf' && (
        <div>
          <div style={{display:'flex', gap:4, marginBottom:16}}>
            {Object.entries(IRPF_TABELAS).map(([k,v])=>(
              <button key={k} style={S.tabBtn(irpfTab===k)} onClick={()=>setIrpfTab(k)}>{v.vigencia}</button>
            ))}
          </div>
          {(() => {
            const t = IRPF_TABELAS[irpfTab];
            return (
              <div>
                <div style={S.card}>
                  <div style={{fontSize:12, fontWeight:500, marginBottom:12, color:'var(--color-text-secondary)'}}>
                    Tabela Progressiva Mensal — IRPF · {t.vigencia}
                    {t.redutor2026 && <span style={{marginLeft:8, fontSize:10, background:'#EFF6FF', color:'#1D4ED8', padding:'2px 8px', borderRadius:4, fontWeight:600}}>Lei 15.270/2025 — Isenção até R$ 5.000/mês</span>}
                  </div>
                  <div style={{border:'0.5px solid var(--color-border-tertiary)', borderRadius:8, overflow:'hidden', marginBottom:16}}>
                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                      <thead><tr>
                        <th style={S.th}>Base de Calculo Mensal</th>
                        <th style={S.thR}>Aliquota</th>
                        <th style={S.thR}>Parcela a Deduzir</th>
                      </tr></thead>
                      <tbody>
                        {t.faixas.map((f,i)=>(
                          <tr key={i} style={{background: f.aliq===0?'#F0FDF4':'transparent'}}>
                            <td style={S.td}>
                              {i===0 ? 'Ate R$ '+fmtBRL(f.limite!) :
                               f.limite===null ? 'Acima de R$ '+fmtBRL(t.faixas[i-1].limite!) :
                               'De R$ '+fmtBRL(t.faixas[i-1].limite!+0.01)+' a R$ '+fmtBRL(f.limite)}
                            </td>
                            <td style={{...S.tdR, color: f.aliq===0?'#15803D':f.aliq===27.5?'#DC2626':'var(--color-text-primary)', fontWeight:500}}>
                              {f.aliq===0?'Isento':f.aliq.toFixed(1)+'%'}
                            </td>
                            <td style={S.tdR}>{f.deducao>0?'R$ '+fmtBRL(f.deducao):'--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12}}>
                    <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
                      <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:4}}>Deducao por dependente</div>
                      <div style={{fontSize:15, fontWeight:500}}>R$ {fmtBRL(t.deducaoDependente)}/mes</div>
                    </div>
                    <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
                      <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:4}}>Desconto simplificado mensal</div>
                      <div style={{fontSize:15, fontWeight:500}}>R$ {fmtBRL(t.descontoSimplificado)}/mes</div>
                    </div>
                    {t.redutor2026 && (
                      <div style={{background:'#EFF6FF', borderRadius:8, padding:'10px 14px'}}>
                        <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'#1D4ED8', marginBottom:4}}>Redutor 2026 (Lei 15.270/2025)</div>
                        <div style={{fontSize:13, color:'#1D4ED8'}}>Isencao efetiva ate R$ 5.000/mes<br/>Reducao gradual ate R$ 7.350/mes</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── INSS ── */}
      {aba==='inss' && (
        <div>
          <div style={{display:'flex', gap:4, marginBottom:16}}>
            {Object.entries(INSS_TABELAS).map(([k,v])=>(
              <button key={k} style={S.tabBtn(inssTab===k)} onClick={()=>setInssTab(k)}>{v.vigencia}</button>
            ))}
          </div>
          {(() => {
            const t = INSS_TABELAS[inssTab];
            return (
              <div style={S.card}>
                <div style={{fontSize:12, fontWeight:500, marginBottom:12, color:'var(--color-text-secondary)'}}>
                  Tabela Progressiva INSS — {t.vigencia} · Salario Minimo: R$ {fmtBRL(t.salarioMinimo)} · Teto: R$ {fmtBRL(t.teto)}
                </div>
                <div style={{border:'0.5px solid var(--color-border-tertiary)', borderRadius:8, overflow:'hidden'}}>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead><tr>
                      <th style={S.th}>Faixa Salarial</th>
                      <th style={S.thR}>Aliquota</th>
                      <th style={S.thR}>Contribuicao maxima da faixa</th>
                    </tr></thead>
                    <tbody>
                      {t.faixas.map((f,i)=>{
                        const prev = i===0?0:t.faixas[i-1].limite;
                        const maxFaixa = (f.limite - prev) * f.aliq/100;
                        return (
                          <tr key={i}>
                            <td style={S.td}>
                              {i===0?'Ate R$ '+fmtBRL(f.limite):'De R$ '+fmtBRL(prev+0.01)+' a R$ '+fmtBRL(f.limite)}
                              {i===t.faixas.length-1?' (teto)':''}
                            </td>
                            <td style={{...S.tdR, fontWeight:500, color: f.aliq===7.5?'#15803D':f.aliq===14?'#DC2626':'var(--color-text-primary)'}}>
                              {f.aliq.toFixed(1)}%
                            </td>
                            <td style={S.tdR}>R$ {fmtBRL(maxFaixa)}</td>
                          </tr>
                        );
                      })}
                      <tr style={{background:'var(--color-background-secondary)'}}>
                        <td style={{...S.td, fontWeight:600}}>Desconto maximo (teto)</td>
                        <td style={S.tdR}></td>
                        <td style={{...S.tdR, fontWeight:600}}>R$ {fmtBRL(calcINSS(t.teto, inssTab))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Simulador integrado ── */}
      <div style={S.card}>
        <div style={{fontSize:11, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.3px', marginBottom:14, color:'var(--color-text-secondary)'}}>
          Simulador — INSS + IRPF
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:16}}>
          <div>
            <label style={S.label}>Salario bruto (R$)</label>
            <input style={S.input} type='text' placeholder='ex: 5.000,00' value={simSalario} onChange={e=>setSimSalario(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Tabela INSS</label>
            <select style={{...S.input}} value={inssTab} onChange={e=>setInssTab(e.target.value)}>
              {Object.entries(INSS_TABELAS).map(([k,v])=><option key={k} value={k}>{v.vigencia}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Tabela IRPF</label>
            <select style={{...S.input}} value={irpfTab} onChange={e=>setIrpfTab(e.target.value)}>
              {Object.entries(IRPF_TABELAS).map(([k,v])=><option key={k} value={k}>{v.vigencia}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Dependentes</label>
            <input style={S.input} type='number' min={0} max={10} value={simDep} onChange={e=>setSimDep(e.target.value)}/>
          </div>
          <div style={{display:'flex', alignItems:'flex-end', paddingBottom:4}}>
            <label style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13}}>
              <input type='checkbox' checked={simSimplif} onChange={e=>setSimSimplif(e.target.checked)}/>
              Desconto simplificado
            </label>
          </div>
        </div>
        {sal > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, borderTop:'0.5px solid var(--color-border-tertiary)', paddingTop:14}}>
            <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
              <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:3}}>Salario bruto</div>
              <div style={{fontSize:16, fontWeight:500}}>R$ {fmtBRL(sal)}</div>
            </div>
            <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
              <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:3}}>INSS</div>
              <div style={{fontSize:16, fontWeight:500, color:'#DC2626'}}>- R$ {fmtBRL(inssVal)}</div>
              <div style={{fontSize:10, color:'var(--color-text-secondary)'}}>Aliq. efetiva: {sal>0?(inssVal/sal*100).toFixed(2):'0'}%</div>
            </div>
            <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
              <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:3}}>Base calculo IR</div>
              <div style={{fontSize:16, fontWeight:500}}>R$ {fmtBRL(baseIR)}</div>
              <div style={{fontSize:10, color:'var(--color-text-secondary)'}}>{simSimplif?'Desc. simplificado: R$ '+fmtBRL(descSimpl):dep+' dep. x R$ '+fmtBRL(IRPF_TABELAS[irpfTab]?.deducaoDependente??189.59)}</div>
            </div>
            <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'10px 14px'}}>
              <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:3}}>IRPF</div>
              <div style={{fontSize:16, fontWeight:500, color: irVal===0?'#15803D':'#DC2626'}}>{irVal===0?'Isento':'- R$ '+fmtBRL(irVal)}</div>
              <div style={{fontSize:10, color:'var(--color-text-secondary)'}}>Aliq. efetiva: {sal>0?(irVal/sal*100).toFixed(2):'0'}%</div>
            </div>
            <div style={{background:'#F0FDF4', border:'0.5px solid #86EFAC', borderRadius:8, padding:'10px 14px'}}>
              <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'#15803D', marginBottom:3}}>Salario liquido</div>
              <div style={{fontSize:18, fontWeight:600, color:'#15803D'}}>R$ {fmtBRL(liquido)}</div>
              <div style={{fontSize:10, color:'#15803D'}}>{sal>0?(liquido/sal*100).toFixed(1):'0'}% do bruto</div>
            </div>
          </div>
        )}
      </div>

      <div style={{fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.6}}>
        Fonte: Receita Federal do Brasil (RFB) e Ministerio da Previdencia Social (MPS).
        Tabela IRPF vigente a partir de mai/2025 (Lei 15.191/2025). Reducao 2026: Lei 15.270/2025.
        Tabela INSS atualizada anualmente por decreto federal. Valores para conferencia — nao substitui consulta a contador.
      </div>
    </div>
  );
}
