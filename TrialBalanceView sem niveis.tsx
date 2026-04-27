// frontend/src/pages/accounting/TrialBalanceView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    FiCalendar, FiSearch,
    FiRefreshCw, FiEye, FiEyeOff,
} from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;   // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    nature: string; // DEBIT | CREDIT
    level: number;
    parentId?: string;
}

interface MonthlyBalanceItem {
    account: Account;
    balance: number;
    referenceDate?: string;
    children?: MonthlyBalanceItem[];
    expanded?: boolean;
}

interface VerificationBalanceItem {
    account: Account;
    previousBalance: number;
    debits: number;
    credits: number;
    currentBalance: number;
    children?: VerificationBalanceItem[];
    expanded?: boolean;
}

interface SummaryData {
    [key: string]: number;
}

type ViewMode = 'monthly' | 'verification';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
    Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const typeLabel: Record<string, string> = {
    ASSET: 'Ativo',
    LIABILITY: 'Passivo',
    EQUITY: 'Patrimônio Líquido',
    REVENUE: 'Receita',
    EXPENSE: 'Despesa',
};

const typeColor: Record<string, string> = {
    ASSET: 'text-blue-600',
    LIABILITY: 'text-orange-600',
    EQUITY: 'text-purple-600',
    REVENUE: 'text-green-600',
    EXPENSE: 'text-red-600',
};

const convertToISODate = (displayDate: string): string => {
    const [day, month, year] = displayDate.split('/');
    return `${year}-${month}-${day}`;
};

const dateOptions = [
    { display: '31/10/2025', value: '2025-10-31', label: 'OUT/2025' },
    { display: '30/11/2025', value: '2025-11-30', label: 'NOV/2025' },
    { display: '31/12/2025', value: '2025-12-31', label: 'DEZ/2025' },
    { display: '31/01/2026', value: '2026-01-31', label: 'JAN/2026' },
    { display: '28/02/2026', value: '2026-02-28', label: 'FEV/2026' },
    { display: '31/03/2026', value: '2026-03-31', label: 'MAR/2026' },
];

// ─── Hierarchy builders ───────────────────────────────────────────────────────

function buildMonthlyHierarchy(items: MonthlyBalanceItem[]): MonthlyBalanceItem[] {
    const sorted = [...items].sort((a, b) => a.account.code.localeCompare(b.account.code));
    const map = new Map<string, MonthlyBalanceItem>();
    const roots: MonthlyBalanceItem[] = [];

    sorted.forEach(item => {
        map.set(item.account.id, { ...item, children: [], expanded: false });
    });

    sorted.forEach(item => {
        const node = map.get(item.account.id)!;
        const codeParts = item.account.code.split('.');
        if (codeParts.length > 1) {
            const parentCode = codeParts.slice(0, -1).join('.');
            const parentItem = sorted.find(i => i.account.code === parentCode);
            if (parentItem && map.has(parentItem.account.id)) {
                map.get(parentItem.account.id)!.children!.push(node);
                return;
            }
        }
        roots.push(node);
    });

    const sortChildren = (list: MonthlyBalanceItem[]) => {
        list.sort((a, b) => a.account.code.localeCompare(b.account.code));
        list.forEach(i => { if (i.children?.length) sortChildren(i.children); });
    };
    sortChildren(roots);
    return roots;
}

function buildVerificationHierarchy(items: VerificationBalanceItem[]): VerificationBalanceItem[] {
    const sorted = [...items].sort((a, b) => a.account.code.localeCompare(b.account.code));
    const map = new Map<string, VerificationBalanceItem>();
    const roots: VerificationBalanceItem[] = [];

    sorted.forEach(item => {
        map.set(item.account.id, { ...item, children: [], expanded: false });
    });

    sorted.forEach(item => {
        const node = map.get(item.account.id)!;
        const codeParts = item.account.code.split('.');
        if (codeParts.length > 1) {
            const parentCode = codeParts.slice(0, -1).join('.');
            const parentItem = sorted.find(i => i.account.code === parentCode);
            if (parentItem && map.has(parentItem.account.id)) {
                map.get(parentItem.account.id)!.children!.push(node);
                return;
            }
        }
        roots.push(node);
    });

    const sortChildren = (list: VerificationBalanceItem[]) => {
        list.sort((a, b) => a.account.code.localeCompare(b.account.code));
        list.forEach(i => { if (i.children?.length) sortChildren(i.children!); });
    };
    sortChildren(roots);
    return roots;
}

