# scripts/controle/sessao.ps1
# Controle de execucao do dominio Projetos - planejado x realizado (bussola, secao 14).
# Uso:
#   powershell -File scripts\controle\sessao.ps1 inicio -Fase 0A -Item "Isolamento Financeiro e Bancos"
#   powershell -File scripts\controle\sessao.ps1 fim -Obs "resumo da sessao" [-Fim "15:00" | -Fim "2026-10-05 15:00"] [-Simular]
#   powershell -File scripts\controle\sessao.ps1 concluir -Fase 0A -Obs "criterio de saida atendido"
#   powershell -File scripts\controle\sessao.ps1 status
#   powershell -File scripts\controle\sessao.ps1 relatorio
# 06/10/2026: sessao com mais de 4 h fecha no horario do ultimo commit de trabalho feito depois do inicio (ignora
# "docs(controle)"); sem commit, pede -Fim. 'inicio' com sessao aberta encerra a anterior por esse criterio.
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet('inicio', 'fim', 'concluir', 'status', 'relatorio')][string]$acao,
  [string]$Fase = '', [string]$Item = '', [string]$Obs = '', [string]$Fim = '', [switch]$Simular
)
$inv = [System.Globalization.CultureInfo]::InvariantCulture
$fmt = 'yyyy-MM-dd HH:mm'
$LIMITE_H = 4
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$csv = Join-Path $raiz 'docs\controle-execucao.csv'
$aberta = Join-Path $env:USERPROFILE '.ledgr\sessao-aberta.txt'
# Linha de base congelada em 02/10/2026 (bussola, secao 14) - nao alterar
$plan = [ordered]@{ '0A' = @(50, 85); '0B' = @(15, 30); '1' = @(130, 210); '2' = @(120, 190); '3' = @(150, 240); '4' = @(60, 120) }
if (-not (Test-Path $csv)) { [System.IO.File]::WriteAllText($csv, "tipo|fase|item|inicio|fim|horas|obs`r`n", (New-Object System.Text.UTF8Encoding($false))) }
function Linha($campos) { Add-Content -Path $csv -Value (($campos | ForEach-Object { ("$_" -replace '\|', '/') }) -join '|') -Encoding UTF8 }

# Fim da sessao: -Fim explicito > hora atual (sessao curta) > ultimo commit de trabalho (sessao longa). $null = nao foi possivel.
function FimDaSessao([datetime]$dIni) {
  if ($Fim) {
    $t = $Fim.Trim()
    try {
      if ($t -match '^\d{1,2}:\d{2}$') { $d = [datetime]::ParseExact($dIni.ToString('yyyy-MM-dd', $inv) + ' ' + $t.PadLeft(5, '0'), $fmt, $inv) }
      else { $d = [datetime]::ParseExact($t, $fmt, $inv) }
    } catch { Write-Host "-Fim invalido: use HH:mm ou AAAA-MM-DD HH:mm." -ForegroundColor Red; return $null }
    if ($d -le $dIni) { Write-Host "-Fim ($($d.ToString($fmt, $inv))) precisa ser depois do inicio ($($dIni.ToString($fmt, $inv)))." -ForegroundColor Red; return $null }
    return @{ fim = $d; origem = 'informado (-Fim)' }
  }
  $agora = Get-Date
  if (($agora - $dIni).TotalHours -le $LIMITE_H) { return @{ fim = $agora; origem = 'hora atual' } }
  $desde = $dIni.ToString('yyyy-MM-ddTHH:mm:ss', $inv)
  $log = & git -C $raiz log --since="$desde" --format='%cI|%s' 2>$null
  $ultimo = $log | Where-Object { $_ -and ($_ -split '\|', 2)[1] -notmatch '^docs\(controle\)' } | Select-Object -First 1
  if (-not $ultimo) {
    Write-Host ("Sessao com mais de {0} h e sem commit de trabalho desde o inicio. Informe o horario real: -Fim ""HH:mm""" -f $LIMITE_H) -ForegroundColor Yellow
    return $null
  }
  $d = ([datetimeoffset]::Parse(($ultimo -split '\|', 2)[0], $inv)).LocalDateTime
  $d = [datetime]::ParseExact($d.ToString($fmt, $inv), $fmt, $inv)
  if ($d -le $dIni) { $d = $dIni.AddMinutes(1) }
  return @{ fim = $d; origem = "ultimo commit de trabalho: $(($ultimo -split '\|', 2)[1])" }
}

# Encerra a sessao aberta. Retorna $true se encerrou (ou simulou), $false se nao foi possivel.
function Encerrar([string]$obsTexto) {
  $f, $i, $ini = (Get-Content $aberta -Raw).Trim() -split '\|', 3
  $dIni = [datetime]::ParseExact($ini, $fmt, $inv)
  $r = FimDaSessao $dIni
  if (-not $r) { return $false }
  $h = [math]::Round(($r.fim - $dIni).TotalHours, 2).ToString($inv)
  $txtFim = $r.fim.ToString($fmt, $inv)
  if ($r.origem -ne 'hora atual') { Write-Host "Fim da sessao: $txtFim ($($r.origem))" -ForegroundColor Yellow }
  if ($Simular) { Write-Host "SIMULACAO (nada gravado): fase $f | $h h | $ini -> $txtFim" -ForegroundColor Cyan; return $true }
  Linha @('SESSAO', $f, $i, $ini, $txtFim, $h, $obsTexto)
  Remove-Item $aberta -Force
  Write-Host "Sessao encerrada: fase $f | $h h | $ini -> $txtFim" -ForegroundColor Green
  return $true
}

switch ($acao) {
  'inicio' {
    if (-not $Fase -or -not $plan.Contains($Fase)) { Write-Host "Informe -Fase valida: $($plan.Keys -join ', ')" -ForegroundColor Red; break }
    if (Test-Path $aberta) {
      Write-Host "Ha uma sessao aberta: $(Get-Content $aberta). Encerrando-a antes de abrir a nova..." -ForegroundColor Yellow
      if (-not (Encerrar 'Encerrada automaticamente na abertura da sessao seguinte')) { Write-Host "A sessao anterior nao foi encerrada; a nova nao foi aberta." -ForegroundColor Red; break }
      if ($Simular) { break }
    }
    if ($Simular) { Write-Host "SIMULACAO: nenhuma sessao aberta; a nova seria iniciada agora." -ForegroundColor Cyan; break }
    New-Item -ItemType Directory -Force -Path (Split-Path $aberta) | Out-Null
    $agora = (Get-Date).ToString($fmt, $inv)
    Set-Content -Path $aberta -Value "$Fase|$Item|$agora" -Encoding UTF8
    Write-Host "Sessao iniciada: fase $Fase | $Item | $agora" -ForegroundColor Green
  }
  'fim' {
    if (-not (Test-Path $aberta)) { Write-Host "Nenhuma sessao aberta." -ForegroundColor Red; break }
    [void](Encerrar $Obs)
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