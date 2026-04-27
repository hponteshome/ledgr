// apps/frontend/src/components/accounting/ImportChartModal.tsx

import React, { useState, useRef } from 'react';
import { FiUpload, FiFileText, FiX, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

interface ImportResult {
  importId: string;
  status: 'done' | 'partial' | 'error';
  stats: {
    accounts: number;
    accountsSkipped: number;
    balances: number;
    journalEntries: number;
  };
  errors: Array<{ block: string; message: string }>;
  warnings: string[];
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportChartModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { activeCompany } = useCompany();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.txt') && !f.name.toLowerCase().endsWith('.sped')) {
      setError('Selecione um arquivo SPED (.txt)');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file || !activeCompany) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(
        `/sped/ecd/import?companyId=${activeCompany.id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setResult(response.data);
      if (response.data.status === 'done' || response.data.status === 'partial') {
        onSuccess(); // recarrega o plano de contas
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao importar arquivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-800">Importar Plano de Contas</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">

          {/* Info */}
          <p className="text-sm text-gray-500">
            Importe o plano de contas a partir de um arquivo <strong>SPED Contábil ECD</strong> (.txt).
            O sistema lerá o bloco <code className="bg-gray-100 px-1 rounded text-xs">I050</code> e
            criará/atualizará as contas mantendo os mapeamentos IFRS e US GAAP já existentes.
          </p>

          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
          >
            <input ref={fileRef} type="file" accept=".txt,.sped" onChange={handleFile} className="hidden" />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FiFileText size={24} className="text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-bold text-blue-700">{file.name}</p>
                  <p className="text-xs text-blue-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <FiUpload size={28} className="mx-auto text-gray-300" />
                <p className="text-sm text-gray-400">Clique para selecionar o arquivo SPED ECD</p>
                <p className="text-xs text-gray-300">Formato: .txt (gerado pelo SPED Contábil)</p>
              </div>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <FiAlertCircle size={16} /> {error}
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className={`px-4 py-4 rounded-xl border space-y-3 ${result.status === 'done' ? 'bg-green-50 border-green-200' :
                result.status === 'partial' ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
              }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.status === 'done'
                  ? <><FiCheckCircle className="text-green-600" /> Importação concluída</>
                  : <><FiAlertCircle className="text-amber-600" /> Importação parcial</>
                }
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <p className="font-black text-lg text-gray-800">{result.stats.accounts}</p>
                  <p className="text-gray-500">Contas importadas</p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <p className="font-black text-lg text-gray-800">{result.stats.accountsSkipped}</p>
                  <p className="text-gray-500">Ignoradas</p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <p className="font-black text-lg text-gray-800">{result.stats.balances}</p>
                  <p className="text-gray-500">Saldos importados</p>
                </div>
                <div className="bg-white/60 rounded-lg p-2 text-center">
                  <p className="font-black text-lg text-gray-800">{result.stats.journalEntries}</p>
                  <p className="text-gray-500">Lançamentos</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-amber-700 font-bold">
                    {result.errors.length} erro(s) — clique para ver
                  </summary>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <p key={i} className="text-red-600 font-mono">[{e.block}] {e.message}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className={`flex items-center gap-2 px-6 py-2 text-sm text-white font-black rounded-xl transition-all ${!file || loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {loading ? <><FiLoader className="animate-spin" /> Importando...</> : <><FiUpload size={16} /> Importar</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};