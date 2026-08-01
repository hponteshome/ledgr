// apps/frontend/src/components/accounting/AccountTree.tsx

import React, { useState } from 'react';
import { FiChevronRight, FiChevronDown, FiFolder, FiFileText } from 'react-icons/fi';

interface AccountNode {
    id: string;
    code: string;
    name?: string;
    description?: string;
    level?: number;
    type?: string;
    nature?: string;
    isAnalytic?: boolean;
    isAnalytical?: boolean;
    isActive?: boolean;
    balance?: number;
    calculatedBalance?: number;
    ecdBalance?: number | null;
    difference?: number | null;
    reducedCode?: string;
    spedCode?: string;
    children?: AccountNode[];
}

interface AccountTreeProps {
    nodes: AccountNode[];
    renderBalances?: (node: AccountNode) => React.ReactNode;
}

// -- Formatadores -------------------------------------------------------------

const fmt = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return <span className="text-slate-300 text-xs">-</span>;
    }
    const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className={value < 0 ? 'text-red-500' : 'text-emerald-600'}>
            {value < 0 ? `(${abs})` : abs}
        </span>
    );
};

const fmtDiff = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return <span className="text-slate-300 text-xs">-</span>;
    }
    if (Math.abs(value) < 0.01) {
        return <span className="text-green-500 text-xs">check</span>;
    }
    const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className="text-amber-600 font-bold text-xs">
            {value > 0 ? '+' : '-'}{abs}
        </span>
    );
};

// -- Badge de Tipo --------------------------------------------------------------

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
    ASSET:     { label: 'Ativo',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    LIABILITY: { label: 'Passivo',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    EQUITY:    { label: 'PL',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    REVENUE:   { label: 'Receita',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    EXPENSE:   { label: 'Despesa',  cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const TypeBadge: React.FC<{ type?: string }> = ({ type }) => {
    if (!type) return <span className="text-slate-300 text-xs">-</span>;
    const s = TYPE_STYLE[type];
    if (!s) return <span className="text-[10px] text-slate-400">{type}</span>;
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${s.cls}`}>
            {s.label}
        </span>
    );
};

const StatusBadge: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
    const active = isActive ?? true;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {active ? 'Ativa' : 'Inativa'}
        </span>
    );
};

// -- Linha (recursiva, retorna <tr> + filhos como irmaos via Fragment) --------

const TreeRow: React.FC<{
    node: AccountNode;
    depth: number;
    renderBalances?: (node: AccountNode) => React.ReactNode;
}> = ({ node, depth, renderBalances }) => {
    const [isOpen, setIsOpen] = useState((node.level ?? depth + 1) <= 2);
    const hasChildren = !!node.children && node.children.length > 0;
    const isAnalytic = node.isAnalytic ?? node.isAnalytical ?? false;
    const isSynthetic = !isAnalytic;
    const label = node.name || node.description || '';

    const calculatedBalance = node.calculatedBalance ?? node.balance ?? 0;
    const ecdBalance = node.ecdBalance;
    const difference = node.difference;

    return (
        <>
            <tr
                className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${hasChildren ? 'cursor-pointer' : ''
                    } ${isSynthetic ? 'font-semibold text-slate-800 bg-slate-50/30' : 'text-slate-600'}`}
                onClick={() => hasChildren && setIsOpen(!isOpen)}
            >
                <td className="py-1.5 px-3">
                    <div className="flex items-center min-w-0">
                        <div style={{ width: `${depth * 16}px`, flexShrink: 0 }} />
                        <span className="text-slate-400 mr-1.5 flex-shrink-0">
                            {hasChildren
                                ? (isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />)
                                : <span className="w-3.5 inline-block" />}
                        </span>
                        <span className="mr-2 flex-shrink-0">
                            {isSynthetic
                                ? <FiFolder size={14} className="text-blue-400 fill-blue-50" />
                                : <FiFileText size={14} className="text-slate-300" />}
                        </span>
                        <span className="font-mono text-[11px] text-blue-600 mr-2 flex-shrink-0 w-28">{node.code}</span>
                        <span className="text-xs tracking-tight truncate">{label}</span>
                    </div>
                </td>

                <td className="text-center text-[11px] text-slate-400 px-2">{node.level ?? '-'}</td>

                <td className="text-center px-2"><TypeBadge type={node.type} /></td>

                <td className="text-center text-[11px] text-slate-500 px-2">
                    {node.nature === 'DEBIT' ? 'D' : node.nature === 'CREDIT' ? 'C' : '-'}
                </td>

                <td className="text-center px-2"><StatusBadge isActive={node.isActive} /></td>

                <td className="text-center px-2">
                    <span className="font-mono text-[10px] text-slate-500 bg-blue-50 border border-blue-100 px-1 rounded inline-block">
                        {node.reducedCode || ''}
                    </span>
                </td>

                <td className="px-2">
                    <span
                        className="font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 rounded inline-block max-w-full truncate"
                        title={node.spedCode ? `Conta referencial SPED: ${node.spedCode}` : 'Sem conta referencial SPED'}
                    >
                        {node.spedCode || '-'}
                    </span>
                </td>

                {renderBalances ? renderBalances(node) : (
                    <>
                        <td className="text-right font-mono text-sm pr-3">
                            <span className={isSynthetic ? 'font-bold' : ''}>{fmt(calculatedBalance)}</span>
                        </td>
                        <td className="text-right font-mono text-sm text-slate-400 pr-3">{fmt(ecdBalance)}</td>
                        <td className="text-right font-mono pr-2">{fmtDiff(difference)}</td>
                    </>
                )}
            </tr>

            {hasChildren && isOpen && node.children!.map(child => (
                <TreeRow key={child.id} node={child} depth={depth + 1} renderBalances={renderBalances} />
            ))}
        </>
    );
};

// -- Componente principal -------------------------------------------------------

export const AccountTree: React.FC<AccountTreeProps> = ({ nodes, renderBalances }) => {
    return (
        <div className="rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '6%' }} />
                </colgroup>
                <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="text-left py-2 px-3">Conta / Descricao</th>
                        <th className="text-center py-2 px-2">Nivel</th>
                        <th className="text-center py-2 px-2">Tipo</th>
                        <th className="text-center py-2 px-2">Nat.</th>
                        <th className="text-center py-2 px-2">Status</th>
                        <th className="text-center py-2 px-2">Cod. Red.</th>
                        <th className="text-left py-2 px-2">Ref. SPED</th>
                        <th className="text-right py-2 pr-3">Saldo Calculado</th>
                        <th className="text-right py-2 pr-3">Saldo ECD</th>
                        <th className="text-right py-2 pr-2">Diferenca</th>
                    </tr>
                </thead>
                <tbody>
                    {nodes.map(node => (
                        <TreeRow key={node.id} node={node} depth={0} renderBalances={renderBalances} />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
