// Fixa o fuso do processo Node em America/Sao_Paulo (UTC-3), independente do
// fuso do SO/container. O driver pg (node-postgres) le/grava colunas DATE e
// TIMESTAMP usando o fuso local do processo - sem isso, mover o backend para
// um ambiente com fuso diferente (ex: container Linux padrao em UTC) reintroduz
// o bug de -1 dia em datas de vigencia de contrato, vencimento, etc.
process.env.TZ = 'America/Sao_Paulo';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

// Logger customizado: silencia o ruido de boot (RouterExplorer/InstanceLoader)
// mas mantem erros, avisos e mensagens de negocio (console.log normais).
class QuietLogger extends ConsoleLogger {
  log(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    if (context === 'RouterExplorer' || context === 'InstanceLoader' || context === 'RoutesResolver') return;
    super.log(message, ...optionalParams);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new QuietLogger(),
  });
  // 1. Configuração de CORS (Essencial para o seu frontend em Vite)
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
      exposedHeaders: ['x-company-id', 'Content-Disposition', 'X-Ecf-Warnings', 'X-Ecd-Warnings'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // 2. Global Prefix (Opcional, mas comum em refatorações de microserviços)
  // app.setGlobalPrefix('api');
  // ValidationPipe global - sem isso os decorators class-validator dos DTOs nunca
  // eram executados (dado invalido/faltante chegava direto no Prisma e virava 500
  // generico em vez do 400 com mensagem que os DTOs ja foram escritos pra produzir).
  // enableImplicitConversion e necessario pq varios DTOs de filtro (@Query) tem
  // campos boolean/number que chegam como string na querystring.
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  (app as any).useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  console.log('📁 Uploads servidos em http://localhost:3000/uploads');
  app.use(require('express').json({
    limit: '10mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
  await app.listen(3000);
  console.log('🚀 Servidor rodando em http://localhost:3000');
}
bootstrap();
