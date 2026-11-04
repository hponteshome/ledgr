// frontend/src/pages/documentos/ImoveisDocumentosPage.tsx
// 04/11/2026 - Arquivo Digital > Imoveis: matriculas e escrituras vinculadas ao cadastro do imovel,
// com situacao registral. Situacao diferente de "em nome da empresa" aparece como alerta.
// 04/11/2026 (reorganizacao): abas Matriculas | Escrituras | Contratos de locacao | Todos.
// 04/11/2026 (ordenacao): ordenacao por coluna e filtro de situacao, incluindo "Sem matricula".
// 04/11/2026 (cessao): contratos de cessao; imovel em nome do socio/cedente ou de terceiro/Grupo exige contrato de cessao.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiUpload, FiEye, FiAlertTriangle, FiCheckCircle, FiX, FiHome, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { SmartDateInput } from '../../components/SmartDateInput';
import { DocumentViewModal } from './DocumentViewModal';
import { ImportarDocumentoModal } from './ImportarDocumentoModal';
import api from '../../services/api';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const FIN = '#1A3A5C';
const FIN_ACCENT = '#2E6DA4';
const FIN_LIGHT = '#EEF4FA';

const SITUACOES: Record<string, { label: string; alerta: boolean; cor: string }> = {
  EMPRESA:                 { label: 'Em nome da empresa', alerta: false, cor: 'bg-green-50 text-green-700' },
  SOCIO_PENDENTE_REGISTRO: { label: 'Em nome do sócio/cedente - registro pendente', alerta: true, cor: 'bg-orange-50 text-orange-700' },
  GRUPO_TERCEIRO:          { label: 'Em nome de empresa do Grupo ou terceiro', alerta: true, cor: 'bg-red-50 text-red-700' },
  SEM_MATRICULA:           { label: 'Sem matrícula', alerta: true, cor: 'bg-red-50 text-red-700' },
};
const TIPO_LABEL: Record<string, string> = { MATRICULA: 'Matrícula', ESCRITURA: 'Escritura', CESSAO: 'Contrato de cessão' };
// Situacoes em que o imovel nao esta em nome da empresa e a posse/uso depende de contrato de cessao
const CEDE: Record<string, boolean> = { SOCIO_PENDENTE_REGISTRO: true, GRUPO_TERCEIRO: true };

const fmtData = (d?: string | null) => {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split('-');
  return y && m && dd ? `${dd}/${m}/${y}` : s;
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] text-gray-500 mb-1">{children}</label>
);
const inputSt = 'w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white';

interface Imovel { id: string; internalCode: string; description?: string; registryNumber?: string | null; registryOffice?: string | null; group?: string }

const empresaAtiva = () => {
  try { return JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}'); } catch { return {}; }
};

