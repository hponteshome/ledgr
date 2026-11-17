// frontend/src/pages/hr/EsocialS13Page.tsx
// LEDGR - eSocial S-1.3 (17/11/2026): gera/valida o pacote da competencia e transmite por etapas
// (S-1000 > tabelas > S-1200 > S-1210 > S-1299). Producao exige confirmacao digitada.
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { SmartMonthInput } from '../../components/SmartMonthInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const mesValor = (x: any) => (typeof x === 'string' ? x : x?.target?.value ?? '');
const fmtComp = (c?: string | null) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '-');
const fmtDh = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '-');
const COR: Record<string, [string, string]> = {
  VALIDADO: ['#ECFDF5', '#047857'], INVALIDO: ['#FCEBEB', '#A32D2D'], GERADO: ['#F3F4F6', '#374151'],
  ENVIADO: ['#EFF6FF', '#1D4ED8'], PROCESSADO: ['#E8F5EE', FIN], REJEITADO: ['#FCEBEB', '#A32D2D'], CRIADO: ['#F3F4F6', '#374151'],
};
const ETAPAS: Record<number, string> = { 1: 'S-1000', 2: 'Tabelas', 3: 'S-2300', 4: 'S-1200', 5: 'S-1210', 6: 'S-1299' };
interface Ev { id: string; tipo: string; perApur: string | null; chave: string; status: string; validacao: string | null; nrRecibo: string | null; descResposta: string | null; etapa: number; }
interface Lt { id: string; etapa: number; protocolo: string | null; status: string; cdResposta: number | null; descResposta: string | null; tempoEstimado: number | null; enviadoEm: string | null; consultadoEm: string | null; }

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', padding: '8px 10px', textTransform: 'uppercase' };
const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '8px 10px', verticalAlign: 'top', borderTop: '1px solid #F3F4F6' };
const inputSt: React.CSSProperties = { height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, background: '#fff' };
const btnPri: React.CSSProperties = { height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const btnOut: React.CSSProperties = { height: 32, border: `1px solid ${FIN_ACCENT}`, borderRadius: 6, padding: '0 14px', fontSize: 12, background: '#fff', color: FIN, cursor: 'pointer', fontWeight: 500 };
const btnSec: React.CSSProperties = { height: 26, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 10px', fontSize: 11, background: '#fff', color: '#374151', cursor: 'pointer' };
const rotulo: React.CSSProperties = { fontSize: 11, color: '#4B5563', marginBottom: 4, fontWeight: 500 };

function Selo({ s }: { s: string }) {
  const [bg, fg] = COR[s] || COR.GERADO;
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: bg, color: fg }}>{s}</span>;
}