function expandToLevel<T extends { expanded?: boolean; children?: T[] }>(
    items: T[], targetLevel: number, currentLevel = 1
) {
    items.forEach(item => {
        item.expanded = currentLevel < targetLevel;
        // Sempre desce em todos os filhos para garantir reset completo
        if (item.children?.length) {
            expandToLevel(item.children, targetLevel, currentLevel + 1);
        }
    });
}

function deepExpandAll<T extends { expanded?: boolean; children?: T[] }>(items: T[]) {
    items.forEach(item => {
        item.expanded = true;
        if (item.children?.length) deepExpandAll(item.children);
    });
}

function deepCollapseAll<T extends { expanded?: boolean; children?: T[] }>(items: T[]) {
    items.forEach(item => {
        item.expanded = false;
        if (item.children?.length) deepCollapseAll(item.children);
    });
}

function filterMonthly(items: MonthlyBalanceItem[], term: string): MonthlyBalanceItem[] {
    if (!term) return items;
    return items.reduce<MonthlyBalanceItem[]>((acc, item) => {
        const matches =
            item.account.code.includes(term) ||
            item.account.name.toLowerCase().includes(term.toLowerCase());
        const filteredChildren = item.children?.length ? filterMonthly(item.children, term) : [];
        if (matches || filteredChildren.length > 0) {
            acc.push({ ...item, children: filteredChildren.length ? filteredChildren : item.children });
        }
        return acc;
    }, []);
}

function filterVerification(items: VerificationBalanceItem[], term: string): VerificationBalanceItem[] {
    if (!term) return items;
    return items.reduce<VerificationBalanceItem[]>((acc, item) => {
        const matches =
            item.account.code.includes(term) ||
            item.account.name.toLowerCase().includes(term.toLowerCase());
        const filteredChildren = item.children?.length ? filterVerification(item.children, term) : [];
        if (matches || filteredChildren.length > 0) {
            acc.push({ ...item, children: filteredChildren.length ? filteredChildren : item.children });
        }
        return acc;
    }, []);
}

// ─── Nature badge ─────────────────────────────────────────────────────────────

