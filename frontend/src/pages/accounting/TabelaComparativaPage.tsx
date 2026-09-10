// frontend/src/pages/accounting/TabelaComparativaPage.tsx
// Tabela Comparativa ECD x Matriz (conceito 22/08/2026, LEDGR-contexto.md).
// Mostra, para cada conta da matriz, todas as contas ECD de origem (qualquer
// ano) lado a lado por ano - visualiza renumeracao de conta entre anos vs
// movimento real. Linha matriz = soma das origens daquele ano.
import React, { useState, useCallback } from 'react';
import api from '../../services/api';

interface ComparativoOrigem {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  matchType: string;
  valoresPorAno: Record<string, number | null>;
}

interface ComparativoLinha {
  targetCode: string;
  targetName: string;
  targetType: string;
  valoresPorAno: Record<string, number>;
  origens: ComparativoOrigem[];
}

interface ComparativoResponse {
  anos: number[];
  linhas: ComparativoLinha[];
}

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '–';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  textAlign: 'right',
  borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap',
};

const tdNumStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'monospace',
  textAlign: 'right',
  borderBottom: '0.5px solid #F3F4F6',
  whiteSpace: 'nowrap',
};

export const TabelaComparativaPage: React.FC = () => {
  const [anoInicio, setAnoInicio] = useState(2017);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());
  const [data, setData] = useState<ComparativoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [apenasMovimentacao, setApenasMovimentacao] = useState(false);

  const gerar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ComparativoResponse>('/accounting/tabela-comparativa', {
        params: { anoInicio, anoFim },
      });
      setData(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao gerar a tabela comparativa.');
    } finally {
      setLoading(false);
    }
  }, [anoInicio, anoFim]);

  // NOVO (09/09/2026): "exibir apenas movimentacoes" esconde contas/origens
  // que nunca tiveram valor != 0 em nenhum ano do periodo - reduz o ruido de
  // contas cadastradas mas sem uso real. Filtro 100% client-side, o dado ja
  // vem todo carregado numa unica chamada.
  // CORRIGIDO (09/09/2026): "movimentacao" nao e "valor != 0" - Ativo/
  // Passivo/PL guardam SALDO FINAL do ano (precisa comparar com o ano
  // anterior pra saber se algo mudou); Receita/Despesa ja guardam o
  // MOVIMENTO LIQUIDO do proprio ano (valor != 0 ja e a resposta certa,
  // comparar com o ano anterior geraria falso negativo).
  const ehTipoSaldo = (tipo: string) => tipo === 'ASSET' || tipo === 'LIABILITY' || tipo === 'EQUITY';

  const temMovimento = (tipo: string, valores: Record<string, number | null | undefined>, anos: number[]) => {
    if (ehTipoSaldo(tipo)) {
      for (let i = 1; i < anos.length; i++) {
        const atual = valores[anos[i]] ?? 0;
        const anterior = valores[anos[i - 1]] ?? 0;
        if (atual !== anterior) return true;
      }
      return false;
    }
    return Object.values(valores).some((v) => v !== null && v !== undefined && v !== 0);
  };

  const linhasFiltradas = data?.linhas
    .filter((l) => {
      if (!busca) return true;
      const q = busca.toUpperCase();
      return (
        l.targetCode.includes(q) ||
        l.targetName.toUpperCase().includes(q) ||
        l.origens.some((o) => o.sourceCode.includes(q) || o.sourceName.toUpperCase().includes(q))
      );
    })
    .map((l) => {
      if (!apenasMovimentacao) return l;
      return {
        ...l,
        origens: l.origens.filter((o) => temMovimento(l.targetType, o.valoresPorAno, data?.anos ?? [])),
      };
    })
    .filter((l) => !apenasMovimentacao || temMovimento(l.targetType, l.valoresPorAno, data?.anos ?? []));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>
        Contabilidade / Relatórios
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Tabela Comparativa ECD x Matriz</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Para cada conta da matriz, mostra as contas ECD de origem de cada ano lado a lado -
        identifica renumeração de conta entre anos.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO INICIAL</div>
          <input
            type="number"
            value={anoInicio}
            onChange={(e) => setAnoInicio(parseInt(e.target.value, 10))}
            style={{ width: 100, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO FINAL</div>
          <input
            type="number"
            value={anoFim}
            onChange={(e) => setAnoFim(parseInt(e.target.value, 10))}
            style={{ width: 100, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>BUSCAR CONTA</div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código ou nome..."
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', cursor: 'pointer', paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={apenasMovimentacao}
            onChange={(e) => setApenasMovimentacao(e.target.checked)}
          />
          Exibir apenas movimentações
        </label>
        <button
          onClick={gerar}
          disabled={loading}
          style={{
            padding: '8px 18px',
            background: '#111827',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Gerando...' : 'Gerar Comparativo'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
            {linhasFiltradas?.length ?? 0} conta(s) matriz · {data.anos.length} ano(s)
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', minWidth: 320, position: 'sticky', left: 0, background: '#fff' }}>
                    Conta
                  </th>
                  {data.anos.map((ano) => (
                    <th key={ano} style={thStyle}>{ano}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas?.map((linha) => (
                  <React.Fragment key={linha.targetCode}>
                    <tr style={{ background: '#F9FAFB' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, borderBottom: '0.5px solid #F3F4F6', position: 'sticky', left: 0, background: '#F9FAFB' }}>
                        {linha.targetCode} · {linha.targetName}
                      </td>
                      {data.anos.map((ano) => (
                        <td key={ano} style={{ ...tdNumStyle, fontWeight: 600, background: '#F9FAFB' }}>
                          {fmt(linha.valoresPorAno[ano])}
                        </td>
                      ))}
                    </tr>
                    {linha.origens.map((origem) => (
                      <tr key={origem.sourceId}>
                        <td style={{ padding: '5px 10px 5px 28px', fontSize: 12, color: '#6B7280', borderBottom: '0.5px solid #F3F4F6', position: 'sticky', left: 0, background: '#fff' }}>
                          {origem.sourceCode} · {origem.sourceName}
                          {origem.matchType === 'MANUAL' && (
                            <span style={{ marginLeft: 6, fontSize: 9, color: '#B45309', background: '#FEF3C7', padding: '1px 5px', borderRadius: 3 }}>
                              manual
                            </span>
                          )}
                        </td>
                        {data.anos.map((ano) => {
                          const v = origem.valoresPorAno[ano];
                          const foraVigencia = v === null || v === undefined;
                          return (
                            <td
                              key={ano}
                              style={{
                                ...tdNumStyle,
                                color: foraVigencia ? '#D1D5DB' : '#374151',
                              }}
                            >
                              {fmt(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          Escolha o período e clique em "Gerar Comparativo".
        </div>
      )}
    </div>
  );
};

export default TabelaComparativaPage;
