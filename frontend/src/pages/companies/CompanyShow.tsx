// src/pages/companies/CompanyShow.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiSave } from 'react-icons/fi';
import api from '../../services/api';
import { formatCNPJ, formatCurrency, formatDate } from '../../utils/formatters';

const Label = ({ children }: { children: string }) => (
  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">{children}</span>
);
const Val = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <p className={"font-bold text-gray-700 text-sm " + (mono ? 'font-mono' : 'uppercase')}>{children || '—'}</p>
);
const Inp = ({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) => (
  <div>
    <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">{label}</label>
    <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
      className={"w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 " + (mono ? 'font-mono' : '')} />
  </div>
);
const Sel = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div>
    <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">{label}</label>
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
      <option value="">— Selecione —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h2 className={"text-xs font-black text-gray-800 mb-5 uppercase tracking-widest border-l-4 " + color + " pl-3"}>{title}</h2>
      {children}
    </div>
  );
}
function buildRegistroLabel(company: any): string {
  const org = company.registerOrg ?? '';
  const num = company.registerNumber ?? '';
  if (!org && !num) return '—';
  if (org.startsWith('Junta Comercial')) return org + ' · NIRE: ' + num;
  if (org === 'Cartório') {
    const livro = company.registerBook ? ' · Livro ' + company.registerBook : '';
    const folha = company.registerSheet ? ' · Folha ' + company.registerSheet : '';
    return org + (num ? ' nº ' + num : '') + livro + folha;
  }
  return org + (num ? ' nº ' + num : '');
}

const PersonLookup: React.FC<{
  label: string; cpf: string; name: string;
  onCpfChange: (v: string) => void; onNameChange: (v: string) => void;
  onPersonFound?: (p: any) => void;
}> = ({ label, cpf, name, onCpfChange, onNameChange, onPersonFound }) => {
  const [searching, setSearching] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const fmtCpf = (v: string) => v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '.').replace(/(\d{3})(\d)/, '.')
    .replace(/(\d{3})(\d{1,2})$/, '-').slice(0, 14);
  const lookup = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 11) return;
    setSearching(true); setNotFound(false);
    try {
      const r = await api.get('/persons/document/' + digits);
      const p = r.data;
      onNameChange(p.fullName || '');
      onCpfChange(digits);
      if (onPersonFound) onPersonFound(p);
    } catch { setNotFound(true); }
    finally { setSearching(false); }
  };
  return (
    <>
      <div>
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">{label} — CPF</label>
        <div className="relative">
          <input type="text" value={fmtCpf(cpf)} maxLength={14} placeholder="000.000.000-00"
            onChange={e => { onCpfChange(e.target.value.replace(/\D/g, '')); setNotFound(false); }}
            onBlur={e => lookup(e.target.value)}
            className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {searching && <span className="absolute right-2 top-2 text-[10px] text-blue-400">buscando...</span>}
        </div>
        {notFound && (
          <p className="text-[10px] text-amber-600 mt-1">
            CPF nao cadastrado.{' '}
            <button onClick={() => window.open('/app/persons/new?cpf=' + cpf, '_blank')}
              className="underline text-blue-600">Cadastrar pessoa</button>
          </p>
        )}
      </div>
      <div className="md:col-span-2">
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter block mb-0.5">Nome</label>
        <input type="text" value={name || ''} onChange={e => onNameChange(e.target.value)}
          className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    </>
  );
};

