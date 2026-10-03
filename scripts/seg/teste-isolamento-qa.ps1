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
  Teste "Provisao: excluir config inexistente/alheia"   DELETE "/finance/provisoes/configs/${zero}"                    404
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
  Teste "Plano de contas: excluir inexistente/alheia"  DELETE "/chart-of-accounts/${zero}"                        404
  Teste "MEP: excluir inexistente/alheio"              DELETE "/accounting/equity-method/${zero}"                 404
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
  Teste "Projetos: participacoes da Operacao Ancora"   GET    "/projects/operacoes/${opId}/participacoes"    200 -qtd 5
  Teste "Projetos: operacao inexistente/alheia"        GET    "/projects/operacoes/${zero}/participacoes"    404
  Teste "Projetos: ver concessoes (so Master)"         GET    "/projects/${projId}/concessoes"               403
  Teste "Projetos: conceder acesso (so Master)"        POST   "/projects/concessoes"                         403 -corpo '{}'
  docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "UPDATE proj_concessoes SET valido_ate = now() - interval '1 minute' WHERE user_id = (SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local') AND cancelado_em IS NULL;" | Out-Null
  Teste "Projetos: concessao vencida - lista vazia"    GET    "/projects"                                    200 -qtd 0
  Teste "Projetos: concessao vencida - operacao 404"   GET    "/projects/operacoes/${opId}/participacoes"    404
  docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "UPDATE proj_concessoes SET valido_ate = NULL WHERE user_id = (SELECT id FROM users WHERE email = 'qa.hotelsys@ledgr.local') AND cancelado_em IS NULL;" | Out-Null
  $rn = $null; try { $rn = Invoke-RestMethod -Method Post -Uri "$base/auth/refresh" -ContentType 'application/json' -Body (@{ refreshToken = $global:refresh } | ConvertTo-Json) } catch {}
  if ($rn.access_token -and $rn.refresh_token -and $rn.refresh_token -ne $global:refresh) { Write-Host "OK     esperado rotacao | obtido rotacao | Sessao: refresh valido renova e rotaciona" -ForegroundColor Green; $global:tok = $rn.access_token; $global:refresh = $rn.refresh_token } else { $global:falhas++; Write-Host "FALHA  Sessao: refresh valido nao renovou ou nao rotacionou" -ForegroundColor Red }
  Teste "Sessao: refresh invalido recusado"            POST   "/auth/refresh"                401 -corpo '{"refreshToken":"invalido"}'
  $acesso = $global:tok; $global:tok = ''
  Teste "Sessao: ?token= fora de SSE recusado"         GET    "/users/me?token=$acesso"      401
  $global:tok = $acesso
  Teste "Sessao: logout"                               POST   "/auth/logout"                 200 -corpo (@{ refreshToken = $global:refresh } | ConvertTo-Json)
  Teste "Sessao: refresh apos logout recusado"         POST   "/auth/refresh"                401 -corpo (@{ refreshToken = $global:refresh } | ConvertTo-Json)
  Write-Host ("`nResultado: {0}" -f $(if ($global:falhas -eq 0) {'TODOS OS TESTES PASSARAM'} else {"$global:falhas FALHA(S)"})) -ForegroundColor $(if ($global:falhas -eq 0) {'Green'} else {'Red'})
}
$global:tok = $null
docker exec ledgr-postgres psql -U ledgr -d ledgr_app -c "SELECT COUNT(*) AS vinculos_qa FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local';"