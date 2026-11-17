// frontend/src/pages/hr/ProLaboreDiretoria.tsx
// LEDGR - Pro-labore de Diretoria (17/11/2026)
// Le o QSA (company_shareholders) - nao cadastra pessoas. Dados pessoais ficam na ficha da Pessoa.
// Guarda so o que e proprio do pro-labore: cargo, CBO, categoria eSocial, dia de pagamento e vigencias de valor.
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { SmartMonthInput } from '../../components/SmartMonthInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

const fmtBRL = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCPF = (v?: string) => (v || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
const fmtComp = (c?: string | null) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '');
const fmtData = (d?: string | null) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const parseValor = (s: string) => { const t = (s || '').trim(); if (!t) return NaN; return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const mesValor = (x: any) => (typeof x === 'string' ? x : x?.target?.value ?? '');

interface Vig { id?: string; competenciaIni: string; competenciaFim: string | null; valorBruto: any; cargo?: string; cbo?: string | null; categoriaEsocial?: string; diaPagamento?: number | null; }
interface Socio {
  shareholderId: string; qualificacao: string | null; dataEntrada: string | null; dataRetirada: string | null;
  participacao: any; administra: boolean; recebeProLabore: boolean; vigencias: Vig[];
  person: { id: string; cpf: string; fullName: string; birthDate: string | null };
}
interface VigForm { competenciaIni: string; competenciaFim: string; valor: string; }

const CATEGORIAS = [
  { v: '723', t: '723 - Sócio / empresário' },
  { v: '722', t: '722 - Diretor não empregado, sem FGTS' },
  { v: '721', t: '721 - Diretor não empregado, com FGTS' },
];

function vigenteHoje(vs: Vig[]): Vig | null {
  const hoje = new Date().toISOString().slice(0, 7);
  return vs.find(v => v.competenciaIni <= hoje && (!v.competenciaFim || v.competenciaFim >= hoje)) || vs[vs.length - 1] || null;
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18 };
const thL: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '8px 10px', textTransform: 'uppercase' };
const tdL: React.CSSProperties = { fontSize: 13, color: '#111827', padding: '10px', verticalAlign: 'top' };
const tag: React.CSSProperties = { marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 10, background: FIN_LIGHT, color: FIN };
const btnSec: React.CSSProperties = { height: 30, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 12px', fontSize: 12, background: '#fff', color: '#374151', cursor: 'pointer' };
const btnPri: React.CSSProperties = { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const secSt: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
const secTit: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: FIN, marginBottom: 8 };
const inputSt: React.CSSProperties = { width: '100%', height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4, fontWeight: 500 }}>{children}</div>;
}

