// frontend/src/pages/projects/workspace/CreditosProjeto.tsx
// D8 (03/10/2026): creditos da operacao - busca, filtro de pendentes, CPF mascarado (vem mascarado da API).
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { Operacao, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, inputSt, tituloSt, subtituloSt } from './projetoTema';

export default function CreditosProjeto({ operacao }: { operacao: Operacao | null }) {
  const [lista, setLista] = useState<Credito[]>([]);
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!operacao) return;
    setCarregando(true); setErro('');
    api.get(`/projects/operacoes/${operacao.id}/creditos`)
      .then((r) => setLista(r.data || []))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os créditos.'))
      .finally(() => setCarregando(false));
  }, [operacao]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((c) => (!soPendentes || c.identificacaoPendente) &&
      (!t || [c.remetente?.nome, c.remetenteNomeExtrato, c.referenciaBancaria, String(c.numeroOrdem ?? '')].some((x) => (x || '').toLowerCase().includes(t))));
  }, [lista, busca, soPendentes]);
  const total = filtrados.reduce((s, c) => s + Number(c.valor), 0);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Créditos</div>
        <div style={subtituloSt}>{operacao.nome} · dados bancários de origem, sem alteração</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input style={{ ...inputSt, width: 320 }} placeholder="Buscar por remetente, referência ou nº" value={busca} onChange={(e) => setBusca(e.target.value)} />
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
              <th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={thSt}>Remetente</th><th style={thSt}>Documento</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Referência bancária</th><th style={thSt}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {!carregando && filtrados.length === 0 && (
              <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum crédito para exibir.</td></tr>
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
                <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{c.referenciaBancaria || '-'}</td>
                <td style={tdSt}>
                  {c.identificacaoPendente
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Identificar remetente</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '2px 8px' }}>Identificado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
