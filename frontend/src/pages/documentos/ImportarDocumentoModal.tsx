// frontend/src/pages/documentos/ImportarDocumentoModal.tsx
// ARQ-IMP-01 (19/11/2026): tipo + classificacao (subtipo) escolhidos juntos no envio; Contabil, Fiscal e RH no topo;
// SPED/declaracoes (ECD, ECF, EFD-Contribuicoes, EFD-Reinf, DCTF, DCTFWeb/MIT, DIMOB) e eSocial; botao "Importar outro documento".
// ARQ-IMP-02 (19/11/2026): varios arquivos de uma vez (ex.: declaracao .DEC + recibo .REC + recibo PDF) - um documento por arquivo.
import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiCheckCircle, FiShield, FiAlertTriangle } from 'react-icons/fi';
import { SmartDateInput } from '../../components/SmartDateInput';
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

// valor = TIPO ou TIPO|SUBTIPO (subtipo = classificacao da aba no Arquivo Digital)
const TIPOS: { group: string; items: { value: string; label: string }[] }[] = [
  { group: 'Contábil', items: [
    { value: 'CONTABIL|BALANCETE', label: 'Balancete' },
    { value: 'CONTABIL|DEMONSTRACAO', label: 'Demonstração financeira' },
    { value: 'CONTABIL|ECD', label: 'ECD - Escrituração Contábil Digital (arquivo ou recibo)' },
    { value: 'CONTABIL|LIVRO_CAIXA', label: 'Livro Caixa' },
    { value: 'CONTABIL|EXTRATO_BANCARIO', label: 'Extrato bancário' },
    { value: 'CONTABIL', label: 'Outro documento contábil' },
  ]},
  { group: 'Fiscal - SPED', items: [
    { value: 'FISCAL|ECF', label: 'ECF - Escrituração Contábil Fiscal (arquivo ou recibo)' },
    { value: 'FISCAL|EFD_CONTRIBUICOES', label: 'EFD-Contribuições (arquivo ou recibo)' },
    { value: 'FISCAL|EFD_REINF', label: 'EFD-Reinf (recibo ou relatório)' },
    { value: 'FISCAL|SPED_OUTROS', label: 'Arquivo SPED (outros)' },
  ]},
  { group: 'Fiscal - Declarações', items: [
    { value: 'FISCAL|DCTFWEB', label: 'DCTFWeb / MIT (declaração ou recibo)' },
    { value: 'FISCAL|DCTF', label: 'DCTF Mensal (declaração ou recibo)' },
    { value: 'FISCAL|DIMOB', label: 'DIMOB (declaração ou recibo)' },
    { value: 'FISCAL|OBRIGACAO', label: 'Outra obrigação acessória' },
  ]},
  { group: 'Fiscal - Pagamentos e Fisco', items: [
    { value: 'FISCAL|DARF', label: 'DARF / comprovante de pagamento' },
    { value: 'FISCAL|NOTIFICACAO', label: 'Notificação / intimação' },
    { value: 'FISCAL', label: 'Outro documento fiscal' },
  ]},
  { group: 'RH / Trabalhista', items: [
    { value: 'TRABALHISTA|ESOCIAL', label: 'eSocial (recibos e relatórios)' },
    { value: 'TRABALHISTA|FOLHA', label: 'Folha de pagamento / holerite' },
    { value: 'TRABALHISTA|RECIBO_PROLABORE', label: 'Recibo de pró-labore' },
    { value: 'TRABALHISTA|CONTRATO_TRABALHO', label: 'Contrato de trabalho' },
    { value: 'TRABALHISTA|ACORDO_COLETIVO', label: 'Acordo coletivo' },
  ]},
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
  { group: 'Locação', items: [
    { value: 'CONTRATO_LOCACAO', label: 'Contrato de Locação (e aditivos de locação)' },
  ]},
  { group: 'Livros Societários', items: [
    { value: 'LIVRO_REGISTRO_ACOES', label: 'Livro de Registro de Ações/Quotas' },
    { value: 'LIVRO_TRANSFERENCIA_ACOES', label: 'Livro de Transferência de Ações' },
    { value: 'LIVRO_ATAS_AGO', label: 'Livro de Atas de AGO' },
    { value: 'LIVRO_ATAS_AGE', label: 'Livro de Atas de AGE' },
  ]},
  { group: 'Outros', items: [
    { value: 'OUTRO', label: 'Outro documento' },
  ]},
];
const OPCOES = TIPOS.flatMap(g => g.items);

