# scripts/check-git-sync.ps1
# CRIADO 26/08/2026: alerta diario se houver commits locais nao enviados ao
# GitHub. Motivado por achado real - origin/main ficou 9 dias desatualizado
# (33 commits acumulados so localmente) sem nenhum aviso ate ser checado
# manualmente. Mesmo padrao de Scheduled Task (LogonType S4U) do backup do
# Postgres, ja validado e funcionando.

$repoPath = "D:\Projetos\Ledgr"
Set-Location $repoPath

git fetch origin main 2>&1 | Out-Null

$aheadCount = (git rev-list origin/main..HEAD --count) -as [int]

$logPath = "D:\Backups\ledgr-postgres\git-sync-check.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if ($aheadCount -gt 0) {
    $ultimoCommit = git log -1 --format="%h %ad %s" --date=short
    $mensagem = "ALERTA: $aheadCount commit(s) local(is) NAO enviados ao GitHub.`nUltimo commit local: $ultimoCommit`n`nRode: git push origin main"

    Add-Content -Path $logPath -Value "$timestamp | ALERTA | $aheadCount commits pendentes | ultimo: $ultimoCommit"

    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $mensagem,
        "LEDGR - Commits pendentes de push",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
} else {
    Add-Content -Path $logPath -Value "$timestamp | OK | branch sincronizado com origin/main"
}
