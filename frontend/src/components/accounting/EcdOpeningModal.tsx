// frontend/src/components/accounting/EcdOpeningModal.tsx
//
// Fluxo em 3 etapas:
//   1. UPLOAD     — seleciona arquivo ECD
//   2. MAPPING    — revisa/ajusta mapeamento conta 2014 → conta 2015
//   3. PREVIEW    — confirma resultado final antes de gravar
//
// Uso no JournalPage:
//   import EcdOpeningModal from '../../components/accounting/EcdOpeningModal';
//   {showEcdOpening && (
//     <EcdOpeningModal
//       onClose={() => setShowEcdOpening(false)}
//       onImported={() => { setShowEcdOpening(false); loadEntries(); loadTotals(); }}
//     />
//   )}

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    FiUploadCloud, FiX, FiLoader, FiSearch, FiCheck,
    FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiArrowRight,
    FiChevronLeft,
} from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

// ── Tipos ──────────────────────────────────────────────────────

interface Account { id: string; code: string; name: string; }

interface MappingRow {
    ecdCode: string;
    ecdName: string;
    value: number;
    sign: 'D' | 'C';
    suggestion: Account | null;
    matchReason: 'exact' | 'stripped' | 'name' | 'none';
    // estado local de edição
    target: Account | null;   // conta escolhida pelo usuário
    searching: boolean;
    searchQuery: string;
    results: Account[];
    open: boolean;
}

interface MappingPreview {
    dryRun: true;
    periodEnd: string;
    description: string;
    rows: Omit<MappingRow, 'target' | 'searching' | 'searchQuery' | 'results' | 'open'>[];
    totalRows: number;
    autoMatched: number;
    unmatched: number;
}

interface ImportResult {
    dryRun: false;
    periodEnd: string;
    description: string;
    imported: number;
    skipped: number;
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    warnings: string[];
}

type Step = 'upload' | 'mapping' | 'done';

// ── Helpers ────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
    Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

const matchBadge = (r: MappingRow['matchReason']) => {
    if (r === 'exact') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">EXATO</span>;
    if (r === 'stripped') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">CÓDIGO</span>;
    if (r === 'name') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">NOME</span>;
    return null;
};

// ── Componente ─────────────────────────────────────────────────

interface Props { onClose: () => void; onImported: () => void; }

