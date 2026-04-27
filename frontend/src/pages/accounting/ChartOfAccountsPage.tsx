// apps/web/src/pages/accounting/ChartOfAccountsPage.tsx
// Plano de Contas — LEDGR Design System v1.0
// Colunas: Código · Descrição · Cód.Rápido (analíticas) · Nat. · Tipo · SPED · Sit.
// Toggle: Tabela ↔ Árvore | Filter chips por grupo contábil | Busca unificada

import { useState, useMemo, useCallback } from 'react'
import api from '@/services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types (espelha schema.prisma) ───────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
export type AccountNature = 'DEBIT' | 'CREDIT'

export interface ChartAccount {
    id: string
    code: string
    name: string
    level: number
    type: AccountType
    nature: AccountNature
    isAnalytic: boolean
    isActive: boolean
    parentId: string | null
    shortCode?: string   // ≤6 chars — apenas contas analíticas, digitação rápida
    spedCode?: string
    ifrsCode?: string
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAccounts(): Promise<ChartAccount[]> {
    const { data } = await api.get<ChartAccount[]>('/accounting/accounts')
    return data
}

async function deleteAccount(id: string): Promise<void> {
    await api.delete(`/accounting/accounts/${id}`)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<AccountType, string> = {
    ASSET: 'Ativo',
    LIABILITY: 'Passivo',
    EQUITY: 'PL',
    REVENUE: 'Receita',
    EXPENSE: 'Despesa',
}

// Tailwind classes — accent sem gradiente conforme design system
const TYPE_CSS: Record<AccountType, { bg: string; color: string }> = {
    ASSET: { bg: '#F0F9FF', color: '#075985' },
    LIABILITY: { bg: '#FEF2F2', color: '#B91C1C' },
    EQUITY: { bg: '#FAF5FF', color: '#6D28D9' },
    REVENUE: { bg: '#F0FDF4', color: '#15803D' },
    EXPENSE: { bg: '#FFF7ED', color: '#C2410C' },
}

const FILTERS: { label: string; value: string }[] = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Ativo', value: 'ASSET' },
    { label: 'Passivo', value: 'LIABILITY' },
    { label: 'Patrim. Líquido', value: 'EQUITY' },
    { label: 'Receitas', value: 'REVENUE' },
    { label: 'Despesas', value: 'EXPENSE' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasChildren(accounts: ChartAccount[], id: string) {
    return accounts.some(a => a.parentId === id)
}

function matchesFilter(a: ChartAccount, q: string, typeFilter: string) {
    return (
        (typeFilter === 'ALL' || a.type === typeFilter) &&
        (!q || [a.code, a.name, a.spedCode ?? '', a.shortCode ?? '']
            .join(' ').toLowerCase().includes(q))
    )
}

function getFlatRows(
    accounts: ChartAccount[],
    expanded: Set<string>,
    search: string,
    typeFilter: string,
): ChartAccount[] {
    const q = search.toLowerCase()
    if (q || typeFilter !== 'ALL') {
        return accounts.filter(a => matchesFilter(a, q, typeFilter))
    }
    const result: ChartAccount[] = []
    function walk(parentId: string | null) {
        accounts
            .filter(a => a.parentId === parentId)
            .forEach(a => { result.push(a); if (expanded.has(a.id)) walk(a.id) })
    }
    walk(null)
    return result
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Chevron({ open, onClick }: { open: boolean; onClick: () => void }) {
    return (
        <button
            onClick={e => { e.stopPropagation(); onClick() }}
            style={{
                width: 9, height: 9, flexShrink: 0, padding: 0, fontSize: 7, lineHeight: 1,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#C4C9D4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .13s',
            }}
        >▶</button>
    )
}

function NaturePill({ nature }: { nature: AccountNature }) {
    const isDebit = nature === 'DEBIT'
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 20,
            background: isDebit ? '#EFF6FF' : '#F0FDF4',
            color: isDebit ? '#1D4ED8' : '#15803D',
        }}>
            {isDebit ? 'D' : 'C'}
        </span>
    )
}

function TypePill({ type }: { type: AccountType }) {
    const { bg, color } = TYPE_CSS[type]
    return (
        <span style={{
            display: 'inline-flex', fontSize: 9, fontWeight: 500,
            padding: '1px 5px', borderRadius: 3, background: bg, color,
        }}>
            {TYPE_LABEL[type]}
        </span>
    )
}

function StatusDot({ active }: { active: boolean }) {
    return (
        <span style={{
            width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
            background: active ? '#22C55E' : '#D1D5DB',
        }} />
    )
}

// ─── Table View ───────────────────────────────────────────────────────────────

interface TableViewProps {
    accounts: ChartAccount[]
    expanded: Set<string>
    search: string
    typeFilter: string
    onToggle: (id: string) => void
    onEdit: (acc: ChartAccount) => void
    onDelete: (id: string) => void
}

function TableView({ accounts, expanded, search, typeFilter, onToggle, onEdit, onDelete }: TableViewProps) {
    const rows = useMemo(
        () => getFlatRows(accounts, expanded, search, typeFilter),
        [accounts, expanded, search, typeFilter],
    )

    const th: React.CSSProperties = {
        color: '#9CA3AF', fontSize: 10, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '.5px',
        padding: '6px 10px', textAlign: 'left',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB',
    }

    return (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                <colgroup>
                    <col style={{ width: 96 }} />
                    <col />
                    <col style={{ width: 68 }} />
                    <col style={{ width: 52 }} />
                    <col style={{ width: 64 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 38 }} />
                    <col style={{ width: 48 }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={th}>Código</th>
                        <th style={th}>Descrição</th>
                        <th style={{ ...th, color: '#2563EB' }} title="Código curto para digitação rápida — apenas contas analíticas (≤ 6 caracteres)">
                            Cód. Rápido
                        </th>
                        <th style={th}>Nat.</th>
                        <th style={th}>Tipo</th>
                        <th style={th}>SPED</th>
                        <th style={{ ...th, textAlign: 'center' }}>Sit.</th>
                        <th style={th} />
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>
                                Nenhuma conta encontrada.
                            </td>
                        </tr>
                    ) : rows.map(acc => {
                        const indent = (acc.level - 1) * 12
                        const hasKids = hasChildren(accounts, acc.id)

                        return (
                            <tr
                                key={acc.id}
                                style={{ borderBottom: '0.5px solid #F7F7F7' }}
                                className="group"
                                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                            >
                                {/* Código */}
                                <td>
                                    <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', minHeight: 30 }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                            {acc.code}
                                        </span>
                                    </div>
                                </td>

                                {/* Descrição */}
                                <td>
                                    <div style={{
                                        padding: `5px 10px 5px ${6 + indent}px`,
                                        display: 'flex', alignItems: 'center', minHeight: 30, gap: 3
                                    }}>
                                        {hasKids
                                            ? <Chevron open={expanded.has(acc.id)} onClick={() => onToggle(acc.id)} />
                                            : <span style={{ width: 9, flexShrink: 0 }} />
                                        }
                                        <span style={{
                                            fontSize: 11, color: '#111', marginLeft: 3,
                                            fontWeight: acc.isAnalytic ? 400 : 500,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {acc.name}
                                        </span>
                                    </div>
                                </td>

                                {/* Cód. Rápido — exclusivo para analíticas */}
                                <td>
                                    <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', minHeight: 30 }}>
                                        {acc.isAnalytic && (
                                            <span style={{
                                                fontFamily: 'monospace', fontSize: 10, fontWeight: 500,
                                                color: acc.shortCode ? '#374151' : '#D1D5DB',
                                            }}>
                                                {acc.shortCode || '—'}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Natureza */}
                                <td>
                                    <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', minHeight: 30 }}>
                                        <NaturePill nature={acc.nature} />
                                    </div>
                                </td>

                                {/* Tipo */}
                                <td>
                                    <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', minHeight: 30 }}>
                                        <TypePill type={acc.type} />
                                    </div>
                                </td>

                                {/* SPED */}
                                <td>
                                    <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', minHeight: 30 }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#B0B7C3' }}>
                                            {acc.spedCode || '—'}
                                        </span>
                                    </div>
                                </td>

                                {/* Situação */}
                                <td>
                                    <div style={{
                                        padding: '5px 10px', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', minHeight: 30
                                    }}>
                                        <StatusDot active={acc.isActive} />
                                    </div>
                                </td>

                                {/* Ações — aparecem no hover via JS inline */}
                                <td>
                                    <ActionsCell onEdit={() => onEdit(acc)} onDelete={() => onDelete(acc.id)} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

function ActionsCell({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    const [visible, setVisible] = useState(false)
    const btn: React.CSSProperties = {
        width: 20, height: 20, border: '0.5px solid #E5E7EB', borderRadius: 4,
        background: '#fff', color: '#6B7280', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
    }
    return (
        <div
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            style={{
                minHeight: 30, display: 'flex', alignItems: 'center',
                justifyContent: 'flex-end', gap: 3, paddingRight: 6,
                opacity: visible ? 1 : 0, transition: 'opacity .1s'
            }}
        >
            <button style={btn} onClick={onEdit} title="Editar">✎</button>
            <button style={btn} onClick={onDelete} title="Excluir">✕</button>
        </div>
    )
}

// ─── Tree View ────────────────────────────────────────────────────────────────

interface TreeViewProps {
    accounts: ChartAccount[]
    expanded: Set<string>
    search: string
    typeFilter: string
    onToggle: (id: string) => void
}

function TreeView({ accounts, expanded, search, typeFilter, onToggle }: TreeViewProps) {
    const q = search.toLowerCase()
    const isFiltered = !!q || typeFilter !== 'ALL'

    function walk(parentId: string | null, depth: number): React.ReactNode {
        return accounts
            .filter(a => a.parentId === parentId && (isFiltered ? matchesFilter(a, q, typeFilter) : true))
            .map(a => {
                const hasKids = hasChildren(accounts, a.id)
                const isOpen = expanded.has(a.id) || isFiltered
                return (
                    <div key={a.id}>
                        <div
                            onClick={() => onToggle(a.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 10px', borderBottom: '0.5px solid #F7F7F7',
                                cursor: 'pointer', minHeight: 30
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                            <span style={{ width: depth * 16, flexShrink: 0 }} />

                            {hasKids
                                ? <span style={{
                                    fontSize: 7, color: '#C4C9D4', width: 9, textAlign: 'center',
                                    flexShrink: 0, display: 'inline-block', transition: 'transform .13s',
                                    transform: isOpen ? 'rotate(90deg)' : 'none'
                                }}>▶</span>
                                : <span style={{ width: 9, flexShrink: 0 }} />
                            }

                            <span style={{
                                fontFamily: 'monospace', fontSize: 10, color: '#B0B7C3',
                                minWidth: 72, flexShrink: 0
                            }}>
                                {a.code}
                            </span>

                            <span style={{
                                fontSize: 11, color: '#111', flex: 1,
                                fontWeight: a.isAnalytic ? 400 : 500,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {a.name}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexShrink: 0 }}>
                                {a.isAnalytic && a.shortCode && (
                                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#374151', fontWeight: 500 }}>
                                        {a.shortCode}
                                    </span>
                                )}
                                <NaturePill nature={a.nature} />
                                <TypePill type={a.type} />
                                {a.spedCode && (
                                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#B0B7C3' }}>
                                        {a.spedCode}
                                    </span>
                                )}
                                <StatusDot active={a.isActive} />
                            </div>
                        </div>

                        {isOpen && walk(a.id, depth + 1)}
                    </div>
                )
            })
    }

    return (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            {walk(null, 0)}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
    const qc = useQueryClient()

    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounting', 'accounts'],
        queryFn: fetchAccounts,
    })

    const deleteMutation = useMutation({
        mutationFn: deleteAccount,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting', 'accounts'] }),
    })

    const [mode, setMode] = useState<'table' | 'tree'>('table')
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('ALL')
    const [bootstrapped, setBootstrapped] = useState(false)

    // Expande níveis 1–2 na primeira carga
    if (!bootstrapped && accounts.length > 0) {
        setExpanded(new Set(accounts.filter(a => a.level <= 2).map(a => a.id)))
        setBootstrapped(true)
    }

    const toggle = useCallback((id: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    function handleEdit(acc: ChartAccount) {
        // TODO: abrir drawer/modal de edição
        console.log('edit', acc.id)
    }

    function handleDelete(id: string) {
        if (confirm('Excluir esta conta?')) deleteMutation.mutate(id)
    }

    // ── Styles reutilizáveis ────────────────────────────────────────────────────
    const segBtn = (active: boolean): React.CSSProperties => ({
        height: 28, padding: '0 10px', fontSize: 11, fontWeight: 500, border: 'none',
        cursor: 'pointer', transition: 'all .12s',
        background: active ? '#2563EB' : '#fff',
        color: active ? '#fff' : '#6B7280',
    })

    const chipStyle = (active: boolean): React.CSSProperties => ({
        height: 22, padding: '0 9px', fontSize: 10, fontWeight: 500, cursor: 'pointer',
        border: `0.5px solid ${active ? '#2563EB' : '#D1D5DB'}`,
        borderRadius: 20, transition: 'all .1s',
        background: active ? '#EFF6FF' : '#fff',
        color: active ? '#1D4ED8' : '#6B7280',
    })

    return (
        <div style={{ padding: '1.5rem 2rem', fontFamily: 'var(--font-sans)' }}>

            {/* Top bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1rem', gap: 12, flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        fontSize: 10, fontWeight: 500, letterSpacing: '.5px',
                        padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8'
                    }}>
                        ◆ CONTÁBIL
                    </span>
                    <span style={{ width: 1, height: 13, background: '#E5E7EB' }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Plano de Contas</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Busca */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
                            stroke="#9CA3AF" strokeWidth="2"
                            style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}>
                            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" />
                        </svg>
                        <input
                            type="text" value={search} placeholder="Código, nome ou SPED…"
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                height: 28, padding: '0 8px 0 26px', border: '0.5px solid #D1D5DB',
                                borderRadius: 6, fontSize: 11, background: '#fff', color: '#111',
                                width: 170, outline: 'none'
                            }}
                        />
                    </div>

                    {/* Toggle */}
                    <div style={{
                        display: 'flex', border: '0.5px solid #D1D5DB',
                        borderRadius: 6, overflow: 'hidden'
                    }}>
                        <button onClick={() => setMode('table')} style={segBtn(mode === 'table')}>Tabela</button>
                        <button onClick={() => setMode('tree')} style={segBtn(mode === 'tree')}>Árvore</button>
                    </div>

                    {/* Nova conta */}
                    <button style={{
                        height: 28, padding: '0 11px', fontSize: 11, fontWeight: 500,
                        background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer'
                    }}>
                        + Conta
                    </button>
                </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                    <button key={f.value} onClick={() => setTypeFilter(f.value)}
                        style={chipStyle(typeFilter === f.value)}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                    Carregando…
                </div>
            ) : mode === 'table' ? (
                <TableView
                    accounts={accounts} expanded={expanded}
                    search={search} typeFilter={typeFilter}
                    onToggle={toggle} onEdit={handleEdit} onDelete={handleDelete}
                />
            ) : (
                <TreeView
                    accounts={accounts} expanded={expanded}
                    search={search} typeFilter={typeFilter}
                    onToggle={toggle}
                />
            )}
        </div>
    )
}