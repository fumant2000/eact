import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role, StatutActe, TypeDelegation } from '@prisma/client';
import { EVENEMENTS, formaterReference, peutAppliquer } from '@eact/shared';
import { toDataURL } from 'qrcode';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { ConvertisseurPdf } from '../../infrastructure/pdf/convertisseur-pdf';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Stockage } from '../../infrastructure/stockage/stockage';
import { htmlActeSigne, htmlApercu, PIED_DE_PAGE } from '../documents/gabarit-pdf';
import { AuthService } from '../m01-auth/auth.service';
import { AuditService } from '../m10-audit/audit.service';

const ROUTE = 'POST /v1/actes/:id/signature';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I : lisible une fois imprimé
const nomComplet = (u: { prenom: string; nom: string }) => `${u.prenom} ${u.nom}`;
const urlVerification = (code: string) => `${process.env.WEB_URL ?? process.env.PUBLIC_BASE_URL}/verifier/${code}`;

function codeCourt(): string {
  const c = [...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`; // ex. K7Q2-9M, imprimé sous le QR
}

/**
 * ISignature — UC-09 « Signer un acte » (BF-29 à BF-33, RG-08 à RG-12, ADR 0003).
 * Une seule transaction : verrou de l'acte, séquenceur (SELECT … FOR UPDATE), référence, empreinte,
 * clé d'idempotence, journal. Le PDF/A est produit après validation ; s'il échoue (Gotenberg arrêté),
 * l'acte reste signé et numéroté (RG-09) et le PDF est régénéré à la première demande.
 */
@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly events: EventEmitter2,
    private readonly pdf: ConvertisseurPdf,
    private readonly stockage: Stockage,
  ) {}

  // ─────────── RG-11 : compétence du signataire ───────────

  /** Le titulaire (Ministre) signe tout acte du ministère ; un délégataire, les types de sa délégation en cours. */
  async competence(u: UtilisateurConnecte, codeType: string, redacteurId: string) {
    if (redacteurId === u.sub) return { peut: false as const, raison: 'REDACTEUR' }; // RG-19
    if (u.roles.includes(Role.AUTORITE_SIGNATAIRE)) return { peut: true as const, qualite: 'LE MINISTRE', delegationId: undefined };
    const maintenant = new Date();
    const delegation = await this.prisma.delegation.findFirst({
      where: {
        delegataireId: u.sub,
        actif: true,
        debut: { lte: maintenant },
        fin: { gte: maintenant },
        delegant: { actif: true, roles: { some: { role: Role.AUTORITE_SIGNATAIRE } } },
        OR: [
          // Délégation de signature : les types cochés (vide = tous)
          { type: TypeDelegation.SIGNATURE, perimetre: { has: codeType } },
          { type: TypeDelegation.SIGNATURE, perimetre: { isEmpty: true } },
          // Intérim du Ministre : l'ensemble de ses attributions (maquette F2)
          { type: TypeDelegation.INTERIM },
        ],
      },
      orderBy: { type: 'asc' }, // la délégation de signature dédiée (et sa mention) passe avant l'intérim
    });
    if (!delegation) return { peut: false as const, raison: 'INCOMPETENT' };
    return { peut: true as const, qualite: delegation.mention, delegationId: delegation.id };
  }

  /** E1 « À signer » : actes prêts à signer relevant de la compétence de l'agent. */
  async aSigner(u: UtilisateurConnecte) {
    const actes = await this.prisma.acte.findMany({
      where: { statut: StatutActe.PRET_A_SIGNER, typeActe: { signeHorsMinistere: false } },
      include: { typeActe: true, redacteur: { include: { structure: true } }, structure: true, visas: { select: { id: true } } },
      orderBy: { etapeEntreeLe: 'asc' },
    });
    const resultat = [];
    for (const a of actes) {
      const c = await this.competence(u, a.typeActe.code, a.redacteurId);
      if (!c.peut) continue;
      resultat.push({
        id: a.id,
        codeType: a.typeActe.code,
        objet: a.objet,
        confidentialite: a.confidentialite,
        redacteur: nomComplet(a.redacteur),
        structure: a.structure.libelle,
        nbVisas: a.visas.length,
        pretDepuis: a.etapeEntreeLe,
        qualite: c.qualite,
      });
    }
    return resultat;
  }

  // ─────────── UC-09 ───────────

  async signer(acteId: string, u: UtilisateurConnecte, code: string, cle: string | undefined, ip: string) {
    if (!cle || cle.length < 8 || cle.length > 100) {
      throw new BadRequestException({ code: 'CLE_IDEMPOTENCE', message: 'En-tête Idempotency-Key requis (§16.3)' });
    }
    // 3a : requête rejouée (double clic, coupure) → même résultat, pas de second numéro.
    const deja = await this.prisma.cleIdempotence.findUnique({ where: { cle } });
    if (deja) {
      if (deja.utilisateurId !== u.sub || deja.route !== ROUTE) throw new ConflictException({ code: 'CLE_IDEMPOTENCE', message: 'Clé déjà utilisée' });
      return { ...(await this.resultat((deja.reponse as { acteId: string }).acteId)), rejoue: true };
    }

    const acte = await this.prisma.acte.findUnique({ where: { id: acteId }, include: { typeActe: true } });
    if (!acte) throw new NotFoundException('Acte introuvable');
    if (acte.typeActe.signeHorsMinistere) {
      throw new ConflictException({ code: 'SIGNE_HORS_MINISTERE', message: 'Un projet de décret est transmis à la Présidence, pas signé par le ministère (ADR 0008)' });
    }
    if (!peutAppliquer('signer', acte.statut)) {
      throw new ConflictException({ code: 'TRANSITION_INTERDITE', message: acte.statut === StatutActe.SIGNE ? 'Cet acte est déjà signé' : "L'acte n'est pas prêt à signer" });
    }
    const competence = await this.competence(u, acte.typeActe.code, acte.redacteurId);
    if (!competence.peut) {
      throw new ForbiddenException({ code: competence.raison, message: competence.raison === 'REDACTEUR' ? 'Un rédacteur ne signe pas son propre acte (RG-19)' : 'Vous n’êtes pas compétent pour signer cet acte (RG-11)' });
    }
    await this.auth.verifierTotpAction(u.sub, code, ip); // RG-12

    try {
      await this.prisma.$transaction(async (tx) => {
        // Verrou de l'acte : deux signatures simultanées du même acte s'exécutent l'une après l'autre.
        const [verrou] = await tx.$queryRaw<{ statut: StatutActe }[]>`SELECT statut FROM acte WHERE id = ${acteId}::uuid FOR UPDATE`;
        if (verrou.statut !== StatutActe.PRET_A_SIGNER) throw new ConflictException({ code: 'DEJA_SIGNE', message: 'Cet acte vient d’être signé' });

        const complet = await tx.acte.findUniqueOrThrow({
          where: { id: acteId },
          include: { typeActe: true, structure: { include: { parent: true } }, destinataires: { orderBy: { ordre: 'asc' } } },
        });
        // Horloge unique : l'heure vient de la base, pas du poste (§16.4, BF-31).
        const [{ maintenant }] = await tx.$queryRaw<{ maintenant: Date }[]>`SELECT now() AS maintenant`;
        const annee = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', year: 'numeric' }).format(maintenant));

        // Séquenceur centralisé (ADR 0003, RG-08) : ligne créée au besoin puis verrouillée.
        await tx.$executeRaw`
          INSERT INTO compteur_numerotation (type_acte_id, structure_id, annee, dernier_numero)
          VALUES (${complet.typeActeId}::uuid, ${complet.structureId}::uuid, ${annee}, 0)
          ON CONFLICT DO NOTHING`;
        const [compteur] = await tx.$queryRaw<{ dernier_numero: number }[]>`
          SELECT dernier_numero FROM compteur_numerotation
          WHERE type_acte_id = ${complet.typeActeId}::uuid AND structure_id = ${complet.structureId}::uuid AND annee = ${annee}
          FOR UPDATE`;
        const sequence = compteur.dernier_numero + 1;
        await tx.compteurNumerotation.update({
          where: { typeActeId_structureId_annee: { typeActeId: complet.typeActeId, structureId: complet.structureId, annee } },
          data: { dernierNumero: sequence },
        });

        const chaine = [complet.structure.parent?.code, complet.structure.code].filter((c): c is string => !!c);
        const reference = formaterReference({ sequence, codeType: complet.typeActe.code, chaineStructures: chaine, annee });
        // Empreinte du texte signé (BF-32) : imprimée sur l'acte, affichée sur la page de vérification.
        const empreinteSha256 = createHash('sha256')
          .update(JSON.stringify([reference, complet.typeActe.code, complet.objet, complet.contenu, complet.destinataires.map((d) => d.libelle), maintenant.toISOString(), u.sub, competence.delegationId ?? null]))
          .digest('hex');

        await tx.acte.update({
          where: { id: acteId },
          data: {
            statut: StatutActe.SIGNE,
            reference,
            annee,
            sequence,
            signataireId: u.sub,
            delegationId: competence.delegationId,
            signeLe: maintenant,
            codeVerification: codeCourt(),
            empreinteSha256,
            version: { increment: 1 },
          },
        });
        await tx.cleIdempotence.create({ data: { cle, utilisateurId: u.sub, route: ROUTE, statutHttp: 201, reponse: { acteId } } });
        await this.audit.journaliser(
          { acteurId: u.sub, action: EVENEMENTS.ACTE_SIGNE, ressourceType: 'acte', ressourceId: acteId, details: { reference, empreinte: empreinteSha256, delegation: competence.delegationId ?? null } },
          tx,
        );
      });
    } catch (e) {
      // Course entre deux envois de la même clé : le premier a gagné, on renvoie son résultat.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const gagnant = await this.prisma.cleIdempotence.findUnique({ where: { cle } });
        if (gagnant) return { ...(await this.resultat(acteId)), rejoue: true };
      }
      throw e;
    }

    this.events.emit(EVENEMENTS.ACTE_SIGNE, { acteId });
    // Le PDF/A est produit en arrière-plan : la signature est acquise, l'écran E4 suit pdfDisponible.
    // En mode complet, ce traitement passera par la file BullMQ « documents » du worker (§16.2).
    setImmediate(() => void this.genererPdf(acteId).catch((e) => this.logger.warn(`PDF/A différé pour ${acteId} : ${(e as Error).message}`)));
    return { ...(await this.resultat(acteId)), rejoue: false };
  }

  /** Ce que voient le signataire (E4) et la fiche d'un acte signé (E6). */
  async resultat(acteId: string) {
    const a = await this.prisma.acte.findUniqueOrThrow({ where: { id: acteId }, include: { signataire: true, delegation: true } });
    if (!a.reference || !a.codeVerification || !a.signeLe) throw new ConflictException({ code: 'NON_SIGNE', message: "L'acte n'est pas signé" });
    return {
      acteId: a.id,
      reference: a.reference,
      signeLe: a.signeLe,
      signataire: a.signataire ? nomComplet(a.signataire) : null,
      qualite: a.delegation?.mention ?? 'Le Ministre',
      codeVerification: a.codeVerification,
      empreinteSha256: a.empreinteSha256,
      urlVerification: urlVerification(a.codeVerification),
      qrCode: await toDataURL(urlVerification(a.codeVerification), { margin: 1, width: 240, color: { dark: '#1a2033' } }),
      pdfDisponible: !!a.cheminPdf,
    };
  }

  // ─────────── BF-32 : PDF/A ───────────

  async genererPdf(acteId: string) {
    const a = await this.prisma.acte.findUniqueOrThrow({
      where: { id: acteId },
      include: { typeActe: true, structure: { include: { parent: true } }, destinataires: { orderBy: { ordre: 'asc' } }, signataire: true, delegation: true },
    });
    if (!a.reference || !a.signeLe || !a.codeVerification || !a.empreinteSha256 || !a.signataire) throw new ConflictException('Acte non signé');
    const html = htmlActeSigne({
      codeType: a.typeActe.code,
      reference: a.reference,
      objet: a.objet,
      contenuHtml: a.contenu,
      chaineStructures: [a.structure.parent?.code, a.structure.code].filter((c): c is string => !!c),
      ampliations: a.destinataires.map((d) => d.libelle),
      signeLe: a.signeLe,
      signataireNom: nomComplet(a.signataire),
      qualite: a.delegation?.mention ?? 'LE MINISTRE',
      codeVerification: a.codeVerification,
      empreinteTexte: a.empreinteSha256,
      urlVerification: urlVerification(a.codeVerification),
      qrCode: await toDataURL(urlVerification(a.codeVerification), { margin: 1, width: 300 }),
    });
    const fichier = await this.pdf.htmlVersPdfA(html, PIED_DE_PAGE);
    const chemin = `actes/${a.annee}/${a.id}.pdf`;
    await this.stockage.ecrire(chemin, fichier, 'application/pdf');
    await this.prisma.acte.update({
      where: { id: acteId },
      data: { cheminPdf: chemin, empreintePdf: createHash('sha256').update(fichier).digest('hex') },
    });
    return fichier;
  }

  /** R-06 : aperçu A4 d'un projet, tel qu'il sera imprimé, avant soumission ou signature. */
  async apercu(acteId: string): Promise<Buffer> {
    const a = await this.prisma.acte.findUniqueOrThrow({
      where: { id: acteId },
      include: { typeActe: true, structure: { include: { parent: true } }, destinataires: { orderBy: { ordre: 'asc' } } },
    });
    const html = htmlApercu({
      codeType: a.typeActe.code,
      objet: a.objet || '[objet à saisir]',
      contenuHtml: a.contenu,
      chaineStructures: [a.structure.parent?.code, a.structure.code].filter((c): c is string => !!c),
      ampliations: a.destinataires.map((d) => d.libelle),
      qualite: await this.qualitePrevue(a.typeActe.code),
    });
    return this.pdf.htmlVersPdfA(html, PIED_DE_PAGE, false);
  }

  private async qualitePrevue(codeType: string) {
    const maintenant = new Date();
    const d = await this.prisma.delegation.findFirst({
      where: { type: TypeDelegation.SIGNATURE, actif: true, debut: { lte: maintenant }, fin: { gte: maintenant }, perimetre: { has: codeType } },
    });
    return d?.mention ?? 'LE MINISTRE';
  }

  /** Téléchargement : PDF stocké, ou régénéré s'il a échoué à la signature. */
  async lirePdf(acteId: string): Promise<{ fichier: Buffer; nom: string }> {
    const a = await this.prisma.acte.findUniqueOrThrow({ where: { id: acteId } });
    if (!a.reference) throw new ConflictException({ code: 'NON_SIGNE', message: "L'acte n'est pas signé" });
    const nom = `${a.reference.replace(/^N°\s*/, '').replace(/\//g, '-')}.pdf`;
    if (a.cheminPdf) return { fichier: await this.stockage.lire(a.cheminPdf), nom };
    return { fichier: await this.genererPdf(acteId), nom };
  }
}
