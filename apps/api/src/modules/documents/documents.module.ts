import { Module } from '@nestjs/common';

/**
 * Pipeline documents (tubes et filtres, CDC §13.1)
 * Exigences : RG-24, BF-32 · Priorité : P0
 * Interface fournie : IDocuments
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class DocumentsModule {}
