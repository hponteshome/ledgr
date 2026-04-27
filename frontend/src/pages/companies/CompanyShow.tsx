// src/pages/companies/CompanyShow.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2 } from 'react-icons/fi';
import api from '../../services/api';
import { formatCNPJ, formatCurrency, formatDate } from '../../utils/formatters';

const Label = ({ children }: { children: string }) => (
  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">
    {children}
  </span>
);

const Val = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <p className={`font-bold text-gray-700 text-sm ${mono ? 'font-mono' : 'uppercase'}`}>
    {children || '—'}
  </p>
);

function Section({ title, color, children }: {
  title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h2 className={`text-xs font-black text-gray-800 mb-5 uppercase tracking-widest border-l-4 ${color} pl-3`}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function buildRegistroLabel(company: any): string {
  const org = company.registerOrg ?? '';
  const num = company.registerNumber ?? '';
  if (!org && !num) return '—';
  const isJunta = org.startsWith('Junta Comercial');
  const isCartorio = org === 'Cartório';
  if (isJunta) return `${org} · NIRE: ${num}`;
  if (isCartorio) {
    const livro = company.registerBook ? ` · Livro ${company.registerBook}` : '';
    const folha = company.registerSheet ? ` · Folha ${company.registerSheet}` : '';
    return `${org}${num ? ` nº ${num}` : ''}${livro}${folha}`;
  }
  return `${org}${num ? ` nº ${num}` : ''}`;
}

export const CompanyShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    api.get(`/companies/${id}`)
      .then(res => setCompany(res.data))
      .catch(console.error);
  }, [id]);

  if (!company) return (
    <div className="p-20 text-center font-black text-gray-400 animate-pulse">CARREGANDO…</div>
  );

  const registroLabel = buildRegistroLabel(company);
  const temRegistro = company.registerOrg || company.registerNumber;
  const isCartorio = company.registerOrg === 'Cartório';
  const fmtRegisterDate = company.registerDate ? formatDate(company.registerDate) : '—';

  return (
    <div className="p-6 bg-[#F8F9FC] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── HEADER ────────────────────────────────────────── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100
                        flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center
                            text-white font-black text-xl shadow-lg uppercase">
              {company.legalName?.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase leading-none">
                {company.legalName || company.razaoSocial}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                  {formatCNPJ(company.taxId)}
                </span>
                {temRegistro && (
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                    {registroLabel}
                  </span>
                )}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase
                  ${company.status === 'active' || company.status === 'ativa'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'}`}>
                  ● {company.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/app/companies/edit/${id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl
                         hover:bg-blue-700 transition font-bold text-xs uppercase shadow-sm">
              <FiEdit2 size={13} /> Editar
            </button>
            <button onClick={() => navigate('/app/companies')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-500 border border-gray-200
                         rounded-xl hover:bg-gray-50 transition font-bold text-xs uppercase shadow-sm">
              <FiArrowLeft /> Voltar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── COLUNA ESQUERDA 8/12 ──────────────────────── */}
          <div className="md:col-span-8 space-y-6">

            {/* Perfil */}
            <Section title="Perfil da Unidade" color="border-blue-600">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-5">
                <div><Label>Nome Fantasia</Label><Val>{company.tradeName || company.nomeFantasia}</Val></div>
                <div><Label>Data de Abertura</Label><Val mono>{formatDate(company.openingDate)}</Val></div>
                <div><Label>Tipo</Label><Val>{company.isHeadquarter ? 'MATRIZ' : 'FILIAL'}</Val></div>
                <div><Label>Capital Social</Label>
                  <p className="font-bold text-blue-600 text-base">
                    R$ {formatCurrency(company.equity || company.capitalSocial)}
                  </p>
                </div>
                <div><Label>Natureza Jurídica</Label><Val>{company.legalNature}</Val></div>
                <div><Label>Regime Tributário</Label><Val>{company.taxRegime}</Val></div>
                <div className="col-span-full p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Label>CNAE Principal</Label>
                  <p className="text-xs font-bold text-gray-600 leading-relaxed">
                    {company.mainActivity || company.atividade_principal || '—'}
                  </p>
                </div>
              </div>
            </Section>

            {/* Registro Institucional */}
            <Section title="Registro Institucional" color="border-purple-600">
              {temRegistro ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                  <div>
                    <Label>Órgão</Label>
                    <Val>{company.registerOrg}</Val>
                  </div>
                  <div>
                    <Label>{(company.registerOrg ?? '').startsWith('Junta') ? 'NIRE' : 'Número'}</Label>
                    <Val mono>{company.registerNumber}</Val>
                  </div>
                  <div>
                    <Label>Data do Registro</Label>
                    <Val mono>{fmtRegisterDate}</Val>
                  </div>
                  {isCartorio && (
                    <>
                      <div><Label>Livro</Label><Val>{company.registerBook}</Val></div>
                      <div><Label>Folha</Label><Val>{company.registerSheet}</Val></div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-2">
                  Nenhum registro cadastrado.{' '}
                  <button onClick={() => navigate(`/app/companies/edit/${id}`)}
                    className="text-blue-500 hover:underline">
                    Editar empresa
                  </button>
                </p>
              )}
            </Section>

            {/* Endereço */}
            <Section title="Endereço" color="border-orange-500">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Val>{[company.street, company.number, company.complement].filter(Boolean).join(', ')}</Val>
                </div>
                <div><Label>Bairro</Label><Val>{company.neighborhood}</Val></div>
                <div><Label>Cidade / UF</Label><Val>{company.city} — {company.state}</Val></div>
                <div><Label>CEP</Label><Val mono>{company.zipCode}</Val></div>
              </div>
            </Section>

            {/* Atividades secundárias */}
            {(company.secondaryActivities || company.atividades_secundarias)?.length > 0 && (
              <Section title="Atividades Secundárias" color="border-gray-300">
                <div className="flex flex-wrap gap-2">
                  {(company.secondaryActivities || company.atividades_secundarias).map((c: any, i: number) => (
                    <span key={i}
                      className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-500 uppercase max-w-[320px] truncate">
                      {c.codigo} — {c.descricao}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* ── COLUNA DIREITA 4/12 ───────────────────────── */}
          <div className="md:col-span-4 space-y-6">

            {/* Situação Cadastral */}
            <Section title="Situação Cadastral" color="border-green-500">
              <div className="space-y-3">
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${company.status === 'ativa' || company.status === 'active'
                      ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-xs font-black text-gray-700 uppercase">{company.status}</p>
                  </div>
                </div>
                <div>
                  <Label>Desde</Label>
                  <Val mono>{formatDate(company.statusDate || company.dataSituacaoCadastral)}</Val>
                </div>
                <div><Label>Porte</Label><Val>{company.size || company.porte}</Val></div>
                {company.statusReason && (
                  <p className="text-[10px] font-bold text-red-400 italic leading-tight">
                    {company.statusReason}
                  </p>
                )}
              </div>
            </Section>

            {/* Contato */}
            <Section title="Contato" color="border-teal-500">
              <div className="space-y-3">
                <div><Label>E-mail</Label><Val mono>{company.email}</Val></div>
                <div><Label>Telefone 1</Label><Val mono>{company.phone1}</Val></div>
                <div><Label>Telefone 2</Label><Val mono>{company.phone2}</Val></div>
              </div>
            </Section>

            {/* Quadro de Sócios */}
            <Section title="Sócios (QSA)" color="border-purple-600">
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {(company.partners || company.qsa || company.socios)?.length > 0 ? (
                  (company.partners || company.qsa || company.socios).map((p: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-700 uppercase leading-tight">
                        {p.nome || p.name || 'Sócio não identificado'}
                      </p>
                      <p className="text-[9px] font-bold text-purple-500 uppercase">
                        {p.qualificacao || p.role || 'Sócio'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] font-bold text-gray-400 uppercase italic text-center py-4">
                    Nenhum sócio registrado
                  </p>
                )}
              </div>
            </Section>

          </div>
        </div>
      </div>
    </div>
  );
};