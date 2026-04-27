import { PrismaClient } from '@prisma/client';

// Forçamos o Prisma a entender onde está o schema se necessário
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('🌱 Iniciando Seed de Emergência...');

  const queries = [
    // 1. Perfis
    `INSERT INTO "profiles" ("id", "name", "permissions", "is_active") 
     VALUES ('ad8e026c-4164-4fc7-8668-42cc7f3cc67e', 'Administrador Master', '{"all":true}', true) 
     ON CONFLICT (id) DO NOTHING;`,

    // 2. Persons
    `INSERT INTO "persons" ("id", "cpf", "full_name", "is_active") 
     VALUES ('6bacbfa6-b2c3-46c4-b0b3-77c865915d4d', '56524021991', 'Hpontes', true) 
     ON CONFLICT (id) DO NOTHING;`,

    // 3. Companies
    `INSERT INTO "companies" ("id", "tax_id", "legal_name", "trade_name", "opening_date", "street", "number", "neighborhood", "zip_code", "state", "city", "status", "legal_nature", "size", "tax_regime", "equity")
     VALUES ('06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c', '07432458000169', 'HALLO ADMINISTRACAO E PARTICIPACOES LTDA', 'HALLO', '2004-07-13', 'BANDEIRA PAULISTA', '600', 'ITAIM BIBI', '04532001', 'SP', 'SAO PAULO', 'active', 'Sociedade Simples Limitada', 'DEMAIS', 'LUCRO_PRESUMIDO', 10000.00)
     ON CONFLICT (id) DO NOTHING;`,

    // 4. Users
    `INSERT INTO "users" ("id", "document", "document_type", "email", "password_hash", "full_name", "profile_id", "person_id", "status", "is_active")
     VALUES ('177e026c-4164-4fc7-8668-42cc7f3cc67e', '56524021991', 'CPF', 'hpontes@ledgr.com', '$2b$10$85NOfbvU9wD3YlC68zZktuh8HmKHvFKhKZKVdmfbTyW0O86GGPGb2', 'Hpontes', 'ad8e026c-4164-4fc7-8668-42cc7f3cc67e', '6bacbfa6-b2c3-46c4-b0b3-77c865915d4d', 'active', true)
     ON CONFLICT (id) DO NOTHING;`,

    // 5. User Companies
    `INSERT INTO "user_companies" ("id", "user_id", "company_id", "role")
     VALUES ('f5828e9f-12e0-49d8-98f3-f65d475af1ae', '177e026c-4164-4fc7-8668-42cc7f3cc67e', '06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c', 'ADMIN')
     ON CONFLICT (id) DO NOTHING;`
  ];

  for (const query of queries) {
    await prisma.$executeRawUnsafe(query);
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