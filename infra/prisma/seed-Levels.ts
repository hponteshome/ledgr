import { PrismaClient, AccountType, AccountNature } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedLevels() {
  // Configuração do adaptador (necessário para o seu setup modular)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  
  // 1. Localiza a Arena Adm pelo CNPJ
  const company = await prisma.company.findUnique({
    where: { taxId: '33602630000195' }
  });

  if (!company) {
    console.error('❌ Empresa Arena Adm não encontrada. Rode o seed principal primeiro.');
    await pool.end();
    return;
  }

  const intermediateAccounts = [
    { code: '1.01', name: 'ATIVO CIRCULANTE', type: AccountType.ASSET, nature: AccountNature.DEBIT, level: 2 },
    { code: '1.01.01', name: 'DISPONIBILIDADES', type: AccountType.ASSET, nature: AccountNature.DEBIT, level: 3 },
    { code: '2.01', name: 'PASSIVO CIRCULANTE', type: AccountType.LIABILITY, nature: AccountNature.CREDIT, level: 2 },
    { code: '2.01.01', name: 'OBRIGAÇÕES A CURTO PRAZO', type: AccountType.LIABILITY, nature: AccountNature.CREDIT, level: 3 },
    { code: '3.01', name: 'RECEITA BRUTA', type: AccountType.REVENUE, nature: AccountNature.CREDIT, level: 2 },
    { code: '4.01', name: 'DESPESAS OPERACIONAIS', type: AccountType.EXPENSE, nature: AccountNature.DEBIT, level: 2 },
    { code: '4.01.02', name: 'DESPESAS ADMINISTRATIVAS', type: AccountType.EXPENSE, nature: AccountNature.DEBIT, level: 3 },
  ];

  console.log(`🌱 Semeando níveis intermediários para: ${company.tradeName}...`);

  for (const acc of intermediateAccounts) {
    await prisma.chartOfAccounts.upsert({
      where: { 
        companyId_code: { 
          companyId: company.id, 
          code: acc.code 
        } 
      },
      update: {},
      create: {
        ...acc,
        companyId: company.id,
        isAnalytic: false,
      },
    });
  }

  console.log('✅ Níveis intermediários concluídos!');
  await prisma.$disconnect();
  await pool.end();
}

seedLevels().catch((e) => {
  console.error('❌ Erro no seed de níveis:', e);
  process.exit(1);
});