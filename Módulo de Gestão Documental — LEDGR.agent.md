# LEDGR — Documentação Técnica
## Módulo de Gestão Documental

**Versão:** 1.0  
**Data:** Março de 2026  
**Status:** Uso Interno  
**Pipeline:** Texto Puro → HTML/CSS → PDF/A → Assinatura Digital

---

### 1. Visão Geral e Motivação da Arquitetura
O LEDGR utiliza dados estruturados para gerar documentos jurídicos padronizados. A premissa central é que o sistema não atua como um editor de texto comum, mas como um gerador baseado em dados (Data-Driven Document Generation).

#### 1.1 Por que não utilizar DOCX?
A rejeição ao formato DOCX como padrão de trabalho deve-se a:
* **Renderização Inconsistente:** Diferenças entre Word, LibreOffice e Google Docs.
* **Complexidade Técnica:** Manipulação de XML/ZIP exige bibliotecas pesadas.
* **Padronização:** Dificuldade em manter identidade visual entre diferentes empresas.
* **Conformidade:** A JUCESP exige PDF/A para autenticação de livros e atos societários.

---

### 2. Pipeline de Geração
O fluxo de dados segue uma cadeia de custódia rigorosa para garantir validade jurídica:

1. **Dado Estruturado:** PostgreSQL + Prisma (Sócios, Capital, Datas).
2. **Template:** HTML5 + CSS3 (Handlebars/Edge.js).
3. **Conversão:** Puppeteer (Headless Chrome) para output determinístico.
4. **Integridade:** Cálculo de Hash SHA-256 do binário.
5. **Assinatura:** Integração com ICP-Brasil (ClickSign/DocuSign).
6. **Storage:** Armazenamento imutável em S3/MinIO.

---

### 3. Contexto Legal (JUCESP)
Atendimento às Instruções Normativas DREI nº 82/2021 e nº 79/2022 para autenticação digital de documentos societários.

| Documento | Base Legal | Exige Assinatura |
| :--- | :--- | :--- |
| Estatuto Social | Lei 6.404/76 (S/A) | Sim |
| Ata de AGE / AGO | Lei 6.404/76, art. 124 | Sim |
| Livros Societários | Lei 6.404/76, art. 100 | Sim |

---

### 4. Implementação Técnica (Exemplo NestJS)

