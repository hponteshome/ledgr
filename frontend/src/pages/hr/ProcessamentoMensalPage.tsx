// frontend/src/pages/hr/ProcessamentoMensalPage.tsx
// LEDGR - Processamento Mensal do eSocial (18/11/2026): pagamentos do pro-labore, conferencia por competencia,
// aprovacao e transmissao em sequencia (envio + consulta automatica), parando na primeira recusa.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { SmartMonthInput } from '../../components/SmartMonthInput';
import { SmartDateInput } from '../../components/SmartDateInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';
const val = (x: any) => (typeof x === 'string' ? x : x?.target?.value ?? '');
const fmtBRL = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtComp = (c?: string | null) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '-');
const fmtData = (d?: string | null) => (d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '-');
const fmtDh = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');
const parseValor = (s: string) => { const t = (s || '').trim(); if (!t) return NaN; return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const erroTxt = (e: any, pad: string) => { const m = e?.response?.data?.message; return Array.isArray(m) ? m.join(' ') : m || pad; };
const ETAPAS: Record<number, string> = { 1: 'S-1000', 2: 'Tabelas', 3: 'S-2300', 4: 'S-1200', 5: 'S-1210', 6: 'S-1299' };
const INFORMATIVO = /446 - Transmiss[aã]o da DCTFWeb realizada com sucesso/i;
const SIT: Record<string, [string, string, string]> = {
  FECHADA: ['Fechada', FIN_LIGHT, FIN], REJEITADA: ['Rejeitada', '#FCEBEB', '#A32D2D'], TRANSMISSAO: ['Em transmissão', '#EFF6FF', '#1D4ED8'],
  APROVADA: ['Aprovada', '#FEF3C7', '#92400E'], PENDENTE: ['Pendente', '#F3F4F6', '#374151'],
};
const COR_EV: Record<string, [string, string]> = {
  VALIDADO: ['#ECFDF5', '#047857'], INVALIDO: ['#FCEBEB', '#A32D2D'], ENVIADO: ['#EFF6FF', '#1D4ED8'],
  PROCESSADO: [FIN_LIGHT, FIN], REJEITADO: ['#FCEBEB', '#A32D2D'], 'A GERAR': ['#F3F4F6', '#374151'],
};

interface Comp { perApur: string; fechamento: string | null; recibo: string | null; descResposta: string | null; aprovadoEm: string | null; }
interface Previa { eventos: any[]; remuneracoes: any[]; pagamentos: any[]; }
interface Pg { id: string; tipo: string; competencia: string | null; dtPagamento: string; valorLiquido: number; observacao: string | null; nome: string; }
const situacao = (c?: Comp) => !c ? 'PENDENTE' : c.fechamento === 'PROCESSADO' ? 'FECHADA' : c.fechamento === 'REJEITADO' ? 'REJEITADA'
  : c.fechamento === 'ENVIADO' ? 'TRANSMISSAO' : c.aprovadoEm ? 'APROVADA' : 'PENDENTE';

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const titulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 10 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '6px 8px', textTransform: 'uppercase' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '7px 8px', verticalAlign: 'top', borderTop: '1px solid #F3F4F6' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
const inputSt: React.CSSProperties = { width: '100%', height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const btnPri: React.CSSProperties = { height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const btnSec: React.CSSProperties = { height: 30, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 12px', fontSize: 12, background: '#fff', color: '#374151', cursor: 'pointer' };
const secSt: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4, fontWeight: 500 }}>{children}</div>;
}
function Chip({ txt, bg, fg }: { txt: string; bg: string; fg: string }) {
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>;
}
function Modal({ titulo: t, sub, onClose, children, rodape, travado }: { titulo: string; sub?: string; onClose: () => void; children: React.ReactNode; rodape: React.ReactNode; travado?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (!travado && e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 640, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ background: FIN, color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'flex-start' }}>
          <div><div style={{ fontSize: 15, fontWeight: 600 }}>{t}</div>{sub && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{sub}</div>}</div>
          <button onClick={() => { if (!travado) onClose(); }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: travado ? 'default' : 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ background: '#FAFAFA', borderTop: '1px solid #EEE', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{rodape}</div>
      </div>
    </div>
  );
}

export default function ProcessamentoMensalPage() {
  const navigate = useNavigate();
  const [tpAmb, setTpAmb] = useState('1');
  const [comps, setComps] = useState<Comp[]>([]);
  const [sel, setSel] = useState('');
  const [prev, setPrev] = useState<Previa | null>(null);
  const [prevErro, setPrevErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null);
  const [pgs, setPgs] = useState<Pg[]>([]);
  const [novoPg, setNovoPg] = useState(false);
  const [delId, setDelId] = useState('');
  const [transEv, setTransEv] = useState<any[] | null>(null);
  const prod = tpAmb === '1';

  const loadComps = async () => {
    try { const r = await api.get('/hr/esocial-s13/competencias', { params: { tpAmb } }); setComps(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao carregar competências.') }); }
  };
  const loadPgs = async () => {
    try { const r = await api.get('/hr/esocial-s13/pagamentos'); setPgs(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao carregar pagamentos.') }); }
  };
  const loadPrevia = async (c: string) => {
    setOcupado(true); setPrev(null); setPrevErro('');
    try { const r = await api.post('/hr/esocial-s13/previa', { tpAmb: Number(tpAmb), perApur: c }); setPrev(r.data); }
    catch (e: any) { setPrevErro(erroTxt(e, 'Erro na conferência.')); }
    setOcupado(false);
  };
  useEffect(() => { loadComps(); loadPgs(); }, [tpAmb]);
  useEffect(() => { if (sel) loadPrevia(sel); }, [sel, tpAmb]);

  const compSel = comps.find(c => c.perApur === sel);
  const sit = situacao(compSel);
  const remunMes = (prev?.remuneracoes || []).filter((r: any) => r.comp === sel);
  const totalDctf = remunMes.reduce((a: number, r: any) => a + Number(r.inssSegurado || 0) + Number(r.inssPatronal || 0), 0);
  const pendentesEnvio = (prev?.eventos || []).filter((e: any) => e.status !== 'PROCESSADO').length;

  const aprovar = async () => {
    setOcupado(true); setMsg(null);
    try { await api.post('/hr/esocial-s13/aprovar', { tpAmb: Number(tpAmb), perApur: sel }); setMsg({ tipo: 'ok', txt: `Conferência de ${fmtComp(sel)} aprovada: eventos gerados, assinados e validados no XSD oficial.` }); }
    catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao aprovar.') }); }
    setOcupado(false); await loadComps(); await loadPrevia(sel);
  };
  const excluirPg = async (id: string) => {
    try { await api.delete('/hr/esocial-s13/pagamentos/' + id); setMsg({ tipo: 'ok', txt: 'Pagamento excluído.' }); }
    catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao excluir.') }); }
    setDelId(''); loadPgs(); if (sel) loadPrevia(sel);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0E7490', background: '#ECFEFF', padding: '3px 8px', borderRadius: 6 }}>◆ RH</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Processamento Mensal</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...inputSt, width: 210 }} value={tpAmb} onChange={e => { setTpAmb(e.target.value); setPrev(null); }}>
            <option value="1">Produção</option>
            <option value="2">Produção restrita (teste)</option>
          </select>
          <button style={btnSec} onClick={() => navigate('/app/hr/esocial-s13')}>Eventos eSocial</button>
        </div>
      </div>
      {msg && <div style={{ marginBottom: 12, background: msg.tipo === 'ok' ? '#ECFDF5' : '#FCEBEB', color: msg.tipo === 'ok' ? '#047857' : '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{msg.txt}</div>}

      <div style={card}>
        <div style={titulo}>Competências - {prod ? 'Produção' : 'Produção restrita'}</div>
        {comps.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhuma vigência de pró-labore cadastrada.</p> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {comps.map(c => {
              const [txt, bg, fg] = SIT[situacao(c)];
              const ativo = c.perApur === sel;
              return (
                <button key={c.perApur} onClick={() => { setSel(c.perApur); setMsg(null); }}
                  style={{ border: `1.5px solid ${ativo ? FIN : '#E5E7EB'}`, borderRadius: 8, padding: '6px 10px', background: '#fff', cursor: 'pointer', textAlign: 'left', minWidth: 104 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{fmtComp(c.perApur)}</div>
                  <div style={{ marginTop: 4 }}><Chip txt={txt} bg={bg} fg={fg} /></div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sel && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ ...titulo, marginBottom: 0 }}>Conferência - {fmtComp(sel)}</div>
            <span style={{ marginLeft: 10 }}><Chip txt={SIT[sit][0]} bg={SIT[sit][1]} fg={SIT[sit][2]} /></span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button style={{ ...btnSec, opacity: ocupado || sit === 'FECHADA' ? 0.5 : 1 }} disabled={ocupado || sit === 'FECHADA' || !!prevErro} onClick={aprovar}>{ocupado ? 'Processando...' : sit === 'APROVADA' ? 'Aprovar novamente' : 'Aprovar conferência'}</button>
              <button style={{ ...btnPri, background: sit !== 'APROVADA' && sit !== 'REJEITADA' && sit !== 'TRANSMISSAO' || ocupado ? '#aaa' : prod ? '#B45309' : FIN_ACCENT }}
                disabled={(sit !== 'APROVADA' && sit !== 'REJEITADA' && sit !== 'TRANSMISSAO') || ocupado || !pendentesEnvio} onClick={() => setTransEv(prev?.eventos || [])}>Transmitir</button>
            </div>
          </div>
          {compSel?.aprovadoEm && <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>Aprovada em {fmtDh(compSel.aprovadoEm)}{compSel.recibo ? ` · Fechamento recibo ${compSel.recibo}` : ''}</div>}
          {prevErro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>Pendência: {prevErro}</div>}
          {!prev && !prevErro && <p style={{ fontSize: 12, color: '#9CA3AF' }}>Carregando conferência...</p>}
          {prev && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: FIN, marginBottom: 4 }}>REMUNERAÇÕES (S-1200)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Competência</th><th style={th}>Sócio</th><th style={th}>Categoria</th><th style={thR}>Bruto</th><th style={thR}>INSS sócio (11%)</th><th style={thR}>INSS patronal (20%)</th></tr></thead>
                  <tbody>
                    {prev.remuneracoes.length === 0 && <tr><td style={td} colSpan={6}><i style={{ color: '#9CA3AF' }}>Sem remuneração (fechamento sem movimento).</i></td></tr>}
                    {prev.remuneracoes.map((r: any) => (
                      <tr key={r.comp + r.cpf}>
                        <td style={td}>{fmtComp(r.comp)}{r.comp !== sel && <div style={{ fontSize: 10, color: '#6B7280' }}>exigida pelo S-1210</div>}</td>
                        <td style={td}>{r.nome}</td><td style={td}>{r.categoria}</td>
                        <td style={tdR}>R$ {fmtBRL(r.bruto)}</td><td style={tdR}>R$ {fmtBRL(r.inssSegurado)}</td>
                        <td style={tdR}>{r.inssPatronal === null ? '-' : 'R$ ' + fmtBRL(r.inssPatronal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: FIN, marginBottom: 4 }}>PAGAMENTOS NO MÊS (S-1210)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Data</th><th style={th}>Competência paga</th><th style={thR}>Líquido</th></tr></thead>
                  <tbody>
                    {prev.pagamentos.length === 0 && <tr><td style={td} colSpan={3}><i style={{ color: '#9CA3AF' }}>Nenhum pagamento de pró-labore neste mês.</i></td></tr>}
                    {prev.pagamentos.map((p: any, i: number) => (
                      <tr key={i}><td style={td}>{fmtData(p.dtPagamento)}</td><td style={td}>{fmtComp(p.competencia)}</td><td style={tdR}>R$ {fmtBRL(p.valorLiquido)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ ...secSt, display: 'flex', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: FIN }}>DCTFWeb prevista para {fmtComp(sel)} (INSS sócio + patronal)</div>
                <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 700, color: FIN }}>R$ {fmtBRL(totalDctf)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: FIN, marginBottom: 4 }}>EVENTOS</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Etapa</th><th style={th}>Evento</th><th style={th}>Chave</th><th style={th}>Situação</th><th style={th}>Retorno</th></tr></thead>
                  <tbody>
                    {prev.eventos.map((e: any) => {
                      const st = e.status || 'A GERAR';
                      const [bg, fg] = COR_EV[st] || COR_EV['A GERAR'];
                      const txt = e.validacao || e.descResposta || '';
                      const info = INFORMATIVO.test(txt);
                      return (
                        <tr key={e.chave}>
                          <td style={{ ...td, color: '#6B7280' }}>{e.etapa} - {ETAPAS[e.etapa] || ''}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{e.tipo}</td>
                          <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{e.chave}</td>
                          <td style={td}><Chip txt={st} bg={bg} fg={fg} />{e.nrRecibo && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Recibo {e.nrRecibo}</div>}</td>
                          <td style={{ ...td, fontSize: 11, maxWidth: 380, wordBreak: 'break-word', color: info ? '#047857' : (st === 'REJEITADO' || st === 'INVALIDO') ? '#A32D2D' : '#6B7280' }}>
                            {info ? 'DCTFWeb transmitida - emitir o DARF no e-CAC.' : txt}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ ...titulo, marginBottom: 0 }}>Pagamentos do pró-labore</div>
          <button style={{ ...btnPri, marginLeft: 'auto' }} onClick={() => setNovoPg(true)}>+ Registrar pagamento</button>
        </div>
        {pgs.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum pagamento registrado.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Data</th><th style={th}>Sócio</th><th style={th}>Tipo</th><th style={th}>Competência</th><th style={thR}>Líquido</th><th style={th}>Observação</th><th style={th}></th></tr></thead>
            <tbody>
              {pgs.map(p => (
                <tr key={p.id}>
                  <td style={td}>{fmtData(p.dtPagamento)}</td><td style={td}>{p.nome}</td>
                  <td style={td}>{p.tipo === 'ADIANTAMENTO' ? <Chip txt="Adiantamento" bg="#FEF3C7" fg="#92400E" /> : 'Pró-labore'}</td>
                  <td style={td}>{fmtComp(p.competencia)}</td><td style={tdR}>R$ {fmtBRL(p.valorLiquido)}</td>
                  <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{p.observacao || ''}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {delId === p.id
                      ? <><button style={{ ...btnSec, height: 26, color: '#A32D2D' }} onClick={() => excluirPg(p.id)}>Confirmar</button>{' '}<button style={{ ...btnSec, height: 26 }} onClick={() => setDelId('')}>Não</button></>
                      : <button style={{ ...btnSec, height: 26 }} onClick={() => setDelId(p.id)}>Excluir</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {novoPg && <PagamentoModal onClose={() => setNovoPg(false)} onSaved={() => { setNovoPg(false); loadPgs(); if (sel) loadPrevia(sel); setMsg({ tipo: 'ok', txt: 'Pagamento registrado.' }); }} />}
      {transEv && <TransmitirModal tpAmb={tpAmb} perApur={sel} eventos={transEv} onClose={() => setTransEv(null)} onFim={(ok: boolean) => {
        loadComps(); loadPrevia(sel);
        if (ok) { setTransEv(null); setMsg({ tipo: 'ok', txt: `${fmtComp(sel)} transmitida e fechada. A DCTFWeb foi transmitida pelo eSocial: emita o DARF no e-CAC.` }); }
      }} />}
    </div>
  );
}

function TransmitirModal({ tpAmb, perApur, eventos, onClose, onFim }: { tpAmb: string; perApur: string; eventos: any[]; onClose: () => void; onFim: (ok: boolean) => void }) {
  const prod = tpAmb === '1';
  const pend = Array.from(new Set(eventos.filter(e => e.status !== 'PROCESSADO').map(e => Number(e.etapa)))).sort((a, b) => a - b);
  const [confirma, setConfirma] = useState('');
  const [rodando, setRodando] = useState(false);
  const [acabou, setAcabou] = useState(false);
  const [feitas, setFeitas] = useState<number[]>([]);
  const [atual, setAtual] = useState<number | null>(null);
  const [log, setLog] = useState<{ tipo: 'ok' | 'erro' | 'info'; txt: string }[]>([]);
  const add = (tipo: 'ok' | 'erro' | 'info', txt: string) => setLog(l => [...l, { tipo, txt }]);
  const pct = pend.length ? Math.round((feitas.length / pend.length) * 100) : 100;

  const iniciar = async () => {
    setRodando(true); setLog([]); setFeitas([]);
    try { await api.post('/hr/esocial-s13/consultar', { tpAmb: Number(tpAmb) }); } catch { /* sem lote pendente */ }
    let parar = false; let sucesso = false;
    for (let volta = 0; volta < 12 && !parar; volta++) {
      let r: any;
      try { r = await api.post('/hr/esocial-s13/enviar', { tpAmb: Number(tpAmb), perApur, confirmacao: confirma }); }
      catch (e: any) { add('erro', erroTxt(e, 'Erro ao enviar.')); break; }
      if (r.data?.mensagem) { add('ok', 'Todas as etapas da competência estão processadas.'); sucesso = true; break; }
      const etapa = Number(r.data?.etapa); const lote = (r.data?.lotes || [])[0];
      setAtual(etapa);
      if (!lote?.ok) { add('erro', `Etapa ${etapa} (${ETAPAS[etapa] || ''}): lote recusado - ${lote?.descResposta || ''}`); break; }
      add('info', `Etapa ${etapa} (${ETAPAS[etapa] || ''}) enviada - protocolo ${lote.protocolo}. Aguardando processamento...`);
      let concluiu = false;
      for (let t = 0; t < 36 && !concluiu && !parar; t++) {
        await sleep(5000);
        let c: any;
        try { c = await api.post('/hr/esocial-s13/consultar', { tpAmb: Number(tpAmb) }); }
        catch (e: any) { add('erro', erroTxt(e, 'Erro ao consultar.')); parar = true; break; }
        const l = (c.data?.lotes || [])[0];
        if (!l) { concluiu = true; break; }
        if (l.situacao === 'EM PROCESSAMENTO') continue;
        concluiu = true;
        if (l.situacao === 'REJEITADO' || Number(l.rejeitados) > 0) { add('erro', `Etapa ${etapa}: ${l.rejeitados || 0} evento(s) rejeitado(s) - veja o retorno na conferência.`); parar = true; }
        else { add('ok', `Etapa ${etapa} (${ETAPAS[etapa] || ''}) processada: ${l.aceitos} evento(s) aceito(s).`); setFeitas(f => [...f, etapa]); }
      }
      if (!concluiu && !parar) { add('erro', 'O eSocial não concluiu em 3 minutos. Feche e clique em Transmitir mais tarde: a consulta continua de onde parou.'); parar = true; }
    }
    setAtual(null); setRodando(false); setAcabou(true);
    if (sucesso) { setFeitas(pend); await sleep(2000); }
    onFim(sucesso);
  };

  const pode = !rodando && !acabou && pend.length > 0 && (!prod || confirma.trim() === 'ENVIAR PRODUCAO');
  return (
    <Modal titulo={`Transmitir ${fmtComp(perApur)}`} sub={prod ? 'Produção - efeito legal, alimenta a DCTFWeb' : 'Produção restrita (teste)'} onClose={onClose} travado={rodando}
      rodape={<>
        <button style={btnSec} disabled={rodando} onClick={onClose}>{acabou ? 'Fechar' : 'Cancelar'}</button>
        <button style={{ ...btnPri, background: pode ? (prod ? '#B45309' : FIN_ACCENT) : '#aaa' }} disabled={!pode} onClick={iniciar}>{rodando ? 'Transmitindo...' : 'Iniciar transmissão'}</button>
      </>}>
      <div style={secSt}>
        <div style={{ display: 'flex', fontSize: 12, color: FIN, marginBottom: 6 }}><span>Progresso</span><span style={{ marginLeft: 'auto', fontWeight: 600 }}>{pct}%</span></div>
        <div style={{ height: 10, background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid #D1E7DD' }}>
          <div style={{ width: pct + '%', height: '100%', background: FIN_ACCENT, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {pend.map(et => {
            const feita = feitas.includes(et); const agora = atual === et && !feita;
            return <Chip key={et} txt={`${feita ? '✓ ' : agora ? '… ' : ''}${et} - ${ETAPAS[et] || ''}`} bg={feita ? '#ECFDF5' : agora ? '#EFF6FF' : '#F3F4F6'} fg={feita ? '#047857' : agora ? '#1D4ED8' : '#6B7280'} />;
          })}
        </div>
      </div>
      {prod && !rodando && !acabou && (
        <div><Label>Confirmação (digite ENVIAR PRODUCAO)</Label>
          <input style={inputSt} value={confirma} onChange={e => setConfirma(e.target.value.toUpperCase())} placeholder="ENVIAR PRODUCAO" />
        </div>
      )}
      {log.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.map((l, i) => <div key={i} style={{ fontSize: 12, color: l.tipo === 'ok' ? '#047857' : l.tipo === 'erro' ? '#A32D2D' : '#374151' }}>{l.txt}</div>)}
        </div>
      )}
    </Modal>
  );
}

function PagamentoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [socios, setSocios] = useState<any[]>([]);
  const [personId, setPersonId] = useState('');
  const [tipo, setTipo] = useState('PRO_LABORE');
  const [comp, setComp] = useState('');
  const [dt, setDt] = useState('');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [sug, setSug] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/hr/pro-labore/diretoria').then(r => {
      const l = (Array.isArray(r.data) ? r.data : []).filter((s: any) => s.recebeProLabore);
      setSocios(l); if (l.length === 1) setPersonId(l[0].person.id);
    }).catch(() => setErro('Erro ao carregar os sócios.'));
  }, []);
  useEffect(() => {
    setSug('');
    if (tipo !== 'PRO_LABORE' || !personId || !/^\d{4}-\d{2}$/.test(comp)) return;
    api.get('/hr/esocial-s13/pagamentos/sugestao', { params: { personId, competencia: comp } })
      .then(r => { setSug(`Bruto R$ ${fmtBRL(r.data.bruto)} - INSS R$ ${fmtBRL(r.data.inss)} = líquido R$ ${fmtBRL(r.data.liquido)} (sem IRRF)`); setValor(v => v || fmtBRL(r.data.liquido)); })
      .catch((e: any) => setSug(erroTxt(e, '')));
  }, [personId, comp, tipo]);

  const salvar = async () => {
    setErro('');
    if (!personId) { setErro('Selecione o sócio.'); return; }
    if (tipo === 'PRO_LABORE' && !comp) { setErro('Informe a competência paga.'); return; }
    if (!dt) { setErro('Informe a data do pagamento.'); return; }
    if (!(parseValor(valor) > 0)) { setErro('Informe o valor líquido pago.'); return; }
    setSalvando(true);
    try {
      await api.post('/hr/esocial-s13/pagamentos', { personId, tipo, competencia: tipo === 'PRO_LABORE' ? comp : null, dtPagamento: dt, valorLiquido: parseValor(valor), observacao: obs });
      onSaved();
    } catch (e: any) { setErro(erroTxt(e, 'Erro ao registrar.')); }
    setSalvando(false);
  };

  return (
    <Modal titulo="Registrar pagamento" sub="Pró-labore pago ao sócio (base do S-1210)" onClose={onClose}
      rodape={<>
        <button style={btnSec} onClick={onClose}>Cancelar</button>
        <button style={{ ...btnPri, background: salvando ? '#aaa' : FIN_ACCENT }} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Registrar'}</button>
      </>}>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{erro}</div>}
      <div style={secSt}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / 3' }}><Label>Sócio (QSA)</Label>
            <select style={inputSt} value={personId} onChange={e => setPersonId(e.target.value)}>
              <option value="">Selecione...</option>
              {socios.map(s => <option key={s.shareholderId} value={s.person.id}>{s.person.fullName}</option>)}
            </select>
          </div>
          <div><Label>Tipo</Label>
            <select style={inputSt} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="PRO_LABORE">Pró-labore</option>
              <option value="ADIANTAMENTO">Adiantamento</option>
            </select>
          </div>
          {tipo === 'PRO_LABORE'
            ? <div><Label>Competência paga</Label><SmartMonthInput value={comp} onChange={(x: any) => setComp(val(x))} /></div>
            : <div style={{ fontSize: 11, color: '#6B7280', alignSelf: 'end' }}>Adiantamento não entra no S-1210 até ser liquidado.</div>}
          <div><Label>Data do pagamento</Label><SmartDateInput value={dt} onChange={(x: any) => setDt(val(x))} /></div>
          <div><Label>Valor líquido pago (R$)</Label><input style={{ ...inputSt, textAlign: 'right' }} value={valor} placeholder="0,00" onChange={e => setValor(e.target.value)} /></div>
          {sug && <div style={{ gridColumn: '1 / 3', fontSize: 11, color: FIN }}>{sug}</div>}
          <div style={{ gridColumn: '1 / 3' }}><Label>Observação</Label><input style={inputSt} value={obs} maxLength={300} onChange={e => setObs(e.target.value)} placeholder="ex.: PIX conforme extrato" /></div>
        </div>
      </div>
    </Modal>
  );
}
