// src/pages/persons/PersonForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FiArrowLeft, FiSave, FiPlus, FiTrash2, FiUser, FiUsers, FiBriefcase,
  FiMapPin, FiPhone, FiAward, FiLink, FiCreditCard,
} from 'react-icons/fi';
import api from '@/services/api';


// ── Constantes ────────────────────────────────────────────────
const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

const MARITAL_OPTIONS = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'UNIAO_ESTAVEL', label: 'União Estável' },
  { value: 'SEPARADO', label: 'Separado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
];

const REGIME_OPTIONS = [
  { value: 'COMUNHAO_PARCIAL', label: 'Comunhão Parcial de Bens' },
  { value: 'COMUNHAO_UNIVERSAL', label: 'Comunhão Universal de Bens' },
  { value: 'SEPARACAO_TOTAL', label: 'Separação Total de Bens' },
  { value: 'SEPARACAO_OBRIGATORIA', label: 'Separação Obrigatória' },
  { value: 'PARTICIPACAO_FINAL_AQUESTOS', label: 'Participação Final nos Aquestos' },
];

const GENDER_OPTIONS = [
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Feminino', label: 'Feminino' },
  { value: 'Outro', label: 'Outro' },
  { value: 'NaoInformado', label: 'Prefiro não informar' },
];

const DEPENDENTS_OPTIONS = [
  { value: 'FILHO', label: 'Filho(a)' },
  { value: 'ENTEADO', label: 'Enteado(a)' },
  { value: 'NETO', label: 'Neto(a)' },
  { value: 'CONJUGE', label: 'Cônjuge' },
  { value: 'PAI', label: 'Pai' },
  { value: 'MAE', label: 'Mãe' },
  { value: 'OUTRO', label: 'Outro' },
];

const ROLE_OPTIONS = [
  'DIRETOR_PRESIDENTE', 'DIRETOR_VICE_PRESIDENTE', 'DIRETOR_FINANCEIRO',
  'DIRETOR_OPERACIONAL', 'SECRETARIO', 'CONTADOR', 'PROCURADOR',
  'REPRESENTANTE_LEGAL', 'SOCIO', 'ACIONISTA', 'RESPONSAVEL_TECNICO', 'OUTRO',
];




// ── Tipos ─────────────────────────────────────────────────────
interface Registro { numero: string; conselho: string; estado: string; tipo: string; }

interface FormData {
  // Identificação civil
  cpf: string;
  fullName: string;
  nickname: string;
  motherName: string;
  fatherName: string;
  // Dados pessoais
  birthDate: string;
  birthCity: string;
  birthState: string;
  birthCountry: string;       // ← campo do schema
  dependents: Dependets[],
  gender: string;
  nationality: string;
  maritalStatus: string;
  matrimonialRegime: string;
  spouseName: string;
  spouseCpf: string;
  // Documentos
  rgNumber: string;
  rgIssuer: string;
  rgIssueDate: string;
  cnh: string;
  passport: string;
  tituloEleitor: string;
  // Contato
  email: string;
  phone1: string;
  phone2: string;
  // Endereço
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;            // ← campo do schema
  // Registros profissionais
  // Registros profissionais - lista dinâmica (OAB, CRC, CREA, CORECON, outros…)
  registros: Registro[];
  // Dados bancários
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  // Meta
  notes: string;
  isActive: boolean;
}

interface Dependents {
  id?: string;              // Para identificar no frontend
  nome: string;
  gender: string;             // Masculino, Feminino
  dataNascimento: string;   // formato YYYY-MM-DD
  parentesco?: string;      // Filho(a), Enteado(a), etc. (opcional)
}

interface CompanyLink {
  id: string;
  role: string;
  startDate: string;
  endDate: string | null;
  notes: string;
  companyId: string;
  company?: { id: string; tradeName: string; legalName: string; taxId: string };
}

const EMPTY: FormData = {
  cpf: '', fullName: '', nickname: '',
  motherName: '', fatherName: '',
  birthDate: '', birthCity: '', birthState: '', birthCountry: 'Brasil', dependents: [],
  nationality: '',
  gender: '',
  maritalStatus: '', matrimonialRegime: '',
  spouseName: '', spouseCpf: '',
  rgNumber: '', rgIssuer: '', rgIssueDate: '',
  cnh: '', passport: '', tituloEleitor: '',
  email: '', phone1: '', phone2: '',
  zipCode: '', street: '', number: '', complement: '',
  neighborhood: '', city: '', state: '', country: 'Brasil',
  registros: [],
  bankName: '', bankAgency: '', bankAccount: '',
  notes: '', isActive: true,
};

