// frontend/src/help/helpContent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MANUAL DO LEDGR — Conteúdo editável
// Adicione ou edite artigos neste arquivo.
// Estrutura: 'secao/slug': { title, section, intro, content[] }
// content[] é uma lista de blocos: { type, text } | { type, items[] } | { type, rows[] }
// ─────────────────────────────────────────────────────────────────────────────

export type HelpBlock =
  | { type: 'text';    text: string }
  | { type: 'tip';     text: string }
  | { type: 'warning'; text: string }
  | { type: 'list';    items: string[] }
  | { type: 'steps';   items: string[] }
  | { type: 'table';   headers: string[]; rows: string[][] };

export interface HelpArticle {
  title: string;
  section: string;
  intro: string;
  content: HelpBlock[];
  related?: string[];
}

export const helpContent: Record<string, HelpArticle> = {

  // ── PRIMEIROS PASSOS ───────────────────────────────────────────────────────

  'primeiros-passos/bem-vindo': {
    title: 'Bem-vindo ao LEDGR',
    section: 'Primeiros Passos',
    intro: 'O LEDGR é uma plataforma completa de gestão contábil, fiscal e empresarial. Este guia vai ajudá-lo a entender como o sistema funciona e por onde começar.',
    content: [
      { type: 'text', text: 'O LEDGR reúne em um só lugar tudo o que sua empresa precisa: controle financeiro, emissão de notas fiscais, folha de pagamento, documentos societários e muito mais. Você não precisa ser contador para usar — o sistema foi projetado para ser claro e direto.' },
      { type: 'tip', text: 'Dica: use o menu lateral esquerdo para navegar entre os módulos. Clique no nome de um módulo para ver suas opções.' },
      { type: 'list', items: [
        'Visão Geral — resumo da situação financeira da empresa',
        'Contabilidade — registros e relatórios contábeis',
        'Financeiro — contas a pagar, receber e fluxo de caixa',
        'Fiscal — notas fiscais e apuração de impostos',
        'Departamento Pessoal — funcionários, salários e obrigações trabalhistas',
        'Societário — documentos e registros da empresa',
        'Administração — usuários, perfis e configurações do sistema',
      ]},
      { type: 'text', text: 'Cada seção do menu corresponde a uma área da gestão da sua empresa. Você verá apenas as seções que seu perfil de acesso permite visualizar.' },
    ],
    related: ['primeiros-passos/configurar-empresa', 'primeiros-passos/navegar'],
  },

  'primeiros-passos/configurar-empresa': {
    title: 'Configurar sua empresa',
    section: 'Primeiros Passos',
    intro: 'Antes de usar qualquer módulo, é importante que os dados da sua empresa estejam completos e corretos no sistema.',
    content: [
      { type: 'steps', items: [
        'No menu lateral, clique em Administração e depois em Empresas.',
        'Clique na empresa desejada para abrir seus dados.',
        'Verifique se CNPJ, razão social, endereço e regime tributário estão corretos.',
        'Preencha os dados do contador responsável e dos sócios.',
        'Salve as alterações clicando no botão Salvar.',
      ]},
      { type: 'warning', text: 'Atenção: o regime tributário (Lucro Real, Lucro Presumido ou Simples Nacional) afeta diretamente o cálculo de impostos e a geração de obrigações fiscais. Em caso de dúvida, consulte seu contador.' },
      { type: 'tip', text: 'Se sua empresa possui mais de um CNPJ, o LEDGR suporta múltiplas empresas na mesma conta. Use o seletor de empresa no topo da tela para alternar entre elas.' },
    ],
    related: ['primeiros-passos/bem-vindo', 'administracao/usuarios'],
  },

  'primeiros-passos/navegar': {
    title: 'Como navegar pelo sistema',
    section: 'Primeiros Passos',
    intro: 'Conheça os elementos principais da interface do LEDGR e aprenda a se orientar rapidamente.',
    content: [
      { type: 'text', text: 'A tela do LEDGR é dividida em três áreas principais: o menu lateral à esquerda, o cabeçalho no topo e a área de conteúdo no centro.' },
      { type: 'list', items: [
        'Menu lateral — navegação entre módulos. Clique no ícone de menu (☰) para expandir ou recolher.',
        'Cabeçalho — exibe a empresa ativa, data/hora e seu nome de usuário.',
        'Área de conteúdo — onde você realiza as operações do módulo selecionado.',
        'Botão ? — abre a ajuda contextual da página em que você está.',
      ]},
      { type: 'tip', text: 'O menu lateral se organiza em quatro seções: Operacional (uso diário), Empresa (dados cadastrais), Compliance (obrigações legais) e Sistema (configurações).' },
      { type: 'text', text: 'Para trocar de empresa, clique no nome da empresa no cabeçalho e selecione outra da lista. Todas as informações da tela serão atualizadas automaticamente.' },
    ],
    related: ['primeiros-passos/bem-vindo'],
  },

  // ── CONTABILIDADE ──────────────────────────────────────────────────────────

  'contabilidade/plano-de-contas': {
    title: 'Plano de Contas',
    section: 'Contabilidade',
    intro: 'O Plano de Contas é a lista de todas as contas contábeis da empresa, organizadas em grupos. Pense nele como a "categorização" de tudo que entra e sai da empresa.',
    content: [
      { type: 'text', text: 'Cada lançamento contábil precisa ser associado a uma conta do plano. As contas são organizadas em grupos: Ativo, Passivo, Patrimônio Líquido, Receitas e Despesas.' },
      { type: 'tip', text: 'Se você não tem formação contábil, não precisa criar o plano do zero. O LEDGR oferece um plano de contas padrão que pode ser importado e depois ajustado.' },
      { type: 'steps', items: [
        'Acesse Contabilidade → Plano de Contas.',
        'Para importar o plano padrão, clique em Importação → Importar Plano de Contas.',
        'Para adicionar uma conta manualmente, clique em Nova Conta.',
        'Preencha o código, nome e grupo da conta.',
        'Salve. A conta estará disponível para uso nos lançamentos.',
      ]},
      { type: 'warning', text: 'Não exclua contas que já possuem lançamentos vinculados. Isso pode causar inconsistências nos relatórios.' },
    ],
    related: ['contabilidade/lancamentos', 'contabilidade/balancete'],
  },

  'contabilidade/lancamentos': {
    title: 'Lançamentos Contábeis',
    section: 'Contabilidade',
    intro: 'Um lançamento contábil registra uma movimentação financeira ou patrimonial da empresa. Todo lançamento tem pelo menos um débito e um crédito de mesmo valor.',
    content: [
      { type: 'text', text: 'Não se preocupe com os termos técnicos. Na prática, um lançamento é simplesmente um registro de algo que aconteceu na empresa: uma despesa paga, uma receita recebida, uma compra realizada.' },
      { type: 'steps', items: [
        'Acesse Contabilidade → Lançamentos.',
        'Clique em Novo Lançamento.',
        'Informe a data e uma descrição clara do que aconteceu.',
        'Adicione as partidas: selecione a conta, o tipo (débito ou crédito) e o valor.',
        'O sistema verifica automaticamente se débitos e créditos estão equilibrados.',
        'Clique em Salvar.',
      ]},
      { type: 'tip', text: 'O sistema não permite salvar um lançamento com débitos e créditos de valores diferentes. Isso garante que os registros estejam sempre corretos.' },
      { type: 'warning', text: 'Lançamentos em períodos com Fechamento Mensal concluído não podem ser editados. Para alterar, é necessário reabrir o período — consulte seu contador antes de fazer isso.' },
    ],
    related: ['contabilidade/plano-de-contas', 'contabilidade/balancete', 'financeiro/fechamento-mensal'],
  },

  'contabilidade/balancete': {
    title: 'Balancete de Verificação',
    section: 'Contabilidade',
    intro: 'O Balancete mostra o saldo de todas as contas contábeis em um período. É usado para verificar se os registros estão corretos antes de fechar o mês.',
    content: [
      { type: 'text', text: 'O Balancete lista todas as contas com seus saldos iniciais, movimentações do período e saldo final. Se o total de débitos for igual ao total de créditos, os registros estão equilibrados.' },
      { type: 'steps', items: [
        'Acesse Contabilidade → Balancete.',
        'Selecione o período desejado (mês e ano).',
        'O sistema gera automaticamente o balancete com base nos lançamentos.',
        'Use os filtros para ver apenas grupos específicos de contas.',
        'Clique em Exportar para baixar em PDF ou Excel.',
      ]},
      { type: 'tip', text: 'O balancete é calculado em tempo real a partir dos lançamentos. Qualquer alteração nos lançamentos se reflete imediatamente no balancete.' },
    ],
    related: ['contabilidade/lancamentos', 'contabilidade/relatorios'],
  },

  'contabilidade/relatorios': {
    title: 'Relatórios Contábeis',
    section: 'Contabilidade',
    intro: 'Os relatórios contábeis mostram a situação financeira e patrimonial da empresa de forma resumida e estruturada.',
    content: [
      { type: 'list', items: [
        'Diário Geral — todos os lançamentos em ordem cronológica',
        'Razão Analítico — movimentações por conta específica',
        'DRE (Demonstração do Resultado) — receitas e despesas do período, mostrando se houve lucro ou prejuízo',
        'Balanço Patrimonial — fotografia dos bens, dívidas e patrimônio da empresa em uma data',
      ]},
      { type: 'steps', items: [
        'Acesse Contabilidade → Relatórios.',
        'Escolha o relatório desejado.',
        'Selecione o período.',
        'Clique em Gerar.',
        'Use o botão Exportar para baixar em PDF.',
      ]},
      { type: 'tip', text: 'A DRE e o Balanço Patrimonial são os principais relatórios solicitados por bancos, investidores e pela Receita Federal.' },
    ],
    related: ['contabilidade/balancete', 'contabilidade/lancamentos'],
  },

  // ── FINANCEIRO ─────────────────────────────────────────────────────────────

  'financeiro/contas-a-pagar': {
    title: 'Contas a Pagar',
    section: 'Financeiro',
    intro: 'O módulo de Contas a Pagar centraliza todas as obrigações financeiras da empresa: fornecedores, despesas fixas, impostos e qualquer outro valor a ser pago.',
    content: [
      { type: 'steps', items: [
        'Acesse Financeiro → Contas a Pagar.',
        'Clique em Nova Conta a Pagar.',
        'Preencha: fornecedor, descrição, valor, data de vencimento e conta de destino.',
        'Salve. A conta aparecerá na lista com status Em Aberto.',
        'Quando pagar, clique na conta e selecione Registrar Baixa.',
        'Confirme a data e o valor pago.',
      ]},
      { type: 'tip', text: 'Use o filtro de Status para ver rapidamente as contas Vencidas (em vermelho) e separar das que ainda estão no prazo.' },
      { type: 'warning', text: 'Ao registrar a baixa, o sistema gera automaticamente um lançamento contábil. Certifique-se de que a conta contábil associada está correta.' },
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Em Aberto', 'Ainda dentro do prazo de pagamento'],
        ['Vencida', 'Prazo de pagamento ultrapassado'],
        ['Paga', 'Pagamento registrado no sistema'],
        ['Cancelada', 'Conta cancelada, sem efeito financeiro'],
      ]},
    ],
    related: ['financeiro/fechamento-mensal', 'financeiro/importacao-bancaria'],
  },

  'financeiro/fechamento-mensal': {
    title: 'Fechamento Mensal',
    section: 'Financeiro',
    intro: 'O Fechamento Mensal "trava" o período contábil após a conferência, impedindo alterações acidentais em lançamentos já revisados.',
    content: [
      { type: 'text', text: 'Ao fechar um mês, você confirma que todos os lançamentos daquele período foram revisados e estão corretos. Isso é uma boa prática contábil e é exigido para a geração do SPED.' },
      { type: 'steps', items: [
        'Acesse Financeiro → Fechamento Mensal.',
        'Selecione a competência (mês/ano) a ser fechada.',
        'Verifique os itens da checklist: provisões, pró-labore, depreciação, PIS/COFINS, IRPJ/CSLL.',
        'Marque cada item como Conferido após verificação.',
        'Clique em Fechar Período.',
      ]},
      { type: 'warning', text: 'Após o fechamento, nenhum lançamento pode ser criado, editado ou excluído naquele período. Para reabrir, é necessário informar um motivo — e todos os meses posteriores também serão reabertos automaticamente.' },
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Em Aberto', 'Período disponível para lançamentos'],
        ['Em Fechamento', 'Conferência em andamento'],
        ['Fechamento Prévio', 'Mês anterior ainda aberto — fechamento parcial'],
        ['Fechado', 'Período encerrado, sem alterações permitidas'],
        ['Reaberto', 'Período reaberto após solicitação justificada'],
      ]},
    ],
    related: ['contabilidade/lancamentos', 'financeiro/contas-a-pagar'],
  },

  'financeiro/importacao-bancaria': {
    title: 'Importação Bancária',
    section: 'Financeiro',
    intro: 'A importação bancária permite trazer o extrato da sua conta bancária para o LEDGR, facilitando a conferência e a contabilização das movimentações.',
    content: [
      { type: 'text', text: 'O LEDGR aceita extratos dos principais bancos brasileiros: Itaú, Bradesco, Banco do Brasil, Santander, além do formato OFX (padrão universal) e CSV.' },
      { type: 'steps', items: [
        'No seu banco, exporte o extrato do período desejado (formato OFX ou CSV).',
        'No LEDGR, acesse Financeiro → Importação Bancária.',
        'Arraste o arquivo para a área de upload ou clique para selecionar.',
        'O sistema exibirá as transações encontradas para conferência.',
        'Associe cada transação a uma conta contábil ou a uma conta a pagar/receber existente.',
        'Clique em Importar para confirmar.',
      ]},
      { type: 'tip', text: 'O sistema aprende com suas associações anteriores e sugere automaticamente a conta contábil para transações recorrentes.' },
    ],
    related: ['financeiro/contas-a-pagar', 'financeiro/fechamento-mensal'],
  },

  // ── FISCAL ─────────────────────────────────────────────────────────────────

  'fiscal/nfse-sp': {
    title: 'NFS-e São Paulo',
    section: 'Fiscal',
    intro: 'A NFS-e (Nota Fiscal de Serviços Eletrônica) é o documento fiscal obrigatório para empresas prestadoras de serviços em São Paulo. O LEDGR permite importar, emitir e consultar suas notas diretamente.',
    content: [
      { type: 'list', items: [
        'Importar NFS-e — trazer XMLs de notas já emitidas para o sistema',
        'Emissão NFS-e SP — emitir novas notas diretamente pela Prefeitura de SP',
        'Consultar notas recebidas como tomador de serviço',
        'Consultar notas emitidas como prestador',
      ]},
      { type: 'steps', items: [
        'Para importar: acesse Fiscal → NFS-e São Paulo e arraste os arquivos XML.',
        'Para emitir: acesse Fiscal → Emissão NFS-e SP, preencha os dados do tomador e do serviço.',
        'Selecione o certificado digital (A1 ou A3) para assinar a nota.',
        'Clique em Emitir. A nota será enviada à Prefeitura de SP automaticamente.',
      ]},
      { type: 'warning', text: 'Para emitir notas fiscais, é obrigatório ter um certificado digital (e-CNPJ) configurado no sistema. Veja o artigo sobre Certificados Digitais.' },
      { type: 'tip', text: 'A partir de agosto de 2026, notas de locação de imóveis precisam incluir os campos IBS/CBS da Reforma Tributária. O LEDGR já está preparado para isso.' },
    ],
    related: ['fiscal/documentos-fiscais', 'administracao/certificados'],
  },

  'fiscal/nfe': {
    title: 'NF-e (Nota Fiscal de Produtos)',
    section: 'Fiscal',
    intro: 'A NF-e é o documento fiscal para operações com mercadorias e produtos. No LEDGR você pode importar XMLs de NF-e recebidas para controle e contabilização.',
    content: [
      { type: 'steps', items: [
        'Acesse Fiscal → NF-e (Produtos).',
        'Arraste os arquivos XML das notas para a área de upload.',
        'O sistema exibirá um preview com os dados de cada nota: emitente, destinatário, valor, impostos.',
        'Revise e clique em Importar para confirmar.',
        'As notas ficarão disponíveis em Fiscal → Documentos Fiscais.',
      ]},
      { type: 'tip', text: 'O sistema detecta automaticamente se sua empresa é a emitente (saída) ou destinatária (entrada) da nota, com base no CNPJ.' },
      { type: 'warning', text: 'Notas duplicadas são identificadas automaticamente pela chave de 44 dígitos. O sistema não permite importar a mesma nota duas vezes.' },
    ],
    related: ['fiscal/documentos-fiscais', 'fiscal/apuracao'],
  },

  'fiscal/documentos-fiscais': {
    title: 'Documentos Fiscais',
    section: 'Fiscal',
    intro: 'O hub de Documentos Fiscais centraliza todas as notas importadas e emitidas, com filtros e indicadores de situação.',
    content: [
      { type: 'text', text: 'Aqui você encontra todas as NFS-e e NF-e da empresa em um único lugar, com filtros por tipo, competência, status e busca por texto.' },
      { type: 'list', items: [
        'Total de notas no período',
        'Valor total do ISS a recolher',
        'PIS e COFINS apurados',
        'Notas pendentes de integração contábil',
      ]},
      { type: 'steps', items: [
        'Acesse Fiscal → Documentos Fiscais.',
        'Use os filtros de período e tipo para localizar notas específicas.',
        'Clique em Integrar para gerar os lançamentos contábeis de uma nota.',
        'Notas integradas aparecem com o status Verde.',
      ]},
    ],
    related: ['fiscal/nfse-sp', 'fiscal/nfe', 'fiscal/apuracao'],
  },

  'fiscal/apuracao': {
    title: 'Apuração de Impostos',
    section: 'Fiscal',
    intro: 'A apuração calcula automaticamente os impostos devidos pela empresa com base nas notas fiscais do período.',
    content: [
      { type: 'text', text: 'O sistema calcula ISS, PIS, COFINS e outros tributos com base nas notas importadas e nas configurações do regime tributário da empresa.' },
      { type: 'tip', text: 'A apuração é gerada por competência (mês). Certifique-se de importar todas as notas do período antes de apurar.' },
      { type: 'warning', text: 'Os valores apurados são uma referência. Sempre valide com seu contador antes de emitir guias de pagamento.' },
    ],
    related: ['fiscal/documentos-fiscais'],
  },

  // ── DEPARTAMENTO PESSOAL ───────────────────────────────────────────────────

  'dp/funcionarios': {
    title: 'Cadastro de Funcionários',
    section: 'Departamento Pessoal',
    intro: 'Cadastre e gerencie todos os colaboradores da empresa: funcionários CLT, estagiários e prestadores de serviço.',
    content: [
      { type: 'steps', items: [
        'Acesse Departamento Pessoal → Funcionários.',
        'Clique em Novo Funcionário.',
        'Preencha os dados pessoais: nome, CPF, data de nascimento, endereço.',
        'Preencha os dados contratuais: cargo, salário, data de admissão, tipo de vínculo.',
        'Salve. O funcionário estará disponível para cálculos de folha e eSocial.',
      ]},
      { type: 'tip', text: 'Todo funcionário precisa ter um cadastro de Pessoa Física antes do vínculo empregatício. O sistema criará automaticamente se não existir.' },
      { type: 'warning', text: 'Os dados do funcionário são enviados ao eSocial. Certifique-se de que CPF, PIS e demais informações estão corretos antes de salvar.' },
    ],
    related: ['dp/pro-labore', 'dp/esocial'],
  },

  'dp/pro-labore': {
    title: 'Pró-labore',
    section: 'Departamento Pessoal',
    intro: 'O pró-labore é a remuneração dos sócios que trabalham na empresa. O LEDGR calcula automaticamente o INSS e o IRRF devidos.',
    content: [
      { type: 'text', text: 'Diferente do salário de funcionário CLT, o pró-labore é específico para sócios e diretores. Sobre ele incidem INSS e IRRF conforme as tabelas vigentes.' },
      { type: 'steps', items: [
        'Acesse Departamento Pessoal → Pró-labore.',
        'Configure o valor do pró-labore de cada sócio.',
        'O sistema calculará automaticamente INSS e IRRF com base nas tabelas de 2026.',
        'Gere a GPS (guia do INSS) e o DARF (guia do IRRF) para pagamento.',
        'Registre o pagamento para gerar os lançamentos contábeis.',
      ]},
      { type: 'tip', text: 'A tabela do IRRF 2026 (Lei 15.270/2025) tem isenção total para rendimentos até R$ 5.000/mês e redução gradual até R$ 7.350/mês.' },
    ],
    related: ['dp/funcionarios', 'dp/esocial'],
  },

  'dp/rescisao': {
    title: 'Rescisão de Contrato',
    section: 'Departamento Pessoal',
    intro: 'O módulo de rescisão calcula automaticamente todos os valores devidos ao funcionário no desligamento e gera o TRCT (Termo de Rescisão do Contrato de Trabalho).',
    content: [
      { type: 'text', text: 'O cálculo inclui: saldo de salário, aviso prévio, 13º proporcional, férias proporcionais + 1/3, FGTS, multa de 40% e os descontos de INSS e IRRF.' },
      { type: 'steps', items: [
        'Acesse Departamento Pessoal → Funcionários.',
        'Clique no funcionário a ser desligado.',
        'Clique em Registrar Rescisão.',
        'Informe a data de desligamento e o tipo (sem justa causa, com justa causa, pedido de demissão, etc.).',
        'O sistema calculará todos os valores automaticamente.',
        'Revise e clique em Confirmar Rescisão.',
        'Baixe o TRCT e o formulário do Seguro Desemprego em PDF.',
      ]},
      { type: 'warning', text: 'A rescisão também gera o evento S-2299 no eSocial. Certifique-se de que o eSocial está configurado antes de confirmar.' },
    ],
    related: ['dp/funcionarios', 'dp/esocial'],
  },

  'dp/esocial': {
    title: 'eSocial',
    section: 'Departamento Pessoal',
    intro: 'O eSocial é o sistema do governo para unificar o envio de informações trabalhistas, previdenciárias e fiscais dos empregados.',
    content: [
      { type: 'text', text: 'O LEDGR gera automaticamente os eventos do eSocial a partir das informações cadastradas: admissões, alterações contratuais, desligamentos, folha de pagamento e mais.' },
      { type: 'list', items: [
        'S-2200 — Cadastramento inicial do vínculo',
        'S-2206 — Alteração de contrato',
        'S-2299 — Desligamento',
        'S-1200 — Remuneração do trabalhador',
      ]},
      { type: 'tip', text: 'Os eventos são gerados automaticamente pelo sistema quando você realiza as operações (admissão, rescisão, etc.). Você só precisa revisá-los e enviar.' },
    ],
    related: ['dp/funcionarios', 'dp/rescisao'],
  },

  // ── ADMINISTRAÇÃO ──────────────────────────────────────────────────────────

  'administracao/usuarios': {
    title: 'Usuários',
    section: 'Administração',
    intro: 'Gerencie quem tem acesso ao LEDGR, com que nível de permissão e em quais módulos.',
    content: [
      { type: 'steps', items: [
        'Acesse Administração → Usuários.',
        'Clique em Novo Usuário.',
        'Preencha nome, e-mail e selecione o perfil de acesso.',
        'O usuário receberá um e-mail para definir sua senha.',
        'Para desativar um usuário, clique no ícone de lixeira e confirme.',
      ]},
      { type: 'tip', text: 'Um usuário desativado não consegue fazer login, mas seus registros e histórico são preservados no sistema.' },
      { type: 'warning', text: 'Apenas usuários com perfil Administrador Master podem criar, editar ou excluir outros usuários.' },
    ],
    related: ['administracao/perfis', 'administracao/auditoria'],
  },

  'administracao/perfis': {
    title: 'Perfis de Acesso',
    section: 'Administração',
    intro: 'Os perfis definem o que cada usuário pode ver e fazer no sistema. Configure perfis diferentes para contadores, operadores e administradores.',
    content: [
      { type: 'table', headers: ['Perfil', 'Acesso'], rows: [
        ['Administrador Master', 'Acesso total a todas as empresas e módulos'],
        ['Contador', 'Acesso aos módulos contábeis, fiscais e relatórios'],
        ['Operador', 'Acesso restrito, configurável por módulo'],
      ]},
      { type: 'steps', items: [
        'Acesse Administração → Perfis de Acesso.',
        'Clique em Novo Perfil.',
        'Defina o nome do perfil e selecione os módulos permitidos.',
        'Salve e associe o perfil aos usuários desejados.',
      ]},
      { type: 'tip', text: 'Crie perfis específicos para cada função na sua empresa. Assim cada usuário vê apenas o que precisa, sem risco de alterações indevidas.' },
    ],
    related: ['administracao/usuarios'],
  },

  'administracao/auditoria': {
    title: 'Auditoria & Logs',
    section: 'Administração',
    intro: 'O módulo de Auditoria registra automaticamente todas as ações realizadas no sistema: quem fez o quê, quando e em qual registro.',
    content: [
      { type: 'text', text: 'Cada ação importante no LEDGR gera um registro de auditoria com o usuário responsável, a data/hora, o registro afetado e os valores antes e depois da alteração.' },
      { type: 'steps', items: [
        'Acesse Administração → Auditoria & Logs.',
        'Use o filtro de Ação para buscar operações específicas (ex: USER_DELETED, COMPANY_UPDATED).',
        'Use o filtro de Data para restringir o período.',
        'Clique em uma linha para expandir e ver os detalhes da alteração (antes e depois).',
      ]},
      { type: 'list', items: [
        'USER_CREATED — novo usuário criado',
        'USER_UPDATED — dados de usuário alterados',
        'USER_DELETED — usuário excluído',
        'COMPANY_UPDATED — dados da empresa alterados',
        'JOURNAL_CREATE — lançamento contábil criado',
        'AP_PAID — conta a pagar baixada',
        'INTEGRATED — nota fiscal integrada contabilmente',
      ]},
      { type: 'tip', text: 'O log de auditoria não pode ser editado ou excluído — é um registro imutável para fins de compliance e rastreabilidade.' },
    ],
    related: ['administracao/usuarios', 'administracao/perfis'],
  },


  // ── SOCIETÁRIO ────────────────────────────────────────────────────────────

  'societario/estatuto-contrato': {
    title: 'Estatuto Social e Contrato Social',
    section: 'Societário',
    intro: 'O Estatuto Social (para S/A) e o Contrato Social (para Ltda) são os documentos fundamentais da empresa, definindo seu objeto, capital e regras de funcionamento.',
    content: [
      { type: 'text', text: 'No LEDGR, esses documentos são gerados automaticamente a partir dos dados cadastrados na empresa — sócios, capital social, objeto social e endereço. Não é necessário digitar o texto do zero.' },
      { type: 'steps', items: [
        'Acesse Societário no menu lateral.',
        'Clique em Estatuto Social ou Contrato Social.',
        'Revise os dados pré-preenchidos — razão social, CNPJ, sócios, capital.',
        'Preencha o objeto social da empresa (o que a empresa faz).',
        'Clique em Gerar Documento.',
        'O PDF será criado e ficará disponível para download e assinatura.',
      ]},
      { type: 'tip', text: 'O documento gerado recebe um código de integridade (hash SHA-256) que garante que ele não foi alterado após a geração. Esse código aparece no rodapé do PDF.' },
      { type: 'warning', text: 'Para registro na Junta Comercial (JUCESP), o documento precisa ser assinado digitalmente com certificado e-CNPJ (ICP-Brasil). Use o módulo Assinaturas para isso.' },
    ],
    related: ['societario/socios', 'societario/livros', 'administracao/certificados'],
  },

  'societario/socios': {
    title: 'Sócios e Quadro Societário (QSA)',
    section: 'Societário',
    intro: 'O Quadro de Sócios e Administradores (QSA) registra quem são os donos da empresa, suas participações e seus papéis na administração.',
    content: [
      { type: 'steps', items: [
        'Acesse Societário no menu lateral.',
        'Clique em Apresentação Institucional ou nos dados da empresa.',
        'Localize a seção Quadro Societário.',
        'Clique em Adicionar Sócio.',
        'Preencha CPF/CNPJ, nome, participação (%) e papel (Sócio, Administrador, Diretor).',
        'Salve. O QSA será atualizado automaticamente nos documentos gerados.',
      ]},
      { type: 'tip', text: 'A participação total dos sócios deve somar exatamente 100%. O sistema alertará se houver divergência.' },
      { type: 'warning', text: 'Alterações no quadro societário precisam ser formalizadas em Ata de Reunião ou Assembleia e registradas na Junta Comercial. O LEDGR gera os documentos mas não faz o protocolo automático.' },
    ],
    related: ['societario/estatuto-contrato', 'societario/livros'],
  },

  'societario/livros': {
    title: 'Livros e Registros Societários',
    section: 'Societário',
    intro: 'Os livros societários registram formalmente os atos da empresa: transferências de cotas/ações, assembleias e reuniões de sócios.',
    content: [
      { type: 'list', items: [
        'Livro de Acionistas e Participações — registro de quem possui cotas ou ações',
        'Livro de Transferências — histórico de compra e venda de participações',
        'Atas de AGO/AGE — registros das assembleias gerais ordinárias e extraordinárias',
        'Livro de Presença — controle de participação nas assembleias',
      ]},
      { type: 'text', text: 'Desde setembro de 2025, a JUCESP autentica livros societários exclusivamente em formato digital (PDF/A com assinatura ICP-Brasil). O LEDGR gera os livros nesse formato.' },
      { type: 'tip', text: 'Livros encerrados ficam arquivados em Acervo → Societário, acessíveis para consulta a qualquer momento.' },
    ],
    related: ['societario/estatuto-contrato', 'societario/socios'],
  },

  // ── PATRIMÔNIO ─────────────────────────────────────────────────────────────

  'patrimonio/cadastro': {
    title: 'Cadastro de Bens',
    section: 'Patrimônio',
    intro: 'O módulo de Patrimônio controla todos os bens da empresa: imóveis, veículos, equipamentos, móveis e outros ativos imobilizados.',
    content: [
      { type: 'text', text: 'Cada bem cadastrado tem um código interno, descrição, valor de aquisição, data de compra e vida útil estimada. Essas informações são usadas para calcular a depreciação automaticamente.' },
      { type: 'steps', items: [
        'Acesse Patrimônio no menu lateral.',
        'Clique em Novo Bem (ou acesse Manutenções para ordens de serviço).',
        'Preencha: código, descrição, grupo (imóvel, veículo, equipamento), valor e data de aquisição.',
        'Defina a vida útil em meses (ex: 240 meses para imóveis, 60 para veículos).',
        'Salve. O bem começará a depreciar a partir do mês seguinte.',
      ]},
      { type: 'tip', text: 'Terrenos e obras em andamento não depreciam. Marque a opção "Não depreciável" ao cadastrar esses bens.' },
      { type: 'warning', text: 'Para a empresa LM, os imóveis para locação ficam no grupo REAL_ESTATE. A partir de agosto de 2026, cada imóvel precisará ter o CIB (Cadastro Imobiliário Brasileiro) para emissão de NFS-e de locação.' },
    ],
    related: ['patrimonio/manutencoes', 'patrimonio/depreciacao'],
  },

  'patrimonio/manutencoes': {
    title: 'Ordens de Serviço e Manutenções',
    section: 'Patrimônio',
    intro: 'Registre e acompanhe todas as manutenções realizadas nos bens da empresa: reparos, revisões, retrofits e avaliações.',
    content: [
      { type: 'steps', items: [
        'Acesse Patrimônio → Manutenções.',
        'Clique em + Nova OS.',
        'Selecione o bem, defina o título e tipo (preventiva, corretiva, retrofit).',
        'Informe a data prevista e o valor orçado.',
        'Salve com status Agendada.',
        'Ao concluir, atualize o status para Concluída e registre o valor real gasto.',
      ]},
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Agendada', 'Manutenção programada, ainda não iniciada'],
        ['Em Andamento', 'Manutenção em execução'],
        ['Concluída', 'Manutenção finalizada e registrada'],
        ['Cancelada', 'Manutenção cancelada sem execução'],
      ]},
      { type: 'tip', text: 'O histórico de manutenções de cada bem fica registrado permanentemente, útil para auditorias e avaliações patrimoniais.' },
    ],
    related: ['patrimonio/cadastro'],
  },

  'patrimonio/depreciacao': {
    title: 'Depreciação de Bens',
    section: 'Patrimônio',
    intro: 'A depreciação registra a perda de valor dos bens ao longo do tempo, impactando o resultado contábil da empresa.',
    content: [
      { type: 'text', text: 'O LEDGR calcula a depreciação pelo método linear: o valor do bem é dividido pela vida útil em meses, gerando uma parcela mensal constante.' },
      { type: 'table', headers: ['Tipo de bem', 'Vida útil típica'], rows: [
        ['Imóveis (construção)', '480 meses (40 anos)'],
        ['Veículos', '60 meses (5 anos)'],
        ['Equipamentos de TI', '60 meses (5 anos)'],
        ['Móveis e utensílios', '120 meses (10 anos)'],
        ['Terrenos', 'Não deprecia'],
      ]},
      { type: 'tip', text: 'A depreciação é lançada automaticamente no Fechamento Mensal. Confira o item "Depreciação" na checklist do fechamento.' },
    ],
    related: ['patrimonio/cadastro', 'financeiro/fechamento-mensal'],
  },

  // ── SPED / OBRIGAÇÕES ──────────────────────────────────────────────────────

  'sped/ecd': {
    title: 'ECD — Escrituração Contábil Digital',
    section: 'SPED / Obrigações',
    intro: 'A ECD é a obrigação anual de enviar os livros contábeis da empresa à Receita Federal em formato digital. Substitui os livros Diário e Razão em papel.',
    content: [
      { type: 'text', text: 'O LEDGR gera o arquivo ECD automaticamente a partir dos lançamentos contábeis do ano. O arquivo segue o leiaute exigido pelo SPED Contábil.' },
      { type: 'steps', items: [
        'Certifique-se de que todos os lançamentos do ano estão corretos e o período está fechado.',
        'Configure as Visões Contábeis (mapeamento das contas para os grupos da Receita Federal).',
        'Acesse SPED / Obrigações → ECD — Pré-Validação para verificar erros antes de gerar.',
        'Corrija os erros apontados (dados de cadastro, mapeamento de contas).',
        'Acesse ECD — Escrituração Contábil e clique em Gerar ECD.',
        'Baixe o arquivo .txt e valide no programa PVA do SPED Contábil.',
        'Após validação sem erros críticos, assine e transmita pelo próprio PVA.',
      ]},
      { type: 'warning', text: 'Erros de mapeamento (Visões Contábeis) são de responsabilidade do contador — não são bugs do sistema. O LEDGR indica quais contas precisam ser mapeadas.' },
      { type: 'tip', text: 'O prazo de entrega da ECD é 31 de maio do ano seguinte ao ano-base. Ex: ECD 2025 deve ser entregue até 31/05/2026.' },
    ],
    related: ['sped/efd', 'contabilidade/lancamentos', 'contabilidade/relatorios'],
  },

  'sped/efd': {
    title: 'EFD-Contribuições (PIS/COFINS)',
    section: 'SPED / Obrigações',
    intro: 'A EFD-Contribuições é a obrigação mensal de informar à Receita Federal os valores de PIS e COFINS apurados pela empresa.',
    content: [
      { type: 'text', text: 'O LEDGR gera a EFD-Contribuições com base nas notas fiscais importadas e nas configurações do regime tributário da empresa (cumulativo ou não-cumulativo).' },
      { type: 'steps', items: [
        'Importe todas as notas fiscais do período (NFS-e e NF-e).',
        'Acesse SPED / Obrigações → EFD-Contribuições.',
        'Selecione a competência (mês/ano).',
        'Clique em Gerar EFD.',
        'Valide no PVA EFD-Contribuições da Receita Federal.',
        'Transmita pelo PVA após validação.',
      ]},
      { type: 'tip', text: 'Empresas do Simples Nacional não entregam EFD-Contribuições — essa obrigação é exclusiva do Lucro Real e Lucro Presumido.' },
    ],
    related: ['sped/ecd', 'fiscal/apuracao'],
  },

  'sped/obrigacoes': {
    title: 'Calendário de Obrigações Fiscais',
    section: 'SPED / Obrigações',
    intro: 'O LEDGR mantém um calendário automático com todas as obrigações fiscais e trabalhistas da empresa, com alertas de vencimento.',
    content: [
      { type: 'list', items: [
        'FGTS Mensal — até dia 7 do mês seguinte',
        'GPS INSS (pró-labore) — até dia 20 do mês seguinte',
        'DARF PIS/COFINS — até dia 25 do mês seguinte',
        'DAS Simples Nacional — até dia 20 do mês seguinte',
        'DCTFWeb — mensal, após fechamento da folha',
        'ECD — anual, até 31 de maio',
        'ECF — anual, até 31 de julho',
        'DIRF — anual, até último dia útil de fevereiro',
        'RAIS — anual, prazo variável (janeiro-março)',
      ]},
      { type: 'tip', text: 'O Dashboard mostra as obrigações dos próximos 60 dias com indicador de dias restantes. Obrigações vencidas aparecem em vermelho.' },
      { type: 'warning', text: 'Os prazos podem ser alterados pela Receita Federal. Sempre confirme as datas no site oficial da RFB antes do pagamento.' },
    ],
    related: ['sped/ecd', 'sped/efd', 'dp/esocial'],
  },

  // ── ACERVO ─────────────────────────────────────────────────────────────────

  'acervo/introducao': {
    title: 'O que é o Acervo',
    section: 'Acervo',
    intro: 'O Acervo é o repositório histórico de documentos finalizados da empresa — contratos assinados, atas, balancetes aprovados, ECDs transmitidos e mais.',
    content: [
      { type: 'text', text: 'Diferente dos módulos operacionais (onde você cria e edita documentos), o Acervo guarda documentos já concluídos e com valor jurídico. Os arquivos são imutáveis após serem arquivados.' },
      { type: 'list', items: [
        'Acervo Societário — Contratos/Estatutos, Atas assinadas, Procurações, Acordos, Livros encerrados',
        'Acervo Contábil — Balancetes aprovados, ECDs assinados, Demonstrações Financeiras',
        'Acervo Fiscal — ECFs assinados, Obrigações acessórias',
        'Acervo RH / Trabalhista — Contratos de trabalho, Procurações trabalhistas, Acordos coletivos',
      ]},
      { type: 'tip', text: 'Use o Acervo para localizar rapidamente documentos históricos em auditorias, due diligences e processos judiciais.' },
    ],
    related: ['assinaturas/validacao', 'societario/livros'],
  },

  // ── ASSINATURAS ────────────────────────────────────────────────────────────

  'assinaturas/validacao': {
    title: 'Validação de Assinatura Digital',
    section: 'Assinaturas',
    intro: 'Verifique se um documento assinado digitalmente é autêntico e não foi alterado após a assinatura.',
    content: [
      { type: 'text', text: 'Todo documento gerado pelo LEDGR recebe um código de integridade (hash SHA-256). A validação compara o hash do arquivo com o registrado no sistema — se forem iguais, o documento é íntegro.' },
      { type: 'steps', items: [
        'Acesse Assinaturas → Validação de Assinatura.',
        'Faça upload do arquivo PDF a ser validado.',
        'O sistema calculará o hash do arquivo e comparará com o registrado.',
        'Se íntegro: aparecerá "Documento válido" com data e hora da assinatura.',
        'Se alterado: aparecerá "Documento inválido — hash divergente".',
      ]},
      { type: 'tip', text: 'Você também pode validar documentos diretamente pelo serviço gov.br de verificação de assinaturas digitais em validar.iti.gov.br.' },
      { type: 'warning', text: 'Um documento com assinatura válida mas hash divergente indica que o arquivo foi modificado após a assinatura — isso invalida juridicamente o documento.' },
    ],
    related: ['assinaturas/certificados', 'acervo/introducao'],
  },

  'assinaturas/certificados': {
    title: 'Certificados Digitais',
    section: 'Assinaturas',
    intro: 'Os certificados digitais são obrigatórios para assinar documentos com validade jurídica e transmitir obrigações à Receita Federal.',
    content: [
      { type: 'table', headers: ['Tipo', 'Formato', 'Uso principal'], rows: [
        ['e-CPF A1', 'Arquivo .pfx', 'Assinar documentos como pessoa física'],
        ['e-CPF A3', 'Token USB', 'Assinar documentos como pessoa física (mais seguro)'],
        ['e-CNPJ A1', 'Arquivo .pfx', 'Assinar documentos e NFs como empresa'],
        ['e-CNPJ A3', 'Token USB', 'Assinar documentos e NFs como empresa (mais seguro)'],
      ]},
      { type: 'steps', items: [
        'Para A1: acesse Assinaturas → Certificados Digitais, clique em Adicionar, faça upload do .pfx e informe a senha.',
        'Para A3: instale o driver do token no Windows e inicie o LEDGR Agent.',
        'Vincule o certificado à empresa correspondente.',
        'O certificado ficará disponível para assinar documentos e emitir notas fiscais.',
      ]},
      { type: 'warning', text: 'Certificados têm validade de 1 ou 3 anos. O LEDGR alertará quando o certificado estiver próximo do vencimento.' },
      { type: 'tip', text: 'Nunca compartilhe a senha do seu certificado digital. Em caso de comprometimento, revogue imediatamente junto à Autoridade Certificadora.' },
    ],
    related: ['assinaturas/validacao', 'fiscal/nfse-sp'],
  },

  'administracao/certificados': {
    title: 'Certificados Digitais',
    section: 'Assinaturas',
    intro: 'O certificado digital é obrigatório para emitir notas fiscais, assinar documentos e transmitir obrigações ao governo. O LEDGR suporta certificados A1 (arquivo) e A3 (token físico).',
    content: [
      { type: 'table', headers: ['Tipo', 'Formato', 'Onde fica'], rows: [
        ['A1', 'Arquivo .pfx no computador', 'Enviado para o LEDGR e armazenado criptografado'],
        ['A3', 'Token USB ou cartão', 'Permanece no hardware — nunca sai do token'],
      ]},
      { type: 'steps', items: [
        'Para A1: acesse Assinaturas → Certificados Digitais, clique em Adicionar, selecione o arquivo .pfx e informe a senha.',
        'Para A3: instale o driver do token no Windows, inicie o LEDGR Agent (veja instruções abaixo) e o certificado será detectado automaticamente.',
      ]},
      { type: 'tip', text: 'O LEDGR Agent é um programa pequeno que roda em segundo plano no seu computador e permite usar o token A3 com segurança. Para iniciá-lo, abra o terminal e execute: cd apps/agent && npx tsx src/main.ts' },
      { type: 'warning', text: 'Nunca compartilhe sua senha do certificado digital. O LEDGR armazena apenas a parte pública do certificado A3 — a chave privada nunca sai do seu token.' },
    ],
    related: ['fiscal/nfse-sp'],
  },

};

