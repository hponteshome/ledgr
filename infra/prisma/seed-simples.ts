import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(50));
  console.log('🔥 SEED - Criação de usuário básico');
  console.log('='.repeat(50));

  const email = 'admin@ledgr.com';
  const senha = '123456';
  const hash = await bcrypt.hash(senha, 10);

  try {
    // 1. Verificar se já existe
    console.log('\n📋 Verificando dados existentes...');
    
    const userExiste = await prisma.user.findUnique({
      where: { email }
    });

    if (userExiste) {
      console.log('✅ Usuário já existe!');
      console.log('📧 Email:', email);
      console.log('🔑 Senha:', senha);
      return;
    }

    // 2. Criar Company
    console.log('\n1. Criando empresa...');
    const company = await prisma.company.create({
      data: {
        taxId: '12345678000199',
        legalName: 'Ledgr Tecnologia LTDA',
        tradeName: 'Ledgr Tech',
        openingDate: new Date('2020-01-01'),
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        zipCode: '01310100',
        state: 'SP',
        city: 'São Paulo',
        country: 'Brasil',
        equity: 100000,
        legalNature: '206-2',
        size: 'DEMAIS',
        taxRegime: 'LUCRO_REAL',
        status: 'active',
        statusDate: new Date(),
        isHeadquarter: true
      }
    });
    console.log('   ✅ Empresa criada:', company.tradeName);

    // 3. Criar User
    console.log('\n2. Criando usuário...');
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        fullName: 'Administrador Master',
        document: '12345678901',
        documentType: 'CPF',
        isActive: true,
        isEmailConfirmed: true,
        status: 'active'
      }
    });
    console.log('   ✅ Usuário criado:', user.email);

    // 4. Criar vínculo
    console.log('\n3. Criando vínculo...');
    await prisma.userCompany.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: 'ADMIN'
      }
    });
    console.log('   ✅ Vínculo criado');

    // 5. Criar Person (opcional)
    try {
      console.log('\n4. Criando pessoa física...');
      const person = await prisma.person.create({
        data: {
          cpf: '565.240.219-91',
          fullName: 'Administrador Master',
          email: email,
          nationality: 'Brasileira',
          birthCountry: 'Brasil',
          country: 'Brasil',
          isActive: true
        }
      });
      console.log('   ✅ Pessoa criada:', person.fullName);
    } catch (error: any) {
      console.log('   ⚠️ Pessoa não criada (pode já existir):', error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 SUCESSO! Tudo pronto para o frontend!');
    console.log('='.repeat(50));
    console.log('📧 Email:', email);
    console.log('🔑 Senha:', senha);
    console.log('🏢 Empresa:', company.tradeName);
    console.log('='.repeat(50));

    // Listar todos os usuários
    const users = await prisma.user.findMany({
      select: { email: true, fullName: true, isActive: true }
    });
    console.log('\n📋 Usuários no sistema:');
    users.forEach(u => console.log(`   - ${u.email} (${u.fullName})`));

  } catch (error: any) {
    console.error('\n❌ ERRO:');
    console.error('Mensagem:', error.message);
    if (error.code) console.error('Código:', error.code);
    if (error.meta) console.error('Meta:', error.meta);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Conexão encerrada');
  }
}

main();