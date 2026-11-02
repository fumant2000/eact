import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health/health.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { MODULES_METIER } from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Bus d'événements interne : invocation implicite (CDC §11)
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    PrismaModule,
    InfrastructureModule,
    ...MODULES_METIER,
  ],
  controllers: [HealthController],
})
export class AppModule {}
