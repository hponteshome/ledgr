# diagnostico-postgres-containers.ps1

Write-Host "========================================="
Write-Host "   DIAGNOSTICO DE CONFLITOS POSTGRES"
Write-Host "=========================================`n"

# 1) Listar containers postgres ativos
$pgContainers = docker ps --filter "ancestor=postgres" --format "{{.ID}} {{.Names}} {{.Ports}}"
if (-not $pgContainers) {
    Write-Host "Nenhum container PostgreSQL ativo encontrado."
    exit
}

Write-Host "1) Containers PostgreSQL ativos:`n$pgContainers`n"

foreach ($line in $pgContainers) {
    $parts = $line -split " "
    $id = $parts[0]
    $name = $parts[1]
    $ports = ($parts[2..($parts.Length-1)] -join " ")

    Write-Host "----------------------------------------"
    Write-Host "Container: $name ($id)"
    Write-Host "Portas expostas: $ports`n"

    Write-Host "2) Bancos existentes:"
    docker exec -it $id psql -U postgres -c "\l" 2>&1 | ForEach-Object { Write-Host $_ }

    Write-Host "`n3) Usuários existentes:"
    docker exec -it $id psql -U postgres -c "\du" 2>&1 | ForEach-Object { Write-Host $_ }

    Write-Host "`n"
}
Write-Host "========================================="
Write-Host "      FIM DO DIAGNOSTICO"
Write-Host "========================================="