const EcdOpeningModal: React.FC<Props> = ({ onClose, onImported }) => {
    const fileRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<MappingPreview | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [rows, setRows] = useState<MappingRow[]>([]);

    // ── Busca de contas com debounce ─────────────────────────────
    const searchAccounts = useCallback(async (q: string): Promise<Account[]> => {
        if (q.length < 2) return [];
        try {
            const r = await api.get('/accounting/accounts-search', { params: { q } });
            return r.data;
        } catch { return []; }
    }, []);

    // ── Step 1: upload → dryRun ──────────────────────────────────
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f); setError(''); e.target.value = '';
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true); setError('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await api.post<MappingPreview>(
                '/accounting/import-ecd-opening?dryRun=true', fd,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setPreview(r.data);
            // Inicializa rows com estado local de edição
            setRows(r.data.rows.map(row => ({
                ...row,
                target: row.suggestion,  // pré-preenche com sugestão
                searching: false,
                searchQuery: row.suggestion ? `${row.suggestion.code} — ${row.suggestion.name}` : '',
                results: [],
                open: false,
            })));
            setStep('mapping');
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao processar arquivo.');
        } finally { setLoading(false); }
    };

    // ── Step 2: edição do mapeamento ─────────────────────────────

    const updateRow = (idx: number, patch: Partial<MappingRow>) =>
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

    const handleSearchChange = async (idx: number, q: string) => {
        updateRow(idx, { searchQuery: q, open: true, target: null });
        if (q.length < 2) { updateRow(idx, { results: [] }); return; }
        updateRow(idx, { searching: true });
        const results = await searchAccounts(q);
        updateRow(idx, { searching: false, results });
    };

    const handleSelectAccount = (idx: number, acc: Account) => {
        updateRow(idx, {
            target: acc,
            searchQuery: `${acc.code} — ${acc.name}`,
            open: false,
            results: [],
        });
    };

    const handleClearRow = (idx: number) =>
        updateRow(idx, { target: null, searchQuery: '', open: false, results: [] });

    // ── Step 2 → Step 3: confirmar ────────────────────────────────
    const handleImport = async () => {
        if (!file) return;
        setImporting(true); setError('');
        try {
            const mapping = rows.map(r => ({
                ecdCode: r.ecdCode,
                ecdName: r.ecdName,
                targetAccount: r.target,
            }));
            const fd = new FormData();
            fd.append('file', file);
            fd.append('mapping', JSON.stringify(mapping));
            const r = await api.post<ImportResult>(
                '/accounting/import-ecd-opening?dryRun=false', fd,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setResult(r.data);
            setStep('done');
            toast.success(`${r.data.imported} lançamentos de abertura importados.`);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao importar.');
        } finally { setImporting(false); }
    };

    // ── Contadores ────────────────────────────────────────────────
    const mapped = rows.filter(r => r.target !== null).length;
    const unmapped = rows.length - mapped;

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {step !== 'upload' && step !== 'done' && (
                            <button onClick={() => setStep('upload')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                <FiChevronLeft size={16} />
                            </button>
                        )}
                        <div>
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FiUploadCloud className="text-blue-600" size={18} />
                                {step === 'upload' && 'Importar Saldos de Abertura — ECD'}
                                {step === 'mapping' && `Mapeamento de Contas — ${preview?.totalRows} contas do arquivo`}
                                {step === 'done' && 'Importação Concluída'}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {step === 'upload' && 'Lê os saldos do último período I155 e cria lançamentos por conta'}
                                {step === 'mapping' && `${mapped} mapeadas · ${unmapped} sem mapeamento (serão ignoradas)`}
                                {step === 'done' && result && `${result.imported} lançamentos gravados em ${fmtDate(result.periodEnd)}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <FiX size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">

                    {/* ── Step 1: Upload ─────────────────────────────────── */}
                    {step === 'upload' && (
                        <div className="p-6 space-y-4">
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 cursor-pointer transition-colors"
                            >
                                <FiUploadCloud className="mx-auto text-gray-400 mb-2" size={28} />
                                {file ? (
                                    <div>
                                        <p className="font-medium text-gray-700 text-sm">{file.name}</p>
                                        <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-gray-600 text-sm">Clique ou arraste o arquivo ECD (.txt)</p>
                                        <p className="text-xs text-gray-400 mt-1">Leiautes 3.00 a 9.00 — encoding latin1</p>
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept=".txt" onChange={handleFileSelect} className="hidden" />
                            {error && (
                                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                                    <FiAlertCircle size={14} className="flex-shrink-0" /> {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 2: Mapeamento ─────────────────────────────── */}
                    {step === 'mapping' && (
                        <div className="divide-y divide-gray-50">

                            {/* Barra de resumo */}
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-4 text-xs flex-shrink-0">
                                <span className="text-blue-700">
                                    <strong>{preview?.autoMatched}</strong> sugeridas automaticamente
                                </span>
                                <span className="text-gray-400">·</span>
                                <span className="text-amber-600">
                                    <strong>{unmapped}</strong> aguardando mapeamento manual
                                </span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-500">
                                    Data: <strong>{preview && fmtDate(preview.periodEnd)}</strong>
                                </span>
                            </div>

                            {/* Tabela de mapeamento */}
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr className="text-gray-400 font-bold uppercase">
                                        <th className="px-3 py-2 text-left w-48">Conta ECD (origem)</th>
                                        <th className="px-3 py-2 text-right w-28">Valor</th>
                                        <th className="px-3 py-2 text-center w-8">Nat.</th>
                                        <th className="px-3 py-2 text-center w-6"></th>
                                        <th className="px-3 py-2 text-left">Conta LEDGR (destino)</th>
                                        <th className="px-3 py-2 w-6"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, idx) => (
                                        <tr key={row.ecdCode} className={`border-b border-gray-50 ${row.target ? '' : 'bg-amber-50/40'}`}>

                                            {/* Conta ECD */}
                                            <td className="px-3 py-2">
                                                <div className="font-mono text-blue-600 text-[10px]">{row.ecdCode}</div>
                                                <div className="text-gray-500 truncate max-w-44" title={row.ecdName}>{row.ecdName}</div>
                                                {row.matchReason !== 'none' && matchBadge(row.matchReason)}
                                            </td>

                                            {/* Valor */}
                                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                                                {fmtCurrency(row.value)}
                                            </td>

                                            {/* Natureza */}
                                            <td className="px-3 py-2 text-center">
                                                <span className={`font-bold px-1 py-0.5 rounded text-[10px] ${row.sign === 'D' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                    {row.sign}
                                                </span>
                                            </td>

                                            {/* Seta */}
                                            <td className="px-1 py-2 text-center text-gray-300">
                                                <FiArrowRight size={12} />
                                            </td>

                                            {/* Conta destino — autocomplete */}
                                            <td className="px-3 py-2 relative">
                                                <div className="relative">
                                                    <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={11} />
                                                    <input
                                                        type="text"
                                                        value={row.searchQuery}
                                                        placeholder="Buscar conta por código ou nome..."
                                                        onChange={e => handleSearchChange(idx, e.target.value)}
                                                        onFocus={() => updateRow(idx, { open: true })}
                                                        className={`w-full pl-7 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 ${row.target ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200'
                                                            }`}
                                                    />
                                                    {row.searching && (
                                                        <FiLoader size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 animate-spin" />
                                                    )}

                                                    {/* Dropdown de resultados */}
                                                    {row.open && row.results.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                                                            {row.results.map(acc => (
                                                                <button
                                                                    key={acc.id}
                                                                    onMouseDown={() => handleSelectAccount(idx, acc)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex items-center gap-2"
                                                                >
                                                                    <span className="font-mono text-blue-600 flex-shrink-0">{acc.code}</span>
                                                                    <span className="text-gray-600 truncate">{acc.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Limpar */}
                                            <td className="px-2 py-2">
                                                {row.target && (
                                                    <button onClick={() => handleClearRow(idx)} className="p-1 text-gray-300 hover:text-red-400 rounded">
                                                        <FiX size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Step 3: Resultado ──────────────────────────────── */}
                    {step === 'done' && result && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-xl p-4">
                                <FiCheckCircle size={20} className="flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">{result.imported} lançamentos de abertura importados com sucesso</p>
                                    <p className="text-xs text-green-600 mt-0.5">Data: {fmtDate(result.periodEnd)} · Referência: ABERTURA-ECD</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Importados', value: result.imported, color: 'green' },
                                    { label: 'Ignorados', value: result.skipped, color: 'gray' },
                                    { label: 'Total Déb.', value: fmtCurrency(result.totalDebit), color: 'blue', raw: true },
                                    { label: 'Total Créd.', value: fmtCurrency(result.totalCredit), color: 'green', raw: true },
                                ].map(item => (
                                    <div key={item.label} className={`bg-${item.color}-50 rounded-xl border border-${item.color}-200 p-3 text-center`}>
                                        <div className={`text-lg font-bold text-${item.color}-700 ${item.raw ? 'text-sm font-mono' : ''}`}>{item.value}</div>
                                        <div className="text-xs text-gray-500">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            {!result.balanced && (
                                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <FiAlertTriangle size={14} /> Débitos e créditos não estão balanceados — verifique o mapeamento.
                                </div>
                            )}
                            {result.warnings.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {result.warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                                            <FiAlertTriangle size={11} className="flex-shrink-0 mt-0.5" /> {w}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-400">
                        {step === 'upload' && (file ? file.name : 'Selecione o arquivo ECD')}
                        {step === 'mapping' && `${mapped} / ${rows.length} contas mapeadas`}
                        {step === 'done' && 'Importação concluída'}
                    </span>
                    <div className="flex gap-2">
                        {step === 'done' ? (
                            <button onClick={() => { onImported(); }} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                                <FiCheck size={13} /> Fechar
                            </button>
                        ) : (
                            <>
                                <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                                    Cancelar
                                </button>

                                {step === 'upload' && (
                                    <button onClick={handleAnalyze} disabled={!file || loading}
                                        className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-1.5">
                                        {loading ? <FiLoader size={12} className="animate-spin" /> : <FiSearch size={12} />}
                                        Analisar arquivo
                                    </button>
                                )}

                                {step === 'mapping' && (
                                    <>
                                        {error && (
                                            <span className="text-xs text-red-600 flex items-center gap-1 mr-2">
                                                <FiAlertCircle size={12} /> {error}
                                            </span>
                                        )}
                                        <button onClick={handleImport} disabled={importing || mapped === 0}
                                            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                                            {importing ? <FiLoader size={12} className="animate-spin" /> : <FiCheck size={12} />}
                                            Confirmar importação ({mapped})
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EcdOpeningModal;