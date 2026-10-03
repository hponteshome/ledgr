# scripts/seg/teste-isolamento-qa.ps1
# Suite de regressao de isolamento entre empresas (Fase 0A.9).
# Conta: qa.hotelsys@ledgr.local (Operador, vinculo so HOTELSYS). Ativar a conta antes; desativar ao final da sessao.
# Credencial lida de %USERPROFILE%\.ledgr\qa-hotelsys.cred.xml (DPAPI) - nenhuma senha neste arquivo.
# Uso: powershell -File scripts\seg\teste-isolamento-qa.ps1
param([string]$base = 'http://localhost:3000')
$HOT = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; $GRB = 'd0d70dc6-446c-430b-9f62-3f6e73db3874'
$cred = Import-Clixml "$env:USERPROFILE\.ledgr\qa-hotelsys.cred.xml"
$lb = @{ email = $cred.UserName; password = $cred.GetNetworkCredential().Password } | ConvertTo-Json
$global:tok = $null
try { $global:tok = (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $lb).access_token } catch { Write-Host "ERRO no login da conta QA: $($_.Exception.Message)" -ForegroundColor Red }
$lb = $null; $cred = $null
$global:falhas = 0
function Teste($nome, $metodo, $rota, $esperado, $empresa = $HOT, $corpo = $null, $qtd = $null) {
  $h = @{ Authorization = "Bearer $global:tok"; 'x-company-id' = $empresa }
  $st = 0; $conteudo = ''
  try {
    $p = @{ UseBasicParsing = $true; Method = $metodo; Uri = "$base$rota"; Headers = $h }
    if ($corpo) { $p.ContentType = 'application/json'; $p.Body = $corpo }
    $r = Invoke-WebRequest @p
    $st = [int]$r.StatusCode; $conteudo = $r.Content
  } catch { if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode } else { $st = -1 } }
  $ok = ($st -eq $esperado); $extra = ''
  if ($ok -and $null -ne $qtd) { $n = @($conteudo | ConvertFrom-Json).Count; $extra = " (itens=$n)"; if ($n -ne $qtd) { $ok = $false } }
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
  Teste "Provisao: excluir config inexistente/alheia"   DELETE "/finance/provisoes/configs/${zero}"                    404
  Teste "Provisao: conferir NF inexistente/alheia"      PUT    "/finance/provisoes/lancamentos/${zero}/conferir-nf"    404 -corpo '{}'
  Teste "Provisao: rateio em config inexistente/alheia" PUT    "/finance/provisoes/configs/${zero}/rateio/2026-10"     404 -corpo '{"rateios":[]}'
  Teste "Contas a pagar da propria empresa"             GET    "/finance/accounts-payable"                             200
  Write-Host ("`nResultado: {0}" -f $(if ($global:falhas -eq 0) {'TODOS OS TESTES PASSARAM'} else {"$global:falhas FALHA(S)"})) -ForegroundColor $(if ($global:falhas -eq 0) {'Green'} else {'Red'})
}
$global:tok = $null
docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "SELECT COUNT(*) AS vinculos_qa FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local';"