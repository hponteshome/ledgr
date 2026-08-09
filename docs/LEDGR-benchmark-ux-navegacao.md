# LEDGR — Documentação Técnica

## Benchmark de UX e Arquitetura de Navegação

Referências de Conta Azul, Omie e Nibo aplicadas ao redesenho de navegação do LEDGR

**Versão 1.0 · Agosto de 2026**
**Módulo:** Arquitetura de Informação / Design System

---

## 1. Objetivo do Documento

Este documento consolida os aprendizados de uma pesquisa de benchmark competitivo conduzida sobre três plataformas brasileiras de gestão contábil/financeira SaaS — Conta Azul, Omie e Nibo — com o propósito de orientar a definição de layout e arquitetura de navegação do LEDGR.

A estratégia adotada é aplicar o que já funciona e está validado no mercado, evitando reinventar padrões de navegação já testados por milhões de usuários em produtos concorrentes diretos. Este documento serve como referência viva para as decisões de design do LEDGR e deve ser atualizado conforme novos aprendizados surgirem.

> **Contexto do problema**
> - O LEDGR é uma plataforma multiempresa com módulos: Financeiro, Contábil, SPED/Fiscal, Ativo Imobilizado e Societário.
> - Cada módulo concentra um número crescente de rotinas/funcionalidades, com tendência de expansão contínua.
> - A navegação atual ainda não encontrou um desenho definitivo que escale bem com esse crescimento.

---

## 2. Metodologia

A pesquisa combinou três fontes complementares:

- **Documentação oficial** (centrais de ajuda) da Conta Azul, Omie e Nibo — estrutura real de menus, módulos e funcionalidades de navegação.
- **Feedback de usuários reais** — Reclame Aqui, App Store, reviews — capturando o que gera satisfação e o que gera frustração na navegação, incluindo reações a redesigns recentes.
- **Literatura de UX para SaaS B2B denso** (padrões de sidebar, command palette, multi-tenant switching) — para contextualizar os achados dentro de práticas de mercado mais amplas, além do segmento contábil brasileiro.

**Ressalva metodológica:** depoimentos positivos vêm majoritariamente de canais institucionais (marketing), enquanto reclamações vêm de canais autosselecionados para insatisfação (Reclame Aqui, App Store). A leitura deste documento deve considerar esse viés — a realidade média das três plataformas provavelmente está entre os extremos relatados.

---

## 3. Padrões Identificados por Plataforma

### 3.1 Conta Azul (Conta Azul Pro)

Estrutura: menu lateral esquerdo por módulo (Financeiro, Vendas, Produtos, Compras etc.), barra superior com busca, configurações/plano, botão "+ Novo" e chat. A tela pós-login é uma "Visão geral" com fluxo de caixa diário, gráfico de vendas e contas a pagar/receber.

| Recurso | Como funciona |
|---|---|
| Busca de funcionalidades | Campo "Pesquisar" no topo encontra menus e funcionalidades por palavra-chave. |
| Favoritos | Estrela ao lado de cada menu; itens favoritados exibidos na ordem em que foram adicionados. |
| Atalhos de teclado | Teclas de atalho para abrir páginas do dia a dia. |
| Ação rápida global | Botão "+ Novo" no topo cria receitas, despesas, vendas, orçamentos, compras e contratos direto, sem navegar até o módulo. |
| Multiempresa (parceiro/contador) | Painel "Conta Azul Mais": lista de clientes, licença visível por cliente, acesso ao ERP do cliente em um clique, geração de obrigações em lote. |
| Perfis de acesso | Menu varia por perfil — perfis menores (ex.: Financeiro Júnior) veem menu reduzido em relação ao Administrador. |

Redesign recente: a versão clássica foi descontinuada para novas assinaturas, obrigando migração para a "Pro". A reação de parte da base foi negativa:

> "A nova interface introduzida na atualização é ridiculamente pior que a antiga. Ela dificulta a navegação e a localização de funcionalidades anteriormente acessíveis de forma rápida e intuitiva."

A mesma reclamação cita a remoção da edição em lote como perda funcional direta do redesign — reforçando que mudanças de navegação que removem atalhos de produtividade geram reação forte.

*Reputação: nota 8,3/10 no Reclame Aqui, 478 reclamações registradas. Ainda assim, é consistentemente citada como a interface mais limpa e intuitiva do segmento — o problema não foi o padrão em si, mas a execução da transição.*

### 3.2 Omie

Estrutura: ERP mais amplo, organizado em cerca de 6 módulos (Vendas e NF-e; Serviços e NFS-e; Finanças; Compras, Estoque e Produção; CRM; Painel do Contador). Cada módulo tem menu suspenso/lateral próprio com suas rotinas.

| Recurso | Como funciona |
|---|---|
| Painel de Tarefas | Presente no menu suspenso de todos os módulos — visão de pendências cruzando módulos. |
| Pesquisa Atômica | Cadastro/busca por CNPJ, CPF, nome completo, parte do nome ou telefone. |
| Painel do Contador | Login único para gerenciar todos os clientes sem trocar de ambiente; visão consolidada integrada em tempo real. |

Ponto forte: amplitude e integração entre módulos, elogiada em integrações com Sefaz, Sintegra e Serasa.

Ponto fraco recorrente: complexidade e curva de aprendizado. Reclamações de usuários incluem:

> "O sistema é extremamente complexo... MUITO complexo, impossível de trabalhar com esse sistema."

> "Os filtros são confusos... o sistema pensa muito entre as ações."

*Análises comparativas independentes confirmam esse padrão: a Omie "exige um tempo maior de adaptação, devido à variedade de recursos", sendo recomendada sobretudo para "empresas estruturadas, com múltiplos setores e necessidade de gestão integrada" — ou seja, o escopo amplo compensa a complexidade só para um perfil específico de usuário avançado.*

### 3.3 Nibo

Estrutura (Gestão Financeira): sidebar com Gestão de Caixa/Resumo, Gestão de Extratos, Fluxo de Caixa, Contatos, Recebimentos (abas: Receber, Agendar, Boletos, NFS-e, Central de Cobrança, Recorrências), Pagamentos (Pagar, Agendar, Recorrências), Relatórios e "Mais opções".

Estrutura (Painel do Contador): menu lateral com Clientes (Meus clientes, Arquivados, Contatos, Convites), Obrigações, Automação Contábil, Relacionamento e Configurações.

| Recurso | Como funciona |
|---|---|
| Busca e favoritos de empresa | Menu "Clientes" com busca por empresa e filtro Todos / Favoritos / por licença. |
| Painel de acompanhamento | Indicadores editáveis pelo próprio usuário ("é só editar e criar como quiser"). |
| App mobile | Menu lateral para buscar empresa, depois dashboard geral da empresa filtrada. |
| Command palette / atalhos | Sem evidência pública de busca global cross-módulos ou atalhos de teclado — lacuna identificada. |

Redesign recente ("novo Nibo", out/2024): rebranding + melhorias incrementais, sem reengenharia completa documentada da sidebar. Reação mista — elogios à simplicidade convivem com críticas pontuais:

> "Acabaram com o aplicativo e web, antes era fácil de usar, agora é quase impossível... tela confusa, menu em cima das coisas, não é responsivo."

*Reputação: nota 6,4 no Reclame Aqui (janela mais recente), 53 reclamações — a maioria sobre suporte/cobrança, não navegação. Elogios recorrentes descrevem o produto como "fácil, prático e eficiente"; a principal queixa de UX é que a simplicidade do sistema "limita o trabalho de análise financeira" para usuários avançados.*

---

## 4. Comparativo Consolidado

| Dimensão | Conta Azul | Omie | Nibo |
|---|---|---|---|
| Navegação primária | Sidebar por módulo | Sidebar por módulo (mais módulos) | Sidebar por área |
| Busca de funcionalidades | Sim (destaque do mercado) | Só busca de cadastro (Pesquisa Atômica) | Só busca de empresa/cliente |
| Favoritos | Sim, com ordenação própria | Não identificado | Sim, para empresas |
| Atalhos de teclado | Sim | Não identificado | Não identificado |
| Command palette (Ctrl/Cmd+K) | Não | Não | Não |
| Ação rápida global ("+Novo") | Sim | Não centralizado | Não centralizado |
| Hub multiempresa | Conta Azul Mais | Painel do Contador | Painel do Contador |
| Percepção de simplicidade | Alta | Baixa (complexo) | Alta |
| Risco em redesign recente | Alto (reclamações fortes) | — | Médio (reação mista) |

> **Leitura consolidada**
> - Nenhuma das três tem command palette unificada (Ctrl/Cmd+K) — é uma lacuna clara do segmento e uma oportunidade de diferenciação para o LEDGR.
> - Simplicidade percebida (Conta Azul, Nibo) gera mais satisfação do que amplitude de módulos sem hierarquia clara (Omie).
> - O maior risco de UX não é a estrutura escolhida, e sim a execução de mudanças nela — os dois casos de redesign documentados geraram reação negativa por quebrar o modelo mental do usuário.

---

## 5. Recomendações de Arquitetura para o LEDGR

As recomendações estão organizadas em três estágios de maturidade, para permitir implementação incremental sem exigir uma reescrita completa da navegação de uma só vez.

### 5.1 Estágio 1 — Fundação da Arquitetura (imediato)

- Sidebar por módulo com sub-navegação contextual em duas camadas: manter Financeiro, Contábil, SPED/Fiscal, Ativo Imobilizado e Societário como itens de topo fixos; ao entrar em um módulo, exibir suas rotinas em uma segunda coluna ou sub-menu — padrão que escala bem à medida que rotinas crescem, evitando uma lista plana sobrecarregada.
- Barra superior reservada a contexto global: seletor de empresa, busca, "+ Novo", conta/configurações e notificações — nunca misturar utilidades globais dentro da sidebar de módulos.
- Seletor de empresa persistente e sempre visível, com a empresa ativa em destaque; ao trocar de empresa, preservar o módulo/rotina atual sempre que fizer sentido, reduzindo recliques para quem administra múltiplas empresas.

