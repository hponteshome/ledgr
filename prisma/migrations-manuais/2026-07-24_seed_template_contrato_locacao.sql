INSERT INTO document_templates (id, company_id, type, name, description, content, variables, is_active, created_by_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  NULL,
  'CONTRATO_LOCACAO',
  'Contrato de Locação Residencial - Padrão',
  'Template padrão de contrato de locação residencial, com placeholders para locador (empresa ativa), locatário, imóvel e condições do contrato. Baseado na Lei 8.245/91.',
  $TPL$<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 40px 50px; }
  h1 { text-align: center; font-size: 13pt; text-decoration: underline; margin-bottom: 30px; }
  h2 { font-size: 12pt; text-decoration: underline; margin-top: 24px; margin-bottom: 8px; }
  p { text-align: justify; margin: 0 0 12px 0; }
  .paragrafo { margin-left: 20px; }
  .assinaturas { margin-top: 60px; text-align: center; }
  .linha-assinatura { margin-top: 50px; border-top: 1px solid #000; width: 320px; display: inline-block; padding-top: 4px; }
  .testemunhas { margin-top: 50px; }
  .testemunha { display: inline-block; width: 45%; vertical-align: top; }
</style>

<h1>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL</h1>

<p>Pelo presente instrumento particular, e na melhor forma de direito, de um lado como <strong>LOCADOR(A)</strong>, <strong>{{empresa.legalName}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>{{empresa.taxId}}</strong>, com sede na {{empresa.street}}, nº {{empresa.number}}{{#if empresa.complement}}, {{empresa.complement}}{{/if}}, {{empresa.neighborhood}}, {{empresa.city}} – {{empresa.state}}, CEP {{empresa.zipCode}}, doravante denominada simplesmente LOCADORA;</p>

<p>e de outro lado como <strong>LOCATÁRIO(A)</strong>, <strong>{{contrato.tenantName}}</strong>{{#if contrato.tenantNationality}}, {{contrato.tenantNationality}}{{/if}}{{#if contrato.tenantMaritalStatus}}, {{contrato.tenantMaritalStatus}}{{/if}}{{#if contrato.tenantProfession}}, {{contrato.tenantProfession}}{{/if}}{{#if contrato.tenantRg}}, portador(a) da Cédula de Identidade RG nº {{contrato.tenantRg}}{{/if}}{{#if contrato.tenantTaxId}}, inscrito(a) no CPF/CNPJ sob o nº {{contrato.tenantTaxId}}{{/if}}{{#if contrato.tenantStreet}}, residente e domiciliado(a) na {{contrato.tenantStreet}}, nº {{contrato.tenantNumber}}{{#if contrato.tenantComplement}}, {{contrato.tenantComplement}}{{/if}}, {{contrato.tenantNeighborhood}}, CEP {{contrato.tenantZipCode}}, na cidade de {{contrato.tenantCity}} – {{contrato.tenantState}}{{/if}}, doravante denominado(a) simplesmente LOCATÁRIO(A);</p>

<p>têm, entre si, justo e contratado, na melhor forma de direito, a locação do imóvel abaixo mencionado, mediante as cláusulas e condições seguintes, regendo-se o presente instrumento pela Lei nº 8.245, de 18 de outubro de 1991 (Lei do Inquilinato):</p>

<h2>CLÁUSULA PRIMEIRA — DO OBJETO</h2>
<p>O presente contrato tem por objeto a locação do imóvel situado à {{imovel.street}}, nº {{imovel.number}}{{#if imovel.complement}}, {{imovel.complement}}{{/if}}, {{imovel.neighborhood}}, {{imovel.city}} – {{imovel.state}}, CEP {{imovel.zipCode}}{{#if imovel.registryNumber}}, objeto da matrícula nº {{imovel.registryNumber}}{{#if imovel.registryOffice}} do {{imovel.registryOffice}}{{/if}}{{/if}} ("Imóvel"), destinado exclusivamente para fins residenciais, vedado o uso para qualquer outra finalidade sem prévia e expressa autorização da LOCADORA.</p>
<p class="paragrafo"><em>Parágrafo único</em> — O(A) LOCATÁRIO(A) declara ter vistoriado o Imóvel e recebê-lo em perfeitas condições de uso, conservação e limpeza, obrigando-se a restituí-lo nas mesmas condições, ressalvado o desgaste natural decorrente do uso regular.</p>

<h2>CLÁUSULA SEGUNDA — DO PRAZO CONTRATUAL</h2>
<p>O prazo do presente contrato é de {{contrato.prazoMeses}} meses, iniciando-se no dia <strong>{{contrato.startDate}}</strong>, para terminar no dia <strong>{{contrato.endDate}}</strong>, data em que o(a) LOCATÁRIO(A), independentemente de qualquer aviso ou interpelação, obriga-se a devolver o Imóvel ora locado inteiramente livre e desocupado de pessoas e coisas.</p>
<p class="paragrafo"><em>Parágrafo único</em> — Findo o prazo contratual sem manifestação em contrário de qualquer das partes, e permanecendo o(a) LOCATÁRIO(A) no Imóvel, a locação prorrogar-se-á por prazo indeterminado, nos termos do art. 46, §1º, da Lei do Inquilinato.</p>

<h2>CLÁUSULA TERCEIRA — DO VALOR DO ALUGUEL E FORMA DE PAGAMENTO</h2>
<p>O valor do aluguel mensal será de <strong>{{contrato.rentAmount}} ({{contrato.rentAmountExtenso}})</strong>, a ser pago pelo(a) LOCATÁRIO(A) até o dia <strong>{{contrato.dueDay}}</strong> de cada mês, mediante depósito ou transferência bancária em conta indicada pela LOCADORA, valendo o comprovante como recibo de pagamento.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> — O eventual pagamento do aluguel fora do prazo estabelecido sujeitará o(a) LOCATÁRIO(A) ao pagamento de multa de 2% (dois por cento) sobre o valor devido, além de juros de mora de 1% (um por cento) ao mês, calculados dia a dia, pro rata tempore, até a data do efetivo pagamento.</p>
{{#if contrato.readjustmentIndex}}
<p class="paragrafo"><em>Parágrafo segundo</em> — O valor do aluguel será reajustado a cada {{contrato.readjustmentPeriodMonths}} meses, ou com a menor periodicidade legalmente permitida, de acordo com a variação do {{contrato.readjustmentIndex}}, ou, na falta deste, pelo índice que melhor reflita a desvalorização da moeda, um na falta do outro, nesta ordem.</p>
{{/if}}

<h2>CLÁUSULA QUARTA — DAS DESPESAS</h2>
<p>As despesas condominiais ordinárias e os tributos e taxas incidentes sobre o Imóvel, inclusive IPTU, serão pagos diretamente pelo(a) LOCATÁRIO(A), que deverá enviar os respectivos comprovantes de pagamento à LOCADORA sempre que solicitado, sob pena de constituição em mora e rescisão do contrato.</p>
<p class="paragrafo"><em>Parágrafo único</em> — Ficarão igualmente por conta do(a) LOCATÁRIO(A) todas as despesas relativas a consumo de água, esgoto, energia elétrica, gás, telefone e internet, devendo ser pagas diretamente aos respectivos fornecedores, não respondendo a LOCADORA pela falta ou falha na prestação desses serviços.</p>

<h2>CLÁUSULA QUINTA — DA MANUTENÇÃO</h2>
<p>O(A) LOCATÁRIO(A) obriga-se a manter o Imóvel em perfeita ordem e condições de uso, respondendo pela conservação de pintura, aparelhos sanitários, portas, fechos, vidros, azulejos, pisos, torneiras e instalações hidráulicas e elétricas, devolvendo-o, ao término da locação, em perfeitas condições de uso, ressalvado o desgaste natural decorrente do uso regular.</p>

<h2>CLÁUSULA SEXTA — DA GARANTIA</h2>
{{#if contrato.guaranteeType}}
{{#if contrato.isFianca}}
<p>A presente locação conta com fiança, assinando também este contrato, na qualidade de <strong>FIADOR(A)</strong>, solidariamente responsável por todas as obrigações principais e acessórias assumidas pelo(a) LOCATÁRIO(A): {{contrato.guaranteeDescription}}.</p>
<p class="paragrafo"><em>Parágrafo primeiro</em> — Declara, outrossim, o(a) FIADOR(A) que renuncia expressamente aos direitos e benefícios estabelecidos nos artigos 827, 828, 835, 838 e 839 do Código Civil.</p>
<p class="paragrafo"><em>Parágrafo segundo</em> — Ocorrendo morte ou insolvência do(a) FIADOR(A), o(a) LOCATÁRIO(A) obriga-se a providenciar, no prazo de 30 (trinta) dias a contar do fato, nova garantia idônea a juízo da LOCADORA, sob pena de rescisão automática do contrato.</p>
{{else}}
<p>A locação conta com garantia na modalidade de <strong>{{contrato.guaranteeType}}</strong>{{#if contrato.guaranteeDescription}}, nos seguintes termos: {{contrato.guaranteeDescription}}{{/if}}, nos termos do art. 37 da Lei do Inquilinato.</p>
{{/if}}
{{else}}
<p>As partes dispensam, de comum acordo, a exigência de garantia locatícia prevista no art. 37 da Lei do Inquilinato.</p>
{{/if}}

<h2>CLÁUSULA SÉTIMA — DA MULTA E RESCISÃO</h2>
{{#if contrato.penaltyDescription}}
<p>{{contrato.penaltyDescription}}</p>
{{else}}
<p>A infração de qualquer cláusula deste contrato, bem como a rescisão antecipada por qualquer das partes sem justa causa, sujeitará a parte infratora ao pagamento de multa proporcional ao período restante do contrato, nos termos do art. 4º da Lei do Inquilinato, sem prejuízo das perdas e danos cabíveis.</p>
{{/if}}

<h2>CLÁUSULA OITAVA — DO FORO</h2>
<p>As partes contratantes obrigam-se por si, seus herdeiros e sucessores, a cumprir e fazer cumprir, a todo o tempo e em todos os seus termos, tudo quanto aqui pactuaram, ficando eleito o Foro da comarca de {{empresa.city}} – {{empresa.state}}, com exclusão de qualquer outro, por mais privilegiado que seja, para nele serem dirimidas as dúvidas ou questões oriundas deste instrumento.</p>
<p class="paragrafo"><em>Parágrafo único</em> — As partes convencionam que as citações, intimações ou notificações, enfim, quaisquer atos que visem dar conhecimento de procedimentos judiciais e extrajudiciais, poderão ser feitos pelos Correios, com aviso de recebimento ("AR").</p>

<p>E, por estarem justas e contratadas, as partes assinam o presente instrumento em {{contrato.numeroVias}} vias de igual teor e forma, na presença das testemunhas abaixo.</p>

<p style="text-align:center; margin-top: 30px;">{{empresa.city}}, {{contrato.dataAssinatura}}.</p>

<div class="assinaturas">
  <div class="linha-assinatura">
    <strong>{{empresa.legalName}}</strong><br>Locadora
  </div>
  <br><br>
  <div class="linha-assinatura">
    <strong>{{contrato.tenantName}}</strong><br>Locatário(a)
  </div>
  {{#if contrato.isFianca}}
  <br><br>
  <div class="linha-assinatura">
    Fiador(a)
  </div>
  {{/if}}
</div>

<div class="testemunhas">
  <p><strong>TESTEMUNHAS:</strong></p>
  <div class="testemunha">
    1.____________________________<br>
    Nome:<br>RG:<br>CPF:
  </div>
  <div class="testemunha">
    2.____________________________<br>
    Nome:<br>RG:<br>CPF:
  </div>
</div>
$TPL$,
  '{"locador": ["empresa.legalName","empresa.taxId","empresa.street","empresa.number","empresa.complement","empresa.neighborhood","empresa.city","empresa.state","empresa.zipCode"], "locatario": ["contrato.tenantName","contrato.tenantNationality","contrato.tenantMaritalStatus","contrato.tenantProfession","contrato.tenantRg","contrato.tenantTaxId","contrato.tenantStreet","contrato.tenantNumber","contrato.tenantComplement","contrato.tenantNeighborhood","contrato.tenantCity","contrato.tenantState","contrato.tenantZipCode"], "imovel": ["imovel.street","imovel.number","imovel.complement","imovel.neighborhood","imovel.city","imovel.state","imovel.zipCode","imovel.registryNumber","imovel.registryOffice"], "contrato": ["contrato.prazoMeses","contrato.startDate","contrato.endDate","contrato.rentAmount","contrato.rentAmountExtenso","contrato.dueDay","contrato.readjustmentIndex","contrato.readjustmentPeriodMonths","contrato.guaranteeType","contrato.guaranteeDescription","contrato.isFianca","contrato.penaltyDescription","contrato.numeroVias","contrato.dataAssinatura"]}'::jsonb,
  true,
  '421642c8-e981-49c9-996c-b4bfabc22b52',
  now(),
  now()
);
