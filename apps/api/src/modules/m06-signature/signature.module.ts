import { Module } from '@nestjs/common';
import { ActesModule } from '../m04-actes/actes.module';
import { AuditModule } from '../m10-audit/audit.module';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';

/**
 * M06 — Signature, numérotation et horodatage
 * Exigences : BF-29 à BF-33 · Priorité : P0
 * Interface fournie : ISignature · Interfaces requises : IActes, IAuthentification, IAudit, IStockage, convertisseur PDF/A
 */
@Module({ imports: [AuditModule, ActesModule], controllers: [SignatureController], providers: [SignatureService], exports: [SignatureService] })
export class SignatureModule {}
