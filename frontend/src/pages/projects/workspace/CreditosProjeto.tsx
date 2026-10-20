// frontend/src/pages/projects/workspace/CreditosProjeto.tsx
// D8 / 1.6b (03/10/2026): creditos da operacao - busca, filtro de pendentes, CPF mascarado (vem mascarado da API),
// titular da Conta Individual e, para o Master, revisao do vinculo (vincular, alterar, desvincular) com historico.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiLink } from 'react-icons/fi';
import api from '../../../services/api';
import { Operacao, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, inputSt, tituloSt, subtituloSt } from './projetoTema';
import VinculoModal from './VinculoModal';
import { SmartDateInput } from '../../../components/SmartDateInput';

// Totalizadores dos aportes (20/10/2026): so creditos vinculados ao Adquirente, por periodo; o ultimo periodo vai ate a data escolhida.
const hojeIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDia = (iso: string) => iso.split('-').reverse().join('/');

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
  const [ate, setAte] = useState<string>(hojeIso());
  const aportes = useMemo(() => {
    const lim = /^\d{4}-\d{2}-\d{2}$/.test(ate) ? ate : hojeIso();
    const faixas = [
      { rotulo: 'Até 31/10/2025', de: '0000-01-01', a: '2025-10-31' },
      { rotulo: 'De 01/11/2025 a 20/07/2026', de: '2025-11-01', a: '2026-07-20' },
      { rotulo: 'De 21/07/2026 até ' + fmtDia(lim), de: '2026-07-21', a: '9999-12-31' },
    ];
    const vinc = lista.filter((c) => c.vinculoAtual?.situacao === 'VINCULADO');
    const soma = (de: string, a: string) => {
      const sel = vinc.filter((c) => { const d = String(c.dataCredito).slice(0, 10); return d >= de && d <= a && d <= lim; });
      return { qtd: sel.length, valor: sel.reduce((s, c) => s + Math.round(Number(c.valor) * 100), 0) / 100 };
    };
    return { lim, faixas: faixas.map((f) => ({ ...f, ...soma(f.de, f.a) })), total: soma('0000-01-01', '9999-12-31') };
  }, [lista, ate]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Créditos</div>
        <div style={subtituloSt}>{operacao.nome} · dado bancário de origem (intocado) e titular da Conta Individual</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        {aportes.faixas.map((f, i) => (
          <div key={i} style={{ ...cardSt, padding: '12px 14px', borderTop: '3px solid #0F766E' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Aportes · {f.rotulo}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4 }}>{fmtBRL(f.valor)}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{f.qtd} crédito(s) vinculado(s)</div>
          </div>
        ))}
        <div style={{ ...cardSt, padding: '12px 14px', borderTop: '3px solid #134E4A', background: '#F0FDFA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#134E4A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Total de aportes até</div>
            <SmartDateInput style={{ ...inputSt, width: 120, padding: '3px 8px', fontSize: 12 }} value={ate} onChange={(v: string) => setAte(v)} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#134E4A', marginTop: 4 }}>{fmtBRL(aportes.total.valor)}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{aportes.total.qtd} crédito(s) vinculado(s) à Conta Individual · desvinculados fora</div>
        </div>
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
              <th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Titular (Conta Individual)</th><th style={thSt}>Prova bancária</th><th style={thSt}>Referência bancária</th>
              <th style={thSt}>Situação</th>{master && <th style={thSt}></th>}
            </tr>
          </thead>
          <tbody>
            {!carregando && filtrados.length === 0 && (
              <tr><td colSpan={master ? 10 : 9} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum crédito para exibir.</td></tr>
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
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                  {c.provaAtual?.transacao
                    ? <span title={`${c.provaAtual.transacao.descricao} · ${c.provaAtual.criterio === 'AUTO_DOC_DATA_VALOR' ? 'data, valor e CPF/CNPJ conferidos' : c.provaAtual.criterio === 'AUTO_DATA_VALOR' ? 'data e valor conferidos' : 'ligação manual'}`} style={{ fontSize: 11, fontWeight: 600, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '2px 8px', cursor: 'help' }}>Extrato {fmtData(c.provaAtual.transacao.data)}</span>
                    : <span style={{ fontSize: 11, color: '#B45309' }}>Sem prova</span>}
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
