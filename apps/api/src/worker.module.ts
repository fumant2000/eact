import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';

export const FILES = ['documents', 'github', 'notifications', 'relances'] as const;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    ...FILES.map((name) => BullModule.registerQueue({ name })),
    // Les processeurs (@Processor) sont déclarés dans les modules métier concernés.
  ],
})
export class WorkerModule {}
