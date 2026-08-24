// apps/frontend/src/pages/accounting/AccountsPage.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useCompany } from '../../contexts/CompanyContext';
import { Calendar, Edit } from 'lucide-react';
import { AccountTree } from '../../components/accounting/AccountTree';
import { AccountMaintenanceModal } from './AccountMaintenanceModal';
import { MatrizImportModal } from './MatrizImportModal';

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
    reducedCode?: string;
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

    const [showMatrizModal, setShowMatrizModal] = useState(false);
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
                                onClick={() => setShowMatrizModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors border border-purple-200"
                                title="Importar Plano de Contas Matriz LEDGR"
                            >
                                <span>Importar Matriz</span>
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

                        <SmartDateInput
                            value={referenceDate}
                            onChange={(v) => setReferenceDate(v)}
                            className="text-sm font-semibold text-blue-600 focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center gap-6 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-400">
                    <span>✓ = sem divergência</span>
                    <span className="text-amber-500">±valor = divergência</span>
                    <span className="text-slate-300">— = sem saldo ECD importado</span>
                </div>

                <div className="p-2">
                    {treeData.length > 0 ? (
                        <AccountTree nodes={treeData} />
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
            {showMatrizModal && (
                <MatrizImportModal
                    onClose={() => setShowMatrizModal(false)}
                    onSuccess={() => { setShowMatrizModal(false); fetchTree(); }}
                />
            )}
        </div>
    );
}
