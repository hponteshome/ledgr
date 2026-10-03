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
  Write-Host ("`nResultado: {0}" -f $(if ($global:falhas -eq 0) {'TODOS OS TESTES PASSARAM'} else {"$global:falhas FALHA(S)"})) -ForegroundColor $(if ($global:falhas -eq 0) {'Green'} else {'Red'})
}
$global:tok = $null
docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "SELECT COUNT(*) AS vinculos_qa FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local';"