# scripts/seg/teste-isolamento-qa.ps1
# Suite de regressao de isolamento entre empresas (Fase 0A.9).
# Conta: qa.hotelsys@ledgr.local (Operador, vinculo so HOTELSYS). Ativar a conta antes; desativar ao final da sessao.
# Credencial lida de %USERPROFILE%\.ledgr\qa-hotelsys.cred.xml (DPAPI) - nenhuma senha neste arquivo.
# Uso: powershell -File scripts\seg\teste-isolamento-qa.ps1
param([string]$base = 'http://localhost:3000')
$HOT = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; $GRB = 'd0d70dc6-446c-430b-9f62-3f6e73db3874'
function Totp([string]$b32) {
  $alf = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  $bits = ($b32.ToUpper().TrimEnd('=').ToCharArray() | ForEach-Object { [Convert]::ToString($alf.IndexOf($_), 2).PadLeft(5, '0') }) -join ''
  $key = [byte[]]@(for ($i = 0; $i + 8 -le $bits.Length; $i += 8) { [Convert]::ToByte($bits.Substring($i, 8), 2) })
  $msg = [BitConverter]::GetBytes([long][Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 30)); [Array]::Reverse($msg)
  $h = (New-Object System.Security.Cryptography.HMACSHA1 (,$key)).ComputeHash($msg)
  $o = $h[19] -band 0x0f
  $v = (($h[$o] -band 0x7f) -shl 24) -bor (($h[$o + 1] -band 0xff) -shl 16) -bor (($h[$o + 2] -band 0xff) -shl 8) -bor ($h[$o + 3] -band 0xff)
  ($v % 1000000).ToString('000000')
}
$cred = Import-Clixml "$env:USERPROFILE\.ledgr\qa-hotelsys.cred.xml"
$lb = @{ email = $cred.UserName; password = $cred.GetNetworkCredential().Password } | ConvertTo-Json
$global:tok = $null
$global:desafio = $null
try {
  $r1 = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $lb
  if ($r1.requires2fa) {
    $global:desafio = $r1.challengeToken
    $seg = (Import-Clixml "$env:USERPROFILE\.ledgr\qa-hotelsys-2fa.xml").GetNetworkCredential().Password
    $vb = @{ challengeToken = $r1.challengeToken; code = (Totp $seg) } | ConvertTo-Json
    $r2 = Invoke-RestMethod -Method Post -Uri "$base/auth/2fa/verify" -ContentType 'application/json' -Body $vb
    $global:tok = $r2.access_token; $global:refresh = $r2.refresh_token
    $seg = $null; $vb = $null
  } else { $global:tok = $r1.access_token; $global:refresh = $r1.refresh_token }
} catch { Write-Host "ERRO no login da conta QA: $($_.Exception.Message)" -ForegroundColor Red }
$lb = $null; $cred = $null
$global:falhas = 0
function Teste($nome, $metodo, $rota, $esperado, $empresa = $HOT, $corpo = $null, $qtd = $null, $msg = $null) {
  $h = @{ Authorization = "Bearer $global:tok"; 'x-company-id' = $empresa }
  $st = 0; $conteudo = ''
  try {
    $p = @{ UseBasicParsing = $true; Method = $metodo; Uri = "$base$rota"; Headers = $h }
    if ($corpo) { $p.ContentType = 'application/json'; $p.Body = $corpo }
    $r = Invoke-WebRequest @p
    $st = [int]$r.StatusCode; $conteudo = $r.Content
  } catch { if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode } else { $st = -1 }; $conteudo = "$($_.ErrorDetails.Message)" }
  $ok = ($st -eq $esperado); $extra = ''
  if ($ok -and $null -ne $qtd) { $o = ConvertFrom-Json -InputObject $conteudo; $n = if ($null -eq $o) { 0 } else { @($o).Count }; $extra = " (itens=$n)"; if ($n -ne $qtd) { $ok = $false } }
  if ($ok -and $msg -and $conteudo -notmatch $msg) { $ok = $false; $extra = " (mensagem diferente: $conteudo)" }
  if (-not $ok) { $global:falhas++ }
  Write-Host ("{0,-6} esperado {1} | obtido {2}{3} | {4}" -f $(if ($ok) {'OK'} else {'FALHA'}), $esperado, $st, $extra, $nome) -ForegroundColor $(if ($ok) {'Green'} else {'Red'})
}
if ($global:tok) {
  Teste "Seletor lista so a Hotelsys"                 GET   "/companies/available"                 200 -qtd 1
  Teste "Listagem geral so a Hotelsys"                GET   "/companies"                           200 -qtd 1
  Teste "Abrir a propria empresa (Hotelsys)"          GET   "/companies/$HOT"                      200
  Teste "Abrir a GRB pelo ID"                         GET   "/companies/$GRB"                      404
  Teste "Buscar CNPJ parcial '1' (enumeracao)"        GET   "/companies/taxid/1"                   404
  Teste "Buscar GRB pelo CNPJ"                        GET   "/companies/taxid/06190032000183"      404
  Teste "Buscar Hotelsys pelo CNPJ"                   GET   "/companies/taxid/05736256000185"      200
  Teste "ESCALACAO: gravar competencia na GRB"        PATCH "/companies/$GRB/active-competencia"   404 -corpo '{"activeCompetencia":"2026-10-01"}'
  Teste "Ler competencia da GRB"                      GET   "/companies/$GRB/active-competencia"   404
  Teste "Header da GRB (/companies/me)"               GET   "/companies/me"                        404 -empresa $GRB
  Teste "Documentos da GRB pela query string"         GET   "/documents?companyId=$GRB"            404
  Teste "Documentos da propria empresa"               GET   "/documents"                           200
  Teste "Certificados da GRB pela query string"     GET   "/certificates?companyId=$GRB"          404
  Teste "Certificados da propria empresa"           GET   "/certificates"                         200
  Teste "Contratos da GRB pela query string"        GET   "/contratos?companyId=$GRB"             404
  Teste "Contratos da propria empresa"              GET   "/contratos"                            200
  $docGrb  = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM documents WHERE company_id = '$GRB' AND deleted_at IS NULL LIMIT 1;" | Out-String).Trim()
  $certGrb = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM certificates WHERE company_id = '$GRB' LIMIT 1;" | Out-String).Trim()
  if ($docGrb) {
    Teste "Documento da GRB por ID"                 GET   "/documents/${docGrb}"                  404
    Teste "Versoes de documento da GRB"             GET   "/documents/${docGrb}/versions"         404
    Teste "Contrato da GRB por ID"                  GET   "/contratos/${docGrb}"                  404
  } else { Write-Host "SEM DADOS - nenhum documento da GRB para testes por ID" -ForegroundColor DarkGray }
  if ($certGrb) {
    Teste "Certificado da GRB por ID (query GRB)"   GET   "/certificates/${certGrb}?companyId=${GRB}" 404
    Teste "Certificado da GRB por ID (sem query)"   GET   "/certificates/${certGrb}"              404
    Teste "Evict de certificado da GRB"             POST  "/certificates/${certGrb}/evict"        404
  } else { Write-Host "SEM DADOS - nenhum certificado da GRB para testes por ID" -ForegroundColor DarkGray }
  $qaId = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local';" | Out-String).Trim()
  $zero = '00000000-0000-0000-0000-000000000000'
  Teste "Proprio usuario (/users/me)"               GET    "/users/me"                                  200
  Teste "Listar usuarios"                           GET    "/users"                                     403
  Teste "Listar cadastros pendentes"                GET    "/users/pendentes"                           403
  Teste "ESCALACAO: aprovar cadastro como Master"   POST   "/users/${zero}/aprovar"                     403 -corpo '{"profileId":"61a30be0-010d-4b8e-8470-f775bfd871ee","level":0,"companyIds":[]}'
  Teste "ESCALACAO: editar usuario"                 PATCH  "/users/${zero}"                             403 -corpo '{}'
  Teste "Listar perfis (leitura liberada)"          GET    "/profiles"                                  200
  Teste "ESCALACAO: editar perfil"                  PATCH  "/profiles/${zero}"                          403 -corpo '{}'
  Teste "Resolver proprias permissoes de menu"      GET    "/sidebar-permissions/resolve"               200
  Teste "Ler permissoes de usuario"                 GET    "/sidebar-permissions/user/${qaId}"          403
  Teste "ESCALACAO: gravar permissoes proprias"     POST   "/sidebar-permissions/user/${qaId}/bulk"     403 -corpo '{"items":[]}'
  Teste "ESCALACAO: gravar permissoes de perfil"    POST   "/sidebar-permissions/profile/${zero}"       403 -corpo '{"items":[]}'
  Teste "ESCALACAO: remover permissao de usuario"   DELETE "/sidebar-permissions/user/${zero}/${zero}"  403
  Teste "Fechamento: conferir item inexistente/alheio"  PUT    "/finance/fechamento/itens/${zero}/conferir"            404 -corpo '{}'
  Teste "Fechamento: ignorar item inexistente/alheio"   PUT    "/finance/fechamento/itens/${zero}/ignorar"             404 -corpo '{}'
  # Seguranca 0A (04/10/2026): com o perfil na API, excluir exige nivel DELETE no recurso. Esperado pela regra:
  # QA com DELETE -> o pedido chega ao servico -> 404 (registro alheio/inexistente); sem DELETE -> 403 no guard.
  function NivelQa($recurso) {
    $q = "SELECT COALESCE((SELECT x.access_level::text FROM user_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.id = x.user_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' AND x.company_id = '$HOT' LIMIT 1), (SELECT x.access_level::text FROM user_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.id = x.user_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' AND x.company_id IS NULL LIMIT 1), (SELECT x.access_level::text FROM profile_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.profile_id = x.profile_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' LIMIT 1), 'NONE')"
    $n = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c $q) | Out-String).Trim(); if ($n) { $n } else { 'NONE' }
  }
  function EspDel($recurso) { if ((NivelQa $recurso) -eq 'DELETE') { 404 } else { 403 } }
  Teste "Provisao: excluir config inexistente/alheia"   DELETE "/finance/provisoes/configs/${zero}"                    $(EspDel 'provisoes')
  Teste "Provisao: conferir NF inexistente/alheia"      PUT    "/finance/provisoes/lancamentos/${zero}/conferir-nf"    404 -corpo '{}'
  Teste "Provisao: rateio em config inexistente/alheia" PUT    "/finance/provisoes/configs/${zero}/rateio/2026-10"     404 -corpo '{"rateios":[]}'
  Teste "Contas a pagar da propria empresa"             GET    "/finance/accounts-payable"                             200
  Teste "Comparativo de balancete da GRB (URL)"      GET    "/reports/balance-comparison/${GRB}?startMonth=2026-01&endMonth=2026-01"  404
  Teste "Plano de contas da GRB pela query string"     GET    "/accounting/accounts?companyId=${GRB}"                                   404
  Teste "Plano de contas da propria empresa"           GET    "/accounting/accounts"                                                    200
  $jeGrb  = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM journal_entries WHERE company_id = '$GRB' AND deleted_at IS NULL LIMIT 1;" | Out-String).Trim()
  $coaGrb = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM chart_of_accounts WHERE company_id = '$GRB' AND deleted_at IS NULL LIMIT 1;" | Out-String).Trim()
  $eqAlh  = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM equity_method_investments WHERE investor_company_id <> '$HOT' AND deleted_at IS NULL LIMIT 1;" | Out-String).Trim()
  if ($jeGrb)  { Teste "Lancamento da GRB por ID"               GET    "/accounting/journal/${jeGrb}"                 404 } else { Write-Host "SEM DADOS - lancamento da GRB" -ForegroundColor DarkGray }
  if ($coaGrb) { Teste "Conta do plano da GRB por ID"           GET    "/chart-of-accounts/${coaGrb}"                 404
                 Teste "Saldo de conta da GRB"                  GET    "/chart-of-accounts/${coaGrb}/balance"         404 } else { Write-Host "SEM DADOS - conta da GRB" -ForegroundColor DarkGray }
  if ($coaGrb) { Teste "Lancamento com conta do plano da GRB" POST "/accounting/journal" 400 -corpo ('{"date":"2026-10-01","description":"QA isolamento","items":[{"accountId":"' + $coaGrb + '","value":1,"type":"DEBIT"}]}') -msg 'nao pertence' }
  if ($eqAlh)  { Teste "MEP de outra investidora (historico)"   GET    "/accounting/equity-method/${eqAlh}/historico" 404 } else { Write-Host "SEM DADOS - MEP de outra investidora" -ForegroundColor DarkGray }
  Teste "Lancamento: alterar inexistente/alheio"       PUT    "/accounting/journal/${zero}"                       404 -corpo '{}'
  Teste "Plano de contas: excluir inexistente/alheia"  DELETE "/chart-of-accounts/${zero}"                        $(EspDel 'chart-of-accounts')
  Teste "MEP: excluir inexistente/alheio"              DELETE "/accounting/equity-method/${zero}"                 $(EspDel 'renda-fixa')
  Teste "Importar saldos (restrito ao Master)"         POST   "/accounting/import-balances"                       403 -corpo '{}'
  Teste "CDI: leitura liberada"                        GET    "/accounting/cdi/latest"                            200
  Teste "CDI GLOBAL: apagar taxa"                      DELETE "/accounting/cdi/2000-01-01"                        403
  Teste "CDI GLOBAL: importar taxas"                   POST   "/accounting/cdi/import"                            403 -corpo '{"rows":[]}'
  Teste "Matriz: leitura liberada"                     GET    "/accounting/matriz-master"                         200
  Teste "Matriz GLOBAL: alterar conta"                 PATCH  "/accounting/matriz-master/${zero}"                 403 -corpo '{}'
  Teste "2FA: status da propria conta"              GET    "/auth/2fa/me"                 200
  Teste "2FA: desafio invalido recusado"            POST   "/auth/2fa/verify"             401 -corpo '{"challengeToken":"invalido","code":"123456"}'
  Teste "2FA: reset de outro usuario (so Master)"   POST   "/auth/2fa/reset/${zero}"      403 -corpo '{}'
  if ($global:desafio) { Write-Host "OK     esperado desafio | obtido desafio | 2FA: login exige o segundo fator" -ForegroundColor Green } else { $global:falhas++; Write-Host "FALHA  2FA: login NAO exigiu o segundo fator" -ForegroundColor Red }
  $acesso = $global:tok; $global:tok = $global:desafio
  Teste "2FA: token de desafio NAO vale como acesso"  GET    "/users/me"                    401
  $global:tok = $acesso
  Teste "2FA: codigo errado recusado"                  POST   "/auth/2fa/verify"             401 -corpo (@{ challengeToken = $global:desafio; code = '000000' } | ConvertTo-Json)
  $projId = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN';" | Out-String).Trim()
  $opId = (docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT o.id FROM proj_operacoes o JOIN proj_projetos p ON p.id = o.projeto_id WHERE p.codigo = 'RECIFE-OCEAN' AND o.codigo = 'ANCORA';" | Out-String).Trim()
  Teste "Projetos: lista com concessao"                GET    "/projects"                                    200 -qtd 1
  Teste "Projetos: detalhe do projeto concedido"       GET    "/projects/${projId}"                          200
  Teste "Projetos: participacoes da Operacao Ancora"   GET    "/projects/operacoes/${opId}/participacoes"    200 -msg '"codigo":"ADQUIRENTE"'
  Teste "Projetos: creditos da Operacao Ancora"        GET    "/projects/operacoes/${opId}/creditos"         200 -msg '"numeroOrdem":1,'
  Teste "Projetos: resumo - 58 creditos conferidos"     GET    "/projects/operacoes/${opId}/resumo"           200 -msg '"conferido":true'
  Teste "Projetos: resumo - total historico exato"      GET    "/projects/operacoes/${opId}/resumo"           200 -msg '"totalAteDataBase":"3495791.15"'
  Teste "Projetos: VAL aparece como Conta Individual"   GET    "/projects/operacoes/${opId}/resumo"           200 -msg '"nome":"VAL INVESTIMENTOS S/A"'
  Teste "Projetos: resumo traz os pendentes de vinculo"    GET    "/projects/operacoes/${opId}/resumo"           200 -msg '"semVinculoTotal":'
  $rs = $null; try { $rs = Invoke-RestMethod -Uri "$base/projects/operacoes/${opId}/resumo" -Headers @{ Authorization = "Bearer $global:tok" } } catch {}
  $somaContas = 0; if ($rs) { foreach ($ci in @($rs.contasIndividuais)) { $somaContas += [decimal]$ci.total }; $somaContas += [decimal]$rs.desvinculados.total; $somaContas += [decimal]$rs.semVinculoTotal }
  if ($rs -and $somaContas -eq [decimal]$rs.totalGeral) { Write-Host ("OK     esperado fecha | obtido fecha ({0}) | Projetos: contas individuais + desvinculados + pendentes = total" -f $somaContas) -ForegroundColor Green } else { $global:falhas++; Write-Host ("FALHA  contas individuais + desvinculados ({0}) diferente do total ({1})" -f $somaContas, $rs.totalGeral) -ForegroundColor Red }
  Teste "Projetos: creditos trazem o vinculo vigente"     GET    "/projects/operacoes/${opId}/creditos"         200 -msg '"situacao":"VINCULADO"'
  Teste "Projetos: pendencias do projeto (sem extrato)"   GET    "/projects/operacoes/${opId}/pendencias"        200
  Teste "Financeiro: entradas da empresa ativa (LEDGR)"   GET    "/projects-financeiro/entradas"                 200
  Teste "Financeiro: encaminhar entrada (so Master)"       POST   "/projects-financeiro/entradas/${zero}/encaminhar" 403 -corpo '{}'
  Teste "Documentos: tipos"                              GET    "/projects/documento-tipos"                    200 -msg '"codigo":"TERMO"'
  Teste "Documentos: lista da operacao"                  GET    "/projects/operacoes/${opId}/documentos"        200
  Teste "Documentos: enviar (so Master)"                 POST   "/projects/operacoes/${opId}/documentos"        403 -corpo '{}'
  Teste "Documentos: baixar inexistente"                 GET    "/projects/operacoes/${opId}/documentos/${zero}/arquivo" 404
  Teste "Documentos: cancelar (so Master)"               POST   "/projects/operacoes/${opId}/documentos/${zero}/cancelar" 403 -corpo '{}'
  # Seguranca 0A (04/10/2026): /uploads so autenticado e com escopo de empresa (arquivo real da pasta)
  $arqReal = Get-ChildItem "$PSScriptRoot\..\..\apps\api\uploads\signatures", "$PSScriptRoot\..\..\apps\api\uploads" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($arqReal) {
    $sub = if ($arqReal.DirectoryName -match 'signatures$') { 'signatures/' } else { '' }
    $urlReal = "$base/uploads/$sub" + [uri]::EscapeDataString($arqReal.Name)
    $semLogin = try { (Invoke-WebRequest -UseBasicParsing $urlReal -TimeoutSec 5).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
    if ($semLogin -eq 401) { Write-Host "OK     esperado 401 | obtido 401 | Uploads: arquivo real sem login" -ForegroundColor Green } else { $global:falhas++; Write-Host "FALHA  esperado 401 | obtido $semLogin | Uploads: arquivo real sem login" -ForegroundColor Red }
    $comQa = try { (Invoke-WebRequest -UseBasicParsing $urlReal -Headers @{ Authorization = "Bearer $global:tok" } -TimeoutSec 5).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
    if ($comQa -eq 404) { Write-Host "OK     esperado 404 | obtido 404 | Uploads: arquivo sem registro, conta QA" -ForegroundColor Green } else { $global:falhas++; Write-Host "FALHA  esperado 404 | obtido $comQa | Uploads: arquivo sem registro, conta QA" -ForegroundColor Red }
  } else { Write-Host "SEM DADOS - nenhum arquivo em apps\api\uploads para testar" -ForegroundColor Yellow }
  Teste "Uploads: tentativa de sair da pasta"            GET    "/uploads/..%2F..%2F.env"                     404
  Teste "Cadastros: catalogo de papeis"                  GET    "/projects-cadastros/papeis"                   200 -msg '"codigo":"ADQUIRENTE"'
  Teste "Cadastros: empresas (so Master)"                GET    "/projects-cadastros/empresas"                 403
  Teste "Cadastros: editar projeto (so Master)"          POST   "/projects-cadastros/projetos/${projId}"       403 -corpo '{}'
  Teste "Cadastros: editar operacao (so Master)"         POST   "/projects-cadastros/operacoes/${opId}"        403 -corpo '{}'
  Teste "Cadastros: nova contraparte (so Master)"        POST   "/projects-cadastros/operacoes/${opId}/contrapartes" 403 -corpo '{}'
  Teste "Cadastros: nova participacao (so Master)"       POST   "/projects-cadastros/operacoes/${opId}/participacoes" 403 -corpo '{}'
  Teste "Cadastros: identificar remetente (so Master)"   POST   "/projects-cadastros/operacoes/${opId}/creditos/${zero}/remetente" 403 -corpo '{}'
  Teste "Saidas: lista da empresa ativa (LEDGR)"          GET    "/projects-financeiro/saidas"                  200
  Teste "Saidas: apoio a classificacao (so Master)"       GET    "/projects-financeiro/saidas/apoio"            403
  Teste "Saidas: registrar aplicacao (so Master)"         POST   "/projects-financeiro/saidas/${zero}/aplicar"  403 -corpo '{}'
  Teste "Saidas: transferencia interna (so Master)"       POST   "/projects-financeiro/saidas/${zero}/decidir"  403 -corpo '{}'
  Teste "Projetos: aplicacoes da operacao"                GET    "/projects/operacoes/${opId}/aplicacoes"        200
  Teste "Entradas: transferencia interna (so Master)"     POST   "/projects-financeiro/entradas/${zero}/decidir" 403 -corpo '{}'
  Teste "Circuitos neutros (so Master)"                   GET    "/projects-financeiro/circuitos"               403
  Teste "Decisoes: desfazer (so Master)"                  POST   "/projects-financeiro/decisoes/${zero}/encerrar" 403 -corpo '{}'
  Teste "Projetos: encerrar aplicacao (so Master)"        POST   "/projects/operacoes/${opId}/aplicacoes/${zero}/encerrar" 403 -corpo '{}'
  Teste "Projetos: resumo traz o saldo contratual"       GET    "/projects/operacoes/${opId}/resumo"           200 -msg '"saldoContratual":'
  Teste "Projetos: intercompany mensal"                  GET    "/projects/operacoes/${opId}/intercompany"     200 -msg '"meses":'
  Teste "Projetos: saldos informados"                    GET    "/projects/operacoes/${opId}/saldos-informados" 200
  Teste "Projetos: registrar saldo informado (so Master)" POST  "/projects/operacoes/${opId}/saldos-informados" 403 -corpo '{}'
  Teste "Projetos: encerrar saldo informado (so Master)" POST   "/projects/operacoes/${opId}/saldos-informados/${zero}/encerrar" 403 -corpo '{}'
  Teste "Relatorios: demonstrativo da Conta Individual"  GET    "/projects-relatorios/operacoes/${opId}/demonstrativo" 200 -msg '"linhas":'
  Teste "Relatorios: demonstrativo sem acesso"           GET    "/projects-relatorios/operacoes/${zero}/demonstrativo" 404
  Teste "Relatorios: historico (Consulta nao ve a trilha)" GET   "/projects-relatorios/operacoes/${opId}/historico"     403
  Teste "Relatorios: historico sem acesso"               GET    "/projects-relatorios/operacoes/${zero}/historico"     404
  Teste "Relatorios: painel executivo"                   GET    "/projects-relatorios/operacoes/${opId}/painel-executivo" 200 -msg '"pendencias":'
  Teste "Relatorios: painel executivo sem acesso"        GET    "/projects-relatorios/operacoes/${zero}/painel-executivo" 404
  Teste "Kit do Investidor (so Master)"                  GET    "/projects-relatorios/projetos/${projId}/kit-investidor" 403
  Teste "Kit do Investidor em PDF (so Master)"           GET    "/projects-relatorios/projetos/${projId}/kit-investidor/pdf" 403
  # Seguranca 0A (04/10/2026): escopo pela empresa DO REGISTRO (empresa sem vinculo com a QA, escolhida pela regra)
  $empOutra = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT c.id FROM companies c WHERE NOT EXISTS (SELECT 1 FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local' AND uc.company_id = c.id) ORDER BY c.legal_name LIMIT 1") | Out-String).Trim()
  $docOutra = if ($empOutra) { ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM documents WHERE company_id = '$empOutra' LIMIT 1") | Out-String).Trim() } else { '' }
  if ($empOutra) {
    Teste "Escopo: empresa sem vinculo por ID"                GET    "/companies/${empOutra}"                       404
    Teste "Escopo: competencia de empresa sem vinculo"        GET    "/companies/${empOutra}/active-competencia"    404
    $sP = try { (Invoke-WebRequest -UseBasicParsing "$base/persons/links/company/$empOutra" -Headers @{ Authorization = "Bearer $global:tok" } -TimeoutSec 10).StatusCode } catch { [int]$_.Exception.Response.StatusCode }
    if ($sP -in 403, 404) { Write-Host "OK     esperado 403/404 | obtido $sP | Escopo: vinculos de pessoas de empresa sem vinculo" -ForegroundColor Green } else { $global:falhas++; Write-Host "FALHA  esperado 403/404 | obtido $sP | Escopo: vinculos de pessoas de empresa sem vinculo" -ForegroundColor Red }
  } else { Write-Host "SEM DADOS - nenhuma empresa sem vinculo com a QA" -ForegroundColor Yellow }
  if ($docOutra) {
    Teste "Escopo: signatarios de documento de outra empresa" GET    "/signatures/documents/${docOutra}/signers"    404
    Teste "Escopo: situacao de documento de outra empresa"    GET    "/signatures/documents/${docOutra}/status"     404
  } else { Write-Host "SEM DADOS - nenhum documento de empresa sem vinculo com a QA" -ForegroundColor Yellow }
  Teste "Feriados: importar (so Master)"                      POST   "/calendar/holidays/import/2099"               403 -corpo '{}'
  Teste "Backup: restauracao de emergencia sem chave"         POST   "/system/backup/restore-emergency"             403 -corpo '{}'
  Teste "ClickSign: webhook sem assinatura"                   POST   "/signatures/clicksign/webhook"                403 -corpo '{}'
  # Seguranca 0A (04/10/2026): RH - leitura de registros de empresas SEM vinculo com a QA (escolhidos pela regra).
  # Passa com 403/404 ou 200 vazio (filtro aplicado). Em falha, mostra so codigo e tamanho, nunca o conteudo.
  function Isolado($nome, $rota) {
    $st = 0; $cont = ''
    try { $r = Invoke-WebRequest -UseBasicParsing "$base$rota" -Headers @{ Authorization = "Bearer $global:tok"; 'x-company-id' = $HOT } -TimeoutSec 30; $st = [int]$r.StatusCode; $cont = [string]$r.Content } catch { $st = [int]$_.Exception.Response.StatusCode }
    $vazio = ($st -eq 200) -and (@('', '[]', 'null', '{}') -contains $cont.Trim())
    if ($st -in 403, 404 -or $vazio) { Write-Host ("OK     esperado 403/404/vazio | obtido {0} | RH: {1}" -f $st, $nome) -ForegroundColor Green }
    else { $global:falhas++; Write-Host ("FALHA  esperado 403/404/vazio | obtido {0} ({1} bytes) | RH: {2}" -f $st, $cont.Length, $nome) -ForegroundColor Red }
  }
  $foraQa = "company_id NOT IN (SELECT uc.company_id FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local')"
  function IdFora($tabela) { ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM $tabela WHERE $foraQa LIMIT 1") | Out-String).Trim() }
  $rhEmp = IdFora 'employees'; $rhDec = IdFora 'decimo_terceiro'; $rhProg = IdFora 'programacoes_ferias'
  $rhInf = IdFora 'informes_rendimentos'; $rhPlc = IdFora 'pro_labore_calculos'; $rhRec = IdFora 'recessos_coletivos'
  if ($rhEmp) {
    Isolado "funcionario de outra empresa" "/hr/employees/$rhEmp"
    foreach ($sub in 'historico', 'afastamentos', 'ocorrencias', 'banco-horas') { Isolado "funcionario de outra empresa: $sub" "/hr/employees/$rhEmp/$sub" }
    Isolado "periodos de ferias de outra empresa" "/hr/ferias/periodos/$rhEmp"
    Isolado "eSocial S-2200 de outra empresa" "/hr/esocial/s2200/$rhEmp"
    Isolado "eSocial S-2299 de outra empresa" "/hr/esocial/s2299/$rhEmp"
  } else { Write-Host "SEM DADOS - nenhum funcionario de empresa sem vinculo com a QA" -ForegroundColor Yellow }
  if ($rhDec) { foreach ($f in 'html', 'pdf') { Isolado "recibo do 13o ($f) de outra empresa" "/hr/decimo-terceiro/$rhDec/recibo/1/$f" } } else { Write-Host "SEM DADOS - nenhum 13o de empresa sem vinculo" -ForegroundColor Yellow }
  if ($rhProg) { foreach ($d in 'aviso/html', 'aviso/pdf', 'recibo/html', 'recibo/pdf') { Isolado "ferias ($d) de outra empresa" "/hr/ferias/programacoes/$rhProg/$d" } } else { Write-Host "SEM DADOS - nenhuma programacao de ferias de empresa sem vinculo" -ForegroundColor Yellow }
  if ($rhInf) { Isolado "informe de rendimentos de outra empresa" "/hr/informes/$rhInf"; Isolado "informe de rendimentos (pdf) de outra empresa" "/hr/informes/$rhInf/pdf" } else { Write-Host "SEM DADOS - nenhum informe de empresa sem vinculo" -ForegroundColor Yellow }
  if ($rhPlc) { Isolado "guias do pro-labore de outra empresa" "/hr/pro-labore/calculos/$rhPlc/guias" } else { Write-Host "SEM DADOS - nenhum calculo de pro-labore de empresa sem vinculo" -ForegroundColor Yellow }
  if ($rhRec) { Isolado "recesso coletivo de outra empresa" "/hr/recesso/$rhRec/preview" } else { Write-Host "SEM DADOS - nenhum recesso de empresa sem vinculo" -ForegroundColor Yellow }
  # Seguranca 0A (04/10/2026): Documentos e Contratos - leitura de registros de empresas sem vinculo com a QA
  $docFora = IdFora 'documents'
  $tplFora = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM document_templates WHERE company_id IS NOT NULL AND $foraQa LIMIT 1") | Out-String).Trim()
  $tabContr = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'company_id' AND table_name LIKE 'contrato%' ORDER BY length(table_name) LIMIT 1") | Out-String).Trim()
  $ctrFora = if ($tabContr) { IdFora $tabContr } else { '' }
  if ($docFora) {
    Isolado "documento de outra empresa (leitura)" "/documents/$docFora"
    foreach ($sub in 'versions', 'pdf', 'preview', 'docx', 'signatures') { Isolado "documento de outra empresa: $sub" "/documents/$docFora/$sub" }
  } else { Write-Host "SEM DADOS - nenhum documento de empresa sem vinculo" -ForegroundColor Yellow }
  if ($tplFora) { Isolado "modelo de documento de outra empresa" "/document-templates/$tplFora"; Isolado "modelo de documento de outra empresa: docx" "/document-templates/$tplFora/docx" } else { Write-Host "SEM DADOS - nenhum modelo de documento de empresa sem vinculo" -ForegroundColor Yellow }
  # Contratos sao registros da tabela documents (DocumentScopeInterceptor no controller)
  if ($docFora) { Isolado "contrato (documento) de outra empresa" "/contratos/$docFora"; Isolado "versoes de contrato de outra empresa" "/contratos/$docFora/versions" }
  if ($empOutra) {
    Isolado "lista de documentos de outra empresa (filtro)" "/documents?companyId=$empOutra"
    Isolado "lista de contratos de outra empresa (filtro)" "/contratos?companyId=$empOutra"
  }
  # Seguranca 0A (04/10/2026): modelo GLOBAL (compartilhado por todas as empresas) so o Master altera.
  # Pede para ATIVAR um modelo ja ativo: mesmo se a protecao falhar, nada muda de fato.
  $tplGlobal = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT id FROM document_templates WHERE company_id IS NULL AND deleted_at IS NULL AND is_active LIMIT 1") | Out-String).Trim()
  if ($tplGlobal) { Teste "Modelos: alterar modelo global (so Master)"   PATCH  "/document-templates/${tplGlobal}/active"   403 -corpo '{"active":true}' }
  else { Write-Host "SEM DADOS - nenhum modelo global ativo" -ForegroundColor Yellow }
  # Seguranca 0A (04/10/2026): empresa pelo caminho/filtro e modulos contabeis (registros de empresas sem vinculo com a QA)
  function TabelaCom($padrao) { ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'company_id' AND table_name LIKE '$padrao' ORDER BY length(table_name) LIMIT 1") | Out-String).Trim() }
  if ($empOutra) {
    Isolado "historico de outra empresa" "/companies/$empOutra/history"
    Isolado "regimes tributarios de outra empresa" "/companies/$empOutra/tax-regimes"
    Isolado "socios de outra empresa" "/companies/$empOutra/shareholders"
    Isolado "comparativo de balancos de outra empresa" "/reports/balance-comparison/$empOutra"
    Isolado "plano de contas de outra empresa (filtro)" "/accounting/accounts?companyId=$empOutra"
    Isolado "certificados digitais de outra empresa (filtro)" "/certificates?companyId=$empOutra"
  }
  $visFora = IdFora 'accounting_views'
  if ($visFora) { Isolado "visao contabil de outra empresa" "/sped/visoes/views/$visFora/mappings"; Isolado "visao contabil de outra empresa (agrupada)" "/sped/visoes/views/$visFora/mappings/grouped" } else { Write-Host "SEM DADOS - nenhuma visao contabil de empresa sem vinculo" -ForegroundColor Yellow }
  $ecdFora = IdFora 'ecd_imports'
  if ($ecdFora) { Isolado "importacao de ECD de outra empresa" "/sped/ecd/viewer/$ecdFora" } else { Write-Host "SEM DADOS - nenhuma importacao de ECD de empresa sem vinculo" -ForegroundColor Yellow }
  Teste "Tabelas legais: excluir indicador (so Master)"      DELETE "/tabelas-legais/indicadores/${zero}"         403
  # Seguranca 0A (04/10/2026) - cadastro de pessoas, opcao A: pessoa vinculada SO a empresas sem relacao com a QA
  $pesFora = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c "SELECT p.id || '|' || p.cpf FROM persons p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM person_companies pc WHERE pc.person_id = p.id) AND NOT EXISTS (SELECT 1 FROM person_companies pc WHERE pc.person_id = p.id AND pc.$foraQa = false) LIMIT 1") | Out-String).Trim()
  if ($pesFora) {
    $pesId, $pesCpf = $pesFora -split '\|'
    Isolado "pessoa de outra empresa" "/persons/$pesId"
    Isolado "qualificacao de pessoa de outra empresa" "/persons/$pesId/qualificacao"
    foreach ($par in @(@("busca de pessoas pelo CPF de outra empresa (lista)", "/persons?search=$pesCpf"), @("consulta por CPF de pessoa de outra empresa", "/persons/cpf/$pesCpf"))) {
      $st = 0; $cont = ''
      try { $r = Invoke-WebRequest -UseBasicParsing ("$base" + $par[1]) -Headers @{ Authorization = "Bearer $global:tok"; 'x-company-id' = $HOT } -TimeoutSec 30; $st = [int]$r.StatusCode; $cont = [string]$r.Content } catch { $st = [int]$_.Exception.Response.StatusCode }
      if ($cont -notmatch [regex]::Escape($pesId)) { Write-Host ("OK     esperado sem os dados da pessoa | obtido {0} | Pessoas: {1}" -f $st, $par[0]) -ForegroundColor Green }
      else { $global:falhas++; Write-Host ("FALHA  esperado sem os dados da pessoa | obtido {0} ({1} bytes) | Pessoas: {2}" -f $st, $cont.Length, $par[0]) -ForegroundColor Red }
    }
  } else { Write-Host "SEM DADOS - nenhuma pessoa vinculada so a empresas sem relacao com a QA" -ForegroundColor Yellow }
  # Seguranca 0A (04/10/2026): perfil na API (regra: nivel da QA no recurso; NONE = 403; com leitura = 404 no id inexistente)
  function NivelQa($recurso) {
    $q = "SELECT COALESCE((SELECT x.access_level::text FROM user_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.id = x.user_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' AND x.company_id = '$HOT' LIMIT 1), (SELECT x.access_level::text FROM user_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.id = x.user_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' AND x.company_id IS NULL LIMIT 1), (SELECT x.access_level::text FROM profile_sidebar_permissions x JOIN sidebar_items i ON i.id = x.item_id JOIN users u ON u.profile_id = x.profile_id WHERE i.resource = '$recurso' AND u.email = 'qa.hotelsys@ledgr.local' LIMIT 1), 'NONE')"
    $n = ((docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -c $q) | Out-String).Trim(); if ($n) { $n } else { 'NONE' }
  }
  foreach ($c in @(@('employees', "/hr/employees/$zero"), @('folha', "/hr/informes/$zero"), @('ferias', "/hr/recesso/$zero/preview"), @('esocial', "/hr/esocial/s2200/$zero"))) {
    $nivel = NivelQa $c[0]; $esp = if ($nivel -eq 'NONE') { 403 } else { 404 }
    Teste ("Perfil na API: " + $c[0] + " (QA com nivel " + $nivel + ")") GET $c[1] $esp
  }
  # Prova do 403: restricao TEMPORARIA "sem acesso" na propria QA (substituicao por empresa tem precedencia) e remocao em seguida
  function OverrideQa($recurso, $nivel) {
    docker exec ledgr-postgres psql -U ledgr -d ledgr_app -q -c "DELETE FROM user_sidebar_permissions WHERE user_id = (SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local') AND item_id = (SELECT id FROM sidebar_items WHERE resource = '$recurso' LIMIT 1) AND company_id = '$HOT';" | Out-Null
    if ($nivel) { docker exec ledgr-postgres psql -U ledgr -d ledgr_app -q -c "INSERT INTO user_sidebar_permissions (id, user_id, item_id, company_id, access_level) SELECT gen_random_uuid(), u.id, i.id, '$HOT', '$nivel' FROM users u, sidebar_items i WHERE u.email = 'qa.hotelsys@ledgr.local' AND i.resource = '$recurso' LIMIT 1;" | Out-Null }
  }
  OverrideQa 'esocial' 'NONE'; OverrideQa 'certificates' 'NONE'
  Teste "Perfil na API: sem acesso ao eSocial = 403"            GET    "/hr/esocial/s2200/${zero}"                    403
  Teste "Perfil na API: sem acesso a certificados = 403"        GET    "/certificates"                                403
  OverrideQa 'esocial' $null; OverrideQa 'certificates' $null
  Teste "Perfil na API: certificados de novo com acesso"        GET    "/certificates"                                200
  Teste "Projetos: alterar vinculo (so Master)"           POST   "/projects/operacoes/${opId}/creditos/${zero}/vinculo" 403 -corpo '{}'
  Teste "Projetos: creditos de operacao inexistente"   GET    "/projects/operacoes/${zero}/creditos"         404
  Teste "Projetos: operacao inexistente/alheia"        GET    "/projects/operacoes/${zero}/participacoes"    404
  Teste "Projetos: ver concessoes (so Master)"         GET    "/projects/${projId}/concessoes"               403
  Teste "Projetos: conceder acesso (so Master)"        POST   "/projects/concessoes"                         403 -corpo '{}'
  Teste "Projetos: listar perfis (so Master)"           GET    "/projects/perfis"                             403
  docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "UPDATE proj_concessoes SET valido_ate = now() - interval '1 minute' WHERE user_id = (SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local') AND cancelado_em IS NULL;" | Out-Null
  Teste "Projetos: concessao vencida - lista vazia"    GET    "/projects"                                    200 -qtd 0
  Teste "Projetos: concessao vencida - operacao 404"   GET    "/projects/operacoes/${opId}/participacoes"    404
  Teste "Projetos: concessao vencida - creditos 404"    GET    "/projects/operacoes/${opId}/creditos"         404
  docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "UPDATE proj_concessoes SET valido_ate = NULL WHERE user_id = (SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local') AND cancelado_em IS NULL;" | Out-Null
  $rn = $null; try { $rn = Invoke-RestMethod -Method Post -Uri "$base/auth/refresh" -ContentType 'application/json' -Body (@{ refreshToken = $global:refresh } | ConvertTo-Json) } catch {}
  if ($rn.access_token -and $rn.refresh_token -and $rn.refresh_token -ne $global:refresh) { Write-Host "OK     esperado rotacao | obtido rotacao | Sessao: refresh valido renova e rotaciona" -ForegroundColor Green; $global:tok = $rn.access_token; $global:refresh = $rn.refresh_token } else { $global:falhas++; Write-Host "FALHA  Sessao: refresh valido nao renovou ou nao rotacionou" -ForegroundColor Red }
  Teste "Sessao: refresh invalido recusado"            POST   "/auth/refresh"                401 -corpo '{"refreshToken":"invalido"}'
  $acesso = $global:tok; $global:tok = ''
  Teste "Sessao: ?token= fora de SSE recusado"         GET    "/users/me?token=$acesso"      401
  $global:tok = $acesso
  Teste "Sessao: logout"                               POST   "/auth/logout"                 200 -corpo (@{ refreshToken = $global:refresh } | ConvertTo-Json)
  Teste "Sessao: refresh apos logout recusado"         POST   "/auth/refresh"                401 -corpo (@{ refreshToken = $global:refresh } | ConvertTo-Json)
  docker cp "$PSScriptRoot\teste-rls-proj.sql" ledgr-postgres:/tmp/teste-rls-proj.sql | Out-Null
  $rls = docker exec ledgr-postgres psql -U ledgr -d ledgr_app -tA -v ON_ERROR_STOP=1 -f /tmp/teste-rls-proj.sql 2>&1
  $esperado = [ordered]@{ sem_contexto = '0'; qa_projetos = '1'; qa_operacoes = '1'; qa_concessoes_de_outros = '0'; qa_update_operacoes = '0'; sem_contexto_creditos = '0'; qa_update_creditos = '0'; qa_update_vinculos = '0'; qa_update_provas = '0'; vinculo_imutavel = 'sim'; vinculo_delete = 'negado'; prova_delete = 'negado'; anotacoes_acesso_direto = 'negado'; qa_premissas = '0' }
  $obtido = @{}; foreach ($ln in $rls) { if ("$ln" -match '^(\w+)=(.*)$') { $obtido[$matches[1]] = $matches[2].Trim() } }
  foreach ($k in $esperado.Keys) { $okR = ($obtido[$k] -eq $esperado[$k]); if (-not $okR) { $global:falhas++ }; Write-Host ("{0,-6} esperado {1} | obtido {2} | RLS: {3}" -f $(if ($okR) {'OK'} else {'FALHA'}), $esperado[$k], $(if ($null -ne $obtido[$k]) { $obtido[$k] } else { '?' }), $k) -ForegroundColor $(if ($okR) {'Green'} else {'Red'}) }
  foreach ($par in @(@('qa_participacoes','total_participacoes'), @('qa_contrapartes','total_contrapartes'), @('qa_creditos','total_creditos'), @('qa_provas','total_provas'), @('qa_vinculos','total_vinculos'), @('qa_aplicacoes','total_aplicacoes'), @('qa_saldos','total_saldos'), @('master_projetos','total_projetos'), @('master_operacoes','total_operacoes'))) { $v = $obtido[$par[0]]; $t = $obtido[$par[1]]; $okP = ($null -ne $v -and $null -ne $t -and $v -eq $t); if (-not $okP) { $global:falhas++ }; Write-Host ("{0,-6} esperado {1} | obtido {2} | RLS: {3} = total real" -f $(if ($okP) {'OK'} else {'FALHA'}), $t, $v, $par[0]) -ForegroundColor $(if ($okP) {'Green'} else {'Red'}) }
  Write-Host ("`nResultado: {0}" -f $(if ($global:falhas -eq 0) {'TODOS OS TESTES PASSARAM'} else {"$global:falhas FALHA(S)"})) -ForegroundColor $(if ($global:falhas -eq 0) {'Green'} else {'Red'})
}
$global:tok = $null
docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "SELECT COUNT(*) AS vinculos_qa FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local';"