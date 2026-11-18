// frontend/src/pages/documentos/ArquivoAreaPage.tsx
// 04/11/2026 - Arquivo Digital reorganizado: cada area (Societario, Contabil e Fiscal, Pessoal) e uma pagina
// com abas no lugar dos itens de menu de 3o nivel. As rotas antigas continuam valendo e abrem a aba certa.
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiFileText, FiCheckCircle, FiClock, FiArchive, FiEye, FiShield, FiUpload, FiEdit2, FiSearch, FiAlertTriangle } from 'react-icons/fi';
import { SignatureValidateModal } from '../documents/signatures/SignatureValidateModal';
import { DocumentViewModal } from './DocumentViewModal';
import { DocumentEditModal } from './DocumentEditModal';
import { ImportarDocumentoModal } from './ImportarDocumentoModal';
import { RedigirProcuracaoModal } from './RedigirProcuracaoModal';
import api from '../../services/api';

const FIN = '#1A3A5C';
const FIN_LIGHT = '#EEF4FA';

// ARQ-ABAS-01 (18/11/2026): abas em destaque - cada aba com cor propria (fundo claro, borda e texto na cor; ativa preenchida)
type CorAba = { forte: string; claro: string; borda: string };
const CORES_ABA: CorAba[] = [
  { forte: '#0369A1', claro: '#E0F2FE', borda: '#7DD3FC' }, // azul
  { forte: '#047857', claro: '#D1FAE5', borda: '#6EE7B7' }, // verde
  { forte: '#6D28D9', claro: '#EDE9FE', borda: '#C4B5FD' }, // violeta
  { forte: '#B45309', claro: '#FEF3C7', borda: '#FCD34D' }, // ambar
  { forte: '#BE185D', claro: '#FCE7F3', borda: '#F9A8D4' }, // rosa
  { forte: '#0F766E', claro: '#CCFBF1', borda: '#5EEAD4' }, // verde-agua
  { forte: '#4338CA', claro: '#E0E7FF', borda: '#A5B4FC' }, // indigo
  { forte: '#A16207', claro: '#FEF9C3', borda: '#FDE047' }, // mostarda
];
const COR_TODOS: CorAba = { forte: '#334155', claro: '#F1F5F9', borda: '#CBD5E1' };
const COR_CLASSIFICAR: CorAba = { forte: '#C2410C', claro: '#FFEDD5', borda: '#FDBA74' };

type Aba = { key: string; label: string; types: string[]; subtipos?: string[]; semSubtipo?: boolean };
type Area = { label: string; abas: Aba[] };

const AREAS: Record<string, Area> = {
  societario: {
    label: 'Societário',
    abas: [
      { key: 'contratos', label: 'Contratos e alterações', types: ['CONTRATO_SOCIAL', 'ESTATUTO_SOCIAL', 'ADITIVO_CONTRATUAL'] },
      { key: 'atas', label: 'Atas', types: ['ATA_AGO', 'ATA_AGE', 'ATA_DIRETORIA'] },
      { key: 'procuracoes', label: 'Procurações', types: ['PROCURACAO'] },
      { key: 'acordos', label: 'Acordos de acionistas', types: ['ACORDO_ACIONISTAS'] },
      { key: 'livros', label: 'Livros', types: ['LIVRO_REGISTRO_ACOES', 'LIVRO_TRANSFERENCIA_ACOES', 'LIVRO_ATAS_AGO', 'LIVRO_ATAS_AGE', 'CERTIFICADO_ACOES'] },
    ],
  },
  contabil: {
    label: 'Contábil e Fiscal',
    abas: [
      { key: 'balancetes', label: 'Balancetes e demonstrações', types: ['CONTABIL'], subtipos: ['BALANCETE', 'DEMONSTRACAO'] },
      { key: 'ecd', label: 'ECD', types: ['CONTABIL'], subtipos: ['ECD'] },
      { key: 'livrocaixa', label: 'Livro Caixa', types: ['CONTABIL'], subtipos: ['LIVRO_CAIXA'] },
      { key: 'extratos', label: 'Extratos bancários', types: ['CONTABIL'], subtipos: ['EXTRATO_BANCARIO'] },
      { key: 'ecf', label: 'ECF', types: ['FISCAL'], subtipos: ['ECF'] },
      { key: 'obrigacoes', label: 'Obrigações', types: ['FISCAL'], subtipos: ['OBRIGACAO', 'DIMOB'] },
      { key: 'dimob', label: 'DIMOB', types: ['FISCAL'], subtipos: ['DIMOB'] },
      { key: 'darfs', label: 'DARFs e comprovantes', types: ['FISCAL'], subtipos: ['DARF'] },
      { key: 'notificacoes', label: 'Notificações e intimações', types: ['FISCAL'], subtipos: ['NOTIFICACAO'] },
      { key: 'classificar', label: 'A classificar', types: ['CONTABIL', 'FISCAL'], semSubtipo: true },
    ],
  },
  pessoal: {
    label: 'Pessoal',
    abas: [
      { key: 'contratos', label: 'Contratos de trabalho', types: ['TRABALHISTA'], subtipos: ['CONTRATO_TRABALHO'] },
      { key: 'acordos', label: 'Acordos coletivos', types: ['TRABALHISTA'], subtipos: ['ACORDO_COLETIVO'] },
      { key: 'classificar', label: 'A classificar', types: ['TRABALHISTA'], semSubtipo: true },
    ],
  },
};

