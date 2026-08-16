# scripts/backup-postgres.ps1
# Backup automatico do Postgres do LEDGR - roda via Tarefa Agendada do Windows.
# Salva FORA do disco gerenciado por Docker/WSL2 (D:\Backups), para sobreviver
# a qualquer problema de sincronizacao WSL2/hibernacao que ja causou perda de
# dados real em 15-16/08/2026 (ver LEDGR-contexto.md).

$ErrorActionPreference = "Stop"
$backupDir = "D:\Backups\ledgr-postgres"
$retentionDays = 14
$containerName = "ledgr-postgres"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_$timestamp.dump"
$tempPathInContainer = "/tmp/$backupFile"
$finalPath = Join-Path $backupDir $backupFile

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$running = docker ps --filter "name=$containerName" --filter "status=running" -q
if (-not $running) {
    Write-Output "[$timestamp] SKIP: container $containerName nao esta rodando."
    exit 0
}

try {
    docker exec $containerName pg_dump -U ledgr -d ledgr_app -F c -f $tempPathInContainer
    docker cp "${containerName}:${tempPathInContainer}" $finalPath
    docker exec $containerName rm -f $tempPathInContainer

    $size = (Get-Item $finalPath).Length
    if ($size -lt 1024) {
        throw "Backup gerado esta suspeito de pequeno ($size bytes) - possivel falha silenciosa."
    }

    Write-Output "[$timestamp] OK: backup salvo em $finalPath ($size bytes)"
} catch {
    Write-Error "[$timestamp] FALHA no backup: $_"
    exit 1
}

# Rotacao: remove backups mais antigos que $retentionDays dias
Get-ChildItem -Path $backupDir -Filter "backup_*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) } |
    ForEach-Object {
        Write-Output "[$timestamp] Removendo backup expirado: $($_.Name)"
        Remove-Item $_.FullName -Force
    }