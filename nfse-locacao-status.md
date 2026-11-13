# NFS-e de locação da LM (Reforma Tributária) - status (06/11/2026)

## Decisões
- Obrigação: LM (Lucro Real, regime regular) emite NFS-e de locação a partir de 01/12/2026 (Ato Conjunto RFB/CGIBS 4/2026). Teste em produção restrita em 11/2026.
- Plataforma: Emissor Nacional (Sefin Nacional, API). NT 007/2026: NFS-e dos novos fatos geradores (99.03 locação) só pelos Emissores Públicos Nacionais, mesmo em município com emissor próprio. SP (SF/DEJUG 23/2026) não admite NFS-e municipal para locação pura. Não integrar NFS-e Paulistana para locação.
- Emissão na baixa do recebimento (IBS/CBS: fato gerador no pagamento, art. 254, III, LC 214). Receita de IRPJ/CSLL/PIS/Cofins continua por competência.
- Rotina universal no LEDGR (qualquer empresa): A1 padrão, A3 opcional via LEDGR Agent. Não mexer nas outras rotinas de NF (Portal do Simples, NFS-e da Pontes Contabilidade).
- Regime tributário sempre lido do histórico (company_tax_regimes) na data do pagamento e confirmado pelo usuário no modal; sem fallback. LM: Presumido até 31/12/2024, Real desde 01/01/2025.
- Nota pelo valor bruto; taxa da imobiliária não deduz.
- Deduções (gAjusteBCLocImoveis): IPTU (01) e condomínio (03) só quando inclusos no aluguel (Bertioga Mare 88/62); redutor social (04) R$ 600/mês por imóvel, só NBS 1.1002.10.00 (residencial).
- Landmark 137-A, 138-A e 139-A: uma nota com 3 gUnidImob.
- Fora do teste: Guarujá (temporada), Las Piedras (exterior), Campos (titularidade), Ecoville (1º aluguel 12/2026).

## Códigos da DPS de locação
- cTribNac 990301; cIndOp 020101; CST 200 / cClassTrib 200027; cNBS 110021000 (residencial) ou 110022000 (não residencial).
- gLocacao obrigatório, pCopropriedade 100; gUnidImob com cCIB de 8 caracteres (7 + DV), inscImobFisc até 30.
- tribMun: tribISSQN 4, tpRetISSQN 1; totTrib: indTotTrib 0; prest sem xNome quando tpEmit = 1; série 00001-49999.
- Endpoint: POST https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse (produção: sefin.nfse.gov.br), JSON { dpsXmlGZipB64 }; Id DPS = "DPS" + cLocEmi(7) + tpInsc(1) + CNPJ(14) + série(5) + nDPS(15).
- Em 2026: vBC IBS/CBS = vServ - descIncond - vCalcAjusteBCLocImoveis - vISSQN - vPIS - vCOFINS.

## Leiaute em vigor x NT 009 v1.01 (XSD prod. restrita 20/10/2026, em docs\nfse-xsd-prodrest-20261020)
- indDest dentro de IBSCBS (após tpEnteGov), não na raiz do infDPS (item 2.11 é do release 2). Marcador INDDEST_NO_IBSCBS.
- gUnidImob: com cCIB, o grupo end não entra. Marcador END_SO_SEM_CIB.
- Antes de 01/12/2026: baixar o XSD novo, revalidar com D:\Temp\nfse_validar.ps1 e ajustar os marcadores.

## Teste em produção restrita (06/11/2026)
- Mare88 (A3) e Mare62 (A1): DPS válida no XSD; assinatura A3 (Agent) e A1 (assinarDpsA1 próprio, xml-crypto 6) e mTLS funcionando.
- **Bloqueio: E0084** - CNPJ sem estabelecimento no município emissor conforme cadastros CNPJ e CNC NFS-e. Sede LM confirmada: R. Guilherme Bannitz 126 cj 81, Itaim Bibi, São Paulo (3550308) - cLocEmi correto.
  - Regra E0084: o município emissor deve ser (1) o do endereço do CNPJ, se o município parametrizou a emissão padrão habilitada para contribuintes com endereço nele; ou (2) o do cadastro nacional complementar (CNC). As duas dependem de São Paulo.
  - Ações: teste no Emissor Nacional Web (prod. restrita) com certificado da LM; chamado ao atendimento NFS-e Nacional e à SF/SP citando NT 007; contingência em 01/12: espelho da nota para emissão manual no Emissor Web e registro da chave no LEDGR.

## Outras rotinas e SigningService
- SigningService.signXml (xml-crypto 6.1.2) não passa canonicalizationAlgorithm nem publicCert: falha em qualquer assinatura A1. Usado por nfse-nacional.service.ts e nfse-sp-emissao.service.ts (RPS, lote, cancelamento).
- Em 06/11/2026: nenhum certificado além do A1 da LM (cadastrado hoje) e nenhuma emissão dessas rotinas na base; ou seja, o caminho A1 delas nunca rodou no LEDGR. Corrigir signXml (com teste em cada rotina) quando houver certificado A1 da Pontes / uso dessas rotinas.

## Feito
- B-FA-CIB (commit aa5655b): fixed_assets.cib, ibge_code, nbs_locacao; Sinter.
- Serviço nfse-locacao.service.ts (inclui assinarDpsA1), rotas em fiscal.controller, rota /nfse-nacional/enviar no Agent (A3, aviso TOKEN_A3), EmitirNfseLocacaoModal, link "Corrigir regime tributário" + "Consultar novamente". Agent: scripts\iniciar-agent.ps1, tarefa agendada no logon e protocolo ledgr-agent://. Ainda sem commit.
- Contrato LoftSP reescrito (05/11/2026).

## Pendências
- Botão "Iniciar Agent" no modal (protocolo ledgr-agent://) quando A3 escolhido e Agent offline.
- **Tela de imóveis: alertar falta de CIB** (lista de imóveis e Arquivo Digital > Imóveis; filtro "Sem CIB").
- Inscrição e CIB que faltam: Campos, Conj33, Cotia (duas unidades), Guarujá, PalaysRoyal, Pinhais.
- IPTU mensal do Mare 88 e Mare 62 (dedução 01).
- Conferir no LEDGR: Mare 88, Mare 62 e LoftSP (dia 10 / R$ 8.463).
- Campos de condomínio/IPTU no título a receber; vínculo NfseNacionalEmissao x ArEntry x RentalContract.
- Modal: espaçamento interno e limpeza de DPS PREPARADA não enviadas no histórico.
- Commit da rotina (serviço, controller/module, Agent, modal, schema, migrações 20261106_*).

## Próxima tarefa registrada
- DIMOB da LM: obrigatória (IN RFB 1.115/2010, art. 1º). Entrega até o último dia útil de fevereiro. Verificar entregas anteriores (locação desde 2021) e preparar a do ano-calendário 2026 (fev/2027).
