import { Module } from '@nestjs/common';

/**
 * M09 — Archivage
 * Exigences : BF-44 à BF-47 · Priorité : P1
 * Interface fournie : IArchives
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class ArchivageModule {}
