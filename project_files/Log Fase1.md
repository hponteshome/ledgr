Aqui está o resumo do que o seu log atual confirma e o que observar nas próximas interações:

1. Mapa de Rotas (Endpoints)
O NestJS listou todas as rotas que agora vivem sob o mesmo teto. Isto confirma que o TenantsController, o UsuariosController e o AuthController estão ativos:

Auth: /auth/login e /auth/registro (Para entrada no sistema).

Usuários: /usuarios/me e /usuarios/:id (Gestão de perfil e conta).

Tenants: /tenants e /tenants/:id (Administração do ecossistema).

2. Confirmação do Banco de Dados
A mensagem DATABASE_URL carregada: Sim seguida de TypeOrmModule dependencies initialized é o sinal verde definitivo.

O monólito está a usar a string de conexão do seu .env raiz.

As entidades (Usuario, Perfil, AuditLog) foram injetadas nos módulos respetivos com sucesso.

3. O Fluxo de Auditoria Interno
Como removemos os microserviços, o seu log de auditoria agora funciona assim:

Ação: Um administrador atualiza um utilizador em /tenants.

Processamento: O TenantsService executa a lógica.

Registro: O TenantsService chama o AuditoriaService.registrar() (via memória, sem rede).

Resultado: O log aparece no terminal quase instantaneamente.

Dica para o Próximo Passo (Sem arriscar código):
Quando decidir testar no Postman ou Insomnia, lembre-se apenas de:

Fazer o POST em /auth/login.

Copiar o access_token gerado.

Nas rotas de /usuarios ou /tenants, enviar dois Headers:

Authorization: Bearer <seu_token>

x-tenant-id: <id_do_tenant>



====================================
Aqui está o log da inicialização do monólito Ledgr organizado em Markdown, destacando os pontos principais da estrutura que acabámos de consolidar:📋 Log de Inicialização do Sistema (01/03/2026)🛠️ Compilação e AmbienteModo: Incremental (Watch Mode)Status: Found 0 errors (Sucesso)Ambiente: Variáveis injetadas de ..\..\.env via dotenv.Base de Dados: DATABASE_URL carregada com sucesso.🏗️ Inicialização dos Módulos (Instance Loader)O NestJS carregou os componentes na seguinte ordem de dependência:MóduloStatusTypeOrmModule✅ InicializadoConfigModule✅ InicializadoJwtModule✅ InicializadoAuditoriaModule✅ Inicializado (Monólito)TenantsModule✅ InicializadoUsuariosModule✅ InicializadoAuthModule✅ Inicializado🛣️ Mapeamento de Rotas (Endpoints)ControllerMétodoRotaDescriçãoAuthGET/auth/testeVerificação de statusPOST/auth/loginAutenticação e geração de JWTPOST/auth/registroCriação de novos utilizadoresUsuáriosGET/usuarios/mePerfil do utilizador atualGET/usuariosListagem geral (Admin)PATCH/usuarios/:id/statusAtivação/DesativaçãoDELETE/usuarios/:idRemoção (Soft Delete)TenantsGET/tenants/meDados do Tenant atualGET/tenantsListagem de TenantsGET/tenants/auditoriaLogs de Auditoria Internos🚀 Status FinalBash[NestApplication] Nest application successfully started +3ms
🚀 API rodando em: http://localhost:3000
Observação Técnica:O log confirma que o erro de dependência "AUDITORIA_SERVICE" foi resolvido. Agora, o TenantsService comunica diretamente com o AuditoriaService dentro do mesmo processo, garantindo que qualquer alteração de utilizador seja registada no banco de dados sem passar pela rede.