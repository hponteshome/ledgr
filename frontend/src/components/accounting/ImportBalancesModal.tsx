import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import api from '../../services/api';

interface ImportBalancesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess?: (data: any) => void;
}

export const ImportBalancesModal: React.FC<ImportBalancesModalProps> = ({
  isOpen,
  onClose,
  companyId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ line: string; error: string } | string>;
    duplicates: Array<{ accountCode: string; referenceDate: string; message: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const content = await file.text();
      const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');

      if (lines.length < 2) {
        throw new Error('Arquivo deve conter o CNPJ na 1ª linha e os dados a partir da 2ª.');
      }

      // ✅ NOVA VALIDAÇÃO: Linha 1 deve ser apenas o CNPJ (14 dígitos)
      const cnpjHeader = lines[0].replace(/\D/g, '');
      if (cnpjHeader.length !== 14) {
        throw new Error('A primeira linha do arquivo deve ser o CNPJ (14 números).');
      }

      // ✅ NOVA VALIDAÇÃO: Linha 2 deve ter o formato DATA|CÓDIGO|VALOR|DC (4 campos)
      const secondLine = lines[1];
      const parts = secondLine.split('|');
      if (parts.length !== 4) {
        throw new Error('As linhas de dados (a partir da 2ª) devem ter 4 campos: DATA|CÓDIGO|VALOR|DC');
      }

      // Validar data da segunda linha
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(parts[0])) {
        throw new Error('Formato de data inválido na 2ª linha. Use DD/MM/YYYY.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);

      const response = await api.post('/accounting/import-balances', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-company-id': companyId
        }
      });

      const data = response.data;

      // ✅ MAPEAMENTO CORRETO: backend retorna data.results com imported/updated/skipped/errors
      const results = data.results || data;

      const imported = results.imported ?? 0;
      const updated = results.updated ?? 0;
      const skipped = results.skipped ?? 0;
      const errors = results.errors ?? [];

      setResult({
        imported,
        updated,
        skipped,
        errors,
        duplicates: results.duplicates || []
      });

      if ((imported > 0 || updated > 0) && onSuccess) {
        onSuccess(data);
      }

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao importar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const downloadSample = () => {
    // ✅ MODELO ATUALIZADO: CNPJ na primeira linha, dados nas outras
    const sample = `05736256000185
31/12/2025|1.1.01.001.5|1057,57|D
31/12/2025|1.1.01.001.7|1000,00|D
31/12/2025|1.1.01.002.9|10897,47|D`;

    const blob = new Blob([sample], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo_saldos_header_body.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div
        className="relative z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Importar Saldos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* ✅ INSTRUÇÕES ATUALIZADAS */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Estrutura do arquivo:</strong>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              • <strong>Linha 1:</strong> Apenas o CNPJ (14 dígitos)<br />
              • <strong>Outras Linhas:</strong> DATA|CÓDIGO|VALOR|DC
            </p>
            <p className="text-[10px] text-blue-500 mt-2 italic">
              * O CNPJ deve ser o mesmo da empresa ativa no sistema.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={openFileSelector}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer mb-3"
          >
            <FiUpload className="mx-auto text-gray-400 mb-3" size={32} />
            <p className="text-gray-600 mb-1">Clique ou arraste um arquivo .txt</p>
            <p className="text-xs text-gray-400 font-mono">
              Linha 1: 05736256000185<br />
              Linha 2: 31/12/2025|1.1.01.001|1057,57|D
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openFileSelector}
              disabled={loading}
              className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <FiUpload size={16} /> Selecionar arquivo
            </button>
            <button
              onClick={downloadSample}
              className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              title="Baixar novo modelo (Header/Body)"
            >
              📥
            </button>
          </div>

          {loading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-blue-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                <span>Processando dados...</span>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-3">
              <div className={`p-4 rounded-lg border ${result.imported > 0 || result.updated > 0 ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.imported > 0 || result.updated > 0
                    ? <FiCheckCircle className="text-green-600" size={20} />
                    : <FiAlertCircle className="text-yellow-600" size={20} />
                  }
                  <span className={`font-medium ${result.imported > 0 || result.updated > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {result.imported > 0 || result.updated > 0 ? 'Importação concluída' : 'Nenhum registro importado'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div className="bg-white/50 rounded p-2 text-center">
                    <div className="text-green-600 font-bold text-lg">{result.imported}</div>
                    <div className="text-xs text-gray-600">Importados</div>
                  </div>
                  <div className="bg-white/50 rounded p-2 text-center">
                    <div className="text-blue-600 font-bold text-lg">{result.updated}</div>
                    <div className="text-xs text-gray-600">Atualizados</div>
                  </div>
                  <div className="bg-white/50 rounded p-2 text-center">
                    <div className="text-yellow-600 font-bold text-lg">{result.skipped}</div>
                    <div className="text-xs text-gray-600">Ignorados</div>
                  </div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 mb-3">
                    <FiAlertCircle size={18} />
                    <span className="font-medium text-sm">Erros encontrados ({result.errors.length})</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {result.errors.map((err, index) => {
                      // ✅ Suporta tanto {line, error} (backend novo) quanto string (legado)
                      const isObj = typeof err === 'object' && err !== null;
                      const errorMsg = isObj ? (err as any).error : err;
                      const errorLine = isObj ? (err as any).line : null;
                      return (
                        <div key={index} className="text-xs bg-white/50 p-2 rounded border border-red-200 font-mono text-red-700 break-words">
                          {errorLine && (
                            <div className="text-gray-400 mb-0.5 truncate" title={errorLine}>
                              linha: {errorLine}
                            </div>
                          )}
                          <div>{errorMsg}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && !result && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <FiAlertCircle size={20} />
                <span className="font-medium">Falha na Validação</span>
              </div>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">
            Fechar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {loading ? 'Enviando...' : 'Selecionar Novo'}
          </button>
        </div>
      </div>
    </div>
  );
};