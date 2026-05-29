// src/pages/companies/CompanyShow.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2 } from 'react-icons/fi';
import api from '../../services/api';

const L = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">{children}</span>
);
const V = ({ children }: { children?: React.ReactNode }) => (
  <p className="font-semibold text-gray-700 text-sm">{children || '—'}</p>
);
const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div><L>{label}</L><V>{value}</V></div>
);
const Section = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
    <div className={"text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 " + color + " pl-3"}>{title}</div>
    {children}
  </div>
);

export const CompanyShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'geral'|'contabil'|'esocial'|'sped'>('geral');

  useEffect(() => {
    api.get('/companies/' + id).then(({ data }) => setCompany(data)).catch(() => navigate('/app/companies'));
  }, [id]);

  if (!company) return <div className="p-8 text-gray-400 text-sm">Carregando...</div>;

  const tabs = [
    { key: 'geral', label: 'Geral' },
    { key: 'contabil', label: 'Contábil' },
    { key: 'esocial', label: 'eSocial' },
    { key: 'sped', label: 'SPED/ECD' },
  ] as const;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Empresa</p>
          <h1 className="text-2xl font-black text-gray-800">{company.legalName}</h1>
          <p className="text-xs text-gray-500 font-mono">{company.taxId}</p>
        </div>
        <button onClick={() => navigate('/app/companies/edit/' + id)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          <FiEdit2 size={14} /> Editar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={"px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all " +
              (activeTab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Aba Geral */}
      {activeTab === 'geral' && (
        <div className="space-y-4">
          <Section title="Identificação" color="border-blue-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="CNPJ" value={company.taxId} />
              <div className="md:col-span-2"><Field label="Razão Social" value={company.legalName} /></div>
              <Field label="Nome Fantasia" value={company.tradeName} />
              <Field label="Data de Abertura" value={company.openingDate ? new Date(company.openingDate).toLocaleDateString('pt-BR') : '—'} />
            </div>
          </Section>

          <Section title="Endereço" color="border-orange-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="CEP" value={company.zipCode} />
              <div className="md:col-span-3"><Field label="Logradouro" value={company.street} /></div>
              <Field label="Número" value={company.number} />
              <div className="md:col-span-2"><Field label="Complemento" value={company.complement} /></div>
              <Field label="UF" value={company.state} />
              <div className="md:col-span-2"><Field label="Cidade" value={company.city} /></div>
              <div className="md:col-span-2"><Field label="Bairro" value={company.neighborhood} /></div>
            </div>
          </Section>

          <Section title="Contato" color="border-teal-500">
            <div className="grid grid-cols-3 gap-4">
              <Field label="E-mail" value={company.email} />
              <Field label="Telefone 1" value={company.phone1} />
              <Field label="Telefone 2" value={company.phone2} />
            </div>
          </Section>

          <Section title="Dados Fiscais" color="border-green-500">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="md:col-span-2"><Field label="CNAE Principal" value={company.mainActivity} /></div>
              <Field label="Capital Social" value={company.equity ? 'R$ ' + Number(company.equity).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'} />
              <Field label="Natureza Jurídica" value={company.legalNature} />
              <Field label="Porte" value={company.size} />
              <Field label="Regime Tributário" value={company.taxRegime} />
              <Field label="Situação Cadastral" value={company.status === 'active' ? 'ATIVA' : company.status === 'inactive' ? 'INATIVA' : company.status} />
            </div>
          </Section>

          {company.partners && company.partners.length > 0 && (
            <Section title="QSA — Quadro de Sócios e Administradores" color="border-blue-500">
              <div className="divide-y divide-gray-100">
                {company.partners.map((s: any, i: number) => (
                  <div key={i} className="py-3 grid grid-cols-4 gap-4 text-sm">
                    <div><L>Nome</L><span className="font-semibold text-gray-800">{s.nome}</span></div>
                    <div><L>Qualificação</L><span className="text-gray-700">{s.qualificacao}</span></div>
                    <div><L>CPF/CNPJ</L><span className="font-mono text-xs text-gray-500">{s.cpfCnpj}</span></div>
                    <div><L>Entrada</L><span className="text-gray-500">{s.dataEntrada ? new Date(s.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {company.registerOrg && (
            <Section title="Registro Institucional" color="border-purple-500">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Órgão de Registro" value={company.registerOrg} />
                <Field label="Número" value={company.registerNumber} />
                <Field label="Data" value={company.registerDate ? new Date(company.registerDate).toLocaleDateString('pt-BR') : '—'} />
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Aba Contábil */}
      {activeTab === 'contabil' && (
        <Section title="Configurações Contábeis" color="border-blue-500">
          <p className="text-sm text-gray-400 italic">Em desenvolvimento.</p>
        </Section>
      )}

      {/* Aba eSocial */}
      {activeTab === 'esocial' && (
        <Section title="eSocial" color="border-teal-500">
          <p className="text-sm text-gray-400 italic">Em desenvolvimento.</p>
        </Section>
      )}

      {/* Aba SPED/ECD */}
      {activeTab === 'sped' && (
        <Section title="ECD — Escrituração Contábil Digital" color="border-purple-500">
          <div className="grid grid-cols-3 gap-4">
            <Field label="NIRE" value={company.nire} />
            <Field label="Indicador NIRE" value={company.indNire === '0' ? '0 — Não possui registro na Junta' : '1 — Possui NIRE'} />
            <Field label="Órgão de Registro" value={company.registerOrg} />
            <Field label="Cod. Município IBGE" value={company.codMun} />
            <Field label="Inscrição Estadual" value={company.ieEstadual} />
            <Field label="Escrituração Consolidada" value={company.indEscCons} />
            <Field label="Moeda Funcional" value={company.indMoedaFunc} />
            <Field label="Escrituração Centralizada" value={company.indCentralizada} />
            <div className="col-span-3"><Field label="Caminho Tabelas RFB" value={company.tabelasRfbPath} /></div>
          </div>
        </Section>
      )}
    </div>
  );
};