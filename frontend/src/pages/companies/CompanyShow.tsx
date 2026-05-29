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
  const [accConfig, setAccConfig] = useState<any>(null);
  const [qsaLinks, setQsaLinks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'geral'|'contabil'|'esocial'|'sped'>('geral');

  useEffect(() => {
    api.get('/companies/' + id).then(({ data }) => setCompany(data)).catch(() => navigate('/app/companies'));
    api.get('/accounting/config', { headers: { 'x-company-id': id } }).then(({ data }) => setAccConfig(data)).catch(() => {});
    api.get('/persons/links/company/' + id).then(({ data }) => setQsaLinks(data || [])).catch(() => {});
  }, [id]);

  if (!company) return <div className="p-8 text-gray-400 text-sm">Carregando...</div>;

  const tabs = [
    { key: 'geral', label: 'Geral' },
    { key: 'contabil', label: 'Contabil' },
    { key: 'esocial', label: 'eSocial' },
    { key: 'sped', label: 'SPED/ECD' },
  ] as const;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
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
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={"px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all " +
              (activeTab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'geral' && (
        <div className="space-y-4">
          <Section title="Identificacao" color="border-blue-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="CNPJ" value={company.taxId} />
              <div className="md:col-span-2"><Field label="Razao Social" value={company.legalName} /></div>
              <Field label="Nome Fantasia" value={company.tradeName} />
              <Field label="Data de Abertura" value={company.openingDate ? new Date(company.openingDate).toLocaleDateString('pt-BR') : ''} />
            </div>
          </Section>
          <Section title="Endereco" color="border-orange-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="CEP" value={company.zipCode} />
              <div className="md:col-span-3"><Field label="Logradouro" value={company.street} /></div>
              <Field label="Numero" value={company.number} />
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
              <Field label="Capital Social" value={company.equity ? 'R$ ' + Number(company.equity).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''} />
              <Field label="Natureza Juridica" value={company.legalNature} />
              <Field label="Porte" value={company.size} />
              <Field label="Regime Tributario" value={company.taxRegime} />
              <Field label="Situacao" value={company.status === 'active' ? 'ATIVA' : company.status === 'inactive' ? 'INATIVA' : company.status} />
            </div>
          </Section>
          {company.partners && company.partners.length > 0 && (
            <Section title="QSA — Quadro de Socios e Administradores" color="border-blue-500">
              <div className="divide-y divide-gray-100">
                {company.partners.map((s: any, i: number) => (
                  <div key={i} className="py-3 grid grid-cols-4 gap-4 text-sm">
                    <div><L>Nome</L><span className="font-semibold">{s.nome}</span></div>
                    <div><L>Qualificacao</L><span>{s.qualificacao}</span></div>
                    <div><L>CPF/CNPJ</L><span className="font-mono text-xs text-gray-500">{s.cpfCnpj}</span></div>
                    <div><L>Entrada</L><span className="text-gray-500">{s.dataEntrada ? new Date(s.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {activeTab === 'contabil' && (
        <div className="space-y-4">
          <Section title="Escritorio / Organizacao Contabil" color="border-green-500">
            <div className="grid grid-cols-3 gap-4">
              <Field label="CNPJ Escritorio" value={accConfig?.escritorioCnpj} />
              <div className="col-span-2"><Field label="Nome" value={accConfig?.escritorioNome} /></div>
              <Field label="CRC" value={accConfig?.escritorioCrc} />
              <Field label="UF CRC" value={accConfig?.escritorioCrcState} />
              <Field label="E-mail" value={accConfig?.escritorioEmail} />
              <Field label="Telefone" value={accConfig?.escritorioTelefone} />
            </div>
          </Section>
          <Section title="Contador Responsavel" color="border-blue-500">
            <div className="grid grid-cols-3 gap-4">
              <Field label="CPF" value={accConfig?.accountantCpf} />
              <div className="col-span-2"><Field label="Nome" value={accConfig?.accountantName} /></div>
              <Field label="CRC" value={accConfig?.accountantCrc} />
              <Field label="UF CRC" value={accConfig?.accountantCrcState} />
              <Field label="Funcao" value={accConfig?.accountantRole} />
            </div>
          </Section>
          <Section title="Representante Legal" color="border-purple-500">
            <div className="grid grid-cols-3 gap-4">
              <Field label="CPF" value={accConfig?.legalRepCpf} />
              <div className="col-span-2"><Field label="Nome" value={accConfig?.legalRepName} /></div>
              <Field label="Funcao / Cargo" value={accConfig?.legalRepRole} />
            </div>
          </Section>
        </div>
      )}
          {company.partners && company.partners.length > 0 && (
            <Section title="QSA — Responsabilidades SPED" color="border-indigo-500">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="text-left py-2">Nome</th>
                  <th className="text-left py-2">Qualificacao</th>
                  <th className="text-center py-2">Assina ECD</th>
                  <th className="text-center py-2">Assina ECF</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {company.partners.map((s: any, idx: number) => {
                    const link = qsaLinks.find((l: any) => {
                      const digits = (s.cpfCnpj || "").replace(/\*/g,"").replace(/\D/g,"");
                      return digits.length >= 4 && l.person?.cpf?.replace(/\D/g,"").includes(digits);
                    });
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 font-medium">{s.nome}</td>
                        <td className="py-2 text-xs text-gray-500">{s.qualificacao}</td>
                        <td className="py-2 text-center">{link?.assinaEcd ? "✓" : "—"}</td>
                        <td className="py-2 text-center">{link?.assinaEcf ? "✓" : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}

      {activeTab === 'esocial' && (
        <Section title="eSocial" color="border-teal-500">
          <p className="text-sm text-gray-400 italic">Em desenvolvimento.</p>
        </Section>
      )}

      {activeTab === 'sped' && (
        <Section title="ECD — Escrituracao Contabil Digital" color="border-purple-500">
          <div className="grid grid-cols-3 gap-4">
            <Field label="NIRE" value={company.nire} />
            <Field label="Indicador NIRE" value={company.indNire === '0' ? 'Nao possui registro na Junta' : 'Possui NIRE'} />
            <Field label="Orgao de Registro" value={company.registerOrg} />
            <Field label="Cod. Municipio IBGE" value={company.codMun} />
            <Field label="Inscricao Estadual" value={company.ieEstadual} />
            <Field label="Escrituracao Consolidada" value={company.indEscCons} />
            <Field label="Moeda Funcional" value={company.indMoedaFunc} />
            <Field label="Escrituracao Centralizada" value={company.indCentralizada} />
            <div className="col-span-3"><Field label="Caminho Tabelas RFB" value={company.tabelasRfbPath} /></div>
          </div>
        </Section>
      )}
    </div>
  );
};
