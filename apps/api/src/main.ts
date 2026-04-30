import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Configuração de CORS (Essencial para o seu frontend em Vite)
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
      exposedHeaders: ['x-company-id'], // ← ISSO ESTÁ FALTANDO
  allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Global Prefix (Opcional, mas comum em refatorações de microserviços)
  // app.setGlobalPrefix('api');

  (app as any).useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  console.log('📁 Uploads servidos em http://localhost:3000/uploads');
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));
  await app.listen(3000);
  console.log('🚀 Servidor rodando em http://localhost:3000');
}
bootstrap();
