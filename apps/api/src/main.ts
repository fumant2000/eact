import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Contrat d'interface front/back (ENF-10) : http://localhost:3000/docs
  const config = new DocumentBuilder()
    .setTitle('EACT API')
    .setDescription("Gestion électronique des actes administratifs — Ministère de l'Enseignement Supérieur (MINESUP)")
    .setVersion('v1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