const PRATELEIRA: Record<string, string> = {
  CONTRATO_SOCIAL: 'Arquivo → Societário → Contratos e alterações',
  ESTATUTO_SOCIAL: 'Arquivo → Societário → Contratos e alterações',
  ADITIVO_CONTRATUAL: 'Arquivo → Societário → Contratos e alterações',
  ATA_AGO: 'Arquivo → Societário → Atas',
  ATA_AGE: 'Arquivo → Societário → Atas',
  ATA_DIRETORIA: 'Arquivo → Societário → Atas',
  PROCURACAO: 'Arquivo → Societário → Procurações',
  ACORDO_ACIONISTAS: 'Arquivo → Societário → Acordos de acionistas',
  LIVRO_REGISTRO_ACOES: 'Arquivo → Societário → Livros',
  LIVRO_TRANSFERENCIA_ACOES: 'Arquivo → Societário → Livros',
  LIVRO_ATAS_AGO: 'Arquivo → Societário → Livros',
  LIVRO_ATAS_AGE: 'Arquivo → Societário → Livros',
  CONTRATO_LOCACAO: 'Arquivo → Imóveis → Contratos de locação',
  OUTRO: 'Arquivo → Outros',
  CONTABIL: 'Arquivo → Contábil e Fiscal → A classificar',
  FISCAL: 'Arquivo → Contábil e Fiscal → A classificar',
  'CONTABIL|BALANCETE': 'Arquivo → Contábil e Fiscal → Balancetes e demonstrações',
  'CONTABIL|DEMONSTRACAO': 'Arquivo → Contábil e Fiscal → Balancetes e demonstrações',
  'CONTABIL|ECD': 'Arquivo → Contábil e Fiscal → ECD',
  'CONTABIL|LIVRO_CAIXA': 'Arquivo → Contábil e Fiscal → Livro Caixa',
  'CONTABIL|EXTRATO_BANCARIO': 'Arquivo → Contábil e Fiscal → Extratos bancários',
  'FISCAL|ECF': 'Arquivo → Contábil e Fiscal → ECF',
  'FISCAL|DIMOB': 'Arquivo → Contábil e Fiscal → DIMOB',
  'FISCAL|DARF': 'Arquivo → Contábil e Fiscal → DARFs e comprovantes',
  'FISCAL|NOTIFICACAO': 'Arquivo → Contábil e Fiscal → Notificações e intimações',
  'TRABALHISTA|ESOCIAL': 'Arquivo → Pessoal → eSocial',
  'TRABALHISTA|FOLHA': 'Arquivo → Pessoal → Folha e pró-labore',
  'TRABALHISTA|RECIBO_PROLABORE': 'Arquivo → Pessoal → Folha e pró-labore',
  'TRABALHISTA|CONTRATO_TRABALHO': 'Arquivo → Pessoal → Contratos de trabalho',
  'TRABALHISTA|ACORDO_COLETIVO': 'Arquivo → Pessoal → Acordos coletivos',
};
const destino = (v: string) => PRATELEIRA[v] ?? (v.startsWith('FISCAL|') ? 'Arquivo → Contábil e Fiscal → Obrigações' : 'Arquivo');

// Arquivos SPED, declaracoes e recibos podem vir em .txt/.rec/.dec/.zip/.xml (nao so PDF)
const SUBTIPOS_ARQUIVO = ['ECD', 'ECF', 'EFD_CONTRIBUICOES', 'EFD_REINF', 'SPED_OUTROS', 'DCTF', 'DCTFWEB', 'DIMOB', 'OBRIGACAO', 'ESOCIAL'];
const aceitaArquivo = (v: string) => SUBTIPOS_ARQUIVO.includes(v.split('|')[1] ?? '');

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: string;
}

