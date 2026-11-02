import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';

/**
 * Pipeline documents (tubes et filtres, CDC §13.1)
 * Exigences : BF-18, RG-24, BF-32 · Priorité : P0
 * Interface fournie : IDocuments · Interfaces requises : IStockage, IAntivirus, convertisseur PDF/A
 */
@Module({ providers: [DocumentsService], exports: [DocumentsService] })
export class DocumentsModule {}
