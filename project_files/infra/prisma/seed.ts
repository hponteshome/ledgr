import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';


dotenv.config();




async function main() {
  console.log('🌱 Iniciando o seed integral do Ledgr 1.0...');


  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('❌ DATABASE_URL não foi carregada.');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);



 // ✅ CRIAR A EXTENSÃO AQUI (via raw SQL)
  console.log('🔧 Verificando extensão pgcrypto...');
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
  console.log('✅ Extensão pgcrypto garantida!');



  // --- 1. PROFILES (Perfis de Acesso) ---
  console.log('Criando perfis...');
  const adminProfile = await prisma.profile.create({
    data: {
      name: 'Administrador Master',
      permissions: { all: true },
      isActive: true,
    },
  });

  const operatorProfile = await prisma.profile.create({
    data: {
      name: 'Operador Contábil',
      permissions: { read: true, write: true, delete: false },
      isActive: true,
    },
  });

  const viewerProfile = await prisma.profile.create({
    data: {
      name: 'Visualizador',
      permissions: { read: true, write: false, delete: false },
      isActive: true,
    },
  });

  // --- 2. USERS (Usuários) ---
  console.log('Criando usuários...');
  const userAdmin = await prisma.user.create({
    data: {
      document: '11122233344',
      documentType: 'CPF',
      email: 'admin@ledgr.com.br',
      passwordHash: '$2b$10$K7.uA7vYm2X.T8V/jG.r.O1', 
      fullName: 'Sérgio Administrador',
      nickname: 'Sergio Admin',
      isActive: true,
      profileId: adminProfile.id,
    },
  });

  const userOperator = await prisma.user.create({
    data: {
      document: '55566677788',
      documentType: 'CPF',
      email: 'operador@ledgr.com.br',
      passwordHash: '$2b$10$K7.uA7vYm2X.T8V/jG.r.O1',
      fullName: 'Cláudio Operador',
      nickname: 'Cláudio',
      isActive: true,
      profileId: operatorProfile.id,
    },
  });

  const userClient = await prisma.user.create({
    data: {
      document: '99988877766',
      documentType: 'CPF',
      email: 'cliente@ledgr.com.br',
      passwordHash: '$2b$10$K7.uA7vYm2X.T8V/jG.r.O1',
      fullName: 'Ana Cliente',
      nickname: 'Ana',
      isActive: true,
      profileId: viewerProfile.id,
    },
  });

    const userTeste = await prisma.user.create({
    data: {
      document: '12345678901',
      documentType: 'CPF',
      email: 'novo2@teste.com',
      passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 123456
      fullName: 'Usuario Novo Teste',
      nickname: 'Novo2',
      isActive: true,
      profileId: adminProfile.id,
    },
  });



  // --- 3. COMPANIES (Empresas) ---
  console.log('Criando empresas...');
  const companyTech = await prisma.company.create({
    data: {
      taxId: '12345678000199',
      legalName: 'Ledgr Tecnologia da Informação LTDA',
      tradeName: 'Ledgr Tech',
      openingDate: new Date('2020-05-10'),
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      zipCode: '01310100',
      state: 'SP',
      city: 'São Paulo',
      equity: 500000.00,
      legalNature: '206-2',
      size: 'DEMAIS',
      taxRegime: 'Lucro Real',
      status: 'ATIVA',
      statusDate: new Date(),
    },
  });

  const companyAgro = await prisma.company.create({
    data: {
      taxId: '98765432000188',
      legalName: 'Agropecuária Horizonte S.A.',
      tradeName: 'Horizonte Agro',
      openingDate: new Date('2015-08-20'),
      street: 'Rodovia BR-163',
      number: 'S/N',
      neighborhood: 'Zona Rural',
      zipCode: '78550000',
      state: 'MT',
      city: 'Sinop',
      equity: 2500000.00,
      legalNature: '205-4',
      size: 'DEMAIS',
      taxRegime: 'Lucro Presumido',
      status: 'ATIVA',
      statusDate: new Date(),
    },
  });


  const companyArena = await prisma.company.create({
    data: {
      taxId: '33602630000195',
      legalName: 'Arena Administração e Participações S/A.',
      tradeName: 'Arena Adm',
      openingDate: new Date('2019-05-13'),
      street: 'Avenida das Nações Unidas',
      number: '12399',
      neighborhood: 'Brooklin Paulista',
      zipCode: '04578000',
      state: 'SP',
      city: 'São Paulo',
      equity: 100000.00,
      legalNature: '205-4',
      size: 'DEMAIS',
      taxRegime: 'Lucro Presumido',
      status: 'ATIVA',
      statusDate: new Date(),
    },
  });



  // --- 4. USERCOMPANY (Relacionamentos) ---
  await prisma.userCompany.create({
    data: { userId: userAdmin.id, companyId: companyTech.id, role: 'OWNER' }
  });
  await prisma.userCompany.create({
    data: { userId: userOperator.id, companyId: companyTech.id, role: 'ACCOUNTANT' }
  });
  await prisma.userCompany.create({
    data: { userId: userAdmin.id, companyId: companyAgro.id, role: 'OWNER' }
  });

  // --- 5. PROPERTIES (Imóveis) ---
  console.log('Criando imóveis...');
  await prisma.property.createMany({
    data: [
      {
        companyId: companyTech.id,
        registryOfficeId: 'MAT-123',
        iptu: '112.334.55',
        address: 'Escritório Central SP',
        registryStatusHistory: 'Imóvel próprio ocupado pela sede.'
      },
      {
        companyId: companyAgro.id,
        incra: '950.015.012.345-6',
        car: 'MT-500600-ABC.123',
        registryOfficeId: 'MAT-505',
        address: 'Fazenda Horizonte I',
        registryStatusHistory: 'Área produtiva de soja.'
      },
      {
        companyId: companyAgro.id,
        incra: '950.015.999.888-0',
        car: 'MT-500600-XYZ.789',
        registryOfficeId: 'MAT-506',
        address: 'Fazenda Horizonte II',
        registryStatusHistory: 'Área de reserva legal preservada.'
      }
    ]
  });

  // --- 6. EMPLOYEES (Funcionários) ---
  console.log('Criando funcionários...');
  await prisma.employee.createMany({
    data: [
      { companyId: companyTech.id, fullName: 'Carlos Silva', taxId: '11100011100', birthDate: new Date('1990-01-01'), hireDate: new Date('2021-01-01'), role: 'Dev', salary: 7000, status: 'active' },
      { companyId: companyTech.id, fullName: 'Beatriz Souza', taxId: '22200022200', birthDate: new Date('1992-05-10'), hireDate: new Date('2022-03-15'), role: 'RH', salary: 5000, status: 'active' },
      { companyId: companyAgro.id, fullName: 'Joaquim Rural', taxId: '33300033300', birthDate: new Date('1980-10-20'), hireDate: new Date('2018-06-01'), role: 'Gerente Fazenda', salary: 12000, status: 'active' }
    ]
  });

  // --- 7. CORPORATE BOOKS (Livros) ---
  console.log('Criando livros societários...');
  await prisma.corporateBook.createMany({
    data: [
      { companyId: companyTech.id, type: 'Atas de Assembleia', bookNumber: 1, isDigitalSigned: true, status: 'completed', jucespCertification: 'CERT-2023-A' },
      { companyId: companyAgro.id, type: 'Registro de Ações', bookNumber: 1, isDigitalSigned: true, status: 'completed', jucespCertification: 'CERT-2023-B' },
      { companyId: companyAgro.id, type: 'Atas de Diretoria', bookNumber: 2, isDigitalSigned: false, status: 'draft' }
    ]
  });

  console.log('✅ Seed finalizado com sucesso!');
}
// ✅ Apenas chame a main, sem usar prisma/pool aqui fora
main().catch((e) => {
  console.error('❌ Erro:', e);
  process.exit(1);
});