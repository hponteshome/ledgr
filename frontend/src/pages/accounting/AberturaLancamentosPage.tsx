// frontend/src/pages/accounting/AberturaLancamentosPage.tsx
// CRIADO 27/08/2026: Lancamentos de Abertura - converte saldos finais
// analiticos da ECD (data de fechamento) para as contas do Plano Matriz,
// usando o de/para ja existente (ecd_account_mappings). Motivado pela
// abertura 2018 da Hotelsys (ECD 2017 fechada -> Matriz 01/01/2018),
// construido como ferramenta reutilizavel para futuras empresas/exercicios.
import React, { useState, useCallback, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';
import { imprimirRelatorio } from '@/utils/imprimirRelatorio';
import { usePrintHandler } from '@/contexts/PrintContext';

interface AberturaLinha {
  targetAccountId: string;
  targetCode: string;
  targetName: string;
  targetType: string;
  isAnalytic: boolean;
  saldo: number;
  debito: number;
  credito: number;
  origens: { code: string; name: string; balance: number }[];
}
interface AberturaCalculo {
  linhas: AberturaLinha[];
  totalDebito: number;
  totalCredito: number;
  diferenca: number;
  contasNaoAnaliticas: { code: string; name: string }[];
}

const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const AberturaLancamentosPage: React.FC = () => {
  const { activeCompany } = useCompany();
  const [dataFechamento, setDataFechamento] = useState('2017-12-31');
  const [dataAbertura, setDataAbertura] = useState('2017-12-31');
  const [referencia, setReferencia] = useState('ABERTURA-2018');
  const [calculo, setCalculo] = useState<AberturaCalculo | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const calcular = useCallback(async () => {
    if (!activeCompany?.id || !dataFechamento) return;
    setLoading(true);
    setResultado(null);
    try {
      const r = await api.get('/accounting/abertura/calcular', { params: { dataFechamento } });
      setCalculo(r.data);
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao calcular abertura.' });
      setCalculo(null);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, dataFechamento]);

  useEffect(() => { calcular(); }, [calcular]);

  const handleRegistrar = async () => {
    if (!calculo) return;
    if (!confirm(`Confirma o registro do lançamento de abertura "${referencia}"?\n\n${calculo.linhas.length} contas, débito e crédito de ${fmt(calculo.totalDebito)}.\n\nEsta ação cria um lançamento contábil real.`)) return;
    setRegistrando(true);
    setResultado(null);
    try {
      const r = await api.post('/accounting/abertura/registrar', { dataFechamento, dataAbertura, referencia });
      setResultado({ ok: true, mensagem: `Lançamento registrado com sucesso — ${r.data.totalItens} itens, débito/crédito ${fmt(r.data.totalDebito)}.` });
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao registrar lançamento.' });
    } finally {
      setRegistrando(false);
    }
  };

  const temProblema = calculo && (calculo.contasNaoAnaliticas.length > 0 || Math.abs(calculo.diferenca) > 0.01);

  const handleImprimir = () => {
    if (!calculo || !activeCompany) return;
    const linhas = calculo.linhas.map(l => `
      <tr>
        <td>${l.targetCode}</td>
        <td>${l.targetName}</td>
        <td>${l.targetType}</td>
        <td class="num">${l.debito ? fmt(l.debito) : '—'}</td>
        <td class="num">${l.credito ? fmt(l.credito) : '—'}</td>
      </tr>`).join('');
    const corpoHtml = `
      <table>
        <thead><tr><th>Código</th><th>Conta</th><th>Tipo</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
        <tbody>${linhas}
          <tr class="total"><td colspan="3">TOTAL</td><td class="num">${fmt(calculo.totalDebito)}</td><td class="num">${fmt(calculo.totalCredito)}</td></tr>
        </tbody>
      </table>`;
    imprimirRelatorio({
      titulo: 'LANÇAMENTOS DE ABERTURA',
      subtitulo: `Referência: ${referencia}`,
      empresaNome: activeCompany.legalName || activeCompany.tradeName || '',
      empresaCnpj: activeCompany.taxId || '',
      periodo: new Date(dataAbertura + 'T12:00:00').toLocaleDateString('pt-BR'),
      corpoHtml,
    });
  };

  usePrintHandler(calculo ? handleImprimir : null, 'Imprimir Lançamentos de Abertura', [calculo, referencia, dataAbertura]);

  const thSt: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' };
  const inputSt: React.CSSProperties = { padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
          ◆ Contábil
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>Lançamentos de Abertura</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Converte saldos finais analíticos da ECD (data de fechamento) para as contas do Plano Matriz (data de abertura), usando o de/para já configurado em Tabela Comparativa ECD.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Data de fechamento (ECD, origem)</label>
          <input type="date" value={dataFechamento} onChange={e => setDataFechamento(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Data de abertura (lançamento, destino)</label>
          <input type="date" value={dataAbertura} onChange={e => setDataAbertura(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Referência</label>
          <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} style={{ ...inputSt, width: 160 }} />
        </div>
        <button onClick={calcular} disabled={loading} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Calculando…' : 'Recalcular'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleRegistrar}
          disabled={!calculo || !!temProblema || registrando}
          style={{
            padding: '9px 20px', background: temProblema ? '#D1D5DB' : '#2563EB', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: temProblema ? 'not-allowed' : 'pointer',
          }}
        >
          {registrando ? 'Registrando…' : 'Registrar Lançamentos'}
        </button>
      </div>

      {resultado && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: resultado.ok ? '#ECFDF5' : '#FEF2F2', color: resultado.ok ? '#059669' : '#B91C1C',
        }}>
          {resultado.mensagem}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Calculando…</div>
      ) : !calculo ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum cálculo ainda.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: 14, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Contas</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{calculo.linhas.length}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Débito</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(calculo.totalDebito)}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Crédito</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(calculo.totalCredito)}</div>
            </div>
            <div style={{
              flex: 1, padding: 14, borderRadius: 8, textAlign: 'center',
              background: Math.abs(calculo.diferenca) < 0.01 ? '#ECFDF5' : '#FEF2F2',
            }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Diferença</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: Math.abs(calculo.diferenca) < 0.01 ? '#059669' : '#B91C1C' }}>
                {fmt(calculo.diferenca)}
              </div>
            </div>
          </div>

          {calculo.contasNaoAnaliticas.length > 0 && (
            <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              ⚠ {calculo.contasNaoAnaliticas.length} conta(s) sintética(s) com saldo — crie contas analíticas antes de registrar: {calculo.contasNaoAnaliticas.map(c => c.code).join(', ')}
            </div>
          )}

          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 560 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thSt}>Código</th>
                  <th style={thSt}>Conta</th>
                  <th style={thSt}>Tipo</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Débito</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Crédito</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>Origens</th>
                </tr>
              </thead>
              <tbody>
                {calculo.linhas.map((l, idx) => (
                  <React.Fragment key={l.targetAccountId}>
                    <tr
                      style={{ background: !l.isAnalytic ? '#FEF2F2' : idx % 2 === 0 ? '#fff' : '#FAFAFA', cursor: 'pointer' }}
                      onClick={() => setExpandido(expandido === l.targetAccountId ? null : l.targetAccountId)}
                    >
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontFamily: 'monospace', fontSize: 12 }}>{l.targetCode}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>
                        {l.targetName}{!l.isAnalytic && <span style={{ color: '#B91C1C', fontSize: 10, marginLeft: 6 }}>SINTÉTICA</span>}
                      </td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 11, color: '#9CA3AF' }}>{l.targetType}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{l.debito ? fmt(l.debito) : '—'}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{l.credito ? fmt(l.credito) : '—'}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>{l.origens.length}</td>
                    </tr>
                    {expandido === l.targetAccountId && (
                      <tr>
                        <td colSpan={6} style={{ padding: '8px 12px 8px 32px', background: '#FAFAFA', borderBottom: '0.5px solid #F5F5F5' }}>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Origens ECD:</div>
                          {l.origens.map((o, i) => (
                            <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                              <span><span style={{ fontFamily: 'monospace', color: '#2563EB' }}>{o.code}</span> {o.name}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(o.balance)}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AberturaLancamentosPage;
