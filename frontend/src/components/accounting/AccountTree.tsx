// apps/frontend/src/components/accounting/AccountTree.tsx

import React, { useState, useEffect, useRef } from 'react';
import { FiChevronRight, FiChevronDown, FiFolder, FiFileText, FiEdit2, FiPlusCircle } from 'react-icons/fi';

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
    origin?: string;
    children?: AccountNode[];
}

interface AccountTreeProps {
    nodes: AccountNode[];
    renderBalances?: (node: AccountNode) => React.ReactNode;
    expandSignal?: number;
    expandTarget?: boolean;
    // NOVO (11/09/2026): acoes diretas por linha (editar / adicionar conta
    // filha) - evita ter que abrir o modal "Alterar Plano" e navegar ate a
    // conta so pra editar/cadastrar. Opcionais - quem nao passar nao ve
    // a coluna de acoes.
    onEditAccount?: (nodeId: string) => void;
    onAddChildAccount?: (parentId: string, parentCode: string) => void;
}

// -- Formatadores -------------------------------------------------------------

const fmt = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
        return <span className="text-slate-300 text-[13px]">-</span>;
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
        return <span className="text-slate-300 text-[13px]">-</span>;
    }
    if (Math.abs(value) < 0.01) {
        return <span className="text-green-500 text-[13px]" title="Sem divergência">✓</span>;
    }
    const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className="text-amber-600 font-bold text-[13px]">
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
    if (!type) return <span className="text-slate-300 text-[13px]">-</span>;
    const s = TYPE_STYLE[type];
    if (!s) return <span className="text-[13px] text-slate-400">{type}</span>;
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap ${s.cls}`}>
            {s.label}
        </span>
    );
};

const StatusBadge: React.FC<{ isActive?: boolean }> = ({ isActive }) => {
    const active = isActive ?? true;
    return (
        <span className={`inline-flex items-center gap-1 text-[13px] font-medium ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {active ? 'Ativa' : 'Inativa'}
        </span>
    );
};

