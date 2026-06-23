# Defina aqui a letra do seu Pendrive ou HD Externo (ex: D:\, E:\)
$unidade = "D:\"

Write-Host "Mapeando a unidade $unidade... Isso pode levar alguns minutos." -ForegroundColor Cyan

# Varre todos os arquivos e calcula o tamanho acumulado por pasta
$resultado = Get-ChildItem -Path $unidade -Recurse -ErrorAction SilentlyContinue | 
    Group-Object {$_.DirectoryName} | 
    Select-Object @{Name="Pasta"; Expression={$_.Name}},
                  @{Name="Arquivos"; Expression={$_.Count}},
                  @{Name="Tamanho_MB"; Expression={[math]::round((($_.Group | Measure-Object -Property Length -Sum).Sum / 1MB), 2)}} |
    Sort-Object Size_MB -Descending

# Abre uma janela interativa do Windows com filtros e ordenação por clique
$resultado | Out-GridView -Title "Analisador de Espaço - Estilo FolderSize"