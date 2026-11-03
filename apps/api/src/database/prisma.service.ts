import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('databaseUrl');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    super({
      adapter: new PrismaPg({ connectionString, max: 10 }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      // Neon free-tier branches can be cold, so interactive transactions need
      // more headroom than Prisma's 2s/5s defaults.
      transactionOptions: { maxWait: 10_000, timeout: 20_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma client connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async isReady(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database readiness check failed', error as Error);
      return false;
    }
  }
}
