import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs'; // Usando a mesma do seu seed para consistência
import * as dotenv from 'dotenv';

dotenv.config();

async function fix() {
  // Configuração idêntica ao seu seed.ts
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const password = '123456';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    console.log(`🚀 Gerando hash para: hpontes@ledgr.com`);
    console.log(`Hash: ${hash}`);

    const user = await (prisma.user as any).update({
      where: { email: 'hpontes@ledgr.com' },
      data: { 
        passwordHash: hash,
        isActive: true,
        status: 'active'
      }
    });

    console.log('✅ Hash atualizada e usuário ativado com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao atualizar hash:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fix();