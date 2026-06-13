// frontend/src/pages/sistema/TabelasLegaisPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface IrrfFaixa { ordem: number; limiteAte: number; aliquota: number; deducao: number; }
interface IrrfRedutor { ordem: number; limiteAte: number; redutor: number; }
interface IrrfAno { ano: number; vigenciaIni: string; faixas: IrrfFaixa[]; redutores: IrrfRedutor[]; }
interface InssFaixa { ordem: number; limiteAte: number; aliquota: number; deducao: number; }
interface InssAno { ano: number; teto: number; salMinimo: number; vigenciaIni: string; faixas: InssFaixa[]; }
interface SalMin { id: string; valor: number; vigenciaIni: string; vigenciaFim: string | null; lei: string | null; observacao: string | null; }

function calcIRPF(base: number, tab: IrrfAno | null): number {
  if (!tab) return 0;
  // Tabela progressiva
  let ir = 0;
  for (const f of tab.faixas) {
    if (f.limiteAte >= 999998 || base <= f.limiteAte) {
      ir = base * (Number(f.aliquota) / 100) - Number(f.deducao);
      break;
    }
  }
  ir = Math.max(0, ir);
  // Aplicar redutor se existir
  if (tab.redutores.length > 0) {
    for (const r of tab.redutores) {
      if (base <= Number(r.limiteAte)) {
        const red = Number(r.redutor);
        if (red >= 999998) return 0; // isento total
        return Math.max(0, ir - red);
      }
    }
    return ir; // acima de todos os redutores — sem reducao
  }
  return ir;
}

