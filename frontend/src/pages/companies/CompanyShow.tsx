import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2 } from 'react-icons/fi';
import api from '../../services/api';
import { QsaVinculoGrid } from './QsaVinculoGrid';
import { FiClock, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';

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
  const [regimes, setRegimes] = useState<any[]>([]);
  const [showRegimeModal, setShowRegimeModal] = useState(false);
  const [regimeForm, setRegimeForm] = useState({ dtIni: '', dtFin: '', formaTributacao: '2', periodoApuracaoIRPJ: 'A' });
  const [savingRegime, setSavingRegime] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'geral'|'contabil'|'esocial'|'sped'|'historico'>('geral');

  useEffect(() => {
    api.get('/companies/' + id).then(({ data }) => setCompany(data)).catch(() => navigate('/app/companies'));
    api.get('/accounting/config', { headers: { 'x-company-id': id } }).then(({ data }) => setAccConfig(data)).catch(() => {});
    api.get('/persons/links/company/' + id).then(({ data }) => setQsaLinks(data || [])).catch(() => {});
    api.get('/companies/' + id + '/tax-regimes').then(({ data }) => setRegimes(data || [])).catch(() => {});
    api.get('/companies/' + id + '/history').then(({ data }) => setHistory(data || [])).catch(() => {});
  }, [id]);

  if (!company) return <div className="p-8 text-gray-400 text-sm">Carregando...</div>;

  const tabs = [
    { key: 'geral', label: 'Geral' },
    { key: 'contabil', label: 'Contabil' },
    { key: 'esocial', label: 'eSocial' },
    { key: 'sped', label: 'SPED/ECD' },
    { key: 'historico', label: 'Historico' },
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
            <QsaVinculoGrid companyId={id!} partners={company.partners} />
          )}

      {activeTab === 'esocial' && (
        <Section title="eSocial" color="border-teal-500">
          <p className="text-sm text-gray-400 italic">Em desenvolvimento.</p>
        </Section>
      )}

      {activeTab === 'sped' && (
        <>
        <Section title="Regime Tributario por Exercicio" color="border-green-500">
          <div className="mb-3 flex justify-end">
            <button onClick={() => setShowRegimeModal(true)}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition">
              + Adicionar Regime
            </button>
          </div>
          {regimes.length === 0 && <p className="text-sm text-gray-400 italic">Nenhum regime cadastrado.</p>}
          {regimes.length > 0 && (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400 uppercase">
                <th className="text-left py-2">Periodo</th>
                <th className="text-left py-2">Regime</th>
                <th className="text-left py-2">Apuracao IRPJ</th>
                <th className="py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {regimes.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium">{new Date(r.dtIni).toLocaleDateString('pt-BR')} — {new Date(r.dtFin).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{r.formaLabel}</span></td>
                    <td className="py-2 text-gray-500">{r.periodoApuracaoIRPJ === 'A' ? 'Anual' : 'Trimestral'}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => api.delete('/companies/' + id + '/tax-regimes/' + r.id).then(() => api.get('/companies/' + id + '/tax-regimes').then(({ data }) => setRegimes(data || [])))}
                        className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section title="Preview J930 — Assinantes ECD/ECF" color="border-indigo-500">
          {qsaLinks.filter((l: any) => l.assinaEcd || l.assinaEcf).length === 0 && (
            <p className="text-sm text-gray-400 italic">Nenhum assinante definido. Configure na aba Contabil.</p>
          )}
          {qsaLinks.filter((l: any) => l.assinaEcd || l.assinaEcf).length > 0 && (
            <div className="space-y-1">
              <div className="text-gray-400 mb-2 text-[10px]" style={{fontFamily:"sans-serif"}}>Preview — Registro J930</div>
              {qsaLinks.filter((l: any) => l.assinaEcd || l.assinaEcf).map((l: any) => {
                const cpf = (l.person?.cpf || "").replace(/\D/g, "");
                const nome = (l.person?.fullName || "").toUpperCase();
                const crc = l.person?.crcNumber ? l.person.crcNumber + (l.person.crcState ? "/" + l.person.crcState : "") : "";
                const indEcd = l.assinaEcd ? "1" : "0";
                const indEcf = l.assinaEcf ? "1" : "0";
                const linha = "|J930|05|" + cpf + "|" + nome + "|" + crc + "|||" + indEcd + "|" + indEcf + "|";
                return (
                  <div key={l.id} className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs font-mono text-blue-800 break-all">
                    {linha}
                  </div>
                );
              })}
              {accConfig?.accountantCpf && (() => {
                const cpf = (accConfig.accountantCpf || "").replace(/\D/g, "");
                const nome = (accConfig.accountantName || "").toUpperCase();
                const crc = accConfig.accountantCrc ? accConfig.accountantCrc + (accConfig.accountantCrcState ? "/" + accConfig.accountantCrcState : "") : "";
                const linha = "|J930|63|" + cpf + "|" + nome + "|" + crc + "|||0|0|";
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs font-mono text-blue-800 break-all">
                    {linha}
                  </div>
                );
              })()}
            </div>
          )}
        </Section>
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
        </>
      )}

      {activeTab === 'historico' && (
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm">
              Nenhuma alteracao registrada.
            </div>
          )}
          {history.map((h: any) => {
            const isRfb = h.source === 'RFB_SYNC';
            const changes: any[] = Array.isArray(h.changes) ? h.changes : [];
            return (
              <div key={h.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50" style={{ background: isRfb ? '#EFF6FF' : '#F5F3FF' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: isRfb ? '#DBEAFE' : '#EDE9FE', color: isRfb ? '#1D4ED8' : '#6D28D9' }}>
                      {isRfb ? 'Sincronizacao RFB' : 'Edicao Manual'}
                    </span>
                    <span className="text-xs text-gray-500">por {h.changedBy?.fullName || h.changedBy?.email || 'Sistema'}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(h.changedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="px-5 py-3 divide-y divide-gray-50">
                  {changes.map((c: any, idx: number) => (
                    <div key={idx} className="py-2 grid grid-cols-3 gap-4 text-xs">
                      <div className="font-semibold text-gray-500 uppercase tracking-wide">{c.label}</div>
                      <div className="text-red-500">{c.oldValue || '—'}</div>
                      <div className="text-emerald-600 font-medium">{c.newValue || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showRegimeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Cadastrar Regime Tributario</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Data Inicio</label>
                <input type="date" value={regimeForm.dtIni}
                  onChange={e => setRegimeForm(p => ({...p, dtIni: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Data Fim</label>
                <input type="date" value={regimeForm.dtFin}
                  onChange={e => setRegimeForm(p => ({...p, dtFin: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Forma de Tributacao</label>
                <select value={regimeForm.formaTributacao}
                  onChange={e => setRegimeForm(p => ({...p, formaTributacao: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="1">1 - Lucro Real</option>
                  <option value="2">2 - Lucro Presumido</option>
                  <option value="3">3 - Simples Nacional</option>
                  <option value="4">4 - Imune / Isenta</option>
                  <option value="8">8 - MEI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Periodo Apuracao IRPJ</label>
                <select value={regimeForm.periodoApuracaoIRPJ}
                  onChange={e => setRegimeForm(p => ({...p, periodoApuracaoIRPJ: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="A">A - Anual</option>
                  <option value="T">T - Trimestral</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRegimeModal(false)} type="button"
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
              <button
                disabled={savingRegime || !regimeForm.dtIni || !regimeForm.dtFin}
                onClick={async () => {
                  setSavingRegime(true);
                  try {
                    await api.post('/companies/' + id + '/tax-regimes', regimeForm);
                    const { data } = await api.get('/companies/' + id + '/tax-regimes');
                    setRegimes(data || []);
                    setShowRegimeModal(false);
                    setRegimeForm({ dtIni: '', dtFin: '', formaTributacao: '2', periodoApuracaoIRPJ: 'A' });
                  } catch(e: any) {
                    alert(e?.response?.data?.message || 'Erro ao salvar.');
                  }
                  setSavingRegime(false);
                }}
                className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50">
                {savingRegime ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
