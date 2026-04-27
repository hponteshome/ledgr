// apps/frontend/src/components/accounting/AccountTree.tsx

import React, { useState } from 'react';
import { FiChevronRight, FiChevronDown, FiFolder, FiFileText } from 'react-icons/fi';

interface AccountNode {
    id: string;
    code: string;
    name?: string;
    description?: string;
    isAnalytic?: boolean;
    isAnalytical?: boolean;
    // Saldo legado (compatibilidade)
    balance?: number;
    // Novos campos de duplo saldo
    calculatedBalance?: number;
    ecdBalance?: number | null;
    difference?: number | null;
    children?: AccountNode[];
}

interface AccountTreeProps {
    nodes: AccountNode[];
}

// ── Formatadores ────────────────────────────────────────────────────────────

const fmt = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return <span className="text-slate-300 text-xs">—</span>;
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
        return <span className="text-slate-300 text-xs">—</span>;
    }
    if (Math.abs(value) < 0.01) {
        return <span className="text-green-500 text-xs">✓</span>;
    }
    const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className="text-amber-600 font-bold text-xs">
            {value > 0 ? '+' : '-'}{abs}
        </span>
    );
};

// ── Nó da árvore ────────────────────────────────────────────────────────────

const TreeNode: React.FC<{ node: AccountNode }> = ({ node }) => {
    const [isOpen, setIsOpen] = useState(node.code.split('.').length <= 2);
    const hasChildren = node.children && node.children.length > 0;
    const isAnalytic = node.isAnalytic ?? node.isAnalytical ?? false;
    const label = node.name || node.description || '';
    const depth = node.code.split('.').length - 1;

    // Suporte legado: se vier só balance, usa ele como calculatedBalance
    const calculatedBalance = node.calculatedBalance ?? node.balance ?? 0;
    const ecdBalance = node.ecdBalance;
    const difference = node.difference;

    const isSynthetic = !isAnalytic;

    return (
        <div className="select-none">
            <div
                className={`grid grid-cols-12 items-center py-1.5 px-3 hover:bg-slate-50/80 cursor-pointer border-b border-slate-50 transition-colors ${isSynthetic
                        ? 'font-semibold text-slate-800 bg-slate-50/30'
                        : 'text-slate-600'
                    }`}
                onClick={() => hasChildren && setIsOpen(!isOpen)}
            >
                {/* Coluna 1 — Conta / Descrição */}
                <div className="col-span-5 flex items-center min-w-0">
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
                    <span className="font-mono text-[11px] text-blue-600 mr-3 flex-shrink-0 w-20">
                        {node.code}
                    </span>
                    <span className="text-xs tracking-tight truncate">{label}</span>
                </div>

                {/* Coluna 2 — Saldo Calculado */}
                <div className="col-span-3 text-right font-mono text-sm pr-3">
                    <span className={isSynthetic ? 'font-bold' : ''}>
                        {fmt(calculatedBalance)}
                    </span>
                    {isAnalytic && (
                        <span className="block text-[8px] text-slate-300 uppercase tracking-tighter">
                            Analítica
                        </span>
                    )}
                </div>

                {/* Coluna 3 — Saldo ECD */}
                <div className="col-span-2 text-right font-mono text-sm text-slate-400 pr-3">
                    {fmt(ecdBalance)}
                </div>

                {/* Coluna 4 — Diferença */}
                <div className="col-span-2 text-right font-mono pr-2">
                    {fmtDiff(difference)}
                </div>
            </div>

            {hasChildren && isOpen && (
                <div>
                    {node.children!.map(child => (
                        <TreeNode key={child.id} node={child} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Componente principal ─────────────────────────────────────────────────────

export const AccountTree: React.FC<AccountTreeProps> = ({ nodes }) => {
    return (
        <div className="rounded-lg overflow-hidden">
            {/* Cabeçalho interno da árvore */}
            <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-5 flex items-center gap-2 pl-12">
                    Código / Descrição
                </div>
                <div className="col-span-3 text-right pr-3">Saldo Calculado</div>
                <div className="col-span-2 text-right pr-3">Saldo ECD</div>
                <div className="col-span-2 text-right pr-2">Diferença</div>
            </div>

            {nodes.map(node => (
                <TreeNode key={node.id} node={node} />
            ))}
        </div>
    );
};