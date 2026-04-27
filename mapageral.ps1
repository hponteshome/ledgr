# =============================================
# SCRIPT PARA MAPEAR ESTRUTURA DO PROJETO
# =============================================

param(
    [string]$Path = "D:\Projetos\Ledgr\"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " MAPEANDO ESTRUTURA DO PROJETO" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Caminho: $Path" -ForegroundColor Yellow

# Lista de pastas para excluir da listagem
$excludedFolders = @(
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'out',
    'coverage',
    '.cache',
    'tmp',
    'temp',
    'logs',
    '.vscode',
    '.idea',
    '.vs',
    'bin',
    'obj',
    'packages',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.venv',
    'env',
    'venv',
    'vendor'
)

# Lista de arquivos para excluir da listagem
$excludedFiles = @(
    '*.log',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.DS_Store',
    'Thumbs.db',
    '*.pyc',
    '*.pyo',
    '*.pyd',
    '*.so',
    '*.dll',
    '*.exe',
    '*.class',
    '*.jar',
    '*.war',
    '*.zip',
    '*.tar',
    '*.gz',
    '*.rar',
    '*.7z'
)

# Função para verificar se um item deve ser excluído
function Should-ExcludeItem {
    param(
        [string]$ItemName,
        [string]$FullPath,
        [bool]$IsDirectory
    )
    
    # Verificar pastas excluídas
    if ($IsDirectory) {
        foreach ($excluded in $excludedFolders) {
            if ($ItemName -eq $excluded) {
                return $true
            }
        }
    }
    
    # Verificar arquivos excluídos por padrão
    foreach ($pattern in $excludedFiles) {
        if ($ItemName -like $pattern) {
            return $true
        }
    }
    
    # Verificar se está dentro de node_modules ou outras pastas excluídas
    $pathParts = $FullPath.Split([IO.Path]::DirectorySeparatorChar)
    foreach ($part in $pathParts) {
        foreach ($excluded in $excludedFolders) {
            if ($part -eq $excluded) {
                return $true
            }
        }
    }
    
    return $false
}

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
        # Verificar se deve excluir
        if (Should-ExcludeItem -ItemName $item.Name -FullPath $item.FullName -IsDirectory $item.PSIsContainer) {
            if ($item.PSIsContainer) {
                Write-Host "$indent[EXCLUIDO] $($item.Name)/ (pasta ignorada)" -ForegroundColor DarkGray
            }
            continue
        }
        
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
        # Verificar novamente (arquivos podem estar em loop separado)
        if (Should-ExcludeItem -ItemName $item.Name -FullPath $item.FullName -IsDirectory $item.PSIsContainer) {
            continue
        }
        
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
            } elseif ($item.Name -match "\.md$") {
                Write-Host $fileLine -ForegroundColor Cyan
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
    
    # Listar pastas principais (excluindo as ignoradas)
    Get-ChildItem -Path $FolderPath -Directory | Where-Object {
        -not (Should-ExcludeItem -ItemName $_.Name -FullPath $_.FullName -IsDirectory $true)
    } | ForEach-Object {
        Write-Host "  [PASTA] $($_.Name)/" -ForegroundColor Blue
    }
    
    # Listar arquivos principais na raiz (excluindo os ignorados)
    Write-Host "`nARQUIVOS NA RAIZ:" -ForegroundColor Magenta
    Get-ChildItem -Path $FolderPath -File | Where-Object {
        -not (Should-ExcludeItem -ItemName $_.Name -FullPath $_.FullName -IsDirectory $false)
    } | ForEach-Object {
        Write-Host "  [ARQUIVO] $($_.Name)" -ForegroundColor Green
    }
    
    # Pastas importantes para verificar
    $importantFolders = @('components', 'pages', 'contexts', 'routes', 'services', 'utils', 'hooks', 'styles', 'public')
    
    foreach ($folder in $importantFolders) {
        $folderPath = Join-Path $FolderPath $folder
        if (Test-Path $folderPath) {
            Write-Host "`nCONTEUDO DE '$folder':" -ForegroundColor Magenta
            Get-ChildItem -Path $folderPath | Where-Object {
                -not (Should-ExcludeItem -ItemName $_.Name -FullPath $_.FullName -IsDirectory $_.PSIsContainer)
            } | ForEach-Object {
                if ($_.PSIsContainer) {
                    Write-Host "  [PASTA] $($_.Name)/" -ForegroundColor Blue
                } else {
                    Write-Host "  [ARQUIVO] $($_.Name)" -ForegroundColor Green
                }
            }
        }
    }
}

