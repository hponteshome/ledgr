import React, { useState, useRef } from 'react';
import { FiDownload, FiUploadCloud, FiAlertTriangle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import api from '../../services/api';

export const BackupRestore: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FUNÇÃO DE EXPORTAÇÃO ---
  const handleExportBackup = async () => {
    try {
      setIsProcessing(true);

      const response = await api.get('/system/backup/export', { responseType: 'blob' });

      // Lógica para Data e Hora no formato YYYY-MM-DD_HHmmss
      const agora = new Date();
      const dataFormatada = agora.toISOString().split('T')[0];
      const horaFormatada = agora.toTimeString().split(' ')[0].replace(/:/g, '');

      const fileName = `ledgr_backup_${dataFormatada}_${horaFormatada}.json`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      // Limpeza
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      alert("Backup exportado com sucesso!");
    } catch (error) {
      console.error("Erro no download:", error);
      alert("Erro ao gerar backup. Verifique se o servidor está rodando corretamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FUNÇÃO DE RESTAURAÇÃO (UPLOAD) ---
  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Solicita a Master Key definida no .env do Backend
    const masterKey = prompt("⚠️ SEGURANÇA: Digite a MASTER KEY para autorizar a restauração:");
    if (!masterKey) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Confirmação destrutiva
    const confirmed = confirm(
      "PERIGO: Esta ação apagará TODOS os dados atuais e substituirá pelos dados do arquivo. " +
      "Deseja prosseguir mesmo assim?"
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsProcessing(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const backupData = JSON.parse(content);

          // Envia para o endpoint de emergência do NestJS
          await api.post('/system/backup/restore-emergency', {
            masterKey,
            backupData
          });

          alert("✅ Restauração concluída com sucesso! O sistema será reiniciado.");
          window.location.reload();
        } catch (err) {
          console.error("Erro ao processar JSON:", err);
          alert("Erro: O arquivo selecionado não é um backup válido.");
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error("Erro na restauração:", error);
      alert("Falha na restauração. Verifique a Master Key ou a integridade do arquivo.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-gray-800">System Maintenance</h1>
        <p className="text-gray-500 text-sm">Gerencie a integridade e persistência dos dados do ecossistema Ledgr.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card de Exportação (Backup) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <FiDownload size={24} />
              </div>
              <h2 className="font-bold text-lg text-gray-700">Full Database Export</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Gera um arquivo JSON contendo empresas, usuários, pessoas e registros contábeis.
              Ideal para migrações ou arquivamento de segurança.
            </p>
          </div>
          <button
            disabled={isProcessing}
            onClick={handleExportBackup}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-semibold"
          >
            {isProcessing ? <FiLoader className="animate-spin" /> : <FiDownload />}
            {isProcessing ? 'Processing...' : 'Generate Backup Now'}
          </button>
        </div>

        {/* Card de Importação (Restore) */}
        <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm border-dashed flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4 text-red-600">
              <div className="p-3 bg-red-50 rounded-lg">
                <FiUploadCloud size={24} />
              </div>
              <h2 className="font-bold text-lg">System Restore</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-bold text-red-500 uppercase">Aviso Crítico:</span> Restaurar um arquivo substituirá
              permanentemente o banco de dados atual. Esta operação não pode ser desfeita.
            </p>
          </div>

          {/* Input de arquivo escondido */}
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            accept=".json"
            onChange={handleRestoreBackup}
          />

          <button
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-semibold"
          >
            {isProcessing ? <FiLoader className="animate-spin" /> : <FiUploadCloud />}
            {isProcessing ? 'Restoring...' : 'Upload & Restore File'}
          </button>
        </div>
      </div>

      {/* Alerta de Segurança */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
        <FiAlertTriangle className="text-amber-500 mt-1" size={20} />
        <div className="text-sm text-amber-800">
          <p className="font-bold">Política de Segurança de Dados</p>
          <p>Backups contêm informações sensíveis (hashes de senhas e documentos). Armazene os arquivos gerados em volumes criptografados.</p>
        </div>
      </div>
    </div>
  );
};