const NatureBadge: React.FC<{ nature: string }> = ({ nature }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${nature === 'DEBIT'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-emerald-50 text-emerald-700'
        }`}>
        {nature === 'DEBIT' ? 'Devedora' : 'Credora'}
    </span>
);

// ─── Main component ───────────────────────────────────────────────────────────

const TrialBalanceView: React.FC = () => {
    const { activeCompany } = useCompany();
    const { token } = useAuth();

    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [displayDate, setDisplayDate] = useState('31/01/2026');
    const [startDisplayDate, setStartDisplayDate] = useState('01/01/2026');
    const [endDisplayDate, setEndDisplayDate] = useState('31/01/2026');

    const [monthlyItems, setMonthlyItems] = useState<MonthlyBalanceItem[]>([]);
    const [verificationItems, setVerificationItems] = useState<VerificationBalanceItem[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPreviousBalance, setShowPreviousBalance] = useState(true);

    // ── Load monthly ──────────────────────────────────────────────────────────

    const loadMonthlyBalance = useCallback(async () => {
        if (!activeCompany) { setError('Nenhuma empresa selecionada'); return; }
        setLoading(true);
        setError(null);
        try {
            const isoDate = convertToISODate(displayDate);
            const response = await api.get('/accounting/trial-balance', {
                params: { date: isoDate },
                headers: { 'x-company-id': activeCompany.id, Authorization: `Bearer ${token}` },
            });

            const balances: MonthlyBalanceItem[] = response.data?.balances ?? [];

            if (balances.length > 0) {
                const hierarchy = buildMonthlyHierarchy(balances);
                setMonthlyItems(hierarchy);

                try {
                    const summaryRes = await api.get('/accounting/trial-balance/summary', {
                        params: { date: isoDate },
                        headers: { 'x-company-id': activeCompany.id, Authorization: `Bearer ${token}` },
                    });
                    setSummary(summaryRes.data?.summary ?? null);
                } catch {
                    setSummary(null);
                }
            } else {
                setMonthlyItems([]);
                setSummary(null);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar balancete mensal');
            setMonthlyItems([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [activeCompany, token, displayDate]);

    // ── Load verification ─────────────────────────────────────────────────────

    const loadVerificationBalance = useCallback(async () => {
        if (!activeCompany) { setError('Nenhuma empresa selecionada'); return; }
        setLoading(true);
        setError(null);
        try {
            const startISO = convertToISODate(startDisplayDate);
            const endISO = convertToISODate(endDisplayDate);

            const response = await api.get('/accounting/trial-balance/verification', {
                params: { startDate: startISO, endDate: endISO },
                headers: { 'x-company-id': activeCompany.id, Authorization: `Bearer ${token}` },
            });

            const items: VerificationBalanceItem[] = response.data?.balances ?? [];

            if (items.length > 0) {
                const hierarchy = buildVerificationHierarchy(items);
                setVerificationItems(hierarchy);

                try {
                    const summaryRes = await api.get('/accounting/trial-balance/summary', {
                        params: { date: endISO },
                        headers: { 'x-company-id': activeCompany.id, Authorization: `Bearer ${token}` },
                    });
                    setSummary(summaryRes.data?.summary ?? null);
                } catch {
                    setSummary(null);
                }
            } else {
                setVerificationItems([]);
                setSummary(null);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar balancete de verificação');
            setVerificationItems([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [activeCompany, token, startDisplayDate, endDisplayDate]);

    const handleGenerate = () => {
        if (viewMode === 'monthly') loadMonthlyBalance();
        else loadVerificationBalance();
    };

    useEffect(() => {
        if (activeCompany && token) handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCompany, token]);

    const toggleMonthlyExpand = (item: MonthlyBalanceItem) => {
        item.expanded = !item.expanded;
        setMonthlyItems([...monthlyItems]);
    };

    const toggleVerificationExpand = (item: VerificationBalanceItem) => {
        item.expanded = !item.expanded;
        setVerificationItems([...verificationItems]);
    };

    // ── Flatten hierarchy into ordered flat list ──────────────────────────────

    const flattenMonthly = (items: MonthlyBalanceItem[], depth = 0): Array<{ item: MonthlyBalanceItem; depth: number }> =>
        items.flatMap(item => [
            { item, depth },
            ...(item.children?.length ? flattenMonthly(item.children, depth + 1) : []),
        ]);

    const flattenVerification = (items: VerificationBalanceItem[], depth = 0): Array<{ item: VerificationBalanceItem; depth: number }> =>
        items.flatMap(item => [
            { item, depth },
            ...(item.children?.length ? flattenVerification(item.children, depth + 1) : []),
        ]);

    // ── Filtered lists ────────────────────────────────────────────────────────

    const flatMonthly = flattenMonthly(
        search ? filterMonthly([...monthlyItems], search) : monthlyItems
    );
    const flatVerification = flattenVerification(
        search ? filterVerification([...verificationItems], search) : verificationItems
    );

    // ── Render monthly row (flat) ─────────────────────────────────────────────

    const renderMonthlyRow = ({ item, depth }: { item: MonthlyBalanceItem; depth: number }) => {
        const isGroup = !!item.children?.length;
        return (
            <tr key={item.account.id} className={`hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${depth === 0 ? 'bg-gray-50/60' : ''}`}>
                <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap w-36">
                    {item.account.code}
                </td>
                <td className="px-4 py-2.5 text-sm">
                    <span
                        className={isGroup ? 'font-semibold text-gray-900' : 'text-gray-700'}
                        style={{ paddingLeft: `${depth * 18}px`, display: 'block' }}
                    >
                        {item.account.name}
                    </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                    <NatureBadge nature={item.account.nature} />
                </td>
                {showPreviousBalance && (
                    <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-400 whitespace-nowrap">—</td>
                )}
                <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                    {item.balance > 0 ? fmt(item.balance) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                    {item.balance < 0 ? fmt(Math.abs(item.balance)) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-4 py-2.5 text-sm text-right font-mono whitespace-nowrap font-medium ${item.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {fmt(Math.abs(item.balance))}
                </td>
            </tr>
        );
    };

    // ── Render verification row (flat) ────────────────────────────────────────

    const renderVerificationRow = ({ item, depth }: { item: VerificationBalanceItem; depth: number }) => {
        const isGroup = !!item.children?.length;
        const saldoFinal = item.previousBalance + item.debits - item.credits;
        return (
            <tr key={item.account.id} className={`hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${depth === 0 ? 'bg-gray-50/60' : ''}`}>
                <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap w-36">
                    {item.account.code}
                </td>
                <td className="px-4 py-2.5 text-sm">
                    <span
                        className={isGroup ? 'font-semibold text-gray-900' : 'text-gray-700'}
                        style={{ paddingLeft: `${depth * 18}px`, display: 'block' }}
                    >
                        {item.account.name}
                    </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                    <NatureBadge nature={item.account.nature} />
                </td>
                <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-500 whitespace-nowrap">
                    {item.previousBalance !== 0 ? fmt(Math.abs(item.previousBalance)) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                    {item.debits > 0 ? fmt(item.debits) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-right font-mono text-emerald-700 whitespace-nowrap">
                    {item.credits > 0 ? fmt(item.credits) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-4 py-2.5 text-sm text-right font-mono font-medium whitespace-nowrap ${saldoFinal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {fmt(Math.abs(saldoFinal))}
                </td>
            </tr>
        );
    };

    // ── Totals row ────────────────────────────────────────────────────────────

    const MonthlyTotalsRow: React.FC<{ rows: typeof flatMonthly }> = ({ rows }) => {
        const leafs = rows.filter(r => !r.item.children?.length).map(r => r.item);
        const totalDebit = leafs.filter(i => i.balance > 0).reduce((s, i) => s + i.balance, 0);
        const totalCredit = leafs.filter(i => i.balance < 0).reduce((s, i) => s + Math.abs(i.balance), 0);
        const totalFinal = totalDebit - totalCredit;
        return (
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-xs text-gray-600 uppercase tracking-wide">
                <td className="px-4 py-2.5" colSpan={2}>Totais</td>
                <td />
                {showPreviousBalance && <td className="px-4 py-2.5 text-right font-mono">—</td>}
                <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(totalDebit)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(totalCredit)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${totalFinal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {fmt(Math.abs(totalFinal))}
                </td>
            </tr>
        );
    };

    const VerificationTotalsRow: React.FC<{ rows: typeof flatVerification }> = ({ rows }) => {
        const leafs = rows.filter(r => !r.item.children?.length).map(r => r.item);
        const totalPrev = leafs.reduce((s, i) => s + i.previousBalance, 0);
        const totalDeb = leafs.reduce((s, i) => s + i.debits, 0);
        const totalCred = leafs.reduce((s, i) => s + i.credits, 0);
        const totalFinal = totalPrev + totalDeb - totalCred;
        return (
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-xs text-gray-600 uppercase tracking-wide">
                <td className="px-4 py-2.5" colSpan={2}>Totais</td>
                <td />
                <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(Math.abs(totalPrev))}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(totalDeb)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{fmt(totalCred)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${totalFinal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {fmt(Math.abs(totalFinal))}
                </td>
            </tr>
        );
    };

    // ── Has data ──────────────────────────────────────────────────────────────

    const hasData = viewMode === 'monthly' ? flatMonthly.length > 0 : flatVerification.length > 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 bg-gray-50 min-h-screen">

            {/* ── Page header ── */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <span>Ledgr</span><span>/</span>
                    <span>Accounting</span><span>/</span>
                    <span className="text-gray-900 font-medium">Balancete</span>
                </div>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-light text-gray-900 tracking-wide">BALANCETE</h1>
                        {activeCompany && (
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-medium text-gray-900">
                                    {activeCompany.tradeName || activeCompany.legalName}
                                </span>
                                <span className="text-xs text-gray-400">{activeCompany.taxId}</span>
                            </div>
                        )}
                    </div>
                    <div className="text-right text-xs text-gray-400">
                        {new Date().toLocaleDateString('pt-BR', {
                            weekday: 'long', hour: '2-digit', minute: '2-digit',
                        }).replace('-feira', '')} · {new Date().toLocaleDateString('pt-BR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                        }).toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="p-8">

                {/* ── View mode tabs ── */}
                <div className="flex border-b border-gray-200 mb-6">
                    {(['monthly', 'verification'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => { setViewMode(mode); setSearch(''); }}
                            className={`px-5 py-2.5 text-sm font-medium -mb-px transition-colors ${viewMode === mode
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {mode === 'monthly' ? 'Balancete Mensal' : 'Balancete de Verificação'}
                        </button>
                    ))}
                </div>

                {/* ── Filters bar ── */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                    <div className="flex flex-wrap items-end gap-3">

                        {/* Date inputs */}
                        {viewMode === 'monthly' ? (
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Data Base</label>
                                <div className="flex items-center gap-2">
                                    <FiCalendar className="text-gray-400" size={14} />
                                    <select
                                        value={displayDate}
                                        onChange={e => setDisplayDate(e.target.value)}
                                        className="border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {dateOptions.map(opt => (
                                            <option key={opt.value} value={opt.display}>
                                                {opt.display} ({opt.label})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Data Inicial</label>
                                    <div className="flex items-center gap-2">
                                        <FiCalendar className="text-gray-400" size={14} />
                                        <input
                                            type="text"
                                            value={startDisplayDate}
                                            onChange={e => setStartDisplayDate(e.target.value)}
                                            placeholder="DD/MM/AAAA"
                                            className="border border-gray-200 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Data Final</label>
                                    <div className="flex items-center gap-2">
                                        <FiCalendar className="text-gray-400" size={14} />
                                        <input
                                            type="text"
                                            value={endDisplayDate}
                                            onChange={e => setEndDisplayDate(e.target.value)}
                                            placeholder="DD/MM/AAAA"
                                            className="border border-gray-200 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Generate button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !activeCompany}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {loading
                                ? <FiRefreshCw size={14} className="animate-spin" />
                                : null}
                            Gerar Balancete
                        </button>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px]">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar conta (código ou nome)..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Toggle saldo anterior */}
                        {hasData && viewMode === 'monthly' && (
                            <div className="ml-auto">
                                <button
                                    onClick={() => setShowPreviousBalance(v => !v)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                >
                                    {showPreviousBalance ? <FiEyeOff size={13} /> : <FiEye size={13} />}
                                    Saldo anterior
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* ── Summary cards ── */}
                {summary && !loading && (
                    <div className="grid grid-cols-5 gap-3 mb-5">
                        {Object.entries(summary).map(([key, value]) => (
                            <div key={key} className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500 mb-1 truncate">{typeLabel[key] ?? key}</p>
                                <p className={`text-sm font-bold font-mono ${typeColor[key] ?? 'text-gray-700'}`}>
                                    R$ {fmt(Number(value))}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Table ── */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="text-center py-20 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                            <p className="text-sm">Carregando balancete…</p>
                        </div>
                    ) : !hasData ? (
                        <div className="text-center py-20 text-gray-400">
                            <FiCalendar size={44} className="mx-auto mb-4 opacity-20" />
                            <p className="text-gray-600 font-medium mb-1">Nenhum dado encontrado</p>
                            <p className="text-sm text-gray-400">
                                {search
                                    ? 'Nenhuma conta corresponde ao filtro.'
                                    : 'Selecione um período e clique em "Gerar Balancete".'}
                            </p>
                        </div>
                    ) : viewMode === 'monthly' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px]">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Código</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Tipo</th>
                                        {showPreviousBalance && (
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Saldo Anterior</th>
                                        )}
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Débito</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Crédito</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Saldo Final</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {flatMonthly.map(row => renderMonthlyRow(row))}
                                </tbody>
                                <tfoot>
                                    <MonthlyTotalsRow rows={flatMonthly} />
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Código</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Tipo</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Saldo Anterior</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Débitos</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Créditos</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Saldo Final</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {flatVerification.map(row => renderVerificationRow(row))}
                                </tbody>
                                <tfoot>
                                    <VerificationTotalsRow rows={flatVerification} />
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrialBalanceView;