export const ImportarDocumentoModal: React.FC<Props> = ({ onClose, onSuccess, defaultType }) => {
  const inicial = defaultType && OPCOES.some(o => o.value === defaultType) ? defaultType : '';
  const [opcao, setOpcao] = useState(inicial);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [validate, setValidate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [enviadosLote, setEnviadosLote] = useState<{ nome: string; ok: boolean; erro?: string }[]>([]);
  const [avisoClassif, setAvisoClassif] = useState('');
  const [enviados, setEnviados] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const [type, subtipo] = opcao.split('|');
  const ehPdf = files.length === 0 || files.every(f => /\.pdf$/i.test(f.name));
  const varios = files.length > 1;
  const semExt = (n: string) => n.replace(/\.[^.]+$/, '');

  // Envia um arquivo; devolve o retorno do import ou lanca erro. Classifica (subtipo) logo depois.
  const enviarUm = async (f: File, titulo: string) => {
    const fd = new FormData();
    fd.append('file', f);
    fd.append('companyId', company.id ?? '');
    fd.append('type', type);
    fd.append('title', titulo);
    fd.append('date', date);
    fd.append('description', description);
    fd.append('validate', validate && /\.pdf$/i.test(f.name) ? 'true' : 'false');
    const res = await fetch(`${API}/documents/import-signed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '' },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? 'Erro ao importar');
    let aviso = '';
    if (subtipo) {
      const docId = data?.id ?? data?.documentId ?? data?.document?.id;
      if (!docId) aviso = 'sem classificação (classifique na lista)';
      else {
        const r2 = await fetch(`${API}/documents/${docId}/subtipo`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: company.id ?? '', subtipo }),
        });
        if (!r2.ok) { const e2 = await r2.json().catch(() => ({})); aviso = 'classificação falhou' + (e2?.message ? ': ' + e2.message : ''); }
      }
    }
    return { data, aviso };
  };

  const handleSubmit = async () => {
    if (!files.length || !type || !date || (!varios && !title)) { alert('Preencha todos os campos obrigatórios'); return; }
    setLoading(true); setAvisoClassif('');
    const lote: { nome: string; ok: boolean; erro?: string }[] = [];
    let ultimo: any = null; const avisos: string[] = [];
    for (const f of files) {
      // varios arquivos: titulo = prefixo informado (se houver) + nome do arquivo
      const titulo = varios ? (title.trim() ? `${title.trim()} - ${semExt(f.name)}` : semExt(f.name)) : title;
      try {
        const { data, aviso } = await enviarUm(f, titulo);
        ultimo = data; lote.push({ nome: f.name, ok: true });
        if (aviso) avisos.push(`${f.name}: ${aviso}`);
      } catch (e: any) { lote.push({ nome: f.name, ok: false, erro: e.message }); }
    }
    setLoading(false);
    const ok = lote.filter(x => x.ok).length;
    if (!ok) { alert('Nenhum arquivo foi enviado: ' + lote.map(x => `${x.nome}: ${x.erro}`).join(' | ')); return; }
    if (avisos.length) setAvisoClassif('Arquivado, mas: ' + avisos.join(' | '));
    setEnviadosLote(lote);
    setResult(ultimo);
    setEnviados(n => n + ok);
  };

  // Volta ao passo 1 mantendo o tipo e a data (envio em sequencia de documentos parecidos)
  const importarOutro = () => {
    onSuccess();
    setFiles([]); setTitle(''); setDescription(''); setResult(null); setAvisoClassif(''); setValidate(true); setEnviadosLote([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) { if (enviados) onSuccess(); onClose(); } }}>
      <div className="bg-white rounded-[14px] border border-gray-200 w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-[16px] font-medium text-gray-900">Enviar Documento</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">
              O documento será arquivado na prateleira correspondente ao tipo{enviados > 0 ? ` · ${enviados} enviado${enviados > 1 ? 's' : ''} nesta sessão` : ''}
            </p>
          </div>
          <button onClick={() => { if (enviados) onSuccess(); onClose(); }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><FiX size={18} /></button>
        </div>

        {!result ? (
          <div className="p-5 space-y-4">

            {/* PASSO 1 - Tipo do documento */}
            <div className="border border-gray-200 rounded-[10px] p-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">1</span>
                Qual é o tipo do documento?
              </label>
              <select value={opcao} onChange={e => setOpcao(e.target.value)}
                className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2.5 bg-white">
                <option value="">Selecione o tipo...</option>
                {TIPOS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {opcao && (
                <p className="text-[11px] text-blue-600 mt-1.5">
                  📁 Será arquivado em: <strong>{destino(opcao)}</strong>
                </p>
              )}
            </div>

            {/* PASSO 2 - Upload */}
            <div className="border border-gray-200 rounded-[10px] p-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">2</span>
                {aceitaArquivo(opcao) ? 'Selecione o(s) arquivo(s) (PDF, TXT, REC, DEC, XML ou ZIP)' : 'Selecione o(s) arquivo(s) PDF'}
              </label>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <FiUpload size={20} className="mx-auto mb-1.5 text-gray-400" />
                {files.length ? (
                  <div className="space-y-0.5">
                    {files.map(f => (
                      <p key={f.name} className="text-[13px] text-gray-800"><span className="font-medium">{f.name}</span> <span className="text-gray-500">({(f.size / 1024).toFixed(1)} KB)</span></p>
                    ))}
                    {varios && <p className="text-[11px] text-blue-600 pt-1">{files.length} arquivos - um documento para cada, com o mesmo tipo e data</p>}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-500">Clique para selecionar - pode marcar vários (ex.: declaração .DEC + recibo .REC + recibo PDF)</p>
                )}
              </div>
              <input ref={fileRef} type="file" multiple accept={aceitaArquivo(opcao) ? '.pdf,.txt,.rec,.dec,.xml,.zip' : '.pdf'} className="hidden"
                onChange={e => { const l = Array.from(e.target.files ?? []); if (l.length) { setFiles(l); if (l.length === 1 && !title) setTitle(semExt(l[0].name)); } }} />
            </div>

            {/* PASSO 3 - Detalhes */}
            <div className="border border-gray-200 rounded-[10px] p-4 space-y-3">
              <label className="block text-[13px] font-medium text-gray-700">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#111] text-white text-[11px] mr-2">3</span>
                Detalhes do documento
              </label>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">{varios ? 'Prefixo do título (opcional - cada documento leva o nome do arquivo)' : 'Título *'}</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Ex: Recibo ECF 2025 - entrega original" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Data do documento *</label>
                  <SmartDateInput value={date} onChange={v => setDate(v)}
                    className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Descrição</label>
                  <input value={description} onChange={e => setDescription(e.target.value)}
                    className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Opcional" />
                </div>
              </div>
              {ehPdf && (
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="validate" checked={validate} onChange={e => setValidate(e.target.checked)}
                    className="w-4 h-4 accent-purple-600" />
                  <label htmlFor="validate" className="text-[12px] text-gray-600 cursor-pointer">
                    <FiShield size={11} className="inline mr-1 text-purple-600" />
                    Validar assinatura digital ao importar
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { if (enviados) onSuccess(); onClose(); }} className="px-4 py-2 text-[14px] border border-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading || !files.length || (!varios && !title) || !type}
                className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg disabled:opacity-50">
                {loading ? 'Enviando...' : varios ? `Enviar ${files.length} arquivos` : 'Enviar para o Arquivo'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-[10px] ${result.hasSignature ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <FiCheckCircle size={24} className={result.hasSignature ? 'text-green-600' : 'text-blue-600'} />
              <div>
                <p className="text-[15px] font-medium text-gray-900">{enviadosLote.length > 1 ? `${enviadosLote.filter(x => x.ok).length} de ${enviadosLote.length} documentos enviados` : 'Documento enviado com sucesso'}</p>
                {enviadosLote.length > 1 && enviadosLote.map(x => (
                  <p key={x.nome} className={`text-[12px] ${x.ok ? 'text-gray-600' : 'text-red-700'}`}>{x.ok ? '✓' : '✗'} {x.nome}{x.erro ? ' - ' + x.erro : ''}</p>
                ))}
                <p className="text-[13px] text-gray-500 mt-0.5">
                  Arquivado em: <strong>{destino(opcao)}</strong>
                </p>
                <p className="text-[13px] text-gray-500">
                  Status: <strong>{result.status === 'ASSINADO' ? '✓ Assinado e Validado' : 'Arquivado'}</strong>
                </p>
                {result.hasSignature && <p className="text-[12px] text-green-700 mt-1">✓ Assinatura digital detectada</p>}
                <p className="text-[11px] text-gray-400 font-mono mt-1">SHA-256: {result.contentHash?.slice(0,32)}...</p>
              </div>
            </div>
            {avisoClassif && (
              <p className="text-[12px] text-orange-700 flex items-center gap-1.5"><FiAlertTriangle size={12} /> {avisoClassif}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={importarOutro} className="flex items-center gap-1.5 px-4 py-2 text-[14px] border border-gray-300 rounded-lg hover:bg-gray-50">
                <FiUpload size={13} /> Importar outro documento
              </button>
              <button onClick={() => { onSuccess(); onClose(); }} className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};