# D:\Projetos\Ledgr\scripts\importa-sped-referencial.ps1
# NOVO (11/09/2026): importa/atualiza o plano referencial SPED direto via
# SQL (sem HTTP/token, mesmo padrao usado a sessao inteira) - le os
# arquivos brutos (pipe-delimitado, Latin-1), gera um INSERT em lote por
# arquivo, e aplica via docker exec.
#
# USO: .\importa-sped-referencial.ps1
# (roda de novo sempre que atualizar o programa SPED Contabil)

param(
    [string]$OrigemPasta = "C:\Arquivos de Programas RFB\Programas SPED\SpedContabil\recursos\tabelas",
    [string]$ArquivoMorto = "D:\Projetos\SPED-Referencial-Fonte",
    [string]$Container = "ledgr-postgres",
    [string]$Db = "ledgr_app",
    [string]$DbUser = "ledgr"
)

function Parse-Ddmmyyyy($raw) {
    if ([string]::IsNullOrWhiteSpace($raw) -or $raw.Trim().Length -ne 8) { return $null }
    $s = $raw.Trim()
    return "$($s.Substring(4,4))-$($s.Substring(2,2))-$($s.Substring(0,2))"
}

function Sql-Escape($s) {
    if ($null -eq $s) { return "" }
    return $s.Replace("'", "''")
}

$arquivos = Get-ChildItem -Path $OrigemPasta -File | Where-Object {
    $_.Name -match '^SPEDCONTABIL_DINAMICO_(\d{4})\$SPEDECF_DINAMICA_([PLU]\d{3}(_[A-Z])?)\$(\d+)\$(\d+)$'
}

if ($arquivos.Count -eq 0) {
    Write-Host "Nenhum arquivo encontrado em $OrigemPasta com o padrao esperado." -ForegroundColor Yellow
    exit
}
Write-Host "Encontrados $($arquivos.Count) arquivo(s) de plano referencial." -ForegroundColor Cyan

$latin1 = [System.Text.Encoding]::GetEncoding("ISO-8859-1")
$totalInserido = 0

foreach ($arq in $arquivos) {
    if ($arq.Name -notmatch '^SPEDCONTABIL_DINAMICO_(\d{4})\$SPEDECF_DINAMICA_([PLU]\d{3}(_[A-Z])?)\$(\d+)\$(\d+)$') { continue }
    $anoBase = $matches[1]
    $tabela = $matches[2]

    # Copia pro arquivo morto (organizado por ano) - nao versionado no Git.
    $destPasta = Join-Path $ArquivoMorto $anoBase
    if (-not (Test-Path $destPasta)) { New-Item -ItemType Directory -Path $destPasta -Force | Out-Null }
    Copy-Item -Path $arq.FullName -Destination (Join-Path $destPasta $arq.Name) -Force

    $bytes = [System.IO.File]::ReadAllBytes($arq.FullName)
    $text = $latin1.GetString($bytes)
    $lines = $text -split "`r?`n" | Where-Object { $_.Trim().Length -gt 0 }
    if ($lines.Count -lt 2) { Write-Host "  $($arq.Name): vazio, pulando." -ForegroundColor Yellow; continue }

    if ($lines[0] -match 'vers[a\u00e3\uFFFD]?o\s*=\s*(\d+)') { $versao = [int]$matches[1] } else { $versao = 1 }

    $values = @()
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $parts = $lines[$i] -split '\|'
        if ($parts.Count -lt 9) { continue }
        $codigo = $parts[0].Trim()
        if ([string]::IsNullOrWhiteSpace($codigo)) { continue }
        $descricao = Sql-Escape $parts[1].Trim()
        $dtIni = Parse-Ddmmyyyy $parts[2]
        $dtFim = Parse-Ddmmyyyy $parts[3]
        $ordem = if ($parts[4].Trim()) { $parts[4].Trim() } else { "NULL" }
        $tipo = if ($parts[5].Trim()) { "'$(Sql-Escape $parts[5].Trim())'" } else { "NULL" }
        $codSup = if ($parts[6].Trim()) { "'$(Sql-Escape $parts[6].Trim())'" } else { "NULL" }
        $nivel = if ($parts[7].Trim()) { $parts[7].Trim() } else { "NULL" }
        $natureza = if ($parts[8].Trim()) { "'$(Sql-Escape $parts[8].Trim())'" } else { "NULL" }
        $dtIniSql = if ($dtIni) { "'$dtIni'" } else { "NULL" }
        $dtFimSql = if ($dtFim) { "'$dtFim'" } else { "NULL" }

        $values += "('$tabela',$anoBase,$versao,'$(Sql-Escape $codigo)','$descricao',$dtIniSql,$dtFimSql,$ordem,$tipo,$codSup,$nivel,$natureza)"
    }

    if ($values.Count -eq 0) { Write-Host "  $($arq.Name): nenhuma linha valida." -ForegroundColor Yellow; continue }

    $sql = "INSERT INTO sped_plano_referencial (tabela, ano_base, versao, codigo, descricao, dt_ini, dt_fim, ordem, tipo, cod_sup, nivel, natureza) VALUES`n"
    $sql += ($values -join ",`n")
    $sql += "`nON CONFLICT (tabela, ano_base, versao, codigo) DO NOTHING;"

    $tmpFile = "D:\Temp\sped-import-$($arq.Name -replace '[\$]','_').sql"
    [System.IO.File]::WriteAllText($tmpFile, $sql, (New-Object System.Text.UTF8Encoding($false)))
    docker cp $tmpFile "${Container}:/tmp/sped-import.sql" | Out-Null
    $result = docker exec $Container psql -U $DbUser -d $Db -f /tmp/sped-import.sql -q -t -c "SELECT 1" 2>&1
    docker exec $Container psql -U $DbUser -d $Db -f /tmp/sped-import.sql 2>&1 | Out-Null

    $countResult = docker exec $Container psql -U $DbUser -d $Db -t -c "SELECT COUNT(*) FROM sped_plano_referencial WHERE tabela='$tabela' AND ano_base=$anoBase AND versao=$versao"
    Write-Host ("  {0} (tabela={1}, ano={2}, v={3}): {4} linha(s) no arquivo -> total no banco para essa versao: {5}" -f $arq.Name, $tabela, $anoBase, $versao, $values.Count, $countResult.Trim()) -ForegroundColor Green
    $totalInserido += $values.Count
}

Write-Host "`nConcluido. $($arquivos.Count) arquivo(s) processado(s), copiados para $ArquivoMorto." -ForegroundColor Cyan