const SUBTIPO_LABEL: Record<string, string> = {
  BALANCETE: 'Balancete', DEMONSTRACAO: 'Demonstração financeira', ECD: 'ECD',
  ECF: 'ECF', OBRIGACAO: 'Obrigação acessória', DIMOB: 'DIMOB',
  LIVRO_CAIXA: 'Livro Caixa', EXTRATO_BANCARIO: 'Extrato bancário', DARF: 'DARF / comprovante', NOTIFICACAO: 'Notificação / intimação',
  CONTRATO_TRABALHO: 'Contrato de trabalho', ACORDO_COLETIVO: 'Acordo coletivo',
};
const SUBTIPOS_POR_TIPO: Record<string, string[]> = {
  CONTABIL: ['BALANCETE', 'DEMONSTRACAO', 'ECD', 'LIVRO_CAIXA', 'EXTRATO_BANCARIO'],
  FISCAL: ['ECF', 'OBRIGACAO', 'DIMOB', 'DARF', 'NOTIFICACAO'],
  TRABALHISTA: ['CONTRATO_TRABALHO', 'ACORDO_COLETIVO'],
};
const TIPO_LABEL: Record<string, string> = {
  CONTRATO_SOCIAL: 'Contrato social', ESTATUTO_SOCIAL: 'Estatuto social', ADITIVO_CONTRATUAL: 'Alteração / aditivo',
  ATA_AGO: 'Ata AGO', ATA_AGE: 'Ata AGE', ATA_DIRETORIA: 'Ata de diretoria', PROCURACAO: 'Procuração',
  ACORDO_ACIONISTAS: 'Acordo de acionistas', LIVRO_REGISTRO_ACOES: 'Livro de registro', LIVRO_TRANSFERENCIA_ACOES: 'Livro de transferência',
  LIVRO_ATAS_AGO: 'Livro de atas AGO', LIVRO_ATAS_AGE: 'Livro de atas AGE', CERTIFICADO_ACOES: 'Certificado de ações',
  CONTABIL: 'Contábil', FISCAL: 'Fiscal', TRABALHISTA: 'Trabalhista', CONTRATO_LOCACAO: 'Contrato de locação',
  MATRICULA_IMOVEL: 'Matrícula de imóvel', ESCRITURA_PUBLICA: 'Escritura pública', OUTRO: 'Outro',
};
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO:              { label: 'Rascunho',       color: 'bg-gray-100 text-gray-600',    icon: <FiFileText size={11} /> },
  EM_REVISAO:            { label: 'Em revisão',     color: 'bg-yellow-50 text-yellow-700', icon: <FiClock size={11} /> },
  AGUARDANDO_ASSINATURA: { label: 'Ag. assinatura', color: 'bg-orange-50 text-orange-700', icon: <FiClock size={11} /> },
  ASSINADO:              { label: 'Assinado',       color: 'bg-green-50 text-green-700',   icon: <FiCheckCircle size={11} /> },
  REGISTRADO:            { label: 'Registrado',     color: 'bg-blue-50 text-blue-700',     icon: <FiCheckCircle size={11} /> },
  ARQUIVADO:             { label: 'Arquivado',      color: 'bg-gray-200 text-gray-500',    icon: <FiArchive size={11} /> },
  CANCELADO:             { label: 'Cancelado',      color: 'bg-red-50 text-red-700',       icon: <FiFileText size={11} /> },
};

