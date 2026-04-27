// src/pages/persons/PersonView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiEdit2, FiUser, FiUsers, FiBriefcase,
  FiMapPin, FiPhone, FiAward, FiLink, FiCreditCard,
} from 'react-icons/fi';
import api from '@/services/api';

// ── Helpers ───────────────────────────────────────────────────
const MARITAL_LABEL: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)',
  CASADO: 'Casado(a)',
  UNIAO_ESTAVEL: 'União Estável',
  SEPARADO: 'Separado(a)',
  DIVORCIADO: 'Divorciado(a)',
  VIUVO: 'Viúvo(a)',
};

const REGIME_LABEL: Record<string, string> = {
  COMUNHAO_PARCIAL: 'Comunhão Parcial de Bens',
  COMUNHAO_UNIVERSAL: 'Comunhão Universal de Bens',
  SEPARACAO_TOTAL: 'Separação Total de Bens',
  SEPARACAO_OBRIGATORIA: 'Separação Obrigatória de Bens',
  PARTICIPACAO_FINAL_AQUESTOS: 'Participação Final nos Aquestos',
};

const fmt = (v?: string | null) => v?.trim() || '—';

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; }
};

// ── Sub-componentes ───────────────────────────────────────────
function Section({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-blue-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function Grid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const cls =
    cols === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-5' :
      cols === 4 ? 'grid grid-cols-2 sm:grid-cols-4 gap-5' :
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5';
  return <div className={cls}>{children}</div>;
}

// ── Componente principal ──────────────────────────────────────
export const PersonView: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();

  const [person, setPerson] = useState<any>(null);
  const [qualificacao, setQualificacao] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) return;
    Promise.all([
      api.get(`/persons/${personId}`),
      api.get(`/persons/${personId}/qualificacao`).catch(() => ({ data: '' })),
    ])
      .then(([{ data: p }, { data: q }]) => {
        setPerson(p);
        setQualificacao(typeof q === 'string' ? q : '');
      })
      .catch(() => alert('Erro ao carregar pessoa.'))
      .finally(() => setLoading(false));
  }, [personId]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  if (!person) return (
    <div className="flex justify-center items-center h-64 text-gray-400">
      Pessoa não encontrada.
    </div>
  );

  // Reconstrói lista de registros profissionais
  const registros: Array<{ conselho: string; numero: string; estado?: string; tipo?: string }> = [
    person.oabNumber && { conselho: 'OAB', numero: person.oabNumber, estado: person.oabState, tipo: '' },
    person.crcNumber && { conselho: 'CRC', numero: person.crcNumber, estado: person.crcState, tipo: person.crcType },
    person.creaNumber && { conselho: 'CREA', numero: person.creaNumber, estado: person.creaState, tipo: '' },
    person.coreconNumber && { conselho: 'CORECON', numero: person.coreconNumber, estado: person.coreconState, tipo: '' },
    ...(Array.isArray(person.otherRegistrations) ? person.otherRegistrations : []),
  ].filter(Boolean) as any[];

  const casado = person.maritalStatus === 'CASADO' || person.maritalStatus === 'UNIAO_ESTAVEL';
  const links: any[] = person.companyLinks ?? [];
  const dependents: any[] = person.dependents ?? [];

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
            <h1 className="text-xl font-bold text-gray-800">{person.fullName}</h1>
            {person.cpf && (
              <p className="text-sm text-gray-400 font-mono">{person.cpf}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge ativo/inativo */}
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${person.isActive
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
            }`}>
            {person.isActive ? 'Ativo' : 'Inativo'}
          </span>
          <button
            onClick={() => navigate(`/app/persons/${personId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <FiEdit2 size={14} /> Editar
          </button>
        </div>
      </div>

      {/* ── Qualificação ───────────────────────────────────── */}
      {qualificacao && (
        <div className="mb-5 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl leading-relaxed">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-400 mb-1">
            Qualificação
          </span>
          <p className="text-xs text-indigo-800 leading-relaxed">{qualificacao}</p>
        </div>
      )}

      <div className="space-y-5">

        {/* 1. Identificação Civil */}
        <Section icon={<FiUser size={16} />} title="Identificação Civil">
          <Grid cols={3}>
            <Row label="CPF" value={person.cpf} mono />
            <div className="sm:col-span-2">
              <Row label="Nome Completo" value={person.fullName} />
            </div>
          </Grid>
          <div className="mt-5">
            <Grid cols={2}>
              <Row label="Nome Social / Apelido" value={person.nickname} />
              <Row label="Nacionalidade" value={person.nationality} />
            </Grid>
          </div>
          <div className="mt-5">
            <Grid cols={2}>
              <Row label="Nome da Mãe" value={person.motherName} />
              <Row label="Nome do Pai" value={person.fatherName} />
            </Grid>
          </div>
        </Section>

        {/* 2. Dados Pessoais */}
        <Section icon={<FiUser size={16} />} title="Dados Pessoais">
          <Grid cols={3}>
            <Row label="Sexo" value={person.gender} />
            <Row label="Data de Nascimento" value={fmtDate(person.birthDate)} />
            <Row label="Naturalidade" value={
              [person.birthCity, person.birthState].filter(Boolean).join(' / ') || undefined
            } />
          </Grid>
          <div className="mt-5">
            <Grid cols={2}>
              <Row label="País de Nascimento" value={person.birthCountry} />
              <Row label="Estado Civil" value={person.maritalStatus ? MARITAL_LABEL[person.maritalStatus] : undefined} />
            </Grid>
          </div>
          {casado && (
            <div className="mt-5">
              <Grid cols={3}>
                <Row label="Regime de Bens" value={person.matrimonialRegime ? REGIME_LABEL[person.matrimonialRegime] : undefined} />
                <Row label="Nome do Cônjuge" value={person.spouseName} />
                <Row label="CPF do Cônjuge" value={person.spouseCpf} mono />
              </Grid>
            </div>
          )}
        </Section>

        {/* 2.5 Dependentes */}
        {dependents.length > 0 && (
          <Section icon={<FiUsers size={16} />} title="Dependentes">
            <div className="divide-y divide-gray-50">
              {dependents.map((dep: any, i: number) => (
                <div key={dep.id || i} className="py-3 first:pt-0 last:pb-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Row label="Nome" value={dep.nome} />
                    <Row label="Sexo" value={dep.sexo} />
                    <Row label="Nascimento" value={fmtDate(dep.dataNascimento)} />
                    <Row label="Parentesco" value={dep.parentesco} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 3. Documentos */}
        <Section icon={<FiCreditCard size={16} />} title="Documentos">
          <Grid cols={3}>
            <Row label="RG / Identidade" value={person.rgNumber} />
            <Row label="Órgão Emissor" value={person.rgIssuer} />
            <Row label="Data de Emissão" value={fmtDate(person.rgIssueDate)} />
          </Grid>
          <div className="mt-5">
            <Grid cols={3}>
              <Row label="CNH" value={person.cnh} />
              <Row label="Passaporte" value={person.passport} />
              <Row label="Título de Eleitor" value={person.tituloEleitor} />
            </Grid>
          </div>
        </Section>

        {/* 4. Contato */}
        <Section icon={<FiPhone size={16} />} title="Contato">
          <Grid cols={3}>
            <Row label="E-mail" value={person.email} />
            <Row label="Telefone / WhatsApp" value={person.phone1} />
            <Row label="Telefone 2" value={person.phone2} />
          </Grid>
        </Section>

        {/* 5. Endereço */}
        <Section icon={<FiMapPin size={16} />} title="Endereço">
          <Grid cols={3}>
            <Row label="CEP" value={person.zipCode} mono />
            <div className="sm:col-span-2">
              <Row label="Logradouro" value={
                [person.street, person.number, person.complement].filter(Boolean).join(', ') || undefined
              } />
            </div>
          </Grid>
          <div className="mt-5">
            <Grid cols={4}>
              <Row label="Bairro" value={person.neighborhood} />
              <Row label="Cidade" value={person.city} />
              <Row label="UF" value={person.state} />
              <Row label="País" value={person.country} />
            </Grid>
          </div>
        </Section>

        {/* 6. Registros Profissionais */}
        {registros.length > 0 && (
          <Section icon={<FiAward size={16} />} title="Registros Profissionais">
            <div className="divide-y divide-gray-50">
              {registros.map((r, i) => (
                <div key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Row label="Conselho" value={r.conselho} />
                    <Row label="Número" value={r.numero} mono />
                    <Row label="UF" value={r.estado} />
                    <Row label="Tipo" value={r.tipo} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 7. Dados Bancários */}
        {(person.bankName || person.bankAgency || person.bankAccount) && (
          <Section icon={<FiCreditCard size={16} />} title="Dados Bancários">
            <Grid cols={3}>
              <Row label="Banco" value={person.bankName} />
              <Row label="Agência" value={person.bankAgency} />
              <Row label="Conta" value={person.bankAccount} />
            </Grid>
          </Section>
        )}

        {/* 8. Observações */}
        {person.notes && (
          <Section icon={<FiBriefcase size={16} />} title="Observações">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{person.notes}</p>
          </Section>
        )}

        {/* 9. Vínculos com Empresas */}
        <Section icon={<FiLink size={16} />} title="Vínculos com Empresas">
          {links.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Nenhum vínculo cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Empresa</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Papel</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Período</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {links.map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-3">
                      <p className="font-medium text-gray-800">{l.company?.tradeName ?? l.companyId}</p>
                      <p className="text-xs text-gray-400">{l.company?.legalName}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {l.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-gray-500">
                      {l.startDate ? new Date(l.startDate).toLocaleDateString('pt-BR') : '—'}
                      {' → '}
                      {l.endDate ? new Date(l.endDate).toLocaleDateString('pt-BR') : 'atual'}
                    </td>
                    <td className="py-3">
                      {l.endDate
                        ? <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Encerrado</span>
                        : <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">Ativo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

      </div>
    </div>
  );
};