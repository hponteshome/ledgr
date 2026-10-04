// frontend/src/pages/projects/workspace/PendenciasProjeto.tsx
// Fase 1.8 revista (03/10/2026): pendencias SO do projeto - creditos aguardando decisao de vinculo (encaminhados pelo
// Financeiro) e remetentes nao identificados. O extrato completo nunca aparece aqui: a triagem e feita no LEDGR.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { Operacao, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import VinculoModal from './VinculoModal';

interface CreditoPend {
  id: string; numeroOrdem: number | null; dataCredito: string; valor: string; origem: string; remetenteNomeExtrato: string | null;
  referenciaBancaria: string | null; identificacaoPendente: boolean; remetente: { id: string; nome: string; tipoPessoa: string | null } | null;
}

export default function PendenciasProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [dados, setDados] = useState<{ aguardandoVinculo: CreditoPend[]; remetentesNaoIdentificados: CreditoPend[] } | null>(null);
  const [erro, setErro] = useState('');
  const [decidindo, setDecidindo] = useState<CreditoPend | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/pendencias`)
      .then((r) => setDados(r.data))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as pendências.'));
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  const comoCredito = (c: CreditoPend): Credito => ({
    id: c.id, numeroOrdem: c.numeroOrdem, dataCredito: c.dataCredito, valor: c.valor, remetenteNomeExtrato: c.remetenteNomeExtrato,
    referenciaBancaria: c.referenciaBancaria, origem: c.origem, identificacaoPendente: c.identificacaoPendente, observacao: null,
    remetente: c.remetente ? { ...c.remetente, documentoMascarado: null } : null, vinculoAtual: null,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Pendências</div>
        <div style={subtituloSt}>{operacao.nome} · o que ainda exige decisão do projeto</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos aguardando decisão de vínculo</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          Entradas encaminhadas pelo Financeiro, no LEDGR, já comprovadas no extrato. Falta decidir se pertencem à Conta Individual do Adquirente.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Remetente</th><th style={thSt}>Referência bancária</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {(dados?.aguardandoVinculo || []).length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhum crédito aguardando decisão.</td></tr>}
            {(dados?.aguardandoVinculo || []).map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={tdSt}>{fmtData(c.dataCredito)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={tdSt}>{c.remetente?.nome || <i style={{ color: '#9CA3AF' }}>Não identificado</i>}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{c.referenciaBancaria || '-'}</td>
                {master && (
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <button onClick={() => setDecidindo(c)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#134E4A', color: '#fff', cursor: 'pointer' }}>Decidir vínculo</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos com remetente não identificado</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          O extrato não informa o pagador nestes lançamentos. A identificação depende de comprovante ou de outra fonte.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Referência bancária</th></tr></thead>
          <tbody>
            {(dados?.remetentesNaoIdentificados || []).map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={tdSt}>{fmtData(c.dataCredito)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{c.referenciaBancaria || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {decidindo && (
        <VinculoModal credito={comoCredito(decidindo)} operacaoId={operacao.id} onClose={() => setDecidindo(null)} onSuccess={() => { setDecidindo(null); carregar(); }} />
      )}
    </div>
  );
}
