// src/pages/sped/EcfPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    FiUpload, FiDownload, FiCheckCircle, FiAlertCircle,
    FiClock, FiFile, FiTrash2, FiEye, FiAlertTriangle,
    FiChevronDown, FiChevronUp, FiInfo, FiX, FiRefreshCw,
    FiDatabase, FiFileText, FiActivity,
} from 'react-icons/fi';
import api from '../../services/api';

// ── Tipos ──────────────────────────────────────────────────────

interface ImportRecord {
    id: string;
    fileName: string;
    layoutVersion: string;
    periodStart: string;
    periodEnd: string;
    bookType: string;
    bookNumber: string;
    status: 'processing' | 'done' | 'partial' | 'error';
    stats: { accounts: number; balances: number; journalEntries: number; totalAccountsInDb: number } | null;
    importedAt: string;
}

interface ExistingData {
    accounts: number;
    balances: number;
    journalEntries: number;
    totalAccountsInDb: number;
    periodStart: string;
    periodEnd: string;
}

interface ValidationError {
    line?: number;
    column?: number;
    code?: string;
    block?: string;
    message: string;
    severity: 'error' | 'warning';
}

interface ValidationResult {
    valid: boolean;
    summary: { accounts: number; periods: number; journalEntries: number; parseErrors: number };
    existing: ExistingData;
    errors: ValidationError[];
    fileInfo?: {
        cnpj: string;
        companyName: string;
        periodStart: string;
        periodEnd: string;
        bookType: string;
        bookNumber: string;
    };

    cnpjMismatch?: boolean;
    activeCompany?: {
        id: string;
        taxId: string;
        name: string;
    } | null;
}

interface ImportResult {
    success: boolean;
    importId?: string;
    status?: string;
    stats?: {
        accounts: number;
        accountsSkipped: number;
        balances: number;
        journalEntries: number;
        totalAccountsInDb?: number;
    };
    errors?: Array<{ block: string; message: string; line?: number; severity?: string }>;
    warnings?: string[];
    message?: string;
    consistency?: {
        consistent: number;
        divergent: number;
        missing: number;
        details: Array<{
            accountCode: string;
            accountName: string;
            ecdBalance: number;
            calcBalance: number;
            difference: number;
            diagnosis: string;
        }>;
    };
}

interface Progress {
    phase: string;
    percent: number;
    detail: string;
}

// ── Helpers ───────────────────────────────────────────────────

const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
        done: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
        partial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
        error: { label: 'Erro', cls: 'bg-red-100 text-red-700 border border-red-200' },
        processing: { label: 'Processando', cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
    return <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.label}</span>;
};

const fmtEcfDate = (s: string) => {
    if (!s || s.length < 8) return s ?? '—';
    return `${s.substring(0, 2)}/${s.substring(2, 4)}/${s.substring(4, 8)}`;
};

const formatCnpj = (cnpj: string) =>
    cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') ?? cnpj;

const fmtDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return iso; }
};

const fmtNum = (n?: number) =>
    n === undefined || n === null ? '—' : n.toLocaleString('pt-BR');

// ── Barra de progresso ────────────────────────────────────────

function ProgressBar({ p }: { p: Progress }) {
    const done = p.percent >= 100;
    return (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-blue-800">{p.phase}</span>
                <span className="text-sm font-bold text-blue-600">{p.percent}%</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                <div
                    className="h-2.5 rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${p.percent}%`,
                        background: done
                            ? 'linear-gradient(90deg,#059669,#10b981)'
                            : 'linear-gradient(90deg,#1d4ed8,#3b82f6)',
                    }}
                />
            </div>
            {p.detail && <p className="text-xs text-blue-500">{p.detail}</p>}
            {!done && (
                <div className="flex items-center gap-2 text-xs text-blue-500 pt-1">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Arquivos ECF podem ser densos — aguarde o processamento...
                </div>
            )}
        </div>
    );
}

// ── Bloco de erro detalhado (importação / validação) ──────────

