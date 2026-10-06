// frontend/src/pages/projects/EncaminhamentoEntradasPage.tsx
// Fase 1.8 revista / 1.11 A2 (04/10/2026): triagem das ENTRADAS do extrato no LEDGR (empresa ativa). Encaminhar ao projeto,
// transferencia interna (neutra, com circuito) ou nao pertence. Anotacao da planilha so como apoio.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './workspace/ModalProjeto';
import DecisaoMovimentoModal from './DecisaoMovimentoModal';
import { useOrdenacao, ThOrdenavel } from './ordenacao';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const thSt: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdSt: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };
const filtroSt: React.CSSProperties = { padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 };

interface Entrada { id: string; data: string; valor: string; lancamento: string; pagadorNome: string | null; pagadorDocumento: string | null; remetenteConhecido: boolean; anotacao: string | null; }
interface Destino { operacaoId: string; nome: string; }
// Ordenacao por coluna (06/10/2026): clicar no titulo ordena; clicar de novo inverte; vazios sempre no fim.
const COLS_ENTRADA: Record<string, (e: Entrada) => any> = { data: (e) => e.data, valor: (e) => Number(e.valor), lancamento: (e) => e.lancamento, pagador: (e) => e.pagadorNome, anotacao: (e) => e.anotacao };

export default function EncaminhamentoEntradasPage() {
  const { user } = useAuth() as any;
  const master = user?.profile?.permissions?.all === true;
  const [dados, setDados] = useState<{ destinos: Destino[]; entradas: Entrada[] } | null>(null);
  const [rotulos, setRotulos] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [ano, setAno] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [soConhecidos, setSoConhecidos] = useState(false);
  const [encaminhando, setEncaminhando] = useState<Entrada | null>(null);
  const [decidindo, setDecidindo] = useState<Entrada | null>(null);

  const carregar = useCallback(() => {
    setErro('');
    api.get('/projects-financeiro/entradas').then((r) => setDados(r.data)).catch((e) => setErro(erroApi(e, 'Falha ao carregar as entradas.')));
    if (master) api.get('/projects-financeiro/circuitos').then((r) => setRotulos((r.data || []).map((c: any) => c.circuito))).catch(() => {});
  }, [master]);
  useEffect(() => { carregar(); }, [carregar]);

  const anos = useMemo(() => [...new Set((dados?.entradas || []).map((e) => e.data.slice(0, 4)))].sort(), [dados]);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (dados?.entradas || []).filter((e) => (ano === 'TODOS' || e.data.startsWith(ano)) && (!soConhecidos || e.remetenteConhecido) &&
      (!t || [e.lancamento, e.pagadorNome, e.anotacao].some((x) => (x || '').toLowerCase().includes(t))));
  }, [dados, ano, soConhecidos, busca]);
  const { ordenada, ord, alternar } = useOrdenacao(lista, COLS_ENTRADA, { col: 'data', dir: 'asc' });
  const total = lista.reduce((s, e) => s + Number(e.valor), 0);
  const semDestino = !!dados && dados.destinos.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Encaminhar entradas aos projetos</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 }}>Empresa ativa · o extrato completo fica no LEDGR; o projeto recebe só o que for encaminhado aqui</div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>⚠ {erro}</div>}
      {semDestino && <div style={{ background: '#F3F4F6', color: '#374151', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>A empresa ativa não é recebedora de nenhuma operação de projeto.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={ano} onChange={(e) => setAno(e.target.value)} style={filtroSt}>
          <option value="TODOS">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no lançamento, pagador ou anotação" style={{ ...filtroSt, width: 300 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={soConhecidos} onChange={(e) => setSoConhecidos(e.target.checked)} /> Só remetentes já conhecidos em projetos
        </label>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#374151' }}>{lista.length} entrada(s) · <b>{fmtBRL(total)}</b></div>
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><ThOrdenavel col="data" rotulo="Data" ord={ord} alternar={alternar} style={thSt} /><ThOrdenavel col="valor" rotulo="Valor" ord={ord} alternar={alternar} style={{ ...thSt, textAlign: 'right' }} /><ThOrdenavel col="lancamento" rotulo="Lançamento" ord={ord} alternar={alternar} style={thSt} /><ThOrdenavel col="pagador" rotulo="Pagador (extrato)" ord={ord} alternar={alternar} style={thSt} /><ThOrdenavel col="anotacao" rotulo="Anotação da planilha (apoio)" ord={ord} alternar={alternar} style={thSt} />{master && !semDestino && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma entrada para triagem.</td></tr>}
            {ordenada.map((e) => (
              <tr key={e.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(e.data)}</td>
                <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(e.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{e.lancamento}</td>
                <td style={tdSt}>
                  {e.pagadorNome ? <div>{e.pagadorNome}</div> : <i style={{ color: '#9CA3AF' }}>extrato sem pagador</i>}
                  {e.pagadorDocumento && <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{e.pagadorDocumento}</div>}
                  {e.remetenteConhecido && <span style={{ fontSize: 11, fontWeight: 600, color: '#134E4A', background: '#F0FDFA', border: '0.5px solid #99F6E4', borderRadius: 999, padding: '1px 7px' }}>Remetente conhecido</span>}
                </td>
                <td style={{ ...tdSt, fontSize: 12, color: '#6B7280', fontStyle: 'italic', maxWidth: 300 }}>{e.anotacao || ''}</td>
                {master && !semDestino && (
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEncaminhando(e)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#1A4A3A', color: '#fff', cursor: 'pointer', marginRight: 6 }}>Encaminhar</button>
                    <button onClick={() => setDecidindo(e)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer' }}>Outra decisão</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {encaminhando && dados && <EncaminharModal entrada={encaminhando} destinos={dados.destinos} onClose={() => setEncaminhando(null)} onFeito={() => { setEncaminhando(null); carregar(); }} />}
      {decidindo && (
        <DecisaoMovimentoModal rota={`/projects-financeiro/entradas/${decidindo.id}/decidir`} mov={decidindo} rotulos={rotulos}
          onClose={() => setDecidindo(null)} onFeito={() => { setDecidindo(null); carregar(); }} />
      )}
    </div>
  );
}

function EncaminharModal({ entrada, destinos, onClose, onFeito }: { entrada: Entrada; destinos: Destino[]; onClose: () => void; onFeito: () => void }) {
  const [operacaoId, setOperacaoId] = useState(destinos[0]?.operacaoId || '');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = !!operacaoId && motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-financeiro/entradas/${entrada.id}/encaminhar`, { operacaoId, motivo: motivo.trim() });
      toast.success('Entrada encaminhada ao projeto.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao encaminhar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Encaminhar ao projeto" subtitulo={`${fmtData(entrada.data)} · ${fmtBRL(entrada.valor)} · ${entrada.pagadorNome || 'pagador não identificado no extrato'}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Encaminhar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      {entrada.anotacao && <Secao titulo="ANOTAÇÃO DA PLANILHA (SÓ APOIO)"><div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>{entrada.anotacao}</div></Secao>}
      <Secao><div style={{ fontSize: 12, color: '#374151' }}>O projeto recebe esta entrada como crédito, já comprovado por ela. A decisão sobre a Conta Individual do Adquirente fica com o projeto.</div></Secao>
      <Secao titulo="OPERAÇÃO DE DESTINO *">
        <Campo rotulo="Operação"><select style={inputModal} value={operacaoId} onChange={(e) => setOperacaoId(e.target.value)}>{destinos.map((d) => <option key={d.operacaoId} value={d.operacaoId}>{d.nome}</option>)}</select></Campo>
      </Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." /></Secao>
    </ModalProjeto>
  );
}
