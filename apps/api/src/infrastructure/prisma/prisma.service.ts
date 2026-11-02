import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Le séquenceur (SELECT … FOR UPDATE) et le verrou du journal font volontairement attendre les transactions
      // concurrentes : les délais par défaut (2 s d'attente, 5 s d'exécution) faisaient échouer des signatures
      // simultanées et perdre des entrées d'audit sous charge (TF-07).
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
