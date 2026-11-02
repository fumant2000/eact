import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENEMENTS } from '@eact/shared';
import { Antivirus } from '../../infrastructure/antivirus/antivirus';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Stockage } from '../../infrastructure/stockage/stockage';
import {
  executerPipeline,
  FiltreAntivirus,
  FiltreDesactive,
  FiltreEmpreinte,
  FiltreTypeTaille,
  RejetFiltre,
  type Filtre,
} from './pipeline';

/** IDocuments : traitement des pièces, exécuté dans l'API après la réponse 202 (BF-18, RG-24). */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly filtres: Filtre[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockage: Stockage,
    private readonly events: EventEmitter2,
    antivirus: Antivirus,
  ) {
    this.filtres = [
      new FiltreTypeTaille(),
      new FiltreAntivirus(antivirus),
      new FiltreDesactive('Conversion PDF/A (Gotenberg) — activée avec la signature'),
      new FiltreDesactive('OCR (Tesseract) — version 2, EV-01'),
      new FiltreEmpreinte(),
      new FiltreDesactive('Indexation plein texte — M08'),
    ];
  }

  /** Traite une pièce déjà enregistrée en EN_ATTENTE ; ne lève jamais (l'état final est en base). */
  async traiterPiece(pieceId: string, contenu: Buffer, nomFichier: string, acteurId: string) {
    let statut: 'SAINE' | 'INFECTEE' | 'REJETEE' = 'SAINE';
    let motif: string | undefined;
    try {
      const doc = await executerPipeline(this.filtres, { contenu, nomFichier, typeMime: 'application/octet-stream' });
      const piece = await this.prisma.piece.findUnique({ where: { id: pieceId } });
      if (!piece) return; // supprimée pendant l'analyse
      await this.stockage.ecrire(piece.cheminObjet, doc.contenu, doc.typeMime);
      await this.prisma.piece.update({
        where: { id: pieceId },
        data: { statutAnalyse: 'SAINE', typeMime: doc.typeMime, empreinteSha256: doc.empreinteSha256 },
      });
    } catch (e) {
      statut = e instanceof RejetFiltre ? e.statut : 'REJETEE';
      motif = e instanceof RejetFiltre ? e.message : 'Erreur de traitement, réessayez';
      if (!(e instanceof RejetFiltre)) this.logger.error(e);
      await this.prisma.piece.updateMany({ where: { id: pieceId }, data: { statutAnalyse: statut, motifRejet: motif } });
    }
    this.events.emit(EVENEMENTS.PIECE_ANALYSEE, {
      acteurId,
      action: EVENEMENTS.PIECE_ANALYSEE,
      ressourceType: 'piece',
      ressourceId: pieceId,
      details: { statut, motif },
    });
  }
}
