import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { GithubModule } from '../m14-github/github.module';
import { AuditModule } from '../m10-audit/audit.module';
import { ActesController } from './actes.controller';
import { ActesService } from './actes.service';

/** M04 Rédaction et modèles d'actes — BF-15 à BF-22. */
@Module({
  imports: [CircuitModule, DocumentsModule, AuditModule, GithubModule],
  controllers: [ActesController],
  providers: [ActesService],
  exports: [ActesService],
})
export class ActesModule {}
