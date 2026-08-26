// frontend/src/pages/accounting/LivroLalurPage.tsx
// CRIADO 26/08/2026: Livro LALUR oficial (Relatorios -> Contabilidade),
// mesmo padrao formal do Diario Geral/Razao Analitico/Balanco - calculado
// EXCLUSIVAMENTE a partir dos lancamentos contabeis reais em LEDGR (nao do
// dado importado da ECF, que fica em SPED -> LALUR - Livro de Apuracao,
// usado para conciliacao cruzada).
import React, { useState, useCallback, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

interface LalurItemRow {
  id: string; competencia: string; tipo: string; imposto: string;
  descricao: string; valor: number;
}
interface PartBRow {
  ano: string; tipoTributo: string; saldoInicial: number;
  novoPrejuizo: number; compensacao: number; saldoFinal: number; lucroRealAno: number | null;
}

const tributoLabel: Record<string, string> = { I: 'IRPJ', C: 'CSLL' };
const tipoLabel: Record<string, string> = { ADICAO: '(+) Adição', EXCLUSAO: '(-) Exclusão', COMPENSACAO: '(-) Compensação' };

const fmtCnpj = (cnpj: string) => {
  const d = (cnpj || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
};
const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const LivroLalurPage: React.FC = () => {
  const { activeCompany } = useCompany();
  const [ano, setAno] = useState(String(new Date().getFullYear() - 1));
  const [parteA, setParteA] = useState<LalurItemRow[]>([]);
  const [parteB, setParteB] = useState<PartBRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [accountingConfig, setAccountingConfig] = useState<any>({});

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/apuracao/livro-lalur/${ano}`);
      setParteA(res.data?.parteA || []);
      setParteB(res.data?.parteB || []);
    } catch (e) {
      console.error('Erro ao carregar Livro LALUR', e);
      setParteA([]); setParteB([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, ano]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeCompany?.id) return;
    api.get('/accounting/config', { headers: { 'x-company-id': activeCompany.id } })
      .then(res => setAccountingConfig(res.data || {}))
      .catch(() => setAccountingConfig({}));
  }, [activeCompany?.id]);

  const handleCalcular = async () => {
    setCalculando(true);
    try {
      await api.post(`/apuracao/lalur-part-b/${ano}/calcular`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao calcular Parte B.');
    } finally {
      setCalculando(false);
    }
  };

  const parteAAgrupada = React.useMemo(() => {
    const porTipo: Record<string, LalurItemRow[]> = { ADICAO: [], EXCLUSAO: [], COMPENSACAO: [] };
    for (const item of parteA) {
      if (porTipo[item.tipo]) porTipo[item.tipo].push(item);
    }
    return porTipo;
  }, [parteA]);

  const totalAdicoes = parteAAgrupada.ADICAO.reduce((s, i) => s + Number(i.valor), 0);
  const totalExclusoes = parteAAgrupada.EXCLUSAO.reduce((s, i) => s + Number(i.valor), 0);

  const handlePrint = () => {
    const cnpj = fmtCnpj(activeCompany?.taxId || '');
    const razao = activeCompany?.legalName || activeCompany?.tradeName || '';
    const contador = (accountingConfig.accountantName || '[NOME DO CONTADOR]') + ', ' +
      (accountingConfig.accountantRole || 'Contador') + ', CRC/' +
      (accountingConfig.accountantCrcState || 'XX') + ' nº ' + (accountingConfig.accountantCrc || '[CRC]');
    const hoje = new Date().toLocaleDateString('pt-BR');

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LALUR ${ano}</title><style>
      body { font-family: 'Courier New', monospace; font-size: 11px; margin: 20px; }
      h1 { font-size: 15px; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      td, th { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      .num { text-align: right; }
      .header { display: flex; justify-content: space-between; margin-bottom: 12px; }
      .total { font-weight: bold; background: #f5f5f5; }
      .termo { margin-top: 30px; white-space: pre-line; border-top: 1px solid #000; padding-top: 12px; }
    </style></head><body>
    <div class="header"><div><b>${razao}</b><br/>CNPJ: ${cnpj}</div><div>Data: ${hoje}</div></div>
    <h1>LIVRO DE APURAÇÃO DO LUCRO REAL — LALUR (Nativo LEDGR)</h1>
    <p style="text-align:center">Exercício ${ano}</p>

    <h3>PARTE A — Demonstração do Lucro Real</h3>
    <table><thead><tr><th>Competência</th><th>Tipo</th><th>Imposto</th><th>Descrição</th><th class="num">Valor</th></tr></thead><tbody>
    ${parteA.map(i => `<tr><td>${i.competencia}</td><td>${tipoLabel[i.tipo] || i.tipo}</td><td>${i.imposto}</td><td>${i.descricao}</td><td class="num">${fmt(i.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="4">Total Adições</td><td class="num">${fmt(totalAdicoes)}</td></tr>
    <tr class="total"><td colspan="4">Total Exclusões</td><td class="num">${fmt(totalExclusoes)}</td></tr>
    </tbody></table>

    <h3>PARTE B — Controle de Saldos (Prejuízo Fiscal / Base Negativa CSLL)</h3>
    <table><thead><tr><th>Ano</th><th>Tributo</th><th class="num">Saldo Inicial</th><th class="num">Novo Prejuízo</th><th class="num">Compensação</th><th class="num">Saldo Final</th></tr></thead><tbody>
    ${parteB.map(b => `<tr><td>${b.ano}</td><td>${tributoLabel[b.tipoTributo] || b.tipoTributo}</td><td class="num">${fmt(b.saldoInicial)}</td><td class="num">${fmt(b.novoPrejuizo)}</td><td class="num">${fmt(b.compensacao)}</td><td class="num"><b>${fmt(b.saldoFinal)}</b></td></tr>`).join('')}
    </tbody></table>

    <div class="termo">Livro gerado a partir dos lançamentos contábeis registrados em LEDGR, elaborado sob a responsabilidade de:\n\n${contador}</div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const thSt: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' };
  const selSt: React.CSSProperties = { padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
            ◆ Contábil
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>Livro LALUR</h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
            Calculado exclusivamente a partir dos lançamentos contábeis registrados em LEDGR.
            Para conciliação com o que foi declarado à Receita, veja SPED → LALUR — Livro de Apuração (ECF).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={ano} onChange={e => setAno(e.target.value)} style={selSt}>
            {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button onClick={handleCalcular} disabled={calculando} style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: calculando ? 0.6 : 1 }}>
            {calculando ? 'Calculando...' : 'Calcular Parte B'}
          </button>
          <button onClick={handlePrint} style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Imprimir Livro
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando…</div>
      ) : (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Parte A — Demonstração do Lucro Real ({ano})</h2>
          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 340, marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={thSt}>Competência</th><th style={thSt}>Tipo</th><th style={thSt}>Imposto</th>
                <th style={thSt}>Descrição</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th>
              </tr></thead>
              <tbody>
                {parteA.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    Nenhum ajuste lançado para {ano}. Use "Config. Dedutibilidade" + "Gerar Sugestões" em Apuração de Impostos.
                  </td></tr>
                ) : parteA.map((i, idx) => (
                  <tr key={i.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>{i.competencia}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>{tipoLabel[i.tipo] || i.tipo}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 11, color: '#9CA3AF' }}>{i.imposto}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>{i.descricao}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmt(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Parte B — Controle de Saldos</h2>
          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={thSt}>Ano</th><th style={thSt}>Tributo</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Saldo Inicial</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Novo Prejuízo</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Compensação</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Saldo Final</th>
              </tr></thead>
              <tbody>
                {parteB.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    Nenhum cálculo de Parte B para {ano} ainda. Clique em "Calcular Parte B".
                  </td></tr>
                ) : parteB.map((b, idx) => (
                  <tr key={`${b.ano}-${b.tipoTributo}`} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>{b.ano}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: b.tipoTributo === 'I' ? '#EFF6FF' : '#FDF4FF', color: b.tipoTributo === 'I' ? '#1D4ED8' : '#A21CAF' }}>
                        {tributoLabel[b.tipoTributo] || b.tipoTributo}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#9CA3AF' }}>{fmt(b.saldoInicial)}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: b.novoPrejuizo > 0 ? '#B91C1C' : '#D1D5DB' }}>{b.novoPrejuizo > 0 ? `+${fmt(b.novoPrejuizo)}` : '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: b.compensacao > 0 ? '#059669' : '#D1D5DB' }}>{b.compensacao > 0 ? `-${fmt(b.compensacao)}` : '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700 }}>{fmt(b.saldoFinal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default LivroLalurPage;
