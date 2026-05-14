// frontend/src/pages/accounting/DrePage.tsx
import React, { useState, useCallback } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

interface Account { id: string; code: string; name: string; type: string; nature: string; isAnalytic: boolean; level: number; }
interface DREItem { account: Account; previousBalance: number; debits: number; credits: number; currentBalance: number; children?: DREItem[]; }

const getActiveYear = () => {
    try { const s = localStorage.getItem('@ledgr:activeMonth'); if (s) return new Date(s).getFullYear(); } catch {}
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

    const load = useCallback(async (from: string, to: string) => {
        if (!activeCompany) return;
        setLoading(true); setError(''); setGenerated(false);
        try {
            const r = await api.get('/accounting/trial-balance/verification', {
                params: { startDate: from, endDate: to },
            });
            setData(r.data?.balances ?? []);
            setGenerated(true);
        } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar.'); }
        finally { setLoading(false); }
    }, [activeCompany]);

    // Separar receitas e despesas — apenas nível 1 para totais
    const receitas  = data.filter(i => i.account.type === 'REVENUE' && !i.account.code.startsWith('49'));
    const despesas  = data.filter(i => i.account.type === 'EXPENSE' && !i.account.code.startsWith('49'));

    // Calcular valor correto por natureza
    const val = (item: DREItem) => item.account.nature === 'CREDIT' ? Math.abs(item.currentBalance) : -Math.abs(item.currentBalance);
    const valTotal = (items: DREItem[]) => items.filter(i => i.account.level === 1).reduce((s, i) => s + val(i), 0);

    const totalReceitas = valTotal(receitas);
    const totalDespesas = valTotal(despesas);
    const resultado = totalReceitas + totalDespesas;

    const DRERow = ({ item, depth = 0 }: { item: DREItem; depth?: number }) => {
        const v = val(item);
        return (
            <tr>
                <td style={{ paddingLeft: 8 + depth * 16, fontSize: 12, color: item.account.isAnalytic ? '#374151' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <span style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: 11, marginRight: 8 }}>{item.account.code}</span>
                    {item.account.name}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: v < 0 ? '#B91C1C' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700 }}>
                    {item.account.isAnalytic ? fmtNum(v) : ''}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: v < 0 ? '#B91C1C' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700 }}>
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
            return "<tr><td style='padding-left:8px;font-weight:" + (item.account.isAnalytic ? 400 : 700) + "'>" +
                "<span style='font-family:monospace;color:#888;font-size:9pt;margin-right:6px'>" + item.account.code + "</span>" +
                item.account.name + "</td>" +
                "<td class='num' style='color:" + (v < 0 ? '#B91C1C' : '#000') + "'>" + (item.account.isAnalytic ? fmtNum(v) : '') + "</td>" +
                "<td class='num' style='font-weight:700;color:" + (v < 0 ? '#B91C1C' : '#000') + "'>" + (!item.account.isAnalytic ? fmtNum(v) : '') + "</td></tr>";
        }).join('');

        const css = "@page{size:A4 portrait;margin:12mm 14mm}" +
            "body{font-family:Arial,sans-serif;font-size:9pt;color:#000}" +
            "h2{font-size:11pt;margin:0}" +
            ".header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}" +
            "table{width:100%;border-collapse:collapse;font-size:9pt}" +
            "th{padding:4px 6px;border-bottom:1px solid #000;border-top:1px solid #000;font-weight:700;font-size:8pt;text-transform:uppercase}" +
            "td{padding:2px 6px;border-bottom:0.5px solid #eee}" +
            ".num{text-align:right;font-family:monospace;white-space:nowrap}" +
            ".section{background:#F3F4F6;font-weight:700;padding:4px 6px}" +
            ".total{border-top:2px solid #000;font-weight:700;background:#E5E7EB}" +
            ".resultado{border-top:2px solid #000;font-weight:700;font-size:10pt;background:" + (resultado >= 0 ? '#F0FDF4' : '#FEF2F2') + "}";

        const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>DRE - " + empresa + "</title><style>" + css + "</style></head><body>" +
            "<div class='header'>" +
            "<div><h2>" + empresa + "</h2><p style='margin:2px 0;font-size:8pt'>CNPJ: " + cnpj + "</p></div>" +
            "<div style='text-align:center'><h2>DEMONSTRACAO DO RESULTADO DO EXERCICIO</h2><p style='margin:2px 0;font-size:9pt'>Periodo: " + periodo + "</p></div>" +
            "<div style='text-align:right;font-size:8pt'>Emissao: " + hoje + "</div>" +
            "</div>" +
            "<table><thead><tr><th>Conta / Descricao</th><th class='num'>Parcial</th><th class='num'>Total</th></tr></thead><tbody>" +
            "<tr class='section'><td colspan='3'>RECEITAS</td></tr>" +
            buildRows(receitas) +
            "<tr class='total'><td colspan='2'>TOTAL DAS RECEITAS</td><td class='num'>" + fmtNum(totalReceitas) + "</td></tr>" +
            "<tr class='section'><td colspan='3'>DESPESAS</td></tr>" +
            buildRows(despesas) +
            "<tr class='total'><td colspan='2'>TOTAL DAS DESPESAS</td><td class='num'>" + fmtNum(totalDespesas) + "</td></tr>" +
            "<tr class='resultado'><td colspan='2'>" + (resultado >= 0 ? 'LUCRO' : 'PREJUIZO') + " DO EXERCICIO</td><td class='num'>" + fmtNum(Math.abs(resultado)) + "</td></tr>" +
            "</tbody></table>" +
            "<script>window.onload=function(){window.print();}<\/script>" +
            "</body></html>";

        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    return (
        <div style={{ padding: 24, background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>
            <ReportToolbar
                title="DRE"
                dateFrom={dateFrom}
                dateTo={dateTo}
                count={generated ? data.filter(i => i.account.type === 'REVENUE' || i.account.type === 'EXPENSE').length : undefined}
                countLabel="contas"
                onPeriodChange={(from, to) => { setDateFrom(from); setDateTo(to); load(from, to); }}
                onFilter={() => load(dateFrom, dateTo)}
                filterLabel="Gerar DRE"
                onPrint={generated ? printDRE : undefined}
                hasData={generated}
            />

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                    <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando...</span>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                    <FiAlertCircle size={14} /> {error}
                </div>
            ) : generated && (
                <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{activeCompany?.legalName || activeCompany?.tradeName}</div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>CNPJ: {fmtCnpj(activeCompany?.taxId || '')} &nbsp;|&nbsp; Periodo: {dateFrom.split('-').reverse().join('/')} a {dateTo.split('-').reverse().join('/')}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>DRE — DEMONSTRACAO DO RESULTADO</div>
                    </div>

                    <div style={{ padding: '0 24px 24px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                            <thead>
                                <tr style={{ background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Conta / Descricao</th>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 110 }}>Parcial</th>
                                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 110 }}>Total</th>
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
            )}
        </div>
    );
};

export default DrePage;