// ── Formatadores ──────────────────────────────────────────────
const fmtCpf = (v: string) =>
  v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);

const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trimEnd();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trimEnd();
};

const fmtCep = (v: string) => v.replace(/\D/g, '').slice(0, 8);

// ── Helpers de payload - converte strings vazias em undefined ──
function toPayload(form: FormData): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(form)) {
    if (k === 'isActive') { payload[k] = v; continue; }
    if (k === 'registros') {
      const regs = (v as Registro[]).filter(r => r.conselho.trim() && r.numero.trim());
      const find = (c: string) => regs.find(r => r.conselho === c);
      const oab = find('OAB');
      const crc = find('CRC');
      const crea = find('CREA');
      const corecon = find('CORECON');
      const outros = regs.filter(r => !['OAB', 'CRC', 'CREA', 'CORECON'].includes(r.conselho));
      if (oab) { payload.oabNumber = oab.numero; payload.oabState = oab.estado || undefined; }
      if (crc) { payload.crcNumber = crc.numero; payload.crcState = crc.estado || undefined; payload.crcType = crc.tipo || undefined; }
      if (crea) { payload.creaNumber = crea.numero; payload.creaState = crea.estado || undefined; }
      if (corecon) { payload.coreconNumber = corecon.numero; payload.coreconState = corecon.estado || undefined; }
      payload.otherRegistrations = outros.length ? outros : undefined;
      continue;
    }
    if (typeof v === 'string') {
      payload[k] = v.trim() === '' ? undefined : v.trim();
    } else {
      payload[k] = v;
    }
  }
  return payload;
}

// ── Sub-componentes UI ────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white';

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-blue-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, children, required,
}: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Grid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const cls =
    cols === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' :
      cols === 4 ? 'grid grid-cols-2 md:grid-cols-4 gap-4' :
        'grid grid-cols-1 md:grid-cols-3 gap-4';
  return <div className={cls}>{children}</div>;
}

function UfSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      <option value="">-</option>
      {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// ── Componente principal ──────────────────────────────────────
export const PersonForm: React.FC = () => {

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialCpf = location.state?.initialCpf || searchParams.get('cpf') || '';
  const returnTo = location.state?.returnTo || '/app/persons';


  const { personId } = useParams<{ personId?: string }>();
  const navigate = useNavigate();
  const isEditing = !!personId && personId !== 'new';

  const [form, setForm] = useState<FormData>({ ...EMPTY, cpf: initialCpf });
  const [links, setLinks] = useState<CompanyLink[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'vinculos'>('dados');
  const [cpfError, setCpfError] = useState('');

  // Novo vínculo
  const [newLink, setNewLink] = useState({ companyId: '', role: '', startDate: '', notes: '' });
  const [companies, setCompanies] = useState<Array<{ id: string; tradeName: string }>>([]);

  // ── Load ──────────────────────────────────────────────────
  useEffect(() => {
    // Carrega lista de empresas para o seletor de vínculos
    api.get('/companies')
      .then(({ data }) => setCompanies(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => { });

    if (!isEditing) return;

    api.get(`/persons/${personId}`)
      .then(({ data }) => {
        setForm({
          cpf: data.cpf ?? '',
          fullName: data.fullName ?? '',
          nickname: data.nickname ?? '',
          motherName: data.motherName ?? '',
          fatherName: data.fatherName ?? '',
          birthDate: data.birthDate ? data.birthDate.slice(0, 10) : '',
          birthCity: data.birthCity ?? '',
          birthState: data.birthState ?? '',
          birthCountry: data.birthCountry ?? 'Brasil',
          nationality: data.nationality ?? 'Brasileiro(a)',
          dependents: data.dependents ?? [],
          gender: data.gender,
          maritalStatus: data.maritalStatus ?? '',
          matrimonialRegime: data.matrimonialRegime ?? '',
          spouseName: data.spouseName ?? '',
          spouseCpf: data.spouseCpf ?? '',
          rgNumber: data.rgNumber ?? '',
          rgIssuer: data.rgIssuer ?? '',
          rgIssueDate: data.rgIssueDate ? data.rgIssueDate.slice(0, 10) : '',
          cnh: data.cnh ?? '',
          passport: data.passport ?? '',
          tituloEleitor: data.tituloEleitor ?? '',
          email: data.email ?? '',
          phone1: data.phone1 ?? '',
          phone2: data.phone2 ?? '',
          zipCode: data.zipCode ?? '',
          street: data.street ?? '',
          number: data.number ?? '',
          complement: data.complement ?? '',
          neighborhood: data.neighborhood ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          country: data.country ?? 'Brasil',
          registros: [
            data.oabNumber ? { conselho: 'OAB', numero: data.oabNumber, estado: data.oabState ?? '', tipo: '' } : null,
            data.crcNumber ? { conselho: 'CRC', numero: data.crcNumber, estado: data.crcState ?? '', tipo: data.crcType ?? '' } : null,
            data.creaNumber ? { conselho: 'CREA', numero: data.creaNumber, estado: data.creaState ?? '', tipo: '' } : null,
            data.coreconNumber ? { conselho: 'CORECON', numero: data.coreconNumber, estado: data.coreconState ?? '', tipo: '' } : null,
            ...(Array.isArray(data.otherRegistrations) ? data.otherRegistrations : []),
          ].filter(Boolean) as Registro[],
          bankName: data.bankName ?? '',
          bankAgency: data.bankAgency ?? '',
          bankAccount: data.bankAccount ?? '',
          notes: data.notes ?? '',
          isActive: data.isActive ?? true,
        });
        setLinks(data.companyLinks ?? []);
      })
      .catch(() => alert('Erro ao carregar pessoa.'))
      .finally(() => setLoading(false));
  }, [personId]);

  // ── Qualificação calculada ao vivo (reativa ao campo Sexo) ──
  const qualificacao = useMemo(() => {
    if (!form.fullName.trim()) return '';

    const gen: 'M' | 'F' | null =
      form.gender === 'Masculino' ? 'M' :
        form.gender === 'Feminino' ? 'F' : null;

    const g = (masc: string, fem: string, neutro?: string): string =>
      gen === 'M' ? masc : gen === 'F' ? fem : (neutro ?? `${masc}(a)`);

    const partes: string[] = [form.fullName];

    // Nacionalidade — flexiona automaticamente (ex: "Brasileiro(a)" → "Brasileiro" / "Brasileira")
    if (form.nationality.trim()) {
      const nat = form.nationality.trim();
      const natLow = nat.toLowerCase();
      if (gen === 'M' && natLow.endsWith('(a)')) partes.push(nat.replace(/\(a\)$/i, ''));
      else if (gen === 'F' && natLow.endsWith('o(a)')) partes.push(nat.replace(/o\(a\)$/i, 'a'));
      else if (gen === 'F' && natLow.endsWith('o')) partes.push(nat.slice(0, -1) + 'a');
      else partes.push(nat);
    }

    // Estado civil — flexionado por gênero
    const EC: Record<string, { M: string; F: string; N: string }> = {
      SOLTEIRO: { M: 'solteiro', F: 'solteira', N: 'solteiro(a)' },
      CASADO: { M: 'casado', F: 'casada', N: 'casado(a)' },
      UNIAO_ESTAVEL: { M: 'em união estável', F: 'em união estável', N: 'em união estável' },
      SEPARADO: { M: 'separado', F: 'separada', N: 'separado(a)' },
      DIVORCIADO: { M: 'divorciado', F: 'divorciada', N: 'divorciado(a)' },
      VIUVO: { M: 'viúvo', F: 'viúva', N: 'viúvo(a)' },
    };
    if (form.maritalStatus && EC[form.maritalStatus]) {
      const ec = EC[form.maritalStatus];
      partes.push(g(ec.M, ec.F, ec.N));
    }

    // Regime de bens
    const REGIME: Record<string, string> = {
      COMUNHAO_PARCIAL: 'comunhão parcial de bens',
      COMUNHAO_UNIVERSAL: 'comunhão universal de bens',
      SEPARACAO_TOTAL: 'separação total de bens',
      SEPARACAO_OBRIGATORIA: 'separação obrigatória de bens',
      PARTICIPACAO_FINAL_AQUESTOS: 'participação final nos aquestos',
    };
    if (
      (form.maritalStatus === 'CASADO' || form.maritalStatus === 'UNIAO_ESTAVEL') &&
      form.matrimonialRegime
    ) {
      partes.push(`${g('casado', 'casada')} sob o regime da ${REGIME[form.matrimonialRegime] ?? form.matrimonialRegime}`);
    }

    // Registros profissionais
    const insc = g('inscrito', 'inscrita');
    const port = g('portador', 'portadora');
    const resid = g('com domicilio', 'com domicílio');

    const oab = form.registros.find(r => r.conselho === 'OAB');
    const crc = form.registros.find(r => r.conselho === 'CRC');
    const crea = form.registros.find(r => r.conselho === 'CREA');
    const corecon = form.registros.find(r => r.conselho === 'CORECON');

    if (oab?.numero)
      partes.push(`${g('advogado', 'advogada')}, ${insc} na OAB/${oab.estado} sob o nº ${oab.numero}`);
    else if (crc?.numero)
      partes.push(`${g('contador', 'contadora')}, ${insc} no CRC/${crc.estado} sob o nº ${crc.numero}`);
    else if (crea?.numero)
      partes.push(`${g('engenheiro', 'engenheira')}, ${insc} no CREA/${crea.estado} sob o nº ${crea.numero}`);
    else if (corecon?.numero)
      partes.push(`economista, ${insc} no CORECON/${corecon.estado} sob o nº ${corecon.numero}`);

    if (form.rgNumber.trim())
      partes.push(`${port} da Cédula de Identidade RG nº ${form.rgNumber}${form.rgIssuer ? ' ' + form.rgIssuer : ''}`);

    if (form.cpf.trim())
      partes.push(`CPF nº ${form.cpf}`);

    if (form.city.trim() && form.state.trim())
      partes.push(`${resid} em ${form.city}/${form.state}`);
    else if (form.city.trim())
      partes.push(`${resid} em ${form.city}`);

    return partes.join(', ');
  }, [
    form.fullName, form.gender, form.nationality,
    form.maritalStatus, form.matrimonialRegime,
    form.registros, form.rgNumber, form.rgIssuer,
    form.cpf, form.city, form.state,
  ]);

  const set = (field: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Busca CEP ─────────────────────────────────────────────
  const buscarCep = async (cep: string) => {
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm(prev => ({
          ...prev,
          street: d.logradouro ?? prev.street,
          neighborhood: d.bairro ?? prev.neighborhood,
          city: d.localidade ?? prev.city,
          state: d.uf ?? prev.state,
        }));
      }
    } catch { }
  };

  // ── Registros livres ──────────────────────────────────────
  const addRegistro = () =>
    setForm(prev => ({
      ...prev,
      registros: [...prev.registros, { numero: '', conselho: '', estado: '', tipo: '' }],
    }));
  const setRegistro = (i: number, field: keyof Registro, v: string) =>
    setForm(prev => {
      const regs = [...prev.registros];
      regs[i] = { ...regs[i], [field]: v };
      return { ...prev, registros: regs };
    });
  const removeRegistro = (i: number) =>
    setForm(prev => ({
      ...prev,
      registros: prev.registros.filter((_, idx) => idx !== i),
    }));

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.fullName.trim()) { alert('Nome completo obrigatório.'); return; }
    if (!form.cpf.trim()) { alert('CPF obrigatório.'); return; }

    setSaving(true);
    setCpfError('');
    try {
      const payload = toPayload(form);

      if (isEditing) {
        await api.patch(`/persons/${personId}`, payload);
      } else {
        await api.post('/persons', payload);
      }
      navigate('/app/persons');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (typeof msg === 'string' && msg.toLowerCase().includes('cpf')) {
        setCpfError(msg);
        setActiveTab('dados');
      } else {
        alert(typeof msg === 'string' ? msg : 'Erro ao salvar. Verifique os dados.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Vínculos ──────────────────────────────────────────────
  const handleAddLink = async () => {
    if (!newLink.companyId || !newLink.role) {
      alert('Empresa e papel são obrigatórios.');
      return;
    }
    try {
      const { data } = await api.post('/persons/links', { personId, ...newLink });
      setLinks(prev => [...prev, data]);
      setNewLink({ companyId: '', role: '', startDate: '', notes: '' });
    } catch {
      alert('Erro ao adicionar vínculo.');
    }
  };

  const handleEncerrarLink = async (linkId: string) => {
    if (!confirm('Encerrar este vínculo (data de saída = hoje)?')) return;
    try {
      await api.patch(`/persons/links/${linkId}`, {
        endDate: new Date().toISOString().slice(0, 10),
      });
      const { data } = await api.get(`/persons/${personId}`);
      setLinks(data.companyLinks ?? []);
    } catch {
      alert('Erro ao encerrar vínculo.');
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!confirm('Remover vínculo permanentemente?')) return;
    try {
      await api.delete(`/persons/links/${linkId}`);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch {
      alert('Erro ao remover vínculo.');
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const casado = form.maritalStatus === 'CASADO' || form.maritalStatus === 'UNIAO_ESTAVEL';

  return (
    <div className="max-w-4xl mx-auto p-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/persons')}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {isEditing ? (form.fullName || 'Editar Pessoa') : 'Nova Pessoa Física'}
            </h1>
            {isEditing && form.cpf && (
              <p className="text-sm text-gray-400 font-mono">{form.cpf}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium"
        >
          <FiSave size={16} />
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {/* ── Qualificação gerada (edição) ───────────────────── */}
      {qualificacao && (
        <div className="mb-5 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl leading-relaxed">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-400 mb-1">
            Qualificação gerada automaticamente
          </span>
          <p className="text-xs text-indigo-800">{qualificacao}</p>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['dados', 'vinculos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors
              ${activeTab === tab
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'dados'
              ? 'Dados Cadastrais'
              : `Vínculos${links.length ? ` (${links.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: DADOS CADASTRAIS                               */}
      {/* ════════════════════════════════════════════════════ */}
      {activeTab === 'dados' && (
        <div className="space-y-5">

          {/* 1. Identificação Civil */}
          <Section icon={<FiUser size={16} />} title="Identificação Civil">
            <Grid cols={3}>
              <Field label="CPF" required>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => { set('cpf', fmtCpf(e.target.value)); setCpfError(''); }}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={inputCls + (cpfError ? ' border-red-300 ring-1 ring-red-200' : '')}
                />
                {cpfError && <p className="text-xs text-red-500 mt-1">{cpfError}</p>}
              </Field>
              <div className="md:col-span-2">
                <Field label="Nome Completo" required>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    placeholder="Nome completo conforme documentos"
                    className={inputCls}
                  />
                </Field>
              </div>
            </Grid>

            <Grid cols={2}>
              <Field label="Nome Social / Apelido">
                <input type="text" value={form.nickname}
                  onChange={e => set('nickname', e.target.value)}
                  placeholder="Como é conhecido(a)" className={inputCls} />
              </Field>
              <Field label="Nacionalidade">
                <input type="text" value={form.nationality}
                  onChange={e => set('nationality', e.target.value)}
                  placeholder="Ex: Brasileiro, Italiana, Argentino…" className={inputCls} />
              </Field>
            </Grid>

            <Grid cols={2}>
              <Field label="Nome da Mãe">
                <input type="text" value={form.motherName}
                  onChange={e => set('motherName', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Nome do Pai">
                <input type="text" value={form.fatherName}
                  onChange={e => set('fatherName', e.target.value)} className={inputCls} />
              </Field>
            </Grid>
          </Section>

          {/* 2. Dados Pessoais */}
          <Section icon={<FiUser size={16} />} title="Dados Pessoais">
            <div className="flex flex-wrap gap-3 items-end">


              <div className="w-36">
                <Field label="Sexo">
                  <select
                    value={form.gender || ''}
                    onChange={e => set('gender', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Selecione —</option>
                    {GENDER_OPTIONS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </Field></div>

              <div className="w-36">
                <Field label="Data de Nascimento">
                  <input type="date" value={form.birthDate}
                    onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex-1 min-w-32">
                <Field label="Naturalidade">
                  <input type="text" value={form.birthCity}
                    onChange={e => set('birthCity', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="w-24">
                <Field label="UF Nasc.">
                  <UfSelect value={form.birthState} onChange={v => set('birthState', v)} />
                </Field>
              </div>
              <div className="flex-1 min-w-28">
                <Field label="País de Nascimento">
                  <input type="text" value={form.birthCountry}
                    onChange={e => set('birthCountry', e.target.value)}
                    placeholder="Brasil" className={inputCls} />
                </Field>
              </div>
            </div>


            <Grid cols={2}>
              <Field label="Estado Civil">
                <select value={form.maritalStatus}
                  onChange={e => set('maritalStatus', e.target.value)}
                  className={`${inputCls} w-auto max-w-[180px]`}>
                  <option value="">- Não informado -</option>
                  {MARITAL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              {casado && (
                <Field label="Regime de Bens">
                  <select value={form.matrimonialRegime}
                    onChange={e => set('matrimonialRegime', e.target.value)}
                    className={inputCls}>
                    <option value="">- Selecione -</option>
                    {REGIME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              )}
            </Grid>

            {casado && (
              <Grid cols={2}>
                <Field label="Nome do Cônjuge">
                  <input type="text" value={form.spouseName}
                    onChange={e => set('spouseName', e.target.value)} className={inputCls} />
                </Field>
                <Field label="CPF do Cônjuge">
                  <input type="text" value={form.spouseCpf}
                    onChange={e => set('spouseCpf', fmtCpf(e.target.value))}
                    maxLength={14} placeholder="000.000.000-00" className={inputCls} />
                </Field>
              </Grid>
            )}
          </Section>

          {/* 2.5 Dependentes */}
          <Section icon={<FiUsers size={16} />} title="Dependentes">

            {/* Cabeçalho - aparece apenas se houver dependentes */}
            {form.dependents.length > 0 && (
              <div className="grid grid-cols-12 gap-3 px-1 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                <div className="col-span-4">Nome</div>
                <div className="col-span-2">Sexo</div>
                <div className="col-span-3">Data de Nascimento</div>
                <div className="col-span-2">Parentesco</div>
                <div className="col-span-1"></div>
              </div>
            )}

            {/* Lista de dependentes */}
            {form.dependents.map((dep, index) => (
              <div key={dep.id || index} className="grid grid-cols-12 gap-3 items-center mb-2">

                {/* Nome */}
                <div className="col-span-4">
                  <input
                    type="text"
                    value={dep.nome}
                    onChange={e => {
                      const newDeps = [...form.dependents];
                      newDeps[index].nome = e.target.value;
                      setForm(prev => ({ ...prev, dependents: newDeps }));
                    }}
                    placeholder="Nome completo"
                    className={inputCls}
                  />
                </div>

                {/* Sexo */}
                <div className="col-span-2">
                  <select
                    value={dep.sexo}
                    onChange={e => {
                      const newDeps = [...form.dependents];
                      newDeps[index].sexo = e.target.value;
                      setForm(prev => ({ ...prev, dependents: newDeps }));
                    }}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {GENDER_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Data Nascimento */}
                <div className="col-span-3">
                  <input
                    type="date"
                    value={dep.dataNascimento}
                    onChange={e => {
                      const newDeps = [...form.dependents];
                      newDeps[index].dataNascimento = e.target.value;
                      setForm(prev => ({ ...prev, dependents: newDeps }));
                    }}
                    className={inputCls}
                  />
                </div>

                {/* Parentesco (opcional) */}
                <div className="col-span-2">
                  <select
                    value={dep.parentesco || ''}
                    onChange={e => {
                      const newDeps = [...form.dependents];
                      newDeps[index].parentesco = e.target.value;
                      setForm(prev => ({ ...prev, dependents: newDeps }));
                    }}
                    className={inputCls}
                  >
                    <option value="">— Parentesco —</option>
                    {DEPENDENTS_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Botão remover */}
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => {
                      const newDeps = form.dependents.filter((_, i) => i !== index);
                      setForm(prev => ({ ...prev, dependents: newDeps }));
                    }}
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                    title="Remover dependente"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Mensagem quando não há dependentes */}
            {form.dependents.length === 0 && (
              <p className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-lg">
                Nenhum dependente cadastrado.
              </p>
            )}

            {/* Botão adicionar */}
            <button
              onClick={() => {
                const newDeps = [
                  ...form.dependents,
                  {
                    id: `temp_${Date.now()}_${Math.random()}`,
                    nome: '',
                    sexo: '',
                    dataNascimento: '',
                    parentesco: '',
                  },
                ];
                setForm(prev => ({ ...prev, dependents: newDeps }));
              }}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors mt-3"
            >
              <FiPlus size={13} /> Adicionar dependente
            </button>
          </Section>


          {/* 3. Documentos */}
          <Section icon={<FiCreditCard size={16} />} title="Documentos">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-32">
                <Field label="RG / Identidade">
                  <input type="text" value={form.rgNumber}
                    onChange={e => set('rgNumber', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex-1 min-w-32">
                <Field label="Órgão Emissor">
                  <input type="text" value={form.rgIssuer}
                    onChange={e => set('rgIssuer', e.target.value)}
                    placeholder="Ex: SSP-SP" className={inputCls} />
                </Field>
              </div>
              <div className="w-36">
                <Field label="Data de Emissão">
                  <input type="date" value={form.rgIssueDate}
                    onChange={e => set('rgIssueDate', e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
            <Grid cols={3}>
              <Field label="CNH">
                <input type="text" value={form.cnh}
                  onChange={e => set('cnh', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Passaporte">
                <input type="text" value={form.passport}
                  onChange={e => set('passport', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Título de Eleitor">
                <input type="text" value={form.tituloEleitor}
                  onChange={e => set('tituloEleitor', e.target.value)} className={inputCls} />
              </Field>
            </Grid>
          </Section>

          {/* 4. Contato */}
          <Section icon={<FiPhone size={16} />} title="Contato">
            <Grid cols={3}>
              <Field label="E-mail">
                <input type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="email@exemplo.com" className={inputCls} />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input type="text" value={form.phone1}
                  onChange={e => set('phone1', fmtPhone(e.target.value))}
                  placeholder="(00) 99999-9999" className={inputCls} />
              </Field>
              <Field label="Telefone 2">
                <input type="text" value={form.phone2}
                  onChange={e => set('phone2', fmtPhone(e.target.value))}
                  placeholder="(00) 99999-9999" className={inputCls} />
              </Field>
            </Grid>
          </Section>

          {/* 5. Endereço */}
          <Section icon={<FiMapPin size={16} />} title="Endereço">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-28">
                <Field label="CEP">
                  <input
                    type="text"
                    value={form.zipCode}
                    onChange={e => {
                      const v = fmtCep(e.target.value);
                      set('zipCode', v);
                      if (v.length === 8) buscarCep(v);
                    }}
                    placeholder="00000000"
                    maxLength={8}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex-1 min-w-40">
                <Field label="Logradouro">
                  <input type="text" value={form.street}
                    onChange={e => set('street', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="w-20">
                <Field label="Número">
                  <input type="text" value={form.number}
                    onChange={e => set('number', e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-28">
                <Field label="Complemento">
                  <input type="text" value={form.complement}
                    onChange={e => set('complement', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex-1 min-w-28">
                <Field label="Bairro">
                  <input type="text" value={form.neighborhood}
                    onChange={e => set('neighborhood', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="flex-1 min-w-28">
                <Field label="Cidade">
                  <input type="text" value={form.city}
                    onChange={e => set('city', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="w-24">
                <Field label="UF">
                  <UfSelect value={form.state} onChange={v => set('state', v)} />
                </Field>
              </div>
              <div className="flex-1 min-w-24">
                <Field label="País">
                  <input type="text" value={form.country}
                    onChange={e => set('country', e.target.value)}
                    placeholder="Brasil" className={inputCls} />
                </Field>
              </div>
            </div>
          </Section>

          {/* 6. Registros Profissionais */}
          <Section icon={<FiAward size={16} />} title="Registros Profissionais">

            {/* Cabeçalho de colunas - só aparece quando há ao menos 1 linha */}
            {form.registros.length > 0 && (
              <div className="flex gap-2 px-1 -mb-1">
                <span className="text-[11px] text-gray-400 w-48 flex-shrink-0">Conselho / Órgão</span>
                <span className="text-[11px] text-gray-400 flex-1">Número</span>
                <span className="text-[11px] text-gray-400 w-24">UF</span>
                <span className="text-[11px] text-gray-400 w-36">Tipo / Categoria</span>
                <span className="w-8" />
              </div>
            )}

            {/* Linhas dinâmicas */}
            {form.registros.map((r, i) => (
              // LINHA 1: Adicionei flex-wrap e items-start para melhor responsividade em mobile
              <div key={i} className="flex flex-wrap gap-2 items-start md:items-center">

                {/* Select do Conselho */}
                <select
                  value={r.conselho}
                  onChange={e => setRegistro(i, 'conselho', e.target.value)}
                  // LINHA 7: Mudei para w-full em mobile e md:w-48 em desktop
                  className={`${inputCls} w-full md:w-48 flex-shrink-0`}
                >
                  <option value="">- Organização -</option>
                  <option value="OAB">OAB - Advocacia</option>
                  <option value="CRC">CRC - Contabilidade</option>
                  <option value="CAU">CAU - Arquitetura</option>
                  <option value="CFF">CFF - Farmácia</option>
                  <option value="CFN">CFN - Nutrição</option>
                  <option value="CFQ">CFQ - Química</option>
                  <option value="CORECON">CORECON - Economia</option>
                  <option value="COREN">COREN - Enfermagem</option>
                  <option value="CRA">CRA - Administração</option>
                  <option value="CREA">CREA - Eng. / Arq.</option>
                  <option value="CRM">CRM - Medicina</option>
                  <option value="CRO">CRO - Odontologia</option>
                  <option value="CRP">CRP - Psicologia</option>
                  <option value="OUTRO">Outro</option>
                </select>

                {/* 🔥 CAMPO DE NÚMERO - AGORA MAIS VISÍVEL 🔥 */}
                < input
                  type="text"
                  value={r.numero}
                  onChange={e => setRegistro(i, 'numero', e.target.value)}
                  placeholder="Número do registro"
                  // LINHA 48: Adicionei min-w-[150px] e flex-1 para garantir espaço mínimo
                  className={`${inputCls} flex-1 min-w-[150px]`}
                />

                {/* Select de UF */}
                <div className="w-24 flex-shrink-0">
                  <UfSelect value={r.estado} onChange={v => setRegistro(i, 'estado', v)} />
                </div>

                {/* Select de Tipo */}
                <select
                  value={r.tipo}
                  onChange={e => setRegistro(i, 'tipo', e.target.value)}
                  // LINHA 58: Mudei para w-full em mobile e md:w-36 em desktop
                  className={`${inputCls} w-full md:w-36 flex-shrink-0`}
                >
                  <option value=""> </option>
                  <option value="Titular">Contador</option>
                  <option value="Advogado">Advogado</option>
                  <option value="Estagiário">Estagiário</option>
                  <option value="Especialista">Especialista</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Residente">Residente</option>
                  <option value="Provisório">Provisório</option>
                </select>

                {/* Botão remover */}
                <button
                  onClick={() => removeRegistro(i)}
                  // LINHA 71: Adicionei title para acessibilidade
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remover registro profissional"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}

            {/* LINHA 79: Mensagem quando não há registros */}
            {form.registros.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                Nenhum registro profissional cadastrado. Clique em "+ Adicionar" se houver.
              </p>
            )}

            {/* LINHA 85: Botão para adicionar novo registro */}
            <button
              onClick={addRegistro}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors mt-1"
            >
              <FiPlus size={13} /> Adicionar registro profissional
            </button>
          </Section>

          {/* 7. Dados Bancários */}
          <Section icon={<FiCreditCard size={16} />} title="Dados Bancários">
            <Grid cols={3}>
              <Field label="Banco">
                <input type="text" value={form.bankName}
                  onChange={e => set('bankName', e.target.value)}
                  placeholder="Ex: Itaú" className={inputCls} />
              </Field>
              <Field label="Agência">
                <input type="text" value={form.bankAgency}
                  onChange={e => set('bankAgency', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Conta">
                <input type="text" value={form.bankAccount}
                  onChange={e => set('bankAccount', e.target.value)} className={inputCls} />
              </Field>
            </Grid>
          </Section>

          {/* 8. Observações e Status */}
          <Section icon={<FiBriefcase size={16} />} title="Observações">
            <Field label="Anotações internas">
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Observações, restrições, informações adicionais…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                           resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => set('isActive', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              Cadastro ativo
            </label>
          </Section>
        </div >
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* TAB: VÍNCULOS                                       */}
      {/* ════════════════════════════════════════════════════ */}
      {
        activeTab === 'vinculos' && (
          <div className="space-y-5">

            {/* Tabela de vínculos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
                <FiLink size={16} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Vínculos com Empresas
                </h2>
              </div>

              {links.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FiLink size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">Nenhum vínculo cadastrado.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Papel</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Período</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="w-28 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {links.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{l.company?.tradeName ?? l.companyId}</p>
                          <p className="text-xs text-gray-400">{l.company?.legalName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {l.role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {l.startDate
                            ? new Date(l.startDate).toLocaleDateString('pt-BR')
                            : '-'}
                          {' → '}
                          {l.endDate
                            ? new Date(l.endDate).toLocaleDateString('pt-BR')
                            : 'atual'}
                        </td>
                        <td className="px-4 py-3">
                          {l.endDate
                            ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Encerrado</span>
                            : <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">Ativo</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            {!l.endDate && (
                              <button
                                onClick={() => handleEncerrarLink(l.id)}
                                className="text-xs px-2 py-1 text-amber-600 border border-amber-200 rounded hover:bg-amber-50 transition-colors"
                              >
                                Encerrar
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveLink(l.id)}
                              className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Adicionar vínculo - só no modo edição */}
            {isEditing ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Adicionar Vínculo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Empresa">
                    <select
                      value={newLink.companyId}
                      onChange={e => setNewLink(p => ({ ...p, companyId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.tradeName}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Papel / Função">
                    <select
                      value={newLink.role}
                      onChange={e => setNewLink(p => ({ ...p, role: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data de Início">
                    <input
                      type="date"
                      value={newLink.startDate}
                      onChange={e => setNewLink(p => ({ ...p, startDate: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Observação">
                    <input
                      type="text"
                      value={newLink.notes}
                      onChange={e => setNewLink(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Opcional"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <button
                  onClick={handleAddLink}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white
                           text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <FiPlus size={14} /> Adicionar Vínculo
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                Salve o cadastro antes de adicionar vínculos.
              </p>
            )}
          </div>
        )
      }
    </div >
  );
};

