import { randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENEMENTS, formaterReference, peutAppliquer } from '@eact/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../m10-audit/audit.service';

/**
 * ISignature — UC-09 « Signer un acte » (BF-29 à BF-33, RG-08 à RG-12, ADR 0003).
 *
 * Tout se passe dans UNE transaction : verrou du compteur, numéro, référence, audit.
 * La génération du PDF/A (lente) est publiée en événement et traitée par le worker.
 * L'idempotence (TF-08) est assurée en amont par l'intercepteur `Idempotency-Key`.
 * RG-11 / RG-12 (délégation valide, TOTP de moins de 5 min) : vérifiés par le garde de signature.
 */
@Injectable()
export class SignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async signer(acteId: string, signataireId: string, delegationId?: string) {
    const signe = await this.prisma.$transaction(async (tx) => {
      const acte = await tx.acte.findUniqueOrThrow({
        where: { id: acteId },
        include: { typeActe: true, structure: { include: { parent: true } } },
      });
      if (!peutAppliquer('signer', acte.statut)) {
        throw new ConflictException(`Transition interdite depuis ${acte.statut}`);
      }
      if (acte.typeActe.signeHorsMinistere) {
        throw new ConflictException('Un projet de décret est transmis, pas signé par le ministère (ADR 0008)');
      }
      if (acte.redacteurId === signataireId) {
        throw new ForbiddenException('RG-19 : un rédacteur ne signe pas son propre acte');
      }

      // Horloge unique : la date vient de la base, pas du poste ni de l'instance (§16.4).
      const [{ maintenant }] = await tx.$queryRaw<{ maintenant: Date }[]>`SELECT now() AS maintenant`;
      const annee = maintenant.getFullYear();

      // Séquenceur centralisé : création idempotente de la ligne puis verrou exclusif.
      await tx.$executeRaw`
        INSERT INTO compteur_numerotation (type_acte_id, structure_id, annee, dernier_numero)
        VALUES (${acte.typeActeId}::uuid, ${acte.structureId}::uuid, ${annee}, 0)
        ON CONFLICT DO NOTHING`;
      const [compteur] = await tx.$queryRaw<{ dernier_numero: number }[]>`
        SELECT dernier_numero FROM compteur_numerotation
        WHERE type_acte_id = ${acte.typeActeId}::uuid
          AND structure_id = ${acte.structureId}::uuid
          AND annee = ${annee}
        FOR UPDATE`;
      const sequence = compteur.dernier_numero + 1;
      await tx.compteurNumerotation.update({
        where: {
          typeActeId_structureId_annee: { typeActeId: acte.typeActeId, structureId: acte.structureId, annee },
        },
        data: { dernierNumero: sequence },
      });

      const chaine = [acte.structure.parent?.code, acte.structure.code].filter((c): c is string => !!c);
      const reference = formaterReference({ sequence, codeType: acte.typeActe.code, chaineStructures: chaine, annee });
      const hex = randomBytes(3).toString('hex').toUpperCase();
      const codeVerification = `${hex.slice(0, 4)}-${hex.slice(4)}`; // ex. K7Q2-9M imprimé sous le QR

      const resultat = await tx.acte.update({
        where: { id: acteId, version: acte.version }, // verrou optimiste : 409 si modifié entre-temps
        data: {
          statut: 'SIGNE',
          reference,
          annee,
          sequence,
          signataireId,
          delegationId,
          signeLe: maintenant,
          codeVerification,
          version: { increment: 1 },
        },
      });
      await this.audit.journaliser(
        {
          acteurId: signataireId,
          action: EVENEMENTS.ACTE_SIGNE,
          ressourceType: 'acte',
          ressourceId: acteId,
          details: { reference },
        },
        tx,
      );
      return resultat;
    });

    // Après commit : PDF/A + QR + SHA-256 par le worker (pipeline documents), puis diffusion.
    this.events.emit(EVENEMENTS.ACTE_SIGNE, { acteId: signe.id, reference: signe.reference });
    return signe;
  }
}
