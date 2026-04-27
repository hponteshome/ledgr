// apps/web/src/pages/accounting/TrialBalanceView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    FiCalendar,
    FiSearch,
    FiRefreshCw,
    FiChevronRight,
    FiChevronDown,
} from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Design tokens (Design System Contábil — aprovado 22/03/2026) ─────────────
const DS = {
    accent: '#2563EB',
    accentSurface: '#EFF6FF',
    accentText: '#1D4ED8',
    border: '0.5px solid #E5E7EB',
    surface: '#F9FAFB',
    radius: { sm: '6px', md: '10px', lg: '14px' },
} as const;

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
    hasData: boolean;
    children?: VerificationBalanceItem[];
    expanded?: boolean;
}

interface SummaryData {
    [key: string]: number;
}

type ViewMode = 'monthly' | 'verification';

// Grupos de tipo que compõem o resultado (Receitas e Despesas)
const RESULT_TYPES = new Set(['REVENUE', 'EXPENSE']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
    Math.abs(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const convertToISODate = (d: string): string => {
    const clean = d.trim().replace(/[-\/]/g, '/');
    let parts = clean.split('/');
    if (parts.length === 1 && clean.length >= 6)
        parts = [clean.substring(0, 2), clean.substring(2, 4), clean.substring(4)];
    let [day, month, year] = parts;
    if (year && year.length === 2) year = '20' + year;
    if (!day || !month || !year) return '';
    return `${year}-${month}-${day}`;
};

// ─── Filtro por tipo (Resultado) ──────────────────────────────────────────────

function filterByResultMonthly(
    items: MonthlyBalanceItem[],
    showResult: boolean,
): MonthlyBalanceItem[] {
    if (showResult) return items;
    return items
        .filter(item => !RESULT_TYPES.has(item.account.type))
        .map(item => ({
            ...item,
            children: item.children
                ? filterByResultMonthly(item.children, showResult)
                : [],
        }));
}

function filterByResultVerification(
    items: VerificationBalanceItem[],
    showResult: boolean,
): VerificationBalanceItem[] {
    if (showResult) return items;
    return items
        .filter(item => !RESULT_TYPES.has(item.account.type))
        .map(item => ({
            ...item,
            children: item.children
                ? filterByResultVerification(item.children, showResult)
                : [],
        }));
}

// ─── Hierarchy builders ───────────────────────────────────────────────────────

function buildMonthlyHierarchy(items: MonthlyBalanceItem[]): MonthlyBalanceItem[] {
    const idMap = new Map<string, MonthlyBalanceItem>();
    items.forEach(item =>
        idMap.set(item.account.id, { ...item, children: [], expanded: true }),
    );
    const roots: MonthlyBalanceItem[] = [];
    idMap.forEach(node => {
        const pid = node.account.parentId;
        if (pid && idMap.has(pid)) {
            idMap.get(pid)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });
    const aggregate = (node: MonthlyBalanceItem): void => {
        if (!node.children?.length) return;
        node.children.forEach(c => aggregate(c));
        node.balance = node.children.reduce((s, c) => s + c.balance, 0);
    };
    roots.forEach(r => aggregate(r));
    const sort = (list: MonthlyBalanceItem[]) => {
        list.sort((a, b) => a.account.code.localeCompare(b.account.code));
        list.forEach(i => { if (i.children?.length) sort(i.children); });
    };
    sort(roots);
    return roots;
}

function buildVerificationHierarchy(
    items: VerificationBalanceItem[],
): VerificationBalanceItem[] {
    const idMap = new Map<string, VerificationBalanceItem>();
    items.forEach(item =>
        idMap.set(item.account.id, { ...item, children: [], expanded: true }),
    );
    const roots: VerificationBalanceItem[] = [];
    idMap.forEach(node => {
        const pid = node.account.parentId;
        if (pid && idMap.has(pid)) {
            idMap.get(pid)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });
    const aggregate = (node: VerificationBalanceItem): void => {
        if (!node.children?.length) return;
        node.children.forEach(c => aggregate(c));
        node.previousBalance = node.children.reduce((s, c) => s + c.previousBalance, 0);
        node.debits = node.children.reduce((s, c) => s + c.debits, 0);
        node.credits = node.children.reduce((s, c) => s + c.credits, 0);
        node.currentBalance =
            node.previousBalance + node.debits - node.credits;
    };
    roots.forEach(r => aggregate(r));
    const sort = (list: VerificationBalanceItem[]) => {
        list.sort((a, b) => a.account.code.localeCompare(b.account.code));
        list.forEach(i => { if (i.children?.length) sort(i.children); });
    };
    sort(roots);
    return roots;
}

// ─── Search filters ───────────────────────────────────────────────────────────

function filterMonthly(
    items: MonthlyBalanceItem[],
    term: string,
): MonthlyBalanceItem[] {
    if (!term) return items;
    return items.reduce<MonthlyBalanceItem[]>((acc, item) => {
        const matches =
            item.account.code.includes(term) ||
            item.account.name.toLowerCase().includes(term.toLowerCase());
        const filteredChildren = item.children?.length
            ? filterMonthly(item.children, term)
            : [];
        if (matches || filteredChildren.length > 0)
            acc.push({
                ...item,
                children: filteredChildren.length ? filteredChildren : item.children,
            });
        return acc;
    }, []);
}

function filterVerification(
    items: VerificationBalanceItem[],
    term: string,
): VerificationBalanceItem[] {
    if (!term) return items;
    return items.reduce<VerificationBalanceItem[]>((acc, item) => {
        const matches =
            item.account.code.includes(term) ||
            item.account.name.toLowerCase().includes(term.toLowerCase());
        const filteredChildren = item.children?.length
            ? filterVerification(item.children, term)
            : [];
        if (matches || filteredChildren.length > 0)
            acc.push({
                ...item,
                children: filteredChildren.length ? filteredChildren : item.children,
            });
        return acc;
    }, []);
}

// ─── Zero-balance filters ─────────────────────────────────────────────────────

function applyZeroFilterMonthly(
    items: MonthlyBalanceItem[],
    show: boolean,
): MonthlyBalanceItem[] {
    if (show) return items;
    return items
        .map(i => ({
            ...i,
            children: i.children ? applyZeroFilterMonthly(i.children, show) : [],
        }))
        .filter(i => i.balance !== 0 || (i.children?.length ?? 0) > 0);
}

function applyZeroFilterVerification(
    items: VerificationBalanceItem[],
    show: boolean,
): VerificationBalanceItem[] {
    if (show) return items;
    return items
        .map(i => ({
            ...i,
            children: i.children
                ? applyZeroFilterVerification(i.children, show)
                : [],
        }))
        .filter(
            i =>
                i.previousBalance !== 0 ||
                i.debits !== 0 ||
                i.credits !== 0 ||
                (i.children?.length ?? 0) > 0,
        );
}

// ─── Row types ────────────────────────────────────────────────────────────────

type MonthlyRow = { kind: 'data'; item: MonthlyBalanceItem; depth: number };

type VerificationRow = { kind: 'data'; item: VerificationBalanceItem; depth: number };

function flattenMonthly(
    items: MonthlyBalanceItem[],
    depth = 0,
    maxDepth: number | null,
): MonthlyRow[] {
    const rows: MonthlyRow[] = [];
    for (const item of items) {
        const hasChildren = !!item.children?.length;
        rows.push({ kind: 'data', item, depth });
        if (hasChildren && item.expanded) {
            const canExpand = maxDepth === null || depth + 1 < maxDepth;
            if (canExpand)
                rows.push(...flattenMonthly(item.children!, depth + 1, maxDepth));
        }
    }
    return rows;
}

function flattenVerification(
    items: VerificationBalanceItem[],
    depth = 0,
    maxDepth: number | null,
): VerificationRow[] {
    const rows: VerificationRow[] = [];
    for (const item of items) {
        const hasChildren = !!item.children?.length;
        rows.push({ kind: 'data', item, depth });
        if (hasChildren && item.expanded) {
            const canExpand = maxDepth === null || depth + 1 < maxDepth;
            if (canExpand)
                rows.push(
                    ...flattenVerification(item.children!, depth + 1, maxDepth),
                );
        }
    }
    return rows;
}

// ─── Closing panel helpers ────────────────────────────────────────────────────

function collectByType(
    nodes: VerificationBalanceItem[],
    acc: Record<string, number> = {},
): Record<string, number> {
    nodes.forEach(node => {
        if (!node.children?.length) {
            const t = node.account.type;
            acc[t] = (acc[t] ?? 0) + node.currentBalance;
        } else {
            collectByType(node.children, acc);
        }
    });
    return acc;
}

function collectByTypeMonthly(
    nodes: MonthlyBalanceItem[],
    acc: Record<string, number> = {},
): Record<string, number> {
    nodes.forEach(node => {
        if (!node.children?.length) {
            const t = node.account.type;
            acc[t] = (acc[t] ?? 0) + node.balance;
        } else {
            collectByTypeMonthly(node.children, acc);
        }
    });
    return acc;
}

// ─── ClosingPanel ─────────────────────────────────────────────────────────────

interface ClosingPanelProps {
    verRoots: VerificationBalanceItem[];
    monthlyRoots: MonthlyBalanceItem[];
    viewMode: ViewMode;
}

const ClosingPanel: React.FC<ClosingPanelProps> = ({
    verRoots,
    monthlyRoots,
    viewMode,
}) => {
    const hasData =
        viewMode === 'verification'
            ? verRoots.length > 0
            : monthlyRoots.length > 0;
    if (!hasData) return null;

    const byType =
        viewMode === 'verification'
            ? collectByType(verRoots)
            : collectByTypeMonthly(monthlyRoots);

    const ativo = Math.abs(byType['ASSET'] ?? 0);
    const passivo = Math.abs(byType['LIABILITY'] ?? 0);
    const pl = Math.abs(byType['EQUITY'] ?? 0);
    const receita = Math.abs(byType['REVENUE'] ?? 0);
    const despesa = Math.abs(byType['EXPENSE'] ?? 0);
    const passivoTotal = passivo + pl;
    const resultado = receita - despesa;
    // Diferença Apurada: Ativo - Passivo - Resultado do Exercício
    const diferenca = ativo - passivoTotal - resultado;
    const temDiferenca = Math.abs(diferenca) >= 0.01;

    // Estilo base da linha
    const trBase: React.CSSProperties = {
        borderBottom: '0.5px solid #F0F0F0',
    };
    const tdLabel: React.CSSProperties = {
        padding: '7px 14px',
        fontSize: 13,
        color: '#374151',
        fontWeight: 400,
        width: 220,
        whiteSpace: 'nowrap' as const,
    };
    const tdValue: React.CSSProperties = {
        padding: '7px 14px',
        fontSize: 13,
        fontFamily: 'monospace',
        textAlign: 'right' as const,
        width: 180,
        whiteSpace: 'nowrap' as const,
    };
    const tdNote: React.CSSProperties = {
        padding: '7px 14px',
        fontSize: 11,
        color: '#9CA3AF',
        fontStyle: 'italic' as const,
    };

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: DS.accentText }}>◆ Fechamento</span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>Posição patrimonial e de resultado</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <div style={{ background: "#fff", border: DS.border, borderRadius: DS.radius.md, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Total do Ativo</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: DS.accentText, fontFamily: "monospace" }}>{fmt(ativo)}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>ASSET</div>
                </div>
                <div style={{ background: "#fff", border: DS.border, borderRadius: DS.radius.md, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Passivo + PL</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: "#C2410C", fontFamily: "monospace" }}>{fmt(passivoTotal)}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>Passivo: {fmt(passivo)}</span>
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>PL: {fmt(pl)}</span>
                    </div>
                </div>
                <div style={{ background: resultado >= 0 ? "#F0FDF4" : "#FEF2F2", border: DS.border, borderRadius: DS.radius.md, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Resultado do Exercício</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: resultado >= 0 ? "#15803D" : "#B91C1C", fontFamily: "monospace" }}>
                        {resultado >= 0 ? "" : "–"}{fmt(Math.abs(resultado))}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: "#15803D" }}>Rec: {fmt(receita)}</span>
                        <span style={{ fontSize: 10, color: "#B91C1C" }}>Desp: {fmt(despesa)}</span>
                    </div>
                </div>
                <div style={{ background: temDiferenca ? "#FEF2F2" : "#F0FDF4", border: DS.border, borderRadius: DS.radius.md, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Equilíbrio</div>
                    {temDiferenca ? (
                        <><div style={{ fontSize: 20, fontWeight: 500, color: "#B91C1C", fontFamily: "monospace" }}>{diferenca >= 0 ? "" : "–"}{fmt(Math.abs(diferenca))}</div>
                        <div style={{ fontSize: 10, color: "#B91C1C", marginTop: 2 }}>Diferença apurada</div></>
                    ) : (
                        <><div style={{ fontSize: 20, fontWeight: 500, color: "#15803D", fontFamily: "monospace" }}>✓ OK</div>
                        <div style={{ fontSize: 10, color: "#15803D", marginTop: 2 }}>Balanço equilibrado</div></>
                    )}
                </div>
            </div>
        </div>
    );
};


// ─── NatureBadge ──────────────────────────────────────────────────────────────

const NatureBadge: React.FC<{ nature: string }> = ({ nature }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            background: nature === 'DEBIT' ? DS.accentSurface : '#F0FDF4',
            color: nature === 'DEBIT' ? DS.accentText : '#15803D',
        }}
    >
        {nature === 'DEBIT' ? 'D' : 'C'}
    </span>
);

