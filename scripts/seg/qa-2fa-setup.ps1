# scripts/seg/qa-2fa-setup.ps1
# Ativa (ou reativa) o 2FA da conta de teste qa.hotelsys@ledgr.local POR SCRIPT, guardando o segredo TOTP
# cifrado (DPAPI) em %USERPROFILE%\.ledgr\qa-hotelsys-2fa.xml para a suite gerar os codigos sozinha.
# Uso (API no ar e conta QA ativa): powershell -File scripts\seg\qa-2fa-setup.ps1
param([string]$base = 'http://localhost:3000')
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
$sql = "BEGIN; INSERT INTO audit_logs (actor_id, acao, target_id, depois) SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'), '2FA_RESET', u.id::text, jsonb_build_object('motivo', 'Reconfiguracao por script da conta de teste (suite)') FROM users u WHERE u.email = 'qa.hotelsys@ledgr.local'; UPDATE users SET two_factor_secret = NULL, two_factor_active = false, two_factor_enabled_at = NULL, two_factor_recovery_codes = '{}', two_factor_trust_version = two_factor_trust_version + 1, failed_attempts = 0, blocked_until = NULL WHERE email = 'qa.hotelsys@ledgr.local'; COMMIT;"
docker exec ledgr-postgres psql -U ledgr -d ledgr_app -v ON_ERROR_STOP=1 -c $sql | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERRO ao reiniciar o 2FA da conta QA" -ForegroundColor Red; exit 1 }
$cred = Import-Clixml "$env:USERPROFILE\.ledgr\qa-hotelsys.cred.xml"
$lb = @{ email = $cred.UserName; password = $cred.GetNetworkCredential().Password } | ConvertTo-Json
try {
  $tok = (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $lb).access_token
  $h = @{ Authorization = "Bearer $tok" }
  $cfg = Invoke-RestMethod -Method Post -Uri "$base/auth/2fa/me/setup" -Headers $h
  $ativ = Invoke-RestMethod -Method Post -Uri "$base/auth/2fa/me/activate" -Headers $h -ContentType 'application/json' -Body (@{ code = (Totp $cfg.secret) } | ConvertTo-Json)
  $c2 = New-Object System.Management.Automation.PSCredential ('qa-2fa', (ConvertTo-SecureString $cfg.secret -AsPlainText -Force))
  $c2 | Export-Clixml -Path "$env:USERPROFILE\.ledgr\qa-hotelsys-2fa.xml"
  Write-Host ("OK - 2FA da conta QA ativado por script ({0} codigos de recuperacao descartados: conta de teste)" -f $ativ.recoveryCodes.Count) -ForegroundColor Green
  Write-Host "OK - segredo TOTP cifrado (DPAPI) em $env:USERPROFILE\.ledgr\qa-hotelsys-2fa.xml" -ForegroundColor Green
} catch { Write-Host "ERRO: $($_.Exception.Message) $($_.ErrorDetails.Message)" -ForegroundColor Red; exit 1 }
finally { $cred = $null; $lb = $null; $cfg = $null; $c2 = $null }