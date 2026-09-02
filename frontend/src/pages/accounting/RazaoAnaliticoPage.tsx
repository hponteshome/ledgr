// frontend/src/pages/accounting/RazaoAnaliticoPage.tsx

import React, { useState, useCallback } from 'react';
import { FiSearch, FiLoader, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

// ── Tipos ──────────────────────────────────────────────────────
interface AccountInfo {
    id: string; code: string; name: string;
    type: string; nature: string; level: number;
    isAnalytic: boolean;
    reducedCode?: string;
}
interface JournalItem {
    accountId: string; account?: AccountInfo;
    value: number; type: 'DEBIT' | 'CREDIT';
}
interface JournalEntry {
    id: string; date: string; description: string;
    reference?: string; sourceModule: string;
    items: JournalItem[];
}
interface BalanceRow {
    account: AccountInfo;
    previousBalance: number;
    debits: number;
    credits: number;
    currentBalance: number;
}
interface ReportData {
    startDate: string;
    endDate: string;
    balances: BalanceRow[];
}

// ── Helpers ────────────────────────────────────────────────────
const parseDate = (d: string) => {
    const s = d.substring(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    return { y, m, day };
};
const fmtDateFull = (d: string) => {
    const { y, m, day } = parseDate(d);
    return `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};
const fmtCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, '');
    return d.length === 14
        ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
        : cnpj;
};
const fmtNum = (v: number, dash = false): string => {
    if (v === 0) return dash ? '' : '0,00';
    return Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtSaldo = (v: number): string => {
    if (v === 0) return '0,00';
    const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${s})` : s;
};

const getActiveYear = () => {
    try {
        const saved = localStorage.getItem('@ledgr:activeMonth');
        if (saved) return new Date(saved).getFullYear();
    } catch {}
    return new Date().getFullYear();
};
const yr = getActiveYear();
const DEF = {
    startDate: yr + '-01-01',
    endDate: yr + '-12-31',
    filterMode: 'all' as 'all' | 'one' | 'range' | 'list',
    accountFrom: '',
    accountTo: '',
    accountList: '',
    reducedFrom: '',
    reducedTo: '',
    showZero: false,
};
type F = typeof DEF;

// Sequencial por mês
const buildSeqMap = (entries: JournalEntry[]): Map<string, string> => {
    const map = new Map<string, string>();
    const mc = new Map<string, number>();
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
        const m = e.date.substring(0, 7);
        const n = (mc.get(m) ?? 0) + 1; mc.set(m, n);
        map.set(e.id, String(n).padStart(4, '0'));
    });
    return map;
};







