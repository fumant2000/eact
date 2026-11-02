import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

/** M13 Vérification publique — BF-55, BF-56, BF-57. */
@Module({ controllers: [VerificationController], providers: [VerificationService] })
export class VerificationModule {}
