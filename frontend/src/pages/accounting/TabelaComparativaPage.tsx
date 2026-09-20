// frontend/src/pages/accounting/TabelaComparativaPage.tsx
// Tabela Comparativa ECD x Matriz (conceito 22/08/2026, LEDGR-contexto.md).
// Mostra, para cada conta da matriz, todas as contas ECD de origem (qualquer
// ano) lado a lado por ano - visualiza renumeracao de conta entre anos vs
// movimento real. Linha matriz = soma das origens daquele ano.
import React, { useState, useCallback } from 'react';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';
import { imprimirRelatorio } from '../../utils/imprimirRelatorio';
import { usePrintHandler } from '../../contexts/PrintContext';

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
  const { activeCompany } = useCompany();
  const [anoInicio, setAnoInicio] = useState(2017);
  const [anoFim, setAnoFim] = useState(new Date().getFullYear());
  const [data, setData] = useState<ComparativoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [apenasMovimentacao, setApenasMovimentacao] = useState(false);

  // NOVO (16/09/2026): saldo real da conta "1 - Ativo" no Balanco Contabil
  // (Matriz) por ano - reaproveita o Comparativo de Saldos
  // (BalanceComparisonService), sem precisar de endpoint novo. Usado pra
  // conferir contra a soma das origens ECD e mostrar a diferenca.
  const [totalAtivoMatrizPorAno, setTotalAtivoMatrizPorAno] = useState<Record<number, number> | null>(null);

  const gerar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resp, respMatriz] = await Promise.all([
        api.get<ComparativoResponse>('/accounting/tabela-comparativa', {
          params: { anoInicio, anoFim },
        }),
        // NOVO (16/09/2026): saldo real da conta "1 - Ativo" na Matriz, por
        // ano - reaproveita o Comparativo de Saldos, que ja calcula isso.
        activeCompany?.id
          ? api.get(`/reports/balance-comparison/${activeCompany.id}/anual`, { params: { anoInicio, anoFim } })
          : Promise.resolve({ data: { contas: [] } }),
      ]);
      setData(resp.data);
      const linhaAtivo = (respMatriz.data?.contas || []).find((c: any) => c.conta === '1');
      setTotalAtivoMatrizPorAno(linhaAtivo?.saldos ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao gerar a tabela comparativa.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, anoInicio, anoFim]);

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

  // NOVO (16/09/2026): total ECD do Ativo = soma das linhas cujo destino e
  // tipo ASSET, usando data.linhas (nao filtrado por busca/movimentacao -
  // e um total de conferencia, sempre reflete o universo completo).
  const totalAtivoEcdPorAno: Record<number, number> = {};
  (data?.anos ?? []).forEach((ano) => {
    totalAtivoEcdPorAno[ano] = (data?.linhas ?? [])
      .filter((l) => l.targetType === 'ASSET')
      .reduce((soma, l) => soma + (l.valoresPorAno[ano] ?? 0), 0);
  });

  // NOVO (16/09/2026): barra de impressao/exportacao compartilhada
  // (ReportToolbar) - periodo do relatorio e por ANO (nao data), entao
  // dateFrom/dateTo sao derivados de anoInicio/anoFim (1o de janeiro /
  // 31 de dezembro) so pra satisfazer a API do componente compartilhado;
  // onPeriodChange faz o caminho inverso (extrai o ano da data escolhida).
  const handlePeriodChange = (from: string, to: string) => {
    const novoInicio = parseInt(from.slice(0, 4), 10);
    const novoFim = parseInt(to.slice(0, 4), 10);
    if (!isNaN(novoInicio)) setAnoInicio(novoInicio);
    if (!isNaN(novoFim)) setAnoFim(novoFim);
  };

  // Exporta CSV - separador "|" (Regra 12), uma linha por conta matriz +
  // uma linha por origem ECD, com os mesmos anos-coluna da tela.
  const exportCSV = () => {
    if (!data) return;
    const header = ['Conta', 'Origem', ...data.anos.map(String)].join('|');
    const linhas: string[] = [header];
    (linhasFiltradas || []).forEach((l) => {
      linhas.push([
        `${l.targetCode} - ${l.targetName}`, '',
        ...data.anos.map((ano) => fmt(l.valoresPorAno[ano])),
      ].join('|'));
      l.origens.forEach((o) => {
        linhas.push([
          '', `${o.sourceCode} - ${o.sourceName}${o.matchType === 'MANUAL' ? ' (manual)' : ''}`,
          ...data.anos.map((ano) => fmt(o.valoresPorAno[ano])),
        ].join('|'));
      });
    });
    const csvContent = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Tabela_Comparativa_${activeCompany?.tradeName || 'Relatorio'}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // Impressao formal via helper compartilhado (imprimirRelatorio).
  const montarLinhasImpressao = (): string => {
    if (!data) return '';
    let html = '';
    (linhasFiltradas || []).forEach((l) => {
      html += `<tr class="total"><td>${l.targetCode} · ${l.targetName}</td>${data.anos
        .map((ano) => `<td class="num">${fmt(l.valoresPorAno[ano])}</td>`)
        .join('')}</tr>`;
      l.origens.forEach((o) => {
        html += `<tr><td>&nbsp;&nbsp;${o.sourceCode} · ${o.sourceName}${o.matchType === 'MANUAL' ? ' (manual)' : ''}</td>${data.anos
          .map((ano) => `<td class="num">${fmt(o.valoresPorAno[ano])}</td>`)
          .join('')}</tr>`;
      });
    });
    return html;
  };

  const handleImprimir = () => {
    if (!data) return;
    const corpoHtml = `<table>
      <thead><tr><th>Conta</th>${data.anos.map((a) => `<th class="num">${a}</th>`).join('')}</tr></thead>
      <tbody>${montarLinhasImpressao()}</tbody>
    </table>
    <style>
      table td, table th { padding: 3px 6px !important; }
    </style>`;
    imprimirRelatorio({
      titulo: 'Tabela Comparativa ECD x Matriz',
      empresaNome: activeCompany?.legalName || activeCompany?.tradeName || '',
      empresaCnpj: activeCompany?.taxId || '',
      periodo: `${anoInicio} a ${anoFim}`,
      corpoHtml,
      larguraTotal: true,
    });
  };

  usePrintHandler(!!data ? handleImprimir : null, 'Imprimir Tabela Comparativa', [data, linhasFiltradas, anoInicio, anoFim]);

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

      <ReportToolbar
        title="Tabela Comparativa"
        dateFrom={`${anoInicio}-01-01`}
        dateTo={`${anoFim}-12-31`}
        onPeriodChange={handlePeriodChange}
        count={linhasFiltradas?.length}
        countLabel="conta(s) matriz"
        onFilter={gerar}
        filterLabel={loading ? 'Gerando...' : 'Gerar Comparativo'}
        onPrint={handleImprimir}
        onExportCSV={exportCSV}
        hasData={!!data}
        extraContent={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código ou nome..."
              style={{ width: 180, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={apenasMovimentacao}
                onChange={(e) => setApenasMovimentacao(e.target.checked)}
              />
              Só com movimentação
            </label>
          </div>
        }
      />

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

          {totalAtivoMatrizPorAno && (
            <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <tr style={{ background: '#F0F9FF' }}>
                    <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#1D4ED8', minWidth: 320, position: 'sticky', left: 0, background: '#F0F9FF' }}>
                      Total Ativo (ECD - soma das origens)
                    </td>
                    {data.anos.map((ano) => (
                      <td key={ano} style={{ ...tdNumStyle, fontWeight: 600, color: '#1D4ED8', background: '#F0F9FF' }}>
                        {fmt(totalAtivoEcdPorAno[ano])}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: '#F0FDF4' }}>
                    <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#15803D', minWidth: 320, position: 'sticky', left: 0, background: '#F0FDF4' }}>
                      Total Ativo (Balanço Contábil - Matriz)
                    </td>
                    {data.anos.map((ano) => (
                      <td key={ano} style={{ ...tdNumStyle, fontWeight: 600, color: '#15803D', background: '#F0FDF4' }}>
                        {fmt(totalAtivoMatrizPorAno[ano])}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ background: '#FFFBEB', borderTop: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '7px 10px', fontSize: 12, fontWeight: 700, color: '#92400E', minWidth: 320, position: 'sticky', left: 0, background: '#FFFBEB' }}>
                      Diferença
                    </td>
                    {data.anos.map((ano) => {
                      const dif = (totalAtivoEcdPorAno[ano] ?? 0) - (totalAtivoMatrizPorAno[ano] ?? 0);
                      return (
                        <td key={ano} style={{ ...tdNumStyle, fontWeight: 700, background: '#FFFBEB', color: Math.abs(dif) > 0.01 ? '#B91C1C' : '#374151' }}>
                          {fmt(dif)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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
