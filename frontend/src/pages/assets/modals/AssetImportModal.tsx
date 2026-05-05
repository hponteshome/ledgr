// ============================================================
// LEDGR — frontend/src/pages/assets/modals/AssetImportModal.tsx
// ============================================================
import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';

const API = 'http://localhost:3000';

type Step = 'upload' | 'preview' | 'duplicates' | 'result';
type DuplicateAction = 'overwrite' | 'ignore';

interface ParsedRow {
    line: number;
    internalCode: string;
    group: string;
    description: string;
    acquisitionDate: string;
    acquisitionCost: number;
    [key: string]: any;
}

interface Preview {
    rows: ParsedRow[];
    errors: { line: number; message: string }[];
    duplicates: string[];
}

interface ImportResult {
    created: number;
    overwritten: number;
    ignored: number;
    errors: { line: number; internalCode: string; message: string }[];
}

const HEADER_EXAMPLE = 'CODIGO|GRUPO|DESCRICAO|DATA_AQUISICAO|VALOR_AQUISICAO|LAND_PCT|MATRICULA|MUNICIPIO|UF|CONTA_ATIVO|CONTA_DEPREC|CONTA_ACUM|CARTORIO|AREA_CONSTRUIDA|AREA_TOTAL|VALOR_VENAL_ITBI|FRACAO_IDEAL|INSCRICAO_IPTU|DEPRECIACAO_INICIO';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export function AssetImportModal({ onClose, onSuccess }: Props) {
    const { token } = useAuth();
    const { activeCompany } = useCompany();
    const fileRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('upload');
    const [fileContent, setFileContent] = useState('');
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [dupAction, setDupAction] = useState<DuplicateAction>('ignore');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? ''}`,
        'x-company-id': activeCompany?.id ?? '',
    };

    const handleFile = useCallback((file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = e => setFileContent(e.target?.result as string ?? '');
        reader.readAsText(file, 'UTF-8');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleParse = async () => {
        if (!fileContent) { setError('Selecione um arquivo.'); return; }
        setLoading(true); setError('');
        try {
            const r = await fetch(`${API}/assets/import/preview`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content: fileContent }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.message ?? 'Erro ao processar arquivo');
            setPreview(data);
            setStep(data.duplicates?.length > 0 ? 'duplicates' : 'preview');
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    const handleImport = async () => {
        if (!preview) return;
        setLoading(true); setError('');
        try {
            const r = await fetch(`${API}/assets/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    content: fileContent,
                    duplicateAction: dupAction,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.message ?? 'Erro na importação');
            setResult(data);
            setStep('result');
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    const input = "w-full border border-gray-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
                    style={{ background: '#FFF7ED', borderRadius: '12px 12px 0 0' }}>
                    <div>
                        <span className="text-xs font-semibold text-orange-600">◆ Ativo Imobilizado</span>
                        <h2 className="text-base font-medium text-gray-800 mt-0.5">Importação em Lote</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
                </div>

                {/* Steps indicator */}
                <div className="px-6 pt-4 flex gap-2">
                    {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${step === s ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
                            <span className={`text-xs ${step === s ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                                {s === 'upload' ? 'Arquivo' : s === 'preview' ? 'Revisão' : 'Resultado'}
                            </span>
                            {i < 2 && <span className="text-gray-300 text-xs mx-1">›</span>}
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                    {/* ── Step: Upload ─────────────────────────────── */}
                    {(step === 'upload' || step === 'duplicates') && step === 'upload' && (
                        <>
                            {/* Drag & drop */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-orange-200 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                                <Upload className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                                {fileName
                                    ? <p className="text-sm font-medium text-orange-700">{fileName}</p>
                                    : <>
                                        <p className="text-sm font-medium text-gray-600">Arraste o arquivo ou clique para selecionar</p>
                                        <p className="text-xs text-gray-400 mt-1">Arquivos .txt ou .csv separados por "|"</p>
                                    </>
                                }
                                <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                            </div>

                            {/* Ou colar conteúdo */}
                            <div>
                                <label className="text-xs text-gray-500 font-medium block mb-1">Ou cole o conteúdo diretamente:</label>
                                <textarea className={`${input} resize-none font-mono text-xs`} rows={6}
                                    value={fileContent}
                                    onChange={e => setFileContent(e.target.value)}
                                    placeholder={`${HEADER_EXAMPLE}\nIMV-001|REAL_ESTATE|Studio Paris Ap 1101|31/12/2021|155000,00|2,94|52|São Paulo|SP|12301010004|42103010050|12301010099|1º Ofício|86,91|132,79|472349,56|0,0294117|`} />
                            </div>

                            {/* Layout reference */}
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info size={13} className="text-blue-500" />
                                    <span className="text-xs font-semibold text-blue-700">Layout esperado (cabeçalho obrigatório)</span>
                                </div>
                                <div className="text-xs font-mono text-blue-600 break-all">{HEADER_EXAMPLE}</div>
                                <div className="mt-2 text-xs text-blue-500 space-y-0.5">
                                    <p>• Vida útil padrão: 480 meses (imóveis) — editável após importação</p>
                                    <p>• Método padrão: Linear (SLM)</p>
                                    <p>• Contas contábeis: informar o código (ex: 12301010004)</p>
                                    <p>• Datas: dd/mm/aaaa ou aaaa-mm-dd</p>
                                    <p>• Valores: use vírgula como decimal (ex: 155000,00)</p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Step: Duplicatas ──────────────────────────── */}
                    {step === 'duplicates' && preview && (
                        <>
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="text-amber-600 w-4 h-4" />
                                    <span className="text-sm font-semibold text-amber-800">
                                        {preview.duplicates.length} ativo{preview.duplicates.length > 1 ? 's' : ''} já existente{preview.duplicates.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {preview.duplicates.map(code => (
                                        <span key={code} className="text-xs font-mono px-2 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">{code}</span>
                                    ))}
                                </div>
                                <p className="text-xs text-amber-700 mb-3">O que deseja fazer com os ativos duplicados?</p>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="dupAction" value="ignore"
                                            checked={dupAction === 'ignore'}
                                            onChange={() => setDupAction('ignore')} />
                                        <span className="text-sm text-gray-700">Ignorar (manter os existentes)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="dupAction" value="overwrite"
                                            checked={dupAction === 'overwrite'}
                                            onChange={() => setDupAction('overwrite')} />
                                        <span className="text-sm text-gray-700">Sobrescrever (atualizar dados)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Preview resumido */}
                            <div className="text-xs text-gray-500">
                                <strong className="text-gray-700">{preview.rows.length}</strong> registros válidos ·{' '}
                                <strong className="text-red-500">{preview.errors.length}</strong> erros ·{' '}
                                <strong className="text-amber-600">{preview.duplicates.length}</strong> duplicatas
                            </div>
                        </>
                    )}

                    {/* ── Step: Preview ─────────────────────────────── */}
                    {step === 'preview' && preview && (
                        <>
                            <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1.5 text-green-600">
                                    <CheckCircle size={14} /> {preview.rows.length} válidos
                                </div>
                                {preview.errors.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-red-500">
                                        <XCircle size={14} /> {preview.errors.length} erros
                                    </div>
                                )}
                            </div>

                            {/* Tabela preview */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="overflow-auto max-h-60">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-gray-400 font-medium">Linha</th>
                                                <th className="px-3 py-2 text-left text-gray-400 font-medium">Código</th>
                                                <th className="px-3 py-2 text-left text-gray-400 font-medium">Descrição</th>
                                                <th className="px-3 py-2 text-left text-gray-400 font-medium">Grupo</th>
                                                <th className="px-3 py-2 text-right text-gray-400 font-medium">Valor</th>
                                                <th className="px-3 py-2 text-left text-gray-400 font-medium">Data</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {preview.rows.map(row => (
                                                <tr key={row.line} className="hover:bg-gray-50">
                                                    <td className="px-3 py-1.5 text-gray-400 font-mono">{row.line}</td>
                                                    <td className="px-3 py-1.5 font-mono text-blue-700">{row.internalCode}</td>
                                                    <td className="px-3 py-1.5 text-gray-700 max-w-[180px] truncate">{row.description}</td>
                                                    <td className="px-3 py-1.5 text-gray-500">{row.group}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                                                        {row.acquisitionCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-500 font-mono">{row.acquisitionDate}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Erros */}
                            {preview.errors.length > 0 && (
                                <div className="border border-red-100 rounded-xl overflow-hidden">
                                    <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Linhas com erro (serão ignoradas)</div>
                                    <div className="divide-y divide-red-50 max-h-32 overflow-auto">
                                        {preview.errors.map((e, i) => (
                                            <div key={i} className="px-3 py-1.5 text-xs flex gap-3">
                                                <span className="font-mono text-red-400">L{e.line}</span>
                                                <span className="text-red-600">{e.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Step: Result ──────────────────────────────── */}
                    {step === 'result' && result && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-green-700">{result.created}</p>
                                    <p className="text-xs text-green-600">Criados</p>
                                </div>
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                                    <FileText className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-blue-700">{result.overwritten}</p>
                                    <p className="text-xs text-blue-600">Atualizados</p>
                                </div>
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                    <XCircle className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-gray-500">{result.ignored}</p>
                                    <p className="text-xs text-gray-500">Ignorados</p>
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div className="border border-red-100 rounded-xl overflow-hidden">
                                    <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{result.errors.length} erros durante importação</div>
                                    <div className="divide-y divide-red-50 max-h-40 overflow-auto">
                                        {result.errors.map((e, i) => (
                                            <div key={i} className="px-3 py-1.5 text-xs flex gap-3">
                                                <span className="font-mono text-red-400">L{e.line} {e.internalCode}</span>
                                                <span className="text-red-600">{e.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-400 text-center">
                                Ativos importados com status <strong>Aguardando Ativação</strong> — ative individualmente ou em lote.
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50/50" style={{ borderRadius: '0 0 12px 12px' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                        {step === 'result' ? 'Fechar' : 'Cancelar'}
                    </button>
                    <div className="flex gap-2">
                        {step === 'upload' && (
                            <button onClick={handleParse} disabled={!fileContent || loading}
                                className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                                {loading ? 'Processando...' : 'Processar Arquivo →'}
                            </button>
                        )}
                        {step === 'duplicates' && (
                            <>
                                <button onClick={() => setStep('preview')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                                    Ver preview
                                </button>
                                <button onClick={handleImport} disabled={loading}
                                    className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                                    {loading ? 'Importando...' : `Importar (${dupAction === 'ignore' ? 'ignorar' : 'sobrescrever'} duplicatas)`}
                                </button>
                            </>
                        )}
                        {step === 'preview' && (
                            <button onClick={handleImport} disabled={loading || preview?.rows.length === 0}
                                className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                                {loading ? 'Importando...' : `Importar ${preview?.rows.length} ativos →`}
                            </button>
                        )}
                        {step === 'result' && result && (result.created > 0 || result.overwritten > 0) && (
                            <button onClick={onSuccess}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                                Ver ativos importados
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}