# scripts/controle/sessao.ps1
# Controle de execucao do dominio Projetos - planejado x realizado (bussola, secao 14).
# Uso:
#   powershell -File scripts\controle\sessao.ps1 inicio -Fase 0A -Item "Isolamento Financeiro e Bancos"
#   powershell -File scripts\controle\sessao.ps1 fim -Obs "resumo da sessao"
#   powershell -File scripts\controle\sessao.ps1 concluir -Fase 0A -Obs "criterio de saida atendido"
#   powershell -File scripts\controle\sessao.ps1 status
#   powershell -File scripts\controle\sessao.ps1 relatorio
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet('inicio', 'fim', 'concluir', 'status', 'relatorio')][string]$acao,
  [string]$Fase = '', [string]$Item = '', [string]$Obs = ''
)
$inv = [System.Globalization.CultureInfo]::InvariantCulture
$fmt = 'yyyy-MM-dd HH:mm'
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$csv = Join-Path $raiz 'docs\controle-execucao.csv'
$aberta = Join-Path $env:USERPROFILE '.ledgr\sessao-aberta.txt'
# Linha de base congelada em 02/10/2026 (bussola, secao 14) - nao alterar
$plan = [ordered]@{ '0A' = @(50, 85); '0B' = @(15, 30); '1' = @(130, 210); '2' = @(120, 190); '3' = @(150, 240); '4' = @(60, 120) }
if (-not (Test-Path $csv)) { [System.IO.File]::WriteAllText($csv, "tipo|fase|item|inicio|fim|horas|obs`r`n", (New-Object System.Text.UTF8Encoding($false))) }
function Linha($campos) { Add-Content -Path $csv -Value (($campos | ForEach-Object { ("$_" -replace '\|', '/') }) -join '|') -Encoding UTF8 }
switch ($acao) {
  'inicio' {
    if (-not $Fase -or -not $plan.Contains($Fase)) { Write-Host "Informe -Fase valida: $($plan.Keys -join ', ')" -ForegroundColor Red; break }
    if (Test-Path $aberta) { Write-Host "Ja existe sessao aberta: $(Get-Content $aberta). Feche com 'fim' antes." -ForegroundColor Red; break }
    New-Item -ItemType Directory -Force -Path (Split-Path $aberta) | Out-Null
    $agora = (Get-Date).ToString($fmt, $inv)
    Set-Content -Path $aberta -Value "$Fase|$Item|$agora" -Encoding UTF8
    Write-Host "Sessao iniciada: fase $Fase | $Item | $agora" -ForegroundColor Green
  }
  'fim' {
    if (-not (Test-Path $aberta)) { Write-Host "Nenhuma sessao aberta." -ForegroundColor Red; break }
    $f, $i, $ini = (Get-Content $aberta -Raw).Trim() -split '\|', 3
    $dIni = [datetime]::ParseExact($ini, $fmt, $inv); $dFim = Get-Date
    $h = [math]::Round(($dFim - $dIni).TotalHours, 2).ToString($inv)
    Linha @('SESSAO', $f, $i, $ini, $dFim.ToString($fmt, $inv), $h, $Obs)
    Remove-Item $aberta -Force
    Write-Host "Sessao encerrada: fase $f | $h h | $ini -> $($dFim.ToString($fmt, $inv))" -ForegroundColor Green
  }
  'concluir' {
    if (Test-Path $aberta) { Write-Host "Feche a sessao aberta com 'fim' antes de concluir a fase." -ForegroundColor Red; break }
    if (-not $Fase -or -not $plan.Contains($Fase)) { Write-Host "Informe -Fase valida: $($plan.Keys -join ', ')" -ForegroundColor Red; break }
    $agora = (Get-Date).ToString($fmt, $inv)
    Linha @('CONCLUSAO', $Fase, '', '', $agora, '', $Obs)
    Write-Host "Fase $Fase concluida em $agora" -ForegroundColor Green
    & $PSCommandPath relatorio
  }
  'status' { if (Test-Path $aberta) { "Sessao aberta: $(Get-Content $aberta)" } else { "Nenhuma sessao aberta." } }
  'relatorio' {
    $reg = Import-Csv -Path $csv -Delimiter '|'
    $tot = 0.0
    $linhas = foreach ($k in $plan.Keys) {
      $h = ($reg | Where-Object { $_.tipo -eq 'SESSAO' -and $_.fase -eq $k } | ForEach-Object { [double]::Parse($_.horas, $inv) } | Measure-Object -Sum).Sum
      if (-not $h) { $h = 0 }; $tot += $h
      $c = $reg | Where-Object { $_.tipo -eq 'CONCLUSAO' -and $_.fase -eq $k } | Select-Object -Last 1
      $min, $max = $plan[$k]
      $sit = if ($h -eq 0) { '-' } elseif (-not $c) { 'em andamento' } elseif ($h -lt $min) { 'abaixo' } elseif ($h -le $max) { 'dentro' } else { 'ACIMA' }
      [pscustomobject]@{ Fase = $k; Planejado = "$min-$max h"; Realizado = ('{0:N1} h' -f $h); Situacao = $sit; Conclusao = $(if ($c) { $c.fim } else { '' }) }
    }
    $linhas | Format-Table -AutoSize
    "Total realizado: {0:N1} h  |  Planejado total: 525-875 h" -f $tot
  }
}