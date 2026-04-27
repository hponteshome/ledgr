// frontend/src/pages/documentos/ImportarDocumentoModal.tsx
import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiCheckCircle, FiShield, FiFileText } from 'react-icons/fi';

const TIPOS = [
  { group: 'Societário', items: [
    { value: 'CONTRATO_SOCIAL', label: 'Contrato Social' },
    { value: 'ESTATUTO_SOCIAL', label: 'Estatuto Social' },
    { value: 'ATA_AGO', label: 'Ata de AGO' },
    { value: 'ATA_AGE', label: 'Ata de AGE' },
    { value: 'ATA_DIRETORIA', label: 'Ata de Diretoria' },
    { value: 'PROCURACAO', label: 'Procuração' },
    { value: 'ACORDO_ACIONISTAS', label: 'Acordo de Acionistas' },
    { value: 'ADITIVO_CONTRATUAL', label: 'Aditivo Contratual' },
  ]},
  { group: 'Livros Societários', items: [
    { value: 'LIVRO_REGISTRO_ACOES', label: 'Livro de Registro de Ações/Quotas' },
    { value: 'LIVRO_TRANSFERENCIA_ACOES', label: 'Livro de Transferência de Ações' },
    { value: 'LIVRO_ATAS_AGO', label: 'Livro de Atas de AGO' },
    { value: 'LIVRO_ATAS_AGE', label: 'Livro de Atas de AGE' },
  ]},
  { group: 'Contábil', items: [
    { value: 'CONTABIL', label: 'Balancete / Demonstração Financeira' },
  ]},
  { group: 'Fiscal', items: [
    { value: 'FISCAL', label: 'ECF / Obrigação Acessória' },
  ]},
  { group: 'RH / Trabalhista', items: [
    { value: 'TRABALHISTA', label: 'Contrato de Trabalho / Acordo Coletivo' },
  ]},
  { group: 'Outros', items: [
    { value: 'OUTRO', label: 'Outro documento' },
  ]},
];

const PRATELEIRA: Record<string, string> = {
  CONTRATO_SOCIAL: 'Arquivo → Societário → Contratos / Estatutos',
  ESTATUTO_SOCIAL: 'Arquivo → Societário → Contratos / Estatutos',
  ATA_AGO: 'Arquivo → Societário → Atas Assinadas',
  ATA_AGE: 'Arquivo → Societário → Atas Assinadas',
  ATA_DIRETORIA: 'Arquivo → Societário → Atas Assinadas',
  PROCURACAO: 'Arquivo → Societário → Procurações',
  ACORDO_ACIONISTAS: 'Arquivo → Societário → Acordos de Acionistas',
  ADITIVO_CONTRATUAL: 'Arquivo → Societário → Contratos / Estatutos',
  LIVRO_REGISTRO_ACOES: 'Arquivo → Livros Societários → Registro de Ações/Quotas',
  LIVRO_TRANSFERENCIA_ACOES: 'Arquivo → Livros Societários → Transferência de Ações',
  LIVRO_ATAS_AGO: 'Arquivo → Livros Societários → Atas de AGO',
  LIVRO_ATAS_AGE: 'Arquivo → Livros Societários → Atas de AGE',
  CONTABIL: 'Arquivo → Contábil',
  FISCAL: 'Arquivo → Fiscal',
  TRABALHISTA: 'Arquivo → RH / Trabalhista',
  OUTRO: 'Arquivo → Outros',
};

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: string;
}

export const ImportarDocumentoModal: React.FC<Props> = ({ onClose, onSuccess, defaultType }) => {
  const [type, setType] = useState(defaultType ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [validate, setValidate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');

  const handleSubmit = async () => {
    if (!file || !title || !type || !date) { alert('Preencha todos os campos obrigatórios'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companyId', company.id ?? '');
      fd.append('type', type);
      fd.append('title', title);
      fd.append('date', date);
      fd.append('description', description);
      fd.append('validate', validate ? 'true' : 'false');
      const res = await fetch('http://localhost:3000/documents/import-signed', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '' },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Erro ao importar');
      setResult(data);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[14px] border border-gray-200 w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-[16px] font-medium text-gray-900">Enviar Documento</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">O documento será arquivado na prateleira correspondente ao tipo</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><FiX size={18} /></button>
        </div>

        {!result ? (
          <div className="p-5 space-y-4">

            {/* PASSO 1 — Tipo do documento */}
            <div className="border border-gray-200 rounded-[10px] p-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">1</span>
                Qual é o tipo do documento?
              </label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2.5 bg-white">
                <option value="">Selecione o tipo...</option>
                {TIPOS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {type && (
                <p className="text-[11px] text-blue-600 mt-1.5">
                  📁 Será arquivado em: <strong>{PRATELEIRA[type]}</strong>
                </p>
              )}
            </div>

            {/* PASSO 2 — Upload */}
            <div className="border border-gray-200 rounded-[10px] p-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">2</span>
                Selecione o arquivo PDF
              </label>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <FiUpload size={20} className="mx-auto mb-1.5 text-gray-400" />
                {file ? (
                  <div>
                    <p className="text-[14px] font-medium text-gray-800">{file.name}</p>
                    <p className="text-[12px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">Clique para selecionar o PDF</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.pdf$/i,'')); } }} />
            </div>

            {/* PASSO 3 — Detalhes */}
            <div className="border border-gray-200 rounded-[10px] p-4 space-y-3">
              <label className="block text-[13px] font-medium text-gray-700">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">3</span>
                Detalhes do documento
              </label>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Ex: Ata AGE — Alteração do Objeto Social" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Data do documento *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Descrição</label>
                  <input value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Opcional" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="validate" checked={validate} onChange={e => setValidate(e.target.checked)}
                  className="w-4 h-4 accent-purple-600" />
                <label htmlFor="validate" className="text-[12px] text-gray-600 cursor-pointer">
                  <FiShield size={11} className="inline mr-1 text-purple-600" />
                  Validar assinatura digital ao importar
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[14px] border border-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading || !file || !title || !type}
                className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg disabled:opacity-50">
                {loading ? 'Enviando...' : 'Enviar para o Arquivo'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-[10px] ${result.hasSignature ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <FiCheckCircle size={24} className={result.hasSignature ? 'text-green-600' : 'text-blue-600'} />
              <div>
                <p className="text-[15px] font-medium text-gray-900">Documento enviado com sucesso</p>
                <p className="text-[13px] text-gray-500 mt-0.5">
                  Arquivado em: <strong>{PRATELEIRA[type] ?? type}</strong>
                </p>
                <p className="text-[13px] text-gray-500">
                  Status: <strong>{result.status === 'ASSINADO' ? '✓ Assinado e Validado' : 'Arquivado'}</strong>
                </p>
                {result.hasSignature && <p className="text-[12px] text-green-700 mt-1">✓ Assinatura digital detectada</p>}
                <p className="text-[11px] text-gray-400 font-mono mt-1">SHA-256: {result.contentHash?.slice(0,32)}...</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { onSuccess(); onClose(); }} className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
