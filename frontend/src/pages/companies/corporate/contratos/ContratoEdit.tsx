// src/pages/companies/corporate/contratos/ContratoEdit.tsx
//
// Usado para CONTRATO_SOCIAL e ADITIVO_CONTRATUAL.
// O tipo vem de ?type=CONTRATO_SOCIAL | ADITIVO_CONTRATUAL (novo)
// ou é lido do documento existente (edição).
//
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiPlus, FiTrash2, FiSearch, FiUser, FiSave,
  FiEye, FiFileText, FiAlertCircle, FiCheckCircle,
  FiAlignCenter, FiAlignLeft, FiColumns,
} from 'react-icons/fi';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentStylePicker, DOC_STYLES, RenderDocument } from '@/components/DocumentStylePicker';
import api from '@/services/api';

// ── Tipos ─────────────────────────────────────────────────────
type DocType = 'CONTRATO_SOCIAL' | 'ADITIVO_CONTRATUAL';

interface CompanyData {
  legalName: string;
  tradeName: string;
  taxId: string;
  // campos de registro institucional
  registerOrg?: string;   // JUCESP | Cartório | OAB/SP | etc.
  registerNumber?: string;   // NIRE ou nº do registro
  registerDate?: string;   // ISO date
  registerBook?: string;   // Livro (cartório)
  registerSheet?: string;   // Folha (cartório)
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  capital?: string;
  objeto?: string;
  tipo?: string;
}

interface Socio {
  id: string;
  personId?: string;
  cpf: string;
  nome: string;
  qualificacao: string; // texto livre de qualificação (gerado do cadastro ou digitado)
  participacao: string; // ex: "50% — R$ 50.000,00"
  cargo?: string;       // Diretor, Administrador etc.
}

interface FormData {
  type: DocType;
  title: string;
  date: string;
  cidade: string;
  status: string;
  bookNumber: string;
  changeNote: string;
  styleId: string;
  numerarSecoes: boolean;
  // Dados do contrato
  objetoSocial: string;
  capitalSocial: string;
  prazo: string;         // ex: "indeterminado"
  sede: string;
  administracao: string; // texto sobre administração
  socios: Socio[];
  // Para alteração
  clausulasAlteradas: string; // texto livre das cláusulas alteradas (inclui preâmbulo)
  motivoAlteracao: string;
}

const EMPTY: FormData = {
  type: 'CONTRATO_SOCIAL',
  title: '',
  date: '',
  cidade: 'São Paulo',
  status: 'RASCUNHO',
  bookNumber: '',
  changeNote: '',
  styleId: 'minimalista',
  numerarSecoes: true,
  objetoSocial: '',
  capitalSocial: '',
  prazo: 'indeterminado',
  sede: '',
  administracao: '',
  socios: [],
  clausulasAlteradas: '',
  motivoAlteracao: '',
};

const STATUS_OPTIONS = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'EM_REVISAO', label: 'Em Revisão' },
  { value: 'AGUARDANDO_ASSINATURA', label: 'Aguardando Assinatura' },
  { value: 'ASSINADO', label: 'Assinado' },
  { value: 'REGISTRADO', label: 'Registrado na Junta' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

// ── Helpers ───────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

const fmtCpf = (v: string) =>
  v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);

