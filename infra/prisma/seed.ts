import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7 exige um driver adapter explicito - ver apps/api/src/prisma/prisma.service.ts
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('❌ DATABASE_URL não definida. Rode com $env:DATABASE_URL="..." antes do npm run seed.');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function main() {
  console.log('🌱 Iniciando Seed de Emergência...');

  const queries = [
    // 1. Perfis
    `INSERT INTO "profiles" ("id", "name", "permissions", "is_active")
     VALUES ('ad8e026c-4164-4fc7-8668-42cc7f3cc67e', 'Administrador Master', '{"all":true}', true)
     ON CONFLICT DO NOTHING;`,

    // 2. Persons
    `INSERT INTO "persons" ("id", "cpf", "full_name", "is_active")
     VALUES ('6bacbfa6-b2c3-46c4-b0b3-77c865915d4d', '56524021991', 'Hpontes', true)
     ON CONFLICT DO NOTHING;`,

    // 3. Companies
    `INSERT INTO "companies" ("id", "tax_id", "legal_name", "trade_name", "opening_date", "street", "number", "neighborhood", "zip_code", "state", "city", "status", "status_date", "legal_nature", "size", "tax_regime", "equity")
     VALUES ('06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c', '07432458000169', 'HALLO ADMINISTRACAO E PARTICIPACOES LTDA', 'HALLO', '2004-07-13', 'BANDEIRA PAULISTA', '600', 'ITAIM BIBI', '04532001', 'SP', 'SAO PAULO', 'active', '2004-07-13', 'Sociedade Simples Limitada', 'DEMAIS', 'LUCRO_PRESUMIDO', 10000.00)
     ON CONFLICT DO NOTHING;`,

    // 4. Users
    `INSERT INTO "users" ("id", "document", "document_type", "email", "password_hash", "full_name", "profile_id", "person_id", "status", "is_active")
     VALUES ('177e026c-4164-4fc7-8668-42cc7f3cc67e', '56524021991', 'CPF', 'hpontes@ledgr.com', '$2b$10$85NOfbvU9wD3YlC68zZktuh8HmKHvFKhKZKVdmfbTyW0O86GGPGb2', 'Hpontes', 'ad8e026c-4164-4fc7-8668-42cc7f3cc67e', '6bacbfa6-b2c3-46c4-b0b3-77c865915d4d', 'active', true)
     ON CONFLICT DO NOTHING;`,

    // 5. User Companies (resolve user_id pelo email, nunca pelo id fixo - o id do
    // usuario pode ter mudado numa recriacao de banco, o email nao)
    `INSERT INTO "user_companies" ("id", "user_id", "company_id", "role")
     SELECT 'f5828e9f-12e0-49d8-98f3-f65d475af1ae', u.id, '06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c', 'ADMIN'
     FROM "users" u WHERE u.email = 'hpontes@ledgr.com'
     ON CONFLICT DO NOTHING;`,

    // 6. QA Test User (dev/teste - NAO usar em producao) - anexado ao perfil Master Admin
    `INSERT INTO "users" ("id", "document", "document_type", "email", "password_hash", "full_name", "profile_id", "status", "is_active")
     VALUES ('f0cd3522-bae7-46a7-90f8-f48ccf9c5aad', '00000000000', 'CPF', 'teste.qa@ledgr.local', '$2b$10$pqrQ6PpXNM4jCSkO3t2sy.8821ZaPt5OWD.pTwvGavyNx97NrD5ZW', 'QA Teste (automatizado)', '61a30be0-010d-4b8e-8470-f775bfd871ee', 'active', true)
     ON CONFLICT (id) DO NOTHING;`,

    // 7. QA Test User - Access Schedule (EXEMPT, senao login fica bloqueado por padrao)
    `INSERT INTO "access_schedules" ("id", "user_id", "mode")
     VALUES ('06eff271-0149-4913-96c7-4b7c91a177a5', 'f0cd3522-bae7-46a7-90f8-f48ccf9c5aad', 'EXEMPT')
     ON CONFLICT (id) DO NOTHING;`,

    // 8. QA Test User - perfil restrito (Visualizador), pra testar navegacao por
    // permissao (Estagio 3 do roadmap de navegacao). Resolve o profile_id pelo
    // nome via SELECT, nao id fixo - perfil "Visualizador" nao e criado por este
    // seed, pode nao existir/ter id diferente numa recriacao de banco; nesse caso
    // a query so nao insere nada (SELECT sem linha), sem quebrar o resto do seed.
    `INSERT INTO "users" ("id", "document", "document_type", "email", "password_hash", "full_name", "profile_id", "status", "is_active")
     SELECT 'f0cd3522-bae7-46a7-90f8-f48ccf9c5ad2', '00099988877', 'CPF', 'teste.visualizador@ledgr.local', '$2b$10$pqrQ6PpXNM4jCSkO3t2sy.8821ZaPt5OWD.pTwvGavyNx97NrD5ZW', 'QA Visualizador (automatizado)', p.id, 'active', true
     FROM "profiles" p WHERE p.name = 'Visualizador'
     ON CONFLICT DO NOTHING;`,

    // 9. QA Test User (Visualizador) - Access Schedule (EXEMPT)
    `INSERT INTO "access_schedules" ("id", "user_id", "mode")
     SELECT '2bbbfbfc-81b3-4b3b-8513-9e629b7b3c79', u.id, 'EXEMPT'
     FROM "users" u WHERE u.email = 'teste.visualizador@ledgr.local'
     ON CONFLICT DO NOTHING;`,

    // 10. QA Test User (Visualizador) - User Companies (sem isso o login nao
    // acha empresa nenhuma e a navegacao/rail nunca carrega). Resolve ambos os
    // lados por coluna estavel (email / tax_id), nao id fixo.
    `INSERT INTO "user_companies" ("id", "user_id", "company_id", "role")
     SELECT '5a30bab4-07d7-46b9-bf4a-983136d93308', u.id, c.id, 'VISUALIZADOR'
     FROM "users" u, "companies" c
     WHERE u.email = 'teste.visualizador@ledgr.local' AND c.tax_id = '06190032000183'
     ON CONFLICT DO NOTHING;`
  ];

  for (const [i, query] of queries.entries()) {
    try {
      await prisma.$executeRawUnsafe(query);
    } catch (err) {
      console.warn(`⚠️  Query ${i + 1} do seed falhou (pulando):`, err.message);
    }
  }

  console.log('✅ Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });