import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';

/** Pipeline documents (tubes et filtres, CDC §13.1) — BF-18, BF-32, RG-24. */
@Module({ providers: [DocumentsService], exports: [DocumentsService] })
export class DocumentsModule {}
