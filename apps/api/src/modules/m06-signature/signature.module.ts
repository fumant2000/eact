import { Module } from '@nestjs/common';
import { AuditModule } from '../m10-audit/audit.module';
import { SignatureService } from './signature.service';

/**
 * M06 — Signature, numérotation et horodatage
 * Exigences : BF-29 à BF-33 · Priorité : P0
 * Interface fournie : ISignature
 */
@Module({ imports: [AuditModule], providers: [SignatureService], exports: [SignatureService] })
export class SignatureModule {}
