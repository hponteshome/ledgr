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

  'financeiro/fundo-fixo': {
    title: 'Fundo Fixo / Caixa Pequeno',
    section: 'Financeiro',
    intro: 'O Fundo Fixo controla um caixa pequeno para despesas do dia a dia (material de escritorio, correios, taxas), com saldo alvo, alerta de reposicao e fechamento contabil periodico.',
    content: [
      { type: 'text', text: 'Cada fundo tem um saldo alvo (o valor que ele deveria ter cheio) e um limite de alerta (abaixo do qual o sistema avisa que e hora de repor). O saldo atual e sempre: saldo alvo menos despesas registradas mais reposicoes, descontado o que ja foi fechado.' },
      { type: 'list', items: [
        'Despesa - registra uma saida do caixa (material, transporte, etc.), sempre associada a uma categoria.',
        'Reposicao - registra a entrada de dinheiro que recompoe o fundo ate o saldo alvo.',
        'Abertura - lancamento inicial automatico quando o fundo e criado; nao pode ser editado nem excluido.',
      ]},
      { type: 'steps', items: [
        'Crie o fundo em "+ Novo Fundo": defina nome, saldo alvo e o limite de alerta.',
        'Registre despesas conforme elas acontecem, em "- Registrar Despesa" - categoria, valor, descricao e, se quiser, o comprovante e o fornecedor.',
        'Quando o saldo cair perto do limite (a barra fica amarela ou vermelha), use "+ Repor Fundo" para lancar a reposicao.',
        'Periodicamente, use "Fechar Caixa" para revisar todas as despesas do periodo, associar cada uma a uma conta contabil e gerar o lancamento contabil automaticamente.',
      ]},
      { type: 'warning', text: 'Depois que o caixa e fechado, as despesas daquele periodo ficam marcadas com um cadeado e nao podem mais ser editadas nem excluidas - e um lancamento contabil ja gerado. Se precisar corrigir algo, sera necessario lancar um novo movimento de ajuste.' },
      { type: 'tip', text: 'Ao fechar o caixa, marque "Salvar como conta padrao para cada categoria" - da proxima vez, o sistema ja sugere a conta contabil certa para cada categoria de despesa, agilizando o fechamento seguinte.' },
      { type: 'table', headers: ['Cor da barra', 'Significado'], rows: [
        ['Verde', 'Saldo acima de 40% do alvo - situacao normal'],
        ['Amarelo', 'Saldo entre 20% e 40% do alvo - considere repor em breve'],
        ['Vermelho', 'Saldo abaixo de 20% do alvo - reposicao recomendada'],
      ]},
    ],
    related: ['financeiro/fechamento-mensal', 'financeiro/contas-a-pagar'],
  },

  'financeiro/fluxo-caixa': {
    title: 'Fluxo de Caixa Gerencial',
    section: 'Financeiro',
    intro: 'O Fluxo de Caixa Gerencial mostra a entrada e saida de dinheiro mes a mes, comparando o que estava previsto (Contas a Pagar e Receber) com o que realmente aconteceu, alem do saldo bancario real importado dos extratos.',
    content: [
      { type: 'text', text: '"Previsto" sao os valores agendados em Contas a Pagar e Contas a Receber - o que deveria acontecer. "Realizado" sao os valores efetivamente pagos ou recebidos. A coluna Acumulado soma o saldo realizado de todos os meses anteriores, mostrando a evolucao do caixa ao longo do tempo.' },
      { type: 'list', items: [
        'Tabela - visao mensal detalhada com todos os valores previstos, realizados e o acumulado.',
        'Grafico - barras comparando previsto x realizado de receitas e despesas, mes a mes.',
        'Bancario - movimentacao real da conta bancaria, vinda dos extratos importados (nao das contas a pagar/receber).',
      ]},
      { type: 'steps', items: [
        'Defina o periodo em "De" e "Ate" (mes e ano).',
        'Para empresas de locacao, selecione um imovel especifico no filtro "Imovel" para ver o fluxo de caixa apenas daquele bem.',
        'Alterne entre Tabela, Grafico e Bancario conforme a analise desejada.',
      ]},
      { type: 'warning', text: 'A aba "Bancario" usa dados dos extratos bancarios importados (Importacao Bancaria), nao das Contas a Pagar/Receber - por isso os valores podem divergir da aba "Tabela" se houver movimentacoes na conta que nao passaram por contas a pagar/receber, ou extratos ainda nao importados para o periodo.' },
      { type: 'tip', text: 'O filtro de "Imovel" so lista bens do grupo Imoveis (Patrimonio) que estao ativos - util para administradoras que querem separar o fluxo de caixa de um imovel especifico do consolidado da empresa.' },
    ],
    related: ['financeiro/importacao-bancaria', 'financeiro/contas-a-pagar'],
  },

  'financeiro/contas-a-receber': {
    title: 'Contas a Receber',
    section: 'Financeiro',
    intro: 'Contas a Receber controla os titulos a receber da empresa (alugueis, honorarios, vendas), do lancamento ate a baixa, com acompanhamento de inadimplencia por faixa de atraso (aging).',
    content: [
      { type: 'text', text: 'Cada titulo passa por um ciclo: Aberto (aguardando vencimento ou pagamento) - Parcial (recebeu parte do valor) - Recebido (baixa total) ou Vencido (passou do vencimento sem baixa). Titulos tambem podem ser Cancelados quando nao serao mais cobrados.' },
      { type: 'list', items: [
        'Manual - lancado diretamente pelo usuario, sem vinculo com outro documento.',
        'NF - gerado a partir de uma nota fiscal emitida.',
        'Aluguel - receita de locacao de imovel, vinculada a um Ativo Imobilizado (Patrimonio).',
        'Recorrente - gerado automaticamente por uma Provisao Recorrente.',
      ]},
      { type: 'steps', items: [
        'Clique em "+ Nova Conta": preencha titulo, origem, vencimento, valor e, se aplicavel, o locatario/cliente e o imovel vinculado.',
        'Quando o pagamento acontecer, clique em "Baixar" na linha do titulo.',
        'Informe o valor recebido, a data, a forma de pagamento e, opcionalmente, uma conta contabil para gerar o lancamento contabil automaticamente.',
        'Confirme - o titulo passa para Parcial (se o valor for menor que o total) ou Recebido (se for o valor completo).',
      ]},
      { type: 'warning', text: 'Para titulos de origem "Aluguel", o numero da Nota Fiscal e obrigatorio no momento da baixa - locacao de imoveis exige emissao de NF por lei, e o sistema nao permite registrar o recebimento sem esse numero.' },
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Aberto', 'Aguardando vencimento ou pagamento'],
        ['Parcial', 'Recebeu parte do valor - falta uma diferenca'],
        ['Recebido', 'Baixa total - valor completo recebido'],
        ['Vencido', 'Passou da data de vencimento sem baixa'],
        ['Cancelado', 'Titulo cancelado, nao sera mais cobrado'],
      ]},
      { type: 'tip', text: 'A aba "Aging" mostra o total em aberto agrupado por faixa de atraso (a vencer, 1-30, 31-60, 61-90, 90+ dias) - util para identificar rapidamente a inadimplencia mais critica.' },
    ],
    related: ['financeiro/fechamento-mensal', 'financeiro/importacao-bancaria'],
  },

  'financeiro/agenda': {
    title: 'Agenda Financeira',
    section: 'Financeiro',
    intro: 'A Agenda Financeira e um calendario de compromissos e vencimentos - pagamentos, obrigacoes fiscais, fechamentos, reunioes e lembretes - com post-its coloridos por tipo.',
    content: [
      { type: 'list', items: [
        'Pagamento - contas e boletos a pagar',
        'Obrigacao Fiscal - impostos e declaracoes com prazo',
        'Fechamento - datas de fechamento contabil/financeiro',
        'Reuniao - compromissos com terceiros',
        'Lembrete - avisos gerais',
        'Outro - qualquer outro compromisso',
      ]},
      { type: 'text', text: 'Alguns eventos sao gerados automaticamente pelo sistema a partir de documentos fiscais (NF-e, NFS-e). Esses eventos aparecem marcados como gerados automaticamente e nao podem ser excluidos manualmente, pois estao vinculados ao documento de origem.' },
      { type: 'steps', items: [
        'Clique em um dia do calendario, ou no botao de novo evento, para criar um compromisso.',
        'Escolha o tipo - a cor do post-it e sugerida automaticamente, mas pode ser trocada.',
        'Preencha titulo, data de vencimento e, se quiser, um valor.',
        'Para compromissos que se repetem, marque "Evento recorrente" e escolha semanal, mensal ou anual - o sistema gera a serie inteira de uma vez.',
        'Quando o evento for cumprido, abra-o e marque "Marcar como pago / liquidado", ou use o atalho no painel lateral de proximos eventos.',
      ]},
      { type: 'table', headers: ['Cor', 'Uso sugerido'], rows: [
        ['Amarelo', 'NF-e / NFS-e'],
        ['Azul', 'Pagamentos fixos'],
        ['Verde', 'Fiscal / Impostos'],
        ['Vermelho', 'Urgente / Vencido'],
        ['Laranja', 'Contas de consumo'],
        ['Roxo', 'Reunioes / Avisos'],
      ]},
      { type: 'tip', text: 'A opcao de marcar como recorrente so aparece na criacao de um evento novo - eventos ja existentes nao podem virar recorrentes depois. Nesse caso, exclua e recrie como recorrente.' },
    ],
    related: ['financeiro/contas-a-pagar', 'financeiro/fechamento-mensal'],
  },

  'financeiro/provisoes': {
    title: 'Provisões Recorrentes',
    section: 'Financeiro',
    intro: 'Provisoes Recorrentes automatiza o lancamento de despesas fixas e periodicas (aluguel, condominio, honorarios, energia) - configura uma vez e gera os lancamentos mes a mes, com controle de NF e credito de PIS/COFINS quando aplicavel.',
    content: [
      { type: 'text', text: 'O modulo funciona em duas etapas: primeiro voce cadastra a Configuracao (a regra recorrente - descricao, valor, periodicidade, conta contabil), depois usa "Gerar lancamentos" informando a competencia (mes/ano) para criar os lancamentos daquele mes a partir de todas as configuracoes ativas.' },
      { type: 'steps', items: [
        'Na aba Configuracoes, clique em "+ Nova provisao" e preencha descricao, tipo, periodicidade, valor e dia de vencimento.',
        'Informe a competencia inicial (e final, se a provisao tiver prazo definido - deixe vazio para indeterminado).',
        'Selecione a Conta Despesa (debito) e a Conta Passivo (credito) para o lancamento contabil.',
        'Na aba Lancamentos, escolha a competencia e clique em "Gerar lancamentos" - o sistema cria um lancamento para cada provisao ativa naquele mes.',
        'Se a provisao exige NF, use "Conferir NF" para registrar o numero (e a chave de acesso, se tiver) quando a nota chegar.',
      ]},
      { type: 'list', items: [
        'Exigir NF para conferencia - o lancamento fica pendente ate a nota fiscal ser conferida.',
        'Dedutivel (LALUR) - marca a despesa como dedutivel na apuracao do IRPJ/CSLL.',
        'Gerar Lancamento Contabil - cria automaticamente o lancamento no Diario ao gerar a competencia.',
        'Gerar Agenda Financeira - cria um evento na Agenda Financeira com o vencimento.',
        'Credita PIS/COFINS - para regime nao-cumulativo, calcula e credita PIS/COFINS/CSLL/IRPJ sobre o valor, exigindo as contas de "a recuperar" de cada tributo.',
      ]},
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Provisionado', 'Lancamento gerado, aguardando NF ou pagamento'],
        ['NF Pendente', 'Provisao exige NF e ela ainda nao foi conferida'],
        ['NF Conferida', 'Nota fiscal ja registrada e conferida'],
        ['Pago', 'Pagamento efetuado'],
        ['Cancelado', 'Lancamento cancelado, nao sera pago'],
      ]},
      { type: 'tip', text: 'Ao informar o CPF/CNPJ do favorecido, o sistema busca automaticamente o cadastro existente. Se nao encontrar, oferece um atalho para cadastrar a pessoa ou empresa sem perder o que ja foi preenchido no formulario.' },
      { type: 'warning', text: '"Excluir" uma configuracao na verdade a inativa, nao apaga o historico - lancamentos ja gerados continuam existindo e visiveis na aba Lancamentos mesmo depois que a configuracao for inativada.' },
    ],
    related: ['financeiro/fechamento-mensal', 'financeiro/contas-a-pagar'],
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

  'fiscal/lalur-config': {
    title: 'Configuração de Dedutibilidade',
    section: 'Fiscal',
    intro: 'Configuração de Dedutibilidade classifica contas do Plano de Contas quanto à dedutibilidade fiscal para fins de LALUR/LACS - usado por empresas no regime Lucro Real para gerar automaticamente sugestões de ajuste (adições e exclusões) na apuração do IRPJ/CSLL.',
    content: [
      { type: 'text', text: 'Toda conta analítica de despesa (ou receita/ativo, conforme o filtro escolhido) pode ser marcada como Dedutível (100%, o padrão - não precisa configurar), Parcialmente Dedutível (informando o percentual dedutível) ou Não Dedutível. Cada configuração também define o tipo de ajuste no LALUR: Adição (soma ao lucro tributável) ou Exclusão (subtrai).' },
      { type: 'steps', items: [
        'Filtre pelo tipo de conta (Despesas, Receitas ou Ativo) e busque por código ou nome.',
        'Clique em "Configurar" na conta desejada.',
        'Escolha a classificação de dedutibilidade. Se for parcial, informe o percentual dedutível.',
        'Escolha o tipo de ajuste LALUR (Adição ou Exclusão) e, opcionalmente, uma descrição padrão que será usada automaticamente nos ajustes gerados.',
        'Clique em Salvar - a conta passa a aparecer na lista de "Contas Configuradas" no topo da tela.',
      ]},
      { type: 'warning', text: 'Essa configuração só tem efeito para empresas no regime Lucro Real - é usada para sugerir automaticamente os ajustes de adição/exclusão na apuração do IRPJ/CSLL (LALUR/LACS). Empresas no Lucro Presumido ou Simples Nacional não usam essa tela.' },
      { type: 'tip', text: 'Só é preciso configurar as contas que são total ou parcialmente NÃO dedutíveis - contas dedutíveis normalmente (100%) não precisam de nenhuma configuração especial.' },
    ],
    related: ['fiscal/apuracao', 'sped/ecd'],
  },

  'fiscal/nfse-nacional': {
    title: 'NFS-e Nacional — Emissor RFB',
    section: 'Fiscal',
    intro: 'NFS-e Nacional emite notas fiscais de serviço diretamente pela API da Receita Federal, incluindo o novo regime de locação de imóveis da Reforma Tributária (IBS/CBS). Obrigatório para Simples Nacional a partir de 01/09/2026.',
    content: [
      { type: 'text', text: 'Para emitir, é necessário ter um certificado digital A1 já cadastrado no sistema e escolher o ambiente: Homologação (testes) ou Produção.' },
      { type: 'warning', text: 'Notas emitidas em ambiente de Homologação NÃO têm validade fiscal - servem só para testar o fluxo. Só mude para Produção quando estiver tudo validado.' },
      { type: 'text', text: 'Locação de imóveis segue uma regra diferente, criada pela Reforma Tributária (NT 007/2026): incide IBS e CBS, NÃO incide ISS, e a base de cálculo tem um redutor de 70% (paga-se sobre 30% do valor). Para esses códigos é obrigatório informar o CIB (Cadastro Imobiliário Brasileiro) e a Inscrição Imobiliária do tomador. As alíquotas de 2026 são simbólicas/de teste (IBS 0,1% + CBS 0,9%); a obrigatoriedade plena entra em 2027.' },
      { type: 'steps', items: [
        'Selecione o certificado digital e o ambiente.',
        'Preencha os dados do tomador (CNPJ/CPF, nome, e-mail).',
        'Escolha o código de serviço (LC 116) - os códigos de Locação ficam num grupo separado, com o aviso da Reforma Tributária.',
        'Descreva o serviço e informe o valor - o sistema calcula automaticamente ISS ou IBS/CBS (conforme o código escolhido) e mostra o preview antes de emitir.',
        'Confirme a emissão. Se autorizada, o número e a chave da NFS-e aparecem na hora; se ficar pendente, acompanhe pela aba Histórico.',
      ]},
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Rascunho', 'Nota criada, ainda não enviada'],
        ['Assinada', 'Assinada digitalmente, aguardando autorização da Receita'],
        ['Autorizada', 'Nota válida, número e chave definitivos'],
        ['Rejeitada', 'A Receita recusou - confira o motivo e reenvie após corrigir'],
        ['Cancelada', 'Nota cancelada (exige motivo informado no momento do cancelamento)'],
      ]},
      { type: 'tip', text: 'Notas Rejeitadas ou já Assinadas podem ser reenviadas pelo botão correspondente no Histórico; notas já Autorizadas só podem ser Canceladas (nunca editadas), informando o motivo do cancelamento.' },
    ],
    related: ['fiscal/nfse-sp', 'fiscal/documentos-fiscais'],
  },

  'fiscal/nfse-sp-csv': {
    title: 'Importação NFS-e SP — CSV PMSP',
    section: 'Fiscal',
    intro: 'Importa em lote as NFS-e emitidas ou recebidas exportadas pelo portal da Prefeitura de São Paulo (nfe.prefeitura.sp.gov.br), gerando automaticamente os lançamentos contábeis e financeiros vinculados.',
    content: [
      { type: 'steps', items: [
        'No portal nfe.prefeitura.sp.gov.br, exporte o CSV de NFS-e Emitidas ou Recebidas do período desejado.',
        'Arraste o arquivo (ou clique para selecionar) e clique em "Validar CSV".',
        'O sistema mostra um preview: quantas notas vão ser importadas, quantas já existem (duplicatas) e quantas estão canceladas - use os filtros para revisar cada grupo antes de confirmar.',
        'Clique em "Importar" - notas duplicadas e canceladas são automaticamente ignoradas, só as válidas entram no sistema.',
      ]},
      { type: 'text', text: 'Cada nota importada é classificada como PRESTADOR (a empresa emitiu a nota, é receita) ou TOMADOR (a empresa recebeu o serviço, é despesa) - o sistema detecta automaticamente pelo CNPJ.' },
      { type: 'warning', text: 'Excluir um lote de importação remove não só as notas, mas também todos os lançamentos contábeis, contas a pagar/receber e eventos de agenda financeira gerados a partir dele - é uma exclusão em cascata, use com cuidado.' },
      { type: 'tip', text: 'O histórico de "Importações anteriores" mostra todos os lotes já importados, com totais de notas, valor e ISS - útil para conferir rapidamente se um período já foi importado antes de repetir.' },
    ],
    related: ['fiscal/nfse-sp', 'fiscal/documentos-fiscais'],
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
    intro: 'Cadastro e controle de usuários do sistema: quem pode entrar, com qual perfil de permissões e em quais horários.',
    content: [
      { type: 'steps', items: [
        'Clique em "New User" e informe o CPF ou CNPJ - o sistema busca automaticamente se já existe um usuário ou uma pessoa cadastrada com esse documento e pré-preenche nome, e-mail e telefone.',
        'Se não encontrar ninguém, o sistema oferece um atalho para cadastrar a pessoa física antes de continuar.',
        'Defina o nickname (nome de usuário para login), a senha e o perfil de acesso.',
        'Escolha o Status: Ativo, Inativo ou Bloqueado.',
        'Se quiser restringir dias e horários de login especificamente para essa pessoa, configure a "Janela de Acesso" no final do formulário.',
      ]},
      { type: 'text', text: 'Por padrão, cada usuário "Herda do Perfil" a janela de acesso (dias e horários permitidos para login) configurada no perfil dele. Escolhendo "Definir Horário Próprio", você cria uma exceção individual: pode restringir a dias/horários específicos, marcar meses de férias com bloqueio total, ou liberar sem nenhuma restrição mesmo que o perfil seja restrito.' },
      { type: 'table', headers: ['Status', 'Efeito'], rows: [
        ['Ativo', 'Login liberado normalmente'],
        ['Inativo', 'Login bloqueado, mas o cadastro e todo o histórico permanecem no sistema'],
        ['Bloqueado', 'Login bloqueado - usado tipicamente após tentativas de acesso suspeitas'],
      ]},
      { type: 'warning', text: '"Excluir" um usuário (ícone de lixeira) é uma exclusão definitiva, diferente de deixá-lo Inativo. Se só quer impedir o login preservando o histórico e os registros vinculados a esse usuário, use o Status "Inativo" em vez de excluir.' },
      { type: 'tip', text: 'O ícone de olho na listagem mostra os detalhes completos do usuário sem precisar entrar no modo de edição, incluindo status do 2FA, último acesso e a janela de acesso configurada.' },
    ],
    related: ['administracao/perfis', 'administracao/permissoes-menu'],
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

  'administracao/permissoes-menu': {
    title: 'Permissões de Menu',
    section: 'Administração',
    intro: 'Permissões de Menu controla o que cada perfil ou usuário pode ver e fazer em cada item do menu do sistema - por padrão (perfil) ou como exceção individual (usuário).',
    content: [
      { type: 'text', text: 'Cada item do menu pode ter um dos quatro níveis de acesso, sempre cumulativos: Nenhum (bloqueado), Visualizar, Editar ou Excluir. Quem tem Excluir automaticamente tem Editar e Visualizar também - não é preciso marcar os três.' },
      { type: 'text', text: 'Existem duas camadas: permissões Por Perfil (o padrão aplicado a todos os usuários daquele perfil) e Por Usuário (exceções individuais que sobrepõem o perfil apenas para aquela pessoa). Configure primeiro os perfis; use "Por Usuário" só quando alguém específico precisar de um acesso diferente do resto do seu perfil.' },
      { type: 'steps', items: [
        'Escolha a aba "Por Perfil" ou "Por Usuário" e selecione quem será configurado.',
        'Para cada item do menu, clique no nível desejado (Nenhum, Visualizar, Editar, Excluir).',
        'Definir um nível num item com submenu aplica automaticamente o mesmo nível a todos os itens abaixo dele - ajuste manualmente os que precisarem ser diferentes depois.',
        'Clique em "Salvar" - as alterações só valem depois de salvas.',
      ]},
      { type: 'warning', text: '"Nenhum" oculta o item do menu e, nos módulos que já têm proteção de API implementada, também bloqueia o acesso direto pela URL ou por chamadas ao backend - não é só uma questão visual. Em módulos sem essa proteção ainda implementada, o bloqueio é apenas do menu.' },
      { type: 'tip', text: 'Marque o checkbox no topo de uma coluna (ex: "Visualizar") para aplicar aquele nível a TODOS os itens do menu de uma vez - útil para configurar rapidamente um perfil amplo, mas sobrescreve qualquer ajuste fino que já existia nessa coluna.' },
    ],
    related: ['administracao/usuarios', 'administracao/perfis'],
  },

  'administracao/backup': {
    title: 'Backup e Restauração',
    section: 'Administração',
    intro: 'Backup e Restauração permite exportar todo o banco de dados do LEDGR em um arquivo JSON, ou restaurar o sistema a partir de um backup anterior. A restauração é uma operação destrutiva e irreversível.',
    content: [
      { type: 'steps', items: [
        'Para gerar um backup, clique em "Generate Backup Now" - o sistema baixa um arquivo .json com data e hora no nome.',
        'Guarde o arquivo em um local seguro, de preferência criptografado.',
      ]},
      { type: 'warning', text: 'O arquivo de backup contém dados sensíveis: hashes de senha de usuários e documentos da empresa. Nunca compartilhe o arquivo por canais inseguros (email, chat) - armazene em volumes criptografados.' },
      { type: 'text', text: 'A restauração substitui permanentemente todo o banco de dados atual pelos dados do arquivo selecionado - não existe desfazer. Antes de restaurar, o sistema pede uma Master Key (uma senha técnica configurada no servidor, não é a senha do seu usuário) e uma confirmação explícita.' },
      { type: 'warning', text: 'A Master Key não é cadastrada pelo usuário - é uma configuração do servidor. Se você não sabe essa chave, a restauração só pode ser feita por quem administra a infraestrutura do sistema.' },
      { type: 'tip', text: 'Use o backup para migração entre ambientes ou arquivamento periódico de segurança - não como rotina de "desfazer" um erro pontual. Para corrigir um erro sem apagar o histórico, prefira um estorno ou consulte a Auditoria.' },
    ],
    related: ['administracao/permissoes-menu', 'administracao/auditoria'],
  },

  'administracao/manutencao-dados': {
    title: 'Manutenção de Dados',
    section: 'Administração',
    intro: 'Manutenção de Dados permite exportar ou importar tabelas individuais do sistema em arquivos de texto (TXT), útil para migrações parciais, correções em massa ou movimentação de dados entre ambientes.',
    content: [
      { type: 'text', text: 'Diferente do Backup e Restauração (que exporta o banco inteiro em JSON), aqui você trabalha tabela por tabela, em arquivos de texto delimitados por ponto e vírgula (;) - útil para corrigir ou migrar apenas um conjunto específico de dados.' },
      { type: 'steps', items: [
        'Para exportar uma única tabela, clique em "Exportar" na linha correspondente - baixa um arquivo .txt.',
        'Para exportar várias de uma vez, marque as tabelas desejadas e clique em "Exportar Selecionadas".',
        'Para importar, clique em "Importar TXT" na tabela desejada e selecione o arquivo - o sistema mostra quantos registros foram inseridos, atualizados ou ignorados (duplicados).',
      ]},
      { type: 'warning', text: 'A importação funciona por Upsert: registros cujo ID já existe no banco são atualizados (sobrescritos), não duplicados. Confira o arquivo antes de importar, especialmente em bases de produção.' },
      { type: 'warning', text: 'Ao importar várias tabelas relacionadas, respeite a ordem recomendada: Perfis → Empresas → Pessoas → Usuários → Vínculos. Importar uma tabela antes de suas dependências pode falhar por referência a um registro que ainda não existe.' },
      { type: 'tip', text: 'Faça um backup completo (em Backup e Restauração) antes de qualquer importação em massa - a importação por Upsert pode sobrescrever dados existentes sem aviso adicional.' },
    ],
    related: ['administracao/backup', 'administracao/auditoria'],
  },

  'parametros/calendario': {
    title: 'Calendário de Feriados',
    section: 'Parâmetros Globais',
    intro: 'O Calendário de Feriados centraliza feriados nacionais, estaduais e municipais, sugere pontes automaticamente e mostra férias e recessos de funcionários no mesmo calendário visual.',
    content: [
      { type: 'steps', items: [
        'Se o ano ainda não tiver feriados cadastrados, clique em "Gerar Calendário [ano]" para importar automaticamente os feriados nacionais.',
        'Para adicionar um feriado manual (estadual ou municipal, por exemplo), clique em "+ Feriado", escolha o tipo e, se aplicável, o estado ou município.',
        'Quando um feriado nacional, estadual ou facultativo cai numa terça ou quinta-feira, o sistema sugere automaticamente a ponte (segunda ou sexta) no calendário - clique na sugestão para confirmar.',
      ]},
      { type: 'text', text: 'Feriados Estaduais aparecem apenas para empresas cadastradas naquele estado; Municipais, apenas para empresas daquele município específico. Marque "Recorrente" para um feriado se repetir automaticamente todos os anos, sem precisar recadastrar.' },
      { type: 'warning', text: 'Confirmar uma ponte sugerida cria um Recesso que se aplica a todos os funcionários da empresa, visível e editável em Departamento Pessoal → Recessos & Pontes - não é só uma marcação visual no calendário.' },
      { type: 'list', items: [
        'Feriado Nacional / Estadual / Municipal - datas oficiais, coloridas por abrangência.',
        'Ponte Sugerida - o sistema identificou uma oportunidade de emenda, ainda não confirmada.',
        'Ponte Registrada - ponte já confirmada, vira Recesso.',
        'Recesso - período de parada coletiva registrado em Departamento Pessoal.',
        'Férias - períodos de férias de funcionários, puxados automaticamente do módulo de RH.',
      ]},
    ],
    related: ['dp/funcionarios'],
  },

  'parametros/indicadores': {
    title: 'Indicadores Econômicos',
    section: 'Parâmetros Globais',
    intro: 'Indicadores Econômicos mantém a série histórica mensal dos principais índices usados em correção monetária e contratos: Selic, IPCA, IGP-M, IGP-DI, INPC, TR e CDI. A atualização é manual - o sistema não busca os valores automaticamente.',
    content: [
      { type: 'text', text: 'Nenhum indicador é atualizado automaticamente - o sistema não busca os valores nas fontes oficiais sozinho. É preciso visitar a fonte periodicamente (mensalmente, após a divulgação oficial) e lançar o valor no LEDGR, um a um ou em lote.' },
      { type: 'steps', items: [
        'Escolha o indicador na aba superior (Selic, IPCA, IGP-M, IGP-DI, INPC, TR ou CDI).',
        'Para lançar um único mês, use "Importar / Adicionar" → "Adicionar registro manual": informe a competência e a taxa mensal em %.',
        'Para lançar vários meses de uma vez, cole os dados na caixa de "Importação em lote", um registro por linha.',
      ]},
      { type: 'text', text: 'O formato aceito na importação em lote é AAAA-MM seguido de tabulação (ou ponto e vírgula) e a taxa mensal em %, um registro por linha - por exemplo "2025-01" + tab + "0,9643". O campo de competência também aceita o formato "jan/25" ou "janeiro/2025": o sistema converte automaticamente.' },
      { type: 'table', headers: ['Indicador', 'Fonte oficial recomendada'], rows: [
        ['Selic / TR', 'Banco Central (BCB) - Sistema Gerenciador de Séries Temporais (SGS)'],
        ['IPCA / INPC', 'IBGE'],
        ['IGP-M / IGP-DI', 'FGV/IBRE'],
        ['CDI', 'BCB - tem tabela própria e dedicada, com layout diferente dos demais'],
      ]},
      { type: 'tip', text: 'As colunas "Acum. Ano" e "Acum. 12m" são calculadas automaticamente pelo sistema a partir dos lançamentos mensais - não precisam ser informadas manualmente.' },
      { type: 'warning', text: 'Os dados cadastrados aqui são usados em cálculos de correção monetária e contratos no sistema todo - um valor errado ou desatualizado se propaga para todos os relatórios que dependem daquele índice. Sempre confira o valor lançado contra a fonte oficial antes de salvar.' },
    ],
    related: ['parametros/calendario'],
  },

  'parametros/tabelas-legais': {
    title: 'Tabelas Legais',
    section: 'Parâmetros Globais',
    intro: 'Tabelas Legais mantém as tabelas oficiais de IRPF, INSS e Salário Mínimo usadas nos cálculos de folha de pagamento e pró-labore do sistema, organizadas por ano de vigência.',
    content: [
      { type: 'text', text: 'As três tabelas alimentam diretamente os cálculos de Folha de Pagamento e Pró-labore do sistema inteiro - qualquer alteração aqui se reflete em todos os cálculos daquele ano de vigência em diante.' },
      { type: 'steps', items: [
        'Escolha a aba (Tabela IRPF, Tabela INSS ou Salário Mínimo) e o ano na barra de anos.',
        'Clique em "Editar [ano]" para ajustar a tabela vigente, ou "+ Novo Ano" para cadastrar um ano ainda não existente.',
        'Preencha as faixas progressivas (limite até, alíquota) - a coluna "Dedução" da tabela INSS é calculada automaticamente pelo sistema a partir dos limites e alíquotas informados, não precisa ser digitada.',
      ]},
      { type: 'text', text: 'O "Redutor Progressivo" da tabela IRPF (Lei 15.270/2025) é opcional - deixe as faixas de redutor vazias se o ano não tiver essa regra. Quando preenchido, um valor de dedução em branco numa faixa significa isenção total naquela faixa de renda.' },
      { type: 'tip', text: 'A aba IRPF inclui um simulador: informe salário bruto, número de dependentes e escolha entre desconto simplificado ou dedução por dependente para ver o INSS, a base de cálculo, o IRRF e o valor líquido resultante, sem precisar rodar uma folha de verdade.' },
      { type: 'warning', text: 'Um valor incorreto nessas tabelas afeta todos os cálculos de folha de pagamento e pró-labore que usarem aquele ano de vigência. Confira sempre contra a tabela oficial publicada pela Receita Federal (IRPF) e pelo INSS antes de salvar.' },
    ],
    related: ['parametros/indicadores', 'dp/funcionarios'],
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
    title: 'Como funciona o Arquivo Digital',
    section: 'Arquivo Digital',
    intro: 'Arquivo Digital é o repositório central de documentos já finalizados da empresa - contratos, atas, livros societários, demonstrações contábeis, documentos fiscais e trabalhistas - organizado em "prateleiras" por tipo. É um arquivo de consulta, não um lugar para criar a maioria dos documentos.',
    content: [
      { type: 'text', text: 'Os documentos são organizados em prateleiras por categoria: Societário (contratos, estatutos, atas, procurações, acordos), Livros Societários (registro/transferência de ações, atas de AGO/AGE), Contábil (balancetes, demonstrações), Fiscal (ECF, obrigações acessórias) e RH/Trabalhista (contratos de trabalho, acordos coletivos). Cada prateleira mostra só os documentos daquele tipo.' },
      { type: 'text', text: 'Documentos chegam ao Arquivo de duas formas: importados manualmente (upload de um PDF já pronto) ou, em alguns fluxos do sistema, arquivados automaticamente quando um documento é finalizado em outro módulo - por exemplo, após um processo de assinatura digital.' },
      { type: 'steps', items: [
        'Clique em "Importar Documento" em qualquer prateleira.',
        'Escolha o tipo exato do documento - o sistema mostra em qual prateleira ele vai ser arquivado antes de você confirmar.',
        'Selecione o arquivo PDF, preencha título e data do documento.',
        'Marque "Validar assinatura digital ao importar" se o PDF já tiver assinatura eletrônica - o sistema detecta e confirma automaticamente.',
        'Envie - o documento fica disponível para consulta, download e validação de assinatura a qualquer momento.',
      ]},
      { type: 'table', headers: ['Status', 'Significado'], rows: [
        ['Rascunho', 'Documento ainda em elaboração'],
        ['Em Revisão', 'Em processo de conferência'],
        ['Ag. Assinatura', 'Aguardando assinatura de uma ou mais partes'],
        ['Assinado / Registrado', 'Assinatura concluída (ou registro em órgão competente)'],
        ['Arquivado', 'Processo encerrado, documento definitivo'],
        ['Cancelado', 'Documento invalidado'],
      ]},
      { type: 'tip', text: 'Na prateleira de Procurações há um botão extra, "Redigir Procuração", que abre um editor para criar o documento diretamente no sistema, em vez de importar um PDF já pronto de fora.' },
      { type: 'tip', text: 'Todo documento importado recebe um código de integridade (hash SHA-256) exibido junto com os detalhes - qualquer alteração no arquivo original mudaria esse código, servindo como prova de que o documento não foi adulterado.' },
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
  '/app/finance/petty-cash':                'financeiro/fundo-fixo',
  '/app/finance/fluxo-caixa':               'financeiro/fluxo-caixa',
  '/app/finance/contas-receber':            'financeiro/contas-a-receber',
  '/app/finance/agenda':                    'financeiro/agenda',
  '/app/finance/provisoes':                 'financeiro/provisoes',
  '/app/fiscal/nfse-sp':                   'fiscal/nfse-sp',
  '/app/fiscal/nfse-sp-emissao':           'fiscal/nfse-sp',
  '/app/fiscal/nfe':                       'fiscal/nfe',
  '/app/fiscal/documentos-fiscais':        'fiscal/documentos-fiscais',
  '/app/fiscal/apuracao':                  'fiscal/apuracao',
  '/app/fiscal/lalur-config':               'fiscal/lalur-config',
  '/app/fiscal/nfse-nacional':              'fiscal/nfse-nacional',
  '/app/fiscal/nfse-sp-csv':                'fiscal/nfse-sp-csv',
  '/app/hr/employees':                     'dp/funcionarios',
  '/app/hr/pro-labore':                    'dp/pro-labore',
  '/app/hr/esocial':                       'dp/esocial',
  '/app/users':                            'administracao/usuarios',
  '/app/profiles':                         'administracao/perfis',
  '/app/administracao/auditoria':          'administracao/auditoria',
  '/app/sistema/sidebar-permissions':      'administracao/permissoes-menu',
  '/app/system/backup':                    'administracao/backup',
  '/app/settings/data-management':         'administracao/manutencao-dados',
  '/app/sistema/calendario':                'parametros/calendario',
  '/app/sistema/indicadores':               'parametros/indicadores',
  '/app/sistema/tabelas':                   'parametros/tabelas-legais',
  '/app/assinaturas':                      'assinaturas/certificados',
  '/app/signatures/validate':              'assinaturas/validacao',
  '/app/documents/signatures/certificates': 'assinaturas/certificados',
  '/app/assets':                           'patrimonio/cadastro',
  '/app/assets/maintenances':              'patrimonio/manutencoes',
  '/app/societario':                       'societario/estatuto-contrato',
  '/app/societario/livros':                'societario/livros',
  '/app/arquivo':                          'acervo/introducao',
  '/app/arquivo/societario':                'acervo/introducao',
  '/app/arquivo/societario/contratos':      'acervo/introducao',
  '/app/arquivo/societario/atas':           'acervo/introducao',
  '/app/arquivo/societario/procuracoes':    'acervo/introducao',
  '/app/arquivo/societario/acordos':        'acervo/introducao',
  '/app/arquivo/livros':                    'acervo/introducao',
  '/app/arquivo/livros/acoes':              'acervo/introducao',
  '/app/arquivo/livros/transferencias':     'acervo/introducao',
  '/app/arquivo/livros/atas-ago':           'acervo/introducao',
  '/app/arquivo/livros/atas-age':           'acervo/introducao',
  '/app/arquivo/livros/presenca':           'acervo/introducao',
  '/app/arquivo/contabil':                  'acervo/introducao',
  '/app/arquivo/contabil/balancetes':       'acervo/introducao',
  '/app/arquivo/contabil/ecd':              'acervo/introducao',
  '/app/arquivo/contabil/demonstracoes':    'acervo/introducao',
  '/app/arquivo/fiscal':                    'acervo/introducao',
  '/app/arquivo/fiscal/nf':                 'acervo/introducao',
  '/app/arquivo/fiscal/ecf':                'acervo/introducao',
  '/app/arquivo/fiscal/obrigacoes':         'acervo/introducao',
  '/app/arquivo/rh':                        'acervo/introducao',
  '/app/arquivo/rh/contratos':              'acervo/introducao',
  '/app/arquivo/rh/procuracoes':            'acervo/introducao',
  '/app/arquivo/rh/acordos':                'acervo/introducao',
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
      { slug: 'financeiro/fundo-fixo',           title: 'Fundo Fixo / Caixa Pequeno' },
      { slug: 'financeiro/fluxo-caixa',          title: 'Fluxo de Caixa Gerencial' },
      { slug: 'financeiro/contas-a-receber',     title: 'Contas a Receber' },
      { slug: 'financeiro/agenda',               title: 'Agenda Financeira' },
      { slug: 'financeiro/provisoes',            title: 'Provisões Recorrentes' },
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
      { slug: 'fiscal/lalur-config',       title: 'Configuração de Dedutibilidade' },
      { slug: 'fiscal/nfse-nacional',      title: 'NFS-e Nacional' },
      { slug: 'fiscal/nfse-sp-csv',        title: 'Importação CSV PMSP' },
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
    title: 'Arquivo Digital',
    icon: 'archive',
    articles: [
      { slug: 'acervo/introducao', title: 'Como funciona o Arquivo Digital' },
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
      { slug: 'administracao/permissoes-menu', title: 'Permissões de Menu' },
      { slug: 'administracao/backup',          title: 'Backup e Restauração' },
      { slug: 'administracao/manutencao-dados', title: 'Manutenção de Dados' },
      { slug: 'administracao/certificados',  title: 'Certificados Digitais' },
    ],
  },
  {
    title: 'Parâmetros Globais',
    icon: 'globe',
    articles: [
      { slug: 'parametros/calendario', title: 'Calendário de Feriados' },
      { slug: 'parametros/indicadores', title: 'Indicadores Econômicos' },
      { slug: 'parametros/tabelas-legais', title: 'Tabelas Legais' },
    ],
  },
];
