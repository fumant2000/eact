import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StatutActe } from '@prisma/client';
import { EVENEMENTS } from '@eact/shared';
import { MessagerieService } from '../../infrastructure/messagerie/messagerie.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CircuitService } from '../m05-circuit/circuit.service';

interface Destinataire {
  email: string;
  prenom: string;
  nom: string;
}

/** M12 INotifier — BF-54 (e-mail) : jamais le contenu d'un acte, seulement objet, type et lien (loi n° 2024/017). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuits: CircuitService,
    private readonly messagerie: MessagerieService,
  ) {}

  private lien(acteId: string) {
    return `${process.env.WEB_URL ?? process.env.PUBLIC_BASE_URL}/actes/${acteId}`;
  }

  private async envoyer(a: Destinataire[], sujet: string, corps: (d: Destinataire) => string) {
    for (const d of a) {
      try {
        await this.messagerie.envoyer({
          a: d.email,
          sujet: `EACT — ${sujet}`,
          texte: `Bonjour ${d.prenom} ${d.nom},\n\n${corps(d)}\n\n— EACT, Ministère de l'Enseignement Supérieur\n(message automatique, ne pas répondre)`,
        });
      } catch (e) {
        this.logger.warn(`Notification non envoyée à ${d.email} : ${(e as Error).message}`);
      }
    }
  }

  private charger(acteId: string) {
    return this.prisma.acte.findUnique({ where: { id: acteId }, include: { etapeCourante: true, redacteur: true, typeActe: true, visas: { orderBy: { creeLe: 'desc' }, take: 1, include: { viseur: true } } } });
  }

  /** Soumission ou visa favorable : prévenir qui doit agir maintenant. */
  @OnEvent(EVENEMENTS.ACTE_SOUMIS, { async: true })
  @OnEvent(EVENEMENTS.ACTE_VISE, { async: true })
  async apresAvancement({ acteId }: { acteId: string }) {
    const acte = await this.charger(acteId);
    if (!acte) return;
    const objet = `${acte.typeActe.libelle} « ${acte.objet} »`;
    if (acte.statut === StatutActe.EN_CIRCUIT && acte.etapeCourante) {
      const viseurs = await this.prisma.utilisateur.findMany({
        where: { id: { in: (await this.circuits.viseursEligibles(acte, acte.etapeCourante)).map((v) => v.id) } },
      });
      await this.envoyer(viseurs, 'Un acte attend votre visa', () =>
        `${objet} attend votre visa (étape « ${acte.etapeCourante!.libelle} », délai ${acte.etapeCourante!.delaiHeures} h).\n\nOuvrir l'acte : ${this.lien(acteId)}`,
      );
    } else if (acte.statut === StatutActe.PRET_A_SIGNER) {
      await this.envoyer(await this.circuits.signatairesPossibles(acte.typeActe.code), 'Un acte est prêt à signer', () =>
        `${objet} a reçu tous ses visas et attend votre signature.\n\nOuvrir l'acte : ${this.lien(acteId)}`,
      );
      await this.envoyer([acte.redacteur], 'Votre projet a reçu tous ses visas', () => `${objet} est prêt à signer.\n\nSuivre : ${this.lien(acteId)}`);
    }
  }

  @OnEvent(EVENEMENTS.ACTE_A_CORRIGER, { async: true })
  async apresCorrection({ acteId }: { acteId: string }) {
    const acte = await this.charger(acteId);
    const visa = acte?.visas[0];
    if (!acte || !visa) return;
    if (acte.statut === StatutActe.A_CORRIGER) {
      await this.envoyer([acte.redacteur], 'Correction demandée', () =>
        `${visa.viseur.prenom} ${visa.viseur.nom} demande une correction de « ${acte.objet} » :\n« ${visa.observation} »\n\nCorriger : ${this.lien(acteId)}`,
      );
    } else {
      await this.apresAvancement({ acteId }); // renvoi à une étape antérieure : le viseur concerné est prévenu
    }
  }

  @OnEvent(EVENEMENTS.ACTE_SIGNE, { async: true })
  async apresSignature({ acteId }: { acteId: string }) {
    const acte = await this.prisma.acte.findUnique({ where: { id: acteId }, include: { redacteur: true, typeActe: true } });
    if (!acte?.reference) return;
    await this.envoyer([acte.redacteur], `Acte signé ${acte.reference}`, () =>
      `${acte.typeActe.libelle} « ${acte.objet} » a été signé sous la référence ${acte.reference}.\n` +
      `Code de vérification public : ${acte.codeVerification}\n\nConsulter et télécharger le PDF/A : ${this.lien(acteId)}`,
    );
  }

  @OnEvent(EVENEMENTS.ACTE_REJETE, { async: true })
  async apresRejet({ acteId }: { acteId: string }) {
    const acte = await this.charger(acteId);
    const visa = acte?.visas[0];
    if (!acte || !visa) return;
    await this.envoyer([acte.redacteur], 'Projet rejeté', () =>
      `« ${acte.objet} » a été rejeté par ${visa.viseur.prenom} ${visa.viseur.nom}.\nMotif : « ${visa.observation} »\n\nConsulter : ${this.lien(acteId)}`,
    );
  }
}
