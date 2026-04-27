// apps/frontend/src/pages/accounting/AccountsPage.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useCompany } from '../../contexts/CompanyContext';
import { Calendar, Edit } from 'lucide-react';
import { AccountTree } from '../../components/accounting/AccountTree';
import { AccountMaintenanceModal } from './AccountMaintenanceModal';
import { IobImportModal } from './IobImportModal';

import { IobLotdImportModal } from './IobLotdImportModal';
interface Account {
    id: string;
    code: string;
    name: string;
    level: number;
    isAnalytic: boolean;
    type: string;
    calculatedBalance: number;
    ecdBalance: number | null;
    difference: number | null;
    children?: Account[];
}

export default function AccountsPage() {
    const { activeCompany } = useCompany();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('action') === 'maintenance') {
            setShowMaintenanceModal(true);
        }
    }, [location.search]);
    const [treeData, setTreeData] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    // 🔴 ESTADO PARA CONTROLAR O MODAL
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

    const [showIobModal, setShowIobModal] = useState(false);
    const [showLotdModal, setShowLotdModal] = useState(false);
    const [referenceDate, setReferenceDate] = useState(
        new Date().toISOString().split('T')[0]
    );

    const fetchTree = async () => {
        if (!activeCompany) return;
        setLoading(true);
        try {
            const response = await api.get('/chart-of-accounts/tree', {
                params: { companyId: activeCompany.id, date: referenceDate }
            });
            setTreeData(response.data);
        } catch (error) {
            console.error('Erro ao carregar árvore de contas:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTree(); }, [activeCompany, referenceDate]);

    const totalAccounts = useMemo(() => {
        const count = (nodes: Account[]): number =>
            nodes.reduce((acc, node) => acc + 1 + (node.children ? count(node.children) : 0), 0);
        return count(treeData);
    }, [treeData]);

    const fmt = (value: number | null) => {
        if (value === null) return <span className="text-slate-300 text-xs">—</span>;
        const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const neg = value < 0;
        return (
            <span className={neg ? 'text-red-500' : ''}>
                {neg ? `(${abs})` : abs}
            </span>
        );
    };

    const fmtDiff = (value: number | null) => {
        if (value === null) return <span className="text-slate-300 text-xs">—</span>;
        if (Math.abs(value) < 0.01) return <span className="text-green-500 text-xs font-bold">✓</span>;
        const abs = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return (
            <span className="text-amber-600 font-bold text-xs">
                {value > 0 ? '+' : '-'}{abs}
            </span>
        );
    };

    if (loading && treeData.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <header className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    {/* 🔴 TÍTULO COM BOTÃO AO LADO - CORRIGIDO */}
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                                Plano de Contas
                            </h1>
                            <button
                                onClick={() => setShowMaintenanceModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors border border-blue-200"
                                title="Gerenciar / Alterar Plano de Contas"
                            >
                                <Edit size={14} />
                                <span>Alterar Plano</span>
                            </button>
                            <button
                                onClick={() => setShowIobModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors border border-purple-200"
                                title="Importar Plano de Contas IOB"
                            >
                                <span>Importar IOB</span>
                            </button>
                        </div>
                        <p className="text-slate-500 text-sm">
                            {activeCompany
                                ? `Estrutura contábil: ${activeCompany.tradeName}`
                                : 'Selecione uma empresa para visualizar o plano'}
                        </p>
                    </div>

                    {/* Seletor de data */}
                    <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 px-2 border-r border-slate-100">
                            <Calendar size={16} />
                            <span className="text-xs font-medium uppercase tracking-wider">Saldos em:</span>
                        </div>

                        <input
                            type="date"
                            value={referenceDate}
                            max="9999-12-31"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const year = val.split('-')[0];
                                if (year.length <= 4) setReferenceDate(val);
                            }}
                            className="text-sm font-semibold text-blue-600 focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Cabeçalho das colunas */}
                <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-5">Conta / Descrição</div>
                    <div className="col-span-3 text-right">Saldo Calculado</div>
                    <div className="col-span-2 text-right">Saldo ECD</div>
                    <div className="col-span-2 text-right">Diferença</div>
                </div>

                {/* Legenda */}
                <div className="flex items-center gap-6 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-400">
                    <span>✓ = sem divergência</span>
                    <span className="text-amber-500">±valor = divergência</span>
                    <span className="text-slate-300">— = sem saldo ECD importado</span>
                </div>

                <div className="p-2">
                    {treeData.length > 0 ? (
                        <AccountTree
                            nodes={treeData}
                            renderBalances={(node: Account) => (
                                <>
                                    <div className="col-span-3 text-right font-mono text-sm pr-2">
                                        {fmt(node.calculatedBalance)}
                                    </div>
                                    <div className="col-span-2 text-right font-mono text-sm text-slate-400 pr-2">
                                        {fmt(node.ecdBalance)}
                                    </div>
                                    <div className="col-span-2 text-right font-mono pr-2">
                                        {fmtDiff(node.difference)}
                                    </div>
                                </>
                            )}
                        />
                    ) : (
                        <div className="py-20 text-center text-slate-400">
                            <p>Nenhuma conta encontrada até {new Date(referenceDate).toLocaleDateString('pt-BR')}.</p>
                            <p className="text-xs mt-2 text-slate-300">
                                Importe um arquivo SPED ECD em <strong>SPED → ECD</strong> para popular o plano de contas.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-mono">
                        {totalAccounts} CONTAS CARREGADAS
                    </span>
                    <span className="text-[10px] text-slate-400 italic">
                        Saldo Calculado = movimentação real · Saldo ECD = fotografia do SPED importado
                    </span>
                </div>
            </div>

            {/* 🔴 MODAL DE MANUTENÇÃO */}
            <AccountMaintenanceModal
                open={showMaintenanceModal}
                onClose={() => setShowMaintenanceModal(false)}
                onSuccess={() => {
                    fetchTree();
                }}
            />
            {showIobModal && (
                <IobImportModal
                    onClose={() => setShowIobModal(false)}
                    onSuccess={() => { setShowIobModal(false); fetchTree(); }}
                />
            )}
        </div>
    );
}
