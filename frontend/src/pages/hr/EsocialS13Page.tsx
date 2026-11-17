// frontend/src/pages/hr/EsocialS13Page.tsx
// LEDGR - eSocial S-1.3 (17/11/2026): gera, assina e valida (XSD oficial) os eventos da competencia. Envio: etapa seguinte.
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { SmartMonthInput } from '../../components/SmartMonthInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const mesValor = (x: any) => (typeof x === 'string' ? x : x?.target?.value ?? '');
const fmtComp = (c?: string | null) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '-');
const COR: Record<string, [string, string]> = {
  VALIDADO: ['#ECFDF5', '#047857'], INVALIDO: ['#FCEBEB', '#A32D2D'], GERADO: ['#F3F4F6', '#374151'],
  ENVIADO: ['#EFF6FF', '#1D4ED8'], PROCESSADO: ['#E8F5EE', FIN], REJEITADO: ['#FCEBEB', '#A32D2D'],
};
interface Ev { id: string; tipo: string; perApur: string | null; chave: string; eventoId: string; status: string; validacao: string | null; nrRecibo: string | null; descResposta: string | null; etapa: number; }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '8px 10px', textTransform: 'uppercase' };
const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '8px 10px', verticalAlign: 'top', borderTop: '1px solid #F3F4F6' };
const inputSt: React.CSSProperties = { height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, background: '#fff' };
const btnPri: React.CSSProperties = { height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const btnSec: React.CSSProperties = { height: 26, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 10px', fontSize: 11, background: '#fff', color: '#374151', cursor: 'pointer' };

export default function EsocialS13Page() {
  const [tpAmb, setTpAmb] = useState('2');
  const [comp, setComp] = useState('');
  const [evs, setEvs] = useState<Ev[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [xml, setXml] = useState<{ chave: string; xml: string } | null>(null);

  const load = async () => {
    try { const r = await api.get('/hr/esocial-s13/eventos', { params: { tpAmb } }); setEvs(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { setMsg({ tipo: 'erro', txt: e?.response?.data?.message || 'Erro ao carregar eventos.' }); }
  };
  useEffect(() => { load(); }, [tpAmb]);

  const gerar = async () => {
    if (!comp) { setMsg({ tipo: 'erro', txt: 'Informe a competência.' }); return; }
    setGerando(true); setMsg(null);
    try {
      const r = await api.post('/hr/esocial-s13/gerar', { tpAmb: Number(tpAmb), perApur: comp });
      const inv = (r.data?.eventos || []).filter((e: any) => e.status === 'INVALIDO').length;
      setMsg(inv ? { tipo: 'erro', txt: `${inv} evento(s) não passaram na validação do XSD oficial - veja a coluna Validação.` }
                 : { tipo: 'ok', txt: 'Pacote gerado, assinado e validado no XSD oficial. Nada foi enviado.' });
      load();
    } catch (e: any) {
      const m = e?.response?.data?.message; setMsg({ tipo: 'erro', txt: Array.isArray(m) ? m.join(' ') : m || 'Erro ao gerar.' });
    }
    setGerando(false);
  };

  const verXml = async (id: string) => {
    try { const r = await api.get('/hr/esocial-s13/eventos/' + id + '/xml'); setXml(r.data); }
    catch { setMsg({ tipo: 'erro', txt: 'Erro ao abrir o XML.' }); }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0E7490', background: '#ECFEFF', padding: '3px 8px', borderRadius: 6 }}>◆ RH</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>eSocial S-1.3</span>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4, fontWeight: 500 }}>Ambiente</div>
            <select style={inputSt} value={tpAmb} onChange={e => setTpAmb(e.target.value)}>
              <option value="2">Produção restrita (teste)</option>
              <option value="1">Produção</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4, fontWeight: 500 }}>Competência</div>
            <SmartMonthInput value={comp} onChange={(x: any) => setComp(mesValor(x))} />
          </div>
          <button style={{ ...btnPri, background: gerando ? '#aaa' : FIN_ACCENT }} disabled={gerando} onClick={gerar}>{gerando ? 'Gerando...' : 'Gerar e validar pacote'}</button>
          <div style={{ fontSize: 11, color: '#6B7280', maxWidth: 420 }}>
            Gera tabelas (S-1005, S-1020, S-1010), remuneração (S-1200), pagamentos do mês (S-1210) e fechamento (S-1299). Em produção restrita inclui o S-1000.
          </div>
        </div>
        {tpAmb === '1' && <div style={{ marginTop: 10, background: '#FFF7ED', color: '#9A3412', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>Ambiente de PRODUÇÃO: gerar aqui não envia nada, mas o envio, quando liberado, terá efeito legal.</div>}
        {msg && <div style={{ marginTop: 10, background: msg.tipo === 'ok' ? '#ECFDF5' : '#FCEBEB', color: msg.tipo === 'ok' ? '#047857' : '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{msg.txt}</div>}
      </div>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 }}>Eventos - {tpAmb === '1' ? 'Produção' : 'Produção restrita'}</div>
        {evs.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum evento gerado neste ambiente.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Evento</th><th style={th}>Competência</th><th style={th}>Chave</th><th style={th}>Situação</th><th style={th}>Validação / retorno</th><th style={th}></th></tr></thead>
            <tbody>
              {evs.map(e => {
                const [bg, fg] = COR[e.status] || COR.GERADO;
                return (
                  <tr key={e.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{e.tipo}</td>
                    <td style={td}>{fmtComp(e.perApur)}</td>
                    <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{e.chave}</td>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: bg, color: fg }}>{e.status}</span>{e.nrRecibo && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Recibo {e.nrRecibo}</div>}</td>
                    <td style={{ ...td, fontSize: 11, color: e.validacao ? '#A32D2D' : '#6B7280', maxWidth: 420, wordBreak: 'break-word' }}>{e.validacao || e.descResposta || 'OK no XSD'}</td>
                    <td style={td}><button style={btnSec} onClick={() => verXml(e.id)}>XML</button></td>
                  </tr>
                );
              })}
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
