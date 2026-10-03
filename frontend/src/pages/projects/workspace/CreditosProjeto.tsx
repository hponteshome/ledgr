// frontend/src/pages/projects/workspace/CreditosProjeto.tsx
// D8 / 1.6b (03/10/2026): creditos da operacao - busca, filtro de pendentes, CPF mascarado (vem mascarado da API),
// titular da Conta Individual e, para o Master, revisao do vinculo (vincular, alterar, desvincular) com historico.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiLink } from 'react-icons/fi';
import api from '../../../services/api';
import { Operacao, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, inputSt, tituloSt, subtituloSt } from './projetoTema';
import VinculoModal from './VinculoModal';

export default function CreditosProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [lista, setLista] = useState<Credito[]>([]);
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<Credito | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setCarregando(true); setErro('');
    api.get(`/projects/operacoes/${operacao.id}/creditos`)
      .then((r) => setLista(r.data || []))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os créditos.'))
      .finally(() => setCarregando(false));
  }, [operacao]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((c) => (!soPendentes || c.identificacaoPendente) &&
      (!t || [c.remetente?.nome, c.remetenteNomeExtrato, c.referenciaBancaria, c.vinculoAtual?.adquirente?.nome, String(c.numeroOrdem ?? '')]
        .some((x) => (x || '').toLowerCase().includes(t))));
  }, [lista, busca, soPendentes]);
  const total = filtrados.reduce((s, c) => s + Number(c.valor), 0);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Créditos</div>
        <div style={subtituloSt}>{operacao.nome} · dado bancário de origem (intocado) e titular da Conta Individual</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input style={{ ...inputSt, width: 320 }} placeholder="Buscar por remetente, titular, referência ou nº" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> Só pendentes de identificação
        </label>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#374151' }}>{filtrados.length} crédito(s) · <b>{fmtBRL(total)}</b></div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={thSt}>Remetente (pago por)</th><th style={thSt}>Documento</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Titular (Conta Individual)</th><th style={thSt}>Referência bancária</th>
              <th style={thSt}>Situação</th>{master && <th style={thSt}></th>}
            </tr>
          </thead>
          <tbody>
            {!carregando && filtrados.length === 0 && (
              <tr><td colSpan={master ? 9 : 8} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum crédito para exibir.</td></tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(c.dataCredito)}</td>
                <td style={tdSt}>
                  {c.remetente ? <div style={{ fontWeight: 600, color: '#111827' }}>{c.remetente.nome}</div> : <i style={{ color: '#9CA3AF' }}>Não identificado</i>}
                  {c.remetente && c.remetenteNomeExtrato && c.remetenteNomeExtrato !== c.remetente.nome && (
                    <div style={{ fontSize: 11, color: '#6B7280' }}>no extrato: {c.remetenteNomeExtrato}</div>
                  )}
                </td>
                <td style={{ ...tdSt, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>{c.remetente?.documentoMascarado || '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={tdSt}>
                  {c.vinculoAtual?.situacao === 'VINCULADO'
                    ? <span style={{ fontWeight: 600, color: '#134E4A' }}>{c.vinculoAtual.adquirente?.nome}</span>
                    : c.vinculoAtual?.situacao === 'DESVINCULADO'
                      ? <span title={c.vinculoAtual.motivo} style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Desvinculado</span>
                      : <span style={{ fontSize: 11, color: '#B45309' }}>Sem vínculo</span>}
                </td>
                <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{c.referenciaBancaria || '-'}</td>
                <td style={tdSt}>
                  {c.identificacaoPendente
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Identificar remetente</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '2px 8px' }}>Identificado</span>}
                </td>
                {master && (
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <button onClick={() => setEditando(c)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <FiLink size={12} /> Vínculo
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <VinculoModal credito={editando} operacaoId={operacao.id} onClose={() => setEditando(null)} onSuccess={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}
