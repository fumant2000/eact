import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * M10 — Journal d'audit chaîné
 * Exigences : BF-48 à BF-50 · Priorité : P0
 * Interface fournie : IAudit
 */
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
