import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { AuditModule } from '../m10-audit/audit.module';
import { ActesController } from './actes.controller';
import { ActesService } from './actes.service';

/**
 * M04 — Rédaction et modèles d'actes
 * Exigences : BF-15 à BF-22 · Priorité : P0
 * Interface fournie : IActes · Interfaces requises : IParapheur (circuit), IDocuments, IStockage, IAudit
 */
@Module({
  imports: [CircuitModule, DocumentsModule, AuditModule],
  controllers: [ActesController],
  providers: [ActesService],
  exports: [ActesService],
})
export class ActesModule {}
