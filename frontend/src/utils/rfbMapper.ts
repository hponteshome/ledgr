// src/utils/rfbMapper.ts

/**
 * Mapeia TODOS os dados recebidos da RFB, mesmo os não mapeados no banco
 * e os registra para futura implementação
 */
export const mapRFBData = (data: any) => {
  const mappedData: any = {};

  // 1. Dados básicos (já mapeados)
  mappedData.taxId = data.cnpj || '';
  mappedData.legalName = data.razaoSocial || '';
  mappedData.tradeName = data.nomeFantasia || '';
  mappedData.openingDate = data.dataAbertura || '';
  
  // 2. Endereço
  if (data.endereco) {
    mappedData.zipCode = data.endereco.cep || '';
    mappedData.street = data.endereco.logradouro || '';
    mappedData.number = data.endereco.numero || '';
    mappedData.complement = data.endereco.complemento || '';
    mappedData.neighborhood = data.endereco.bairro || '';
    mappedData.city = data.endereco.cidade || data.endereco.municipio || '';
    mappedData.state = data.endereco.uf || '';
  }

  // 3. Contato
  if (data.contato) {
    mappedData.email = data.contato.email || '';
    mappedData.phone1 = data.contato.telefone1 || '';
    mappedData.phone2 = data.contato.telefone2 || '';
  }

  // 4. Dados financeiros/fiscais
  mappedData.equity = data.capitalSocial?.toString() || '';
  mappedData.legalNature = data.naturezaJuridica || '';
  mappedData.size = data.porte || '';
  mappedData.taxRegime = data.regimeTributario || '';
  mappedData.status = data.situacao || '';
  mappedData.statusDate = data.dataSituacao || '';

  // 5. QSA (Sócios)
  mappedData.partners = (data.qsa || data.socios || []).map((partner: any) => ({
    name: partner.nome || partner.name || '',
    qualification: partner.qualificacao || partner.qualification || '',
    entryDate: partner.dataEntrada || partner.entryDate || '',
    taxId: partner.cpf || partner.cnpj || partner.taxId || '',
    // Guarda dados brutos para referência futura
    rawData: partner
  }));

  // 6. CNAEs (Atividades Econômicas) - NÃO mapeado no banco atual
  if (data.cnaes && data.cnaes.length > 0) {
    mappedData.mainCnae = data.cnaes.find((c: any) => c.principal)?.codigo || data.cnaes[0]?.codigo;
    mappedData.secondaryCnaes = data.cnaes
      .filter((c: any) => !c.principal)
      .map((c: any) => c.codigo);
    
    // LOG para desenvolvimento futuro
    console.log('📋 [RFB] CNAEs encontrados (não mapeados no DB):', {
      main: mappedData.mainCnae,
      secondary: mappedData.secondaryCnaes,
      raw: data.cnaes
    });
  }

  // 7. Outros campos que podem existir
  const extraFields = [
    'enteFederativoResponsavel',
    'capitalSocialFormatado',
    'motivoSituacao',
    'situacaoEspecial',
    'dataSituacaoEspecial',
    'dataRegistro',
    'dataInicioAtividade',
    'dataOpcaoSimples',
    'dataExclusaoSimples',
    'dataOpcaoMei',
    'dataExclusaoMei',
    'correioEletronico',
    'situacaoReceita',
    'dataSituacaoReceita'
  ];

  extraFields.forEach(field => {
    if (data[field] !== undefined) {
      mappedData[`rfb_${field}`] = data[field];
      console.log(`📋 [RFB] Campo extra encontrado: ${field} =`, data[field]);
    }
  });

  // 8. Guarda o payload completo para debug
  mappedData.rfb_raw = data;

  return mappedData;
};

/**
 * Loga todos os campos não mapeados para referência futura
 */
export const logUnmappedFields = (data: any) => {
  const mappedFields = [
    'cnpj', 'razaoSocial', 'nomeFantasia', 'dataAbertura',
    'endereco', 'contato', 'capitalSocial', 'naturezaJuridica',
    'porte', 'regimeTributario', 'situacao', 'dataSituacao',
    'qsa', 'socios', 'cnaes'
  ];

  const unmapped = Object.keys(data).filter(key => !mappedFields.includes(key));
  
  if (unmapped.length > 0) {
    console.log('🔍 [RFB] Campos não mapeados encontrados:', unmapped);
    unmapped.forEach(key => {
      console.log(`   - ${key}:`, data[key]);
    });
  }
};