// ── Modal de filtros ───────────────────────────────────────────
const FilterModal: React.FC<{ f: F; onApply: (f: F) => void }> = ({ f: init, onApply }) => {
    const [f, setF] = useState<F>({ ...init });
    const s = (p: Partial<F>) => setF(prev => ({ ...prev, ...p }));
    const inp: React.CSSProperties = {
        height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6,
        padding: '0 10px', fontSize: 13, width: '100%', outline: 'none', background: '#fff',
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>◆ Contábil</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Razão Analítico — Parâmetros de Emissão</span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Período</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data inicial</label>
                                <SmartDateInput value={f.startDate} onChange={v => s({ startDate: v })} style={inp} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data final</label>
                                <SmartDateInput value={f.endDate} onChange={v => s({ endDate: v })} style={inp} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Seleção de contas</p>
                        <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 4 }}>Filtrar por</label>
                            <select value={f.filterMode} onChange={e => s({ filterMode: e.target.value as any })} style={inp}>

                                <option value="all">Todas as contas analíticas</option>
                                <option value="one">Apenas uma conta</option>
                                <option value="range">Faixa de contas</option>
                                <option value="list">Lista de contas (separe por ;)</option>
                            </select>
                        </div>
                        {(f.filterMode === 'one' || f.filterMode === 'range' || f.filterMode === 'list') && (
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                                        {f.filterMode === 'list' ? 'Contas (separadas por ;)' : f.filterMode === 'range' ? 'Conta (de)' : 'Conta'}
                                    </label>
                                    {f.filterMode === 'list' ? (
                                        <textarea value={f.accountList} onChange={e => s({ accountList: e.target.value })} placeholder='Ex: 11102010001;11104030002' style={{ ...inp, height: 60, resize: 'vertical' as any }} />
                                    ) : (
                                        <input type='text' value={f.accountFrom} placeholder='Ex: 1.1.4.01.001' onChange={e => s({ accountFrom: e.target.value })} style={inp} />
                                    )}
                                </div>
                                {f.filterMode === 'range' && (
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 4 }}>Conta (até)</label>
                                        <input type='text' value={f.accountTo} placeholder='Ex: 2.9.9.99' onChange={e => s({ accountTo: e.target.value })} style={inp} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Opções</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12, background: '#F9FAFB', borderRadius: 6, border: '0.5px solid #E5E7EB' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                                <input type="checkbox" checked={f.showZero} onChange={e => s({ showZero: e.target.checked })} style={{ accentColor: '#2563EB' }} />
                                Listar contas sem movimento
                            </label>
                        </div>
                    </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => onApply(f)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#111', fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
                        <FiSearch size={13} /> Gerar Razão
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Página ─────────────────────────────────────────────────────
const RazaoAnaliticoPage: React.FC = () => {
    const { activeCompany } = useCompany();
    const [filters, setFilters] = useState<F>(() => { const yr = getActiveYear(); return { ...DEF, startDate: yr + '-01-01', endDate: yr + '-12-31' }; });
    const f = filters;
    const [showModal, setShowModal] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    React.useEffect(() => { if (activeCompany) { setReportData(null); setShowModal(true); } }, [activeCompany?.id]);
    const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // ── Load exclusivamente baseado em lançamentos ─────────────
    const load = useCallback(async (f: F) => {
        if (!activeCompany) return;
        setLoading(true); setError(''); setReportData(null);
        try {
            // Busca todos os lançamentos desde o início até o fim do período
            // para calcular saldo anterior (antes de startDate) e movimentos do período
            let allJournal: JournalEntry[] = [];
            let pg = 1;
            while (true) {
                const r = await api.get('/accounting/journal', {
                    params: { dateFrom: '1900-01-01', dateTo: f.endDate, page: pg, limit: 500 },
                });
                allJournal = [...allJournal, ...(r.data.entries || [])];
                if (pg >= r.data.pages) break;
                pg++;
            }

            // Separa lançamentos antes e dentro do período
            const beforePeriod = allJournal.filter(e => e.date.substring(0, 10) < f.startDate);
            const inPeriod = allJournal.filter(e => e.date.substring(0, 10) >= f.startDate);

            // Acumula por conta
            const accMap = new
                Map<string, {
                    account: AccountInfo;
                    prevD: number; prevC: number;
                    perD: number; perC: number;
                }>();

            const accumulate = (entries: JournalEntry[], field: 'prev' | 'per') => {
                // LOG 1: Ver se as entradas de 2014 realmente chegaram no front-end
                if (field === 'prev') {
                    console.log(`[SALDO ANTERIOR] Processando ${entries.length} lançamentos de períodos passados.`);
                }
                entries.forEach(entry => {
                    entry.items.forEach(item => {
                        if (!item.account) return;
                        if (!accMap.has(item.accountId)) {
                            accMap.set(item.accountId, {
                                account: item.account,
                                prevD: 0, prevC: 0, perD: 0, perC: 0,
                            });
                        }
                        const acc = accMap.get(item.accountId)!;
                        if (field === 'prev') {
                            if (item.type === 'DEBIT') acc.prevD += Number(item.value);
                            else acc.prevC += Number(item.value);
                        } else {
                            if (item.type === 'DEBIT') acc.perD += Number(item.value);
                            else acc.perC += Number(item.value);
                        }
                    });
                });
            };

            accumulate(beforePeriod, 'prev');
            accumulate(inPeriod, 'per');

            // Converte para BalanceRow — só contas analíticas
            const balances: BalanceRow[] = Array.from(accMap.values())

                .filter(a => a.account.isAnalytic === true)
                .map(({ account, prevD, prevC, perD, perC }) => {
                    const previousBalance = account.nature === 'DEBIT'
                        ? prevD - prevC
                        : prevC - prevD;
                    const currentBalance = account.nature === 'DEBIT'
                        ? (prevD + perD) - (prevC + perC)
                        : (prevC + perC) - (prevD + perD);
                    return { account, previousBalance, debits: perD, credits: perC, currentBalance };
                })
                .filter(r => f.showZero || r.debits !== 0 || r.credits !== 0)
                .sort((a, b) => a.account.code.localeCompare(b.account.code));

            setReportData({ startDate: f.startDate, endDate: f.endDate, balances });
            setAllEntries(inPeriod);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao carregar.');
        } finally { setLoading(false); }
    }, [activeCompany]);

    const handleApply = (f: F) => { setFilters(f); setShowModal(false); load(f); };

    // Filtro local por conta/nome
    const rows = React.useMemo((): BalanceRow[] => {
        if (!reportData?.balances) return [];
        let list = [...reportData.balances];

        if (filters.filterMode === 'one' && filters.accountFrom)
            list = list.filter(r => r.account.code === filters.accountFrom);
        else if (filters.filterMode === 'list' && filters.accountList) {
            const codes = filters.accountList.split(';').map((c: string) => c.trim()).filter(Boolean);
            list = list.filter(r => codes.some((c: string) => r.account.code === c || r.account.reducedCode === c));
        }
        else if (filters.filterMode === 'range' && filters.accountFrom)
            list = list.filter(r =>
                r.account.code >= filters.accountFrom &&
                (!filters.accountTo || r.account.code <= filters.accountTo)
            );

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r =>
                r.account.code.toLowerCase().includes(q) ||
                r.account.name.toLowerCase().includes(q)
            );
        }
        return list;
    }, [reportData, filters, searchTerm]);

    // Mapa: accountId → lançamentos do período ordenados por data
    const entriesByAccount = React.useMemo(() => {
        const map = new Map<string, JournalEntry[]>();
        allEntries.forEach(entry => {
            const seen = new Set<string>();
            entry.items.forEach(item => {
                if (seen.has(item.accountId)) return;
                seen.add(item.accountId);
                if (!map.has(item.accountId)) map.set(item.accountId, []);
                map.get(item.accountId)!.push(entry);
            });
        });
        map.forEach((entries, key) => {
            map.set(key, [...entries].sort((a, b) => a.date.localeCompare(b.date)));
        });
        return map;
    }, [allEntries]);

    const seqMap = React.useMemo(() => buildSeqMap(allEntries), [allEntries]);

    // Totais gerais
    const totPrev = rows.reduce((s, r) => s + r.previousBalance, 0);
    const totD = rows.reduce((s, r) => s + r.debits, 0);
    const totC = rows.reduce((s, r) => s + r.credits, 0);
    const totFin = rows.reduce((s, r) => s + r.currentBalance, 0);

    const printLivroRazao = () => {
        if (!reportData || !activeCompany) return;
        const empresa = activeCompany.legalName || activeCompany.tradeName || '';
        const cnpj = (activeCompany.taxId || '').replace(/\D/g,'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
        const periodo = filters.startDate.split('-').reverse().join('/') + ' a ' + filters.endDate.split('-').reverse().join('/');
        const hoje = new Date().toLocaleDateString('pt-BR');
        const hora = new Date().toLocaleTimeString('pt-BR');

        let body = '';
        rows.forEach(function(row) {
            const a = row.account;
            const accountEntries = entriesByAccount.get(a.id) || [];
            let saldo = row.previousBalance;

            body += "<div class='conta-bloco'>";
            body += "<div class='conta-header'>";
            body += "<div class='conta-info'>";
            body += "<span class='conta-code'>" + a.code + "</span>";
            if (a.reducedCode) body += "<span class='conta-red'>" + a.reducedCode + "</span>";
            body += "<span class='conta-name'>" + a.name + "</span>";
            body += "</div>";
            body += "<div class='saldo-anterior'>Saldo Anterior: <b>" + fmtSaldo(row.previousBalance) + "</b></div>";
            body += "</div>";

            if (accountEntries.length === 0) {
                body += "<div class='sem-movimento'>Sem movimentos no período</div>";
            } else {
                body += "<table><thead><tr><th class='w90'>Data</th><th>Histórico</th><th class='w80'>Lcto</th><th class='num w100'>Débito</th><th class='num w100'>Crédito</th><th class='num w110'>Saldo</th></tr></thead><tbody>";
                accountEntries.forEach(function(entry) {
                    const items = entry.items.filter(function(i) { return i.accountId === a.id; });
                    items.forEach(function(item) {
                        const val = Number(item.value);
                        const isD = item.type === 'DEBIT';
                        const nature = a.nature === 'DEBIT' ? 1 : -1;
                        saldo += (isD ? val : -val) * nature;
                        body += "<tr>";
                        body += "<td>" + entry.date.substring(0,10).split('-').reverse().join('/') + "</td>";
                        body += "<td class='hist'>" + (entry.description || '').substring(0,60) + "</td>";
                        body += "<td>" + (entry.reference || '') + "</td>";
                        body += "<td class='num'>" + (isD ? fmtSaldo(val) : '') + "</td>";
                        body += "<td class='num'>" + (!isD ? fmtSaldo(val) : '') + "</td>";
                        body += "<td class='num saldo-" + (saldo < 0 ? 'neg' : 'pos') + "'>" + fmtSaldo(saldo) + "</td>";
                        body += "</tr>";
                    });
                });
                body += "</tbody></table>";
            }

            body += "<div class='conta-footer'>";
            body += "<span>Débitos: <b>" + fmtSaldo(row.debits) + "</b></span>";
            body += "<span>Créditos: <b>" + fmtSaldo(row.credits) + "</b></span>";
            body += "<span>Saldo Final: <b>" + fmtSaldo(row.currentBalance) + "</b></span>";
            body += "</div>";
            body += "</div>";
        });

        const css =
            "@page{size:A4 portrait;margin:12mm 14mm}" +
            "body{font-family:Arial,sans-serif;font-size:9pt;color:#111;margin:0}" +
            ".header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:10px}" +
            ".header-left h2{margin:0;font-size:11pt}" +
            ".header-left p{margin:2px 0;font-size:8pt;color:#555}" +
            ".header-center{text-align:center;font-size:13pt;font-weight:700;letter-spacing:1px}" +
            ".header-right{text-align:right;font-size:8pt;color:#555}" +
            ".periodo{font-size:9pt;font-weight:600;border-bottom:0.5px solid #ccc;padding-bottom:4px;margin-bottom:8px}" +
            ".conta-bloco{margin-bottom:12px;page-break-inside:avoid}" +
            ".conta-header{display:flex;justify-content:space-between;align-items:baseline;background:#F3F4F6;border-top:1px solid #374151;border-bottom:0.5px solid #D1D5DB;padding:3px 6px}" +
            ".conta-info{display:flex;align-items:baseline;gap:10px}" +
            ".conta-code{font-family:monospace;font-size:9pt;color:#1D4ED8;font-weight:700}" +
            ".conta-red{font-family:monospace;font-size:8pt;color:#6B7280;background:#E5E7EB;padding:0 4px;border-radius:3px}" +
            ".conta-name{font-size:9pt;font-weight:600;color:#111}" +
            ".saldo-anterior{font-size:9pt;color:#374151;white-space:nowrap}" +
            ".sem-movimento{color:#9CA3AF;font-style:italic;font-size:8pt;padding:4px 6px}" +
            "table{width:100%;border-collapse:collapse;font-size:8pt}" +
            "th{padding:3px 5px;border-bottom:1px solid #111;text-align:left;font-weight:700;font-size:8pt}" +
            "td{padding:2px 5px;border-bottom:0.5px solid #F3F4F6}" +
            ".num{text-align:right;font-family:monospace}" +
            ".w90{width:70px}.w80{width:70px}.w100{width:85px}.w110{width:90px}" +
            ".hist{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
            ".saldo-neg{color:#B91C1C}" +
            ".saldo-pos{color:#111}" +
            ".conta-footer{display:flex;gap:20px;justify-content:flex-end;padding:3px 6px;font-size:8pt;border-top:1px solid #374151;background:#F9FAFB}" +
            ".totais{margin-top:10px;border-top:2px solid #111;padding-top:6px;display:flex;gap:20px;justify-content:flex-end;font-size:9pt}";

        const html =
            "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'/>" +
            "<title>Razao Analitico - " + empresa + "</title>" +
            "<style>" + css + "</style></head><body>" +
            "<div class='header'>" +
            "<div class='header-left'><h2>" + empresa + "</h2><p>CNPJ: " + cnpj + "</p></div>" +
            "<div class='header-center'>Razão Analítico</div>" +
            "<div class='header-right'><div>Data: " + hoje + "</div><div>Hora: " + hora + "</div></div>" +
            "</div>" +
            "<div class='periodo'>Período: " + periodo + " · " + rows.length + " contas</div>" +
            body +
            "<div class='totais'>" +
            "<span>Total Débitos: <b>" + fmtSaldo(totD) + "</b></span>" +
            "<span>Total Créditos: <b>" + fmtSaldo(totC) + "</b></span>" +
            "</div>" +
            "<script>window.onload=function(){window.print();}<\/script>" +
            "</body></html>";

        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const exportCSV = () => {
        const lines = [['Conta', 'Red.', 'Nome', 'Saldo Anterior', 'Data', 'Histórico', 'Lcto', 'Débito', 'Crédito', 'Saldo']];
        rows.forEach(row => {
            const a = row.account;
            const accountEntries = entriesByAccount.get(a.id) || [];
            let saldo = row.previousBalance;
            lines.push([a.code, '—', `"${a.name}"`, fmtSaldo(row.previousBalance), '', '', '', '', '', '']);
            accountEntries.forEach(entry => {
                const items = entry.items.filter(i => i.accountId === a.id);
                items.forEach(item => {
                    const d = item.type === 'DEBIT' ? Number(item.value) : 0;
                    const c = item.type === 'CREDIT' ? Number(item.value) : 0;
                    saldo = a.nature === 'DEBIT' ? saldo + d - c : saldo - d + c;
                    lines.push(['', '', '', '', fmtDateFull(entry.date), `"${entry.description}"`, seqMap.get(entry.id) || '', fmtNum(d, true), fmtNum(c, true), fmtSaldo(saldo)]);
                });
            });
            lines.push(['', '', '', 'Total da Conta:', '', '', '', fmtNum(row.debits), fmtNum(row.credits), fmtSaldo(row.currentBalance)]);
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(l => l.join('|')).join('\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = `RazaoAnalitico_${filters.startDate}_${filters.endDate}.csv`;
        a.click();
    };

    const TD: React.CSSProperties = {
        padding: '2px 6px', fontSize: 13, color: '#111',
        borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top', lineHeight: '1.4',
    };

    return (
        <div style={{ padding: 24, background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>

            {/* Modal — abre na primeira visita */}
            {showModal && <FilterModal f={filters} onApply={handleApply} />}

            {/* Toolbar flutuante */}
            <ReportToolbar
                title="Razão Analítico"
                dateFrom={filters.startDate}
                dateTo={filters.endDate}
                count={rows.length}
                countLabel="contas"
                onPeriodChange={(from, to) => {
                    const f = { ...filters, startDate: from, endDate: to };
                    setFilters(f);
                    load(f);
                }}
                onFilter={() => setShowModal(true)}
                onPrint={printLivroRazao}
                onExportCSV={reportData ? exportCSV : undefined}
                hasData={!!reportData}
            />

            {/* Busca de conta */}
            {reportData && (
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative' }}>
                        <FiSearch size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filtrar por código ou nome da conta..."
                            style={{ height: 32, border: '0.5px solid #E5E7EB', borderRadius: 8, paddingLeft: 28, paddingRight: 12, fontSize: 13, width: 300, outline: 'none', background: '#fff' }} />
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                    <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando razão analítico...</span>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                    <FiAlertCircle size={14} /> {error}
                </div>
            ) : reportData && rows.length > 0 ? (
                <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '20px 28px', overflowX: 'auto' }}>

                        {/* Cabeçalho do relatório */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{activeCompany?.legalName || activeCompany?.tradeName}</div>
                                    <div style={{ fontSize: 18, color: '#9CA3AF', fontFamily: 'monospace' }}>CNPJ: {fmtCnpj(activeCompany?.taxId || '')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>Razão Analítico</div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 16, color: '#6B7280', lineHeight: 1.6 }}>
                                    <div>Data: {new Date().toLocaleDateString('pt-BR')}</div>
                                    <div>Hora: {new Date().toLocaleTimeString('pt-BR')}</div>
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '4px 0', display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                                <span>Consolidação: Empresa</span>
                                <span>Periodo: {fmtDateFull(filters.startDate)} a {fmtDateFull(filters.endDate)}</span>
                            </div>
                        </div>

                        {/* Cabeçalho das colunas */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18, marginBottom: 8 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #374151' }}>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left', width: 90 }}>Data</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left' }}>Histórico</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left', width: 80 }}>Lote/Lcto.</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 100 }}>Débito</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 100 }}>Crédito</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 110 }}>Saldo</th>
                                </tr>
                            </thead>
                        </table>

                        {/* Contas */}
                        {rows.map(row => {
                            const a = row.account;
                            const accountEntries = entriesByAccount.get(a.id) || [];
                            let saldo = row.previousBalance;

                            return (
                                <div key={a.id} style={{ marginBottom: 16 }}>
                                    {/* Cabeçalho da conta */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                        borderTop: '0.5px solid #374151', borderBottom: '0.5px solid #E5E7EB',
                                        padding: '4px 6px', background: '#FAFAFA',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 15, fontSize: 15, fontWeight: 700, color: '#111' }}>
                                            <span>Conta: <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#1D4ED8' }}>{a.code}</span></span>
                                            <span style={{ fontWeight: 400, fontSize: 15, color: '#6B7280' }}>Red.: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{a.reducedCode || '—'}</span></span>
                                            <span style={{ fontWeight: 600, fontSize: 15, color: '#374151' }}>{a.name}</span>
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                                            Saldo Anterior:&nbsp;
                                            <span style={{ fontFamily: 'monospace', color: row.previousBalance < 0 ? '#B91C1C' : '#111' }}>
                                                {fmtSaldo(row.previousBalance)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lançamentos */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <tbody>
                                            {accountEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} style={{ ...TD, color: '#D1D5DB', fontStyle: 'italic', textAlign: 'center', padding: 6 }}>
                                                        Sem movimentos no período
                                                    </td>
                                                </tr>
                                            ) : accountEntries.map(entry => {
                                                const items = entry.items.filter(i => i.accountId === a.id);
                                                return items.map((item, itemIdx) => {
                                                    const d = item.type === 'DEBIT' ? Number(item.value) : 0;
                                                    const c = item.type === 'CREDIT' ? Number(item.value) : 0;
                                                    saldo = a.nature === 'DEBIT' ? saldo + d - c : saldo - d + c;
                                                    return (
                                                        <tr key={`${entry.id}-${itemIdx}`}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                            <td style={{ ...TD, width: 90, fontSize: 18, fontFamily: 'monospace', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                                                {fmtDateFull(entry.date)}
                                                            </td>
                                                            <td style={{ ...TD, fontSize: 18, color: '#374151' }}>
                                                                {entry.description}
                                                            </td>
                                                            <td style={{ ...TD, width: 80, fontSize: 16, fontFamily: 'monospace', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                                                {seqMap.get(entry.id) || ''}
                                                            </td>
                                                            <td style={{ ...TD, width: 100, textAlign: 'right', fontSize: 18, fontFamily: 'monospace', color: d > 0 ? '#111' : '#D1D5DB' }}>
                                                                {d > 0 ? fmtNum(d) : ''}
                                                            </td>
                                                            <td style={{ ...TD, width: 100, textAlign: 'right', fontSize: 18, fontFamily: 'monospace', color: c > 0 ? '#111' : '#D1D5DB' }}>
                                                                {c > 0 ? fmtNum(c) : ''}
                                                            </td>
                                                            <td style={{ ...TD, width: 110, textAlign: 'right', fontSize: 18, fontFamily: 'monospace', fontWeight: 500, color: saldo < 0 ? '#B91C1C' : '#111' }}>
                                                                {fmtSaldo(saldo)}
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '0.5px solid #374151' }}>
                                                <td colSpan={3} style={{ padding: '4px 6px', fontSize: 18, fontWeight: 700, color: '#374151', textAlign: 'right' }}>
                                                    Total da Conta:
                                                </td>
                                                <td style={{ padding: '4px 6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#111', width: 100 }}>
                                                    {fmtNum(row.debits)}
                                                </td>
                                                <td style={{ padding: '4px 6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#111', width: 100 }}>
                                                    {fmtNum(row.credits)}
                                                </td>
                                                <td style={{ padding: '4px 6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: row.currentBalance < 0 ? '#B91C1C' : '#111', width: 110 }}>
                                                    {fmtSaldo(row.currentBalance)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            );
                        })}

                        {/* Totais Gerais */}
                        <div style={{ borderTop: '2px solid #111', paddingTop: 8, marginTop: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '6px', fontSize: 13, fontWeight: 700, color: '#111', textAlign: 'right' }}>
                                            Totais Gerais · {rows.length} contas:
                                        </td>
                                        <td style={{ padding: '6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1D4ED8', width: 100 }}>
                                            {fmtNum(totD)}
                                        </td>
                                        <td style={{ padding: '6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#15803D', width: 100 }}>
                                            {fmtNum(totC)}
                                        </td>
                                        <td style={{ padding: '6px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: totFin < 0 ? '#B91C1C' : '#111', width: 110 }}>
                                            {fmtSaldo(totFin)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
            ) : reportData ? (
                <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
                    Nenhuma conta analítica com movimento no período selecionado.
                </div>
            ) : null}
        </div>
    );
};

export default RazaoAnaliticoPage;



