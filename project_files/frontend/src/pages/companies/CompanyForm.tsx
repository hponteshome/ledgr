import React, { useState } from 'react';
import ConsultaRFBButton from '../../components/ConsultaRFBButton';

// Interface 100% fiel ao Schema.prisma (English Names)
interface EmpresaFormData {
  cnpj: string;
  corporateName: string;    // antigo razao_social
  tradeName: string;        // antigo nome_fantasia
  openingDate: string;      // antigo data_abertura
  zipCode: string;          // antigo cep
  street: string;           // antigo logradouro
  number: string;           // antigo numero
  complement: string;       // antigo complemento
  neighborhood: string;     // antigo bairro
  state: string;            // antigo uf
  city: string;             // antigo municipio
  email: string;
  phoneNumber1: string;     // antigo telefone1
  capitalSocial: string;    // antigo capital_social
  legalNature: string;      // antigo natureza_juridica
  size: string;             // antigo porte
  taxRegime: string;        // antigo regime_tributario
}

export const EmpresaForm: React.FC = () => {
  const [formData, setFormData] = useState<EmpresaFormData>({
    cnpj: '',
    corporateName: '',
    tradeName: '',
    openingDate: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    state: '',
    city: '',
    email: '',
    phoneNumber1: '',
    capitalSocial: '',
    legalNature: '',
    size: '',
    taxRegime: ''
  });

  const [preenchido, setPreenchido] = useState(false);
  const [loading, setLoading] = useState(false);

  const preencherDadosRFB = (dados: any) => {
    console.log('📝 [DEBUG] Dados Brutos RFB recebidos:', dados);

    setFormData(prev => ({
      ...prev,
      corporateName: dados.razaoSocial || prev.corporateName,
      tradeName: dados.nomeFantasia || prev.tradeName,
      openingDate: dados.dataAbertura || prev.openingDate,
      zipCode: dados.endereco?.cep || prev.zipCode,
      street: dados.endereco?.logradouro || prev.street,
      number: dados.endereco?.numero || prev.number,
      complement: dados.endereco?.complemento || prev.complement,
      neighborhood: dados.endereco?.bairro || prev.neighborhood,
      state: dados.endereco?.uf || dados.endereco?.estado?.sigla || prev.state,
      city: dados.endereco?.municipio || prev.city,
      email: dados.contato?.email || prev.email,
      phoneNumber1: dados.contato?.telefone1 || prev.phoneNumber1,
      capitalSocial: dados.capitalSocial?.toString() || prev.capitalSocial,
      legalNature: dados.naturezaJuridica || prev.legalNature,
      size: dados.porte || prev.size,
      taxRegime: dados.regime_tributario || prev.taxRegime
    }));

    setPreenchido(true);
    setTimeout(() => setPreenchido(false), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const userString = localStorage.getItem('@ledgr:user');
    const user = userString ? JSON.parse(userString) : null;
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');

    // Objeto montado para o novo Schema (UUID para criadoPor)
    const payload = {
      ...formData,
      cnpj: cnpjLimpo,
      capitalSocial: Number(formData.capitalSocial.replace(/[^0-9.]/g, '')) || 0,
      cnpjRaiz: cnpjLimpo.substring(0, 8),
      cnpjFilial: cnpjLimpo.substring(8, 12),
      cnpjDigitos: cnpjLimpo.substring(12, 14),
      createdBy: user?.id, // Mudança para English e UUID
      tradeName: formData.tradeName === '.' ? formData.corporateName : formData.tradeName
    };

    console.log('📤 [DEBUG] Enviando Payload de Cadastro:', payload);

    try {
      const response = await fetch('http://localhost:4001/api/v1/empresas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('@ledgr:token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('✅ Empresa cadastrada com sucesso!');
        // Reset ou Redirect aqui
      } else {
        const errorData = await response.json();
        console.error('❌ [ERRO] Servidor retornou:', errorData);
        alert(`Erro: ${errorData.message || 'Verifique se o ID do usuário é válido.'}`);
      }
    } catch (err) {
      console.error("❌ [ERRO] Falha na conexão com a API", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Nova Empresa</h1>

      {preenchido && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded animate-pulse">
          ✅ Dados da RFB sincronizados!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CNPJ + Consulta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="cnpj"
              value={formData.cnpj}
              onChange={handleChange}
              placeholder="00.000.000/0001-00"
              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <ConsultaRFBButton cnpj={formData.cnpj} onDadosRecebidos={preencherDadosRFB} />
          </div>
        </div>

        {/* Razão Social */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
          <input
            type="text"
            name="corporateName"
            value={formData.corporateName}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        {/* Nome Fantasia + Abertura */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
            <input
              type="text"
              name="tradeName"
              value={formData.tradeName}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Abertura</label>
            <input
              type="date"
              name="openingDate"
              value={formData.openingDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Endereço (Simplificado para o exemplo) */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <input name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <input name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        {/* Selects de Classificação */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porte</label>
            <select name="size" value={formData.size} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Selecione...</option>
              <option value="MEI">MEI</option>
              <option value="ME">ME</option>
              <option value="EPP">EPP</option>
              <option value="DEMAIS">Demais</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributário</label>
            <select name="taxRegime" value={formData.taxRegime} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Selecione...</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button type="button" className="px-4 py-2 text-gray-600">Cancelar</button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? 'Salvando...' : 'Salvar Empresa'}
          </button>
        </div>
      </form>
    </div>
  );
};