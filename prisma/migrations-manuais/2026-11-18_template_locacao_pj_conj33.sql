-- 2026-11-18_template_locacao_pj_conj33_pendencias.sql
-- JS-CONJ33-01: template "Locação Não Residencial - Locatária PJ" (global, como o residencial padrão)
-- e pendências da locação do Conj 33 à José Silva Sociedade Individual de Advocacia (desde 01/09/2026).
\set ON_ERROR_STOP on
\set lm 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
\set js 'ca9ba513-06ae-4579-b546-ebc457f33452'
BEGIN;

INSERT INTO document_templates (id, name, type, content, version, is_active, variables, company_id, created_at, updated_at, deleted_at, is_default, description, created_by_id)
SELECT gen_random_uuid(), 'Locação Não Residencial - Locatária PJ', 'CONTRATO_LOCACAO',
$tpl$<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 40px 50px; }
  h1 { text-align: center; font-size: 13pt; text-decoration: underline; margin-bottom: 30px; }
  h2 { font-size: 12pt; text-decoration: underline; margin-top: 24px; margin-bottom: 8px; break-after: avoid-page; page-break-after: avoid; }
  p { text-align: justify; margin: 0 0 12px 0; orphans: 3; widows: 3; }
  .paragrafo { margin-left: 0; }
  table.assinaturas { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.assinaturas td { width: 50%; vertical-align: top; padding: 16mm 0 0 0; border: none; }
  table.assinaturas td.dir { text-align: right; }
  table.assinaturas td.centro { text-align: center; }
  table.assinaturas td p { display: inline-block; text-align: left; margin: 0; line-height: 1.25; }
  table.assinaturas td.centro p { text-align: center; }
  table.assinaturas tr { break-inside: avoid; page-break-inside: avoid; }
  p.titulo-testemunhas { margin-top: 10mm; }
</style>

<h1>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE IMÓVEL NÃO RESIDENCIAL</h1>

<p>Pelo presente instrumento particular, e na melhor forma de direito, de um lado como <strong>LOCADORA</strong>, <strong>{{empresa.legalName}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>{{empresa.taxId}}</strong>, com sede na {{empresa.street}}, nº {{empresa.number}}{{#if empresa.complement}}, {{empresa.complement}}{{/if}}, {{empresa.neighborhood}}, {{empresa.city}} - {{empresa.state}}, CEP {{empresa.zipCode}}, neste ato representada na forma de seus atos constitutivos, doravante denominada simplesmente LOCADORA;</p>

<p>e de outro lado como <strong>LOCATÁRIA</strong>, <strong>{{contrato.tenantName}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>{{contrato.tenantTaxId}}</strong>{{#if contrato.tenantStreet}}, com sede na {{contrato.tenantStreet}}, nº {{contrato.tenantNumber}}{{#if contrato.tenantComplement}}, {{contrato.tenantComplement}}{{/if}}, {{contrato.tenantNeighborhood}}, {{contrato.tenantCity}} - {{contrato.tenantState}}, CEP {{contrato.tenantZipCode}}{{/if}}, neste ato representada na forma de seus atos constitutivos, doravante denominada simplesmente LOCATÁRIA;</p>

<p>têm, entre si, justo e contratado, na melhor forma de direito, a locação do imóvel abaixo mencionado, mediante as cláusulas e condições seguintes, regendo-se o presente instrumento pela Lei nº 8.245, de 18 de outubro de 1991 (Lei do Inquilinato), e, no que couber, pelo Código Civil:</p>

<h2>CLÁUSULA PRIMEIRA - DO OBJETO E DA DESTINAÇÃO</h2>
<p>O presente contrato tem por objeto a locação do imóvel situado à {{imovel.street}}, nº {{imovel.number}}{{#if imovel.complement}}, {{imovel.complement}}{{/if}}, {{imovel.neighborhood}}, {{imovel.city}} - {{imovel.state}}, CEP {{imovel.zipCode}}{{#if imovel.registryNumber}}, objeto da matrícula nº {{imovel.registryNumber}}{{#if imovel.registryOffice}} do {{imovel.registryOffice}}{{/if}}{{/if}} ("Imóvel"), destinado exclusivamente a fins não residenciais, para o exercício das atividades da LOCATÁRIA, em conformidade com a convenção e o regulamento interno do condomínio, vedado o uso para qualquer outra finalidade sem prévia e expressa autorização da LOCADORA.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> - A LOCATÁRIA declara ter vistoriado o Imóvel e recebê-lo em perfeitas condições de uso, conservação e limpeza, obrigando-se a restituí-lo nas mesmas condições, ressalvado o desgaste natural decorrente do uso regular.</p>
<p class="paragrafo"><em>Parágrafo segundo</em> - É vedado à LOCATÁRIA ceder, transferir, sublocar ou emprestar o Imóvel, no todo ou em parte, sem prévia e expressa autorização da LOCADORA.</p>
<p class="paragrafo"><em>Parágrafo terceiro</em> - A obtenção e a manutenção de licenças e alvarás necessários ao exercício das atividades da LOCATÁRIA no Imóvel correm por sua conta e responsabilidade.</p>

<h2>CLÁUSULA SEGUNDA - DO PRAZO CONTRATUAL</h2>
<p>O prazo do presente contrato é de {{contrato.prazoMeses}} meses, iniciando-se no dia <strong>{{contrato.startDate}}</strong>, para terminar no dia <strong>{{contrato.endDate}}</strong>, data em que a LOCATÁRIA, independentemente de qualquer aviso ou interpelação, obriga-se a devolver o Imóvel ora locado inteiramente livre e desocupado de pessoas e coisas.</p>
<p class="paragrafo"><em>Parágrafo único</em> - Findo o prazo contratual sem manifestação em contrário de qualquer das partes, e permanecendo a LOCATÁRIA no Imóvel por mais de 30 (trinta) dias sem oposição da LOCADORA, a locação prorrogar-se-á por prazo indeterminado, mantidas as demais cláusulas e condições, nos termos do art. 56, parágrafo único, da Lei do Inquilinato.</p>

<h2>CLÁUSULA TERCEIRA - DO VALOR DO ALUGUEL E FORMA DE PAGAMENTO</h2>
<p>O valor do aluguel mensal será de <strong>{{contrato.rentAmount}} ({{contrato.rentAmountExtenso}})</strong>, vencendo-se o aluguel de cada mês no dia <strong>{{contrato.dueDay}}</strong> do mês subsequente ao vencido, e será pago pela LOCATÁRIA mediante depósito ou transferência bancária em conta indicada pela LOCADORA, valendo o comprovante como recibo de pagamento.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> - O eventual pagamento do aluguel fora do prazo estabelecido sujeitará a LOCATÁRIA ao pagamento de multa de 2% (dois por cento) sobre o valor devido, além de juros de mora de 1% (um por cento) ao mês, calculados dia a dia, pro rata tempore, até a data do efetivo pagamento.</p>
{{#if contrato.readjustmentIndex}}
<p class="paragrafo"><em>Parágrafo segundo</em> - O valor do aluguel será reajustado a cada {{contrato.readjustmentPeriodMonths}} meses, ou com a menor periodicidade legalmente permitida, de acordo com a variação do {{contrato.readjustmentIndex}}, ou, na falta deste, pelo índice que melhor reflita a desvalorização da moeda, um na falta do outro, nesta ordem.</p>
{{/if}}

<h2>CLÁUSULA QUARTA - DAS DESPESAS E ENCARGOS</h2>
<p>As despesas condominiais ordinárias e os tributos e taxas incidentes sobre o Imóvel, inclusive o IPTU, são de responsabilidade da LOCATÁRIA. Quando pagos diretamente pela LOCADORA, serão reembolsados pela LOCATÁRIA juntamente com o aluguel do mês seguinte ao do pagamento, mediante apresentação do demonstrativo e dos respectivos comprovantes, não integrando o valor do aluguel.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> - Ficarão igualmente por conta da LOCATÁRIA todas as despesas relativas a consumo de água, esgoto, energia elétrica, gás, telefone e internet utilizados no exercício de suas atividades, não respondendo a LOCADORA pela falta ou falha na prestação desses serviços.</p>
<p class="paragrafo"><em>Parágrafo segundo</em> - A LOCATÁRIA obriga-se a manter seguro contra incêndio do Imóvel pelo valor de reposição, tendo a LOCADORA como beneficiária, vigente enquanto perdurar a locação, e a apresentar a respectiva apólice sempre que solicitado, salvo se o Imóvel já estiver coberto por seguro do condomínio, conforme faculta o art. 22, inciso VIII, da Lei do Inquilinato.</p>

<h2>CLÁUSULA QUINTA - DA CONSERVAÇÃO E DAS BENFEITORIAS</h2>
<p>A LOCATÁRIA obriga-se a manter o Imóvel em perfeita ordem e condições de uso, respondendo pela conservação de pintura, portas, fechos, vidros, pisos, instalações hidráulicas e elétricas, devolvendo-o, ao término da locação, em perfeitas condições de uso, ressalvado o desgaste natural decorrente do uso regular.</p>
<p class="paragrafo"><em>Parágrafo único</em> - Quaisquer benfeitorias ou alterações no Imóvel dependerão de prévia e expressa autorização da LOCADORA e a ele se incorporarão, sem direito a indenização ou retenção, nos termos dos arts. 35 e 36 da Lei do Inquilinato, salvo ajuste em contrário por escrito.</p>

<h2>CLÁUSULA SEXTA - DA GARANTIA</h2>
{{#if contrato.guaranteeType}}
{{#if contrato.isFianca}}
<p>A presente locação conta com fiança, assinando também este contrato, na qualidade de <strong>{{contrato.fia.TITULO}}</strong>, solidariamente responsável por todas as obrigações principais e acessórias assumidas pela LOCATÁRIA: {{contrato.guaranteeDescription}}.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> - Declara, outrossim, {{contrato.fia.o}} {{contrato.fia.TITULO}} que renuncia expressamente aos direitos e benefícios estabelecidos nos artigos 827, 828, 835, 838 e 839 do Código Civil.</p>
<p class="paragrafo"><em>Parágrafo segundo</em> - A responsabilidade {{contrato.fia.do}} {{contrato.fia.TITULO}} perdurará até a efetiva entrega das chaves e desocupação do Imóvel, ainda que a locação se prorrogue por prazo indeterminado, nos termos do art. 39 da Lei do Inquilinato.</p>
{{#if contrato.fiadorComConjuge}}
<p class="paragrafo"><em>Parágrafo terceiro</em> - Assina também o presente instrumento o cônjuge {{contrato.fia.do}} {{contrato.fia.TITULO}}, em sinal de expressa anuência à fiança ora prestada, nos termos do art. 1.647, inciso III, do Código Civil.</p>
{{/if}}
{{else}}
<p>A locação conta com garantia na modalidade de <strong>{{contrato.guaranteeType}}</strong>{{#if contrato.guaranteeDescription}}, nos seguintes termos: {{contrato.guaranteeDescription}}{{/if}}, nos termos do art. 37 da Lei do Inquilinato.</p>
{{/if}}
{{else}}
<p>As partes dispensam, de comum acordo, a exigência de garantia locatícia prevista no art. 37 da Lei do Inquilinato.</p>
{{/if}}

<h2>CLÁUSULA SÉTIMA - DA MULTA E RESCISÃO</h2>
{{#if contrato.penaltyDescription}}
<p>{{contrato.penaltyDescription}}</p>
{{else}}
<p>A infração de qualquer cláusula deste contrato, bem como a rescisão antecipada por qualquer das partes sem justa causa, sujeitará a parte infratora ao pagamento de multa equivalente a 3 (três) aluguéis vigentes à época da infração, a qual, na hipótese de devolução antecipada do Imóvel pela LOCATÁRIA, será reduzida proporcionalmente ao período restante do contrato, nos termos do art. 4º da Lei do Inquilinato, sem prejuízo das perdas e danos cabíveis.</p>
{{/if}}

{{#if contrato.temClausulasEspecificas}}
<h2>CLÁUSULA OITAVA - DAS DISPOSIÇÕES ESPECÍFICAS</h2>
{{#each contrato.clausulasEspecificas}}
{{#if rotulo}}<p class="paragrafo"><em>{{rotulo}}</em> - {{texto}}</p>{{else}}<p>{{texto}}</p>{{/if}}
{{/each}}
{{/if}}

<h2>CLÁUSULA {{#if contrato.temClausulasEspecificas}}NONA{{else}}OITAVA{{/if}} - DO FORO</h2>
<p>As partes contratantes obrigam-se por si e seus sucessores a cumprir e fazer cumprir, a todo o tempo e em todos os seus termos, tudo quanto aqui pactuaram, ficando eleito o Foro da comarca de {{empresa.city}} - {{empresa.state}}, com exclusão de qualquer outro, por mais privilegiado que seja, para nele serem dirimidas as dúvidas ou questões oriundas deste instrumento.</p>
<p class="paragrafo"><em>Parágrafo único</em> - As partes convencionam que as citações, intimações ou notificações, enfim, quaisquer atos que visem dar conhecimento de procedimentos judiciais e extrajudiciais, poderão ser feitos pelos Correios, com aviso de recebimento ("AR"), ou por meio eletrônico com confirmação de recebimento.</p>

<p>E, por estarem justas e contratadas, as partes assinam o presente instrumento em {{contrato.numeroVias}} vias de igual teor e forma, ou eletronicamente, na presença das testemunhas abaixo.</p>

<p style="text-align:center; margin-top: 30px;">{{empresa.city}}, {{contrato.dataAssinatura}}.</p>

<table class="assinaturas">
  <tr>
    <td class="esq"><p>______________________________________<br><strong>{{empresa.legalName}}</strong><br>Locadora</p></td>
    <td class="dir"><p>______________________________________<br><strong>{{contrato.tenantName}}</strong><br>Locatária</p></td>
  </tr>
  {{#if contrato.isFianca}}
  <tr>
    <td class="centro" colspan="2"><p>______________________________________<br><strong>{{contrato.fiadorNome}}</strong><br>{{contrato.fia.Titulo}}</p></td>
  </tr>
  {{/if}}
</table>

<p class="titulo-testemunhas"><strong>TESTEMUNHAS:</strong></p>
<table class="assinaturas testemunhas">
  <tr>
    <td class="esq"><p>1. ______________________________<br>Nome:<br>RG:<br>CPF:</p></td>
    <td class="dir"><p>2. ______________________________<br>Nome:<br>RG:<br>CPF:</p></td>
  </tr>
</table>$tpl$,
  1, true,
  '{"imovel": ["imovel.street", "imovel.number", "imovel.complement", "imovel.neighborhood", "imovel.city", "imovel.state", "imovel.zipCode", "imovel.registryNumber", "imovel.registryOffice"], "locador": ["empresa.legalName", "empresa.taxId", "empresa.street", "empresa.number", "empresa.complement", "empresa.neighborhood", "empresa.city", "empresa.state", "empresa.zipCode"], "contrato": ["contrato.prazoMeses", "contrato.startDate", "contrato.endDate", "contrato.rentAmount", "contrato.rentAmountExtenso", "contrato.dueDay", "contrato.readjustmentIndex", "contrato.readjustmentPeriodMonths", "contrato.guaranteeType", "contrato.guaranteeDescription", "contrato.isFianca", "contrato.penaltyDescription", "contrato.numeroVias", "contrato.dataAssinatura"], "locatario": ["contrato.tenantName", "contrato.tenantTaxId", "contrato.tenantStreet", "contrato.tenantNumber", "contrato.tenantComplement", "contrato.tenantNeighborhood", "contrato.tenantCity", "contrato.tenantState", "contrato.tenantZipCode"]}'::jsonb,
  NULL, now(), now(), NULL, false,
  'Locação não residencial (escritório/comercial) com locatária pessoa jurídica: qualificação PJ representada na forma de seus atos constitutivos, aluguel vencido no mês subsequente, encargos pagos direto ou reembolsados à locadora, benfeitorias, vedação de sublocação, garantia opcional. Lei 8.245/91.',
  '421642c8-e981-49c9-996c-b4bfabc22b52'
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE name = 'Locação Não Residencial - Locatária PJ' AND deleted_at IS NULL);

INSERT INTO company_alerts (company_id, severity, title, message, locked, created_by_name, action_url, action_label)
SELECT v.c::uuid, 'WARNING', v.t, v.m, false, 'Locação Conj 33 (JS-CONJ33-01)', v.u, v.l
FROM (VALUES
  (:'lm', 'Conj 33 (José Silva): definir quem paga - aportes lançados como mútuo KPL',
   'Locação do Conj 33 à José Silva Sociedade Individual de Advocacia (CNPJ 35.416.962/0001-00) desde 01/09/2026, R$ 10.000/mês, vencimento dia 05 do mês seguinte. Os aportes que incluem o aluguel estão lançados como mútuo KPL. Se o pagador no extrato for a José Silva: reclassificar a parte do aluguel (e do reembolso de condomínio/IPTU) para recebimento da José Silva. Se for a KPL: instrumento de pagamento por terceiro (CC art. 304) entre LM, KPL e José Silva, com mútuo José Silva x KPL (IOF). Sem isso, a José Silva não comprova o pagamento da despesa.',
   NULL, NULL),
  (:'lm', 'Conj 33 (José Silva): aluguéis de set e out/2026 fora do PIS/Cofins',
   'Receita de R$ 10.000/mês desde set/2026 (Lucro Real, competência): PIS/Cofins de R$ 925,00 por mês. Set/2026: DARF complementar com multa de mora e retificar a EFD-Contribuições de set/2026 já entregue. Out/2026: incluir no DARF com vencimento em 25/11/2026. Reembolsos de condomínio e IPTU ficam fora da receita.',
   NULL, NULL),
  (:'js', 'Regime tributário no cadastro: Lucro Presumido x Lucro Real informado',
   'O cadastro da José Silva no LEDGR está como Lucro Presumido, mas foi informado que a empresa tributa pelo Lucro Real. Confirmar o regime de 2026 (e anos anteriores) pelas declarações SPED entregues e corrigir o cadastro antes da auditoria. Define a dedutibilidade do aluguel do Conj 33 (LM, desde 01/09/2026) e o crédito de PIS/Cofins não cumulativo.',
   NULL, NULL)
) v(c, t, m, u, l)
WHERE NOT EXISTS (SELECT 1 FROM company_alerts a WHERE a.company_id = v.c::uuid AND a.title = v.t AND a.resolved_at IS NULL);
COMMIT;

\echo == Conferencia ==
SELECT name, type, is_active, is_default, length(content) AS tamanho FROM document_templates WHERE type::text = 'CONTRATO_LOCACAO' AND deleted_at IS NULL ORDER BY created_at;
SELECT left(c.legal_name, 30) AS empresa, left(a.title, 75) AS alerta FROM company_alerts a JOIN companies c ON c.id = a.company_id
 WHERE a.created_by_name = 'Locação Conj 33 (JS-CONJ33-01)' AND a.resolved_at IS NULL;