### 5.2 Estágio 2 — Produtividade para Usuários Avançados (próximo ciclo)

- Command palette (Ctrl/Cmd+K) navegando para qualquer rotina de qualquer módulo e qualquer empresa, com sugestão de itens recentes/frequentes antes de digitar — é a lacuna clara do mercado, nenhuma das três referências tem esse recurso completo.
- Favoritos/atalhos personalizáveis por usuário, no modelo da Conta Azul, já que contadores tendem a repetir um subconjunto pequeno de rotinas diariamente.
- Breadcrumbs em toda hierarquia de 3+ níveis, com destaque consistente do item ativo na navegação.

### 5.3 Estágio 3 — Escala e Governança (contínuo)

- Navegação configurável por perfil/permissão, reduzindo a carga cognitiva ao esconder rotinas irrelevantes para o papel do usuário — como já faz a Conta Azul entre Administrador e Financeiro Júnior.
- Auditoria periódica de uso do menu, reordenando e reagrupando itens conforme o produto cresce, para evitar acúmulo de dívida de UX.

#### Fluxo de navegação proposto (visão simplificada)

```
 [Barra Superior]   Seletor de Empresa | Busca / Cmd+K | + Novo | Conta
 ---------------------------------------------------------------------
 [Sidebar Nível 1]        [Coluna Nível 2 - contextual ao módulo]
  > Financeiro       -->   Extrato | Contas a Pagar | Contas a Receber
  > Contábil         -->   Plano de Contas | Lançamentos | Balancete
  > SPED / Fiscal    -->   ECD | ECF | Validador | Obrigações
  > Ativo Imobilizado-->   Bens | Depreciação | Baixas
  > Societário        -->   Documentos | Assinaturas | Livros
 ---------------------------------------------------------------------
 [Favoritos do usuário]   [Itens fixados manualmente, entre módulos]
```

---

## 6. Roadmap de Implementação

| Fase | Entregável | Referência aplicada | Prioridade |
|---|---|---|---|
| 1 | Sidebar de dois níveis (módulo + rotina contextual) | Padrão comum às 3 plataformas | Alta |
| 1 | Seletor de empresa persistente na barra superior | Conta Azul Mais / Painel do Contador (Omie, Nibo) | Alta |
| 2 | Command palette (Ctrl/Cmd+K) | Lacuna de mercado — diferencial LEDGR | Alta |
| 2 | Favoritos por usuário | Conta Azul (menu Favoritos) | Média |
| 2 | Breadcrumbs em hierarquias profundas | Boas práticas de UX B2B | Média |
| 3 | Navegação por perfil/permissão | Conta Azul (perfis de acesso) | Média |
| 3 | Auditoria periódica de uso de menu | Governança de UX contínua | Baixa |

> **Guardrails para qualquer rollout futuro de navegação**
> - Lançar mudanças de navegação de forma gradual, com possibilidade de manter o layout anterior por um período de transição.
> - Nunca remover atalhos de produtividade existentes (ex.: edição em lote) como efeito colateral de um redesign — esse foi o gatilho mais citado nas reclamações da Conta Azul Pro.
> - Comunicar mudanças de interface antes do rollout, com destaque para onde cada funcionalidade antiga foi realocada.

---

## 7. Ressalvas e Limitações da Pesquisa

- Viés de fonte: depoimentos positivos vêm majoritariamente de canais institucionais; reclamações vêm de canais autosselecionados para insatisfação (Reclame Aqui, App Store).
- Reclamações misturam temas: parte das queixas das três plataformas trata de suporte, cobrança e instabilidade — não exclusivamente navegação. Este documento isola, sempre que possível, o que é especificamente de arquitetura de informação.
- Estruturas de menu podem estar desatualizadas: descrições vêm de centrais de ajuda oficiais e podem não refletir 100% da interface após atualizações recentes, especialmente no caso do Nibo pós-rebranding de outubro de 2024.
- Base quantitativa limitada: reviews em português para essas três marcas têm baixo volume em plataformas como G2/Capterra; as conclusões apoiam-se mais em centrais de ajuda, Reclame Aqui, App Store e comparativos setoriais do que em amostras estatísticas robustas.
- O escopo da Omie (ERP completo, incluindo estoque e produção) não é diretamente comparável ao escopo mais financeiro/contábil/fiscal do Nibo e do próprio LEDGR — a leitura de "complexidade" deve considerar essa diferença de escopo.

---

## Nota de Referência

Este documento foi elaborado a partir de uma pesquisa aprofundada conduzida em agosto de 2026, cruzando documentação oficial das plataformas Conta Azul, Omie e Nibo, feedback público de usuários (Reclame Aqui, App Store) e literatura de padrões de UX para SaaS B2B. Deve ser tratado como referência viva: recomenda-se revisão sempre que uma das três plataformas de referência passar por um novo redesign relevante, ou a cada ciclo de planejamento de evolução da navegação do LEDGR.

*Documento preparado para uso interno da equipe do LEDGR como base de decisão de design. Próxima revisão sugerida: reavaliar após a implementação do Estágio 1 do roadmap, incorporando aprendizados reais de uso.*
