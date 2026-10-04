// frontend/src/pages/projects/TriagemSaidasPage.tsx
// Fase 1.11 parte A (04/10/2026): classificacao das SAIDAS do extrato no LEDGR (empresa ativa), pelo Financeiro.
// Aplicacao por conta da beneficiaria, devolucao ao Adquirente, transferencia interna (neutra) ou nao pertence.
// As anotacoes da planilha do Financeiro aparecem SO como apoio a decisao; nunca viram dado contabil, financeiro ou do projeto.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './workspace/ModalProjeto';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const thSt: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdSt: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };

interface Saida { id: string; data: string; valor: string; lancamento: string; favorecidoNome: string | null; favorecidoDocumento: string | null; anotacao: string | null; }
interface Destino { operacaoId: string; nome: string; contrapartes: { id: string; nome: string; papeis: string }[]; creditos: { id: string; rotulo: string }[]; }
interface Apoio { naturezas: { codigo: string; nome: string; tipo: string }[]; destinos: Destino[]; }

export default function TriagemSaidasPage() {
  const { user } = useAuth() as any;
  const master = user?.profile?.permissions?.all === true;
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [apoio, setApoio] = useState<Apoio | null>(null);
  const [erro, setErro] = useState('');
  const [ano, setAno] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [aplicando, setAplicando] = useState<Saida | null>(null);
  const [decidindo, setDecidindo] = useState<Saida | null>(null);

  const carregar = useCallback(() => {
    setErro('');
    api.get('/projects-financeiro/saidas').then((r) => setSaidas(r.data || [])).catch((e) => setErro(erroApi(e, 'Falha ao carregar as saídas.')));
  }, []);
  useEffect(() => {
    carregar();
    if (master) api.get('/projects-financeiro/saidas/apoio').then((r) => setApoio(r.data)).catch(() => {});
  }, [carregar, master]);

  const anos = useMemo(() => [...new Set(saidas.map((s) => s.data.slice(0, 4)))].sort(), [saidas]);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return saidas.filter((s) => (ano === 'TODOS' || s.data.startsWith(ano)) &&
      (!t || [s.lancamento, s.favorecidoNome, s.anotacao].some((x) => (x || '').toLowerCase().includes(t))));
  }, [saidas, ano, busca]);
  const total = lista.reduce((s, x) => s + Number(x.valor), 0);
  const semDestino = !!apoio && apoio.destinos.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Classificar saídas</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 }}>
        Empresa ativa · aplicações por conta da beneficiária, devoluções ao Adquirente e transferências internas. O que não for da operação fica só no LEDGR.
      </div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>⚠ {erro}</div>}
      {semDestino && <div style={{ background: '#F3F4F6', color: '#374151', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>A empresa ativa não é recebedora de nenhuma operação de projeto.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={ano} onChange={(e) => setAno(e.target.value)} style={{ padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 }}>
          <option value="TODOS">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no lançamento, favorecido ou anotação" style={{ padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, width: 320 }} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#374151' }}>{lista.length} saída(s) · <b>{fmtBRL(total)}</b></div>
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Lançamento</th><th style={thSt}>Favorecido (extrato)</th><th style={thSt}>Anotação da planilha (apoio)</th>{master && !semDestino && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma saída para classificar.</td></tr>}
            {lista.map((s) => (
              <tr key={s.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(s.data)}</td>
                <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(s.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{s.lancamento}</td>
                <td style={tdSt}>
                  {s.favorecidoNome ? <div>{s.favorecidoNome}</div> : <i style={{ color: '#9CA3AF' }}>-</i>}
                  {s.favorecidoDocumento && <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{s.favorecidoDocumento}</div>}
                </td>
                <td style={{ ...tdSt, fontSize: 12, color: '#6B7280', fontStyle: 'italic', maxWidth: 320 }}>{s.anotacao || ''}</td>
                {master && !semDestino && (
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setAplicando(s)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#1A4A3A', color: '#fff', cursor: 'pointer', marginRight: 6 }}>Aplicação</button>
                    <button onClick={() => setDecidindo(s)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer' }}>Outra decisão</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aplicando && apoio && <AplicarModal saida={aplicando} apoio={apoio} onClose={() => setAplicando(null)} onFeito={() => { setAplicando(null); carregar(); }} />}
      {decidindo && <DecidirModal saida={decidindo} onClose={() => setDecidindo(null)} onFeito={() => { setDecidindo(null); carregar(); }} />}
    </div>
  );
}

function AplicarModal({ saida, apoio, onClose, onFeito }: { saida: Saida; apoio: Apoio; onClose: () => void; onFeito: () => void }) {
  const [operacaoId, setOperacaoId] = useState(apoio.destinos[0]?.operacaoId || '');
  const [natureza, setNatureza] = useState('');
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [creditoId, setCreditoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const destino = apoio.destinos.find((d) => d.operacaoId === operacaoId);
  const devolucao = apoio.naturezas.find((n) => n.codigo === natureza)?.tipo === 'DEVOLUCAO';
  const valido = !!operacaoId && !!natureza && motivo.trim().length >= 10 && (!devolucao || !!beneficiarioId);
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-financeiro/saidas/${saida.id}/aplicar`, { operacaoId, naturezaCodigo: natureza, beneficiarioId: beneficiarioId || undefined, creditoId: creditoId || undefined, descricao: descricao.trim(), motivo: motivo.trim() });
      toast.success('Aplicação registrada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Registrar aplicação de recursos" subtitulo={`${fmtData(saida.data)} · ${fmtBRL(saida.valor)} · ${saida.lancamento}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      {saida.anotacao && <Secao titulo="ANOTAÇÃO DA PLANILHA (SÓ APOIO)"><div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>{saida.anotacao}</div></Secao>}
      <Secao titulo="CLASSIFICAÇÃO">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo rotulo="Operação *">
            <select style={inputModal} value={operacaoId} onChange={(e) => { setOperacaoId(e.target.value); setBeneficiarioId(''); setCreditoId(''); }}>
              {apoio.destinos.map((d) => <option key={d.operacaoId} value={d.operacaoId}>{d.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Natureza *">
            <select style={inputModal} value={natureza} onChange={(e) => setNatureza(e.target.value)}>
              <option value="">Selecione...</option>
              {apoio.naturezas.map((n) => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Descrição" largo><input style={inputModal} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: parcela do acordo PGFN" /></Campo>
        </div>
      </Secao>
      {devolucao && destino && (
        <Secao titulo="DEVOLUÇÃO">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Campo rotulo="Devolvido a *">
              <select style={inputModal} value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
                <option value="">Selecione...</option>
                {destino.contrapartes.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.papeis})</option>)}
              </select>
            </Campo>
            <Campo rotulo="Crédito devolvido (se for de um crédito específico)">
              <select style={inputModal} value={creditoId} onChange={(e) => setCreditoId(e.target.value)}>
                <option value="">Não vincular a um crédito</option>
                {destino.creditos.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            </Campo>
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Se o intermediário (por exemplo, Antonio Vieira) ainda não participa da operação, cadastre-o antes em Participantes, com o papel Intermediário do Adquirente.</div>
        </Secao>
      )}
      <Secao titulo="MOTIVO *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." />
      </Secao>
    </ModalProjeto>
  );
}

function DecidirModal({ saida, onClose, onFeito }: { saida: Saida; onClose: () => void; onFeito: () => void }) {
  const [decisao, setDecisao] = useState<'TRANSFERENCIA_INTERNA' | 'NAO_PERTENCE'>('TRANSFERENCIA_INTERNA');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-financeiro/saidas/${saida.id}/decidir`, { decisao, motivo: motivo.trim() });
      toast.success('Decisão registrada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Classificar saída" subtitulo={`${fmtData(saida.data)} · ${fmtBRL(saida.valor)} · ${saida.lancamento}`} largura={500} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      {saida.anotacao && <Secao titulo="ANOTAÇÃO DA PLANILHA (SÓ APOIO)"><div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>{saida.anotacao}</div></Secao>}
      <Secao titulo="DECISÃO">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
          <input type="radio" checked={decisao === 'TRANSFERENCIA_INTERNA'} onChange={() => setDecisao('TRANSFERENCIA_INTERNA')} /> Transferência interna (neutra: o dinheiro volta ou paga algo a partir de outra conta)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="radio" checked={decisao === 'NAO_PERTENCE'} onChange={() => setDecisao('NAO_PERTENCE')} /> Não pertence à operação
        </label>
      </Secao>
      <Secao titulo="MOTIVO *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." />
      </Secao>
    </ModalProjeto>
  );
}