export default function ProLaboreDiretoria() {
  const navigate = useNavigate();
  const location = useLocation();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [editar, setEditar] = useState<Socio | null>(null);

  const load = async () => {
    setLoading(true); setErro('');
    try { const r = await api.get('/hr/pro-labore/diretoria'); setSocios(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao carregar o QSA.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0E7490', background: '#ECFEFF', padding: '3px 8px', borderRadius: 6 }}>◆ RH</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Pró-labore de Diretoria</span>
        <button style={{ ...btnSec, marginLeft: 'auto' }} onClick={() => navigate('/app/hr/esocial-s13')}>eSocial S-1.3</button>
      </div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>Sócios e administradores (QSA)</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>Origem: Quadro Societário. Para incluir alguém, cadastre no QSA.</div>
        </div>
        {loading ? (
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>Carregando...</p>
        ) : socios.length === 0 ? (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum sócio pessoa física no QSA desta empresa.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={thL}>Sócio</th><th style={thL}>Qualificação</th><th style={thL}>No QSA</th><th style={thL}>Pró-labore</th><th style={thL}></th>
            </tr></thead>
            <tbody>
              {socios.map(s => {
                const v = vigenteHoje(s.vigencias);
                return (
                  <tr key={s.shareholderId} style={{ borderTop: '1px solid #F3F4F6', opacity: s.dataRetirada ? 0.55 : 1 }}>
                    <td style={tdL}><div style={{ fontWeight: 500 }}>{s.person.fullName}</div><div style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtCPF(s.person.cpf)}</div></td>
                    <td style={tdL}>{s.qualificacao || '-'}{s.administra && <span style={tag}>Administração</span>}</td>
                    <td style={tdL}>{fmtData(s.dataEntrada)}{s.dataRetirada ? ' a ' + fmtData(s.dataRetirada) : ''}</td>
                    <td style={tdL}>
                      {s.recebeProLabore && v ? (
                        <>
                          <div style={{ color: '#15803D', fontWeight: 500 }}>R$ {fmtBRL(v.valorBruto)}</div>
                          <div style={{ fontSize: 10, color: '#6B7280' }}>desde {fmtComp(s.vigencias[0].competenciaIni)} · {s.vigencias.length} vigência(s)</div>
                        </>
                      ) : <span style={{ color: '#9CA3AF' }}>Não recebe</span>}
                    </td>
                    <td style={{ ...tdL, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button style={btnSec} onClick={() => navigate('/app/persons/' + s.person.id, { state: { returnTo: location.pathname } })}>Ficha da Pessoa</button>{' '}
                      <button style={btnPri} onClick={() => setEditar(s)}>Configurar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editar && <ConfigModal socio={editar} onClose={() => setEditar(null)} onSaved={() => { setEditar(null); load(); }} />}
    </div>
  );
}

function ConfigModal({ socio, onClose, onSaved }: { socio: Socio; onClose: () => void; onSaved: () => void }) {
  const ult = socio.vigencias[socio.vigencias.length - 1];
  const [recebe, setRecebe] = useState<boolean>(socio.recebeProLabore || socio.administra);
  const [cargo, setCargo] = useState(ult?.cargo || (socio.administra ? 'Sócio Administrador' : 'Sócio'));
  const [cbo, setCbo] = useState(ult?.cbo || '121010');
  const [categoria, setCategoria] = useState(ult?.categoriaEsocial || '723');
  const [dia, setDia] = useState(ult?.diaPagamento ? String(ult.diaPagamento) : '');
  const [vigs, setVigs] = useState<VigForm[]>(socio.vigencias.length
    ? socio.vigencias.map(v => ({ competenciaIni: v.competenciaIni, competenciaFim: v.competenciaFim || '', valor: fmtBRL(v.valorBruto) }))
    : [{ competenciaIni: '', competenciaFim: '', valor: '' }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const setVig = (i: number, campo: keyof VigForm, valor: string) => setVigs(p => p.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));
  const addVig = () => setVigs(p => [...p, { competenciaIni: '', competenciaFim: '', valor: '' }]);
  const delVig = (i: number) => setVigs(p => p.filter((_, j) => j !== i));

  const salvar = async () => {
    setErro('');
    if (recebe) {
      if (!cargo.trim()) { setErro('Informe o cargo.'); return; }
      for (let i = 0; i < vigs.length; i++) {
        if (!vigs[i].competenciaIni) { setErro(`Vigência ${i + 1}: informe a competência inicial.`); return; }
        if (!(parseValor(vigs[i].valor) > 0)) { setErro(`Vigência ${i + 1}: informe o valor bruto.`); return; }
      }
    }
    setSalvando(true);
    try {
      await api.put('/hr/pro-labore/diretoria/' + socio.shareholderId, {
        recebe, cargo: cargo.trim(), cbo: cbo.replace(/\D/g, ''), categoriaEsocial: categoria, diaPagamento: dia ? Number(dia) : null,
        vigencias: recebe ? vigs.map(v => ({ competenciaIni: v.competenciaIni, competenciaFim: v.competenciaFim || null, valorBruto: parseValor(v.valor) })) : [],
      });
      onSaved();
    } catch (e: any) {
      const m = e?.response?.data?.message;
      setErro(Array.isArray(m) ? m.join(' ') : m || 'Erro ao salvar.');
    }
    setSalvando(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 660, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ background: FIN, color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Pró-labore - {socio.person.fullName}</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{socio.qualificacao || 'Sócio'} · CPF {fmtCPF(socio.person.cpf)} · no QSA desde {fmtData(socio.dataEntrada)}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{erro}</div>}
          <div style={secSt}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: FIN, cursor: 'pointer' }}>
              <input type="checkbox" checked={recebe} onChange={e => setRecebe(e.target.checked)} /> Recebe pró-labore nesta empresa
            </label>
            {!recebe && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Sem pró-labore: nenhum evento de remuneração será gerado para este sócio.</div>}
          </div>
          {recebe && (
            <>
              <div style={secSt}>
                <div style={secTit}>Vínculo com a empresa</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><Label>Cargo</Label><input style={inputSt} value={cargo} onChange={e => setCargo(e.target.value)} /></div>
                  <div><Label>CBO</Label><input style={inputSt} value={cbo} maxLength={6} onChange={e => setCbo(e.target.value.replace(/\D/g, ''))} /></div>
                  <div><Label>Categoria eSocial</Label>
                    <select style={inputSt} value={categoria} onChange={e => setCategoria(e.target.value)}>
                      {CATEGORIAS.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                    </select>
                  </div>
                  <div><Label>Dia usual de pagamento</Label><input style={inputSt} value={dia} maxLength={2} placeholder="ex.: 5" onChange={e => setDia(e.target.value.replace(/\D/g, ''))} /></div>
                </div>
              </div>
              <div style={secSt}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ ...secTit, marginBottom: 0 }}>Vigências de valor</div>
                  <button onClick={addVig} style={{ ...btnSec, marginLeft: 'auto', height: 26 }}>+ Vigência</button>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 8px' }}>Uma linha por valor. Deixe o fim em branco na vigência atual.</div>
                {vigs.map((v, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                    <div><Label>De</Label><SmartMonthInput value={v.competenciaIni} onChange={(x: any) => setVig(i, 'competenciaIni', mesValor(x))} /></div>
                    <div><Label>Até</Label><SmartMonthInput value={v.competenciaFim} onChange={(x: any) => setVig(i, 'competenciaFim', mesValor(x))} /></div>
                    <div><Label>Valor bruto (R$)</Label><input style={{ ...inputSt, textAlign: 'right' }} value={v.valor} placeholder="0,00" onChange={e => setVig(i, 'valor', e.target.value)} /></div>
                    <button title="Remover" onClick={() => delVig(i)} disabled={vigs.length === 1}
                      style={{ height: 32, border: 'none', background: 'transparent', color: vigs.length === 1 ? '#D1D5DB' : '#DC2626', cursor: vigs.length === 1 ? 'default' : 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ background: '#FAFAFA', borderTop: '1px solid #EEE', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPri, background: salvando ? '#aaa' : FIN_ACCENT }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
