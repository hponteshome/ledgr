// src/pages/companies/CompanyForm.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchRFBButton from '../../components/SearchRFBButton';

interface CompanyFormData {
  taxId: string;
  legalName: string;
  tradeName: string;
  openingDate: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  state: string;
  city: string;
  email: string;
  phone1: string;
  phone2: string;
  equity: string;
  legalNature: string;
  size: string;
  taxRegime: string;
  status: string;
  statusDate: string;
  partners: any[];
  cnaes: any[];
  // Registro Institucional
  registerOrg: string;
  registerNumber: string;
  registerDate: string;
  registerBook: string;
  registerSheet: string;
  registerUF: string;
}

const EMPTY: CompanyFormData = {
  taxId: '', legalName: '', tradeName: '', openingDate: '',
  zipCode: '', street: '', number: '', complement: '', neighborhood: '', state: '', city: '',
  email: '', phone1: '', phone2: '',
  equity: '', legalNature: '', size: '', taxRegime: '', status: '', statusDate: '',
  partners: [], cnaes: [],
  registerOrg: '', registerNumber: '', registerDate: '', registerBook: '', registerSheet: '', registerUF: '',
};

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

const ORG_OPTIONS = [
  { value: '', label: 'Selecione…' },
  { value: 'Junta Comercial', label: 'Junta Comercial' },
  { value: 'Cartório', label: 'Cartório' },
  { value: 'OAB', label: 'OAB' },
  { value: 'Outro', label: 'Outro' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const CompanyForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialCnpj = new URLSearchParams(location.search).get('cnpj') ?? '';
  const [formData, setFormData] = useState<CompanyFormData>({ ...EMPTY, taxId: initialCnpj });
  const [preenchido, setPreenchido] = useState(false);

  const [loading, setLoading] = useState(false);
  const set = (name: keyof CompanyFormData, value: any) =>
    setFormData(prev => ({ ...prev, [name]: value }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    set(e.target.name as keyof CompanyFormData, e.target.value);
  };

  const preencherDadosRFB = (dados: any) => {
    setFormData(prev => ({
      ...prev,
      taxId: dados.cnpj || prev.taxId,
      legalName: dados.razaoSocial || prev.legalName,
      tradeName: dados.nomeFantasia || prev.tradeName,
      openingDate: dados.dataAbertura || prev.openingDate,
      zipCode: dados.endereco?.cep || prev.zipCode,
      street: dados.endereco?.logradouro || prev.street,
      number: dados.endereco?.numero || prev.number,
      complement: dados.endereco?.complemento || prev.complement,
      neighborhood: dados.endereco?.bairro || prev.neighborhood,
      state: dados.endereco?.uf || prev.state,
      city: dados.endereco?.cidade || dados.endereco?.municipio || prev.city,
      email: dados.contato?.email || prev.email,
      phone1: dados.contato?.telefone1 || prev.phone1,
      phone2: dados.contato?.telefone2 || prev.phone2,
      equity: dados.capitalSocial?.toString() || prev.equity,
      legalNature: dados.naturezaJuridica || prev.legalNature,
      size: dados.porte || prev.size,
      taxRegime: dados.regimeTributario || prev.taxRegime,
      status: dados.situacao?.toString() || prev.status,
      statusDate: dados.dataSituacao || prev.statusDate,
      partners: dados.qsa || prev.partners,
      cnaes: dados.cnaes || prev.cnaes,
    }));
    setPreenchido(true);
    setTimeout(() => setPreenchido(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        taxId: formData.taxId.replace(/\D/g, ''),
        legalName: formData.legalName,
        tradeName: formData.tradeName,
        openingDate: formData.openingDate || null,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        zipCode: formData.zipCode,
        city: formData.city,
        state: formData.state,
        email: formData.email,
        phone1: formData.phone1,
        phone2: formData.phone2,
        equity: Number(formData.equity.replace(/[^0-9.]/g, '')) || 0,
        legalNature: formData.legalNature,
        size: formData.size,
        taxRegime: formData.taxRegime,
        status: 'active',
        statusDate: formData.statusDate || new Date().toISOString().split('T')[0],
        partners: formData.partners,
        cnaes: formData.cnaes,
        // Registro Institucional
        registerOrg: formData.registerOrg ? `${formData.registerOrg}${formData.registerUF ? `/${formData.registerUF}` : ''}` : null,
        registerNumber: formData.registerNumber || null,
        registerDate: formData.registerDate || null,
        registerBook: formData.registerBook || null,
        registerSheet: formData.registerSheet || null,
      };

      const response = await fetch('http://localhost:3000/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('@ledgr:token')}`,
          'x-company-id': JSON.parse(localStorage.getItem('@ledgr:activeCompany') || '{}').id || '',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {

        alert('✅ Empresa cadastrada com sucesso!');
        navigate('/app/companies');
      } else {
        const err = await response.json();
        alert(`Erro: ${err.message || 'Falha ao salvar'}`);
      }
    } catch {
      alert('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const isCartorio = formData.registerOrg === 'Cartório';
  const isJunta = formData.registerOrg === 'Junta Comercial';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Nova Empresa</h1>

      {preenchido && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          ✅ Dados da RFB carregados com sucesso.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── IDENTIFICAÇÃO ─────────────────────────────────── */}
        <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1
                             border-l-4 border-blue-500 pl-3 ml-[-1rem]">
            Identificação
          </legend>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>CNPJ *</label>
              <input name="taxId" value={formData.taxId} onChange={handleChange}
                placeholder="00.000.000/0001-00" required className={inputCls} />
            </div>
            <div className="flex items-end pb-0.5">
              <SearchRFBButton cnpj={formData.taxId} onDadosRecebidos={preencherDadosRFB} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Razão Social *</label>
            <input name="legalName" value={formData.legalName} onChange={handleChange}
              required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome Fantasia</label>
              <input name="tradeName" value={formData.tradeName} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Data de Abertura</label>
              <input type="date" name="openingDate" value={formData.openingDate}
                onChange={handleChange} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* ── REGISTRO INSTITUCIONAL ────────────────────────── */}
        <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1
                             border-l-4 border-purple-500 pl-3 ml-[-1rem]">
            Registro Institucional
          </legend>

          {/* Linha única: Órgão [UF] Número Data [Livro Folha] */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Órgão */}
            <div className="flex-shrink-0">
              <label className={labelCls}>Órgão de Registro</label>
              <select name="registerOrg" value={formData.registerOrg}
                onChange={handleChange} className={inputCls + ' bg-white w-44'}>
                {ORG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* UF — só Junta Comercial */}
            {isJunta && (
              <div className="flex-shrink-0">
                <label className={labelCls}>UF</label>
                <select name="registerUF" value={formData.registerUF}
                  onChange={handleChange} className={inputCls + ' bg-white w-20'}>
                  <option value="">UF</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            )}

            {/* Número / NIRE */}
            <div className="flex-1 min-w-[140px]">
              <label className={labelCls}>{isJunta ? 'NIRE' : 'Número'}</label>
              <input name="registerNumber" value={formData.registerNumber}
                onChange={handleChange}
                placeholder={isJunta ? 'Ex: 35300xxxxxx' : 'Número do registro'}
                className={inputCls} />
            </div>

            {/* Data */}
            <div className="flex-shrink-0">
              <label className={labelCls}>Data do Registro</label>
              <input type="date" name="registerDate" value={formData.registerDate}
                onChange={handleChange} className={inputCls + ' w-40'} />
            </div>

            {/* Livro e Folha — só Cartório */}
            {isCartorio && (
              <>
                <div className="flex-shrink-0">
                  <label className={labelCls}>Livro</label>
                  <input name="registerBook" value={formData.registerBook}
                    onChange={handleChange} placeholder="Ex: A-3"
                    className={inputCls + ' w-24'} />
                </div>
                <div className="flex-shrink-0">
                  <label className={labelCls}>Folha</label>
                  <input name="registerSheet" value={formData.registerSheet}
                    onChange={handleChange} placeholder="45"
                    className={inputCls + ' w-20'} />
                </div>
              </>
            )}
          </div>
        </fieldset>

        {/* ── ENDEREÇO ──────────────────────────────────────── */}
        <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1
                             border-l-4 border-orange-500 pl-3 ml-[-1rem]">
            Endereço
          </legend>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>CEP</label>
              <input name="zipCode" value={formData.zipCode} onChange={handleChange} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Logradouro</label>
              <input name="street" value={formData.street} onChange={handleChange} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Número</label>
              <input name="number" value={formData.number} onChange={handleChange} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Complemento</label>
              <input name="complement" value={formData.complement} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>UF</label>
              <input name="state" value={formData.state} onChange={handleChange} maxLength={2} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cidade</label>
              <input name="city" value={formData.city} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bairro</label>
              <input name="neighborhood" value={formData.neighborhood} onChange={handleChange} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* ── CONTATO ───────────────────────────────────────── */}
        <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1
                             border-l-4 border-teal-500 pl-3 ml-[-1rem]">
            Contato
          </legend>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefone 1</label>
              <input name="phone1" value={formData.phone1} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefone 2</label>
              <input name="phone2" value={formData.phone2} onChange={handleChange} className={inputCls} />
            </div>
          </div>
        </fieldset>

        {/* ── DADOS FISCAIS ─────────────────────────────────── */}
        <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <legend className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1
                             border-l-4 border-green-500 pl-3 ml-[-1rem]">
            Dados Fiscais
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Capital Social</label>
              <input name="equity" value={formData.equity} onChange={handleChange}
                placeholder="R$ 100.000,00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Natureza Jurídica</label>
              <input name="legalNature" value={formData.legalNature} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Porte</label>
              <select name="size" value={formData.size} onChange={handleChange} className={inputCls + ' bg-white'}>
                <option value="">Selecione…</option>
                <option value="MEI">MEI</option>
                <option value="ME">ME</option>
                <option value="EPP">EPP</option>
                <option value="DEMAIS">Demais</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Regime Tributário</label>
              <select name="taxRegime" value={formData.taxRegime} onChange={handleChange} className={inputCls + ' bg-white'}>
                <option value="">Selecione…</option>
                <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                <option value="LUCRO_REAL">Lucro Real</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── AÇÕES ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/app/companies')}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
            {loading ? 'Salvando…' : 'Salvar Empresa'}
          </button>
        </div>
      </form>
    </div>
  );
};