function ErrorTable({
    title,
    errors,
    colorScheme = 'red',
    collapsible = false,
}: {
    title: string;
    errors: Array<{ line?: number; code?: string; block?: string; message: string; severity?: string }>;
    colorScheme?: 'red' | 'amber';
    collapsible?: boolean;
}) {
    const [open, setOpen] = useState(!collapsible || errors.length <= 5);
    const c = colorScheme === 'amber'
        ? { border: 'border-amber-200', header: 'bg-amber-50 border-b border-amber-200 text-amber-800', row: 'hover:bg-amber-50/40', icon: 'text-amber-600' }
        : { border: 'border-red-200', header: 'bg-red-50 border-b border-red-200 text-red-800', row: 'hover:bg-red-50/40', icon: 'text-red-500' };

    return (
        <div className={`border ${c.border} rounded-xl overflow-hidden`}>
            <button
                onClick={() => collapsible && setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-4 py-3 ${c.header} ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
            >
                <div className="flex items-center gap-2 font-semibold text-sm">
                    <FiAlertCircle className={c.icon} />
                    <span>{title}</span>
                    <span className="ml-1 text-xs font-bold opacity-70">({errors.length})</span>
                </div>
                {collapsible && (open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
            </button>

            {open && (
                <div className="overflow-x-auto max-h-72 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                            <tr>
                                <th className="px-4 py-2 w-16">Linha</th>
                                <th className="px-4 py-2 w-32">Registro / Código</th>
                                <th className="px-4 py-2">Descrição</th>
                                <th className="px-4 py-2 w-24">Severidade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {errors.map((err, i) => (
                                <tr key={i} className={`${c.row} transition-colors`}>
                                    <td className="px-4 py-2.5 font-mono text-gray-500">
                                        {err.line ? <span className="text-blue-600 font-semibold">{err.line}</span> : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-700">
                                        {err.code || err.block || 'GERAL'}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700 leading-relaxed">{err.message}</td>
                                    <td className="px-4 py-2.5">
                                        {err.severity === 'warning'
                                            ? <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-semibold">⚠ Aviso</span>
                                            : <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5 text-[10px] font-semibold">✕ Erro</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Card de resumo de stats ────────────────────────────────────

function StatCard({ label, value, icon: Icon, color = 'blue' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
    const colors: Record<string, string> = {
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        purple: 'text-purple-600 bg-purple-50 border-purple-100',
    };
    return (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colors[color]}`}>
            <Icon size={18} className="flex-shrink-0 opacity-70" />
            <div>
                <p className="text-[10px] uppercase tracking-wide opacity-60 font-semibold">{label}</p>
                <p className="text-lg font-bold leading-tight">{fmtNum(value as number)}</p>
            </div>
        </div>
    );
}

// ── Componente Principal ──────────────────────────────────────

const EcfPage: React.FC = () => {
    const [tab, setTab] = useState<'import' | 'export' | 'history'>('import');

    // Importação
    const [file, setFile] = useState<File | null>(null);
    const [validating, setValidating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [showConsistencyDetails, setShowConsistencyDetails] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Exportação
    const [exportPeriodStart, setExportPeriodStart] = useState(
        new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0]
    );
    const [exportPeriodEnd, setExportPeriodEnd] = useState(
        new Date(new Date().getFullYear() - 1, 11, 31).toISOString().split('T')[0]
    );
    const [exporting, setExporting] = useState(false);

    // Histórico
    const [history, setHistory] = useState<ImportRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (tab === 'history') loadHistory();
    }, [tab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const r = await api.get('/sped/ecf/imports');
            setHistory(r.data);
        } catch (e) { console.error(e); }
        finally { setLoadingHistory(false); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setValidation(null);
        setImportResult(null);
        setProgress(null);
        setConfirmed(false);
        e.target.value = '';
    };

    const handleClearFile = () => {
        setFile(null);
        setValidation(null);
        setImportResult(null);
        setProgress(null);
        setConfirmed(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleValidate = async () => {
        if (!file) return;
        setValidating(true);
        setValidation(null);
        setConfirmed(false);

        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post('/sped/ecf/validate', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Normalizar severity nos erros (garantir que exista)
            const data: ValidationResult = {
                ...r.data,
                errors: (r.data.errors ?? []).map((err: any) => ({
                    ...err,
                    severity: err.severity ?? 'error',
                })),
            };
            setValidation(data);
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message || 'Erro desconhecido';
            setValidation({
                valid: false,
                summary: { accounts: 0, periods: 0, journalEntries: 0, parseErrors: 1 },
                existing: { accounts: 0, balances: 0, journalEntries: 0, totalAccountsInDb: 0, periodStart: '', periodEnd: '' },
                errors: [{ code: 'NETWORK', block: 'GERAL', message: msg, severity: 'error' }],
            });
        } finally {
            setValidating(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        setProgress({ phase: 'Enviando arquivo...', percent: 5, detail: `${(file.size / 1024).toFixed(0)} KB` });

        const phases: Progress[] = [
            { phase: 'Processando Bloco 0...', percent: 20, detail: 'Lendo dados iniciais e identificação...' },
            { phase: 'Importando Plano de Contas ECF...', percent: 40, detail: 'Mapeando contas e referências fiscais...' },
            { phase: 'Processando Saldos Fiscais (Bloco L/M/N)...', percent: 70, detail: 'Calculando saldos e divergências...' },
            { phase: 'Finalizando importação ECF...', percent: 90, detail: 'Gravando dados no banco...' },
        ];

        let idx = 0;
        const timer = setInterval(() => {
            if (idx < phases.length) setProgress(phases[idx++]);
        }, 1600);

        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post('/sped/ecf/import', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000,
            });
            clearInterval(timer);
            setProgress({ phase: 'Concluído!', percent: 100, detail: '' });
            setTimeout(() => setProgress(null), 2500);
            setImportResult(r.data);
        } catch (e: any) {
            clearInterval(timer);
            setProgress(null);
            const errData = e.response?.data;
            setImportResult({
                success: false,
                message: errData?.message || e.message || 'Erro desconhecido',
                errors: errData?.errors ?? [],
                warnings: errData?.warnings ?? [],
            });
        } finally {
            setImporting(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const r = await api.get('/sped/ecf/export', {
                params: { periodStart: exportPeriodStart, periodEnd: exportPeriodEnd },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `ECF_${new Date(exportPeriodEnd).getFullYear()}.txt`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            alert('Erro ao gerar ECF: ' + (e.response?.data?.message || e.message));
        } finally {
            setExporting(false);
        }
    };

    const hasOverwrite = validation !== null && validation.existing &&
        (validation.existing.balances > 0 || validation.existing.journalEntries > 0);

    const validationBlockingErrors = validation?.errors?.filter(e => e.severity === 'error') ?? [];
    const validationWarnings = validation?.errors?.filter(e => e.severity === 'warning') ?? [];
    const importErrors = importResult?.errors ?? [];
    const importWarnings = importResult?.warnings ?? [];

    // ── Render ─────────────────────────────────────────────────

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">

            {/* Cabeçalho */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                        SPED — Escrituração Contábil Fiscal
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Importação, exportação e histórico de arquivos ECF</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium">
                    <FiActivity size={13} />
                    ECF / Bloco 0 · L · M · N
                </div>
            </div>

            {/* Abas */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {(['import', 'export', 'history'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t
                            ? 'bg-white text-blue-700 shadow-sm font-semibold'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t === 'import' ? '📥 Importar' : t === 'export' ? '📤 Exportar' : '📋 Histórico'}
                    </button>
                ))}
            </div>

            {/* ── ABA: IMPORTAÇÃO ─────────────────────────────── */}
            {tab === 'import' && (
                <div className="space-y-4">

                    {/* Seleção de arquivo */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <FiFile className="text-blue-500" /> Selecionar arquivo ECF (.txt)
                        </h2>

                        {!file ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all"
                            >
                                <FiUpload className="mx-auto text-gray-400 mb-3" size={32} />
                                <p className="text-gray-600 font-medium">Clique ou arraste o arquivo ECF aqui</p>
                                <p className="text-xs text-gray-400 mt-1">Arquivos .txt — Formato SPED</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <FiFileText className="text-blue-600" size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">{file.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {(file.size / 1024).toFixed(0)} KB
                                            {file.size > 1024 * 1024 && ` (${(file.size / 1024 / 1024).toFixed(1)} MB)`}
                                        </p>
                                    </div>
                                </div>
                                {!confirmed && (
                                    <button onClick={handleClearFile} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                        <FiX size={18} />
                                    </button>
                                )}
                            </div>
                        )}

                        <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileSelect} className="hidden" />

                        {file && !confirmed && !importResult && (
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={handleValidate}
                                    disabled={validating || importing}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {validating
                                        ? <><div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> Validando...</>
                                        : <><FiEye size={14} /> Validar arquivo</>
                                    }
                                </button>
                            </div>
                        )}

                        {confirmed && progress !== null && <ProgressBar p={progress} />}
                    </div>

                    {/* ── Resultado da Validação ─────────────────────── */}
                    {validation !== null && (
                        <div className={`bg-white rounded-xl border shadow-sm p-6 space-y-5 ${validation.valid ? 'border-emerald-200' : 'border-red-200'}`}>

                            {/* Header do resultado */}
                            <div className="flex flex-wrap items-start gap-4">
                                <div className="flex items-center gap-2">
                                    {validation.valid
                                        ? <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center"><FiCheckCircle className="text-emerald-600" size={18} /></div>
                                        : <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"><FiAlertCircle className="text-red-500" size={18} /></div>
                                    }
                                    <div>
                                        <h3 className={`font-bold text-base ${validation.valid ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {validation.valid ? 'Arquivo válido para importação' : 'Arquivo com erros bloqueantes'}
                                        </h3>
                                        {validationBlockingErrors.length > 0 && (
                                            <p className="text-xs text-red-500 mt-0.5">
                                                {validationBlockingErrors.length} erro{validationBlockingErrors.length > 1 ? 's' : ''} crítico{validationBlockingErrors.length > 1 ? 's' : ''} encontrado{validationBlockingErrors.length > 1 ? 's' : ''}
                                                {validationWarnings.length > 0 && ` · ${validationWarnings.length} aviso${validationWarnings.length > 1 ? 's' : ''}`}
                                            </p>
                                        )}
                                        {validation.valid && validationWarnings.length > 0 && (
                                            <p className="text-xs text-amber-600 mt-0.5">
                                                {validationWarnings.length} aviso{validationWarnings.length > 1 ? 's' : ''} não bloqueante{validationWarnings.length > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {validation.fileInfo && (
                                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                                        <div>
                                            <p className="text-gray-400 uppercase text-[10px] font-semibold mb-0.5">CNPJ</p>
                                            <p className="font-mono font-bold text-gray-700">{formatCnpj(validation.fileInfo.cnpj)}</p>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <p className="text-gray-400 uppercase text-[10px] font-semibold mb-0.5">Empresa</p>
                                            <p className="font-semibold text-gray-700 truncate">{validation.fileInfo.companyName}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400 uppercase text-[10px] font-semibold mb-0.5">Período</p>
                                            <p className="font-semibold text-gray-700">
                                                {fmtEcfDate(validation.fileInfo.periodStart)} → {fmtEcfDate(validation.fileInfo.periodEnd)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Resumo do arquivo */}
                            {validation.summary && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <StatCard label="Contas" value={validation.summary.accounts} icon={FiDatabase} color="blue" />
                                    <StatCard label="Lançamentos" value={validation.summary.journalEntries} icon={FiFileText} color="purple" />
                                    <StatCard label="Períodos" value={validation.summary.periods} icon={FiClock} color="amber" />
                                    <StatCard label="Erros de Parsing" value={validation.summary.parseErrors} icon={FiAlertCircle} color={validation.summary.parseErrors > 0 ? 'amber' : 'green'} />
                                </div>
                            )}

                            {/* Card de CNPJ divergente */}
                            {validation?.cnpjMismatch && validation.fileInfo && (
                                <div className="border border-red-300 rounded-xl overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-red-100 px-4 py-3 border-b border-red-200 flex items-center gap-3">
                                        <span className="text-lg">⛔</span>
                                        <div>
                                            <p className="font-bold text-red-800 text-sm">
                                                CNPJ do arquivo diverge da empresa selecionada
                                            </p>
                                            <p className="text-xs text-red-600 mt-0.5">
                                                Erro bloqueante — selecione a empresa correta antes de importar
                                            </p>
                                        </div>
                                    </div>

                                    {/* Comparação */}
                                    <div className="grid grid-cols-2 divide-x divide-red-100 bg-white">
                                        <div className="px-5 py-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                                                📄 Arquivo ECF
                                            </p>
                                            <p className="font-mono font-bold text-red-700 text-base">
                                                {formatCnpj(validation.fileInfo.cnpj)}
                                            </p>
                                            <p className="text-sm text-gray-700 mt-1">
                                                {validation.fileInfo.companyName || '—'}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                Período: {fmtEcfDate(validation.fileInfo.periodStart)} → {fmtEcfDate(validation.fileInfo.periodEnd)}
                                            </p>
                                        </div>
                                        <div className="px-5 py-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                                                🏢 Empresa ativa no LEDGR
                                            </p>
                                            <p className="font-mono font-bold text-emerald-700 text-base">
                                                {validation.activeCompany
                                                    ? formatCnpj(validation.activeCompany.taxId)
                                                    : '—'}
                                            </p>
                                            <p className="text-sm text-gray-700 mt-1">
                                                {validation.activeCompany?.name || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Instrução */}
                                    <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
                                        <span className="mt-0.5 flex-shrink-0">💡</span>
                                        <span>
                                            Troque a empresa ativa no seletor do topo e selecione a empresa com CNPJ{' '}
                                            <span className="font-mono font-bold">
                                                {formatCnpj(validation.fileInfo.cnpj)}
                                            </span>.
                                        </span>
                                    </div>
                                </div>
                            )}



                            {/* Erros críticos de validação */}
                            {validationBlockingErrors.length > 0 && (
                                <ErrorTable
                                    title="Erros Bloqueantes de Validação"
                                    errors={validationBlockingErrors}
                                    colorScheme="red"
                                    collapsible={validationBlockingErrors.length > 5}
                                />
                            )}

                            {/* Avisos de validação */}
                            {validationWarnings.length > 0 && (
                                <ErrorTable
                                    title="Avisos (não bloqueantes)"
                                    errors={validationWarnings}
                                    colorScheme="amber"
                                    collapsible={validationWarnings.length > 5}
                                />
                            )}

                            {/* Alerta de sobreposição */}
                            {validation.valid && hasOverwrite && !importResult && (
                                <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <FiAlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h4 className="font-bold text-amber-800 text-sm">Atenção: dados ECF já existem para este período</h4>
                                            <p className="text-xs text-amber-700 mt-1">
                                                A importação irá substituir os registros existentes:
                                                <span className="font-semibold"> {fmtNum(validation.existing.balances)} saldos</span> e
                                                <span className="font-semibold"> {fmtNum(validation.existing.journalEntries)} lançamentos</span>
                                                {validation.existing.periodStart && ` do período ${fmtEcfDate(validation.existing.periodStart)} → ${fmtEcfDate(validation.existing.periodEnd)}`}.
                                            </p>
                                        </div>
                                    </div>
                                    {!importing && (
                                        <button
                                            onClick={() => { setConfirmed(true); handleImport(); }}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold flex items-center gap-2 transition-all"
                                        >
                                            <FiUpload size={14} /> Confirmar Substituição
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Botão de importação normal */}
                            {validation.valid && !hasOverwrite && !importResult && !importing && (
                                <button
                                    onClick={() => { setConfirmed(true); handleImport(); }}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
                                >
                                    <FiUpload size={14} /> Importar ECF
                                </button>
                            )}

                            {importing && (
                                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    Importando... aguarde.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Resultado da Importação ────────────────────── */}
                    {importResult !== null && (
                        <div className={`bg-white rounded-xl border shadow-sm p-6 space-y-5 ${importResult.success ? 'border-emerald-200' : 'border-red-200'}`}>

                            {/* Header */}
                            <div className="flex items-center gap-3">
                                {importResult.success
                                    ? <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center"><FiCheckCircle className="text-emerald-600" size={20} /></div>
                                    : <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center"><FiAlertCircle className="text-red-500" size={20} /></div>
                                }
                                <div>
                                    <h3 className={`font-bold text-base ${importResult.success ? 'text-emerald-700' : 'text-red-600'}`}>
                                        {importResult.success ? 'ECF importada com sucesso' : 'Falha na importação'}
                                    </h3>
                                    {importResult.message && (
                                        <p className="text-xs text-gray-500 mt-0.5">{importResult.message}</p>
                                    )}
                                </div>
                            </div>

                            {/* Stats de importação */}
                            {importResult.stats && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <StatCard label="Contas importadas" value={importResult.stats.accounts} icon={FiDatabase} color="blue" />
                                    <StatCard label="Contas ignoradas" value={importResult.stats.accountsSkipped ?? 0} icon={FiInfo} color="amber" />
                                    <StatCard label="Saldos" value={importResult.stats.balances} icon={FiActivity} color="green" />
                                    <StatCard label="Lançamentos" value={importResult.stats.journalEntries} icon={FiFileText} color="purple" />
                                </div>
                            )}

                            {/* Erros da importação */}
                            {importErrors.length > 0 && (
                                <ErrorTable
                                    title="Erros ocorridos durante a importação"
                                    errors={importErrors.map(e => ({ ...e, severity: (e.severity as 'error' | 'warning') ?? 'error' }))}
                                    colorScheme="red"
                                    collapsible={importErrors.length > 5}
                                />
                            )}

                            {/* Avisos da importação */}
                            {importWarnings.length > 0 && (
                                <div className="border border-amber-200 rounded-xl overflow-hidden">
                                    <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2 text-amber-800 font-semibold text-sm">
                                        <FiAlertTriangle size={14} />
                                        Avisos da importação ({importWarnings.length})
                                    </div>
                                    <ul className="divide-y divide-amber-100 bg-white max-h-48 overflow-y-auto">
                                        {importWarnings.map((w, i) => (
                                            <li key={i} className="px-4 py-2.5 text-xs text-gray-700 flex items-start gap-2">
                                                <FiAlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={12} />
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Divergências de consistência */}
                            {importResult.consistency && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <StatCard label="Consistentes" value={importResult.consistency.consistent} icon={FiCheckCircle} color="green" />
                                        <StatCard label="Divergentes" value={importResult.consistency.divergent} icon={FiAlertTriangle} color="amber" />
                                        <StatCard label="Ausentes" value={importResult.consistency.missing} icon={FiAlertCircle} color={importResult.consistency.missing > 0 ? 'amber' : 'green'} />
                                    </div>

                                    {importResult.consistency.divergent > 0 && importResult.consistency.details.length > 0 && (
                                        <div className="border border-amber-200 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setShowConsistencyDetails(o => !o)}
                                                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 font-semibold text-sm cursor-pointer hover:bg-amber-100 transition-colors"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FiAlertTriangle size={14} />
                                                    Divergências de saldo ({importResult.consistency.divergent})
                                                </span>
                                                {showConsistencyDetails ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                                            </button>
                                            {showConsistencyDetails && (
                                                <div className="overflow-x-auto max-h-64 overflow-y-auto bg-white">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                                                            <tr>
                                                                <th className="px-4 py-2">Conta</th>
                                                                <th className="px-4 py-2">Nome</th>
                                                                <th className="px-4 py-2 text-right">Saldo ECF</th>
                                                                <th className="px-4 py-2 text-right">Saldo Calc.</th>
                                                                <th className="px-4 py-2 text-right">Diferença</th>
                                                                <th className="px-4 py-2">Diagnóstico</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {importResult.consistency.details.map((d, i) => (
                                                                <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                                                                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-700">{d.accountCode}</td>
                                                                    <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">{d.accountName}</td>
                                                                    <td className="px-4 py-2.5 text-right font-mono">{d.ecdBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-2.5 text-right font-mono">{d.calcBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${d.difference !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {d.difference.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-gray-600">{d.diagnosis}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Nova importação */}
                            <button
                                onClick={handleClearFile}
                                className="mt-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                            >
                                <FiRefreshCw size={13} /> Nova importação
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── ABA: EXPORTAÇÃO ─────────────────────────────── */}
            {tab === 'export' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <FiDownload className="text-blue-500" /> Gerar arquivo ECF
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Início do Período</label>
                            <input
                                type="date"
                                value={exportPeriodStart}
                                onChange={e => setExportPeriodStart(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Fim do Período</label>
                            <input
                                type="date"
                                value={exportPeriodEnd}
                                onChange={e => setExportPeriodEnd(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {exporting
                            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando arquivo...</>
                            : <><FiDownload size={14} /> Gerar ECF</>
                        }
                    </button>
                </div>
            )}

            {/* ── ABA: HISTÓRICO ──────────────────────────────── */}
            {tab === 'history' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                            <FiClock className="text-blue-500" /> Histórico de Importações
                        </h2>
                        <button
                            onClick={loadHistory}
                            disabled={loadingHistory}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium disabled:opacity-50 transition-colors"
                        >
                            <FiRefreshCw size={12} className={loadingHistory ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    </div>

                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
                            Carregando histórico...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                            <FiFile size={36} className="opacity-30" />
                            <p className="text-sm">Nenhuma importação registrada</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3">Arquivo</th>
                                        <th className="px-5 py-3">Versão</th>
                                        <th className="px-5 py-3">Período</th>
                                        <th className="px-5 py-3">Contas</th>
                                        <th className="px-5 py-3">Lançamentos</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {history.map(r => (
                                        <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-gray-700 max-w-[180px] truncate" title={r.fileName}>
                                                {r.fileName}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-gray-500 text-xs">{r.layoutVersion || '—'}</td>
                                            <td className="px-5 py-3.5 text-gray-600 text-xs whitespace-nowrap">
                                                {fmtEcfDate(r.periodStart)} → {fmtEcfDate(r.periodEnd)}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600">{fmtNum(r.stats?.accounts)}</td>
                                            <td className="px-5 py-3.5 text-gray-600">{fmtNum(r.stats?.journalEntries)}</td>
                                            <td className="px-5 py-3.5">{statusBadge(r.status)}</td>
                                            <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.importedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EcfPage;