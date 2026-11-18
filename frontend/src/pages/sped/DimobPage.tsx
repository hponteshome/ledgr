// frontend/src/pages/sped/DimobPage.tsx
// LEDGR - DIMOB (18/11/2026): conferencia por contrato e mes e arquivo de importacao do PGD Dimob.
// Fonte: titulos de aluguel recebidos ligados a contrato (aluguel, comissao, IR retido). Imovel no exterior fica fora.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDoc = (d?: string | null) => {
  const s = String(d ?? '').replace(/\D/g, '');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return s || '-';
};
const fmtData = (d?: string | null) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '-');
const CPF_KEY = 'ledgr.dimob.cpfResponsavel';
const lerCpf = () => { try { return localStorage.getItem(CPF_KEY) ?? ''; } catch { return ''; } };
const gravarCpf = (v: string) => { try { localStorage.setItem(CPF_KEY, v); } catch { /* sem storage */ } };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 18, marginBottom: 16 };
const titulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', marginBottom: 8 };
const th: React.CSSProperties = { textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#6B7280', padding: '6px 6px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { fontSize: 11, color: '#111827', padding: '6px 6px', verticalAlign: 'top', borderTop: '1px solid #F3F4F6', textAlign: 'right', whiteSpace: 'nowrap' };
const inputSt: React.CSSProperties = { height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, background: '#fff' };
const btnPri: React.CSSProperties = { height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, background: FIN_ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 500 };
const btnOut: React.CSSProperties = { height: 32, border: `1px solid ${FIN_ACCENT}`, borderRadius: 6, padding: '0 14px', fontSize: 12, background: '#fff', color: FIN, cursor: 'pointer', fontWeight: 500 };

interface Mes { aluguel: number; comissao: number; imposto: number }
interface Loc { contratoId: string; contratoLedgr: string; numero: string; imovel: string; dataContrato: string | null; locatarioDoc: string; locatarioNome: string; endereco: string; cep: string; municipio: string | null; uf: string; meses: Mes[]; total: Mes }
interface Conf { declarante: any; locacoes: Loc[]; exterior: { contrato: string; imovel: string; aluguel: number }[]; avisos: { nivel: string; contrato?: string; texto: string }[]; totais: Mes }

export default function DimobPage() {
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(String(anoAtual - 1));
  const [cpf, setCpf] = useState(lerCpf());
  const [conf, setConf] = useState<Conf | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const erroTxt = async (e: any, pad: string) => {
    const d = e?.response?.data;
    if (d instanceof Blob) { try { const j = JSON.parse(await d.text()); return Array.isArray(j.message) ? j.message.join(' ') : j.message || pad; } catch { return pad; } }
    const m = d?.message; return Array.isArray(m) ? m.join(' ') : m || pad;
  };

  const conferir = async () => {
    setOcupado(true); setMsg(null); gravarCpf(cpf);
    try { const r = await api.get('/dimob/conferencia', { params: { ano, cpfResponsavel: cpf } }); setConf(r.data); }
    catch (e: any) { setConf(null); setMsg({ tipo: 'erro', txt: await erroTxt(e, 'Erro na conferencia.') }); }
    setOcupado(false);
  };

  const gerar = async () => {
    setOcupado(true); setMsg(null); gravarCpf(cpf);
    try {
      const r = await api.get('/dimob/arquivo', { params: { ano, cpfResponsavel: cpf }, responseType: 'blob' });
      const cd = String(r.headers?.['content-disposition'] ?? '');
      const nome = /filename="([^"]+)"/.exec(cd)?.[1] ?? `DIMOB-${ano}.txt`;
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/plain' }));
      const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg({ tipo: 'ok', txt: `Arquivo ${nome} gerado. Importe no PGD Dimob (Ficha > Importar) e valide antes de transmitir.` });
    } catch (e: any) { setMsg({ tipo: 'erro', txt: await erroTxt(e, 'Erro ao gerar o arquivo.') }); }
    setOcupado(false);
  };

  const erros = conf?.avisos.filter(a => a.nivel === 'ERRO') ?? [];
  const alertas = conf?.avisos.filter(a => a.nivel !== 'ERRO') ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} title="Voltar" style={{ height: 30, width: 30, border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: '#374151' }}>←</button>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', padding: '3px 8px', borderRadius: 6 }}>◆ SPED & Obrigações</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>DIMOB <span style={{ fontSize: 13, fontWeight: 400, color: '#6B7280' }}>(declaração de informações sobre atividades imobiliárias)</span></span>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Ano-calendário</div>
            <select style={{ ...inputSt, width: 110 }} value={ano} onChange={e => { setAno(e.target.value); setConf(null); }}>
              {Array.from({ length: 6 }, (_, i) => anoAtual - i).map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <div><div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>CPF do responsável perante a RFB</div>
            <input style={{ ...inputSt, width: 170 }} value={cpf} onChange={e => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="somente números" /></div>
          <button style={btnOut} disabled={ocupado} onClick={conferir}>{ocupado ? 'Aguarde...' : 'Conferir'}</button>
          <button style={{ ...btnPri, opacity: !conf || erros.length || ocupado ? 0.5 : 1 }} disabled={!conf || !!erros.length || ocupado} onClick={gerar}>Gerar arquivo do PGD</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>
          Fonte: títulos de aluguel recebidos ligados ao contrato, pelo mês do recebimento (contrato com imobiliária: dados do comprovante/DIMOB da imobiliária). Imóvel no exterior fica fora.
        </div>
        {msg && <div style={{ marginTop: 10, background: msg.tipo === 'ok' ? '#ECFDF5' : '#FCEBEB', color: msg.tipo === 'ok' ? '#047857' : '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{msg.txt}</div>}
      </div>

      {conf && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
              <div><div style={{ color: '#6B7280', fontSize: 11 }}>Contratos (R02)</div><b>{conf.locacoes.length}</b></div>
              <div><div style={{ color: '#6B7280', fontSize: 11 }}>Aluguel</div><b>{brl(conf.totais.aluguel)}</b></div>
              <div><div style={{ color: '#6B7280', fontSize: 11 }}>Comissão</div><b>{brl(conf.totais.comissao)}</b></div>
              <div><div style={{ color: '#6B7280', fontSize: 11 }}>Imposto retido</div><b>{brl(conf.totais.imposto)}</b></div>
              <div><div style={{ color: '#6B7280', fontSize: 11 }}>Declarante</div><b>{conf.declarante.nome}</b> - {fmtDoc(conf.declarante.cnpj)} - município RFB {conf.declarante.municipio || '?'}</div>
            </div>
            {erros.length > 0 && <div style={{ marginTop: 10, background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              <b>Corrija antes de gerar:</b><ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{erros.map((a, i) => <li key={i}>{a.contrato ? a.contrato + ': ' : ''}{a.texto}</li>)}</ul></div>}
            {alertas.length > 0 && <div style={{ marginTop: 10, background: '#FFFBEB', color: '#92400E', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              <b>Alertas:</b><ul style={{ margin: '4px 0 0 18px', padding: 0 }}>{alertas.map((a, i) => <li key={i}>{a.contrato ? a.contrato + ': ' : ''}{a.texto}</li>)}</ul></div>}
          </div>

          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={titulo}>Conferência por contrato e mês (aluguel / comissão)</div>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>Contrato</th><th style={{ ...th, textAlign: 'left' }}>Locatário</th>
                {MESES.map(m => <th key={m} style={th}>{m}</th>)}<th style={th}>Total</th>
              </tr></thead>
              <tbody>
                {conf.locacoes.map(l => (
                  <tr key={l.contratoId}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <b>{l.contratoLedgr}</b>{l.numero !== l.contratoLedgr && <span style={{ color: '#92400E' }}> → {l.numero}</span>}
                      <div style={{ color: '#6B7280' }}>{l.imovel} - {fmtData(l.dataContrato)}</div>
                      <div style={{ color: '#6B7280' }}>{l.cep} - mun. {l.municipio ?? '?'}/{l.uf}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal', minWidth: 160 }}>{l.locatarioNome}<div style={{ color: '#6B7280' }}>{fmtDoc(l.locatarioDoc)}</div></td>
                    {l.meses.map((m, i) => (
                      <td key={i} style={td}>{m.aluguel ? brl(m.aluguel) : '-'}{m.comissao ? <div style={{ color: '#6B7280' }}>{brl(m.comissao)}</div> : null}</td>
                    ))}
                    <td style={{ ...td, fontWeight: 600 }}>{brl(l.total.aluguel)}{l.total.comissao ? <div style={{ color: '#6B7280', fontWeight: 400 }}>{brl(l.total.comissao)}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conf.exterior.length > 0 && (
            <div style={card}>
              <div style={titulo}>Fora da DIMOB - imóvel no exterior</div>
              {conf.exterior.map(x => <div key={x.contrato} style={{ fontSize: 12 }}>{x.contrato} ({x.imovel}): {brl(x.aluguel)}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
