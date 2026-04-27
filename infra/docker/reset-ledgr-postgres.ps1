# ==========================================
# Reset One-Click para ledgr-postgres
# ==========================================

# Carregar variáveis do .env
$envFile = "D:\Projetos\Ledgr\apps\service-iam\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#=]+)\s*=\s*(.+)\s*$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$containerName = "ledgr-postgres"
$port = [int]$env:DB_PORT

Write-Host "==============================="
Write-Host " RESET ONE-CLICK LEDGR POSTGRES"
Write-Host "==============================="

# 1️⃣ Parar e remover container antigo
if ($(docker ps -a -q -f "name=$containerName")) {
    Write-Host "`nParando e removendo container antigo ($containerName)..."
    docker stop $containerName | Out-Null
    docker rm $containerName | Out-Null
    Write-Host "Container antigo removido."
} else {
    Write-Host "`nNenhum container antigo encontrado."
}

# 2️⃣ Liberar porta 5432 se ocupada
$portProcesses = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcesses) {
    Write-Host "`nPorta $port ocupada pelos PIDs: $($portProcesses -join ', ')"
    foreach ($pid in $portProcesses) {
        Write-Host "Matando processo PID $pid..."
        Stop-Process -Id $pid -Force
    }
    Write-Host "Porta $port liberada."
} else {
    Write-Host "`nPorta $port livre."
}

# 3️⃣ Rodar novo container limpo
Write-Host "`nRodando container ledgr-postgres limpo..."
docker run -d `
    --name $containerName `
    -e POSTGRES_USER=$env:DB_USER `
    -e POSTGRES_PASSWORD=$env:DB_PASSWORD `
    -e POSTGRES_DB=$env:DB_NAME `
    -p $port:5432 `
    postgres:15 | Out-Null

Start-Sleep -Seconds 5

# 4️⃣ Testar conexão via psql
Write-Host "`nTestando conexão com PostgreSQL..."
$psqlTest = "psql -h 127.0.0.1 -U $($env:DB_USER) -d $($env:DB_NAME) -p $port -c `"SELECT version();`""
Invoke-Expression $psqlTest

Write-Host "`n✅ RESET COMPLETO FINALIZADO."
