# =============================================
# SCRIPT PARA MAPEAR ESTRUTURA DO PROJETO
# =============================================

param(
    [string]$Path = "D:\Projetos\Ledgr\frontend\src"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " MAPEANDO ESTRUTURA DO PROJETO" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Caminho: $Path" -ForegroundColor Yellow

# Função para mapear estrutura detalhada
function Map-DetailedStructure {
    param(
        [string]$FolderPath,
        [int]$Level = 0,
        [string]$Output = ""
    )
    
    $indent = "  " * $Level
    $items = Get-ChildItem -Path $FolderPath | Sort-Object { !$_.PSIsContainer }, Name
    
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            # É uma pasta
            $folderLine = "$indent[PASTA] $($item.Name)/"
            Write-Host $folderLine -ForegroundColor Blue
            $Output += $folderLine + "`n"
            
            # Mapear conteúdo da pasta
            $result = Map-DetailedStructure -FolderPath $item.FullName -Level ($Level + 1) -Output ""
            Write-Host $result.Output -NoNewline
            $Output += $result.Output
        }
    }
    
    # Mostrar arquivos depois das pastas
    foreach ($item in $items) {
        if (-not $item.PSIsContainer) {
            # É um arquivo
            $fileInfo = Get-Item $item.FullName
            $fileSize = [math]::Round($fileInfo.Length / 1KB, 2)
            $lastModified = $fileInfo.LastWriteTime.ToString("dd/MM/yyyy HH:mm")
            
            $fileLine = "$indent[ARQUIVO] $($item.Name) ($fileSize KB - $lastModified)"
            
            # Colorir por tipo de arquivo
            if ($item.Name -match "\.tsx?$") {
                Write-Host $fileLine -ForegroundColor Green
            } elseif ($item.Name -match "\.css$") {
                Write-Host $fileLine -ForegroundColor Magenta
            } elseif ($item.Name -match "\.json$") {
                Write-Host $fileLine -ForegroundColor Yellow
            } else {
                Write-Host $fileLine -ForegroundColor Gray
            }
            
            $Output += $fileLine + "`n"
        }
    }
    
    return @{Output = $Output}
}

# Função simplificada (mais rápida)
function Map-Simple {
    param([string]$FolderPath)
    
    Write-Host "`nESTRUTURA PRINCIPAL:" -ForegroundColor Magenta
    
    # Listar pastas principais
    Get-ChildItem -Path $FolderPath -Directory | ForEach-Object {
        Write-Host "  [PASTA] $($_.Name)/" -ForegroundColor Blue
    }
    
    # Listar arquivos principais na raiz
    Write-Host "`nARQUIVOS NA RAIZ:" -ForegroundColor Magenta
    Get-ChildItem -Path $FolderPath -File | ForEach-Object {
        Write-Host "  [ARQUIVO] $($_.Name)" -ForegroundColor Green
    }
    
    # Pastas importantes para verificar
    $importantFolders = @('components', 'pages', 'contexts', 'routes', 'services')
    
    foreach ($folder in $importantFolders) {
        $folderPath = Join-Path $FolderPath $folder
        if (Test-Path $folderPath) {
            Write-Host "`nCONTEUDO DE '$folder':" -ForegroundColor Magenta
            Get-ChildItem -Path $folderPath | ForEach-Object {
                if ($_.PSIsContainer) {
                    Write-Host "  [PASTA] $($_.Name)/" -ForegroundColor Blue
                } else {
                    Write-Host "  [ARQUIVO] $($_.Name)" -ForegroundColor Green
                }
            }
        }
    }
}

# Função para contar estatísticas
function Get-Statistics {
    param([string]$FolderPath)
    
    $allFiles = Get-ChildItem -Path $FolderPath -Recurse -File
    $tsxFiles = $allFiles | Where-Object { $_.Extension -match '\.tsx?' }
    $cssFiles = $allFiles | Where-Object { $_.Extension -eq '.css' }
    $jsFiles = $allFiles | Where-Object { $_.Extension -eq '.js' }
    
    Write-Host "`nESTATISTICAS:" -ForegroundColor Magenta
    Write-Host "  Total de pastas: $( (Get-ChildItem -Path $FolderPath -Recurse -Directory).Count )"
    Write-Host "  Total de arquivos: $($allFiles.Count)"
    Write-Host "  Arquivos TypeScript/TSX: $($tsxFiles.Count)"
    Write-Host "  Arquivos CSS: $($cssFiles.Count)"
    Write-Host "  Arquivos JS: $($jsFiles.Count)"
}

# Menu de opções
Write-Host "`nOPCOES:" -ForegroundColor Yellow
Write-Host "1 - Mapeamento completo (detalhado)"
Write-Host "2 - Mapeamento simples (rápido)"
Write-Host "3 - Apenas estatísticas"
$option = Read-Host "Escolha uma opcao (1-3)"

# Executar conforme opção
if (Test-Path $Path) {
    switch ($option) {
        "1" {
            Write-Host "`nMAPEAMENTO COMPLETO:" -ForegroundColor Magenta
            $result = Map-DetailedStructure -FolderPath $Path
            
            # Salvar em arquivo
            $outputFile = "D:\Projetos\Ledgr\estrutura-completa.txt"
            $result.Output | Out-File -FilePath $outputFile -Encoding UTF8
            Write-Host "`nArquivo salvo em: $outputFile" -ForegroundColor Yellow
        }
        "2" {
            Map-Simple -FolderPath $Path
        }
        "3" {
            Get-Statistics -FolderPath $Path
        }
        default {
            Write-Host "Opcao invalida. Executando mapeamento simples..." -ForegroundColor Red
            Map-Simple -FolderPath $Path
        }
    }
    
    Get-Statistics -FolderPath $Path
    
    Write-Host "`n=============================================" -ForegroundColor Cyan
    Write-Host " MAPEAMENTO CONCLUIDO!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
    
} else {
    Write-Host "ERRO: Caminho nao encontrado: $Path" -ForegroundColor Red
    Write-Host "Dica: Verifique se o caminho esta correto" -ForegroundColor Yellow
}