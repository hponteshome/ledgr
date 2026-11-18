// frontend/src/pages/hr/EsocialS13Page.tsx
// LEDGR - Eventos eSocial (consulta) - 18/11/2026: somente leitura. Eventos (com historico: substituidos, reaberturas,
// retificacoes), lotes, XML e consulta de retorno. Envio somente pelo Processamento Mensal, com competencia aprovada.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const fmtComp = (c?: string | null) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '-');
const fmtDh = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');
const INFORMATIVO = /446 - Transmiss[aã]o da DCTFWeb realizada com sucesso/i;
const COR: Record<string, [string, string]> = {
  VALIDADO: ['#ECFDF5', '#047857'], INVALIDO: ['#FCEBEB', '#A32D2D'], GERADO: ['#F3F4F6', '#374151'],
  ENVIADO: ['#EFF6FF', '#1D4ED8'], PROCESSADO: ['#E8F5EE', FIN], REJEITADO: ['#FCEBEB', '#A32D2D'], CRIADO: ['#F3F4F6', '#374151'],
  SUBSTITUIDO: ['#F3F4F6', '#6B7280'],
};
const ETAPAS: Record<number, string> = { 1: 'S-1000 / S-1298', 2: 'Tabelas', 3: 'S-2300', 4: 'S-1200', 5: 'S-1210', 6: 'S-1299' };
interface Ev { id: string; tipo: string; perApur: string | null; chave: string; status: string; validacao: string | null; nrRecibo: string | null; descResposta: string | null; etapa: number; updatedAt: string; }
interface Lt { id: string; etapa: number; protocolo: string | null; status: string; cdResposta: number | null; descResposta: string | null; enviadoEm: string | null; consultadoEm: string | null; }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const titulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '8px 10px', textTransform: 'uppercase' };
const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '8px 10px', verticalAlign: 'top', borderTop: '1px solid #F3F4F6' };
const inputSt: React.CSSProperties = { height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, background: '#fff' };
const btnPri: React.CSSProperties = { height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const btnOut: React.CSSProperties = { height: 32, border: `1px solid ${FIN_ACCENT}`, borderRadius: 6, padding: '0 14px', fontSize: 12, background: '#fff', color: FIN, cursor: 'pointer', fontWeight: 500 };
const btnSec: React.CSSProperties = { height: 26, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 10px', fontSize: 11, background: '#fff', color: '#374151', cursor: 'pointer' };

function Selo({ s }: { s: string }) {
  const [bg, fg] = COR[s] || COR.GERADO;
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: bg, color: fg }}>{s}</span>;
}

