import { Module } from '@nestjs/common';
import { AuditModule } from '../m10-audit/audit.module';
import { CircuitService } from './circuit.service';
import { ParapheurController } from './parapheur.controller';

/** M05 Circuit de validation (parapheur) — BF-22 à BF-28, RG-04 à RG-07. */
@Module({ imports: [AuditModule], controllers: [ParapheurController], providers: [CircuitService], exports: [CircuitService] })
export class CircuitModule {}
