# iniciar-ledgr.ps1 - sobe o que estiver fora do ar: Postgres (Docker), API (3000), Frontend (5173), Agent (7778)
# Uso (na pasta do projeto): .\scripts\iniciar-ledgr.ps1
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function NoAr($porta) { [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue) }
function ScriptDev($pasta) {
  $s = (Get-Content "$pasta\package.json" -Raw | ConvertFrom-Json).scripts
  if ($s.dev) { 'npm run dev' } elseif ($s.'start:dev') { 'npm run start:dev' } else { 'npm start' }
}
function Janela($titulo, $pasta, $cmd, $estilo = 'Normal') {
  Start-Process powershell -WindowStyle $estilo -WorkingDirectory $pasta -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',"`$Host.UI.RawUI.WindowTitle = '$titulo'; $cmd"
}

Write-Host "=== LEDGR - $raiz ===" -ForegroundColor Cyan

# Postgres (Docker)
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Postgres  : Docker Desktop fora do ar - abra o Docker Desktop e rode de novo" -ForegroundColor Red
} elseif (docker ps --filter "name=ledgr-postgres" --filter "status=running" -q) {
  Write-Host "Postgres  : ja no ar" -ForegroundColor DarkGray
} else {
  docker start ledgr-postgres | Out-Null; Write-Host "Postgres  : iniciado" -ForegroundColor Green
}

# API (apps\api)
if (NoAr 3000) { Write-Host "API 3000  : ja no ar" -ForegroundColor DarkGray }
else { $c = ScriptDev "$raiz\apps\api"; Janela 'LEDGR API' "$raiz\apps\api" $c; Write-Host "API 3000  : iniciando ($c) - janela LEDGR API" -ForegroundColor Green }

# Frontend (frontend)
if (NoAr 5173) { Write-Host "Front 5173: ja no ar" -ForegroundColor DarkGray }
else { $c = ScriptDev "$raiz\frontend"; Janela 'LEDGR Frontend' "$raiz\frontend" $c; Write-Host "Front 5173: iniciando ($c) - janela LEDGR Frontend" -ForegroundColor Green }

# Agent (A3) - minimizado
if (NoAr 7778) { Write-Host "Agent 7778: ja no ar" -ForegroundColor DarkGray }
elseif (Test-Path "$raiz\scripts\iniciar-agent.ps1") { & "$raiz\scripts\iniciar-agent.ps1"; Write-Host "Agent 7778: iniciando - janela LEDGR Agent (minimizada)" -ForegroundColor Green }
else { Janela 'LEDGR Agent' "$raiz\apps\agent" 'npx tsx src\main.ts' 'Minimized'; Write-Host "Agent 7778: iniciando - janela LEDGR Agent (minimizada)" -ForegroundColor Green }

# Espera API e Frontend (ate 2 min) e abre o navegador
Write-Host "`nAguardando API e Frontend..." -ForegroundColor Cyan
for ($i = 0; $i -lt 60 -and -not ((NoAr 3000) -and (NoAr 5173)); $i++) { Start-Sleep 2 }
if ((NoAr 3000) -and (NoAr 5173)) {
  Write-Host "OK - LEDGR no ar: http://localhost:5173" -ForegroundColor Green
  Start-Process 'http://localhost:5173'
} else {
  if (-not (NoAr 3000)) { Write-Host "Atencao - API ainda fora do ar: veja a janela LEDGR API" -ForegroundColor Yellow }
  if (-not (NoAr 5173)) { Write-Host "Atencao - Frontend ainda fora do ar: veja a janela LEDGR Frontend" -ForegroundColor Yellow }
}