# Função para contar estatísticas (excluindo pastas ignoradas)
function Get-Statistics {
    param([string]$FolderPath)
    
    Write-Host "Calculando estatísticas (excluindo node_modules e outros)..." -ForegroundColor Yellow
    
    # Função recursiva para contar arquivos ignorando pastas excluídas
    function Count-Files {
        param([string]$Path)
        
        $fileCount = 0
        $tsxCount = 0
        $cssCount = 0
        $jsCount = 0
        $folderCount = 0
        
        $items = Get-ChildItem -Path $Path
        
        foreach ($item in $items) {
            if (Should-ExcludeItem -ItemName $item.Name -FullPath $item.FullName -IsDirectory $item.PSIsContainer) {
                continue
            }
            
            if ($item.PSIsContainer) {
                $folderCount++
                $subCounts = Count-Files -Path $item.FullName
                $fileCount += $subCounts.fileCount
                $tsxCount += $subCounts.tsxCount
                $cssCount += $subCounts.cssCount
                $jsCount += $subCounts.jsCount
                $folderCount += $subCounts.folderCount
            } else {
                $fileCount++
                if ($item.Extension -match '\.tsx?') {
                    $tsxCount++
                } elseif ($item.Extension -eq '.css') {
                    $cssCount++
                } elseif ($item.Extension -eq '.js') {
                    $jsCount++
                }
            }
        }
        
        return @{
            fileCount = $fileCount
            tsxCount = $tsxCount
            cssCount = $cssCount
            jsCount = $jsCount
            folderCount = $folderCount
        }
    }
    
    $stats = Count-Files -Path $FolderPath
    
    Write-Host "`nESTATISTICAS (excluindo node_modules e pastas geradas):" -ForegroundColor Magenta
    Write-Host "  Total de pastas: $($stats.folderCount)"
    Write-Host "  Total de arquivos: $($stats.fileCount)"
    Write-Host "  Arquivos TypeScript/TSX: $($stats.tsxCount)"
    Write-Host "  Arquivos CSS: $($stats.cssCount)"
    Write-Host "  Arquivos JS: $($stats.jsCount)"
    
    # Calcular tamanho total (excluindo pastas ignoradas)
    Write-Host "`nCalculando tamanho total (pode levar alguns segundos)..." -ForegroundColor Yellow
    
    $totalSize = 0
    Get-ChildItem -Path $FolderPath -Recurse -File | Where-Object {
        -not (Should-ExcludeItem -ItemName $_.Name -FullPath $_.FullName -IsDirectory $false)
    } | ForEach-Object {
        $totalSize += $_.Length
    }
    
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    Write-Host "  Tamanho total: $totalSizeMB MB" -ForegroundColor Green
}

# Mostrar pastas que serão excluídas
Write-Host "`nPASTAS EXCLUIDAS DA LISTAGEM:" -ForegroundColor Yellow
foreach ($excluded in $excludedFolders) {
    Write-Host "  - $excluded" -ForegroundColor DarkGray
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
            $outputFile = Join-Path $Path "MapaGeral.txt"
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
    
    # Mostrar estatísticas apenas se não for a opção 3 (já mostra)
    if ($option -ne "3") {
        Get-Statistics -FolderPath $Path
    }
    
    Write-Host "`n=============================================" -ForegroundColor Cyan
    Write-Host " MAPEAMENTO CONCLUIDO!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
    
} else {
    Write-Host "ERRO: Caminho nao encontrado: $Path" -ForegroundColor Red
    Write-Host "Dica: Verifique se o caminho esta correto" -ForegroundColor Yellow
}