// frontend/src/pages/projects/lote.tsx
// Decisao em lote nas telas de triagem (06/10/2026). Cada linha selecionada segue pela MESMA rota da decisao individual
// (mesmas validacoes, motivo na trilha e registro no historico); as recusadas sao listadas ao final, as demais seguem.
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './workspace/ModalProjeto';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
interface Item { id: string; data: string; valor: string | number; lancamento?: string }

export function useSelecao() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const tem = useCallback((id: string) => ids.has(id), [ids]);
  const alternar = (id: string) => setIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todos = (lista: { id: string }[]) => lista.length > 0 && lista.every((x) => ids.has(x.id));
  const alternarTodos = (lista: { id: string }[]) => setIds((p) => {
    const marcar = !(lista.length > 0 && lista.every((x) => p.has(x.id)));
    const n = new Set(p); lista.forEach((x) => (marcar ? n.add(x.id) : n.delete(x.id))); return n;
  });
  const limpar = () => setIds(new Set());
  return { tem, alternar, todos, alternarTodos, limpar, quantidade: ids.size };
}

export async function executarEmLote<T>(itens: T[], fn: (x: T) => Promise<any>, progresso?: (n: number) => void) {
  let ok = 0; const falhas: { item: T; msg: string }[] = [];
  for (let i = 0; i < itens.length; i++) {
    progresso?.(i + 1);
    try { await fn(itens[i]); ok++; } catch (e: any) { falhas.push({ item: itens[i], msg: erroApi(e, 'falha') }); }
  }
  return { ok, falhas };
}

export function BarraSelecao({ quantidade, total, onLimpar, children }: { quantidade: number; total: number; onLimpar: () => void; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#F0FDFA', border: '0.5px solid #99F6E4', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: '#134E4A' }}><b>{quantidade}</b> selecionada(s) · <b>{fmtBRL(total)}</b></div>
      <div style={{ flex: 1 }} />
      {children}
      <button onClick={onLimpar} style={{ padding: '6px 10px', fontSize: 12, border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', textDecoration: 'underline' }}>Limpar seleção</button>
    </div>
  );
}

export function LoteDecisaoModal({ rotaBase, itens, rotulos, onClose, onFeito }: { rotaBase: string; itens: Item[]; rotulos: string[]; onClose: () => void; onFeito: () => void }) {
  const [decisao, setDecisao] = useState('');
  const [circuito, setCircuito] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const total = itens.reduce((s, x) => s + Number(x.valor), 0);
  const valido = !!decisao && motivo.trim().length >= 10 && (decisao !== 'TRANSFERENCIA_INTERNA' || circuito.trim().length >= 3);
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      const r = await executarEmLote(itens, (x) => api.post(`${rotaBase}/${x.id}/decidir`, { decisao, circuito: decisao === 'TRANSFERENCIA_INTERNA' ? circuito.trim() : undefined, motivo: motivo.trim() }), setProgresso);
      if (r.falhas.length) {
        if (r.ok) toast.success(`${r.ok} movimento(s) decidido(s).`);
        setErro(`${r.falhas.length} não decidido(s): ` + r.falhas.map((f) => `${fmtData(f.item.data)} ${fmtBRL(f.item.valor)} (${f.msg})`).join(' | '));
        return;
      }
      toast.success(`${r.ok} movimento(s) decidido(s).`);
      onFeito();
    } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Outra decisão em lote" subtitulo={`${itens.length} movimento(s) · ${fmtBRL(total)}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Fechar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? `${progresso} de ${itens.length}...` : `Decidir ${itens.length}`}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="SELECIONADOS">
        <div style={{ fontSize: 12, color: '#374151', maxHeight: 140, overflowY: 'auto' }}>
          {itens.slice(0, 50).map((x) => <div key={x.id}>{fmtData(x.data)} · {fmtBRL(x.valor)}{x.lancamento ? ` · ${x.lancamento}` : ''}</div>)}
          {itens.length > 50 && <div style={{ color: '#6B7280' }}>e mais {itens.length - 50}</div>}
        </div>
      </Secao>
      <Secao titulo="DECISÃO *">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo rotulo="Decisão">
            <select style={inputModal} value={decisao} onChange={(e) => setDecisao(e.target.value)}>
              <option value="">Selecione...</option>
              <option value="TRANSFERENCIA_INTERNA">Transferência interna (neutra)</option>
              <option value="NAO_PERTENCE">Não pertence à operação</option>
            </select>
          </Campo>
          {decisao === 'TRANSFERENCIA_INTERNA' && (
            <Campo rotulo="Circuito *">
              <input style={inputModal} list="lote-circuitos" value={circuito} onChange={(e) => setCircuito(e.target.value)} placeholder="Ex.: Josi - proteção de bloqueios" />
              <datalist id="lote-circuitos">{rotulos.map((r) => <option key={r} value={r} />)}</datalist>
            </Campo>
          )}
        </div>
      </Secao>
      <Secao titulo="MOTIVO *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria de cada movimento." />
      </Secao>
    </ModalProjeto>
  );
}
