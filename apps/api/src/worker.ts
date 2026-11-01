import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Point d'entrée des traitements asynchrones (CDC §16.2) :
 * files `documents` (pipeline tubes et filtres), `github`, `notifications`, `relances`.
 * Aucun port HTTP : le worker ne fait que consommer des files.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}
bootstrap();