function calcINSS(salario: number, tab: InssAno | null): number {
  if (!tab) return 0;
  const sal = Math.min(salario, Number(tab.teto));
  let total = 0, prev = 0;
  for (const f of tab.faixas) {
    const lim = Number(f.limiteAte);
    const faixaVal = Math.min(sal, lim) - prev;
    if (faixaVal <= 0) break;
    total += faixaVal * (Number(f.aliquota) / 100);
    prev = lim;
    if (sal <= lim) break;
  }
  return total;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
const fmtDate = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '';

export function TabelasLegaisPage() {
  const [aba, setAba] = useState<'irpf' | 'inss' | 'salmin'>('irpf');
  const [irrfData, setIrrfData] = useState<IrrfAno[]>([]);
  const [inssData, setInssData] = useState<InssAno[]>([]);
  const [salData, setSalData] = useState<SalMin[]>([]);
  const [loading, setLoading] = useState(false);
  const [irpfAno, setIrpfAno] = useState<number>(2026);
  const [inssAno, setInssAno] = useState<number>(2026);
  const [simSalario, setSimSalario] = useState('');
  const [simDep, setSimDep] = useState('0');
  const [simSimplif, setSimSimplif] = useState(true);
  const [simAno, setSimAno] = useState<number>(2026);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get('/tabelas-legais/irrf'),
        api.get('/tabelas-legais/inss'),
        api.get('/tabelas-legais/salario-minimo'),
      ]);
      setIrrfData(r1.data ?? []);
      setInssData(r2.data ?? []);
      setSalData(r3.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const irpfTab = irrfData.find(d => d.ano === irpfAno) ?? null;
  const inssTab = inssData.find(d => d.ano === inssAno) ?? null;
  const simIrpfTab = irrfData.find(d => d.ano === simAno) ?? null;
  const simInssTab = inssData.find(d => d.ano === simAno) ?? null;

  const sal = parseFloat(simSalario.replace(/\./g, '').replace(',', '.')) || 0;
  const dep = parseInt(simDep) || 0;
  const DEDUC_DEP = 189.59;
  const DESC_SIMPLIF = simAno >= 2026 ? 607.20 : 528.00;
  const inssVal = calcINSS(sal, simInssTab);
  const deducDep = dep * DEDUC_DEP;
  const baseIR = simSimplif
    ? Math.max(0, sal - inssVal - DESC_SIMPLIF)
    : Math.max(0, sal - inssVal - deducDep);
  const irVal = calcIRPF(baseIR, simIrpfTab);
  const liquido = sal - inssVal - irVal;

  const anos = [...new Set([...irrfData.map(d => d.ano), ...inssData.map(d => d.ano)])].sort((a, b) => b - a);

  const S = {
    page: { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
    badge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F9FAFB', color: '#374151' } as React.CSSProperties,
    card: { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 16 } as React.CSSProperties,
    th: { background: '#F9FAFB', color: '#6B7280', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 12px', textAlign: 'left' as const, borderBottom: '0.5px solid #E5E7EB' } as React.CSSProperties,
    thR: { background: '#F9FAFB', color: '#6B7280', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 12px', textAlign: 'right' as const, borderBottom: '0.5px solid #E5E7EB' } as React.CSSProperties,
    td: { padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 13 } as React.CSSProperties,
    tdR: { padding: '8px 12px', textAlign: 'right' as const, borderBottom: '0.5px solid #E5E7EB', fontSize: 13 } as React.CSSProperties,
    input: { height: 32, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 9px', fontSize: 13, background: '#fff', width: '100%', outline: 'none' } as React.CSSProperties,
    label: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 4 },
    tabBtn: (active: boolean) => ({ height: 30, border: '0.5px solid ' + (active ? '#111' : '#E5E7EB'), borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: active ? '#111' : '#fff', color: active ? '#fff' : '#6B7280' } as React.CSSProperties),
    anoBtn: (active: boolean) => ({ height: 26, border: '0.5px solid ' + (active ? '#2563EB' : '#E5E7EB'), borderRadius: 6, padding: '0 10px', fontSize: 11, cursor: 'pointer', background: active ? '#EFF6FF' : '#fff', color: active ? '#2563EB' : '#6B7280', fontWeight: active ? 600 : 400 } as React.CSSProperties),
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={S.badge}>⚙ Sistema</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Tabelas Legais</span>
        {loading && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Carregando...</span>}
      </div>

      {/* Tabs principais */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={S.tabBtn(aba === 'irpf')} onClick={() => setAba('irpf')}>Tabela IRPF</button>
        <button style={S.tabBtn(aba === 'inss')} onClick={() => setAba('inss')}>Tabela INSS</button>
        <button style={S.tabBtn(aba === 'salmin')} onClick={() => setAba('salmin')}>Salário Mínimo</button>
      </div>

      {/* ── IRPF ── */}
      {aba === 'irpf' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {irrfData.map(d => <button key={d.ano} style={S.anoBtn(irpfAno === d.ano)} onClick={() => setIrpfAno(d.ano)}>{d.ano}</button>)}
          </div>
          {irpfTab && (
            <>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Vigência: {fmtDate(irpfTab.vigenciaIni)} em diante
              </div>
              <div style={S.card}>
                <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500 }}>Tabela Progressiva</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Base de Cálculo</th>
                      <th style={S.thR}>Alíquota</th>
                      <th style={S.thR}>Parcela a Deduzir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irpfTab.faixas.map((f, i) => (
                      <tr key={i}>
                        <td style={S.td}>{f.limiteAte >= 999998 ? 'Acima de R$ ' + fmtBRL(irpfTab.faixas[i - 1]?.limiteAte ?? 0) : 'Até R$ ' + fmtBRL(f.limiteAte)}</td>
                        <td style={S.tdR}>{fmtPct(f.aliquota)}</td>
                        <td style={S.tdR}>R$ {fmtBRL(f.deducao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {irpfTab.redutores.length > 0 && (
                <div style={S.card}>
                  <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500 }}>Redutor Progressivo (Lei 15.270/2025)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Renda Bruta até</th>
                        <th style={S.thR}>Desconto Simplificado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irpfTab.redutores.map((r, i) => (
                        <tr key={i}>
                          <td style={S.td}>{r.limiteAte >= 999998 ? 'Acima de R$ 7.350,00' : 'R$ ' + fmtBRL(r.limiteAte)}</td>
                          <td style={S.tdR}>{r.redutor >= 999998 ? 'Isento' : 'R$ ' + fmtBRL(r.redutor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Simulador */}
          <div style={{ ...S.card, padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Simulador de IRRF</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
              <div>
                <span style={S.label}>Ano base</span>
                <select value={simAno} onChange={e => setSimAno(Number(e.target.value))} style={{ ...S.input }}>
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <span style={S.label}>Salário Bruto (R$)</span>
                <input style={S.input} value={simSalario} onChange={e => setSimSalario(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <span style={S.label}>Dependentes</span>
                <input style={S.input} type="number" min="0" value={simDep} onChange={e => setSimDep(e.target.value)} />
              </div>
              <div>
                <span style={S.label}>Desconto</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button style={S.tabBtn(simSimplif)} onClick={() => setSimSimplif(true)}>Simplificado</button>
                  <button style={S.tabBtn(!simSimplif)} onClick={() => setSimSimplif(false)}>Dependentes</button>
                </div>
              </div>
            </div>
            {sal > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                <div><div style={S.label}>INSS</div><div style={{ fontWeight: 600, color: '#DC2626' }}>R$ {fmtBRL(inssVal)}</div></div>
                <div><div style={S.label}>Base IRRF</div><div style={{ fontWeight: 600 }}>R$ {fmtBRL(baseIR)}</div></div>
                <div><div style={S.label}>IRRF</div><div style={{ fontWeight: 600, color: '#DC2626' }}>R$ {fmtBRL(irVal)}</div></div>
                <div><div style={S.label}>Líquido</div><div style={{ fontWeight: 600, color: '#16A34A' }}>R$ {fmtBRL(liquido)}</div></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── INSS ── */}
      {aba === 'inss' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {inssData.map(d => <button key={d.ano} style={S.anoBtn(inssAno === d.ano)} onClick={() => setInssAno(d.ano)}>{d.ano}</button>)}
          </div>
          {inssTab && (
            <>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Vigência: {fmtDate(inssTab.vigenciaIni)} | Teto: R$ {fmtBRL(Number(inssTab.teto))} | Sal. Mínimo: R$ {fmtBRL(Number(inssTab.salMinimo))}
              </div>
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Faixa Salarial</th>
                      <th style={S.thR}>Alíquota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inssTab.faixas.map((f, i) => (
                      <tr key={i}>
                        <td style={S.td}>
                          {i === 0 ? 'Até R$ ' : 'De R$ ' + fmtBRL(Number(inssTab.faixas[i - 1]?.limiteAte ?? 0)) + ' até R$ '}
                          {fmtBRL(Number(f.limiteAte))}
                        </td>
                        <td style={S.tdR}>{fmtPct(f.aliquota)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Salário Mínimo ── */}
      {aba === 'salmin' && (
        <div style={S.card}>
          <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E7EB', fontSize: 12, fontWeight: 500 }}>
            Histórico do Salário Mínimo Nacional
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Vigência</th>
                <th style={S.thR}>Valor</th>
                <th style={S.th}>Lei / Decreto</th>
              </tr>
            </thead>
            <tbody>
              {salData.map(s => (
                <tr key={s.id}>
                  <td style={S.td}>{fmtDate(s.vigenciaIni)}{s.vigenciaFim ? ' a ' + fmtDate(s.vigenciaFim) : ' em diante'}</td>
                  <td style={S.tdR}>R$ {fmtBRL(Number(s.valor))}</td>
                  <td style={S.td}>{s.lei ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
