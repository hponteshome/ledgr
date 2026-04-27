import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function fix() {
  const prisma = new PrismaClient();
  // Gerando o hash via código (o que garante compatibilidade total)
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('123456', salt);

  const MASTER_ID = '177e026c-4164-4fc7-8668-42cc7f3cc67e';

  console.log("🛠️  Corrigindo usuário mestre...");

  // Primeiro limpamos para evitar conflitos de IDs trocados
  await prisma.user.deleteMany({ where: { email: 'hpontes@ledgr.com' } });

  // Criamos o usuário com o hash gerado AGORA
  await prisma.user.create({
    data: {
      id: MASTER_ID,
      email: 'hpontes@ledgr.com',
      passwordHash: hash,
      fullName: 'Administrador Master',
      document: '56524021991',
      documentType: 'CPF',
      isActive: true,
      profileId: '77777777-7777-7777-7777-777777777777' // ID do Profile que inserimos no PSQL
    }
  });

  console.log("✅ Usuário reinjetado com sucesso!");
  console.log("Hash utilizado:", hash);
}

fix().catch(console.error).finally(() => prisma.$disconnect());