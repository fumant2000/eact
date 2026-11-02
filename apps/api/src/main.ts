import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  app.set('trust proxy', 1); // IP réelle derrière nginx / le proxy Next (journal d'audit)
  app.use(cookieParser());
  // DTO validés et nettoyés : champs inconnus refusés (CDC tableau 24, injection)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Contrat d'interface front/back (ENF-09) : http://localhost:3000/docs
  const config = new DocumentBuilder()
    .setTitle('EACT API')
    .setDescription("Gestion électronique des actes administratifs — Ministère de l'Enseignement Supérieur (MINESUP)")
    .setVersion('v1')
    .addCookieAuth('eact_at')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.API_PORT ?? 3000), '0.0.0.0');
}
bootstrap();
