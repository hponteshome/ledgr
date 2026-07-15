# Migrações Manuais — LEDGR

Esta pasta guarda, em ordem cronológica, todo script SQL de migração aplicado manualmente
ao banco (fora do fluxo `prisma migrate`, que este projeto não usa hoje).

## Convenção de nome de arquivo

`AAAA-MM-DD_descricao-curta.sql`

Exemplo: `2026-07-13_sidebar-configured.sql`

## Regra de ouro

Toda vez que `prisma/schema.prisma` for alterado e uma migração SQL for rodada via
`docker exec ... psql`, o MESMO script deve ser salvo aqui ANTES de ser considerado
concluído. Isso garante que, na hora do deploy no servidor, basta reaplicar os scripts
desta pasta em ordem — sem depender de memória de sessão do Claude ou do desenvolvedor
para reconstruir o que mudou.

## Aplicando no servidor (deploy)

```powershell
Get-ChildItem "prisma\migrations-manuais\*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Aplicando: $($_.Name)" -ForegroundColor Yellow
    docker cp $_.FullName ledgr-postgres:/tmp/migracao.sql
    docker exec ledgr-postgres psql -U ledgr -d ledgr_app -f /tmp/migracao.sql
}
```

## Histórico (retroativo, migrações já aplicadas antes desta pasta existir)

Essas já rodaram no ambiente de dev, mas não foram salvas em arquivo até agora — script
reconstruído a partir do LEDGR-contexto.md para referência futura:
- `sidebar_items`: parent_id, icon, divider_before, disabled, action_type, resource (13/07/2026)
- `profile_sidebar_permissions`/`user_sidebar_permissions`: can_view (boolean) -> access_level (enum SidebarAccessLevel) (13/07/2026)
- `profiles`: sidebar_configured (boolean, default false) (14/07/2026)
