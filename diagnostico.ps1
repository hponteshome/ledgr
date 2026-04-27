Write-Host "--- DIAGNÓSTICO DE ESTRUTURA LEDGR ---" -ForegroundColor Cyan
$paths = @(
    "tsconfig.json",
    "apps\api\tsconfig.app.json",
    "prisma\schema.prisma",
    "node_modules\.prisma\client\index.d.ts",
    "node_modules\@prisma\client\index.d.ts"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "[OK] Encontrado: $path" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Ausente: $path" -ForegroundColor Red
    }
}
Write-Host "---------------------------------------"