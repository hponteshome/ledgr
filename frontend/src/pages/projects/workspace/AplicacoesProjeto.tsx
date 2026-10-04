// frontend/src/pages/projects/workspace/AplicacoesProjeto.tsx
// Fase 1.11 parte A (04/10/2026): aplicacoes de recursos da operacao - so o que o Financeiro classificou no LEDGR,
// cada uma com a saida do extrato como prova. Totais por natureza; devolucoes destacadas (afetam a Conta Individual).
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';

interface Aplicacao {
  id: string; dataAplicacao: string; valor: string; descricao: string | null; motivo: string; lancamento: string | null;
  beneficiario: string | null; creditoNumero: number | null; natureza: { codigo: string; nome: string; tipo: string };
}

export default function AplicacoesProjeto({ operacao }: { operacao: Operacao | null }) {
  const [lista, setLista] = useState<Aplicacao[]>([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!operacao) return;
    api.get(`/projects/operacoes/${operacao.id}/aplicacoes`).then((r) => setLista(r.data || [])).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as aplicações.'));
  }, [operacao]);
  const porNatureza = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: string; total: number; n: number }>();
    lista.forEach((a) => { const e = m.get(a.natureza.codigo) || { nome: a.natureza.nome, tipo: a.natureza.tipo, total: 0, n: 0 }; e.total += Number(a.valor); e.n += 1; m.set(a.natureza.codigo, e); });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [lista]);
  const total = lista.reduce((s, a) => s + Number(a.valor), 0);
  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Aplicações de recursos</div>
        <div style={subtituloSt}>{operacao.nome} · saídas classificadas pelo Financeiro no LEDGR, comprovadas no extrato · total {fmtBRL(total)}</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {porNatureza.length > 0 && (
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={secTitle}>Por natureza</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {porNatureza.map((n) => (
                <tr key={n.nome}>
                  <td style={tdSt}>{n.nome}{n.tipo === 'DEVOLUCAO' && <span style={{ marginLeft: 8, fontSize: 11, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '1px 7px' }}>reduz a Conta Individual</span>}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{n.n}</td>
                  <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(n.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Descrição e motivo</th><th style={thSt}>Devolvido a / crédito</th><th style={thSt}>Lançamento do extrato</th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma aplicação classificada ainda. A classificação é feita no LEDGR, em Projetos → Classificar saídas.</td></tr>}
            {lista.map((a) => (
              <tr key={a.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(a.dataAplicacao)}</td>
                <td style={tdSt}>{a.natureza.nome}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(a.valor)}</td>
                <td style={tdSt}>{a.descricao && <div>{a.descricao}</div>}<div style={{ fontSize: 11, color: '#6B7280' }}>{a.motivo}</div></td>
                <td style={tdSt}>{a.beneficiario || '-'}{a.creditoNumero ? ` · crédito nº ${a.creditoNumero}` : ''}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{a.lancamento || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