const ImportarImovelDocModal: React.FC<{ tipoInicial: string; imoveis: Imovel[]; assetInicial?: string; onClose: () => void; onSaved: () => void }> = ({ tipoInicial, imoveis, assetInicial, onClose, onSaved }) => {
  const [tipo, setTipo] = useState(tipoInicial || 'MATRICULA');
  const [assetId, setAssetId] = useState(assetInicial ?? '');
  const [assetIds, setAssetIds] = useState<string[]>(assetInicial ? [assetInicial] : []);
  const [file, setFile] = useState<File | null>(null);
  const [numero, setNumero] = useState('');
  const [cartorio, setCartorio] = useState('');
  const [dataCert, setDataCert] = useState('');
  const [ultimoAto, setUltimoAto] = useState('');
  const [proprietario, setProprietario] = useState('');
  const [situacao, setSituacao] = useState('EMPRESA');
  const [obs, setObs] = useState('');
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cessao = tipo === 'CESSAO';
  const imovel = imoveis.find(i => i.id === assetId);

  useEffect(() => {
    if (!imovel) return;
    setNumero(imovel.registryNumber ?? '');
    setCartorio(imovel.registryOffice ?? '');
  }, [assetId]);

  useEffect(() => {
    if (cessao) {
      const codigos = imoveis.filter(i => assetIds.includes(i.id)).map(i => i.internalCode);
      setTitulo(`Contrato de cessão - ${proprietario || 'cedente'}${codigos.length ? ' - ' + codigos.join(', ') : ''}${dataCert ? ' (' + fmtData(dataCert) + ')' : ''}`);
      return;
    }
    if (!imovel) { setTitulo(''); return; }
    const quando = dataCert ? ` (${tipo === 'ESCRITURA' ? '' : 'certidão '}${fmtData(dataCert)})` : '';
    setTitulo(tipo === 'ESCRITURA'
      ? `Escritura - ${imovel.internalCode}${quando}`
      : `Matrícula ${numero || 's/n'} - ${imovel.internalCode}${cartorio ? ' - RI ' + cartorio : ''}${quando}`);
  }, [assetId, assetIds, tipo, numero, cartorio, dataCert, proprietario]);

  const alternar = (id: string) => setAssetIds(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);

  const salvar = async () => {
    setErro('');
    const ids = cessao ? assetIds : (assetId ? [assetId] : []);
    if (!ids.length || !file || !titulo || !dataCert) { setErro(cessao ? 'Informe os imóveis, o PDF, a data do contrato e o título.' : 'Informe o imóvel, o PDF, a data e o título.'); return; }
    setSalvando(true);
    try {
      const token = localStorage.getItem('@ledgr:token');
      const company = empresaAtiva();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('companyId', company.id ?? '');
      fd.append('fixedAssetId', ids[0]);
      fd.append('fixedAssetIds', ids.join(','));
      fd.append('tipo', tipo);
      fd.append('title', titulo);
      fd.append('dataCertidao', dataCert);
      fd.append('numeroMatricula', cessao ? '' : numero);
      fd.append('cartorio', cessao ? '' : cartorio);
      fd.append('ultimoAto', ultimoAto);
      fd.append('proprietarioRegistral', proprietario);
      fd.append('situacao', cessao ? 'EMPRESA' : situacao);
      fd.append('observacao', obs);
      const res = await fetch(`${API}/documents/imoveis/importar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-company-id': company.id ?? '' },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join('; ') : (data?.message ?? 'Erro ao importar'));
      onSaved();
    } catch (e: any) { setErro(e?.message ?? String(e)); }
    setSalvando(false);
  };

  const secao = (titulo: string, children: React.ReactNode) => (
    <div className="pl-3 space-y-3" style={{ borderLeft: `3px solid ${FIN_ACCENT}` }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: FIN }}>{titulo}</p>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[14px] w-[620px] max-h-[92vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex justify-between items-center px-5 py-4" style={{ background: FIN }}>
          <div>
            <h3 className="text-[16px] font-medium text-white">{cessao ? 'Arquivar contrato de cessão' : 'Arquivar matrícula ou escritura'}</h3>
            <p className="text-[12px] text-white/70 mt-0.5">{cessao ? 'Um contrato pode cobrir vários imóveis' : 'O documento fica ligado ao imóvel, com a situação registral'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded"><FiX size={18} /></button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {secao('Documento', (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo *</Label>
                  <select className={inputSt} value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="MATRICULA">Matrícula (certidão)</option>
                    <option value="ESCRITURA">Escritura pública</option>
                    <option value="CESSAO">Contrato de cessão</option>
                  </select>
                </div>
                {!cessao && (
                  <div>
                    <Label>Imóvel *</Label>
                    <select className={inputSt} value={assetId} onChange={e => setAssetId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {imoveis.map(i => <option key={i.id} value={i.id}>{i.internalCode}{i.registryNumber ? ' - mat. ' + i.registryNumber : ''}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {cessao && (
                <div>
                  <Label>Imóveis cobertos pelo contrato * ({assetIds.length})</Label>
                  <div className="border border-gray-200 rounded-lg p-2 grid grid-cols-3 gap-1" style={{ maxHeight: 150, overflowY: 'auto' }}>
                    {imoveis.map(i => (
                      <label key={i.id} className="text-[12px] text-gray-700 flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={assetIds.includes(i.id)} onChange={() => alternar(i.id)} /> {i.internalCode}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400"
                style={{ background: file ? FIN_LIGHT : undefined }}>
                <FiUpload size={18} className="mx-auto mb-1 text-gray-400" />
                {file ? <p className="text-[13px] text-gray-800">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
                      : <p className="text-[13px] text-gray-500">Clique para selecionar o PDF</p>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            </>
          ))}

          {secao(cessao ? 'Contrato' : 'Registro', cessao ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cedente (titular registral) *</Label>
                  <input className={inputSt} value={proprietario} onChange={e => setProprietario(e.target.value)} placeholder="Ex.: Pontes Contabilidade" />
                </div>
                <div>
                  <Label>Data do contrato *</Label>
                  <SmartDateInput value={dataCert} onChange={(v: string) => setDataCert(v)} className={inputSt} />
                </div>
              </div>
              <div>
                <Label>Objeto / condições (cessão de direitos, uso, administração, prazo...)</Label>
                <input className={inputSt} value={ultimoAto} onChange={e => setUltimoAto(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{tipo === 'ESCRITURA' ? 'Matrícula citada' : 'Número da matrícula'}</Label>
                  <input className={inputSt} value={numero} onChange={e => setNumero(e.target.value)} />
                </div>
                <div>
                  <Label>Cartório (RI)</Label>
                  <input className={inputSt} value={cartorio} onChange={e => setCartorio(e.target.value)} placeholder="Ex.: 1º RI Santos" />
                </div>
                <div>
                  <Label>{tipo === 'ESCRITURA' ? 'Data da escritura *' : 'Data da certidão *'}</Label>
                  <SmartDateInput value={dataCert} onChange={(v: string) => setDataCert(v)} className={inputSt} />
                </div>
              </div>
              <div>
                <Label>Último ato da matrícula / objeto da escritura</Label>
                <input className={inputSt} value={ultimoAto} onChange={e => setUltimoAto(e.target.value)} placeholder="Ex.: R.1 15/07/2024 - escritura de 22/05/2024, R$ 324.900,00" />
              </div>
              <div>
                <Label>Proprietário registral</Label>
                <input className={inputSt} value={proprietario} onChange={e => setProprietario(e.target.value)} />
              </div>
            </>
          ))}

          {secao(cessao ? 'Observações' : 'Situação', (
            <>
              {!cessao && (
                <div>
                  <Label>Situação registral *</Label>
                  <select className={inputSt} value={situacao} onChange={e => setSituacao(e.target.value)}>
                    {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {SITUACOES[situacao]?.alerta && (
                    <p className="text-[11px] text-orange-700 mt-1.5 flex items-center gap-1"><FiAlertTriangle size={11} /> Vai aparecer como alerta na lista de matrículas{CEDE[situacao] ? ' e pede contrato de cessão' : ''}</p>
                  )}
                </div>
              )}
              <div>
                <Label>Observação / ressalva</Label>
                <textarea className={inputSt} rows={2} value={obs} onChange={e => setObs(e.target.value)} />
              </div>
              <div>
                <Label>Título no Arquivo Digital *</Label>
                <input className={inputSt} value={titulo} onChange={e => setTitulo(e.target.value)} />
              </div>
            </>
          ))}

          {erro && <div className="text-[12px] text-red-800 rounded-lg px-3 py-2" style={{ background: '#FCEBEB' }}>{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200" style={{ background: '#FAFAFA' }}>
          <button onClick={onClose} className="px-4 py-2 text-[13px] border border-gray-200 rounded-lg bg-white">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-5 py-2 text-[13px] text-white rounded-lg disabled:opacity-50" style={{ background: FIN }}>
            {salvando ? 'Enviando...' : 'Arquivar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ImoveisDocumentosPage: React.FC = () => {
  const location = useLocation();
  const abaDaRota = () => {
    const sub = location.pathname.replace(/\/+$/, '').split('/').pop();
    return sub === 'matriculas' || sub === 'escrituras' || sub === 'cessoes' ? sub : sub === 'locacao' ? 'locacao' : 'todos';
  };
  const [aba, setAba] = useState(abaDaRota());
  useEffect(() => { setAba(abaDaRota()); }, [location.pathname]);
  const tipoFiltro = aba === 'matriculas' ? 'MATRICULA' : aba === 'escrituras' ? 'ESCRITURA' : '';
  const tituloPagina = 'Imóveis';

  const [todas, setTodas] = useState<any[]>([]);
  const [locacoes, setLocacoes] = useState<any[]>([]);
  const [showImportLoc, setShowImportLoc] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ id: string; title: string } | null>(null);
  const [filtroSit, setFiltroSit] = useState('');
  const [ordem, setOrdem] = useState<{ key: string; dir: 1 | -1 }>({ key: 'imovel', dir: 1 });
  const [assetImport, setAssetImport] = useState<string | undefined>(undefined);
  const [tipoImport, setTipoImport] = useState('MATRICULA');

  const carregar = async () => {
    setLoading(true);
    const company = empresaAtiva();
    try {
      const v = await api.get('/documents/imoveis/vinculos', { params: { companyId: company.id } });
      setTodas(Array.isArray(v.data) ? v.data : []);
    } catch { setTodas([]); }
    try {
      const l = await api.get('/documents/imoveis/locacoes', { params: { companyId: company.id } });
      setLocacoes(Array.isArray(l.data) ? l.data : []);
    } catch { setLocacoes([]); }
    try {
      const a = await api.get('/assets');
      const lista = Array.isArray(a.data) ? a.data : (a.data?.data ?? a.data?.items ?? []);
      setImoveis(lista
        .filter((x: any) => !x.group || x.group === 'REAL_ESTATE')
        .sort((x: any, y: any) => String(x.internalCode).localeCompare(String(y.internalCode))));
    } catch { setImoveis([]); }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);
  const linhas = tipoFiltro ? todas.filter(l => l.tipo === tipoFiltro) : todas.filter(l => l.tipo !== 'CESSAO');
  const cessoes = todas.filter(l => l.tipo === 'CESSAO');
  const cessoesPorImovel = useMemo(() => {
    const m: Record<string, any[]> = {};
    cessoes.forEach(c => { (m[c.fixedAssetId] = m[c.fixedAssetId] ?? []).push(c); });
    return m;
  }, [todas]);
  // Contratos de cessao agrupados por documento (um contrato cobre varios imoveis)
  const contratosCessao = useMemo(() => {
    const m: Record<string, any> = {};
    cessoes.forEach(c => {
      const g = m[c.documentId] ?? (m[c.documentId] = { ...c, imoveis: [] as string[] });
      g.imoveis.push(c.internalCode);
    });
    return Object.values(m).sort((a: any, b: any) => String(b.dataCertidao ?? '').localeCompare(String(a.dataCertidao ?? '')));
  }, [todas]);
  const precisaCessao = (l: any) => l.tipo === 'MATRICULA' && CEDE[l.situacao] && !(cessoesPorImovel[l.fixedAssetId]?.length);
  const semCessao = todas.filter(precisaCessao).length;
  const abrirImport = (tipo: string, asset?: string) => { setTipoImport(tipo); setAssetImport(asset); setShowImport(true); };

  const mudarSituacao = async (l: any, situacao: string) => {
    try {
      await api.patch(`/documents/imoveis/vinculos/${l.id}`, { companyId: empresaAtiva().id, situacao });
      carregar();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao alterar a situação'); }
  };

  const alertas = linhas.filter(l => SITUACOES[l.situacao]?.alerta).length;
  const semMatricula = useMemo(
    () => imoveis.filter(i => !todas.some(l => l.fixedAssetId === i.id && l.tipo === 'MATRICULA')),
    [imoveis, todas]);
  const abaBtn = (key: string, label: string, n: number) => (
    <button key={key} onClick={() => setAba(key)}
      className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${aba === key ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`}
      style={aba === key ? { background: FIN } : undefined}>
      {label} <span className={aba === key ? 'text-white/70' : 'text-gray-400'}>{n}</span>
    </button>
  );

  const th = 'px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200';

  // Filtro de situacao. "Sem matricula" junta os documentos marcados assim e os imoveis sem matricula arquivada.
  const semMatriculaLinhas = semMatricula.map(i => ({
    id: 'asset-' + i.id, semDoc: true, fixedAssetId: i.id, internalCode: i.internalCode, assetDescription: i.description,
    tipo: '', numeroMatricula: i.registryNumber ?? '', cartorio: i.registryOffice ?? '', dataCertidao: null,
    proprietarioRegistral: '', ultimoAto: '', observacao: '', situacao: 'SEM_MATRICULA',
  }));
  const filtradas = (() => {
    if (filtroSit === 'ALERTAS') return linhas.filter(l => SITUACOES[l.situacao]?.alerta);
    if (filtroSit === 'SEM_CESSAO') return linhas.filter(precisaCessao);
    if (filtroSit === 'SEM_MATRICULA') return [...linhas.filter(l => l.situacao === 'SEM_MATRICULA'), ...(aba === 'escrituras' ? [] : semMatriculaLinhas)];
    if (filtroSit) return linhas.filter(l => l.situacao === filtroSit);
    return linhas;
  })();
  const valorOrdem = (l: any): string => {
    switch (ordem.key) {
      case 'tipo': return TIPO_LABEL[l.tipo] ?? '';
      case 'matricula': return String(l.numeroMatricula ?? '');
      case 'data': return String(l.dataCertidao ?? '');
      case 'proprietario': return String(l.proprietarioRegistral ?? '');
      case 'situacao': return l.semDoc ? 'zz' : (SITUACOES[l.situacao]?.label ?? '');
      default: return String(l.internalCode ?? '');
    }
  };
  const visiveis = [...filtradas].sort((a, b) =>
    ordem.dir * valorOrdem(a).localeCompare(valorOrdem(b), 'pt-BR', { numeric: true, sensitivity: 'base' })
    || String(a.internalCode).localeCompare(String(b.internalCode), 'pt-BR', { numeric: true }));
  const thOrd = (key: string, label: string) => (
    <th className={th} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => setOrdem(o => ({ key, dir: o.key === key ? (o.dir === 1 ? -1 : 1) : 1 }))}>
      {label}{' '}
      {ordem.key === key
        ? (ordem.dir === 1 ? <FiChevronUp size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <FiChevronDown size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />)
        : <span style={{ color: '#D1D5DB' }}>↕</span>}
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[22px] font-medium text-gray-900 flex items-center gap-2"><FiHome size={20} /> {tituloPagina}</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {todas.length + locacoes.length} documento{todas.length + locacoes.length !== 1 ? 's' : ''}
            {alertas > 0 && <span className="text-orange-700"> · {alertas} com alerta de situação registral</span>}
            {semCessao > 0 && <span className="text-red-700"> · {semCessao} sem contrato de cessão</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[12px] text-gray-600 flex items-center gap-1.5 cursor-pointer">
            Situação
            <select value={filtroSit} onChange={e => setFiltroSit(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 bg-white">
              <option value="">Todas</option>
              <option value="ALERTAS">Só alertas</option>
              <option value="SEM_CESSAO">Sem contrato de cessão (sócio/Grupo/terceiro)</option>
              {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{k === 'SEM_MATRICULA' ? 'Sem matrícula (inclui imóveis sem matrícula arquivada)' : v.label}</option>)}
            </select>
          </label>
          <button onClick={() => aba === 'locacao' ? setShowImportLoc(true) : abrirImport(aba === 'cessoes' ? 'CESSAO' : aba === 'escrituras' ? 'ESCRITURA' : 'MATRICULA')} className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-[13px]" style={{ background: FIN }}>
            <FiUpload size={13} /> Arquivar {aba === 'locacao' ? 'contrato de locação' : aba === 'cessoes' ? 'contrato de cessão' : aba === 'escrituras' ? 'escritura' : 'matrícula'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {abaBtn('todos', 'Matrículas e escrituras', todas.filter(l => l.tipo !== 'CESSAO').length)}
        {abaBtn('matriculas', 'Matrículas', todas.filter(l => l.tipo === 'MATRICULA').length)}
        {abaBtn('escrituras', 'Escrituras', todas.filter(l => l.tipo === 'ESCRITURA').length)}
        {abaBtn('cessoes', 'Contratos de cessão', contratosCessao.length)}
        {abaBtn('locacao', 'Contratos de locação', locacoes.length)}
      </div>

      {aba === 'cessoes' ? (
      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Contrato</th>
              <th className={th}>Cedente</th>
              <th className={th}>Imóveis</th>
              <th className={th}>Data</th>
              <th className={th}>Objeto / observação</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : contratosCessao.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-[14px]">Nenhum contrato de cessão arquivado</td></tr>
            ) : contratosCessao.map((c: any) => (
              <tr key={c.documentId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 align-top">
                <td className="px-3 py-2.5">
                  <button onClick={() => setViewDoc({ id: c.documentId, title: c.title })} className="text-[13px] text-gray-900 hover:text-blue-600 hover:underline text-left">{c.title}</button>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{c.proprietarioRegistral || '-'}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{c.imoveis.join(', ')}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{fmtData(c.dataCertidao)}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-500 max-w-[300px]">
                  {c.ultimoAto && <p>{c.ultimoAto}</p>}
                  {c.observacao && <p className="text-[11px] text-orange-700">{c.observacao}</p>}
                </td>
                <td className="px-3 py-2.5">
                  <button title="Visualizar" onClick={() => setViewDoc({ id: c.documentId, title: c.title })}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : aba === 'locacao' ? (
      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Imóvel</th>
              <th className={th}>Contrato</th>
              <th className={th}>Locatário</th>
              <th className={th}>Vigência</th>
              <th className={th}>Situação</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : locacoes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-[14px]">Nenhum contrato de locação arquivado</td></tr>
            ) : locacoes.map(l => (
              <tr key={l.documentId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 align-top">
                <td className="px-3 py-2.5 text-[13px] font-medium text-gray-900">{l.internalCode || <span className="text-gray-400 font-normal">sem vínculo</span>}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => setViewDoc({ id: l.documentId, title: l.title })} className="text-[13px] text-gray-900 hover:text-blue-600 hover:underline text-left">{l.title}</button>
                  {l.contractNumber && <p className="text-[11px] text-gray-400">nº {l.contractNumber}</p>}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{l.tenantName || '-'}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-700">{l.startDate ? fmtData(l.startDate) + ' a ' + (l.endDate ? fmtData(l.endDate) : 'indeterminado') : '-'}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{l.contractStatus ? l.contractStatus.charAt(0) + l.contractStatus.slice(1).toLowerCase() : '-'}</td>
                <td className="px-3 py-2.5">
                  <button title="Visualizar" onClick={() => setViewDoc({ id: l.documentId, title: l.title })}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
      <>

      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              {thOrd('imovel', 'Imóvel')}
              {thOrd('tipo', 'Tipo')}
              {thOrd('matricula', 'Matrícula / RI')}
              {thOrd('data', 'Data')}
              {thOrd('proprietario', 'Proprietário registral / último ato')}
              {thOrd('situacao', 'Situação')}
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-[14px]">Nenhum documento {filtroSit ? 'com esta situação' : 'arquivado'}</td></tr>
            ) : visiveis.map(l => {
              const sit = SITUACOES[l.situacao] ?? SITUACOES.EMPRESA;
              if (l.semDoc) return (
                <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 align-top">
                  <td className="px-3 py-2.5">
                    <p className="text-[13px] font-medium text-gray-900">{l.internalCode}</p>
                    <p className="text-[11px] text-gray-400 max-w-[220px] truncate" title={l.assetDescription}>{l.assetDescription}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-400">-</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-500">{l.numeroMatricula || '-'}{l.cartorio ? <span className="text-gray-400"> · {l.cartorio}</span> : null}<p className="text-[10px] text-gray-400">no cadastro</p></td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-400">-</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-500">Nenhuma matrícula arquivada</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sit.cor}`}><FiAlertTriangle size={11} /> Sem matrícula arquivada</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button title="Arquivar matrícula deste imóvel" onClick={() => abrirImport('MATRICULA', l.fixedAssetId)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiUpload size={14} /></button>
                  </td>
                </tr>
              );
              return (
                <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 align-top">
                  <td className="px-3 py-2.5">
                    <p className="text-[13px] font-medium text-gray-900">{l.internalCode}</p>
                    <p className="text-[11px] text-gray-400 max-w-[220px] truncate" title={l.assetDescription}>{l.assetDescription}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-600">{TIPO_LABEL[l.tipo] ?? l.tipo}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{l.numeroMatricula || '-'}{l.cartorio ? <span className="text-gray-400"> · {l.cartorio}</span> : null}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{fmtData(l.dataCertidao)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[300px]">
                    <p>{l.proprietarioRegistral || '-'}</p>
                    {l.ultimoAto && <p className="text-[11px] text-gray-400">{l.ultimoAto}</p>}
                    {l.observacao && <p className="text-[11px] text-orange-700 mt-0.5">{l.observacao}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sit.cor}`}>
                      {sit.alerta ? <FiAlertTriangle size={11} /> : <FiCheckCircle size={11} />} {sit.label}
                    </span>
                    <select className="block mt-1 text-[11px] border border-gray-200 rounded px-1 py-0.5 text-gray-500" value={l.situacao}
                      onChange={e => mudarSituacao(l, e.target.value)}>
                      {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {l.tipo === 'MATRICULA' && CEDE[l.situacao] && (
                      (cessoesPorImovel[l.fixedAssetId]?.length ?? 0) > 0 ? (
                        <p className="text-[11px] text-green-700 mt-1 flex items-center gap-1">
                          <FiCheckCircle size={11} />
                          <button className="hover:underline text-left" onClick={() => { const c = cessoesPorImovel[l.fixedAssetId][0]; setViewDoc({ id: c.documentId, title: c.title }); }}>
                            Cessão: {cessoesPorImovel[l.fixedAssetId][0].proprietarioRegistral || cessoesPorImovel[l.fixedAssetId][0].title}{cessoesPorImovel[l.fixedAssetId][0].dataCertidao ? ' (' + fmtData(cessoesPorImovel[l.fixedAssetId][0].dataCertidao) + ')' : ''}
                          </button>
                        </p>
                      ) : (
                        <p className="text-[11px] text-red-700 mt-1 flex items-center gap-1">
                          <FiAlertTriangle size={11} /> Sem contrato de cessão
                          <button className="underline ml-1" onClick={() => abrirImport('CESSAO', l.fixedAssetId)}>arquivar</button>
                        </p>
                      )
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button title="Visualizar" onClick={() => setViewDoc({ id: l.documentId, title: l.title })}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aba !== 'escrituras' && !loading && semMatricula.length > 0 && filtroSit !== 'SEM_MATRICULA' && (
        <div className="rounded-[10px] px-4 py-3 text-[12px]" style={{ background: FIN_LIGHT }}>
          <p className="font-medium mb-1" style={{ color: FIN }}>Imóveis sem matrícula arquivada ({semMatricula.length}) <button onClick={() => setFiltroSit('SEM_MATRICULA')} className="text-[11px] underline ml-2" style={{ color: FIN }}>ver na tabela</button></p>
          <p className="text-gray-600">{semMatricula.map(i => i.internalCode + (i.registryNumber ? ' (' + i.registryNumber + ')' : '')).join(' · ')}</p>
        </div>
      )}
      </>
      )}

      {showImportLoc && (
        <ImportarDocumentoModal defaultType="CONTRATO_LOCACAO" onClose={() => setShowImportLoc(false)} onSuccess={() => carregar()} />
      )}

      {showImport && (
        <ImportarImovelDocModal tipoInicial={tipoImport} imoveis={imoveis} assetInicial={assetImport}
          onClose={() => { setShowImport(false); setAssetImport(undefined); }} onSaved={() => { setShowImport(false); setAssetImport(undefined); carregar(); }} />
      )}
      {viewDoc !== null && (
        <DocumentViewModal documentId={viewDoc.id} documentTitle={viewDoc.title}
          onClose={() => setViewDoc(null)} onValidate={() => setViewDoc(null)} />
      )}
    </div>
  );
};
