// src/pages/companies/CompanyEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import SearchRFBButton from '../../components/SearchRFBButton';

const inputCls = 'w-full p-2.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelCls = 'block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1';

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

function SectionTitle({ title, color }: { title: string; color: string }) {
  return (
    <div className="col-span-full border-b border-gray-100 pb-2 mb-2 mt-6 flex items-center gap-2">
      <span className={`w-1 h-4 ${color} rounded-full`} />
      <h3 className={`text-[11px] font-black ${color.replace('bg-', 'text-')} uppercase tracking-widest`}>
        {title}
      </h3>
    </div>
  );
}

export const CompanyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    api.get(`/companies/${id}`)
      .then(({ data }) => setFormData(data))
      .catch(err => { toast.error('Erro ao carregar dados da empresa.'); console.error(err); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let v: any = value;
    if (type === 'checkbox') v = (e.target as HTMLInputElement).checked;
    else if (name === 'equity') v = value === '' ? 0 : parseFloat(value);
    setFormData((prev: any) => ({ ...prev, [name]: v }));
  };

  const handleRFBData = (dados: any) => {
    setFormData((prev: any) => ({
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
      equity: dados.capitalSocial || prev.equity,
      legalNature: dados.naturezaJuridica || prev.legalNature,
      size: dados.porte || prev.size,
      taxRegime: dados.regimeTributario || prev.taxRegime,
      status: dados.situacao || prev.status,
      statusDate: dados.dataSituacao || prev.statusDate,
      partners: dados.qsa || prev.partners,
      registerOrg: '',
      registerNumber: '',
      registerDate: '',
      registerBook: '',
      registerSheet: '',
      mainActivity: dados.cnaes?.find((c: any) => c.principal)?.codigo || prev.mainActivity,
    }));
    toast.success('Dados da RFB carregados! Revise e salve.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.openingDate) delete payload.openingDate;
      if (!payload.statusDate) delete payload.statusDate;
      if (!payload.registerDate) delete payload.registerDate;
      payload.equity = Number(payload.equity) || 0;
      // Garante null em campos vazios de registro
      ['registerOrg', 'registerNumber', 'registerBook', 'registerSheet', 'registerUF'].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });

      await api.patch(`/companies/${id}`, payload);
      toast.success('Empresa atualizada com sucesso!');
      navigate(`/app/companies/show/${id}`);
    } catch (err) {
      toast.error('Erro ao salvar. Verifique os campos obrigatórios.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-pulse font-black text-blue-600 uppercase tracking-widest">Carregando formulário…</div>
    </div>
  );

  const isCartorio = formData.registerOrg === 'Cartório';
  const isJunta = formData.registerOrg === 'Junta Comercial';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <form onSubmit={handleSave} className="max-w-5xl mx-auto space-y-6">

        {/* ── HEADER ────────────────────────────────────────── */}
        <div className="bg-white p-5 rounded-xl shadow-sm flex justify-between items-center border border-gray-200">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Editando Empresa</p>
            <h1 className="text-xl font-black text-gray-800 tracking-tight">
              {formData.legalName || formData.taxId || 'Novo Registro'}
            </h1>
          </div>
          <div className="flex gap-3 items-center">
            <SearchRFBButton
              cnpj={formData.taxId || ''}
              onDadosRecebidos={handleRFBData}
            />
            <button type="button" onClick={() => navigate(-1)}
              className="px-4 py-2 text-gray-400 font-bold text-xs uppercase hover:text-red-500 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-black text-xs uppercase
                         hover:bg-blue-700 disabled:bg-blue-300 transition">
              {saving ? 'Gravando…' : 'Gravar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 bg-white p-8 rounded-xl shadow-sm border border-gray-200">

          {/* ── IDENTIFICAÇÃO ─────────────────────────────── */}
          <SectionTitle title="Identificação Jurídica" color="bg-blue-600" />

          <div className="md:col-span-3">
            <label className={labelCls}>Razão Social</label>
            <input name="legalName" value={formData.legalName || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CNPJ</label>
            <input value={formData.taxId || ''} readOnly
              className="w-full p-2.5 text-sm border border-gray-100 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Nome Fantasia</label>
            <input name="tradeName" value={formData.tradeName || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Data de Abertura</label>
            <input type="date" name="openingDate"
              value={formData.openingDate ? formData.openingDate.split('T')[0] : ''}
              onChange={handleChange} className={inputCls} />
          </div>
          <div className="flex items-center pl-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" name="isHeadquarter"
                checked={formData.isHeadquarter || false} onChange={handleChange}
                className="w-5 h-5 rounded text-blue-600 border-gray-300" />
              <span className="text-[10px] font-black text-gray-500 uppercase group-hover:text-blue-600">
                Unidade Matriz
              </span>
            </label>
          </div>

          {/* ── REGISTRO INSTITUCIONAL ────────────────────── */}
          <SectionTitle title="Registro Institucional" color="bg-purple-600" />

          {/* Linha única: Órgão [UF] Número Data [Livro Folha] */}
          <div className="md:col-span-4 flex flex-wrap gap-3 items-end">
            {/* Órgão */}
            <div className="flex-shrink-0">
              <label className={labelCls}>Órgão de Registro</label>
              <select name="registerOrg" value={formData.registerOrg || ''}
                onChange={handleChange} className={inputCls + ' bg-white w-44'}>
                {ORG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* UF — só Junta Comercial */}
            {isJunta && (
              <div className="flex-shrink-0">
                <label className={labelCls}>UF</label>
                <select name="registerUF" value={formData.registerUF || ''}
                  onChange={handleChange} className={inputCls + ' bg-white w-20'}>
                  <option value="">UF</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            )}

            {/* Número / NIRE */}
            <div className="flex-1 min-w-[140px]">
              <label className={labelCls}>{isJunta ? 'NIRE' : 'Número'}</label>
              <input name="registerNumber" value={formData.registerNumber || ''}
                onChange={handleChange}
                placeholder={isJunta ? 'Ex: 35300xxxxxx' : 'Número do registro'}
                className={inputCls} />
            </div>

            {/* Data */}
            <div className="flex-shrink-0">
              <label className={labelCls}>Data do Registro</label>
              <input type="date" name="registerDate"
                value={formData.registerDate ? formData.registerDate.split('T')[0] : ''}
                onChange={handleChange} className={inputCls + ' w-40'} />
            </div>

            {/* Livro e Folha — só Cartório */}
            {isCartorio && (
              <>
                <div className="flex-shrink-0">
                  <label className={labelCls}>Livro</label>
                  <input name="registerBook" value={formData.registerBook || ''}
                    onChange={handleChange} placeholder="Ex: A-3"
                    className={inputCls + ' w-24'} />
                </div>
                <div className="flex-shrink-0">
                  <label className={labelCls}>Folha</label>
                  <input name="registerSheet" value={formData.registerSheet || ''}
                    onChange={handleChange} placeholder="45"
                    className={inputCls + ' w-20'} />
                </div>
              </>
            )}
          </div>

          {/* ── ATIVIDADE ECONÔMICA ───────────────────────── */}
          <SectionTitle title="Atividade Econômica (CNAE)" color="bg-purple-600" />
          <div className="md:col-span-4">
            <label className={labelCls}>CNAE Principal</label>
            <input name="mainActivity" value={formData.mainActivity || ''}
              onChange={handleChange}
              placeholder="Ex: 6201-5/01 - Desenvolvimento de programas de computador"
              className={inputCls} />
          </div>

          {/* ── ENDEREÇO ──────────────────────────────────── */}
          <SectionTitle title="Endereço e Localização" color="bg-orange-500" />

          <div className="md:col-span-3">
            <label className={labelCls}>Logradouro</label>
            <input name="street" value={formData.street || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Número</label>
            <input name="number" value={formData.number || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Complemento</label>
            <input name="complement" value={formData.complement || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Bairro</label>
            <input name="neighborhood" value={formData.neighborhood || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input name="city" value={formData.city || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>UF</label>
            <input name="state" value={formData.state || ''} onChange={handleChange} maxLength={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CEP</label>
            <input name="zipCode" value={formData.zipCode || ''} onChange={handleChange} className={inputCls} />
          </div>

          {/* ── FISCAL E CONTATO ──────────────────────────── */}
          <SectionTitle title="Dados Fiscais e Contato" color="bg-green-600" />

          <div>
            <label className={labelCls}>Capital Social</label>
            <input name="equity" type="number" step="0.01"
              value={formData.equity || 0} onChange={handleChange}
              className={inputCls + ' font-bold text-green-700'} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Natureza Jurídica</label>
            <input name="legalNature" value={formData.legalNature || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Regime Tributário</label>
            <select name="taxRegime" value={formData.taxRegime || ''} onChange={handleChange}
              className={inputCls + ' bg-white'}>
              <option value="">Selecione…</option>
              <option value="Simples Nacional">Simples Nacional</option>
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="Lucro Real">Lucro Real</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>E-mail Corporativo</label>
            <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefone 1</label>
            <input name="phone1" value={formData.phone1 || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefone 2</label>
            <input name="phone2" value={formData.phone2 || ''} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status no Sistema</label>
            <select name="status" value={formData.status || 'active'} onChange={handleChange}
              className={`${inputCls} bg-white font-bold ${formData.status === 'active' ? 'text-blue-600' : 'text-red-600'}`}>
              <option value="active">ATIVA</option>
              <option value="inactive">INATIVA</option>
              <option value="suspended">SUSPENSA</option>
            </select>
          </div>

        </div>
      </form>
    </div>
  );
};