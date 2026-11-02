import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StatutActe } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * IVerification — UC-17 (BF-55 à BF-57, RG-21). Sans authentification.
 * N'expose que référence, type, date, signataire, statut et empreintes ; l'objet seulement si l'acte est Public.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private async trouver(code: string) {
    const normalise = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.+)$/, '$1-$2');
    const acte = await this.prisma.acte.findUnique({
      where: { codeVerification: normalise },
      include: { typeActe: true, structure: { include: { parent: true } }, signataire: true, delegation: true },
    });
    if (!acte?.reference || !acte.signeLe) throw new NotFoundException({ code: 'INTROUVABLE', message: 'Aucun acte ne correspond à ce code' });
    return acte;
  }

  async verifier(code: string) {
    const a = await this.trouver(code);
    // Consultation comptabilisée sans aucune donnée personnelle (UC-17, postcondition).
    this.events.emit('acte.verifie', { action: 'acte.verifie', ressourceType: 'acte', ressourceId: a.id });
    return {
      reference: a.reference,
      type: a.typeActe.libelle,
      structure: [a.structure.parent?.code, a.structure.code].filter(Boolean).join(' / '),
      signeLe: a.signeLe,
      signataire: a.signataire ? `${a.signataire.prenom} ${a.signataire.nom}` : null,
      qualite: a.delegation?.mention ?? 'Le Ministre',
      statut: a.statut === StatutActe.RETIRE ? 'RETIRE' : 'VALIDE',
      empreinteTexte: a.empreinteSha256,
      empreintePdf: a.empreintePdf,
      // RG-21 : contenu (ici l'objet) affiché seulement pour un acte Public
      objet: a.confidentialite === 'PUBLIC' ? a.objet : null,
    };
  }

  /** BF-57 : le PDF reçu est-il octet pour octet celui qui a été signé ? */
  async comparer(code: string, contenu: Buffer) {
    const a = await this.trouver(code);
    const empreinte = createHash('sha256').update(contenu).digest('hex');
    return { identique: !!a.empreintePdf && empreinte === a.empreintePdf, empreinteFichier: empreinte, empreinteOriginal: a.empreintePdf };
  }
}
