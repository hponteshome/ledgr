import { PrismaClient } from '@prisma/client';
import { seedPlano } from './seed-Plano';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando seed do Plano de Contas...');
  await seedPlano(prisma);
  console.log('✅ Seed concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.();
  });
