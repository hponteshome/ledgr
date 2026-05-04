// frontend/src/pages/accounting/JournalPage.tsx
import { BulkDeleteModal } from './BulkDeleteModal';

import { IobLotdImportModal } from './IobLotdImportModal';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FiSearch, FiTrash2, FiRotateCcw, FiChevronLeft, FiChevronRight,
    FiAlertCircle, FiX, FiLoader, FiCheck, FiLogOut, FiFilter, FiEdit2, FiPlus, FiUploadCloud,
    FiAlertTriangle, FiCheckCircle,
} from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from 'react-hot-toast';

// ── Tipos ──────────────────────────────────────────────────────

interface Account {
    id: string; code: string; name: string;
    type: string; nature: string; isAnalytic: boolean;
}
interface JournalItem {
    id?: string; accountId: string; account?: Account;
    value: number; type: 'DEBIT' | 'CREDIT';
}
interface JournalEntry {
    id: string; date: string; description: string;
    reference?: string; sourceModule: string;
    items: JournalItem[]; createdAt: string;
}
interface JournalResponse {
    total: number; page: number; pages: number; entries: JournalEntry[];
}
interface Totals {
    totalDebit: number; totalCredit: number;
    difference: number; count: number; balanced: boolean;
}
interface BulkPreview {
    dryRun: boolean; count: number; itemCount: number;
    totalValue: number; periodStart: string | null; periodEnd: string | null;
}
interface OpeningItem {
    accountCode: string; accountName: string; accountId: string;
    value: number; type: 'DEBIT' | 'CREDIT';
}
interface EcdOpeningPreview {
    dryRun: boolean; periodEnd: string; description: string;
    items: OpeningItem[]; totalDebit: number; totalCredit: number;
    balanced: boolean; warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────

const fmtDate = (d: string) => {
    const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear());
    return `${dd}/${mm}/${yy}`;
};

const fmtCurrency = (v: number) =>
    Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SOURCE_CONFIG: Record<string, { label: string; cls: string }> = {
    ECD_IMPORT: { label: 'ECD', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    ACCOUNTING: { label: 'Manual', cls: 'bg-green-50 text-green-700 border border-green-200' },
    PROVISION: { label: 'Provisão', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    BANK_IMPORT: { label: 'Banco', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
    FISCAL: { label: 'Fiscal', cls: 'bg-gray-50 text-gray-700 border border-gray-200' },
};
const getSource = (s: string) => SOURCE_CONFIG[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' };

interface RefMonth { from: string; to: string; label: string; valid: boolean; }
const parseRefMonth = (raw: string): RefMonth => {
    const s = raw.trim().replace(/[.\-\s]/g, '/');
    let mm = 0, yy = 0;
    if (s.includes('/')) {
        const parts = s.split('/').filter(Boolean);
        if (parts.length >= 2) {
            mm = parseInt(parts[0], 10);
            const y = parts[1];
            yy = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
        }
    } else {
        const d = s.replace(/\D/g, '');
        if (d.length === 4) { mm = parseInt(d.substring(0, 2), 10); yy = 2000 + parseInt(d.substring(2, 4), 10); }
        else if (d.length === 6) { mm = parseInt(d.substring(0, 2), 10); yy = parseInt(d.substring(2, 6), 10); }
    }
    if (!mm || !yy || mm < 1 || mm > 12 || yy < 2000 || yy > 2099)
        return { from: '', to: '', label: raw, valid: false };
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(yy, mm, 0).getDate();
    return {
        from: `${yy}-${pad(mm)}-01`,
        to: `${yy}-${pad(mm)}-${pad(lastDay)}`,
        label: new Date(yy, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        valid: true,
    };
};
const todayRefDefault = (() => {
    const n = new Date();
    return `${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`;
})();
// ── Página Principal ───────────────────────────────────────────

const JournalPage: React.FC = () => {
    const { activeCompany } = useCompany();

    const [data, setData] = useState<JournalResponse | null>(null);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const [refInput, setRefInput] = useState(todayRefDefault);
    const currentMonth = React.useMemo(() => parseRefMonth(refInput), [refInput]);
    const [search, setSearch] = useState('');

    // ── Estado do formulário ───────────────────────────────────
    const [fDate, setFDate] = useState(new Date().toISOString().substring(0, 10));
    const [fType, setFType] = useState<'MANUAL' | 'PROVISION' | 'ADJUSTMENT'>('MANUAL');
    const [fHistCode, setFHistCode] = useState('');
    const [fHistName, setFHistName] = useState('');
    const [fDebitCode, setFDebitCode] = useState('');
    const [fDebitName, setFDebitName] = useState('');
    const [fDebitId, setFDebitId] = useState('');
    const [fCreditCode, setFCreditCode] = useState('');
    const [fCreditName, setFCreditName] = useState('');
    const [fCreditId, setFCreditId] = useState('');
    const [fValue, setFValue] = useState('');
    const [fComplement, setFComplement] = useState('');

    const [repeatDate, setRepeatDate] = useState(true);
    const [repeatDebit, setRepeatDebit] = useState(false);
    const [repeatCredit, setRepeatCredit] = useState(false);
    const [repeatValue, setRepeatValue] = useState(false);
    const [repeatHist, setRepeatHist] = useState(false);
    const [repeatComplement, setRepeatComplement] = useState(false);

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [lookupLoading, setLookupLoading] = useState<'debit' | 'credit' | null>(null);

    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [reverseId, setReverseId] = useState<string | null>(null);
    const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showBulkDelete, setShowBulkDelete] = useState(false);
    const [showEcdOpening, setShowEcdOpening] = useState(false);
    const [showLotdModal, setShowLotdModal] = useState(false);
    const [showRecent, setShowRecent] = useState(false);

    // Modal "conta não encontrada"
    const [newAccountCode, setNewAccountCode] = useState('');
    const [showNewAccountModal, setShowNewAccountModal] = useState(false);

    // Ref para foco automático após gravar
    const debitInputRef = useRef<HTMLInputElement>(null);

    // ── Carregamento ───────────────────────────────────────────

    const loadEntries = useCallback(async () => {
        if (!activeCompany || !currentMonth.valid) return;
        setLoading(true);
        try {
            const params = showRecent
                ? { dateTo: fDate, search: search || undefined, page, limit: 50, orderBy: 'date', orderDir: 'desc' }
                : { dateFrom: currentMonth.from, dateTo: currentMonth.to, search: search || undefined, page, limit: 100 };
            const r = await api.get('/accounting/journal', { params });
            setData(r.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [activeCompany, currentMonth.from, currentMonth.valid, search, page, showRecent, fDate]);

    const loadTotals = useCallback(async () => {
        if (!activeCompany || !currentMonth.valid) return;
        try {
            const r = await api.get('/accounting/journal/totals', { params: { dateFrom: currentMonth.from, dateTo: currentMonth.to } });
            setTotals(r.data);
        } catch (e) { console.error(e); }
    }, [activeCompany, currentMonth.from, currentMonth.to, currentMonth.valid]);

    useEffect(() => { loadEntries(); }, [loadEntries]);
    useEffect(() => { loadTotals(); }, [loadTotals]);
    useEffect(() => { if (currentMonth.valid) setFDate(currentMonth.to); }, [currentMonth.to, currentMonth.valid]);

    // ── Lookup de conta ────────────────────────────────────────

    const lookupAccount = async (code: string, side: 'debit' | 'credit') => {
        if (!code.trim() || !activeCompany) return;
        setLookupLoading(side); setFormError('');
        try {
            const r = await api.get('/accounting/journal/lookup-account', { params: { code: code.trim() } });
            const acc: Account = r.data;
            if (side === 'debit') { setFDebitName(acc.name); setFDebitId(acc.id); }
            else { setFCreditName(acc.name); setFCreditId(acc.id); }
        } catch (e: any) {
            if (e.response?.status === 404) {
                setNewAccountCode(code);
                setShowNewAccountModal(true);
            } else {
                setFormError(e.response?.data?.message || `Conta "${code}" não encontrada.`);
            }
            if (side === 'debit') { setFDebitName(''); setFDebitId(''); }
            else { setFCreditName(''); setFCreditId(''); }
        } finally { setLookupLoading(null); }
    };

    // ── Gravar lançamento ──────────────────────────────────────

    const handleSave = async () => {
        setFormError(''); setFormSuccess('');
        if (!fDebitId && !fCreditId) {
            setFormError('Informe ao menos uma conta (débito ou crédito).');
            return;
        }
        const val = parseFloat(fValue.replace('.', '').replace(',', '.'));
        if (!val || val <= 0) { setFormError('Informe um valor válido.'); return; }

        const items: { accountId: string; accountCode: string; value: number; type: string }[] = [];
        if (fDebitId) items.push({ accountId: fDebitId, accountCode: fDebitCode, value: val, type: 'DEBIT' });
        if (fCreditId) items.push({ accountId: fCreditId, accountCode: fCreditCode, value: val, type: 'CREDIT' });

        setSaving(true);
        try {
            await api.post('/accounting/journal', {
                date: fDate,
                description: fComplement || fHistName || `Lançamento ${fType.toLowerCase()}`,
                reference: fHistCode || undefined,
                type: fType,
                items,
            });
            setFormSuccess('Lançamento gravado com sucesso.');
            setTimeout(() => setFormSuccess(''), 3000);
            setTimeout(() => debitInputRef.current?.focus(), 50);

            if (!repeatDate) setFDate(new Date().toISOString().substring(0, 10));
            if (!repeatDebit) { setFDebitCode(''); setFDebitName(''); setFDebitId(''); }
            if (!repeatCredit) { setFCreditCode(''); setFCreditName(''); setFCreditId(''); }
            if (!repeatValue) setFValue('');
            if (!repeatHist) { setFHistCode(''); setFHistName(''); }
            if (!repeatComplement) setFComplement('');

            loadEntries(); loadTotals();
        } catch (e: any) {
            setFormError(e.response?.data?.message || 'Erro ao gravar lançamento.');
        } finally { setSaving(false); }
    };

    // ── Ações da lista ─────────────────────────────────────────

    const handleDelete = async () => {
        if (!confirmId) return;
        setActionLoading(true);
        try { await api.delete(`/accounting/journal/${confirmId}`); setConfirmId(null); loadEntries(); loadTotals(); }
        catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir.'); }
        finally { setActionLoading(false); }
    };

    const handleReverse = async () => {
        if (!reverseId) return;
        setActionLoading(true);
        try { await api.post(`/accounting/journal/${reverseId}/reverse`); setReverseId(null); loadEntries(); loadTotals(); }
        catch (e: any) { alert(e.response?.data?.message || 'Erro ao estornar.'); }
        finally { setActionLoading(false); }
    };

    const clearForm = () => {
        setFDate(new Date().toISOString().substring(0, 10));
        setFType('MANUAL'); setFHistCode(''); setFHistName('');
        setFDebitCode(''); setFDebitName(''); setFDebitId('');
        setFCreditCode(''); setFCreditName(''); setFCreditId('');
        setFValue(''); setFComplement('');
        setFormError(''); setFormSuccess('');
    };

    if (!activeCompany) return (
        <div className="flex items-center justify-center h-96 text-gray-400">
            Selecione uma empresa para acessar o diário de lançamentos.
        </div>
    );

    return (
        <div className="space-y-3 p-4" style={{ background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>

            {/* Modais */}
            {showEcdOpening && (
                <EcdOpeningModal
                    onClose={() => setShowEcdOpening(false)}
                    onImported={() => { setShowEcdOpening(false); loadEntries(); loadTotals(); }}
                />
            )}
            {showLotdModal && (
                <IobLotdImportModal
                    onClose={() => setShowLotdModal(false)}
                    onSuccess={() => { setShowLotdModal(false); loadEntries(); loadTotals(); }}
                />
            )}

            {showNewAccountModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
                        <h3 className="font-medium text-gray-800 mb-1 flex items-center gap-2">
                            <FiAlertCircle className="text-amber-500" size={16} />
                            Conta não encontrada
                        </h3>
                        <p className="text-sm text-gray-500 mb-1">
                            O código <span className="font-mono font-bold text-blue-700">{newAccountCode}</span> não existe no Plano de Contas desta empresa.
                        </p>
                        <p className="text-sm text-gray-500 mb-4">Deseja cadastrar esta conta agora?</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowNewAccountModal(false)}
                                className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                                Cancelar
                            </button>
                            <button onClick={() => {
                                setShowNewAccountModal(false);
                                window.location.href = `/app/accounting/accounts?action=maintenance&newCode=${newAccountCode}`;
                            }}
                                className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                                <FiPlus size={12} /> Cadastrar conta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barra superior */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-medium text-gray-800">Diário de lançamentos</span>
                    <span className="text-sm text-gray-400">{activeCompany.legalName || activeCompany.tradeName}</span>
                    <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 ${currentMonth.valid ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-300'}`}>
                        <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Ref.</span>
                        <input type="text" value={refInput}
                            onChange={e => { setRefInput(e.target.value); setPage(1); }}
                            onBlur={() => { const p = parseRefMonth(refInput); if (p.valid) { const [yy, mm] = p.from.split('-'); setRefInput(`${mm}/${yy}`); } }}
                            placeholder="mm/aaaa" maxLength={7}
                            className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none w-20" />
                        {currentMonth.valid && <span className="text-base font-bold text-red-500 hidden sm:inline">{currentMonth.label}</span>}
                        {!currentMonth.valid && refInput.length > 0 && <span className="text-xs text-red-500">formato inválido</span>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">ECD</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">Manual</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">Provisão</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowEcdOpening(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                        <FiUploadCloud size={13} /> Importar Abertura ECD
                    </button>
                    <button onClick={() => setShowLotdModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                        <FiUploadCloud size={13} /> Importar Lote IOB
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg bg-white cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={showRecent} onChange={e => setShowRecent(e.target.checked)} className="accent-blue-600" />
                        Mostrar Lançamentos
                    </label>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <FiLogOut size={14} /> Sair do modo lançamento
                    </button>
                </div>
            </div>

            {/* Formulário */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Novo lançamento</p>

                {/* Linha 1: Data, Tipo, Histórico */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Data</label>
                        <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                            className="h-8 border border-gray-200 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Tipo</label>
                        <select value={fType} onChange={e => setFType(e.target.value as any)}
                            className="h-8 border border-gray-200 rounded-lg px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-32">
                            <option value="MANUAL">Manual</option>
                            <option value="PROVISION">Provisão</option>
                            <option value="ADJUSTMENT">Ajuste</option>
                        </select>
                    </div>
                    <div className="w-px bg-gray-200 self-stretch" />
                    <div className="flex flex-col gap-1 flex-1 min-w-52">
                        <label className="text-xs text-gray-500">Histórico padrão (opcional)</label>
                        <div className="flex gap-2">
                            <input type="text" value={fHistCode} onChange={e => setFHistCode(e.target.value)}
                                placeholder="Cód." className="h-8 border border-gray-200 rounded-lg px-3 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input type="text" value={fHistName} readOnly placeholder="Deixe em branco para histórico livre"
                                className="h-8 border border-gray-100 rounded-lg px-3 text-sm flex-1 bg-gray-50 text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Linha 2: Débito, Crédito, Valor */}
                <div className="flex flex-wrap gap-3 items-end">
                    {/* Débito */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Débito — código</label>
                        <div className="flex gap-1.5">
                            <div className="relative">
                                <input
                                    ref={debitInputRef}
                                    type="text" value={fDebitCode}
                                    onChange={e => { setFDebitCode(e.target.value); setFDebitName(''); setFDebitId(''); }}
                                    onBlur={() => lookupAccount(fDebitCode, 'debit')}
                                    onKeyDown={e => e.key === 'Enter' && lookupAccount(fDebitCode, 'debit')}
                                    placeholder="Ex: 1.1.1"
                                    className="h-8 border border-gray-200 rounded-lg px-3 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                {lookupLoading === 'debit' && <FiLoader size={11} className="animate-spin absolute right-2 top-2.5 text-blue-400" />}
                            </div>
                            <input type="text" value={fDebitName} readOnly placeholder="Nome da conta"
                                className={`h-8 border rounded-lg px-3 text-sm w-52 ${fDebitId ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-100 bg-gray-50 text-gray-400'}`} />
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 self-stretch" />

                    {/* Crédito */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Crédito — código</label>
                        <div className="flex gap-1.5">
                            <div className="relative">
                                <input type="text" value={fCreditCode}
                                    onChange={e => { setFCreditCode(e.target.value); setFCreditName(''); setFCreditId(''); }}
                                    onBlur={() => lookupAccount(fCreditCode, 'credit')}
                                    onKeyDown={e => e.key === 'Enter' && lookupAccount(fCreditCode, 'credit')}
                                    placeholder="Ex: 2.1.1"
                                    className="h-8 border border-gray-200 rounded-lg px-3 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                {lookupLoading === 'credit' && <FiLoader size={11} className="animate-spin absolute right-2 top-2.5 text-blue-400" />}
                            </div>
                            <input type="text" value={fCreditName} readOnly placeholder="Nome da conta"
                                className={`h-8 border rounded-lg px-3 text-sm w-52 ${fCreditId ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-100 bg-gray-50 text-gray-400'}`} />
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 self-stretch" />

                    {/* Valor — largo o suficiente para 18 dígitos */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Valor (R$)</label>
                        <input type="text" value={fValue} onChange={e => setFValue(e.target.value)} placeholder="0,00"
                            className="h-8 border border-gray-200 rounded-lg px-3 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ width: '11rem' }} />
                    </div>
                </div>

                {/* Complemento */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Complemento do histórico</label>
                    <input type="text" value={fComplement} onChange={e => setFComplement(e.target.value)}
                        placeholder="Descrição livre do lançamento..."
                        className="w-full h-8 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* Repetir ao gravar */}
                <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Repetir ao gravar:</span>
                    {([['Data', setRepeatDate, repeatDate], ['Débito', setRepeatDebit, repeatDebit], ['Crédito', setRepeatCredit, repeatCredit], ['Valor', setRepeatValue, repeatValue], ['Histórico', setRepeatHist, repeatHist], ['Complemento', setRepeatComplement, repeatComplement]] as [string, (v: boolean) => void, boolean][]).map(([label, setter, val]) => (
                        <label key={label} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="accent-blue-600" />
                            {label}
                        </label>
                    ))}
                </div>

                {/* Totais + ações */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <div className="flex gap-3">
                        {totals && (
                            <>
                                <div className="flex flex-col items-end gap-0.5 px-3 py-2 bg-gray-50 rounded-lg min-w-28">
                                    <span className="text-xs text-gray-400 uppercase tracking-wide">Débitos (mês)</span>
                                    <span className="text-sm font-medium font-mono text-blue-700">R$ {fmtCurrency(totals.totalDebit)}</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 px-3 py-2 bg-gray-50 rounded-lg min-w-28">
                                    <span className="text-xs text-gray-400 uppercase tracking-wide">Créditos (mês)</span>
                                    <span className="text-sm font-medium font-mono text-green-700">R$ {fmtCurrency(totals.totalCredit)}</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 px-3 py-2 bg-gray-50 rounded-lg min-w-24">
                                    <span className="text-xs text-gray-400 uppercase tracking-wide">Diferença</span>
                                    <span className={`text-sm font-medium font-mono flex items-center gap-1 ${totals.balanced ? 'text-green-600' : 'text-red-500'}`}>
                                        R$ {fmtCurrency(totals.difference)} {totals.balanced && <FiCheck size={12} />}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        {formError && <span className="text-xs text-red-600 flex items-center gap-1 max-w-xs"><FiAlertCircle size={12} /> {formError}</span>}
                        {formSuccess && <span className="text-xs text-green-600 flex items-center gap-1"><FiCheck size={12} /> {formSuccess}</span>}
                        <button onClick={clearForm} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Limpar</button>
                        <button onClick={handleSave} disabled={saving}
                            className="px-5 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                            {saving ? <FiLoader size={13} className="animate-spin" /> : <FiCheck size={13} />} Gravar lançamento
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal bulk delete */}
            {showBulkDelete && (
                <BulkDeleteModal companyId={activeCompany.id} defaultFrom={currentMonth.from} defaultTo={currentMonth.to}
                    onClose={() => setShowBulkDelete(false)}
                    onDeleted={() => { setShowBulkDelete(false); loadEntries(); loadTotals(); }} />
            )}

            {/* Grid de lançamentos */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Filtrar conta, histórico..."
                                className="h-7 border border-gray-200 rounded-lg pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
                        </div>
                        {data && <span className="text-xs text-gray-400">{data.total} lançamentos</span>}
                    </div>
                    <button onClick={() => setShowBulkDelete(true)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1.5">
                        <FiTrash2 size={11} /> Excluir período...
                    </button>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-gray-400">
                        <FiLoader className="animate-spin mx-auto mb-2" size={20} />
                        <span className="text-sm">Carregando...</span>
                    </div>
                ) : !data?.entries?.length ? (
                    <div className="py-16 text-center text-gray-400">
                        <span className="text-sm">Nenhum lançamento encontrado no período.</span>
                    </div>
                ) : (
                    <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 480px)' }}>
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 whitespace-nowrap w-16">Data</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 whitespace-nowrap w-20">Nº Lanç.</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Histórico</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 whitespace-nowrap w-32">Débito</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 whitespace-nowrap w-32">Crédito</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 whitespace-nowrap w-36">Valor</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 w-20">Fonte</th>
                                    <th className="px-3 py-2 border-b border-gray-100 w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.entries.map(entry => {
                                    const debits = entry.items.filter(i => i.type === 'DEBIT');
                                    const credits = entry.items.filter(i => i.type === 'CREDIT');

                                    // Valor: positivo = débito, negativo = crédito
                                    const totalDebit = debits.reduce((s, i) => s + Number(i.value), 0);
                                    const totalCredit = credits.reduce((s, i) => s + Number(i.value), 0);
                                    const displayValue = totalDebit > 0 ? totalDebit : -totalCredit;
                                    const isCredit = totalDebit === 0 && totalCredit > 0;

                                    // Apenas código(s) das contas
                                    const debitCode = debits.length > 1
                                        ? `${debits[0].account?.code}…+${debits.length - 1}`
                                        : debits[0]?.account?.code || '—';
                                    const creditCode = credits.length > 1
                                        ? `${credits[0].account?.code}…+${credits.length - 1}`
                                        : credits[0]?.account?.code || '—';

                                    // Tooltip com nome completo
                                    const debitTitle = debits.map(i => `${i.account?.code} — ${i.account?.name}`).join('\n');
                                    const creditTitle = credits.map(i => `${i.account?.code} — ${i.account?.name}`).join('\n');

                                    // Número sequencial: referência ou 8 chars do id
                                    const nrLanc = entry.reference || entry.id.substring(0, 8);

                                    const src = getSource(entry.sourceModule);
                                    return (
                                        <tr key={entry.id} className="hover:bg-blue-50/30 group transition-colors border-b border-gray-50">
                                            <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{fmtDate(entry.date)}</td>
                                            <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap text-[10px]">{nrLanc}</td>
                                            <td className="px-3 py-2 text-gray-500 text-[11px] max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" title={entry.description}>{entry.description}</td>
                                            <td className="px-3 py-2 font-mono text-blue-700 whitespace-nowrap"
                                                title={debitTitle}>{debitCode}</td>
                                            <td className="px-3 py-2 font-mono text-green-700 whitespace-nowrap"
                                                title={creditTitle}>{creditCode}</td>
                                            <td className={`px-3 py-2 font-mono text-right font-semibold whitespace-nowrap ${isCredit ? 'text-red-500' : 'text-gray-800'}`}>
                                                {isCredit ? '−' : ''}{fmtCurrency(Math.abs(displayValue))}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${src.cls}`}>{src.label}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
                                                    <button onClick={() => setEditEntry(entry)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title={entry.description}><FiEdit2 size={14} /></button>
                                                    <button onClick={() => setReverseId(entry.id)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md" title="Estornar"><FiRotateCcw size={14} /></button>
                                                    <button onClick={() => setConfirmId(entry.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Excluir"><FiTrash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && (
                    <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-400">
                            {data.total} lançamentos · D: R$ {totals ? fmtCurrency(totals.totalDebit) : '—'} · C: R$ {totals ? fmtCurrency(totals.totalCredit) : '—'} · Δ: R$ {totals ? fmtCurrency(totals.difference) : '—'}
                        </span>
                        {data.pages > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Pág. {data.page}/{data.pages}</span>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"><FiChevronLeft size={14} /></button>
                                <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500"><FiChevronRight size={14} /></button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal: confirmar exclusão */}
            {confirmId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
                        <h3 className="font-medium text-gray-800 mb-1">Excluir lançamento?</h3>
                        <p className="text-sm text-gray-500 mb-4">Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmId(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">Cancelar</button>
                            <button onClick={handleDelete} disabled={actionLoading}
                                className="px-4 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                                {actionLoading && <FiLoader size={12} className="animate-spin" />} Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: confirmar estorno */}
            {reverseId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
                        <h3 className="font-medium text-gray-800 mb-1">Estornar lançamento?</h3>
                        <p className="text-sm text-gray-500 mb-4">Será criado um novo lançamento com as partidas invertidas.</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setReverseId(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">Cancelar</button>
                            <button onClick={handleReverse} disabled={actionLoading}
                                className="px-4 py-1.5 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5">
                                {actionLoading && <FiLoader size={12} className="animate-spin" />} Estornar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: editar lançamento */}
            {editEntry && (
                <EditModal
                    entry={editEntry}
                    onClose={() => setEditEntry(null)}
                    onSaved={() => { setEditEntry(null); loadEntries(); loadTotals(); }}
                />
            )}
        </div>
    );
};

export default JournalPage;
