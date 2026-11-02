import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

/**
 * M13 — Vérification publique et suivi usager
 * Exigences : BF-55, BF-56 (P0), BF-57 · Interface fournie : IVerification
 */
@Module({ controllers: [VerificationController], providers: [VerificationService] })
export class VerificationModule {}
