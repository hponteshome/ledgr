// frontend/src/pages/projects/CircuitosNeutrosPage.tsx
// Fase 1.11 A2 (04/10/2026): circuitos neutros da empresa ativa (LEDGR) - transferencias internas agrupadas por rotulo.
// O saldo de cada circuito (entradas - saidas) deve ser zero; residuo = dinheiro que saiu e nao voltou, a explicar.
// Desfazer: encerra a decisao (com motivo) e o movimento volta a triagem.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ModalProjeto, Secao, ErroModal, BotaoSec, BotaoPri, inputModal, erroApi } from './workspace/ModalProjeto';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const thSt: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdSt: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };
const filtroSt: React.CSSProperties = { padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 };

interface Item { transacaoId: string; data: string; tipo: string; valor: string; lancamento: string; motivo: string; }
interface Circuito { circuito: string; qtdSaidas: number; qtdEntradas: number; saidas: string; entradas: string; saldo: string; itens: Item[]; }

export default function CircuitosNeutrosPage() {
  const [lista, setLista] = useState<Circuito[]>([]);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [desfazendo, setDesfazendo] = useState<Item | null>(null);
  const carregar = useCallback(() => {
    setErro('');
    api.get('/projects-financeiro/circuitos').then((r) => setLista(r.data || [])).catch((e) => setErro(erroApi(e, 'Falha ao carregar os circuitos.')));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Circuitos neutros</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 }}>Empresa ativa · transferências internas agrupadas por circuito. O saldo de cada circuito deve ser zero; o resíduo é dinheiro que saiu e não voltou.</div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>⚠ {erro}</div>}
      {!erro && lista.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Nenhuma transferência interna classificada nesta empresa.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lista.map((c) => {
          const saldo = Number(c.saldo);
          const zerado = Math.abs(saldo) < 0.005;
          return (
            <div key={c.circuito} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, borderLeft: `3px solid ${zerado ? '#16A34A' : '#D97706'}` }}>
              <div onClick={() => setAberto(aberto === c.circuito ? null : c.circuito)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.circuito}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{c.qtdSaidas} saída(s) · {c.qtdEntradas} entrada(s)</div>
                </div>
                <div style={{ fontSize: 12, color: '#374151' }}>Saiu <b>{fmtBRL(c.saidas)}</b></div>
                <div style={{ fontSize: 12, color: '#374151' }}>Voltou <b>{fmtBRL(c.entradas)}</b></div>
                {zerado
                  ? <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '3px 10px' }}>Zerado</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '3px 10px' }}>{saldo < 0 ? `Saiu ${fmtBRL(-saldo)} a mais` : `Voltou ${fmtBRL(saldo)} a mais`}: a explicar</span>}
              </div>
              {aberto === c.circuito && (
                <div style={{ borderTop: '0.5px solid #F3F4F6', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thSt}>Data</th><th style={thSt}>Movimento</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Lançamento</th><th style={thSt}>Motivo</th><th style={thSt}></th></tr></thead>
                    <tbody>
                      {c.itens.map((i) => (
                        <tr key={i.transacaoId}>
                          <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(i.data)}</td>
                          <td style={tdSt}>{i.tipo === 'DEBIT' ? 'Saída' : 'Entrada'}</td>
                          <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, color: i.tipo === 'DEBIT' ? '#A32D2D' : '#166534' }}>{i.tipo === 'DEBIT' ? '-' : '+'}{fmtBRL(i.valor)}</td>
                          <td style={{ ...tdSt, fontSize: 12 }}>{i.lancamento}</td>
                          <td style={{ ...tdSt, fontSize: 12, color: '#6B7280' }}>{i.motivo}</td>
                          <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setDesfazendo(i)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Desfazer</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {desfazendo && <DesfazerModal item={desfazendo} onClose={() => setDesfazendo(null)} onFeito={() => { setDesfazendo(null); carregar(); }} />}
    </div>
  );
}

function DesfazerModal({ item, onClose, onFeito }: { item: Item; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-financeiro/decisoes/${item.transacaoId}/encerrar`, { motivo: motivo.trim() });
      toast.success('Decisão desfeita; o movimento voltou à triagem.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao desfazer.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Desfazer classificação" subtitulo={`${fmtData(item.data)} · ${fmtBRL(item.valor)} · ${item.lancamento}`} largura={480} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Voltar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando} perigo>{enviando ? 'Aguarde...' : 'Desfazer'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao><div style={{ fontSize: 12, color: '#374151' }}>A decisão fica no histórico, encerrada com o motivo, e o movimento volta para a triagem.</div></Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." /></Secao>
    </ModalProjeto>
  );
}
