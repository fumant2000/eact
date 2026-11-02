import { Module } from '@nestjs/common';
import { ActesModule } from '../m04-actes/actes.module';
import { AuditModule } from '../m10-audit/audit.module';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';

/** M06 Signature, numérotation et horodatage — BF-29 à BF-33, RG-08 à RG-12. */
@Module({ imports: [AuditModule, ActesModule], controllers: [SignatureController], providers: [SignatureService], exports: [SignatureService] })
export class SignatureModule {}
