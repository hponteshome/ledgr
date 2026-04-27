LEDGR - BACKUP COMPLETO
=========================================
Data do backup : 13/03/2026 09:04:47
Banco          : ledgr_app
UsuÃ¡rio DB     : ledgr
Container      : ledgr-postgres
Formato dump   : PostgreSQL Custom (-F c)
Projeto origem : D:\Projetos\Ledgr

=========================================
CONTEÃšDO DO BACKUP
=========================================

  database_dump.backup  â†’ Dump completo do PostgreSQL
  project_files/        â†’ CÃ³digo-fonte completo (sem node_modules, dist, .git)
  env_files/            â†’ CÃ³pia destacada dos arquivos .env

=========================================
COMO RESTAURAR
=========================================

PASSO 1 â€” Restaurar o cÃ³digo
---------------------------------------------
Extraia o conteÃºdo de project_files/ para o destino desejado.
Ex: D:\Projetos\Ledgr\

PASSO 2 â€” Restaurar os .env
---------------------------------------------
Copie os arquivos de env_files/ para os locais correspondentes
dentro do projeto restaurado, mantendo a estrutura de subpastas.

PASSO 3 â€” Reinstalar dependÃªncias
---------------------------------------------
Abra um terminal na raiz do projeto e execute:

  cd backend  && npm install
  cd frontend && npm install

PASSO 4 â€” Subir o container do banco
---------------------------------------------
  cd infra\docker
  docker compose up -d

  Aguarde o container ficar saudÃ¡vel antes de restaurar o banco.

PASSO 5 â€” Restaurar o banco de dados
---------------------------------------------
IMPORTANTE: O dump estÃ¡ em formato custom (-F c).
NÃƒO use redirecionamento (<). Use pg_restore com o arquivo diretamente:

  # Copiar o dump para dentro do container
  docker cp database_dump.backup ledgr-postgres:/tmp/database_dump.backup

  # Restaurar (--clean remove objetos existentes antes de recriar)
  docker exec ledgr-postgres pg_restore -U ledgr -d ledgr_app --clean --if-exists /tmp/database_dump.backup

  # Remover o arquivo temporÃ¡rio do container (opcional)
  docker exec ledgr-postgres rm /tmp/database_dump.backup

PASSO 6 â€” Iniciar a aplicaÃ§Ã£o
---------------------------------------------
  cd backend  && npm run start:dev
  cd frontend && npm run dev

=========================================
NOTAS
=========================================
- node_modules nÃ£o foi incluÃ­do (reinstalar via npm install)
- .git nÃ£o foi incluÃ­do (histÃ³rico de commits nÃ£o necessÃ¡rio para restauraÃ§Ã£o)
- dist/build nÃ£o foi incluÃ­do (regenerar via npm run build)
- Em caso de erro no pg_restore, verifique se o container estÃ¡ saudÃ¡vel:
    docker ps
    docker logs ledgr-postgres

