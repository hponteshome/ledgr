import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConsultaRFBButton from '../../components/ConsultaRFBButton';
import { useEmpresa } from '../../contexts/EmpresaContext';

// Interface 100% fiel ao Schema.prisma + Campos de Apoio
interface EmpresaFormData {
  cnpj: string;
  corporateName: string;      // razaoSocial
  tradeName: string;          // nomeFantasia
  openingDate: string;        // dataAbertura
  zipCode: string;            // cep
  street: string;             // logradouro
  number: string;             // numero
  complement: string;         // complemento
  neighborhood: string;       // bairro
  state: string;              // uf
  city: string;               // municipio
  email: string;
  phoneNumber1: string;       // telefone1
  phoneNumber2: string;       // telefone2
  capitalSocial: string;      // capital_social
  legalNature: string;        // natureza_juridica
  size: string;               // porte
  taxRegime: string;          // regime_tributario
  status: string;             // situacao
  statusDate: string;         // data_situacao
  partners: any[];            // socios (QSA)
}

const normalizarSocios = (dadosBrutos: any): any[] => {
  const lista = dadosBrutos?.partners || dadosBrutos?.socios || dadosBrutos?.qsa || [];
  if (!Array.isArray(lista)) return [];

  return lista.map(socio => ({
    name: (socio.name || socio.nome || socio.nome_socio || socio.nome_social || 'NOME NÃO IDENTIFICADO').toUpperCase(),
    qualification: socio.qualification || socio.qualificacao || socio.qualificacao_socio_descricao || 'Sócio',
    entryDate: socio.entryDate || socio.data_entrada_socio || socio.data_entrada || new Date().toISOString(),
    taxId: socio.taxId || socio.cnpj_cpf_do_socio || socio.cpf_cnpj_socio || ''
  }));
};