export const CompanyShow: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'contabil'>('geral');
  const [config, setConfig] = useState<any>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    api.get('/companies/' + id).then(res => setCompany(res.data)).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get('/accounting/config', { headers: { 'x-company-id': id } })
      .then(res => setConfig(res.data || {}))
      .catch(() => setConfig({}));
  }, [id]);

  const saveConfig = async () => {
    setConfigSaving(true); setConfigMsg('');
    try {
      await api.put('/accounting/config', config, { headers: { 'x-company-id': id } });
      setConfigMsg('Configuracao salva com sucesso.');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch { setConfigMsg('Erro ao salvar.'); }
    setConfigSaving(false);
  };

  const upd = (field: string, value: string) => setConfig((prev: any) => ({ ...prev, [field]: value }));

  if (!company) return <div className="p-20 text-center font-black text-gray-400 animate-pulse">CARREGANDO...</div>;

  const registroLabel = buildRegistroLabel(company);
  const temRegistro = company.registerOrg || company.registerNumber;
  const isCartorio = company.registerOrg === 'Cartório';
  const fmtRegisterDate = company.registerDate ? formatDate(company.registerDate) : '—';

  return (
    <div className="p-6 bg-[#F8F9FC] min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg uppercase">
              {company.legalName?.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 uppercase leading-none">{company.legalName || company.razaoSocial}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">{formatCNPJ(company.taxId)}</span>
                {temRegistro && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{registroLabel}</span>}
                <span className={"text-[10px] font-black px-2 py-0.5 rounded uppercase " + (company.status === 'active' || company.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>● {company.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/app/companies/edit/' + id)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold text-xs uppercase shadow-sm"><FiEdit2 size={13} /> Editar</button>
            <button onClick={() => navigate('/app/companies')} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition font-bold text-xs uppercase shadow-sm"><FiArrowLeft /> Voltar</button>
          </div>
        </div>

        <div className="flex gap-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5">
          {(['geral', 'contabil'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={"px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all " + (activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50')}>
              {tab === 'geral' ? 'Geral' : 'Contábil'}
            </button>
          ))}
        </div>

        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-6">
              <Section title="Perfil da Unidade" color="border-blue-600">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-5">
                  <div><Label>Nome Fantasia</Label><Val>{company.tradeName || company.nomeFantasia}</Val></div>
                  <div><Label>Data de Abertura</Label><Val mono>{formatDate(company.openingDate)}</Val></div>
                  <div><Label>Tipo</Label><Val>{company.isHeadquarter ? 'MATRIZ' : 'FILIAL'}</Val></div>
                  <div><Label>Capital Social</Label><p className="font-bold text-blue-600 text-base">R$ {formatCurrency(company.equity || company.capitalSocial)}</p></div>
                  <div><Label>Natureza Jurídica</Label><Val>{company.legalNature}</Val></div>
                  <div><Label>Regime Tributário</Label><Val>{company.taxRegime}</Val></div>
                  <div className="col-span-full p-3 bg-gray-50 rounded-xl border border-gray-100"><Label>CNAE Principal</Label><p className="text-xs font-bold text-gray-600 leading-relaxed">{company.mainActivity || company.atividade_principal || '—'}</p></div>
                </div>
              </Section>
              <Section title="Registro Institucional" color="border-purple-600">
                {temRegistro ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                    <div><Label>Órgão</Label><Val>{company.registerOrg}</Val></div>
                    <div><Label>{(company.registerOrg ?? '').startsWith('Junta') ? 'NIRE' : 'Número'}</Label><Val mono>{company.registerNumber}</Val></div>
                    <div><Label>Data do Registro</Label><Val mono>{fmtRegisterDate}</Val></div>
                    {isCartorio && (<><div><Label>Livro</Label><Val>{company.registerBook}</Val></div><div><Label>Folha</Label><Val>{company.registerSheet}</Val></div></>)}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic py-2">Nenhum registro cadastrado. <button onClick={() => navigate('/app/companies/edit/' + id)} className="text-blue-500 hover:underline">Editar empresa</button></p>
                )}
              </Section>
              <Section title="Endereço" color="border-orange-500">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                  <div className="md:col-span-2"><Label>Logradouro</Label><Val>{[company.street, company.number, company.complement].filter(Boolean).join(', ')}</Val></div>
                  <div><Label>Bairro</Label><Val>{company.neighborhood}</Val></div>
                  <div><Label>Cidade / UF</Label><Val>{company.city} — {company.state}</Val></div>
                  <div><Label>CEP</Label><Val mono>{company.zipCode}</Val></div>
                </div>
              </Section>
              {(company.secondaryActivities || company.atividades_secundarias)?.length > 0 && (
                <Section title="Atividades Secundárias" color="border-gray-300">
                  <div className="flex flex-wrap gap-2">
                    {(company.secondaryActivities || company.atividades_secundarias).map((c: any, i: number) => (
                      <span key={i} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-500 uppercase max-w-[320px] truncate">{c.codigo} — {c.descricao}</span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
            <div className="md:col-span-4 space-y-6">
              <Section title="Situação Cadastral" color="border-green-500">
                <div className="space-y-3">
                  <div><Label>Status</Label>
                    <div className="flex items-center gap-2">
                      <span className={"w-2 h-2 rounded-full " + (company.status === 'ativa' || company.status === 'active' ? 'bg-green-500' : 'bg-red-500')} />
                      <p className="text-xs font-black text-gray-700 uppercase">{company.status}</p>
                    </div>
                  </div>
                  <div><Label>Desde</Label><Val mono>{formatDate(company.statusDate || company.dataSituacaoCadastral)}</Val></div>
                  <div><Label>Porte</Label><Val>{company.size || company.porte}</Val></div>
                  {company.statusReason && <p className="text-[10px] font-bold text-red-400 italic leading-tight">{company.statusReason}</p>}
                </div>
              </Section>
              <Section title="Contato" color="border-teal-500">
                <div className="space-y-3">
                  <div><Label>E-mail</Label><Val mono>{company.email}</Val></div>
                  <div><Label>Telefone 1</Label><Val mono>{company.phone1}</Val></div>
                  <div><Label>Telefone 2</Label><Val mono>{company.phone2}</Val></div>
                </div>
              </Section>
              <Section title="Socios (QSA)" color="border-purple-600">
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {(company.partners || company.qsa || company.socios)?.length > 0 ? (
                    (company.partners || company.qsa || company.socios).map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-700 uppercase leading-tight">{p.nome || p.name || 'Socio nao identificado'}</p>
                        <p className="text-[9px] font-bold text-purple-500 uppercase">{p.qualificacao || p.role || 'Socio'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] font-bold text-gray-400 uppercase italic text-center py-4">Nenhum socio registrado</p>
                  )}
                </div>
              </Section>
            </div>
          </div>
        )}

        {activeTab === 'contabil' && (
          <div className="space-y-6">
            <Section title="Contador Responsavel" color="border-blue-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PersonLookup label="Contador" cpf={config.accountantCpf || ''} name={config.accountantName || ''}
                  onCpfChange={v => upd('accountantCpf', v)} onNameChange={v => upd('accountantName', v)}
                  onPersonFound={p => { if (p.crcNumber) { upd('accountantCrc', p.crcNumber); upd('accountantCrcState', p.crcState || ''); } }} />
                <Sel label="Cargo" value={config.accountantRole || ''} onChange={v => upd('accountantRole', v)}
                  options={['Contador', 'Técnico Contábil']} />
                <Inp label="CRC" value={config.accountantCrc || ''} onChange={v => upd('accountantCrc', v)} mono />
                <Inp label="UF CRC" value={config.accountantCrcState || ''} onChange={v => upd('accountantCrcState', v)} />
              </div>
            </Section>
            <Section title="Responsavel Legal" color="border-purple-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PersonLookup label="Responsavel" cpf={config.legalRepCpf || ''} name={config.legalRepName || ''}
                  onCpfChange={v => upd('legalRepCpf', v)} onNameChange={v => upd('legalRepName', v)} />
                <Sel label="Cargo" value={config.legalRepRole || ''} onChange={v => upd('legalRepRole', v)}
                  options={['Administrador', 'Socio', 'Socio-Administrador', 'Procurador', 'Representante']} />
              </div>
            </Section>
            <Section title="Responsavel eSocial" color="border-orange-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PersonLookup label="Responsavel" cpf={config.esocialCpf || ''} name={config.esocialName || ''}
                  onCpfChange={v => upd('esocialCpf', v)} onNameChange={v => upd('esocialName', v)} />
                <Sel label="Cargo" value={config.esocialRole || ''} onChange={v => upd('esocialRole', v)}
                  options={['Administrador', 'Socio', 'Socio-Administrador', 'Procurador', 'Representante', 'Contador', 'Técnico Contábil']} />
              </div>
            </Section>
            <Section title="Auditor Independente" color="border-gray-400">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Inp label="CPF" value={config.auditorCpf || ''} onChange={v => upd('auditorCpf', v)} mono />
                <div className="md:col-span-2"><Inp label="Nome" value={config.auditorName || ''} onChange={v => upd('auditorName', v)} /></div>
                <Sel label="Cargo" value={config.auditorRole || ''} onChange={v => upd('auditorRole', v)}
                  options={['Auditor Independente', 'Socio-Auditor', 'Contador']} />
                <Inp label="CRC" value={config.auditorCrc || ''} onChange={v => upd('auditorCrc', v)} mono />
              </div>
            </Section>
            <Section title="Dados ECD / ECF" color="border-green-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Inp label="Indicador Sit. Especial" value={config.indicadorSitEsp || ''} onChange={v => upd('indicadorSitEsp', v)} />
                <Inp label="Codigo SCP" value={config.codigoScp || ''} onChange={v => upd('codigoScp', v)} mono />
                <Inp label="Moeda" value={config.moeda || 'BRL'} onChange={v => upd('moeda', v)} />
              </div>
            </Section>
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              {configMsg && <span className={"text-xs font-bold " + (configMsg.includes('sucesso') ? 'text-green-600' : 'text-red-600')}>{configMsg}</span>}
              <div className="ml-auto">
                <button onClick={saveConfig} disabled={configSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold text-xs uppercase shadow-sm disabled:opacity-50">
                  <FiSave size={13} /> {configSaving ? 'Salvando...' : 'Salvar Configuracao'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};