// ── Mapa de ajuda contextual: rota → slug do artigo ──────────────────────────
export const contextualHelp: Record<string, string> = {
  '/app/dashboard':                        'primeiros-passos/bem-vindo',
  '/app/companies':                        'primeiros-passos/configurar-empresa',
  '/app/accounting/accounts':              'contabilidade/plano-de-contas',
  '/app/accounting/journal':               'contabilidade/lancamentos',
  '/app/accounting/trial-balance':         'contabilidade/balancete',
  '/app/accounting/diario':                'contabilidade/relatorios',
  '/app/accounting/razao':                 'contabilidade/relatorios',
  '/app/accounting/dre':                   'contabilidade/relatorios',
  '/app/accounting/balanco':               'contabilidade/relatorios',
  '/app/finance/accounts-payable':         'financeiro/contas-a-pagar',
  '/app/finance/fechamento':               'financeiro/fechamento-mensal',
  '/app/finance/bank-import':              'financeiro/importacao-bancaria',
  '/app/fiscal/nfse-sp':                   'fiscal/nfse-sp',
  '/app/fiscal/nfse-sp-emissao':           'fiscal/nfse-sp',
  '/app/fiscal/nfe':                       'fiscal/nfe',
  '/app/fiscal/documentos-fiscais':        'fiscal/documentos-fiscais',
  '/app/fiscal/apuracao':                  'fiscal/apuracao',
  '/app/hr/employees':                     'dp/funcionarios',
  '/app/hr/pro-labore':                    'dp/pro-labore',
  '/app/hr/esocial':                       'dp/esocial',
  '/app/users':                            'administracao/usuarios',
  '/app/profiles':                         'administracao/perfis',
  '/app/administracao/auditoria':          'administracao/auditoria',
  '/app/assinaturas':                      'assinaturas/certificados',
  '/app/signatures/validate':              'assinaturas/validacao',
  '/app/documents/signatures/certificates': 'assinaturas/certificados',
  '/app/assets':                           'patrimonio/cadastro',
  '/app/assets/maintenances':              'patrimonio/manutencoes',
  '/app/societario':                       'societario/estatuto-contrato',
  '/app/societario/livros':                'societario/livros',
  '/app/arquivo':                          'acervo/introducao',
  '/app/sped/ecd':                         'sped/ecd',
  '/app/sped/efd':                         'sped/efd',
  '/app/sistema/obrigacoes':               'sped/obrigacoes',
};

