// frontend/src/pages/accounting/BalancoPatrimonialPage.tsx
import React, { useState, useCallback } from 'react';
import { FiLoader, FiAlertCircle, FiPrinter } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

interface Account { id: string; code: string; name: string; type: string; nature: string; isAnalytic: boolean; level: number; }
interface BPItem { account: Account; previousBalance: number; debits: number; credits: number; currentBalance: number; children?: BPItem[]; }

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

const BalancoPatrimonialPage: React.FC = () => {
    const { activeCompany } = useCompany();
    const yr = getActiveYear();
    const [dateFrom, setDateFrom] = useState(yr + '-01-01');
    const [dateTo, setDateTo] = useState(yr + '-12-31');
    const [data, setData] = useState<BPItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generated, setGenerated] = useState(false);
    React.useEffect(() => { setData([]); setGenerated(false); }, [activeCompany?.id]);

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

    // Filtrar por tipo de conta
    const ativo     = data.filter(i => i.account.type === 'ASSET');
    const passivo   = data.filter(i => i.account.type === 'LIABILITY');
    const pl        = data.filter(i => i.account.type === 'EQUITY');

    const totalAtivo   = ativo.filter(i => i.account.level === 1).reduce((s, i) => s + i.currentBalance, 0);
    const totalPassivo = passivo.filter(i => i.account.level === 1).reduce((s, i) => s + Math.abs(i.currentBalance), 0);
    const totalPL      = pl.filter(i => i.account.level === 1).reduce((s, i) => s + Math.abs(i.currentBalance), 0);
    const totalPasivoPL = totalPassivo + totalPL;

    const BPRow = ({ item, depth = 0 }: { item: BPItem; depth?: number }) => (
        <tr>
            <td style={{ paddingLeft: 8 + depth * 16, fontSize: 12, color: item.account.isAnalytic ? '#374151' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6' }}>
                <span style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: 11, marginRight: 8 }}>{item.account.code}</span>
                {item.account.name}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: item.currentBalance < 0 ? '#B91C1C' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700 }}>
                {item.account.isAnalytic ? fmtNum(item.account.nature === 'CREDIT' ? Math.abs(item.currentBalance) : item.currentBalance) : ''}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, padding: '3px 8px', borderBottom: '0.5px solid #F3F4F6', color: item.currentBalance < 0 ? '#B91C1C' : '#111', fontWeight: item.account.isAnalytic ? 400 : 700 }}>
                {!item.account.isAnalytic ? fmtNum(item.account.nature === 'CREDIT' ? Math.abs(item.currentBalance) : item.currentBalance) : ''}
            </td>
        </tr>
    );

    const printBP = () => {
        if (!generated || !activeCompany) return;
        const empresa = activeCompany.legalName || activeCompany.tradeName || '';
        const cnpj = fmtCnpj(activeCompany.taxId || '');
        const hoje = new Date().toLocaleDateString('pt-BR');
        const dataBase = dateTo.split('-').reverse().join('/');

        const buildRows = (items: BPItem[], depth: number): string => items.map(item => {
            const pad = depth * 12;
            const bal = fmtNum(item.account.nature === 'CREDIT' ? Math.abs(item.currentBalance) : item.currentBalance);
            return "<tr>" +
                "<td style='padding-left:" + (8 + pad) + "px;font-weight:" + (item.account.isAnalytic ? 400 : 700) + "'>" +
                "<span style='font-family:monospace;color:#888;font-size:9pt;margin-right:6px'>" + item.account.code + "</span>" +
                item.account.name + "</td>" +
                "<td class='num'>" + (item.account.isAnalytic ? bal : '') + "</td>" +
                "<td class='num'><b>" + (!item.account.isAnalytic ? bal : '') + "</b></td>" +
                "</tr>";
        }).join('');

        const ativoRows = buildRows(ativo, 0);
        const passivoRows = buildRows(passivo, 0);
        const plRows = buildRows(pl, 0);

        const css = "@page{size:A4 portrait;margin:12mm 14mm}" +
            "body{font-family:Arial,sans-serif;font-size:9pt;color:#000}" +
            "h2{font-size:11pt;margin:0}" +
            ".header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}" +
            "table{width:100%;border-collapse:collapse;font-size:9pt}" +
            "th{padding:4px 6px;border-bottom:1px solid #000;border-top:1px solid #000;font-weight:700;font-size:8pt;text-transform:uppercase}" +
            "td{padding:2px 6px;border-bottom:0.5px solid #eee}" +
            ".num{text-align:right;font-family:monospace;white-space:nowrap}" +
            ".section{background:#F3F4F6;font-weight:700;padding:4px 6px;font-size:9pt}" +
            ".total{border-top:2px solid #000;font-weight:700;background:#E5E7EB}" +
            ".two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}";

        const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>BP - " + empresa + "</title><style>" + css + "</style></head><body>" +
            "<div class='header'>" +
            "<div><h2>" + empresa + "</h2><p style='margin:2px 0;font-size:8pt'>CNPJ: " + cnpj + "</p></div>" +
            "<div style='text-align:center'><h2>BALANCO PATRIMONIAL</h2><p style='margin:2px 0;font-size:9pt'>Data-base: " + dataBase + "</p></div>" +
            "<div style='text-align:right;font-size:8pt'><div>Emissao: " + hoje + "</div></div>" +
            "</div>" +
            "<div class='two-col'>" +
            "<div><table><thead><tr><th colspan='3'>ATIVO</th></tr><tr><th>Conta</th><th class='num'>Parcial</th><th class='num'>Total</th></tr></thead><tbody>" +
            ativoRows +
            "<tr class='total'><td colspan='2'>TOTAL DO ATIVO</td><td class='num'>" + fmtNum(totalAtivo) + "</td></tr>" +
            "</tbody></table></div>" +
            "<div><table><thead><tr><th colspan='3'>PASSIVO + PATRIMONIO LIQUIDO</th></tr><tr><th>Conta</th><th class='num'>Parcial</th><th class='num'>Total</th></tr></thead><tbody>" +
            passivoRows +
            plRows +
            "<tr class='total'><td colspan='2'>TOTAL PASSIVO + PL</td><td class='num'>" + fmtNum(totalPasivoPL) + "</td></tr>" +
            "</tbody></table></div>" +
            "</div>" +
            "<script>window.onload=function(){window.print();}<\/script>" +
            "</body></html>";

        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    return (
        <div style={{ padding: 24, background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>
            <ReportToolbar
                title="Balanco Patrimonial"
                dateFrom={dateFrom}
                dateTo={dateTo}
                count={generated ? data.length : undefined}
                countLabel="contas"
                onPeriodChange={(from, to) => { setDateFrom(from); setDateTo(to); load(from, to); }}
                onFilter={() => load(dateFrom, dateTo)}
                filterLabel="Gerar BP"
                onPrint={generated ? printBP : undefined}
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
                            <div style={{ fontSize: 11, color: '#6B7280' }}>CNPJ: {fmtCnpj(activeCompany?.taxId || '')} &nbsp;|&nbsp; Data-base: {dateTo.split('-').reverse().join('/')}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>BALANCO PATRIMONIAL</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                        {/* ATIVO */}
                        <div style={{ borderRight: '1px solid #E5E7EB' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#EFF6FF' }}>
                                        <th colSpan={3} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#1D4ED8', borderBottom: '1px solid #BFDBFE' }}>ATIVO</th>
                                    </tr>
                                    <tr style={{ background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Conta</th>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 90 }}>Parcial</th>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 90 }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ativo.map(item => <BPRow key={item.account.id} item={item} />)}
                                    <tr style={{ background: '#EFF6FF', borderTop: '1px solid #1D4ED8' }}>
                                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 12 }}>TOTAL DO ATIVO</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#1D4ED8' }}>{fmtNum(totalAtivo)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* PASSIVO + PL */}
                        <div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#F5F3FF' }}>
                                        <th colSpan={3} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid #DDD6FE' }}>PASSIVO + PATRIMONIO LIQUIDO</th>
                                    </tr>
                                    <tr style={{ background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Conta</th>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 90 }}>Parcial</th>
                                        <th style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: '#6B7280', textAlign: 'right', width: 90 }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {passivo.map(item => <BPRow key={item.account.id} item={item} />)}
                                    {pl.length > 0 && (
                                        <tr style={{ background: '#F5F3FF' }}>
                                            <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#7C3AED', borderTop: '1px solid #DDD6FE', borderBottom: '1px solid #DDD6FE' }}>PATRIMONIO LIQUIDO</td>
                                        </tr>
                                    )}
                                    {pl.map(item => <BPRow key={item.account.id} item={item} />)}
                                    <tr style={{ background: '#F5F3FF', borderTop: '1px solid #7C3AED' }}>
                                        <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, fontSize: 12 }}>TOTAL PASSIVO + PL</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '6px 8px', color: '#7C3AED' }}>{fmtNum(totalPasivoPL)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Equilibrio */}
                    <div style={{ padding: '8px 16px', background: Math.abs(totalAtivo - totalPasivoPL) < 0.01 ? '#F0FDF4' : '#FEF2F2', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 12 }}>
                        <span>Total Ativo: <b style={{ fontFamily: 'monospace' }}>{fmtNum(totalAtivo)}</b></span>
                        <span>Total Passivo + PL: <b style={{ fontFamily: 'monospace' }}>{fmtNum(totalPasivoPL)}</b></span>
                        <span style={{ fontWeight: 700, color: Math.abs(totalAtivo - totalPasivoPL) < 0.01 ? '#16A34A' : '#DC2626' }}>
                            {Math.abs(totalAtivo - totalPasivoPL) < 0.01 ? 'EQUILIBRADO' : 'DIFERENCA: ' + fmtNum(Math.abs(totalAtivo - totalPasivoPL))}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BalancoPatrimonialPage;


