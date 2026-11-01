import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * M10 — Journal d'audit chaîné
 * Exigences : BF-48 à BF-50 · Priorité : P0
 * Interface fournie : IAudit
 */
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
