import { Global, Module } from '@nestjs/common';
import { ChiffrementService } from './crypto/chiffrement.service';
import { MessagerieService } from './messagerie/messagerie.service';

/** Adaptateurs techniques partagés (interfaces requises, CDC tableau 18). */
@Global()
@Module({
  providers: [ChiffrementService, MessagerieService],
  exports: [ChiffrementService, MessagerieService],
})
export class InfrastructureModule {}
