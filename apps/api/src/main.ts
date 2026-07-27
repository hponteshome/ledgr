// Fixa o fuso do processo Node em America/Sao_Paulo (UTC-3), independente do
// fuso do SO/container. O driver pg (node-postgres) le/grava colunas DATE e
// TIMESTAMP usando o fuso local do processo - sem isso, mover o backend para
// um ambiente com fuso diferente (ex: container Linux padrao em UTC) reintroduz
// o bug de -1 dia em datas de vigencia de contrato, vencimento, etc.
process.env.TZ = 'America/Sao_Paulo';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConsoleLogger } from '@nestjs/common';
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
      exposedHeaders: ['x-company-id', 'Content-Disposition'], // ← ISSO ESTÁ FALTANDO
  allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // 2. Global Prefix (Opcional, mas comum em refatorações de microserviços)
  // app.setGlobalPrefix('api');
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