// Rota -> area e aba. Mantem os links antigos (ex.: /app/arquivo/fiscal/obrigacoes).
const resolverRota = (pathname: string): { area: string; aba: string } => {
  const seg = pathname.replace(/^\/app\/arquivo\/?/, '').replace(/\/+$/, '').split('/');
  const [a, b] = seg;
  if (a === 'societario') return { area: 'societario', aba: b ?? 'todos' };
  if (a === 'livros') return { area: 'societario', aba: 'livros' };
  if (a === 'contabil') return { area: 'contabil', aba: b === 'demonstracoes' ? 'balancetes' : (b ?? 'todos') };
  if (a === 'fiscal') return { area: 'contabil', aba: b === 'ecf' || b === 'obrigacoes' ? b : 'todos' };
  if (a === 'rh') return { area: 'pessoal', aba: b === 'contratos' || b === 'acordos' ? b : 'todos' };
  return { area: 'societario', aba: 'todos' };
};

const empresaAtiva = () => {
  try { return JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}'); } catch { return {}; }
};
const fmtData = (d?: string | null) => {
  if (!d) return '-';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return y && m && dd ? `${dd}/${m}/${y}` : String(d);
};

export const ArquivoAreaPage: React.FC = () => {
  const location = useLocation();
  const rota = resolverRota(location.pathname);
  const area = AREAS[rota.area];
  const tiposArea = useMemo(() => Array.from(new Set(area.abas.flatMap(a => a.types))), [rota.area]);

  const [aba, setAba] = useState(rota.aba);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaGlobal, setBuscaGlobal] = useState(false);
  const [resultadoGlobal, setResultadoGlobal] = useState<any[] | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: string; title: string } | null>(null);
  const [editDoc, setEditDoc] = useState<{ id: string; title: string } | null>(null);
  const [validateDocId, setValidateDocId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showRedigir, setShowRedigir] = useState(false);

  useEffect(() => { setAba(rota.aba); }, [location.pathname]);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/documents/arquivo/lista', { params: { companyId: empresaAtiva().id, types: tiposArea.join(',') } });
      setDocs(Array.isArray(r.data) ? r.data : []);
    } catch { setDocs([]); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, [rota.area]);

  // Busca em todo o Arquivo Digital (todas as areas)
  useEffect(() => {
    if (!buscaGlobal || busca.trim().length < 2) { setResultadoGlobal(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/documents/arquivo/lista', { params: { companyId: empresaAtiva().id, q: busca.trim() } });
        setResultadoGlobal(Array.isArray(r.data) ? r.data : []);
      } catch { setResultadoGlobal([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [busca, buscaGlobal]);

  const pertence = (d: any, a: Aba) =>
    a.types.includes(d.type) && (a.semSubtipo ? !d.subtipo : a.subtipos ? a.subtipos.includes(d.subtipo) : true);
  const abaAtual = area.abas.find(a => a.key === aba);
  const contagem = (a: Aba) => docs.filter(d => pertence(d, a)).length;

  const filtrados = useMemo(() => {
    let l = abaAtual ? docs.filter(d => pertence(d, abaAtual)) : docs;
    const q = busca.trim().toLowerCase();
    if (q && !buscaGlobal) l = l.filter(d => `${d.title} ${d.description ?? ''} ${TIPO_LABEL[d.type] ?? d.type}`.toLowerCase().includes(q));
    return l;
  }, [docs, aba, busca, buscaGlobal]);
  const linhas = buscaGlobal && resultadoGlobal ? resultadoGlobal : filtrados;

  const classificar = async (d: any, subtipo: string) => {
    try {
      await api.patch(`/documents/${d.id}/subtipo`, { companyId: empresaAtiva().id, subtipo: subtipo || null });
      setDocs(prev => prev.map(x => x.id === d.id ? { ...x, subtipo: subtipo || null } : x));
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao classificar'); }
  };

  const tipoImport = abaAtual && abaAtual.types.length === 1 ? abaAtual.types[0] : undefined;
  const aClassificar = area.abas.find(a => a.semSubtipo);
  const pendentes = aClassificar ? contagem(aClassificar) : 0;

  const abaBtn = (key: string, label: string, n: number, cor: CorAba) => {
    const ativa = aba === key;
    return (
      <button key={key} onClick={() => setAba(key)}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-shadow hover:shadow-sm"
        style={ativa ? { background: cor.forte, borderColor: cor.forte, color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.18)' }
                     : { background: cor.claro, borderColor: cor.borda, color: cor.forte }}>
        {label}
        <span className="min-w-[20px] px-1.5 rounded-full text-[11px] font-semibold text-center"
          style={ativa ? { background: 'rgba(255,255,255,.25)', color: '#fff' } : { background: '#fff', color: cor.forte }}>{n}</span>
      </button>
    );
  };
  const th = 'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-gray-900">{area.label}</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {docs.length} documento{docs.length !== 1 ? 's' : ''}
            {pendentes > 0 && <span className="text-orange-700"> · {pendentes} a classificar</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {aba === 'procuracoes' && (
            <button onClick={() => setShowRedigir(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] hover:bg-blue-700">
              <FiFileText size={13} /> Redigir procuração
            </button>
          )}
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-[13px]" style={{ background: FIN }}>
            <FiUpload size={13} /> Importar documento
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {abaBtn('todos', 'Todos', docs.length, COR_TODOS)}
        {area.abas.map((a, i) => abaBtn(a.key, a.label, contagem(a), a.key === 'classificar' ? COR_CLASSIFICAR : CORES_ABA[i % CORES_ABA.length]))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <FiSearch size={13} className="text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={buscaGlobal ? 'Buscar em todo o Arquivo...' : 'Buscar nesta área...'}
            className="text-[13px] outline-none w-[220px]" />
        </div>
        <label className="text-[12px] text-gray-600 flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={buscaGlobal} onChange={e => setBuscaGlobal(e.target.checked)} /> em todo o Arquivo
        </label>
      </div>

      {buscaGlobal && resultadoGlobal && (
        <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: FIN_LIGHT, color: FIN }}>
          {resultadoGlobal.length} resultado(s) em todo o Arquivo Digital para "{busca.trim()}"
        </div>
      )}

      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Documento</th>
              <th className={th}>Tipo</th>
              <th className={th}>Data</th>
              <th className={th}>Status</th>
              <th className={th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : linhas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <FiArchive size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-[14px] text-gray-400">Nenhum documento {busca ? 'encontrado' : 'nesta aba'}</p>
              </td></tr>
            ) : linhas.map(d => {
              const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.RASCUNHO;
              const opcoes = SUBTIPOS_POR_TIPO[d.type];
              return (
                <tr key={d.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewDoc({ id: d.id, title: d.title })} className="text-[14px] font-medium text-gray-900 hover:text-blue-600 hover:underline text-left">
                      {d.title}
                    </button>
                    {d.description && <p className="text-[12px] text-gray-400 mt-0.5">{d.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-gray-500">{TIPO_LABEL[d.type] ?? d.type?.replace(/_/g, ' ')}</span>
                    {opcoes && (
                      <select value={d.subtipo ?? ''} onChange={e => classificar(d, e.target.value)}
                        className={`block mt-1 text-[11px] border rounded px-1 py-0.5 ${d.subtipo ? 'border-gray-200 text-gray-600' : 'border-orange-300 text-orange-700 bg-orange-50'}`}>
                        <option value="">{d.subtipo ? 'Sem classificação' : 'Classificar...'}</option>
                        {opcoes.map(s => <option key={s} value={s}>{SUBTIPO_LABEL[s]}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{fmtData(d.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>{st.icon} {st.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button title="Visualizar" onClick={() => setViewDoc({ id: d.id, title: d.title })}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={14} /></button>
                      {d.status === 'RASCUNHO' && (
                        <button title="Editar" onClick={() => setEditDoc({ id: d.id, title: d.title })}
                          className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded"><FiEdit2 size={14} /></button>
                      )}
                      <button title="Validar assinatura" onClick={() => setValidateDocId(d.id)}
                        className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded"><FiShield size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendentes > 0 && aba !== 'classificar' && (
        <p className="text-[12px] text-orange-700 flex items-center gap-1.5">
          <FiAlertTriangle size={12} /> {pendentes} documento(s) sem classificação aparecem só em "Todos" e "A classificar".
        </p>
      )}

      {showRedigir && <RedigirProcuracaoModal onClose={() => setShowRedigir(false)} onSuccess={() => { setShowRedigir(false); carregar(); }} />}
      {showImport && <ImportarDocumentoModal onClose={() => setShowImport(false)} onSuccess={() => carregar()} defaultType={tipoImport} />}
      {viewDoc !== null && (
        <DocumentViewModal documentId={viewDoc.id} documentTitle={viewDoc.title}
          onClose={() => { setViewDoc(null); carregar(); }} onValidate={(id: string) => { setValidateDocId(id); setViewDoc(null); }} />
      )}
      {editDoc !== null && (
        <DocumentEditModal documentId={editDoc.id} documentTitle={editDoc.title}
          onClose={() => setEditDoc(null)} onSaved={() => { setEditDoc(null); carregar(); }} />
      )}
      {validateDocId !== null && <SignatureValidateModal documentId={validateDocId} onClose={() => setValidateDocId(null)} />}
    </div>
  );
};
