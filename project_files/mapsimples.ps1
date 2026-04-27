# =============================================
# SCRIPT SIMPLES PARA MAPEAR PROJETO
# =============================================

Write-Host "============================================="
Write-Host " MAPEANDO PROJETO" 
Write-Host "============================================="

$projectPath = "D:\Projetos\Ledgr\frontend\src"

if (Test-Path $projectPath) {
    # Listar pastas principais
    Write-Host "`nPASTAS PRINCIPAIS:"
    Get-ChildItem -Path $projectPath -Directory | ForEach-Object {
        Write-Host "  [PASTA] $($_.Name)/"
    }
    
    # Listar arquivos na raiz
    Write-Host "`nARQUIVOS NA RAIZ:"
    Get-ChildItem -Path $projectPath -File | ForEach-Object {
        Write-Host "  [ARQUIVO] $($_.Name)"
    }
    
    # Verificar pastas importantes
    $pastas = @('components', 'pages', 'contexts', 'routes', 'services')
    
    foreach ($pasta in $pastas) {
        $caminho = Join-Path $projectPath $pasta
        if (Test-Path $caminho) {
            Write-Host "`nCONTEUDO DE '$pasta':"
            Get-ChildItem -Path $caminho | ForEach-Object {
                if ($_.PSIsContainer) {
                    Write-Host "  [PASTA] $($_.Name)/"
                } else {
                    Write-Host "  [ARQUIVO] $($_.Name)"
                }
            }
        }
    }
    
    # Estatísticas
    $totalFiles = Get-ChildItem -Path $projectPath -Recurse -File
    Write-Host "`nESTATISTICAS:"
    Write-Host "  Total de arquivos: $($totalFiles.Count)"
    
} else {
    Write-Host "ERRO: Caminho nao encontrado: $projectPath"
}

Write-Host "`n============================================="
Write-Host " MAPEAMENTO CONCLUIDO!"
Write-Host "============================================="