export default function EsocialS13Page() {
  const [tpAmb, setTpAmb] = useState('2');
  const [comp, setComp] = useState('');
  const [evs, setEvs] = useState<Ev[]>([]);
  const [lotes, setLotes] = useState<Lt[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [confirma, setConfirma] = useState('');
  const [xml, setXml] = useState<{ chave: string; xml: string } | null>(null);
  const prod = tpAmb === '1';

  const erroTxt = (e: any, pad: string) => { const m = e?.response?.data?.message; return Array.isArray(m) ? m.join(' ') : m || pad; };
  const load = async () => {
    try {
      const [a, b] = await Promise.all([api.get('/hr/esocial-s13/eventos', { params: { tpAmb } }), api.get('/hr/esocial-s13/lotes', { params: { tpAmb } })]);
      setEvs(Array.isArray(a.data) ? a.data : []); setLotes(Array.isArray(b.data) ? b.data : []);
    } catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao carregar.') }); }
  };
  useEffect(() => { setConfirma(''); load(); }, [tpAmb]);

  const gerar = async () => {
    if (!comp) { setMsg({ tipo: 'erro', txt: 'Informe a competência.' }); return; }
    setOcupado('gerar'); setMsg(null);
    try {
      const r = await api.post('/hr/esocial-s13/gerar', { tpAmb: Number(tpAmb), perApur: comp });
      const inv = (r.data?.eventos || []).filter((e: any) => e.status === 'INVALIDO').length;
      setMsg(inv ? { tipo: 'erro', txt: `${inv} evento(s) não passaram na validação do XSD oficial - veja a coluna Validação.` }
                 : { tipo: 'ok', txt: 'Pacote gerado, assinado e validado no XSD oficial. Nada foi enviado.' });
    } catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao gerar.') }); }
    setOcupado(''); load();
  };

  const enviar = async () => {
    setOcupado('enviar'); setMsg(null);
    try {
      const r = await api.post('/hr/esocial-s13/enviar', { tpAmb: Number(tpAmb), confirmacao: confirma });
      if (r.data?.mensagem) setMsg({ tipo: 'ok', txt: r.data.mensagem });
      else {
        const ls = r.data?.lotes || [];
        const ok = ls.every((l: any) => l.ok);
        setMsg({ tipo: ok ? 'ok' : 'erro', txt: ls.map((l: any) => `Etapa ${l.etapa} (${ETAPAS[l.etapa] || ''}): ${l.ok ? 'lote recebido, protocolo ' + l.protocolo + '. Aguarde e clique em Consultar retorno.' : 'lote recusado - ' + l.descResposta}`).join(' ') });
      }
    } catch (e: any) { setMsg({ tipo: 'erro', txt: erroTxt(e, 'Erro ao enviar.') }); }
    setOcupado(''); setConfirma(''); load();
  };

  const consultar = async () => {
    setOcupado('consultar'); setMsg(null);
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
    setOcupado(''); load();
  };

  const verXml = async (id: string) => {
    try { const r = await api.get('/hr/esocial-s13/eventos/' + id + '/xml'); setXml(r.data); }
    catch { setMsg({ tipo: 'erro', txt: 'Erro ao abrir o XML.' }); }
  };

  const aberto = evs.filter(e => e.status !== 'PROCESSADO');
  const proxEtapa = aberto.length ? Math.min(...aberto.map(e => e.etapa)) : null;
  const aguardando = lotes.some(l => l.status === 'ENVIADO');
  const podeEnviar = proxEtapa !== null && !aguardando && (!prod || confirma.trim() === 'ENVIAR PRODUCAO');

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0E7490', background: '#ECFEFF', padding: '3px 8px', borderRadius: 6 }}>◆ RH</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>eSocial S-1.3</span>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><div style={rotulo}>Ambiente</div>
            <select style={inputSt} value={tpAmb} onChange={e => setTpAmb(e.target.value)}>
              <option value="2">Produção restrita (teste)</option>
              <option value="1">Produção</option>
            </select>
          </div>
          <div><div style={rotulo}>Competência</div><SmartMonthInput value={comp} onChange={(x: any) => setComp(mesValor(x))} /></div>
          <button style={{ ...btnPri, background: ocupado === 'gerar' ? '#aaa' : FIN_ACCENT }} disabled={!!ocupado} onClick={gerar}>{ocupado === 'gerar' ? 'Gerando...' : 'Gerar e validar pacote'}</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
          {prod && (
            <div><div style={rotulo}>Confirmação (digite ENVIAR PRODUCAO)</div>
              <input style={{ ...inputSt, width: 200 }} value={confirma} onChange={e => setConfirma(e.target.value.toUpperCase())} placeholder="ENVIAR PRODUCAO" />
            </div>
          )}
          <button style={{ ...btnPri, background: !podeEnviar || ocupado ? '#aaa' : prod ? '#B45309' : FIN_ACCENT }} disabled={!podeEnviar || !!ocupado} onClick={enviar}>
            {ocupado === 'enviar' ? 'Enviando...' : proxEtapa ? `Enviar etapa ${proxEtapa} (${ETAPAS[proxEtapa] || ''})` : 'Nada a enviar'}
          </button>
          <button style={btnOut} disabled={!!ocupado || !aguardando} onClick={consultar}>{ocupado === 'consultar' ? 'Consultando...' : 'Consultar retorno'}</button>
          <div style={{ fontSize: 11, color: '#6B7280', maxWidth: 440 }}>
            {aguardando ? 'Há lote aguardando processamento: consulte o retorno (em geral leva de segundos a poucos minutos).'
              : 'Cada etapa só é enviada depois que a anterior é processada. Antes do envio o sistema confere validador, assinaturas e o XSD do lote.'}
          </div>
        </div>
        {prod && <div style={{ marginTop: 10, background: '#FFF7ED', color: '#9A3412', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>Ambiente de PRODUÇÃO: o envio tem efeito legal e alimenta a DCTFWeb.</div>}
        {msg && <div style={{ marginTop: 10, background: msg.tipo === 'ok' ? '#ECFDF5' : '#FCEBEB', color: msg.tipo === 'ok' ? '#047857' : '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{msg.txt}</div>}
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 }}>Eventos - {prod ? 'Produção' : 'Produção restrita'}</div>
        {evs.length === 0 ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum evento gerado neste ambiente.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Etapa</th><th style={th}>Evento</th><th style={th}>Competência</th><th style={th}>Chave</th><th style={th}>Situação</th><th style={th}>Validação / retorno</th><th style={th}></th></tr></thead>
            <tbody>
              {evs.map(e => (
                <tr key={e.id}>
                  <td style={{ ...td, color: '#6B7280' }}>{e.etapa}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{e.tipo}</td>
                  <td style={td}>{fmtComp(e.perApur)}</td>
                  <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{e.chave}</td>
                  <td style={td}><Selo s={e.status} />{e.nrRecibo && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Recibo {e.nrRecibo}</div>}</td>
                  <td style={{ ...td, fontSize: 11, color: e.validacao || e.status === 'REJEITADO' ? '#A32D2D' : '#6B7280', maxWidth: 420, wordBreak: 'break-word' }}>{e.validacao || e.descResposta || 'OK no XSD'}</td>
                  <td style={td}><button style={btnSec} onClick={() => verXml(e.id)}>XML</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 }}>Lotes enviados</div>
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
