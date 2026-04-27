# Execute na raiz de D:\Projetos\Ledgr
$baseDir = "apps/api/src"
$modules = @("financial", "fiscal", "sales", "purchases", "inventory", "manufacturing", "hrm", "crm", "master-data", "reporting")

# Criar estrutura básica de Apps e Libs
New-Item -ItemType Directory -Force -Path "apps/api/src", "apps/web", "libs/domain", "libs/shared", "libs/infrastructure", "prisma", "docs", "scripts", "tools"

# Criar subpastas do Core
$coreFolders = @("database", "events", "auth", "multi-tenant", "audit", "workflow", "notifications", "file-storage", "cache", "jobs", "logging")
foreach ($folder in $coreFolders) {
    New-Item -ItemType Directory -Force -Path "$baseDir/core/$folder"
}

# Criar subpastas do Shared
$sharedFolders = @("domain/base", "domain/value-objects", "domain/interfaces", "dto", "exceptions", "decorators", "pipes", "filters", "interceptors", "utils/validators", "utils/formatters", "utils/helpers", "constants")
foreach ($folder in $sharedFolders) {
    New-Item -ItemType Directory -Force -Path "$baseDir/shared/$folder"
}

# Criar Bounded Contexts (Módulos) com estrutura DDD
foreach ($module in $modules) {
    $modulePath = "$baseDir/modules/$module"
    New-Item -ItemType Directory -Force -Path "$modulePath/domain/entities", "$modulePath/domain/value-objects", "$modulePath/domain/events", "$modulePath/domain/repositories"
    New-Item -ItemType Directory -Force -Path "$modulePath/application/commands", "$modulePath/application/queries", "$modulePath/application/services"
    New-Item -ItemType Directory -Force -Path "$modulePath/infrastructure/persistence/repositories", "$modulePath/infrastructure/persistence/mappers", "$modulePath/infrastructure/external"
    New-Item -ItemType Directory -Force -Path "$modulePath/presentation/controllers", "$modulePath/presentation/dto/request", "$modulePath/presentation/dto/response"
    New-Item -ItemType Directory -Force -Path "$modulePath/tests/unit", "$modulePath/tests/integration"
}

Write-Host "✅ Estrutura LEDGR ERP criada com sucesso!" -ForegroundColor Green