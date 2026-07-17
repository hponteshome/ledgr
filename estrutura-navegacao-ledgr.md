# Nova Estrutura de Navegação Proposta — LEDGR ERP

Este documento consolida a reestruturação da arquitetura de informação e do menu lateral (sidebar) do sistema LEDGR, otimizada para melhorar a experiência do usuário (UX), eliminar redundâncias conceituais e otimizar o fluxo de trabalho diário.

---

## 🗺️ Mapa da Nova Estrutura

### 📊 Painel Principal *(Sem categoria macro)*
*   **Visão Geral**
    *   *Nota de UX:* O Dashboard permanece solto no topo como o ponto de partida diário do usuário.

---

### 📁 Arquivo Digital
*Centraliza estritamente documentos, certidões e o histórico de arquivos estáticos, removendo duplicidades estruturais do dia a dia.*

*   **Societário** (Contratos sociais, estatutos, atas)
*   **Contábil** (Balanços assinados, demonstrações publicadas)
*   **Fiscal** (Guias pagas, declarações transmitidas, notas fiscais armazenadas)
*   **Departamento Pessoal** (Recibos de folha, termos de férias, informes)

---

### 💼 Gestão Operacional
*Unifica o dia a dia da operação em um só lugar, dividido por verticais claras de trabalho. É o ambiente onde o usuário entra para operar, lançar, calcular e gerenciar ativos ativos.*

*   **Financeiro**
    *   Contas a Pagar / Receber
    *   Fluxo de Caixa
    *   Fundo Fixo
    *   Agenda Financeira
    *   Importação Bancária
    *   Provisões Recorrentes
    *   Fechamento Mensal
*   **Contabilidade**
    *   Plano de Contas
    *   Lançamentos
    *   Balancete
    *   Comparativo de Saldos
    *   Visões Contábeis (I052)
    *   Investimentos & Renda Fixa (Simulador CDB)
    *   Relatórios / Importação
*   **Fiscal**
    *   Documentos Fiscais / Notas Fiscais
    *   Config. Dedutibilidade
    *   Apuração de Impostos
*   **Departamento Pessoal**
    *   Funcionários / Pró-labore
    *   Folha de Pagamento / 13º Salário
    *   Férias / Banco de Horas / Recessos & Pontes
    *   DHO (Desenvolvimento Humano e Organizacional)
*   **Patrimônio**
    *   Bens Cadastrados
    *   Manutenções

---

### 🛡️ Compliance & Obrigações
*Focado em rotinas de fiscalização, validações pesadas do governo, auditorias e validações jurídicas estruturais.*

*   **SPED & Entregas**
    *   ECD (Escrituração, Pré-Validação, Histórico)
    *   ECF (Escrituração Fiscal)
    *   EFD-Contribuições
    *   Obrigações Fiscais / eSocial / DCTFWeb / RAIS *(Movidos para cá por serem rotinas de fechamento/transmissão acessadas em períodos específicos, limpando o DP diário)*
*   **Assinaturas & Certificados**
    *   Validação de Assinatura
    *   Certificados Digitais *(Migrado de 'Sistema' para cá devido à forte ligação com validade jurídica e compliance)*

---

### ⚙️ Configurações e Sistema
*Contém o que é estrutural, cadastros base e parametrizações globais que raramente mudam após a implantação.*

*   **Cadastros Base**
    *   Empresas
    *   Pessoas Físicas
*   **Administração do Sistema**
    *   Usuários / Perfis de Acesso / Permissões de Menu
    *   Auditoria & Logs
    *   Backup e Restauração / Manutenção de Dados
*   **Parâmetros Globais**
    *   Calendário de Feriados
    *   Indicadores Econômicos
    *   Tabelas Legais

---

💬 **Mensagens:** Mantido fixo no rodapé ou cabeçalho como um ícone de notificação global para poupar espaço vertical e visual no menu dinâmico.

---

## 📈 Ganhos de UX com essa Mudança

1. **Fim da Ambiguidade:** O usuário não precisa mais adivinhar se o "Fiscal" que ele quer acessar é o do topo ou o de baixo. Se ele precisa **operar** (fazer apuração), acessa *Gestão Operacional -> Fiscal*. Se ele quer buscar um **documento arquivado**, acessa *Arquivo Digital -> Fiscal*.
2. **Separação por Rotina:** Rotinas pesadas de transmissão e validações de obrigações (eSocial, DCTFWeb, SPED) foram movidas para a gaveta dedicada de *Compliance*, purificando e aliviando a carga visual das telas de rotina diária do DP e do Fiscal.
3. **Escalabilidade Visual:** Agrupar a antiga "Administração" com as tabelas de parâmetros sob um mesmo guarda-chuva técnico evita que a sidebar vire uma lista infinita, mantendo uma visualização limpa e focada.
