// ============================================================
// LEDGR — frontend/src/pages/assets/RentalContractsListPage.tsx
// Quadro Resumo de Locação — lista de todos os contratos de locação
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { RentalContractDetailModal } from './modals/RentalContractDetailModal';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

const STATUS_LABELS: Record<string, string> = {
    ATIVO: 'Ativo',
    ENCERRADO: 'Encerrado',
    RESCINDIDO: 'Rescindido',
};

const STATUS_COLORS: Record<string, string> = {
    ATIVO: 'bg-green-100 text-green-700',
    ENCERRADO: 'bg-gray-100 text-gray-600',
    RESCINDIDO: 'bg-red-100 text-red-700',
};

function fmtCurrency(v: number | string | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(v: string | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function RentalContractsListPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { activeCompany } = useCompany();

    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ATIVO');
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailTitle, setDetailTitle] = useState('');

    useEffect(() => {
        if (!activeCompany?.id) return;
        setLoading(true);
        const qs = statusFilter ? `?status=${statusFilter}` : '';
        fetch(`${API}/rental-contracts${qs}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-company-id': activeCompany.id,
            },
        })
            .then(res => res.json())
            .then(data => setContracts(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [token, activeCompany?.id, statusFilter]);

    const totalMensal = contracts
        .filter(c => c.status === 'ATIVO')
        .reduce((sum, c) => sum + (Number(c.rentAmount) || 0), 0);

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-1">
                <h1 className="text-xl font-bold text-gray-900">Quadro Resumo de Locação</h1>
            </div>
            <p className="text-sm text-gray-500 mb-4">Todos os contratos de locação vinculados aos imóveis da empresa.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Contratos Ativos</div>
                    <div className="text-2xl font-bold text-gray-900">{contracts.filter(c => c.status === 'ATIVO').length}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Receita Mensal (Ativos)</div>
                    <div className="text-2xl font-bold text-gray-900">{fmtCurrency(totalMensal)}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</div>
                        <select
                            className="text-sm border border-gray-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="ATIVO">Ativo</option>
                            <option value="ENCERRADO">Encerrado</option>
                            <option value="RESCINDIDO">Rescindido</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-[#1A3A5C] text-white">
                        <tr>
                            <th className="px-3 py-3 text-left font-medium">Imóvel</th>
                            <th className="px-3 py-3 text-left font-medium">Locatário</th>
                            <th className="px-3 py-3 text-right font-medium">Valor</th>
                            <th className="px-3 py-3 text-center font-medium">Vencimento</th>
                            <th className="px-3 py-3 text-center font-medium">Início</th>
                            <th className="px-3 py-3 text-center font-medium">Término / Vigência</th>
                            <th className="px-3 py-3 text-center font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>
                        )}
                        {!loading && contracts.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum contrato encontrado.</td></tr>
                        )}
                        {!loading && contracts.map(c => (
                            <tr
                                key={c.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                    setDetailId(c.id);
                                    setDetailTitle(`Quadro Resumo — ${c.fixedAsset?.internalCode ?? ''}`);
                                }}
                            >
                                <td className="px-3 py-2.5">
                                    <div className="font-medium text-gray-900">{c.fixedAsset?.internalCode}</div>
                                    <div className="text-xs text-gray-500">{c.fixedAsset?.description}</div>
                                </td>
                                <td className="px-3 py-2.5">{c.tenantName}</td>
                                <td className="px-3 py-2.5 text-right">{fmtCurrency(c.rentAmount)}</td>
                                <td className="px-3 py-2.5 text-center">Dia {c.dueDay}</td>
                                <td className="px-3 py-2.5 text-center">{fmtDate(c.startDate)}</td>
                                <td className="px-3 py-2.5 text-center">{c.endDate ? fmtDate(c.endDate) : 'Indeterminado'}</td>
                                <td className="px-3 py-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {STATUS_LABELS[c.status] ?? c.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {detailId && (
                <RentalContractDetailModal
                    contractId={detailId}
                    title={detailTitle}
                    onClose={() => setDetailId(null)}
                />
            )}
        </div>
    );
}