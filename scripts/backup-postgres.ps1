# scripts/backup-postgres.ps1
# Backup automatico do LEDGR - Tarefa Agendada "LEDGR-Postgres-Backup" (a cada 1h).
# 1) pg_dump do banco completo + validacao (tabelas com dados no dump x tabelas do banco)
# 2) 1x por dia: zip dos arquivos fora do banco (uploads, LM) e zip separado dos segredos (.env)
# 3) copia opcional para destino secundario ($secondaryDir) - dump e arquivos, NUNCA os segredos
# 4) rotacao que nunca apaga os N arquivos mais recentes
# Log: D:\Backups\ledgr-postgres\backup.log
# Exit: 0 = OK | 1 = falha | 2 = container parado (backup nao realizado)
# Contexto: perda de dados real em 15-16/08/2026 (ver LEDGR-contexto.md).

$ErrorActionPreference = "Stop"
$projectRoot   = "D:\Projetos\Ledgr"
$backupDir     = "D:\Backups\ledgr-postgres"
$filesDir      = "D:\Backups\ledgr-arquivos"
$secondaryDir  = ""    # ex: "E:\Backups\ledgr" (HD externo / pasta da nuvem). Vazio = desativado
$retentionDays = 14
$minKeepDumps  = 48
$minKeepZips   = 7
$containerName = "ledgr-postgres"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$today     = Get-Date -Format "yyyyMMdd"
$exitCode  = 0
$zipArq    = $null

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $filesDir | Out-Null
$logFile = Join-Path $backupDir "backup.log"
if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 1MB)) { Move-Item $logFile "$logFile.old" -Force }

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

function Rotate($dir, $filter, $minKeep) {
    $all = @(Get-ChildItem -Path $dir -Filter $filter -File | Sort-Object LastWriteTime -Descending)
    $old = @($all | Select-Object -Skip $minKeep | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) })
    foreach ($o in $old) { Log "Removendo expirado: $($o.Name)"; Remove-Item $o.FullName -Force }
}

$running = docker ps --filter "name=$containerName" --filter "status=running" -q
if (-not $running) {
    Log "ALERTA: container $containerName nao esta rodando - backup NAO realizado."
    exit 2
}

# ---------- 1) Banco ----------
$backupFile = "backup_$timestamp.dump"
$tmp        = "/tmp/$backupFile"
$finalPath  = Join-Path $backupDir $backupFile
try {
    docker exec $containerName pg_dump -U ledgr -d ledgr_app -F c -f $tmp
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (exit $LASTEXITCODE)" }

    $nDump = @(docker exec $containerName pg_restore -l $tmp | Select-String -Pattern " TABLE DATA ").Count
    if ($LASTEXITCODE -ne 0) { throw "pg_restore -l falhou (exit $LASTEXITCODE) - dump ilegivel" }
    $nDb = [int](docker exec $containerName psql -U ledgr -d ledgr_app -Atc "select count(*) from pg_tables where schemaname='public'")

    docker cp "${containerName}:${tmp}" $finalPath
    if ($LASTEXITCODE -ne 0) { throw "docker cp falhou (exit $LASTEXITCODE)" }
    docker exec $containerName rm -f $tmp

    $size = (Get-Item $finalPath).Length
    if ($size -lt 1024) { throw "dump suspeito de pequeno ($size bytes)" }
    if ($nDump -ne $nDb) { throw "dump incompleto: $nDump tabelas com dados no dump x $nDb no banco" }
    Log "OK dump: $backupFile ($size bytes, $nDump/$nDb tabelas)"
} catch {
    Log "FALHA no backup do banco: $_"
    $exitCode = 1
}

# ---------- 2) Arquivos fora do banco (1x por dia) ----------
$jaTemHoje = Get-ChildItem -Path $filesDir -Filter "arquivos_$today*.zip" -File -ErrorAction SilentlyContinue
if (-not $jaTemHoje) {
    try {
        $arq = @("uploads", "apps/api/uploads", "LM") | Where-Object { Test-Path (Join-Path $projectRoot $_) }
        $seg = @(".env", "apps/api/.env", "frontend/.env", "env_files") | Where-Object { Test-Path (Join-Path $projectRoot $_) }
        if ($arq.Count -gt 0) {
            $zipArq = Join-Path $filesDir "arquivos_$timestamp.zip"
            tar.exe -a -c -f $zipArq -C $projectRoot @arq
            if ($LASTEXITCODE -ne 0) { throw "tar (arquivos) falhou (exit $LASTEXITCODE)" }
            Log "OK arquivos: $(Split-Path $zipArq -Leaf) ($((Get-Item $zipArq).Length) bytes) [$($arq -join ', ')]"
        }
        if ($seg.Count -gt 0) {
            $zipSeg = Join-Path $filesDir "segredos_$timestamp.zip"
            tar.exe -a -c -f $zipSeg -C $projectRoot @seg
            if ($LASTEXITCODE -ne 0) { throw "tar (segredos) falhou (exit $LASTEXITCODE)" }
            Log "OK segredos: $(Split-Path $zipSeg -Leaf) - copia so LOCAL, nao vai ao destino secundario"
        }
    } catch {
        Log "FALHA no backup de arquivos: $_"
        $exitCode = 1
    }
}

# ---------- 3) Destino secundario (opcional) ----------
if ($secondaryDir -ne "") {
    try {
        New-Item -ItemType Directory -Force -Path $secondaryDir | Out-Null
        if (Test-Path $finalPath) { Copy-Item $finalPath $secondaryDir -Force }
        if ($zipArq -and (Test-Path $zipArq)) { Copy-Item $zipArq $secondaryDir -Force }
        Rotate $secondaryDir "backup_*.dump" $minKeepDumps
        Rotate $secondaryDir "arquivos_*.zip" $minKeepZips
        Log "OK copia secundaria em $secondaryDir"
    } catch {
        Log "FALHA na copia secundaria: $_"
        $exitCode = 1
    }
}

# ---------- 4) Rotacao (nunca apaga os N mais recentes) ----------
Rotate $backupDir "backup_*.dump" $minKeepDumps
Rotate $filesDir "arquivos_*.zip" $minKeepZips
Rotate $filesDir "segredos_*.zip" $minKeepZips

if ($exitCode -eq 0) { Log "Concluido sem erros." }
exit $exitCode
