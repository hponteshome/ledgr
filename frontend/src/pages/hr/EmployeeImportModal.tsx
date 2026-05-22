import React, { useState } from 'react';
import { FiX, FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import api from '@/services/api';

interface EmployeeImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const EmployeeImportModal: React.FC<EmployeeImportModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Passo 1: Fazer o parsing do PDF
      const { data: parsedData } = await api.post('/hr/employees/parse-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // parsedData é um array de funcionários parseados
      if (!parsedData || parsedData.length === 0) {
        throw new Error('Nenhum funcionário encontrado no PDF');
      }

      // Passo 2: Importar cada funcionário
      const importPromises = parsedData.map((employee: any) => 
        api.post('/hr/employees/import', employee)
      );
      
      const results = await Promise.all(importPromises);
      const successCount = results.filter(r => r.status === 200).length;
      
      setResult({ 
        success: true, 
        message: `${successCount} de ${parsedData.length} funcionários importados com sucesso` 
      });
      
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
    } catch (error: any) {
      console.error('Erro na importação:', error);
      setResult({
        success: false,
        message: error.response?.data?.message || error.message || 'Erro ao importar arquivo',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Importar Ficha Cadastral PDF</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              <FiUpload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {file ? file.name : 'Clique ou arraste o PDF aqui'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Apenas arquivos PDF</p>
            </label>
          </div>

          {result && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.success ? <FiCheckCircle /> : <FiAlertCircle />}
              {result.message}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
};
