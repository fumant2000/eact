import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Délais relevés : les verrous FOR UPDATE (séquenceur, journal) font attendre les transactions concurrentes (TF-07).
      transactionOptions: { maxWait: 15_000, timeout: 20_000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
