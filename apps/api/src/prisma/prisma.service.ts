import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

const envPath = join(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

const pg = require('pg');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(`❌ DATABASE_URL não encontrada no caminho: ${envPath}`);
    }

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('🟢 Ledgr Database conectado.');
    } catch (e) {
      this.logger.error('✖️ Erro na conexão com o banco:', e);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}