export const EmpresaEditar: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { atualizarListaEmpresas } = useEmpresa();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

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
    phoneNumber2: '',
    capitalSocial: '',
    legalNature: '',
    size: '',
    taxRegime: '',
    status: '',
    statusDate: '',
    partners: []
  });

  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        const token = localStorage.getItem('@ledgr:token');
        console.log('🔍 Buscando empresa ID:', id);

        const response = await fetch(`http://localhost:4001/api/v1/empresas/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📦 Dados da empresa recebidos:', data);

          setFormData({
            cnpj: data.cnpj,
            corporateName: data.corporateName || data.razaoSocial,
            tradeName: data.tradeName || data.nomeFantasia || '',
            openingDate: data.openingDate || data.dataAbertura,
            zipCode: data.zipCode || data.cep,
            street: data.street || data.logradouro,
            number: data.number || data.numero,
            complement: data.complement || data.complemento || '',
            neighborhood: data.neighborhood || data.bairro,
            state: data.state || data.uf,
            city: data.city || data.municipio,
            email: data.email || '',
            phoneNumber1: data.phoneNumber1 || data.telefone1 || '',
            phoneNumber2: data.phoneNumber2 || data.telefone2 || '',
            capitalSocial: (data.capitalSocial || data.capital_social)?.toString() || '0',
            legalNature: data.legalNature || data.natureza_juridica,
            size: data.size || data.porte,
            taxRegime: data.taxRegime || data.regime_tributario,
            status: data.status || data.situacao || '',
            statusDate: data.statusDate || data.data_situacao || '',
            partners: data.partners || data.socios || []
          });
        } else {
          alert('Erro ao carregar empresa');
          navigate('/app/empresas');
        }
      } catch (error) {
        console.error('❌ Erro:', error);
        alert('Erro de conexão ao carregar empresa');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEmpresa();
  }, [id, navigate]);

  const preencherDadosRFB = (dados: any) => {
    console.log('📝 Atualizando com dados da RFB:', dados);
    setFormData({
      ...formData,
      corporateName: dados.razaoSocial || formData.corporateName,
      tradeName: dados.nomeFantasia || formData.tradeName,
      openingDate: dados.dataAbertura || formData.openingDate,
      zipCode: dados.endereco?.cep || formData.zipCode,
      street: dados.endereco?.logradouro || formData.street,
      number: dados.endereco?.numero || formData.number,
      complement: dados.endereco?.complemento || formData.complement,
      neighborhood: dados.endereco?.bairro || formData.neighborhood,
      state: dados.endereco?.uf || dados.endereco?.estado?.sigla || formData.state,
      city: dados.endereco?.municipio || formData.city,
      email: dados.contato?.email || formData.email,
      phoneNumber1: dados.contato?.telefone1 || formData.phoneNumber1,
      phoneNumber2: dados.contato?.telefone2 || formData.phoneNumber2,
      capitalSocial: dados.capital_social || formData.capitalSocial,
      legalNature: dados.natureza_juridica || formData.legalNature,
      size: dados.porte || formData.size,
      taxRegime: dados.regime_tributario || formData.taxRegime,
      status: dados.situacao || formData.status,
      statusDate: dados.data_situacao || formData.statusDate,
      partners: normalizarSocios(dados)
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSalvando(true);
      const token = localStorage.getItem('@ledgr:token')?.trim();
      if (!token) { navigate('/login'); return; }

      const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
      const dadosParaEnviar = {
        ...formData,
        cnpj: cnpjLimpo,
        cnpjRaiz: cnpjLimpo.substring(0, 8),
        cnpjFilial: cnpjLimpo.substring(8, 12),
        cnpjDigitos: cnpjLimpo.substring(12, 14),
        capitalSocial: parseFloat(formData.capitalSocial) || 0,
      };

      console.log('📤 Enviando PATCH:', dadosParaEnviar);

      const response = await fetch(`http://localhost:4001/api/v1/empresas/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dadosParaEnviar)
      });

      if (response.ok) {
        await atualizarListaEmpresas();
        alert('✅ Empresa atualizada com sucesso!');
        navigate('/app/empresas');
      } else {
        const erro = await response.json();
        alert(`❌ Erro: ${erro.message || 'Erro ao atualizar'}`);
      }
    } catch (error) {
      console.error('❌ Erro:', error);
      alert('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64 text-gray-600">Carregando dados da empresa...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar Empresa</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CNPJ + Consulta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input name="cnpj" value={formData.cnpj} disabled className="flex-1 px-3 py-2 border rounded-lg bg-gray-100" />
              <ConsultaRFBButton cnpj={formData.cnpj} onDadosRecebidos={preencherDadosRFB} />
            </div>
          </div>
        </div>

        {/* Razão Social */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social <span className="text-red-500">*</span></label>
          <input name="corporateName" value={formData.corporateName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" required />
        </div>

        {/* Nome Fantasia + Abertura */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
            <input name="tradeName" value={formData.tradeName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Abertura</label>
            <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        {/* Endereço Completo */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <input name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
            <input name="street" value={formData.street} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
            <input name="number" value={formData.number} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
            <input name="complement" value={formData.complement} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            <input name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
            <input name="state" value={formData.state} onChange={handleChange} maxLength={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Município</label>
            <input name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        {/* Contato */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone 1</label>
            <input name="phoneNumber1" value={formData.phoneNumber1} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone 2</label>
            <input name="phoneNumber2" value={formData.phoneNumber2} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>

        {/* Dados Fiscais (Mantendo visual e lógica originais) */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Capital Social</label>
            <input name="capitalSocial" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(formData.capitalSocial) || 0)} readOnly className="bg-transparent border-none p-0 text-gray-600 focus:ring-0" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Natureza Jurídica</label>
            <input name="legalNature" value={formData.legalNature} readOnly className="bg-transparent border-none p-0 text-gray-600 focus:ring-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Porte</label>
            <input name="size" value={formData.size || 'NÃO INFORMADO'} readOnly className="bg-transparent border-none p-0 text-gray-600 focus:ring-0" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Regime Tributário</label>
            <input name="taxRegime" value={formData.taxRegime?.replace(/_/g, ' ') || 'NÃO INFORMADO'} readOnly className="bg-transparent border-none p-0 text-gray-600 focus:ring-0" />
          </div>
        </div>

        {/* Situação Cadastral */}
        <div className="flex items-center gap-8 py-2 border-t">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Situação Cadastral</label>
            <input name="status" value={formData.status || 'N/A'} readOnly className="bg-transparent border-none p-0 font-semibold text-gray-600 focus:ring-0" />
          </div>
          <div className="h-8 w-px bg-gray-200 mt-2"></div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-400 uppercase">Data da Situação</label>
            <input value={formData.statusDate ? new Date(formData.statusDate).toLocaleDateString('pt-BR') : '--/--/----'} readOnly className="bg-transparent border-none p-0 font-semibold text-gray-600 focus:ring-0" />
          </div>
        </div>

        {/* Quadro de Sócios (QSA) - Lógica de Depuração Mantida */}
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quadro de Sócios (QSA)</h3>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            {formData.partners && formData.partners.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.partners.map((socio: any, idx: number) => {
                  console.log(`Sócio ${idx}:`, socio);
                  return (
                    <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <p className="font-regular text-blue-900 text-sm uppercase">
                        {socio.name || socio.nome || 'NOME NÃO IDENTIFICADO'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-semibold">Cargo:</span> {socio.qualification || socio.qualificacao || 'Não informado'}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-4">Nenhum sócio encontrado no banco de dados.</p>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <button type="button" onClick={() => navigate('/app/empresas')} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancelar</button>
          <button type="submit" disabled={salvando} className={`px-6 py-2 rounded-lg text-white ${salvando ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};