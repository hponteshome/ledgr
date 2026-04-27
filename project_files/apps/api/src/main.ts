import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Configuração de CORS (Essencial para o seu frontend em Vite)
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  // 2. Global Prefix (Opcional, mas comum em refatorações de microserviços)
  // app.setGlobalPrefix('api');

  await app.listen(3000);
  console.log(`🚀 API rodando em: http://localhost:3000`);
}
bootstrap();