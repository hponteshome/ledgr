import React from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

interface Issue { type: string; code: string; message: string; detail?: string; }
interface Props {
  result: { canGenerate: boolean; errors: Issue[]; warnings: Issue[]; } | null;
  onClose: () => void;
  onGenerate: () => void;
  exporting: boolean;
}

export const EcdPreValidateModal: React.FC<Props> = ({ result, onClose, onGenerate, exporting }) => {
  if (!result) return null;
  const { canGenerate, errors, warnings } = result;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Validacao Pre-ECD</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {canGenerate
                ? <span className="text-green-600 font-medium">Pronto para gerar</span>
                : <span className="text-red-600 font-medium">{errors.length} erro(s) bloqueante(s)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {errors.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-red-700 mb-2">Bloqueantes ({errors.length}) — impedem a geracao</p>
              <div className="space-y-2">
                {errors.map((e, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800">{e.message}</p>
                    {e.detail && <p className="text-xs text-red-600 mt-1">{e.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className={errors.length > 0 ? 'mt-3' : ''}>
              <p className="text-sm font-semibold text-yellow-700 mb-2">Avisos ({warnings.length}) — regularizar antes de transmitir</p>
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">{w.message}</p>
                    {w.detail && <p className="text-xs text-yellow-600 mt-1">{w.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {errors.length === 0 && warnings.length === 0 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">OK</div>
              <p className="text-green-700 font-medium text-lg">Tudo certo! Pronto para gerar a ECD.</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          {canGenerate
            ? <button onClick={onGenerate} disabled={exporting}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                <FiDownload size={14} />
                {exporting ? 'Gerando...' : 'Gerar ECD'}
              </button>
            : <span className="text-sm text-red-500">Corrija os erros antes de gerar</span>
          }
        </div>
      </div>
    </div>
  );
};
