// frontend/src/pages/accounting/LivroLalurPage.tsx
// CRIADO 26/08/2026: Livro LALUR oficial (Relatorios -> Contabilidade),
// mesmo padrao formal do Diario Geral/Razao Analitico/Balanco - calculado
// EXCLUSIVAMENTE a partir dos lancamentos contabeis reais em LEDGR (nao do
// dado importado da ECF, que fica em SPED -> LALUR - Livro de Apuracao,
// usado para conciliacao cruzada).
import React, { useState, useCallback, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface LalurItemRow {
  id: string; competencia: string; tipo: string; imposto: string;
  descricao: string; valor: number;
}
interface PartBRow {
  ano: string; tipoTributo: string; saldoInicial: number;
  novoPrejuizo: number; compensacao: number; saldoFinal: number; lucroRealAno: number | null;
  saldoInicialManual?: number | string | null;
}

const tributoLabel: Record<string, string> = { I: 'IRPJ', C: 'CSLL' };
const tipoLabel: Record<string, string> = { ADICAO: '(+) Adição', EXCLUSAO: '(-) Exclusão', COMPENSACAO: '(-) Compensação' };

const fmtCnpj = (cnpj: string) => {
  const d = (cnpj || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
};
const fmt = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};

export const LivroLalurPage: React.FC = () => {
  const { activeCompany } = useCompany();
  const [ano, setAno] = useState(String(new Date().getFullYear() - 1));
  const [parteA, setParteA] = useState<LalurItemRow[]>([]);
  const [parteB, setParteB] = useState<PartBRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [accountingConfig, setAccountingConfig] = useState<any>({});
  const navigate = useNavigate();
  const [tributoTab, setTributoTab] = useState<'I' | 'C'>('I');
  // Saldo inicial da Parte B (modal)
  const [saldoModal, setSaldoModal] = useState(false);
  const [saldoInfo, setSaldoInfo] = useState<Record<string, { automatico: number; manual: number | null; efetivo: number }> | null>(null);
  const [saldoForm, setSaldoForm] = useState<Record<string, string>>({ I: '', C: '' });
  const [saldoSaving, setSaldoSaving] = useState(false);
  const [saldoError, setSaldoError] = useState('');

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

  const fmtInput = (v: number | null | undefined) =>
    v === null || v === undefined ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseInput = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  const abrirSaldoInicial = async () => {
    setSaldoError(''); setSaldoInfo(null); setSaldoModal(true);
    try {
      const res = await api.get(`/apuracao/lalur-part-b/${ano}/saldo-inicial`);
      const s = res.data?.saldos || {};
      setSaldoInfo(s);
      setSaldoForm({ I: fmtInput(s.I?.manual), C: fmtInput(s.C?.manual) });
    } catch (e: any) {
      setSaldoError(e?.response?.data?.message || 'Erro ao carregar os saldos iniciais.');
    }
  };

  const salvarSaldoInicial = async () => {
    const I = parseInput(saldoForm.I);
    const C = parseInput(saldoForm.C);
    if (Number.isNaN(I) || Number.isNaN(C)) {
      setSaldoError('Valor inválido. Use o formato 0,00 (ou deixe em branco para usar o automático).');
      return;
    }
    setSaldoSaving(true); setSaldoError('');
    try {
      await api.put(`/apuracao/lalur-part-b/${ano}/saldo-inicial`, { I, C });
      setSaldoModal(false);
      await load();
    } catch (e: any) {
      setSaldoError(e?.response?.data?.message || 'Erro ao salvar o saldo inicial.');
    } finally {
      setSaldoSaving(false);
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

  const linhaAno = (t: string) => parteB.find(b => b.ano === ano && b.tipoTributo === t);
  const linhasB = React.useMemo(
    () => parteB.filter(b => b.tipoTributo === tributoTab).sort((a, b) => a.ano.localeCompare(b.ano)),
    [parteB, tributoTab]
  );
  const maxSaldo = Math.max(0, ...linhasB.map(b => Math.abs(Number(b.saldoFinal))));

  const btnBase: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' };
  const btnOutline: React.CSSProperties = { ...btnBase, background: '#fff', color: '#374151', border: '1px solid #E5E7EB' };

  // Cards-resumo do exercicio selecionado (uma coluna por tributo)
  const renderResumo = (t: 'I' | 'C') => {
    const l = linhaAno(t);
    const cor = t === 'I' ? { fg: '#1D4ED8', bg: '#EFF6FF' } : { fg: '#A21CAF', bg: '#FDF4FF' };
    const valor = (v: number | string | null | undefined) => (
      <span style={{ fontVariantNumeric: 'tabular-nums', color: Number(v) < 0 ? '#B91C1C' : undefined }}>{fmt(v)}</span>
    );
    const linha = (rotulo: string, conteudo: React.ReactNode, forte = false) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', fontSize: forte ? 14 : 13, fontWeight: forte ? 700 : 400, color: forte ? '#111' : '#374151', borderTop: forte ? '0.5px solid #E5E7EB' : undefined, marginTop: forte ? 4 : 0 }}>
        <span>{rotulo}</span>{conteudo}
      </div>
    );
    return (
      <div key={t} style={{ flex: 1, minWidth: 320, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: cor.bg, color: cor.fg }}>
            {tributoLabel[t]} · {t === 'I' ? 'prejuízo fiscal' : 'base negativa'}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Exercício {ano}</span>
        </div>
        {!l ? (
          <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>Sem cálculo para {ano}. Clique em "Recalcular Parte B".</div>
        ) : (
          <>
            {linha('Saldo inicial', valor(l.saldoInicial))}
            {linha('(+) Novo prejuízo do ano', Number(l.novoPrejuizo) > 0
              ? <span style={{ fontVariantNumeric: 'tabular-nums', color: '#B91C1C' }}>+{fmt(l.novoPrejuizo)}</span>
              : <span style={{ color: '#D1D5DB' }}>—</span>)}
            {linha('(−) Compensação', Number(l.compensacao) > 0
              ? <span style={{ fontVariantNumeric: 'tabular-nums', color: '#059669' }}>-{fmt(l.compensacao)}</span>
              : <span style={{ color: '#D1D5DB' }}>—</span>)}
            {linha('Saldo final', valor(l.saldoFinal), true)}
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
              Lucro real do ano: {l.lucroRealAno == null ? '—' : valor(l.lucroRealAno)}
            </div>
          </>
        )}
      </div>
    );
  };

  const thSt: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 };
  const selSt: React.CSSProperties = { padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ position: 'sticky', top: 12, zIndex: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '10px 16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8', whiteSpace: 'nowrap' }}>
            ◆ Contábil
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111111', margin: 0, whiteSpace: 'nowrap' }}>Livro LALUR</h1>
          <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Parte A e Parte B · exercício {ano}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={ano} onChange={e => setAno(e.target.value)} style={selSt}>
            {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button onClick={() => navigate('/app/fiscal/apuracao')} title="Abre Fiscal > Apuração de Impostos (aba LALUR) para lançar adições e exclusões" style={btnOutline}>
            Lançar ajustes
          </button>
          <button onClick={abrirSaldoInicial} title="Informar o saldo inicial de prejuízo fiscal / base negativa do ano" style={btnOutline}>
            Saldo inicial
          </button>
          <button onClick={handleCalcular} disabled={calculando} style={{ ...btnBase, background: '#2563EB', color: '#fff', border: 'none', opacity: calculando ? 0.6 : 1 }}>
            {calculando ? 'Recalculando...' : 'Recalcular Parte B'}
          </button>
          <button onClick={handlePrint} style={{ ...btnBase, background: '#111827', color: '#fff', border: 'none' }}>
            Imprimir Livro
          </button>
        </div>
      </header>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>
        Calculado exclusivamente a partir dos lançamentos contábeis registrados em LEDGR.
        Para conciliação com o que foi declarado à Receita, veja SPED → LALUR — Livro de Apuração (ECF).
      </p>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {(['I', 'C'] as const).map(t => renderResumo(t))}
          </div>

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
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: Number(i.valor) < 0 ? '#B91C1C' : undefined }}>{fmt(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Parte B — Controle de Saldos</h2>
            <div style={{ display: 'inline-flex', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              {(['I', 'C'] as const).map(t => (
                <button key={t} onClick={() => setTributoTab(t)} style={{ padding: '6px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: tributoTab === t ? '#2563EB' : '#fff', color: tributoTab === t ? '#fff' : '#6B7280' }}>
                  {tributoLabel[t]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {linhasB.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Nenhum cálculo de Parte B para {ano} ainda. Clique em "Recalcular Parte B".
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 16px 0', fontSize: 11, color: '#9CA3AF' }}>Saldo final por ano — {tributoLabel[tributoTab]}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 96, padding: '6px 16px 0', borderBottom: '0.5px solid #E5E7EB' }}>
                  {linhasB.map(b => {
                    const sel = b.ano === ano;
                    const h = maxSaldo > 0 ? Math.max(2, (Math.abs(Number(b.saldoFinal)) / maxSaldo) * 64) : 2;
                    return (
                      <div key={b.ano} title={`${b.ano}: saldo final ${fmt(b.saldoFinal)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: '100%', maxWidth: 44, height: h, background: sel ? '#2563EB' : '#CBD5E1', borderRadius: '3px 3px 0 0' }} />
                        <span style={{ fontSize: 10, color: sel ? '#2563EB' : '#9CA3AF', fontWeight: sel ? 700 : 400, paddingBottom: 4 }}>{b.ano}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ overflow: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={thSt}>Ano</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Saldo inicial</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>(+) Novo prejuízo</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>(−) Compensação</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Saldo final</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Lucro real do ano</th>
                    </tr></thead>
                    <tbody>
                      {linhasB.map(b => {
                        const sel = b.ano === ano;
                        const semMov = Number(b.novoPrejuizo) === 0 && Number(b.compensacao) === 0;
                        const td: React.CSSProperties = { padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 };
                        return (
                          <tr key={`${b.ano}-${b.tipoTributo}`} style={{ background: sel ? '#EFF6FF' : '#fff', opacity: semMov && !sel ? 0.65 : 1 }}>
                            <td style={{ ...td, textAlign: 'left', fontWeight: sel ? 700 : 500, color: sel ? '#1D4ED8' : '#374151' }}>{b.ano}</td>
                            <td style={{ ...td, color: Number(b.saldoInicial) < 0 ? '#B91C1C' : '#6B7280' }}>
                              {b.saldoInicialManual != null && <span title="Saldo inicial informado manualmente" style={{ fontSize: 9, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '1px 5px', borderRadius: 3, marginRight: 6 }}>MANUAL</span>}
                              {fmt(b.saldoInicial)}
                            </td>
                            <td style={{ ...td, color: Number(b.novoPrejuizo) > 0 ? '#B91C1C' : '#D1D5DB' }}>{Number(b.novoPrejuizo) > 0 ? `+${fmt(b.novoPrejuizo)}` : '—'}</td>
                            <td style={{ ...td, color: Number(b.compensacao) > 0 ? '#059669' : '#D1D5DB' }}>{Number(b.compensacao) > 0 ? `-${fmt(b.compensacao)}` : '—'}</td>
                            <td style={{ ...td, fontWeight: 700, color: Number(b.saldoFinal) < 0 ? '#B91C1C' : '#111111' }}>{fmt(b.saldoFinal)}</td>
                            <td style={{ ...td, color: b.lucroRealAno == null ? '#D1D5DB' : Number(b.lucroRealAno) < 0 ? '#B91C1C' : '#374151' }}>{b.lucroRealAno == null ? '—' : fmt(b.lucroRealAno)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {saldoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', borderRadius: '14px 14px 0 0', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8' }}>◆ Contábil</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Saldo inicial da Parte B — {ano}</h2>
              </div>
              <button onClick={() => setSaldoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
                Prejuízo fiscal (IRPJ) e base negativa (CSLL) trazidos de períodos anteriores. Deixe em branco para usar o valor
                automático (saldo final do ano anterior + saldo de abertura da contabilidade).
              </p>

              {saldoError && (
                <div style={{ background: '#FCEBEB', border: '0.5px solid #F5C6C6', borderRadius: 8, padding: 12, marginBottom: 16, color: '#B91C1C', fontSize: 13 }}>
                  {saldoError}
                </div>
              )}

              {!saldoInfo && !saldoError && (
                <div style={{ color: '#9CA3AF', fontSize: 13, padding: '16px 0' }}>Carregando…</div>
              )}

              {saldoInfo && (['I', 'C'] as const).map(t => (
                <div key={t} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>{tributoLabel[t]}</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      value={saldoForm[t]}
                      onChange={e => setSaldoForm(f => ({ ...f, [t]: e.target.value }))}
                      placeholder="Automático"
                      style={{ ...selSt, width: 180, textAlign: 'right', fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Automático: R$ {fmt(saldoInfo[t]?.automatico)}</span>
                    {saldoForm[t] && (
                      <button onClick={() => setSaldoForm(f => ({ ...f, [t]: '' }))} style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Usar automático
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA', borderRadius: '0 0 14px 14px', flexShrink: 0 }}>
              <button onClick={() => setSaldoModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarSaldoInicial} disabled={saldoSaving || !saldoInfo} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saldoInfo ? '#2563EB' : '#D1D5DB', color: '#fff', fontSize: 13, fontWeight: 500, cursor: saldoInfo ? 'pointer' : 'not-allowed' }}>
                {saldoSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LivroLalurPage;
