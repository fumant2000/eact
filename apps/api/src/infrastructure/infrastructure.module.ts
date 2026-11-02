import { Global, Module } from '@nestjs/common';
import { Antivirus, AntivirusClamav, AntivirusSimule } from './antivirus/antivirus';
import { ChiffrementService } from './crypto/chiffrement.service';
import { MessagerieService } from './messagerie/messagerie.service';
import { Stockage, StockageLocal, StockageS3 } from './stockage/stockage';

/**
 * Adaptateurs techniques partagés (interfaces requises, CDC tableau 18).
 * Le métier injecte la classe abstraite ; la variable d'environnement choisit l'implémentation.
 */
@Global()
@Module({
  providers: [
    ChiffrementService,
    MessagerieService,
    { provide: Stockage, useFactory: () => (process.env.STOCKAGE === 's3' ? new StockageS3() : new StockageLocal()) },
    { provide: Antivirus, useFactory: () => (process.env.ANTIVIRUS === 'clamav' ? new AntivirusClamav() : new AntivirusSimule()) },
  ],
  exports: [ChiffrementService, MessagerieService, Stockage, Antivirus],
})
export class InfrastructureModule {}
