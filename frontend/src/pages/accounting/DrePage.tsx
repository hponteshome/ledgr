// frontend/src/pages/accounting/DrePage.tsx
import React, { useState, useCallback } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

interface Account { id: string; code: string; name: string; type: string; nature: string; isAnalytic: boolean; level: number; }
interface DREItem { account: Account; previousBalance: number; debits: number; credits: number; currentBalance: number; children?: DREItem[]; }

const getActiveYear = () => {
    try {
        const companyId = localStorage.getItem('@ledgr:companyId');
        if (companyId) {
            const s = localStorage.getItem(`@ledgr:activeCompetencia:${companyId}`);
            if (s) return new Date(s).getFullYear();
        }
    } catch {}
    return new Date().getFullYear();
};
const fmtNum = (v: number) => {
    if (v === 0) return '—';
    const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? '(' + abs + ')' : abs;
};
const fmtCnpj = (v: string) => { const d = v.replace(/\D/g,''); return d.length === 14 ? d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'/'+d.slice(8,12)+'-'+d.slice(12) : v; };

const DrePage: React.FC = () => {
    const { activeCompany } = useCompany();
    const yr = getActiveYear();
    const [dateFrom, setDateFrom] = useState(yr + '-01-01');
    const [dateTo, setDateTo] = useState(yr + '-12-31');
    const [data, setData] = useState<DREItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generated, setGenerated] = useState(false);
    React.useEffect(() => { setData([]); setGenerated(false); }, [activeCompany?.id]);

    // NOVO 13/09/2026: aba "DRE Comparativa" - evolucao anual de Receitas/
    // Despesas com Var% (ano a ano) e AV% (% da Receita Total do ano),
    // reaproveitando getComparisonAnual do Comparativo de Saldos com
    // excludeClosing=true (mesmo motivo do DRE normal - sem isso o
    // encerramento zera o movimento anual).
    const [viewMode, setViewMode] = useState<'dre' | 'comparativa'>('dre');
    const [anoIniComp, setAnoIniComp] = useState(yr - 4);
    const [anoFimComp, setAnoFimComp] = useState(yr);
    const [anosComp, setAnosComp] = useState<number[]>([]);
    const [dataComp, setDataComp] = useState<any[]>([]);
    const [loadingComp, setLoadingComp] = useState(false);
    const [errorComp, setErrorComp] = useState('');
    const [generatedComp, setGeneratedComp] = useState(false);

    const load = useCallback(async (from: string, to: string) => {
        if (!activeCompany) return;
        setLoading(true); setError(''); setGenerated(false);
        try {
            const r = await api.get('/accounting/trial-balance/verification', {
                // NOVO (02/09/2026): DRE precisa do movimento BRUTO do periodo,
                // sem o lancamento de encerramento (que sempre credita cada
                // conta de Resultado pelo exato valor debitado - zerava o DRE
                // de qualquer periodo fechado quando calculado por saldo liquido).
                params: { startDate: from, endDate: to, excludeClosing: true },
            });
            setData(r.data?.balances ?? []);
            setGenerated(true);
        } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar.'); }
        finally { setLoading(false); }
    }, [activeCompany]);

    const MAX_ANOS_COMP = 10;
    const loadComparativa = useCallback(async () => {
        if (!activeCompany) return;
        if (anoFimComp - anoIniComp + 1 > MAX_ANOS_COMP) {
            setErrorComp(`Selecione no máximo ${MAX_ANOS_COMP} anos.`);
            return;
        }
        setLoadingComp(true); setErrorComp(''); setGeneratedComp(false);
        try {
            const r = await api.get(`/reports/balance-comparison/${activeCompany.id}/anual`, {
                params: { anoInicio: anoIniComp, anoFim: anoFimComp, excludeClosing: true },
            });
            setAnosComp(r.data?.anos || []);
            setDataComp(r.data?.contas || []);
            setGeneratedComp(true);
        } catch (e: any) {
            setErrorComp(e.response?.data?.message || 'Erro ao carregar a DRE comparativa.');
            setDataComp([]); setAnosComp([]);
        } finally { setLoadingComp(false); }
    }, [activeCompany, anoIniComp, anoFimComp]);

    const linhasComp = dataComp
        .filter(r => (r.type === 'REVENUE' || r.type === 'EXPENSE') && !r.conta.startsWith('49'))
        .sort((a, b) => a.conta.localeCompare(b.conta));
    const receitasComp = linhasComp.filter(r => r.type === 'REVENUE');
    const despesasComp = linhasComp.filter(r => r.type === 'EXPENSE');

    const valComp = (row: any, ano: number) => {
        const mov = row.movimentos?.[ano] ?? 0;
        return row.nature === 'CREDIT' ? -mov : mov;
    };
    const totalPorAnoComp = (rows: any[], ano: number) =>
        rows.filter(r => r.level === 1).reduce((s, r) => s + valComp(r, ano), 0);

    const totalReceitasPorAno: Record<number, number> = {};
    const totalDespesasPorAno: Record<number, number> = {};
    const resultadoPorAnoComp: Record<number, number> = {};
    anosComp.forEach(ano => {
        totalReceitasPorAno[ano] = totalPorAnoComp(receitasComp, ano);
        totalDespesasPorAno[ano] = totalPorAnoComp(despesasComp, ano);
        resultadoPorAnoComp[ano] = totalReceitasPorAno[ano] + totalDespesasPorAno[ano];
    });

    const fmtPercent = (v: number | null) => {
        if (v === null || !isFinite(v)) return '–';
        const sinal = v > 0 ? '+' : '';
        return `${sinal}${v.toFixed(1).replace('.', ',')}%`;
    };
    const avPercent = (valor: number, ano: number) => {
        const base = totalReceitasPorAno[ano];
        if (!base) return null;
        return (valor / Math.abs(base)) * 100;
    };
    const varPercent = (row: any, ano: number, anoAnterior: number | undefined) => {
        if (anoAnterior === undefined) return null;
        const atual = valComp(row, ano);
        const anterior = valComp(row, anoAnterior);
        if (anterior === 0) return null;
        return ((atual - anterior) / Math.abs(anterior)) * 100;
    };

    const receitas = data.filter(i => i.account.type === 'REVENUE' && !i.account.code.startsWith('49'));
    const despesas = data.filter(i => i.account.type === 'EXPENSE' && !i.account.code.startsWith('49'));
    // CORRIGIDO 02/09/2026: DRE deve refletir MOVIMENTO BRUTO do periodo
    // (excluindo o encerramento via excludeClosing=true na chamada acima),
    // nao saldo liquido (currentBalance) - encerramento sempre credita cada
    // conta de Resultado pelo exato valor debitado no periodo, entao usar
    // currentBalance zerava qualquer DRE de periodo fechado. Mesmo criterio
    // ja usado pelo ecd-exporter.service.ts (I355/J150), agora replicado aqui.
    const val = (item: DREItem) => item.account.nature === 'CREDIT' ? (item.credits - item.debits) : (item.debits - item.credits);
    const valTotal = (items: DREItem[]) => items.filter(i => i.account.level === 1).reduce((s, i) => s + val(i), 0);
    const totalReceitas = valTotal(receitas);
    const totalDespesas = valTotal(despesas);
    const resultado = totalReceitas + totalDespesas;

    const DRERow = ({ item }: { item: DREItem }) => {
        const v = val(item);
        const cor = v < 0 ? '#B91C1C' : '#111';
        const fw = item.account.isAnalytic ? 400 : 700;
        return (
            <tr>
                <td style={{ fontSize: 12, color: item.account.isAnalytic ? '#374151' : '#111', fontWeight: fw, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <span style={{ fontFamily: 'monospace', color: '#9CA3AF', fontSize: 11, marginRight: 8 }}>{item.account.code}</span>
                    {item.account.name}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: cor, fontWeight: fw }}>
                    {item.account.isAnalytic ? fmtNum(v) : ''}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: cor, fontWeight: fw }}>
                    {!item.account.isAnalytic ? fmtNum(v) : ''}
                </td>
            </tr>
        );
    };

    const printDRE = () => {
        if (!generated || !activeCompany) return;
        const empresa = activeCompany.legalName || activeCompany.tradeName || '';
        const cnpj = fmtCnpj(activeCompany.taxId || '');
        const hoje = new Date().toLocaleDateString('pt-BR');
        const periodo = dateFrom.split('-').reverse().join('/') + ' a ' + dateTo.split('-').reverse().join('/');
        const buildRows = (items: DREItem[]): string => items.map(item => {
            const v = val(item);
            const cor = v < 0 ? '#B91C1C' : '#000';
            return "<tr><td style='padding:2px 6px;font-weight:" + (item.account.isAnalytic ? 400 : 700) + ";font-size:9pt'><span style='font-family:monospace;color:#888;font-size:8pt;margin-right:6px'>" + item.account.code + "</span>" + item.account.name + "</td><td style='text-align:right;font-family:monospace;padding:2px 6px;color:" + cor + "'>" + (item.account.isAnalytic ? fmtNum(v) : '') + "</td><td style='text-align:right;font-family:monospace;padding:2px 6px;font-weight:700;color:" + cor + "'>" + (!item.account.isAnalytic ? fmtNum(v) : '') + "</td></tr>";
        }).join('');
        const css = "@page{size:A4 portrait;margin:12mm 14mm}body{font-family:Arial,sans-serif;font-size:9pt}.header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}table{width:100%;border-collapse:collapse}th{padding:4px 6px;border-bottom:1px solid #000;border-top:1px solid #000;font-size:8pt;text-transform:uppercase}th.num{text-align:right}td{padding:2px 6px;border-bottom:0.5px solid #eee}.sec{background:#F3F4F6;font-weight:700}.tot{border-top:1px solid #000;font-weight:700;background:#E5E7EB}.res{border-top:2px solid #000;font-weight:700;font-size:10pt}";
        const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>DRE</title><style>" + css + "</style></head><body><div class='header'><div><b>" + empresa + "</b><br/><span style='font-size:8pt'>CNPJ: " + cnpj + "</span></div><div style='text-align:center'><b>DEMONSTRACAO DO RESULTADO DO EXERCICIO</b><br/>" + periodo + "</div><div style='text-align:right;font-size:8pt'>Emissao: " + hoje + "</div></div><table><thead><tr><th>Conta</th><th class='num' style='width:110px'>Parcial</th><th class='num' style='width:110px'>Total</th></tr></thead><tbody><tr><td class='sec' colspan='3'>RECEITAS</td></tr>" + buildRows(receitas) + "<tr class='tot'><td colspan='2'>TOTAL DAS RECEITAS</td><td style='text-align:right;font-family:monospace'>" + fmtNum(totalReceitas) + "</td></tr><tr><td class='sec' colspan='3'>DESPESAS</td></tr>" + buildRows(despesas) + "<tr class='tot'><td colspan='2'>TOTAL DAS DESPESAS</td><td style='text-align:right;font-family:monospace'>" + fmtNum(totalDespesas) + "</td></tr><tr class='res' style='background:" + (resultado >= 0 ? '#F0FDF4' : '#FEF2F2') + ";color:" + (resultado >= 0 ? '#16A34A' : '#DC2626') + "'><td colspan='2'>" + (resultado >= 0 ? 'LUCRO DO EXERCICIO' : 'PREJUIZO DO EXERCICIO') + "</td><td style='text-align:right;font-family:monospace'>" + fmtNum(Math.abs(resultado)) + "</td></tr></tbody></table><script>window.onload=function(){window.print();}<\/script></body></html>";
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    return (
        <div style={{ padding: 24, background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                    onClick={() => setViewMode('dre')}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: viewMode === 'dre' ? '#111827' : '#fff', color: viewMode === 'dre' ? '#fff' : '#6B7280' }}
                >
                    DRE
                </button>
                <button
                    onClick={() => setViewMode('comparativa')}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: viewMode === 'comparativa' ? '#111827' : '#fff', color: viewMode === 'comparativa' ? '#fff' : '#6B7280' }}
                >
                    DRE Comparativa
                </button>
            </div>

            {viewMode === 'dre' && (
            <>
            <ReportToolbar title="DRE" dateFrom={dateFrom} dateTo={dateTo}
                count={generated ? receitas.length + despesas.length : undefined} countLabel="contas"
                onPeriodChange={(from, to) => { setDateFrom(from); setDateTo(to); load(from, to); }}
                onFilter={() => load(dateFrom, dateTo)} filterLabel="Gerar DRE"
                onPrint={generated ? printDRE : undefined} hasData={generated} />

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                    <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando...</span>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                    <FiAlertCircle size={14} /> {error}
                </div>
            ) : generated ? (
                <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>DRE — DEMONSTRACAO DO RESULTADO DO EXERCICIO</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginTop: 2 }}>{activeCompany?.legalName || activeCompany?.tradeName}</div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>CNPJ: {fmtCnpj(activeCompany?.taxId || '')} | {dateFrom.split('-').reverse().join('/')} a {dateTo.split('-').reverse().join('/')}</div>
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '60%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '20%' }} />
                            </colgroup>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F9FAFB' }}>
                                <tr style={{ borderBottom: '0.5px solid #E5E7EB' }}>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Conta / Descricao</th>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right' }}>Parcial</th>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: '#EFF6FF' }}>
                                    <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#1D4ED8', borderBottom: '1px solid #BFDBFE' }}>RECEITAS</td>
                                </tr>
                                {receitas.map(item => <DRERow key={item.account.id} item={item} />)}
                                <tr style={{ background: '#EFF6FF', borderTop: '1px solid #1D4ED8' }}>
                                    <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700 }}>TOTAL DAS RECEITAS</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#1D4ED8' }}>{fmtNum(totalReceitas)}</td>
                                </tr>
                                <tr style={{ background: '#FEF2F2' }}>
                                    <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#B91C1C', borderBottom: '1px solid #FECACA' }}>DESPESAS</td>
                                </tr>
                                {despesas.map(item => <DRERow key={item.account.id} item={item} />)}
                                <tr style={{ background: '#FEF2F2', borderTop: '1px solid #B91C1C' }}>
                                    <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700 }}>TOTAL DAS DESPESAS</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#B91C1C' }}>{fmtNum(totalDespesas)}</td>
                                </tr>
                                <tr style={{ background: resultado >= 0 ? '#F0FDF4' : '#FEF2F2', borderTop: '2px solid #111' }}>
                                    <td colSpan={2} style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: resultado >= 0 ? '#16A34A' : '#DC2626' }}>
                                        {resultado >= 0 ? 'LUCRO DO EXERCICIO' : 'PREJUIZO DO EXERCICIO'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, padding: '8px 8px', color: resultado >= 0 ? '#16A34A' : '#DC2626' }}>
                                        {fmtNum(Math.abs(resultado))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
            </>
            )}

            {viewMode === 'comparativa' && (
            <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO DE</div>
                        <input type="number" value={anoIniComp} onChange={e => setAnoIniComp(parseInt(e.target.value, 10) || anoIniComp)}
                            style={{ width: 90, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO ATÉ</div>
                        <input type="number" value={anoFimComp} onChange={e => setAnoFimComp(parseInt(e.target.value, 10) || anoFimComp)}
                            style={{ width: 90, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                    </div>
                    <button onClick={loadComparativa} disabled={loadingComp}
                        style={{ padding: '8px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: loadingComp ? 'default' : 'pointer', opacity: loadingComp ? 0.6 : 1 }}>
                        {loadingComp ? 'Gerando...' : 'Gerar DRE Comparativa'}
                    </button>
                </div>

                {loadingComp ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                        <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando...</span>
                    </div>
                ) : errorComp ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                        <FiAlertCircle size={14} /> {errorComp}
                    </div>
                ) : generatedComp ? (
                    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
                        <table style={{ width: '100%', minWidth: 700 + anosComp.length * 260, borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F9FAFB' }}>
                                <tr style={{ borderBottom: '0.5px solid #E5E7EB' }}>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'left', position: 'sticky', left: 0, background: '#F9FAFB' }}>Conta / Descricao</th>
                                    {anosComp.map(ano => (
                                        <React.Fragment key={ano}>
                                            <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right' }}>{ano}</th>
                                            <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textAlign: 'right' }}>AV%</th>
                                            <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textAlign: 'right' }}>Var%</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: '#EFF6FF' }}>
                                    <td colSpan={1 + anosComp.length * 3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#1D4ED8', borderBottom: '1px solid #BFDBFE' }}>RECEITAS</td>
                                </tr>
                                {receitasComp.map(row => (
                                    <tr key={row.conta}>
                                        <td style={{ fontSize: 12, color: row.isAnalytic ? '#374151' : '#111', fontWeight: row.isAnalytic ? 400 : 700, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', position: 'sticky', left: 0, background: '#fff', paddingLeft: 8 + (row.level - 1) * 14 }}>
                                            <span style={{ fontFamily: 'monospace', color: '#9CA3AF', fontSize: 11, marginRight: 8 }}>{row.conta}</span>
                                            {row.descricao}
                                        </td>
                                        {anosComp.map((ano, idx) => {
                                            const v = valComp(row, ano);
                                            const av = avPercent(v, ano);
                                            const varP = varPercent(row, ano, anosComp[idx - 1]);
                                            const cor = v < 0 ? '#B91C1C' : '#111';
                                            return (
                                                <React.Fragment key={ano}>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: cor, fontWeight: row.isAnalytic ? 400 : 700 }}>{fmtNum(v)}</td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: '#9CA3AF' }}>{fmtPercent(av)}</td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: varP === null ? '#D1D5DB' : (varP >= 0 ? '#15803D' : '#B91C1C') }}>{fmtPercent(varP)}</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                                <tr style={{ background: '#EFF6FF', borderTop: '1px solid #1D4ED8' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: 700, position: 'sticky', left: 0, background: '#EFF6FF' }}>TOTAL DAS RECEITAS</td>
                                    {anosComp.map((ano, idx) => {
                                        const v = totalReceitasPorAno[ano];
                                        const anoAnt = anosComp[idx - 1];
                                        const varP = anoAnt !== undefined && totalReceitasPorAno[anoAnt] ? ((v - totalReceitasPorAno[anoAnt]) / Math.abs(totalReceitasPorAno[anoAnt])) * 100 : null;
                                        return (
                                            <React.Fragment key={ano}>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#1D4ED8' }}>{fmtNum(v)}</td>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '6px 8px', color: '#9CA3AF' }}>100,0%</td>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '6px 8px', color: varP === null ? '#D1D5DB' : (varP >= 0 ? '#15803D' : '#B91C1C') }}>{fmtPercent(varP)}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>

                                <tr style={{ background: '#FEF2F2' }}>
                                    <td colSpan={1 + anosComp.length * 3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#B91C1C', borderBottom: '1px solid #FECACA' }}>DESPESAS</td>
                                </tr>
                                {despesasComp.map(row => (
                                    <tr key={row.conta}>
                                        <td style={{ fontSize: 12, color: row.isAnalytic ? '#374151' : '#111', fontWeight: row.isAnalytic ? 400 : 700, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', position: 'sticky', left: 0, background: '#fff', paddingLeft: 8 + (row.level - 1) * 14 }}>
                                            <span style={{ fontFamily: 'monospace', color: '#9CA3AF', fontSize: 11, marginRight: 8 }}>{row.conta}</span>
                                            {row.descricao}
                                        </td>
                                        {anosComp.map((ano, idx) => {
                                            const v = valComp(row, ano);
                                            const av = avPercent(v, ano);
                                            const varP = varPercent(row, ano, anosComp[idx - 1]);
                                            const cor = v < 0 ? '#B91C1C' : '#111';
                                            return (
                                                <React.Fragment key={ano}>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: cor, fontWeight: row.isAnalytic ? 400 : 700 }}>{fmtNum(v)}</td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: '#9CA3AF' }}>{fmtPercent(av)}</td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: varP === null ? '#D1D5DB' : (varP >= 0 ? '#B91C1C' : '#15803D') }}>{fmtPercent(varP)}</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                                <tr style={{ background: '#FEF2F2', borderTop: '1px solid #B91C1C' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: 700, position: 'sticky', left: 0, background: '#FEF2F2' }}>TOTAL DAS DESPESAS</td>
                                    {anosComp.map((ano, idx) => {
                                        const v = totalDespesasPorAno[ano];
                                        const anoAnt = anosComp[idx - 1];
                                        const varP = anoAnt !== undefined && totalDespesasPorAno[anoAnt] ? ((v - totalDespesasPorAno[anoAnt]) / Math.abs(totalDespesasPorAno[anoAnt])) * 100 : null;
                                        return (
                                            <React.Fragment key={ano}>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#B91C1C' }}>{fmtNum(v)}</td>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '6px 8px', color: '#9CA3AF' }}>{fmtPercent(avPercent(v, ano))}</td>
                                                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, padding: '6px 8px', color: varP === null ? '#D1D5DB' : (varP >= 0 ? '#B91C1C' : '#15803D') }}>{fmtPercent(varP)}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                                <tr style={{ borderTop: '2px solid #111' }}>
                                    <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, position: 'sticky', left: 0, background: '#fff' }}>RESULTADO DO EXERCÍCIO</td>
                                    {anosComp.map(ano => {
                                        const v = resultadoPorAnoComp[ano];
                                        return (
                                            <td key={ano} colSpan={3} style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, padding: '8px 8px', color: v >= 0 ? '#16A34A' : '#DC2626' }}>{fmtNum(v)}</td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
                        Escolha o período e clique em "Gerar DRE Comparativa".
                    </div>
                )}
            </>
            )}
        </div>
    );
};

export default DrePage;