// NOVO (17/09/2026): badge de origem da conta - MATRIZ (cadastrada/editada
// direto no Plano de Contas) vs ECD_NATIVE (nasceu de importacao SPED ECD,
// arvore historica paralela). Achado real: contas com origin em branco
// ficavam invisiveis pro resolvedor de codigo reduzido do import manual
// (exige origin=MATRIZ explicitamente) - corrigido no banco, esta coluna
// deixa o dado visivel pra conferencia visual daqui pra frente.
const ORIGIN_STYLE: Record<string, { label: string; cls: string }> = {
    MATRIZ:     { label: 'Matriz', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    ECD_NATIVE: { label: 'ECD',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const OriginBadge: React.FC<{ origin?: string }> = ({ origin }) => {
    if (!origin) return <span className="text-slate-300 text-[13px]">-</span>;
    const s = ORIGIN_STYLE[origin];
    if (!s) return <span className="text-[13px] text-slate-400">{origin}</span>;
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded border text-[13px] font-medium whitespace-nowrap ${s.cls}`}>
            {s.label}
        </span>
    );
};

// -- Linha (recursiva, retorna <tr> + filhos como irmaos via Fragment) --------

const TreeRow: React.FC<{
    node: AccountNode;
    depth: number;
    renderBalances?: (node: AccountNode) => React.ReactNode;
    expandSignal?: number;
    expandTarget?: boolean;
    onEditAccount?: (nodeId: string) => void;
    onAddChildAccount?: (parentId: string, parentCode: string) => void;
}> = ({ node, depth, renderBalances, expandSignal, expandTarget, onEditAccount, onAddChildAccount }) => {
    const [isOpen, setIsOpen] = useState((node.level ?? depth + 1) <= 2);
    const hasChildren = !!node.children && node.children.length > 0;

    // NOVO: expandir/recolher tudo - sinal externo (contador que muda a
    // cada clique no botao da tela) forca todas as linhas com filhos a
    // abrir ou fechar de uma vez, sem depender de remontar a arvore.
    useEffect(() => {
        if (expandSignal !== undefined && hasChildren) setIsOpen(!!expandTarget);
    }, [expandSignal]);
    const isAnalytic = node.isAnalytic ?? node.isAnalytical ?? false;
    const isSynthetic = !isAnalytic;
    const label = node.name || node.description || '';

    const calculatedBalance = node.calculatedBalance ?? node.balance ?? 0;
    const ecdBalance = node.ecdBalance;
    const difference = node.difference;

    return (
        <>
            <tr
                className={`border-b border-slate-200 hover:bg-slate-200 transition-colors odd:bg-white even:bg-slate-100 ${hasChildren ? 'cursor-pointer' : ''
                    } ${isSynthetic ? 'font-semibold text-slate-800' : 'text-slate-600'}`}
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
                        <span className="font-mono text-[13px] text-blue-600 mr-2 flex-shrink-0 w-28">{node.code}</span>
                        <span className="text-[13px] tracking-tight truncate" title={label}>{label}</span>
                    </div>
                </td>

                <td className="text-center px-2">
                    {node.reducedCode && (
                        <span className="font-mono font-bold text-[13px] text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded inline-block">
                            {node.reducedCode}
                        </span>
                    )}
                </td>

                <td className="text-center text-[13px] text-slate-400 px-2">{node.level ?? '-'}</td>

                <td className="text-center px-2"><TypeBadge type={node.type} /></td>

                <td className="text-center text-[13px] text-slate-500 px-2">
                    {node.nature === 'DEBIT' ? 'D' : node.nature === 'CREDIT' ? 'C' : '-'}
                </td>

                <td className="text-center px-2"><StatusBadge isActive={node.isActive} /></td>

                <td className="text-center px-2"><OriginBadge origin={node.origin} /></td>

                <td className="px-2">
                    <span
                        className="font-mono text-[13px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 rounded inline-block max-w-full truncate"
                        title={node.spedCode ? `Conta referencial SPED: ${node.spedCode}` : 'Sem conta referencial SPED'}
                    >
                        {node.spedCode || '-'}
                    </span>
                </td>

                {renderBalances ? renderBalances(node) : (
                    <>
                        <td className="text-right font-mono text-[13px] pr-3 truncate">
                            <span className={isSynthetic ? 'font-bold' : ''}>{fmt(calculatedBalance)}</span>
                        </td>
                        <td className="text-right font-mono text-[13px] text-slate-400 pr-3 truncate">{fmt(ecdBalance)}</td>
                        <td className="text-right font-mono pr-2 truncate">{fmtDiff(difference)}</td>
                    </>
                )}

                {(onEditAccount || onAddChildAccount) && (
                    <td className="text-center px-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                            {onEditAccount && (
                                <button onClick={() => onEditAccount(node.id)} title="Editar conta"
                                    className="text-slate-400 hover:text-blue-600 transition-colors">
                                    <FiEdit2 size={13} />
                                </button>
                            )}
                            {onAddChildAccount && (
                                <button onClick={() => onAddChildAccount(node.id, node.code)} title="Adicionar conta filha"
                                    className="text-slate-400 hover:text-emerald-600 transition-colors">
                                    <FiPlusCircle size={13} />
                                </button>
                            )}
                        </div>
                    </td>
                )}
            </tr>

            {hasChildren && isOpen && node.children!.map(child => (
                <TreeRow key={child.id} node={child} depth={depth + 1} renderBalances={renderBalances} expandSignal={expandSignal} expandTarget={expandTarget} onEditAccount={onEditAccount} onAddChildAccount={onAddChildAccount} />
            ))}
        </>
    );
};

// -- Colunas redimensionaveis --------------------------------------------------
// Larguras em px. A coluna "Conta / Descricao" absorve o espaco livre da tela
// (dinamica) enquanto o usuario nao ajustar; ao arrastar a borda de qualquer
// coluna a largura passa a ser fixa e fica salva no navegador.

type ColKey = 'name' | 'red' | 'level' | 'type' | 'nat' | 'status' | 'sped' | 'calc' | 'ecd' | 'diff' | 'actions';

const COLS: { key: ColKey; label: string; min: number; def: number; cls: string }[] = [
    { key: 'name',    label: 'Conta / Descricao', min: 200, def: 320, cls: 'text-left py-2 px-3' },
    { key: 'red',     label: 'Cod. Red.',         min: 60,  def: 84,  cls: 'text-center py-2 px-2' },
    { key: 'level',   label: 'Nivel',             min: 44,  def: 56,  cls: 'text-center py-2 px-2' },
    { key: 'type',    label: 'Tipo',              min: 60,  def: 84,  cls: 'text-center py-2 px-2' },
    { key: 'nat',     label: 'Nat.',              min: 40,  def: 52,  cls: 'text-center py-2 px-2' },
    { key: 'status',  label: 'Status',            min: 64,  def: 88,  cls: 'text-center py-2 px-2' },
    { key: 'sped',    label: 'Ref. SPED',         min: 70,  def: 108, cls: 'text-left py-2 px-2' },
    { key: 'calc',    label: 'Saldo Calculado',   min: 90,  def: 150, cls: 'text-right py-2 pr-3' },
    { key: 'ecd',     label: 'Saldo ECD',         min: 90,  def: 130, cls: 'text-right py-2 pr-3' },
    { key: 'diff',    label: 'Diferenca',         min: 80,  def: 120, cls: 'text-right py-2 pr-2' },
    { key: 'actions', label: 'Acoes',             min: 52,  def: 64,  cls: 'text-center py-2 px-2' },
];

const COL_LS_KEY = 'ledgr:accountTree:colWidths:v1';

type ColOverrides = Partial<Record<ColKey, number>>;

const loadOverrides = (): ColOverrides => {
    try {
        const raw = localStorage.getItem(COL_LS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

// -- Componente principal -------------------------------------------------------

export const AccountTree: React.FC<AccountTreeProps> = ({ nodes, renderBalances, expandSignal, expandTarget, onEditAccount, onAddChildAccount }) => {
    const showActions = !!(onEditAccount || onAddChildAccount);
    const cols = COLS.filter(c => c.key !== 'actions' || showActions);

    const wrapRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(0);
    const [overrides, setOverrides] = useState<ColOverrides>(loadOverrides);
    const [dragging, setDragging] = useState(false);

    // Largura disponivel do container (acompanha resize da janela / sidebar)
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        setContainerW(el.clientWidth);
        const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Persiste ao soltar o mouse (nao a cada pixel arrastado)
    useEffect(() => {
        if (dragging) return;
        try { localStorage.setItem(COL_LS_KEY, JSON.stringify(overrides)); } catch { /* ignora */ }
    }, [overrides, dragging]);

    const othersSum = cols
        .filter(c => c.key !== 'name')
        .reduce((s, c) => s + Math.max(c.min, overrides[c.key] ?? c.def), 0);

    const widthOf = (c: typeof COLS[number]): number => {
        const o = overrides[c.key];
        if (o !== undefined) return Math.max(c.min, o);
        if (c.key === 'name') return Math.max(c.def, containerW - othersSum);
        return c.def;
    };

    const totalW = cols.reduce((s, c) => s + widthOf(c), 0);

    const startResize = (e: React.PointerEvent<HTMLDivElement>, c: typeof COLS[number]) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = widthOf(c);
        setDragging(true);
        document.body.style.userSelect = 'none';

        const onMove = (ev: PointerEvent) => {
            const w = Math.max(c.min, Math.round(startW + ev.clientX - startX));
            setOverrides(prev => ({ ...prev, [c.key]: w }));
        };
        const onUp = () => {
            target.removeEventListener('pointermove', onMove);
            target.removeEventListener('pointerup', onUp);
            target.removeEventListener('pointercancel', onUp);
            document.body.style.userSelect = '';
            setDragging(false);
        };
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerup', onUp);
        target.addEventListener('pointercancel', onUp);
    };

    const resetCol = (key: ColKey) =>
        setOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });

    const hasOverrides = Object.keys(overrides).length > 0;

    return (
        <div>
            {hasOverrides && (
                <div className="flex justify-end pb-1">
                    <button
                        type="button"
                        onClick={() => setOverrides({})}
                        className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
                        title="Voltar ao ajuste automatico de todas as colunas"
                    >
                        Restaurar larguras das colunas
                    </button>
                </div>
            )}
            <div ref={wrapRef} className="rounded-lg overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'auto', scrollbarColor: '#94A3B8 #F1F5F9' }}>
                <table className="table-fixed border-collapse text-[13px]" style={{ width: totalW }}>
                    <colgroup>
                        {cols.map(c => <col key={c.key} style={{ width: widthOf(c) }} />)}
                    </colgroup>
                    <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                            {cols.map(c => (
                                <th
                                    key={c.key}
                                    title={c.label}
                                    className={`${c.cls} relative overflow-hidden text-ellipsis whitespace-nowrap select-none`}
                                >
                                    {c.label}
                                    <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        title="Arraste para redimensionar - duplo clique restaura"
                                        onPointerDown={e => startResize(e, c)}
                                        onDoubleClick={() => resetCol(c.key)}
                                        onClick={e => e.stopPropagation()}
                                        className="group absolute top-0 right-0 h-full w-2 cursor-col-resize"
                                        style={{ touchAction: 'none' }}
                                    >
                                        <div className="mx-auto h-full w-px bg-slate-300 group-hover:w-0.5 group-hover:bg-blue-400 transition-colors" />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {nodes.map(node => (
                            <TreeRow key={node.id} node={node} depth={0} renderBalances={renderBalances} expandSignal={expandSignal} expandTarget={expandTarget} onEditAccount={onEditAccount} onAddChildAccount={onAddChildAccount} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