function formatarData(dateStr: string): string {
  if (!dateStr) return '_____ de __________ de ______';
  const [y, m, d] = dateStr.split('-');
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

// ── Gerador de texto ──────────────────────────────────────────
function gerarTexto(form: FormData, companyName: string): string {
  const L: string[] = [];
  const n = form.numerarSecoes;
  let seq = 0;
  const s = (texto: string) => n ? `${++seq}. ${texto}` : texto;

  if (form.type === 'CONTRATO_SOCIAL') {
    // Preâmbulo
    L.push(s(`PARTES:`));
    if (form.socios.length > 0) {
      form.socios.forEach((socio, idx) => {
        L.push(`    ${idx + 1}. ${socio.nome.toUpperCase()}, ${socio.qualificacao || '[qualificação]'};`);
      });
    } else {
      L.push('    [Qualificar os sócios]');
    }
    L.push('');

    L.push(s(`OBJETO SOCIAL: ${form.objetoSocial || '[Descrever o objeto social]'}.`));
    L.push('');

    L.push(s(`DENOMINAÇÃO E SEDE: ${companyName}, com sede em ${form.sede || '[endereço completo]'}.`));
    L.push('');

    L.push(s(`PRAZO DE DURAÇÃO: ${form.prazo || 'indeterminado'}.`));
    L.push('');

    const totalSocios = form.socios.length;
    if (totalSocios > 0) {
      const participacoes = form.socios
        .map(sc => `${sc.nome}: ${sc.participacao || '[participação]'}`)
        .join('; ');
      L.push(s(`CAPITAL SOCIAL: ${form.capitalSocial || '[valor]'}, dividido entre os sócios da seguinte forma: ${participacoes}.`));
    } else {
      L.push(s(`CAPITAL SOCIAL: ${form.capitalSocial || '[valor total]'}.`));
    }
    L.push('');

    L.push(s(`ADMINISTRAÇÃO: ${form.administracao || '[Descrever forma de administração, poderes dos administradores e vedações]'}.`));
    L.push('');

    L.push(s(`DELIBERAÇÕES SOCIAIS: As deliberações serão tomadas em reunião de sócios, ` +
      `observado o quórum previsto na Lei nº 10.406/2002 (Código Civil).`));
    L.push('');

    L.push(s(`RETIRADA E EXCLUSÃO DE SÓCIO: Observadas as disposições do Código Civil.`));
    L.push('');

    L.push(s(`DISSOLUÇÃO E LIQUIDAÇÃO: A sociedade dissolver-se-á nos casos previstos em lei.`));
    L.push('');

    L.push(s(`FORO: Fica eleito o foro da Comarca de ${form.cidade || 'São Paulo'} para dirimir eventuais litígios.`));
    L.push('');

    L.push(`-> ${form.cidade || 'São Paulo'}, ${formatarData(form.date)}. <-`);
    L.push('');

    // Assinaturas
    if (form.socios.length > 0) {
      const nomes = form.socios.map(sc => sc.nome);
      if (nomes.length <= 3) {
        L.push(`-> ${nomes.join(' | ')} <-`);
      } else {
        // 2 por linha
        for (let i = 0; i < nomes.length; i += 2) {
          const par = nomes.slice(i, i + 2);
          L.push(`||4> ${par.join(' | ')} <4||`);
        }
      }
    }

  } else {
    // ADITIVO_CONTRATUAL — Alteração de Contrato Social
    // O textarea clausulasAlteradas contém o texto completo: preâmbulo + cláusulas
    if (form.clausulasAlteradas.trim()) {
      form.clausulasAlteradas.split('\n').forEach(l => L.push(l));
      L.push('');
    } else {
      L.push('[Texto da alteração contratual]');
      L.push('');
    }

    L.push(s(`RATIFICAÇÃO: Ficam ratificadas todas as demais cláusulas e condições do Contrato Social não alteradas pelo presente instrumento.`));
    L.push('');

    L.push(`-> ${form.cidade || 'São Paulo'}, ${formatarData(form.date)}. <-`);
    L.push('');

    if (form.socios.length > 0) {
      const nomes = form.socios.map(sc => sc.nome);
      if (nomes.length <= 3) {
        L.push(`-> ${nomes.join(' | ')} <-`);
      } else {
        for (let i = 0; i < nomes.length; i += 2) {
          const par = nomes.slice(i, i + 2);
          L.push(`||4> ${par.join(' | ')} <4||`);
        }
      }
    }
  }

  return L.join('\n');
}

// ── Busca de pessoa por CPF ───────────────────────────────────
interface CpfLookupProps {
  idx: number;
  socio: Socio;
  onChange: (idx: number, updates: Partial<Socio>) => void;
  onRemove: (idx: number) => void;
}

const CpfLookup: React.FC<CpfLookupProps> = ({ idx, socio, onChange, onRemove }) => {
  const [buscando, setBuscando] = useState(false);
  const [found, setFound] = useState<boolean | null>(null);

  const buscar = useCallback(async () => {
    const cpfLimpo = socio.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return;
    setBuscando(true);
    setFound(null);
    try {
      const r = await api.get(`/persons/cpf/${cpfLimpo}`);
      const p = r.data;
      // Monta qualificação automática da pessoa física
      const parts: string[] = [];
      if (p.nationality) parts.push(p.nationality);
      if (p.maritalStatus) parts.push(p.maritalStatus.toLowerCase());
      // registro profissional principal
      const regsJson = p.otherRegistrations;
      if (p.oabNumber) parts.push(`advogado, inscrito na OAB/${p.oabState} sob nº ${p.oabNumber}`);
      if (p.crcNumber) parts.push(`contador, inscrito no CRC/${p.crcState} sob nº ${p.crcNumber}`);
      // endereço
      if (p.street && p.city) {
        parts.push(`residente e domiciliado em ${p.street}, ${p.number}${p.complement ? ` ${p.complement}` : ''}, ${p.neighborhood}, ${p.city}/${p.state}`);
      }
      parts.push(`CPF: ${p.cpf}`);
      if (p.rgNumber) parts.push(`RG: ${p.rgNumber}${p.rgIssuer ? `/${p.rgIssuer}` : ''}`);

      onChange(idx, {
        personId: p.id,
        nome: p.fullName,
        qualificacao: parts.join(', '),
      });
      setFound(true);
    } catch {
      setFound(false);
    } finally {
      setBuscando(false);
    }
  }, [socio.cpf, idx, onChange]);

  const inputCls2 = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Sócio {idx + 1}
        </span>
        <button onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
          <FiTrash2 size={14} />
        </button>
      </div>

      {/* CPF + busca */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">CPF</label>
          <input
            type="text"
            value={socio.cpf}
            onChange={e => { onChange(idx, { cpf: fmtCpf(e.target.value) }); setFound(null); }}
            onBlur={buscar}
            placeholder="000.000.000-00"
            maxLength={14}
            className={inputCls2 + ' w-40 font-mono'}
          />
        </div>
        <div className="flex items-end pb-0.5">
          <button
            onClick={buscar}
            disabled={buscando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-semibold"
          >
            {buscando ? <FiSearch size={13} className="animate-spin" /> : <FiSearch size={13} />}
            Buscar
          </button>
        </div>
        {found === true && <div className="flex items-end pb-1.5"><FiCheckCircle size={16} className="text-green-500" /></div>}
        {found === false && <div className="flex items-end pb-1.5"><FiAlertCircle size={16} className="text-amber-500" title="CPF não encontrado no cadastro" /></div>}
      </div>

      {/* Nome */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nome Completo</label>
        <input
          type="text"
          value={socio.nome}
          onChange={e => onChange(idx, { nome: e.target.value })}
          placeholder="Nome conforme documentos"
          className={inputCls2 + ' w-full'}
        />
      </div>

      {/* Qualificação */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Qualificação completa
          {found === true && <span className="ml-1.5 text-green-500 font-normal">— preenchida do cadastro</span>}
        </label>
        <textarea
          value={socio.qualificacao}
          onChange={e => onChange(idx, { qualificacao: e.target.value })}
          placeholder="Nacionalidade, estado civil, profissão, endereço, CPF, RG…"
          rows={2}
          className={inputCls2 + ' w-full resize-none'}
        />
      </div>

      {/* Participação + Cargo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Participação / Cotas</label>
          <input
            type="text"
            value={socio.participacao}
            onChange={e => onChange(idx, { participacao: e.target.value })}
            placeholder="50% — R$ 50.000,00"
            className={inputCls2 + ' w-full'}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cargo / Função</label>
          <input
            type="text"
            value={socio.cargo ?? ''}
            onChange={e => onChange(idx, { cargo: e.target.value })}
            placeholder="Administrador, Diretor…"
            className={inputCls2 + ' w-full'}
          />
        </div>
      </div>
    </div>
  );
};

// Monta string de registro para o cabeçalho dos documentos
function buildRegisterInfo(company: CompanyData): string {
  const org = company.registerOrg ?? '';
  const num = company.registerNumber ?? '';
  if (!org && !num) return '';
  const org_l = org.toLowerCase();
  if (org_l.includes('jucesp')) return `NIRE: ${num}`;
  if (org_l.includes('cartório') || org_l.includes('cartorio')) {
    const livro = company.registerBook ? ` · Livro ${company.registerBook}` : '';
    const folha = company.registerSheet ? ` · Folha ${company.registerSheet}` : '';
    return `${org}${num ? ` nº ${num}` : ''}${livro}${folha}`;
  }
  return `${org}${num ? ` nº ${num}` : ''}`;
}

// ── Gerador de preâmbulo JUCESP ───────────────────────────────
function gerarPreambulo(company: CompanyData, socios: Socio[]): string {
  const fmtCnpj = (v: string) =>
    v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

  const fmtDate = (iso?: string) => {
    if (!iso) return '__ de __________ de ______';
    const d = new Date(iso);
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  };

  const cnpjFmt = fmtCnpj(company.taxId ?? '');
  const org = company.registerOrg ?? '';
  const num = company.registerNumber ?? '';
  const date = fmtDate(company.registerDate);

  // Monta trecho de registro conforme o órgão
  let registroTrecho = '';
  if (!org) {
    registroTrecho = '[registrada na JUCESP/Cartório sob nº ______, em __ de __________ de ______]';
  } else if (org.toLowerCase().includes('cartório') || org.toLowerCase().includes('cartorio')) {
    const livro = company.registerBook ? `, Livro ${company.registerBook}` : '';
    const folha = company.registerSheet ? `, Folha ${company.registerSheet}` : '';
    registroTrecho = `registrada no ${org}${num ? ` sob o nº ${num}` : ''}${livro}${folha}, em ${date}`;
  } else if (org.toLowerCase().includes('jucesp')) {
    registroTrecho = `registrada na JUCESP sob o NIRE ${num || '______'}, em ${date}`;
  } else {
    // OAB ou outro órgão
    registroTrecho = `registrada na ${org}${num ? ` sob o nº ${num}` : ''}, em ${date}`;
  }

  // Qualificação dos sócios — sem o título "PARTES"
  let qualificacoes = '';
  if (socios.length > 0) {
    qualificacoes = socios.map(s =>
      `${s.nome.toUpperCase()}, ${s.qualificacao || '[qualificação completa]'};`
    ).join('\n\n') + '\n\n';
  } else {
    qualificacoes = '[Qualificação completa dos sócios]\n\n';
  }

  const empresa = company.legalName || '[Razão Social]';

  return qualificacoes +
    `Únicos sócios da empresa ${empresa}, CNPJ nº ${cnpjFmt}, ${registroTrecho}, ` +
    `resolvem alterar o Contrato Social da empresa conforme as seguintes cláusulas:`;
}

// ── Toolbar de formatação ─────────────────────────────────────
interface FormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
}

const FormatToolbar: React.FC<FormatToolbarProps> = ({ textareaRef, value, onChange }) => {
  const insertAt = (before: string, placeholder: string, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end) || placeholder;
    const novo = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(novo);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + sel.length);
    }, 0);
  };

  const BtnFmt = ({ title, onClick, children }: {
    title: string; onClick: () => void; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors border border-transparent hover:border-blue-100"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border border-b-0 border-gray-200 rounded-t-lg">
      <BtnFmt title="Centralizar linha" onClick={() => insertAt('-> ', 'texto centralizado', ' <-')}>
        <FiAlignCenter size={12} /> <span>Centro</span>
      </BtnFmt>
      <BtnFmt title="Recuo de parágrafo" onClick={() => insertAt('    ', 'texto com recuo')}>
        <FiAlignLeft size={12} /> <span>Recuo</span>
      </BtnFmt>
      <span className="text-gray-200 mx-1">|</span>
      <BtnFmt title="2 colunas" onClick={() => insertAt('|| ', 'coluna 1 | coluna 2', ' ||')}>
        <FiColumns size={12} /> <span>2 col</span>
      </BtnFmt>
      <BtnFmt title="2 colunas com recuo" onClick={() => insertAt('||3> ', 'col 1 | col 2', ' <3||')}>
        <FiColumns size={12} /> <span>2 col + recuo</span>
      </BtnFmt>
      <span className="text-gray-200 mx-1">|</span>
      <span className="text-[10px] text-gray-300 hidden sm:block">
        <code className="bg-white px-1 rounded border border-gray-100">-{'>'} texto {'<'}-</code> centraliza &nbsp;·&nbsp;
        <code className="bg-white px-1 rounded border border-gray-100">|| col1 | col2 ||</code> colunas
      </span>
    </div>
  );
};

// ── Section helper ────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </div>
);

// ── Componente principal ──────────────────────────────────────
export const ContratoEdit: React.FC = () => {
  const { companyId, docId } = useParams<{ companyId: string; docId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const { usuario } = useAuth();

  const isEditing = !!docId;
  const typeParam = (searchParams.get('type') ?? 'CONTRATO_SOCIAL') as DocType;

  const [form, setForm] = useState<FormData>({ ...EMPTY, type: typeParam });
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  const clausulasRef = useRef<HTMLTextAreaElement>(null);

  const companyName = activeCompany?.legalName ?? activeCompany?.tradeName ?? '';
  const cnpj = activeCompany?.taxId ?? '';

  const activeStyle = DOC_STYLES.find(s => s.id === form.styleId) ?? DOC_STYLES[0];
  const textoGerado = gerarTexto(form, companyName);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Busca dados completos da empresa para o preâmbulo
  useEffect(() => {
    const id = companyId ?? activeCompany?.id;
    if (!id) return;
    api.get(`/companies/${id}`)
      .then(r => {
        const d = r.data;
        const cd: CompanyData = {
          legalName: d.legalName ?? d.razao_social ?? '',
          tradeName: d.tradeName ?? d.nome_fantasia ?? '',
          taxId: d.taxId ?? d.cnpj ?? '',
          registerOrg: d.registerOrg ?? '',
          registerNumber: d.registerNumber ?? d.nire ?? '',
          registerDate: d.registerDate ?? undefined,
          registerBook: d.registerBook ?? '',
          registerSheet: d.registerSheet ?? '',
          street: d.street ?? d.logradouro ?? '',
          number: d.number ?? d.numero ?? '',
          complement: d.complement ?? d.complemento ?? '',
          neighborhood: d.neighborhood ?? d.bairro ?? '',
          city: d.city ?? d.municipio ?? '',
          state: d.state ?? d.uf ?? '',
          zipCode: d.zipCode ?? d.cep ?? '',
          capital: d.capitalSocial ?? '',
          objeto: d.objetoSocial ?? '',
          tipo: d.tipo ?? '',
        };
        setCompanyData(cd);
      })
      .catch(() => { }); // silencioso — dados opcionais
  }, [companyId, activeCompany?.id]);

  // Descarrega preâmbulo + placeholder no clausulasAlteradas ao carregar dados da empresa (doc novo)
  useEffect(() => {
    if (form.type !== 'ADITIVO_CONTRATUAL') return;
    if (!companyData) return;
    if (isEditing) return;
    const preambulo = gerarPreambulo(companyData, form.socios);
    setForm(prev => ({
      ...prev,
      clausulasAlteradas: preambulo + '\n\n[Redigir as cláusulas alteradas aqui]',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyData, form.type]);

  // Carrega documento existente
  useEffect(() => {
    if (!isEditing || !docId) return;
    api.get(`/contratos/${docId}`)
      .then(r => {
        const data = r.data;
        const extra = (() => { try { return JSON.parse(data.notes ?? '{}'); } catch { return {}; } })();
        setForm({
          type: data.type,
          title: data.title ?? '',
          date: data.date ? data.date.slice(0, 10) : '',
          cidade: extra.cidade ?? 'São Paulo',
          status: data.status ?? 'RASCUNHO',
          bookNumber: String(data.bookNumber ?? ''),
          changeNote: '',
          styleId: data.description ?? 'minimalista',
          numerarSecoes: extra.numerarSecoes ?? true,
          objetoSocial: extra.objetoSocial ?? '',
          capitalSocial: extra.capitalSocial ?? '',
          prazo: extra.prazo ?? 'indeterminado',
          sede: extra.sede ?? '',
          administracao: extra.administracao ?? '',
          socios: extra.socios ?? [],
          clausulasAlteradas: extra.clausulasAlteradas ?? '',
          motivoAlteracao: extra.motivoAlteracao ?? '',
        });
      })
      .catch(() => alert('Erro ao carregar documento.'))
      .finally(() => setLoading(false));
  }, [docId, isEditing]);

  // Handlers sócios
  const addSocio = () => setForm(prev => ({
    ...prev,
    socios: [...prev.socios, { id: crypto.randomUUID(), cpf: '', nome: '', qualificacao: '', participacao: '', cargo: '' }],
  }));
  const setSocio = (idx: number, updates: Partial<Socio>) =>
    setForm(prev => {
      const s = [...prev.socios];
      s[idx] = { ...s[idx], ...updates };
      return { ...prev, socios: s };
    });
  const removeSocio = (idx: number) =>
    setForm(prev => ({ ...prev, socios: prev.socios.filter((_, i) => i !== idx) }));

  // Salvar
  const salvar = async () => {
    if (!form.title.trim()) { alert('Título obrigatório.'); return; }
    setSaving(true);
    try {
      const notesJson = JSON.stringify({
        cidade: form.cidade, numerarSecoes: form.numerarSecoes,
        objetoSocial: form.objetoSocial, capitalSocial: form.capitalSocial,
        prazo: form.prazo, sede: form.sede, administracao: form.administracao,
        socios: form.socios,
        clausulasAlteradas: form.clausulasAlteradas, motivoAlteracao: form.motivoAlteracao,
      });
      const payload = {
        companyId, type: form.type, title: form.title,
        date: form.date || undefined, content: textoGerado, status: form.status,
        bookNumber: form.bookNumber ? Number(form.bookNumber) : undefined,
        notes: notesJson, changeNote: form.changeNote || undefined,
        description: form.styleId,
      };
      if (isEditing) await api.patch(`/contratos/${docId}`, payload);
      else await api.post('/contratos', payload);
      navigate(`/app/companies/corporate/contratos/${companyId}`);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Carregando…</div>;

  const isContrato = form.type === 'CONTRATO_SOCIAL';
  const pageTitle = isEditing
    ? `Editar ${isContrato ? 'Contrato Social' : 'Alteração Contratual'}`
    : `Nova ${isContrato ? 'Contrato Social' : 'Alteração Contratual'}`;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-xs text-gray-400">{companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors
              ${showPreview ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            <FiEye size={13} /> {showPreview ? 'Ocultar prévia' : 'Ver prévia'}
          </button>
          <button
            onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}`)}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            <FiSave size={13} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 flex gap-6 items-start">
        <div className={`space-y-5 min-w-0 ${showPreview ? 'w-1/2' : 'w-full'}`}>

          {/* 1. Identificação */}
          <Section title="Identificação">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder={isContrato ? 'Ex: Contrato Social — Arena Adm Ltda' : 'Ex: 1ª Alteração — Transformação em S.A.'}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls + ' bg-white'}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cidade</label>
                <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)}
                  placeholder="São Paulo" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sede (endereço completo)</label>
                <input type="text" value={form.sede} onChange={e => set('sede', e.target.value)}
                  placeholder="Rua X, nº Y, Bairro, Cidade/UF" className={inputCls} />
              </div>
            </div>
            {/* Checkbox numeração */}
            <div className="pt-3 border-t border-gray-100 flex items-center gap-2.5">
              <input type="checkbox" id="numerarSecoes" checked={form.numerarSecoes}
                onChange={e => set('numerarSecoes', e.target.checked)}
                className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0" />
              <label htmlFor="numerarSecoes" className="text-sm text-gray-700 cursor-pointer select-none">
                Numerar cláusulas
                <span className="ml-1.5 text-xs text-gray-400">1. PARTES · 2. OBJETO SOCIAL · …</span>
              </label>
            </div>
          </Section>

          {/* 2. Sócios */}
          <Section title={`Sócios${form.socios.length > 0 ? ` (${form.socios.length})` : ''}`}>
            <p className="text-xs text-gray-400 -mt-2">
              Busque pelo CPF para preencher a qualificação automaticamente do cadastro de Pessoas Físicas.
            </p>
            <div className="space-y-3">
              {form.socios.map((s, idx) => (
                <CpfLookup key={s.id} idx={idx} socio={s} onChange={setSocio} onRemove={removeSocio} />
              ))}
            </div>
            <button onClick={addSocio}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors mt-1">
              <FiPlus size={13} /> <FiUser size={13} /> Adicionar sócio
            </button>
          </Section>

          {/* 3. Dados do Contrato Social */}
          {isContrato && (
            <>
              <Section title="Dados Constitutivos">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Objeto Social</label>
                  <textarea
                    value={form.objetoSocial}
                    onChange={e => set('objetoSocial', e.target.value)}
                    placeholder="A sociedade tem por objeto: …"
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Capital Social</label>
                    <input type="text" value={form.capitalSocial}
                      onChange={e => set('capitalSocial', e.target.value)}
                      placeholder="R$ 100.000,00 (cem mil reais)" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Prazo de Duração</label>
                    <input type="text" value={form.prazo}
                      onChange={e => set('prazo', e.target.value)}
                      placeholder="indeterminado" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Administração</label>
                  <textarea
                    value={form.administracao}
                    onChange={e => set('administracao', e.target.value)}
                    placeholder="A sociedade será administrada por sócio(s) administrador(es), com poderes para…"
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>
              </Section>
            </>
          )}

          {/* 3b. Alteração Contratual */}
          {!isContrato && (
            <Section title="Alteração Contratual">
              <p className="text-xs text-gray-400 -mt-2">
                O preâmbulo é gerado automaticamente com os dados da empresa e descarregado abaixo.
                Edite o texto livremente — preâmbulo e cláusulas ficam num único campo.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo da Alteração</label>
                <input type="text" value={form.motivoAlteracao}
                  onChange={e => set('motivoAlteracao', e.target.value)}
                  placeholder="Ex: Transformação da sociedade limitada em S.A."
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Texto da Alteração
                  <span className="ml-1 font-normal text-gray-400">
                    — preâmbulo + cláusulas, totalmente editável
                  </span>
                </label>
                <FormatToolbar
                  textareaRef={clausulasRef}
                  value={form.clausulasAlteradas}
                  onChange={v => set('clausulasAlteradas', v)}
                />
                <textarea
                  ref={clausulasRef}
                  value={form.clausulasAlteradas}
                  onChange={e => set('clausulasAlteradas', e.target.value)}
                  placeholder="Aguardando dados da empresa para gerar o preâmbulo…"
                  rows={18}
                  className={inputCls + ' font-mono resize-y rounded-t-none border-t-0'}
                />
              </div>
            </Section>
          )}

          {/* 4. Estilo */}
          <DocumentStylePicker
            selectedStyleId={form.styleId}
            content={textoGerado}
            companyName={companyName}
            docTitle={form.title}
            onChange={(styleId) => set('styleId', styleId)}
          />

          {/* 5. Registro */}
          <Section title="Registro">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nº Livro / Registro</label>
                <input type="text" value={form.bookNumber} onChange={e => set('bookNumber', e.target.value)}
                  placeholder="Ex: NIRE 35300000000" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nota de Alteração</label>
                <input type="text" value={form.changeNote} onChange={e => set('changeNote', e.target.value)}
                  placeholder="Ex: Transformação de Ltda para S.A." className={inputCls} />
              </div>
            </div>
          </Section>

        </div>

        {/* Prévia */}
        {showPreview && (
          <div className="w-1/2 sticky top-20">
            <div className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2">
                <FiFileText size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Prévia — {activeStyle.name}
                </span>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                <RenderDocument
                  style={activeStyle}
                  content={textoGerado}
                  companyName={companyName}
                  docTitle={form.title}
                  cnpj={cnpj}
                  registerInfo={companyData ? buildRegisterInfo(companyData) : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};