export default function EsocialS13Page() {
  const navigate = useNavigate();
  const [tpAmb, setTpAmb] = useState('1');
  const [evs, setEvs] = useState<Ev[]>([]);
  const [lotes, setLotes] = useState<Lt[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [xml, setXml] = useState<{ chave: string; xml: string } | null>(null);
  const prod = tpAmb === '1';

  const erroTxt = (e: any, pad: string) => { const m = e?.response?.data?.message; return Array.isArray(m) ? m.join(' ') : m || pad; };
  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get('/hr/esocial-s13/eventos', { params: { tpAmb } }), api.get('/hr/esocial-s13/lotes', { params: { tpAmb } })]);
      setEvs(Array.isArray(a.data) ? a.data : []); setLotes(Array.isArray(b.data) ? b.data : []);
    } catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao carregar.') }); }
  };
  useEffect(() => { setMsg(null); load(); }, [tpAmb]);

  const consultar = async () => {
    setOcupado(true); setMsg(null);
    try {
      const r = await api.post('/hr/esocial-s13/consultar', { tpAmb: Number(tpAmb) });
      if (r.data?.mensagem) setMsg({ tipo: 'ok', txt: r.data.mensagem });
      else {
        const ls = r.data?.lotes || [];
        const erro = ls.some((l: any) => l.situacao === 'REJEITADO' || l.rejeitados > 0);
        setMsg({ tipo: erro ? 'erro' : 'ok', txt: ls.map((l: any) => l.situacao === 'EM PROCESSAMENTO'
          ? `Etapa ${l.etapa}: ainda em processamento${l.tempoEstimado ? ' (estimativa ' + l.tempoEstimado + 's)' : ''}.`
          : `Etapa ${l.etapa}: ${l.situacao} - ${l.aceitos ?? 0} aceito(s), ${l.rejeitados ?? 0} rejeitado(s).`).join(' ') });
      }
    } catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao consultar.') }); }
    setOcupado(false); load();
  };

  const verXml = async (id: string) => {
    try { const r = await api.get('/hr/esocial-s13/eventos/' + id + '/xml'); setXml(r.data); }
    catch { setMsg({ tipo: 'erro', txt: 'Erro ao abrir o XML.' }); }
  };

  const aguardando = lotes.some(l => l.status === 'ENVIADO');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => navigate('/app/hr/pro-labore')} title="Voltar para o Pró-labore" style={{ height: 30, width: 30, border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: '#374151' }}>←</button>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0E7490', background: '#ECFEFF', padding: '3px 8px', borderRadius: 6 }}>◆ RH</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Eventos eSocial <span style={{ fontSize: 13, fontWeight: 400, color: '#6B7280' }}>(consulta)</span></span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...inputSt, width: 210 }} value={tpAmb} onChange={e => setTpAmb(e.target.value)}>
            <option value="1">Produção</option>
            <option value="2">Produção restrita (teste)</option>
          </select>
          <button style={btnPri} onClick={() => navigate('/app/hr/processamento-mensal')}>Processamento Mensal</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 280 }}>
            Tela somente de consulta. <b>Geração e envio</b> são feitos no <b>Processamento Mensal</b>, depois da conferência aprovada.
          </div>
          <button style={{ ...btnOut, opacity: ocupado || !aguardando ? 0.5 : 1 }} disabled={ocupado || !aguardando} onClick={consultar}>{ocupado ? 'Consultando...' : 'Consultar retorno'}</button>
        </div>
        {aguardando && <div style={{ marginTop: 10, fontSize: 11, color: '#1D4ED8' }}>Há lote aguardando processamento: use Consultar retorno.</div>}
        {msg && <div style={{ marginTop: 10, background: msg.tipo === 'ok' ? '#ECFDF5' : '#FCEBEB', color: msg.tipo === 'ok' ? '#047857' : '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{msg.txt}</div>}
      </div>

      <div style={card}>
        <div style={titulo}>Eventos - {prod ? 'Produção' : 'Produção restrita'}</div>
        {evs.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum evento neste ambiente.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Etapa</th><th style={th}>Evento</th><th style={th}>Competência</th><th style={th}>Chave</th><th style={th}>Situação</th><th style={th}>Retorno</th><th style={th}></th></tr></thead>
            <tbody>
              {evs.map(e => {
                const txt = e.validacao || e.descResposta || '';
                const info = INFORMATIVO.test(txt);
                return (
                  <tr key={e.id} style={{ opacity: e.status === 'SUBSTITUIDO' ? 0.6 : 1 }}>
                    <td style={{ ...td, color: '#6B7280' }}>{e.etapa} - {ETAPAS[e.etapa] || ''}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.tipo}</td>
                    <td style={td}>{fmtComp(e.perApur)}</td>
                    <td style={{ ...td, fontSize: 11, color: '#6B7280', wordBreak: 'break-all' }}>{e.chave}</td>
                    <td style={td}><Selo s={e.status} />{e.nrRecibo && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Recibo {e.nrRecibo}</div>}</td>
                    <td style={{ ...td, fontSize: 11, maxWidth: 380, wordBreak: 'break-word', color: info ? '#047857' : (e.validacao || e.status === 'REJEITADO') ? '#A32D2D' : '#6B7280' }}>
                      {info ? 'DCTFWeb transmitida - emitir o DARF no e-CAC.' : txt}
                    </td>
                    <td style={td}><button style={btnSec} onClick={() => verXml(e.id)}>XML</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <div style={titulo}>Lotes enviados</div>
        {lotes.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum lote enviado neste ambiente.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Etapa</th><th style={th}>Protocolo</th><th style={th}>Situação</th><th style={th}>Retorno</th><th style={th}>Enviado</th><th style={th}>Consultado</th></tr></thead>
            <tbody>
              {lotes.map(l => (
                <tr key={l.id}>
                  <td style={td}>{l.etapa} - {ETAPAS[l.etapa] || ''}</td>
                  <td style={{ ...td, fontSize: 11 }}>{l.protocolo || '-'}</td>
                  <td style={td}><Selo s={l.status} /></td>
                  <td style={{ ...td, fontSize: 11, maxWidth: 420, wordBreak: 'break-word' }}>{l.cdResposta ? l.cdResposta + ' - ' : ''}{l.descResposta || ''}</td>
                  <td style={{ ...td, fontSize: 11 }}>{fmtDh(l.enviadoEm)}</td>
                  <td style={{ ...td, fontSize: 11 }}>{fmtDh(l.consultadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {xml && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={ev => { if (ev.target === ev.currentTarget) setXml(null); }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 900, maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ background: FIN, color: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>XML - {xml.chave}</div>
              <button onClick={() => setXml(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <pre style={{ margin: 0, padding: 16, overflow: 'auto', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{xml.xml.replace(/></g, '>\n<')}</pre>
            <div style={{ background: '#FAFAFA', borderTop: '1px solid #EEE', padding: '10px 18px', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnSec} onClick={() => navigator.clipboard?.writeText(xml.xml)}>Copiar XML</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