// ── Índice de seções para a Central de Ajuda ─────────────────────────────────
export const helpSections = [
  {
    title: 'Primeiros Passos',
    icon: 'rocket',
    articles: [
      { slug: 'primeiros-passos/bem-vindo',          title: 'Bem-vindo ao LEDGR' },
      { slug: 'primeiros-passos/configurar-empresa', title: 'Configurar sua empresa' },
      { slug: 'primeiros-passos/navegar',            title: 'Como navegar pelo sistema' },
    ],
  },
  {
    title: 'Contabilidade',
    icon: 'book',
    articles: [
      { slug: 'contabilidade/plano-de-contas', title: 'Plano de Contas' },
      { slug: 'contabilidade/lancamentos',     title: 'Lançamentos Contábeis' },
      { slug: 'contabilidade/balancete',       title: 'Balancete de Verificação' },
      { slug: 'contabilidade/relatorios',      title: 'Relatórios Contábeis' },
    ],
  },
  {
    title: 'Financeiro',
    icon: 'cash',
    articles: [
      { slug: 'financeiro/contas-a-pagar',      title: 'Contas a Pagar' },
      { slug: 'financeiro/fechamento-mensal',   title: 'Fechamento Mensal' },
      { slug: 'financeiro/importacao-bancaria', title: 'Importação Bancária' },
    ],
  },
  {
    title: 'Fiscal',
    icon: 'file-invoice',
    articles: [
      { slug: 'fiscal/nfse-sp',           title: 'NFS-e São Paulo' },
      { slug: 'fiscal/nfe',               title: 'NF-e (Produtos)' },
      { slug: 'fiscal/documentos-fiscais', title: 'Documentos Fiscais' },
      { slug: 'fiscal/apuracao',          title: 'Apuração de Impostos' },
    ],
  },
  {
    title: 'Departamento Pessoal',
    icon: 'users',
    articles: [
      { slug: 'dp/funcionarios', title: 'Cadastro de Funcionários' },
      { slug: 'dp/pro-labore',   title: 'Pró-labore' },
      { slug: 'dp/rescisao',     title: 'Rescisão de Contrato' },
      { slug: 'dp/esocial',      title: 'eSocial' },
    ],
  },
  {
    title: 'Societário',
    icon: 'building',
    articles: [
      { slug: 'societario/estatuto-contrato', title: 'Estatuto Social e Contrato Social' },
      { slug: 'societario/socios',            title: 'Sócios e Quadro Societário (QSA)' },
      { slug: 'societario/livros',            title: 'Livros e Registros Societários' },
    ],
  },
  {
    title: 'Patrimônio',
    icon: 'package',
    articles: [
      { slug: 'patrimonio/cadastro',     title: 'Cadastro de Bens' },
      { slug: 'patrimonio/manutencoes',  title: 'Ordens de Serviço e Manutenções' },
      { slug: 'patrimonio/depreciacao',  title: 'Depreciação de Bens' },
    ],
  },
  {
    title: 'SPED / Obrigações',
    icon: 'database',
    articles: [
      { slug: 'sped/ecd',        title: 'ECD — Escrituração Contábil Digital' },
      { slug: 'sped/efd',        title: 'EFD-Contribuições (PIS/COFINS)' },
      { slug: 'sped/obrigacoes', title: 'Calendário de Obrigações Fiscais' },
    ],
  },
  {
    title: 'Acervo',
    icon: 'archive',
    articles: [
      { slug: 'acervo/introducao', title: 'O que é o Acervo' },
    ],
  },
  {
    title: 'Assinaturas',
    icon: 'shield',
    articles: [
      { slug: 'assinaturas/validacao',    title: 'Validação de Assinatura Digital' },
      { slug: 'assinaturas/certificados', title: 'Certificados Digitais' },
    ],
  },
  {
    title: 'Administração',
    icon: 'settings',
    articles: [
      { slug: 'administracao/usuarios',      title: 'Usuários' },
      { slug: 'administracao/perfis',        title: 'Perfis de Acesso' },
      { slug: 'administracao/auditoria',     title: 'Auditoria & Logs' },
      { slug: 'administracao/certificados',  title: 'Certificados Digitais' },
    ],
  },
];
