// frontend/src/pages/sped/EcdPage.tsx
// Correções nesta versão:
//   1. ExistingData inclui totalAccountsInDb
//   2. hasOverwrite considera accounts > 0 (não só saldos/lançamentos)
//   3. ValidationResult inclui contentType e layoutVersion
//   4. Leiaute e tipo de conteúdo exibidos nos cards de resumo
//   5. Query journalEntries no backend agora filtra sourceModule: ECD_IMPORT (fix no controller)

import React, { useState, useRef, useEffect } from 'react';
import {
    FiUpload, FiDownload, FiCheckCircle, FiAlertCircle,
    FiClock, FiFile, FiTrash2, FiEye, FiAlertTriangle,
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
    stats: {
        accounts: number;
        balances: number;
        journalEntries: number;
        totalAccountsInDb: number;
    } | null;
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

interface ValidationResult {
    valid: boolean;
    contentType?: 'FULL' | 'BALANCES_ONLY' | 'STATEMENTS_ONLY';
    layoutVersion?: string;
    summary: {
        accounts: number;
        periods: number;
        journalEntries: number;
        balanceSheet?: number;
        parseErrors: number;
    };
    existing: ExistingData;
    errors: Array<{ code: string; block: string; message: string; severity: 'error' | 'warning' }>;
    fileInfo?: {
        cnpj: string;
        companyName: string;
        periodStart: string;
        periodEnd: string;
        bookType: string;
        bookNumber: string;
    };
}

interface ImportResult {
    success: boolean;
    importId?: string;
    status?: string;
    contentType?: 'FULL' | 'BALANCES_ONLY' | 'STATEMENTS_ONLY';
    layoutVersion?: string;
    stats?: {
        accounts: number;
        accountsSkipped: number;
        balances: number;
        journalEntries: number;
        totalAccountsInDb: number;
    };
    errors?: Array<{ block: string; message: string }>;
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

const contentTypeLabel = (ct?: string) => {
    switch (ct) {
        case 'FULL': return { label: 'Completo (I050 + I155 + I200/I250)', cls: 'bg-green-100 text-green-700' };
        case 'BALANCES_ONLY': return { label: 'Saldos (I050 + I155, sem lançamentos)', cls: 'bg-blue-100 text-blue-700' };
        case 'STATEMENTS_ONLY': return { label: 'Demonstrações (só Bloco J)', cls: 'bg-gray-100 text-gray-600' };
        default: return null;
    }
};

const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
        done: { label: 'Concluído', cls: 'bg-green-100 text-green-700' },
        partial: { label: 'Parcial', cls: 'bg-yellow-100 text-yellow-700' },
        error: { label: 'Erro', cls: 'bg-red-100 text-red-700' },
        processing: { label: 'Processando', cls: 'bg-blue-100 text-blue-700' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const fmtPeriod = (s: string, e: string) =>
    new Date(s).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) +
    ' → ' +
    new Date(e).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
const fmtEcdDate = (s: string) => {
    if (!s || s.length < 8) return s;
    return s.substring(0, 2) + '/' + s.substring(2, 4) + '/' + s.substring(4, 8);
};

// ── Barra de progresso ────────────────────────────────────────

function ProgressBar({ p }: { p: Progress }) {
    const done = p.percent === 100;
    return (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{p.phase}</span>
                <span className="text-sm font-bold text-blue-600">{p.percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                    className="h-3 rounded-full transition-all duration-700"
                    style={{
                        width: p.percent + '%',
                        background: done
                            ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                            : 'linear-gradient(90deg,#2563eb,#60a5fa)',
                    }}
                />
            </div>
            {p.detail && <p className="text-xs text-gray-400 mt-1">{p.detail}</p>}
            {!done && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Arquivos grandes podem levar até 3 minutos...
                </div>
            )}
        </div>
    );
}

// ── Componente Principal ──────────────────────────────────────

const EcdPage: React.FC = () => {
    const [tab, setTab] = useState<'import' | 'export' | 'history'>('import');

    const [file, setFile] = useState<File | null>(null);
    const [validating, setValidating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [exportPeriodStart, setExportPeriodStart] = useState(
        new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    );
    const [exportPeriodEnd, setExportPeriodEnd] = useState(
        new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
    );
    const [exportBookType, setExportBookType] = useState('G');
    const [exportBookNumber, setExportBookNumber] = useState('1');
    const [exporting, setExporting] = useState(false);

    const [history, setHistory] = useState<ImportRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try { const r = await api.get('/sped/ecd/imports'); setHistory(r.data); }
        catch (e) { console.error(e); }
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

    const handleValidate = async () => {
        if (!file) return;
        setValidating(true);
        setValidation(null);
        setConfirmed(false);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post('/sped/ecd/validate', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setValidation(r.data);
        } catch (e: any) {
            setValidation({
                valid: false,
                summary: { accounts: 0, periods: 0, journalEntries: 0, parseErrors: 1 },
                existing: { accounts: 0, balances: 0, journalEntries: 0, totalAccountsInDb: 0, periodStart: '', periodEnd: '' },
                errors: [{ code: 'NET', block: 'GERAL', message: e.response?.data?.message || e.message, severity: 'error' }],
            });
        } finally {
            setValidating(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        setProgress({ phase: 'Enviando arquivo...', percent: 5, detail: (file.size / 1024).toFixed(0) + ' KB' });

        const phases: Progress[] = [
            { phase: 'Importando plano de contas (I050)...', percent: 20, detail: 'Processando...' },
            { phase: 'Gravando contas no banco...', percent: 35, detail: 'Processando...' },
            { phase: 'Importando saldos (I155)...', percent: 50, detail: 'Processando...' },
            { phase: 'Gravando saldos...', percent: 63, detail: 'Processando...' },
            { phase: 'Importando lançamentos (I200/I250)...', percent: 75, detail: 'Processando...' },
            { phase: 'Gravando lançamentos contábeis...', percent: 88, detail: 'Processando...' },
            { phase: 'Validando consistência ECD...', percent: 95, detail: 'Quase lá...' },
        ];

        let idx = 0;
        const timer = setInterval(() => {
            if (idx < phases.length) setProgress(phases[idx++]);
        }, 1500);

        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post('/sped/ecd/import', fd, {
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
            setImportResult({ success: false, message: e.response?.data?.message || e.message });
        } finally {
            setImporting(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const r = await api.get('/sped/ecd/export', {
                params: { periodStart: exportPeriodStart, periodEnd: exportPeriodEnd, bookNumber: exportBookNumber, bookType: exportBookType },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement('a'); a.href = url;
            a.download = 'ECD_' + new Date(exportPeriodEnd).getFullYear() + '.txt';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            alert('Erro ao gerar ECD: ' + (e.response?.data?.message || e.message));
        } finally { setExporting(false); }
    };

    // ── hasOverwrite: considera contas, saldos OU lançamentos ECD existentes
    const hasOverwrite = validation !== null && validation.existing &&
        (validation.existing.accounts > 0 ||
            validation.existing.balances > 0 ||
            validation.existing.journalEntries > 0);

    const ctInfo = contentTypeLabel(validation?.contentType);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">SPED — Escrituração Contábil Digital</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Importação, exportação e histórico de arquivos ECD (Leiaute 9)
                </p>
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {(['import', 'export', 'history'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t === 'import' ? '📥 Importar' : t === 'export' ? '📤 Exportar' : '📋 Histórico'}
                    </button>
                ))}
            </div>

            {tab === 'import' && (
                <div className="space-y-4">

                    {/* Upload */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="font-semibold text-gray-700 mb-4">Selecionar arquivo ECD (.txt)</h2>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-400 cursor-pointer transition-colors"
                        >
                            <FiUpload className="mx-auto text-gray-400 mb-3" size={32} />
                            {file ? (
                                <div>
                                    <p className="font-medium text-gray-700">{file.name}</p>
                                    <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-600">Clique ou arraste o arquivo ECD aqui</p>
                                    <p className="text-xs text-gray-400 mt-1">Arquivos .txt — Leiautes 4.00 a 9.00</p>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileSelect} className="hidden" />

                        {file && !confirmed && (
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={handleValidate}
                                    disabled={validating || importing}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FiEye size={14} />
                                    {validating ? 'Validando...' : 'Validar'}
                                </button>
                            </div>
                        )}

                        {confirmed && progress !== null && <ProgressBar p={progress} />}
                    </div>

                    {/* Resultado da validação */}
                    {validation !== null && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">

                            {/* Status + dados do arquivo */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <div className="flex items-center gap-2">
                                    {validation.valid
                                        ? <FiCheckCircle className="text-green-600" size={20} />
                                        : <FiAlertCircle className="text-red-500" size={20} />
                                    }
                                    <h3 className={`font-semibold ${validation.valid ? 'text-green-700' : 'text-red-600'}`}>
                                        {validation.valid ? 'Arquivo válido para importação' : 'Arquivo com erros bloqueantes'}
                                    </h3>
                                </div>

                                {validation.fileInfo && (
                                    <div className="flex items-center gap-3 text-xs text-gray-500 border-l border-gray-200 pl-4">
                                        <span className="font-mono font-bold text-gray-700">
                                            {validation.fileInfo.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                                        </span>
                                        <span className="text-gray-400">|</span>
                                        <span className="font-medium text-gray-700">{validation.fileInfo.companyName}</span>
                                        <span className="text-gray-400">|</span>
                                        <span>{fmtEcdDate(validation.fileInfo.periodStart)} → {fmtEcdDate(validation.fileInfo.periodEnd)}</span>
                                        {validation.fileInfo.bookType && (
                                            <>
                                                <span className="text-gray-400">|</span>
                                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                    Livro {validation.fileInfo.bookType} #{validation.fileInfo.bookNumber}
                                                </span>
                                            </>
                                        )}
                                        {validation.layoutVersion && (
                                            <>
                                                <span className="text-gray-400">|</span>
                                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                                    Leiaute {validation.layoutVersion}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Badge de tipo de conteúdo */}
                            {ctInfo && (
                                <div className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium ${ctInfo.cls}`}>
                                    {ctInfo.label}
                                </div>
                            )}

                            {/* Cards de resumo */}
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2 tracking-wide">Conteúdo do arquivo ECD</p>
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Contas', value: validation.summary.accounts, color: 'blue' },
                                        { label: 'Períodos', value: validation.summary.periods, color: 'green' },
                                        { label: 'Lançamentos', value: validation.summary.journalEntries, color: 'purple' },
                                        { label: 'Avisos parse', value: validation.summary.parseErrors, color: 'orange' },
                                    ].map(item => (
                                        <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                                            <div className={`text-xl font-bold text-${item.color}-600`}>
                                                {item.value.toLocaleString('pt-BR')}
                                            </div>
                                            <div className="text-xs text-gray-500">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preview de sobreposição */}
                            {validation.valid && hasOverwrite && !importResult && (
                                <div className="border border-amber-300 bg-amber-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FiAlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                                        <h4 className="font-semibold text-amber-800">Dados existentes serão substituídos</h4>
                                    </div>
                                    <p className="text-xs text-amber-700 mb-3">
                                        Período afetado:{' '}
                                        <strong>
                                            {fmtEcdDate(validation.existing.periodStart)} → {fmtEcdDate(validation.existing.periodEnd)}
                                        </strong>
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="bg-white rounded-lg p-2 text-center border border-amber-200">
                                            <div className="text-lg font-bold text-amber-700">
                                                {validation.existing.balances.toLocaleString('pt-BR')}
                                            </div>
                                            <div className="text-xs text-gray-500">Saldos a sobrescrever</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center border border-amber-200">
                                            <div className="text-lg font-bold text-amber-700">
                                                {validation.existing.journalEntries.toLocaleString('pt-BR')}
                                            </div>
                                            <div className="text-xs text-gray-500">Lançamentos ECD a sobrescrever</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 text-center border border-amber-200">
                                            <div className="text-lg font-bold text-amber-700">
                                                {validation.existing.accounts.toLocaleString('pt-BR')}
                                            </div>
                                            <div className="text-xs text-gray-500">Contas existentes</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setConfirmed(true); handleImport(); }}
                                            disabled={importing}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <FiUpload size={14} />
                                            Confirmar Importação
                                        </button>
                                        <button
                                            onClick={() => { setValidation(null); setFile(null); setImportResult(null); }}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Sem sobreposição — botão direto */}
                            {validation.valid && !hasOverwrite && !importResult && !importing && (
                                <button
                                    onClick={() => { setConfirmed(true); handleImport(); }}
                                    disabled={importing}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    <FiUpload size={14} />
                                    Importar
                                </button>
                            )}

                            {/* Durante importação */}
                            {validation.valid && importing && (
                                <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium w-fit">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    Importando...
                                </div>
                            )}

                            {/* Erros de validação */}
                            {validation.errors.length > 0 && (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {validation.errors.map((err, i) => (
                                        <div
                                            key={i}
                                            className={`text-xs p-2 rounded font-mono flex gap-2 ${err.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}
                                        >
                                            <span className="font-bold">[{err.block}]</span>
                                            <span>{err.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Resultado da importação */}
                    {importResult !== null && (
                        <div className={`bg-white rounded-xl border p-6 shadow-sm space-y-5 ${importResult.success ? 'border-green-200' : 'border-red-200'}`}>

                            <div className="flex items-center gap-2">
                                {importResult.success
                                    ? <FiCheckCircle className="text-green-600" size={20} />
                                    : <FiAlertCircle className="text-red-500" size={20} />
                                }
                                <h3 className={`font-semibold ${importResult.success ? 'text-green-700' : 'text-red-600'}`}>
                                    {importResult.success
                                        ? importResult.status === 'partial'
                                            ? 'Importação parcialmente concluída'
                                            : 'Importação concluída com sucesso'
                                        : 'Falha na importação'}
                                </h3>
                                {importResult.layoutVersion && (
                                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500 ml-2">
                                        Leiaute {importResult.layoutVersion}
                                    </span>
                                )}
                                {importResult.contentType && (() => {
                                    const ct = contentTypeLabel(importResult.contentType);
                                    return ct ? (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${ct.cls}`}>
                                            {ct.label}
                                        </span>
                                    ) : null;
                                })()}
                            </div>

                            {importResult.stats && (
                                <>
                                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Resultado da importação</p>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Contas importadas', value: importResult.stats.accounts, color: 'green' },
                                            { label: 'Ignoradas', value: importResult.stats.accountsSkipped, color: 'gray' },
                                            { label: 'Saldos', value: importResult.stats.balances, color: 'blue' },
                                            { label: 'Lançamentos', value: importResult.stats.journalEntries, color: 'purple' },
                                            { label: 'Total no banco', value: importResult.stats.totalAccountsInDb, color: 'slate' },
                                        ].map(item => (
                                            <div key={item.label} className={`bg-${item.color}-50 rounded-lg p-3 text-center`}>
                                                <div className={`text-xl font-bold text-${item.color}-700`}>
                                                    {(item.value ?? 0).toLocaleString('pt-BR')}
                                                </div>
                                                <div className="text-xs text-gray-500">{item.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Consistência ECD */}
                            {importResult.consistency && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                        <h4 className="font-semibold text-slate-700 text-sm">
                                            Consistência ECD — Saldos (I155) vs Lançamentos (I250)
                                        </h4>
                                        <div className="flex items-center gap-4 text-xs">
                                            <span className="text-green-600 font-bold">✓ {importResult.consistency.consistent} consistentes</span>
                                            {importResult.consistency.divergent > 0 && (
                                                <span className="text-amber-600 font-bold">⚠ {importResult.consistency.divergent} divergentes</span>
                                            )}
                                            {importResult.consistency.missing > 0 && (
                                                <span className="text-red-600 font-bold">✗ {importResult.consistency.missing} sem lançamentos</span>
                                            )}
                                        </div>
                                    </div>
                                    {importResult.consistency.details.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-green-600 font-semibold text-sm">
                                            <FiCheckCircle className="inline mr-2" size={16} />
                                            Todos os saldos conferem com os lançamentos importados.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0 bg-slate-100">
                                                    <tr className="text-slate-500 font-bold uppercase">
                                                        <th className="px-3 py-2 text-left">Conta</th>
                                                        <th className="px-3 py-2 text-right">Saldo ECD (I155)</th>
                                                        <th className="px-3 py-2 text-right">Recalculado (I250)</th>
                                                        <th className="px-3 py-2 text-right">Diferença</th>
                                                        <th className="px-3 py-2 text-left">Diagnóstico</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {importResult.consistency.details.map((d, i) => {
                                                        const fmt = (v: number) => {
                                                            const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                                            return v < 0 ? `(${abs})` : abs;
                                                        };
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50/50">
                                                                <td className="px-3 py-2">
                                                                    <span className="font-mono text-blue-600 mr-2">{d.accountCode}</span>
                                                                    <span className="text-slate-600">{d.accountName}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(d.ecdBalance)}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(d.calcBalance)}</td>
                                                                <td className={`px-3 py-2 text-right font-mono font-bold ${Math.abs(d.difference) < 0.01 ? 'text-green-500' : 'text-amber-600'}`}>
                                                                    {d.difference > 0 ? '+' : ''}{fmt(d.difference)}
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-400 italic max-w-xs truncate" title={d.diagnosis}>
                                                                    {d.diagnosis}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Erros de importação */}
                            {importResult.errors && importResult.errors.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-red-600 uppercase mb-2">
                                        Erros de importação ({importResult.errors.length})
                                    </p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="text-xs bg-red-50 text-red-700 p-2 rounded font-mono flex gap-2">
                                                <span className="font-bold">[{err.block}]</span>
                                                <span>{err.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warnings */}
                            {importResult.warnings && importResult.warnings.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-2">
                                        Avisos ({importResult.warnings.length})
                                    </p>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {importResult.warnings.map((w, i) => (
                                            <div key={i} className="text-xs bg-yellow-50 text-yellow-700 p-2 rounded font-mono">⚠ {w}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {importResult.message && (
                                <p className="text-sm text-red-600">{importResult.message}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {tab === 'export' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                    <h2 className="font-semibold text-gray-700">Gerar arquivo ECD</h2>
                    <p className="text-sm text-gray-500">
                        Gera um arquivo .txt no formato ECD com o plano de contas, saldos e lançamentos da empresa ativa.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Início do período</label>
                            <input type="date" value={exportPeriodStart} onChange={e => setExportPeriodStart(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Fim do período</label>
                            <input type="date" value={exportPeriodEnd} onChange={e => setExportPeriodEnd(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Tipo de escrituração</label>
                            <select value={exportBookType} onChange={e => setExportBookType(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="G">G — Diário Geral</option>
                                <option value="R">R — Diário Resumido (com auxiliar)</option>
                                <option value="B">B — Balancetes Diários e Balanços</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Número do livro</label>
                            <input type="number" value={exportBookNumber} onChange={e => setExportBookNumber(e.target.value)} min={1}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                        ⚠️ O arquivo gerado é um rascunho. Valide no <strong>PGE do Sped Contábil</strong> antes de transmitir.
                    </div>
                    <button onClick={handleExport} disabled={exporting}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
                        <FiDownload size={16} />
                        {exporting ? 'Gerando...' : 'Baixar ECD (.txt)'}
                    </button>
                </div>
            )}

            {tab === 'history' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">Importações realizadas</h2>
                        <button onClick={loadHistory} className="text-xs text-blue-600 hover:underline">Atualizar</button>
                    </div>
                    {loadingHistory ? (
                        <div className="text-center py-12 text-gray-400">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
                            Carregando...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <FiClock size={28} className="mx-auto mb-2 opacity-30" />
                            <p>Nenhuma importação registrada</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Arquivo', 'Leiaute', 'Período', 'Tipo', 'Livro', 'Status', 'Contas', 'Saldos', 'Lanç.', 'Importado em', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map(imp => (
                                    <tr key={imp.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-700 max-w-40 truncate" title={imp.fileName}>
                                            <FiFile className="inline mr-1 text-gray-400" size={13} />
                                            {imp.fileName}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{imp.layoutVersion || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{fmtPeriod(imp.periodStart, imp.periodEnd)}</td>
                                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{imp.bookType}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">#{imp.bookNumber}</td>
                                        <td className="px-4 py-3">{statusBadge(imp.status)}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">{imp.stats?.accounts?.toLocaleString('pt-BR') ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">{imp.stats?.balances?.toLocaleString('pt-BR') ?? '—'}</td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">{imp.stats?.journalEntries?.toLocaleString('pt-BR') ?? '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(imp.importedAt)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Remover este registro de importação?')) return;
                                                    await api.delete('/sped/ecd/imports/' + imp.id);
                                                    loadHistory();
                                                }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default EcdPage;