<#
.SYNOPSIS
Diagnóstico avançado de PostgreSQL em ambiente Docker + Windows
.DESCRIPTION
Gera relatório detalhado e exporta para JSON e CSV:
- Containers ativos e detalhes
- Portas, PIDs e processos usando 5432
- Volumes Docker
- Variáveis POSTGRES_*
- Logs recentes
- Usuários e bancos
- Conectividade TCP
- Serviços PostgreSQL locais
- Regras de firewall
#>

# Diretório para salvar os relatórios
$reportDir = "$PSScriptRoot\report"
if (-not (Test-Path $reportDir)) { New-Item -Path $reportDir -ItemType Directory }

# Objeto de relatório
$Report = [PSCustomObject]@{
    Timestamp = (Get-Date)
    Containers = @()
    Porta5432 = @()
    Volumes = @()
    UsuariosBancos = @()
    TCPTest = @()
    Servicos = @()
    Firewall = @()
}

Write-Host "`n==============================="
Write-Host " INICIANDO DIAGNOSTICO POSTGRES "
Write-Host "==============================="

# 1) Containers ativos
Write-Host "`n1) Containers ativos:"
$containers = docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Ports}}" | ForEach-Object {
    $parts = $_ -split "\|"
    [PSCustomObject]@{
        ID = $parts[0]
        Name = $parts[1]
        Image = $parts[2]
        Ports = $parts[3]
    }
}
$Report.Containers = $containers
$containers | Format-Table

# 2) Containers expondo porta 5432
Write-Host "`n2) Containers expondo porta 5432:"
$containers5432 = $containers | Where-Object { $_.Ports -match "5432" }
if ($containers5432) { $containers5432 | Format-Table } else { Write-Host "Nenhum container expondo 5432" }

# 3) PID usando porta 5432 no host
Write-Host "`n3) Processos usando porta 5432 no host:"
try {
    $ports = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            PID = $_.OwningProcess
            Processo = if ($proc) { $proc.ProcessName } else { "Desconhecido" }
            PortaLocal = $_.LocalPort
            Estado = $_.State
        }
    }
    $Report.Porta5432 = $ports
    if ($ports) { $ports | Format-Table } else { Write-Host "Nenhum processo usando porta 5432 encontrado" }
} catch {
    Write-Host "Erro ao identificar processos da porta 5432"
}

# 4) Detalhes de containers PostgreSQL
Write-Host "`n4) Detalhes de containers PostgreSQL:"
$pgContainers = $containers | Where-Object { $_.Image -match "postgres" }
foreach ($c in $pgContainers) {
    $info = docker inspect $c.ID | ConvertFrom-Json
    $containerDetails = [PSCustomObject]@{
        ID = $c.ID
        Name = $info.Name.TrimStart('/')
        Image = $info.Config.Image
        Status = $info.State.Status
        Ports = $info.NetworkSettings.Ports
        Env = $info.Config.Env | Where-Object { $_ -match "POSTGRES_" }
        Mounts = $info.Mounts | ForEach-Object { "$($_.Source) -> $($_.Destination)" }
        LastLogs = docker logs --tail 20 $c.ID
    }
    $Report.Containers += $containerDetails
}

# 5) Volumes Docker
Write-Host "`n5) Volumes Docker:"
$volumes = docker volume ls --format "{{.Name}}" | ForEach-Object { [PSCustomObject]@{ Volume = $_ } }
$Report.Volumes = $volumes
$volumes | Format-Table

# 6) Usuários e bancos dentro do container
Write-Host "`n6) Usuários e bancos em containers PostgreSQL:"
foreach ($c in $pgContainers) {
    try {
        $users = docker exec $c.ID psql -U postgres -c "\du" 2>$null
        $dbs = docker exec $c.ID psql -U postgres -c "\l" 2>$null
        $Report.UsuariosBancos += [PSCustomObject]@{
            Container = $c.Name
            Usuarios = $users
            Bancos = $dbs
        }
    } catch {
        Write-Host "Não foi possível acessar o container $($c.Name)"
    }
}

# 7) Teste de conectividade TCP
Write-Host "`n7) Teste de conectividade TCP para 127.0.0.1:5432"
try {
    $tcpTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
    $Report.TCPTest = $tcpTest
    $tcpTest | Format-List
} catch {
    Write-Host "Falha ao testar conexão TCP"
}

# 8) Serviços PostgreSQL no host
Write-Host "`n8) Serviços PostgreSQL no host:"
$servicos = Get-Service -Name postgresql* | Select-Object Status, Name, DisplayName
$Report.Servicos = $servicos
$servicos | Format-Table

# 9) Firewall
Write-Host "`n9) Regras de firewall relacionadas ao PostgreSQL:"
$fw = Get-NetFirewallRule | Where-Object { $_.DisplayName -match "PostgreSQL" } | Select DisplayName, Direction, Enabled, Action
$Report.Firewall = $fw
$fw | Format-Table

# 10) Exportar relatório
$jsonPath = Join-Path $reportDir "postgres_diagnostico_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$csvPath = Join-Path $reportDir "postgres_diagnostico_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"

$Report | ConvertTo-Json -Depth 10 | Out-File $jsonPath -Encoding UTF8
$Report | Select-Object * | Export-Csv $csvPath -NoTypeInformation -Encoding UTF8

Write-Host "`n==============================="
Write-Host " RELATÓRIO EXPORTADO COM SUCESSO "
Write-Host "JSON: $jsonPath"
Write-Host "CSV:  $csvPath"
Write-Host "===============================""