// ─── ToggleButton ─────────────────────────────────────────────────────────────

const ToggleButton: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            borderRadius: DS.radius.sm,
            background: active ? DS.accent : '#fff',
            color: active ? '#fff' : DS.accentText,
            border: `0.5px solid ${active ? DS.accent : '#D1D5DB'}`,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap' as const,
        }}
    >
        {children}
    </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const TrialBalanceView: React.FC = () => {
    const { activeCompany } = useCompany();
    const { token } = useAuth();

    const [viewMode, setViewMode] = useState<ViewMode>('verification');

    // Datas padrão: 01/01/2025 → 31/12/2025
    const [displayDate, setDisplayDate] = useState('31/12/2026');
    const [startDisplayDate, setStartDisplayDate] = useState('01/01/2026');
    const [endDisplayDate, setEndDisplayDate] = useState('31/12/2026');

    const [monthlyItems, setMonthlyItems] = useState<MonthlyBalanceItem[]>([]);
    const [verificationItems, setVerificationItems] = useState<
        VerificationBalanceItem[]
    >([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [maxDepth, setMaxDepth] = useState<number | null>(null);
    const [showZeroBalances, setShowZeroBalances] = useState(false);

    // ── NOVO: toggle contas de Resultado (REVENUE + EXPENSE) ──────────────────
    // Quando false (padrão), exibe apenas o Balanço Patrimonial (ASSET/LIABILITY/EQUITY).
    // Quando true, exibe todas as contas, incluindo Resultado.
    const [showResult, setShowResult] = useState(false);

    // ── Loaders ───────────────────────────────────────────────────────────────

    const loadMonthly = useCallback(async () => {
        if (!activeCompany) { setError('Nenhuma empresa selecionada'); return; }
        setLoading(true);
        setError(null);
        try {
            const isoDate = convertToISODate(displayDate);
            const res = await api.get('/accounting/trial-balance', {
                params: { date: isoDate },
                headers: {
                    'x-company-id': activeCompany.id,
                    Authorization: `Bearer ${token}`,
                },
            });
            const balances: MonthlyBalanceItem[] = res.data?.balances ?? [];
            if (balances.length > 0) {
                setMonthlyItems(buildMonthlyHierarchy(balances));
                try {
                    const sumRes = await api.get('/accounting/trial-balance/summary', {
                        params: { date: isoDate },
                        headers: {
                            'x-company-id': activeCompany.id,
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    setSummary(sumRes.data?.summary ?? null);
                } catch {
                    setSummary(null);
                }
            } else {
                setMonthlyItems([]);
                setSummary(null);
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message || 'Erro ao carregar balancete mensal',
            );
            setMonthlyItems([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [activeCompany, token, displayDate]);

    const loadVerification = useCallback(async () => {
        if (!activeCompany) { setError('Nenhuma empresa selecionada'); return; }
        setLoading(true);
        setError(null);
        try {
            const startISO = convertToISODate(startDisplayDate);
            const endISO = convertToISODate(endDisplayDate);
            const res = await api.get('/accounting/trial-balance/verification', {
                params: { startDate: startISO, endDate: endISO },
                headers: {
                    'x-company-id': activeCompany.id,
                    Authorization: `Bearer ${token}`,
                },
            });
            const items: VerificationBalanceItem[] = res.data?.balances ?? [];
            if (items.length > 0) {
                setVerificationItems(buildVerificationHierarchy(items));
                try {
                    const sumRes = await api.get('/accounting/trial-balance/summary', {
                        params: { date: endISO },
                        headers: {
                            'x-company-id': activeCompany.id,
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    setSummary(sumRes.data?.summary ?? null);
                } catch {
                    setSummary(null);
                }
            } else {
                setVerificationItems([]);
                setSummary(null);
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                'Erro ao carregar balancete de verificação',
            );
            setVerificationItems([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [activeCompany, token, startDisplayDate, endDisplayDate]);

    const handleGenerate = () => {
        if (viewMode === 'monthly') loadMonthly();
        else loadVerification();
    };

    useEffect(() => {
        if (activeCompany && token) handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCompany, token]);

    // ── Toggle expand ─────────────────────────────────────────────────────────

    const toggleMonthly = (item: MonthlyBalanceItem) => {
        item.expanded = !item.expanded;
        setMonthlyItems([...monthlyItems]);
    };

    const toggleVerification = (item: VerificationBalanceItem) => {
        item.expanded = !item.expanded;
        setVerificationItems([...verificationItems]);
    };

    // ── Pipeline de filtros aplicados em ordem ─────────────────────────────────
    // 1. Filtro de Resultado (showResult)
    // 2. Filtro de zeros (showZeroBalances)
    // 3. Busca textual (search)

    const pipelineMonthly = (() => {
        let items = filterByResultMonthly([...monthlyItems], showResult);
        items = applyZeroFilterMonthly(items, showZeroBalances);
        if (search) items = filterMonthly(items, search);
        return items;
    })();

    const pipelineVerification = (() => {
        let items = filterByResultVerification([...verificationItems], showResult);
        items = applyZeroFilterVerification(items, showZeroBalances);
        if (search) items = filterVerification(items, search);
        return items;
    })();

    const flatMonthly: MonthlyRow[] = flattenMonthly(pipelineMonthly, 0, maxDepth);
    const flatVerification: VerificationRow[] = flattenVerification(
        pipelineVerification,
        0,
        maxDepth,
    );

    const hasData =
        viewMode === 'monthly'
            ? flatMonthly.length > 0
            : flatVerification.length > 0;

    // Raízes para o ClosingPanel e totais de rodapé
    const monthlyRoots = flatMonthly
        .filter(r => r.kind === 'data' && r.depth === 0)
        .map(r => (r as { kind: 'data'; item: MonthlyBalanceItem; depth: number }).item);

    const verRoots = flatVerification
        .filter(r => r.kind === 'data' && r.depth === 0)
        .map(
            r =>
                (
                    r as {
                        kind: 'data';
                        item: VerificationBalanceItem;
                        depth: number;
                    }
                ).item,
        );

    // ── Estilos de célula ─────────────────────────────────────────────────────

    const rowStyle = (
        depth: number,
        isGroup: boolean,
        idx: number,
    ): React.CSSProperties => {
        let bg: string;
        if (depth === 0) {
            bg = '#EFF6FF';
        } else if (isGroup) {
            bg = idx % 2 === 0 ? '#F8FAFC' : '#F1F5F9';
        } else {
            bg = idx % 2 === 0 ? '#ffffff' : '#F9FAFB';
        }
        return {
            background: bg,
            fontWeight: depth === 0 ? 600 : isGroup ? 500 : 400,
            borderBottom: '0.5px solid #F0F0F0',
        };
    };


    const thStyle: React.CSSProperties = {
        background: '#EFF6FF',
        color: '#4B5563',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        padding: '7px 12px',
        fontWeight: 600,
        borderBottom: DS.border,
        whiteSpace: 'nowrap',
        position: 'sticky' as const,
        top: 0,
        zIndex: 1,
    };

    const tdStyle = (align: 'left' | 'right' = 'left'): React.CSSProperties => ({
        padding: '5px 12px',
        fontSize: 12,
        color: '#374151',
        textAlign: align,
        whiteSpace: 'nowrap',
    });

    const inputStyle: React.CSSProperties = {
        border: DS.border,
        borderRadius: DS.radius.sm,
        padding: '7px 12px',
        fontSize: 13,
        color: '#111111',
        fontFamily: 'monospace',
        outline: 'none',
        width: 130,
        background: '#fff',
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    const renderMonthlyRow = (row: MonthlyRow, idx: number) => {
        const { item, depth } = row;
        const isGroup = !!item.children?.length;
        return (
            <tr key={item.account.id} style={rowStyle(depth, isGroup, idx)}>
                <td
                    style={{
                        ...tdStyle(),
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: '#9CA3AF',
                        width: 130,
                    }}
                >
                    {item.account.code}
                </td>
                <td style={tdStyle()}>
                    <span
                        style={{
                            paddingLeft: depth * 18,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: isGroup ? 'pointer' : 'default',
                        }}
                        onClick={() => isGroup && toggleMonthly(item)}
                    >
                        {isGroup &&
                            (item.expanded ? (
                                <FiChevronDown
                                    size={13}
                                    style={{ color: DS.accent, flexShrink: 0 }}
                                />
                            ) : (
                                <FiChevronRight
                                    size={13}
                                    style={{ color: '#9CA3AF', flexShrink: 0 }}
                                />
                            ))}
                        {item.account.name}
                    </span>
                </td>
                <td style={tdStyle()}>
                    <NatureBadge nature={item.account.nature} />
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        color: '#374151',
                    }}
                >
                    {item.balance > 0 ? (
                        fmt(item.balance)
                    ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                    )}
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        color: '#374151',
                    }}
                >
                    {item.balance < 0 ? (
                        fmt(Math.abs(item.balance))
                    ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                    )}
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        color: item.balance >= 0 ? '#111111' : '#B91C1C',
                    }}
                >
                    {fmt(Math.abs(item.balance))}
                </td>
            </tr>
        );
    };

    const renderVerificationRow = (row: VerificationRow, idx: number) => {
        const { item, depth } = row;
        const isGroup = !!item.children?.length;
        const saldoFinal = item.previousBalance + item.debits - item.credits;
        return (
            <tr key={item.account.id} style={rowStyle(depth, isGroup, idx)}>
                <td
                    style={{
                        ...tdStyle(),
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: '#9CA3AF',
                        width: 130,
                    }}
                >
                    {item.account.code}
                </td>
                <td style={tdStyle()}>
                    <span
                        style={{
                            paddingLeft: depth * 18,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: isGroup ? 'pointer' : 'default',
                        }}
                        onClick={() => isGroup && toggleVerification(item)}
                    >
                        {isGroup &&
                            (item.expanded ? (
                                <FiChevronDown
                                    size={13}
                                    style={{ color: DS.accent, flexShrink: 0 }}
                                />
                            ) : (
                                <FiChevronRight
                                    size={13}
                                    style={{ color: '#9CA3AF', flexShrink: 0 }}
                                />
                            ))}
                        {item.account.name}
                    </span>
                </td>
                <td style={tdStyle()}>
                    <NatureBadge nature={item.account.nature} />
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        color: '#9CA3AF',
                    }}
                >
                    {item.previousBalance !== 0 ? (
                        fmt(Math.abs(item.previousBalance))
                    ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                    )}
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        color: '#374151',
                    }}
                >
                    {item.debits > 0 ? (
                        fmt(item.debits)
                    ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                    )}
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        color: '#15803D',
                    }}
                >
                    {item.credits > 0 ? (
                        fmt(item.credits)
                    ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                    )}
                </td>
                <td
                    style={{
                        ...tdStyle('right'),
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        color: saldoFinal >= 0 ? '#111111' : '#B91C1C',
                    }}
                >
                    {fmt(Math.abs(saldoFinal))}
                </td>
            </tr>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ flex: 1, background: DS.surface, minHeight: '100vh' }}>

            {/* ── Page header ── */}
            <div
                style={{
                    background: '#fff',
                    borderBottom: DS.border,
                    padding: '16px 32px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: '#9CA3AF',
                        marginBottom: 6,
                    }}
                >
                    <span>Ledgr</span>
                    <span>/</span>
                    <span>Accounting</span>
                    <span>/</span>
                    <span style={{ color: '#111111', fontWeight: 500 }}>Balancete</span>
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h1
                                style={{
                                    fontSize: 22,
                                    fontWeight: 400,
                                    color: '#111111',
                                    letterSpacing: 1,
                                    margin: 0,
                                }}
                            >
                                BALANCETE
                            </h1>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                    background: DS.accentSurface,
                                    color: DS.accentText,
                                }}
                            >
                                ◆ Contábil
                            </span>
                        </div>
                        {activeCompany && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginTop: 4,
                                }}
                            >
                                <span
                                    style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}
                                >
                                    {activeCompany.tradeName || activeCompany.legalName}
                                </span>
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                                    {activeCompany.taxId}
                                </span>
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#9CA3AF' }}>
                        {new Date().toLocaleString('pt-BR', {
                            weekday: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}{' '}
                        ·{' '}
                        {new Date()
                            .toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            })
                            .toUpperCase()}
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px' }}>

                {/* ── Tabs ── */}
                <div
                    style={{ display: 'flex', borderBottom: DS.border, marginBottom: 20 }}
                >
                    {(['monthly', 'verification'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => {
                                setViewMode(mode);
                                setSearch('');
                            }}
                            style={{
                                padding: '10px 20px',
                                fontSize: 13,
                                fontWeight: viewMode === mode ? 500 : 400,
                                color: viewMode === mode ? DS.accent : '#6B7280',
                                background: 'none',
                                border: 'none',
                                borderBottom:
                                    viewMode === mode
                                        ? `2px solid ${DS.accent}`
                                        : '2px solid transparent',
                                cursor: 'pointer',
                                marginBottom: -1,
                                transition: 'color 0.15s',
                            } as React.CSSProperties}
                        >
                            {mode === 'monthly' ? 'Balancete Mensal' : 'Balancete de Verificação'}
                        </button>
                    ))}
                </div>

                {/* ── Barra de filtros ── */}
                <div
                    style={{
                        background: '#fff',
                        border: DS.border,
                        borderRadius: DS.radius.md,
                        padding: '14px 16px',
                        marginBottom: 16,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        gap: 12,
                    }}
                >
                    {/* Inputs de data */}
                    {viewMode === 'monthly' ? (
                        <div>
                            <label
                                style={{
                                    fontSize: 11,
                                    color: '#9CA3AF',
                                    display: 'block',
                                    marginBottom: 4,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}
                            >
                                Data Base
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiCalendar size={13} style={{ color: '#9CA3AF' }} />
                                <input
                                    type="text"
                                    value={displayDate}
                                    onChange={e => setDisplayDate(e.target.value)}
                                    placeholder="dd/mm/aaaa"
                                    maxLength={10}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {[
                                {
                                    label: 'Data Inicial',
                                    value: startDisplayDate,
                                    set: setStartDisplayDate,
                                },
                                {
                                    label: 'Data Final',
                                    value: endDisplayDate,
                                    set: setEndDisplayDate,
                                },
                            ].map(({ label, value, set }) => (
                                <div key={label}>
                                    <label
                                        style={{
                                            fontSize: 11,
                                            color: '#9CA3AF',
                                            display: 'block',
                                            marginBottom: 4,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                        }}
                                    >
                                        {label}
                                    </label>
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <FiCalendar size={13} style={{ color: '#9CA3AF' }} />
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={e => set(e.target.value)}
                                            placeholder="dd/mm/aaaa"
                                            maxLength={10}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Separador visual */}
                    <div
                        style={{
                            width: '0.5px',
                            height: 32,
                            background: '#E5E7EB',
                            alignSelf: 'flex-end',
                        }}
                    />

                    {/* Toggles de visibilidade */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        {/* Toggle: Contas Zeradas */}
                        <ToggleButton
                            active={showZeroBalances}
                            onClick={() => setShowZeroBalances(!showZeroBalances)}
                        >
                            {showZeroBalances ? '✓' : ''} Zeradas
                        </ToggleButton>

                        {/* Toggle: Contas de Resultado (NOVO) */}
                        <ToggleButton
                            active={showResult}
                            onClick={() => setShowResult(!showResult)}
                        >
                            {showResult ? '✓' : ''} Resultado
                        </ToggleButton>
                    </div>

                    {/* Botão gerar */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !activeCompany}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 18px',
                            background: '#111111',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 500,
                            borderRadius: DS.radius.sm,
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading || !activeCompany ? 0.5 : 1,
                            transition: 'opacity 0.15s',
                        }}
                    >
                        {loading && (
                            <FiRefreshCw
                                size={13}
                                style={{ animation: 'spin 1s linear infinite' }}
                            />
                        )}
                        Gerar Balancete
                    </button>

                    {/* Busca */}
                    <div
                        style={{
                            position: 'relative',
                            flex: 1,
                            minWidth: 200,
                        }}
                    >
                        <FiSearch
                            size={13}
                            style={{
                                position: 'absolute',
                                left: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9CA3AF',
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Buscar conta (código ou nome)…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                ...inputStyle,
                                paddingLeft: 30,
                                width: '100%',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Seletor de nível */}
                    {hasData && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginLeft: 'auto',
                                border: DS.border,
                                borderRadius: DS.radius.sm,
                                padding: '4px 8px',
                            }}
                        >
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Nível:</span>
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setMaxDepth(maxDepth === n ? null : n)}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        fontWeight: 500,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: maxDepth === n ? '#111111' : 'transparent',
                                        color: maxDepth === n ? '#fff' : '#6B7280',
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                            <button
                                onClick={() => setMaxDepth(null)}
                                style={{
                                    padding: '0 6px',
                                    height: 24,
                                    borderRadius: 4,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: maxDepth === null ? '#111111' : 'transparent',
                                    color: maxDepth === null ? '#fff' : '#6B7280',
                                }}
                            >
                                ∞
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Erro ── */}
                {error && (
                    <div
                        style={{
                            marginBottom: 16,
                            padding: '12px 16px',
                            background: '#FEF2F2',
                            border: '0.5px solid #FECACA',
                            borderRadius: DS.radius.sm,
                        }}
                    >
                        <p style={{ fontSize: 13, color: '#B91C1C', margin: 0 }}>{error}</p>
                    </div>
                )}

                {/* ── Painel de fechamento ── */}
                {!loading && (
                    <ClosingPanel
                        verRoots={verRoots}
                        monthlyRoots={monthlyRoots}
                        viewMode={viewMode}
                    />
                )}

                {/* ── Tabela ── */}
                <div
                    style={{
                        background: '#fff',
                        border: DS.border,
                        borderRadius: DS.radius.md,
                        overflow: 'hidden',
                    }}
                >
                    {loading ? (
                        <div
                            style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    border: `2px solid ${DS.accent}`,
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    margin: '0 auto 12px',
                                    animation: 'spin 0.8s linear infinite',
                                }}
                            />
                            <p style={{ fontSize: 13 }}>Carregando balancete…</p>
                        </div>
                    ) : !hasData ? (
                        <div
                            style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}
                        >
                            <FiCalendar
                                size={40}
                                style={{
                                    margin: '0 auto 12px',
                                    display: 'block',
                                    opacity: 0.2,
                                }}
                            />
                            <p
                                style={{
                                    fontSize: 14,
                                    color: '#374151',
                                    fontWeight: 500,
                                    marginBottom: 4,
                                }}
                            >
                                Nenhum dado encontrado
                            </p>
                            <p style={{ fontSize: 13 }}>
                                {search
                                    ? 'Nenhuma conta corresponde ao filtro.'
                                    : 'Selecione um período e clique em "Gerar Balancete".'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    minWidth: 720,
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, textAlign: 'left', width: 130 }}>
                                            Código
                                        </th>
                                        <th style={{ ...thStyle, textAlign: 'left' }}>Conta</th>
                                        <th
                                            style={{ ...thStyle, textAlign: 'left', width: 50 }}
                                        >
                                            Tipo
                                        </th>
                                        {viewMode === 'verification' && (
                                            <th
                                                style={{
                                                    ...thStyle,
                                                    textAlign: 'right',
                                                    width: 130,
                                                }}
                                            >
                                                Saldo Anterior
                                            </th>
                                        )}
                                        <th
                                            style={{ ...thStyle, textAlign: 'right', width: 130 }}
                                        >
                                            {viewMode === 'monthly' ? 'Débito' : 'Débitos'}
                                        </th>
                                        <th
                                            style={{ ...thStyle, textAlign: 'right', width: 130 }}
                                        >
                                            {viewMode === 'monthly' ? 'Crédito' : 'Créditos'}
                                        </th>
                                        <th
                                            style={{ ...thStyle, textAlign: 'right', width: 130 }}
                                        >
                                            Saldo Final
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewMode === 'monthly'
                                        ? flatMonthly.map((row, idx) =>
                                            renderMonthlyRow(row, idx),
                                        )
                                        : flatVerification.map((row, idx) =>
                                            renderVerificationRow(row, idx),
                                        )}
                                </tbody>
                                <tfoot>
                                    {viewMode === 'monthly' ? (
                                        <tr
                                            style={{
                                                background: DS.surface,
                                                borderTop: '1px solid #E5E7EB',
                                            }}
                                        >
                                            <td
                                                style={{
                                                    ...tdStyle(),
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: '#6B7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3px',
                                                }}
                                                colSpan={2}
                                            >
                                                Totais Gerais
                                            </td>
                                            <td />
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#111111',
                                                }}
                                            >
                                                {fmt(
                                                    monthlyRoots
                                                        .filter(i => i.balance > 0)
                                                        .reduce((s, i) => s + i.balance, 0),
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#111111',
                                                }}
                                            >
                                                {fmt(
                                                    monthlyRoots
                                                        .filter(i => i.balance < 0)
                                                        .reduce((s, i) => s + Math.abs(i.balance), 0),
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#111111',
                                                }}
                                            >
                                                {fmt(
                                                    Math.abs(
                                                        monthlyRoots.reduce((s, i) => s + i.balance, 0),
                                                    ),
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr
                                            style={{
                                                background: DS.surface,
                                                borderTop: '1px solid #E5E7EB',
                                            }}
                                        >
                                            <td
                                                style={{
                                                    ...tdStyle(),
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: '#6B7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.3px',
                                                }}
                                                colSpan={2}
                                            >
                                                Totais Gerais
                                            </td>
                                            <td />
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#6B7280',
                                                }}
                                            >
                                                {fmt(
                                                    Math.abs(
                                                        verRoots.reduce(
                                                            (s, i) => s + i.previousBalance,
                                                            0,
                                                        ),
                                                    ),
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#111111',
                                                }}
                                            >
                                                {fmt(verRoots.reduce((s, i) => s + i.debits, 0))}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#15803D',
                                                }}
                                            >
                                                {fmt(verRoots.reduce((s, i) => s + i.credits, 0))}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle('right'),
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    color: '#111111',
                                                }}
                                            >
                                                {fmt(
                                                    Math.abs(
                                                        verRoots.reduce(
                                                            (s, i) => s + i.currentBalance,
                                                            0,
                                                        ),
                                                    ),
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── CSS global ── */}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default TrialBalanceView;
