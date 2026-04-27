<#
.SYNOPSIS
Diagnóstico completo de PostgreSQL em ambiente Docker + host Windows
.DESCRIPTION
Lista containers, portas, volumes, variáveis de ambiente, logs, usuários, bancos,
conexões TCP, serviços PostgreSQL locais e detalhes do sistema.
#>

Write-Host "`n==========================="
Write-Host " DIAGNOSTICO POSTGRES COMPLETO "
Write-Host "==========================="

# 1) Containers Docker ativos
Write-Host "`n1) Containers ativos:"
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}"

# 2) Containers expondo porta 5432
Write-Host "`n2) Containers expondo porta 5432:"
$containers5432 = docker ps --filter "publish=5432" --format "{{.Names}} {{.Ports}}"
if ($containers5432) { $containers5432 } else { Write-Host "Nenhum container expondo 5432" }

# 3) PID usando porta 5432 no host
Write-Host "`n3) Processos usando porta 5432 no host:"
try {
    Get-NetTCPConnection -LocalPort 5432 | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            PID        = $_.OwningProcess
            Processo   = if ($proc) { $proc.ProcessName } else { "Desconhecido" }
            PortaLocal = $_.LocalPort
            Estado     = $_.State
        }
    }
} catch {
    Write-Host "Nenhum processo usando porta 5432 encontrado."
}

# 4) Detalhes de cada container PostgreSQL
Write-Host "`n4) Detalhes de containers PostgreSQL:"
$pgContainers = docker ps --filter "ancestor=postgres" --format "{{.ID}}"
if ($pgContainers.Count -eq 0) { Write-Host "Nenhum container PostgreSQL ativo" }
foreach ($c in $pgContainers) {
    Write-Host "`n-- Container ID: $c"
    docker inspect $c | ConvertFrom-Json | ForEach-Object {
        Write-Host "Nome: $($_.Name.TrimStart('/'))"
        Write-Host "Imagem: $($_.Config.Image)"
        Write-Host "Status: $($_.State.Status)"
        Write-Host "Portas mapeadas:"
        if ($_.NetworkSettings.Ports) {
            $_.NetworkSettings.Ports.GetEnumerator() | ForEach-Object {
                Write-Host "  $_.Key -> $($_.Value)"
            }
        }
        Write-Host "Variáveis de ambiente:"
        $_.Config.Env | Where-Object { $_ -match "POSTGRES_" } | ForEach-Object { Write-Host "  $_" }
        Write-Host "Volumes montados:"
        $_.Mounts | ForEach-Object { Write-Host "  Source: $($_.Source) -> Destino: $($_.Destination)" }
        Write-Host "Últimos 20 logs:"
        docker logs --tail 20 $c
    }
}

# 5) Volumes Docker
Write-Host "`n5) Volumes Docker:"
docker volume ls

# 6) Usuários e bancos dentro do container
Write-Host "`n6) Usuários e bancos (via container se ativo):"
foreach ($c in $pgContainers) {
    Write-Host "`n-- Container ID: $c"
    try {
        docker exec $c psql -U postgres -c "\du"
        docker exec $c psql -U postgres -c "\l"
    } catch {
        Write-Host "Não foi possível acessar o container $c"
    }
}

# 7) Teste de conectividade TCP na porta 5432
Write-Host "`n7) Teste de conectividade TCP na porta 5432:"
try {
    Test-NetConnection -ComputerName 127.0.0.1 -Port 5432
} catch {
    Write-Host "Falha ao testar conexão TCP"
}

# 8) Serviços PostgreSQL no host
Write-Host "`n8) Serviços PostgreSQL no host:"
Get-Service -Name postgresql* | Select-Object Status, Name, DisplayName

# 9) Informações de rede e firewall
Write-Host "`n9) Regras de firewall (filtrando portas PostgreSQL):"
Get-NetFirewallRule | Where-Object { $_.DisplayName -match "PostgreSQL" } | Select DisplayName, Direction, Enabled, Action

Write-Host "`n==========================="
Write-Host " DIAGNOSTICO FINALIZADO "
Write-Host "==========================="