```typescript
// Lógica de Verificação de Integridade (SHA-256)
async verificarIntegridade(id: string): Promise<VerificacaoResult> {
  const doc = await this.prisma.documento.findUnique({ where: { id } });
  const pdfAtual = await this.storage.download(doc.caminhoStorage);
  const hashAtual = crypto.createHash('sha256').update(pdfAtual).digest('hex');

  return {
    integro: hashAtual === doc.hashSHA256,
    hashRegistrado: doc.hashSHA256,
    hashAtual: hashAtual,
    verificadoEm: new Date(),
  };
}







Módulo de Gestão Documental — LEDGR
Versão: 1.0


Data: Março de 2026 


Status: Uso Interno 


Pipeline: Texto Puro → HTML/CSS → PDF/A → Assinatura Digital 

1. Visão Geral e Motivação da Arquitetura
O LEDGR é uma plataforma de gestão multi-empresa que utiliza dados estruturados para gerar documentos jurídicos padronizados e seguros. A premissa central é que o sistema não atua como um editor de texto comum, mas como um gerador baseado em dados.
+2

1.1 Rejeição ao Formato DOCX
A escolha de não utilizar DOCX como formato primário baseia-se em:


Renderização inconsistente: Diferenças visuais entre Word, LibreOffice e Google Docs.


Complexidade técnica: Manipulação programática de arquivos ZIP/XML exige bibliotecas pesadas.


Estilo descentralizado: Dificuldade em manter a padronização visual entre diferentes empresas.


Regulamentação: A JUCESP exige PDF/A com assinatura digital, tornando o DOCX um passo desnecessário.

1.2 A Decisão: HTML + CSS → PDF/A
O pipeline adotado segue o fluxo: Dado Estruturado (PostgreSQL/Prisma) → Template HTML + CSS → Puppeteer (Headless) → Hash SHA-256 → Assinatura Digital (ICP-Brasil) → Armazenamento Imutável (S3/MinIO).

Vantagens:


Stack familiar: Uso de HTML/CSS já presentes no frontend.


Output determinístico: O PDF gerado é idêntico em qualquer sistema.


Conformidade: Atende às exigências da JUCESP (Instruções Normativas DREI nº 82/2021 e nº 79/2022).
+1

2. Contexto Legal e Regulatório (JUCESP)
Desde setembro de 2025, a JUCESP autentica livros societários exclusivamente em formato digital. O LEDGR atende aos seguintes requisitos:
+1


Formato: PDF/A (ISO 19005).


Assinatura: Certificado e-CPF ou e-CNPJ (ICP-Brasil).


Integridade: Cadeia de custódia verificável via Hash SHA-256.

Documento	Base Legal	Exige Assinatura
Estatuto Social	Lei 6.404/76 (S/A)	
Sim 

Ata de AGE / AGO	Lei 6.404/76, art. 124	
Sim 

Procuração	Código Civil, art. 653	
Situacional 

Livros Societários	Lei 6.404/76, art. 100/127	
Sim 

3. Arquitetura Técnica Detalhada
3.1 Origem dos Dados (Input)

Automáticos (Prisma): Razão Social, CNPJ, dados de sócios e composição de capital.


Editoriais (Usuário): Objeto social e deliberações via <textarea> (MVP) ou TipTap (Fase 2).
+1

3.2 Implementação do Puppeteer (NestJS)
O Puppeteer foi escolhido por ser mantido pelo Google, oferecer suporte total a CSS moderno e permitir output determinístico.
+1

TypeScript
// Exemplo simplificado de geração no NestJS
async gerarPDF(tipo: string, dados: any): Promise<Buffer> {
  const template = Handlebars.compile(templateSrc);
  const html = template({ ...dados, css: cssSrc });
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return Buffer.from(pdfBuffer);
}

(Fonte: Documentação Técnica LEDGR )

4. Segurança e Integridade
4.1 Hash SHA-256
Imediatamente após a geração, o sistema calcula uma "impressão digital" do arquivo para garantir que ele não seja alterado.

4.2 Assinatura Digital (Integração)
O LEDGR utiliza APIs de terceiros credenciados pela ICP-Brasil:


Fase 1 (MVP): ClickSign (API REST e planos acessíveis).


Fase 2: DocuSign (Padrão global).

5. Roadmap de Implementação
Fase	Entregáveis	Prioridade	Estimativa
Fase 1	MVP: Estatuto Social, PDF via Puppeteer, Hash SHA-256, MinIO.	Alta	
3-4 semanas 

Fase 2	Integração ClickSign, Fluxo multi-signatário, Webhooks.	Alta	
2-3 semanas 

Fase 3	Templates Ata/Procuração, Importação DOCX (Mammoth).	Média	
3-4 semanas 

Fase 4	Livros Societários (Ações/Presença), Exportação JUCESP.	Futura	
A definir 


Nota: Este documento deve ser revisado em caso de mudanças regulatórias do DREI ou JUCESP.

Seria útil se eu gerasse o arquivo .md para download ou formatasse os diagramas de fluxo de dados de forma mais visual para você?





///////////////////////////////////////////////
3. Estrutura de Preservação (Syntax Check)
Para garantir que o Markdown seja interpretado corretamente por qualquer parser (como o do GitHub ou do seu sistema no NestJS), certifique-se de que:

Tabelas: Haja uma linha em branco antes e depois da tabela.

Blocos de Código: Estejam cercados por três crases (` ` `) e o identificador da linguagem (ex: typescript).

Checklists: As caixas de seleção do Roadmap devem manter o formato - [ ] ou as tabelas com bordas simples |.

Dica para o Projeto LEDGR:
Se você pretende usar este .md como base para os seus templates de documentos, pode usar bibliotecas como o gray-matter para separar os metadados (YAML front-matter) do corpo do documento, facilitando a automação: