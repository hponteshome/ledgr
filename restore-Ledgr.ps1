<#
.SYNOPSIS
    Script profissional de restauracao completa do projeto Ledgr. Versão Final 08/03/2026
.DESCRIPTION
    Este script executa restauracao completa do ambiente:
        1. Valida diretório e privilégios de Admin
        2. Para containers Docker e cria backup de segurança
        3. Extrai o backup ZIP e substitui os arquivos do projeto
        4. Configura tecnicamente o Monólito (Prisma, Links Simbólicos, DB Push e Seed)
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "",

    [Parameter(Mandatory=$false)]
    [switch]$ListBackups
)

# ==============================
# 0 - VALIDAÇÕES INICIAIS
# ==============================
$ProjectRoot   = "D:\Projetos\Ledgr"

if ((Get-Location).Path -ne $ProjectRoot) {
    Write-Host "⚠️ ERRO: Execute este script em: $ProjectRoot" -ForegroundColor Red
    exit 1
}

Write-Host "📢 IMPORTANTE: Execute como ADMINISTRADOR para criar os links do Prisma." -ForegroundColor Cyan
$confirm = Read-Host "Deseja continuar? (S/N)"
if ($confirm -ne "S") { exit }

# ==============================
# CONFIGURACOES PRINCIPAIS
# ==============================
$BackupRoot    = "D:\Backups\Ledgr"
$DockerDir     = Join-Path $ProjectRoot "infra\docker"
$TempRoot      = "D:\Temp"
$Timestamp     = Get-Date -Format "yyyyMMdd_HHmmss"
$TempDir       = Join-Path $TempRoot "Ledgr_Restore_$Timestamp"
$SecurityDir   = Join-Path $BackupRoot "seguranca_$Timestamp"

# Banco (Dados do docker-compose.yml)
$DbContainer   = "ledgr-postgres"
$DbUser        = "ledgr"
$DbName        = "ledgr_app"
$DB_URL        = "postgresql://ledgr:ledgr123@localhost:5432/ledgr_app"

# ==============================
# FUNCOES AUXILIARES
# ==============================
function Write-Header($text) {
    Write-Host "`n=========================================" -ForegroundColor Magenta
    Write-Host "   $text" -ForegroundColor Magenta
    Write-Host "=========================================`n" -ForegroundColor Magenta
}

function Write-Info($text)    { Write-Host $text -ForegroundColor Cyan }
function Write-Success($text) { Write-Host $text -ForegroundColor Green }
function Write-ErrorMsg($text) { Write-Host $text -ForegroundColor Red; exit 1 }

# ==============================
# SELEÇÃO DE BACKUP
# ==============================
if ($ListBackups -or [string]::IsNullOrEmpty($BackupFile)) {
    if (-not (Test-Path $BackupRoot)) { Write-ErrorMsg "Diretorio de backups nao encontrado." }
    $backups = Get-ChildItem -Path $BackupRoot -Filter "*.zip" | Sort-Object LastWriteTime -Descending
    
    if ($ListBackups) {
        Write-Header "BACKUPS DISPONIVEIS"
        $backups | ForEach-Object { Write-Host "$($_.Name) - $([math]::Round($_.Length / 1MB, 2)) MB" -ForegroundColor Cyan }
        exit 0
    }
    $BackupFile = $backups[0].FullName
}

# ==============================
# 1 - PARAR DOCKER E BACKUP SEGURANÇA
# ==============================
Write-Header "1 - PREPARANDO AMBIENTE"
Set-Location $DockerDir
docker compose down
Write-Success "Containers parados."

Write-Info "Criando cópia de segurança em: $SecurityDir"
New-Item -ItemType Directory -Path $SecurityDir -Force | Out-Null
Copy-Item "$ProjectRoot\*" $SecurityDir -Recurse -Force

# ==============================
# 2 - EXTRAIR E SUBSTITUIR PROJETO
# ==============================
Write-Header "2 - RESTAURANDO ARQUIVOS"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force
Write-Success "Backup extraído."

Remove-Item "$ProjectRoot\*" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item "$TempDir\*" $ProjectRoot -Force
Remove-Item $TempDir -Recurse -Force
Write-Success "Arquivos substituídos."

# ==============================
# 3 - CONFIGURAÇÃO TÉCNICA (O QUE DE FATO FUNCIONOU)
# ==============================
Write-Header "3 - CONFIGURAÇÃO DO MONÓLITO"

# A. Subir Banco
Set-Location $DockerDir
docker compose up -d postgres redis
Write-Info "Aguardando DB iniciar..."
Start-Sleep -Seconds 10

# B. Prisma e Links Simbólicos
Set-Location "$ProjectRoot\apps\api"
Write-Info "Gerando Prisma Client e Link Simbólico..."
npx prisma generate --schema=../../prisma/schema.prisma

if (Test-Path ".\node_modules\.prisma") { Remove-Item -Recurse -Force ".\node_modules\.prisma" }
New-Item -ItemType SymbolicLink -Path ".\node_modules\.prisma" -Target "..\..\node_modules\.prisma"

# C. Sincronizar e Popular (Seed)
Set-Location $ProjectRoot
Write-Info "Sincronizando tabelas e executando Seed..."
npx prisma db push --schema=./prisma/schema.prisma --url=$DB_URL
npx prisma db seed

# ==============================
# FINALIZAÇÃO
# ==============================
Write-Header "RESTAURACAO CONCLUIDA"
Write-Success "Ambiente 100% operacional e populado!"
Write-Info "Usuário Teste: novo2@teste.com / Senha: 123456"