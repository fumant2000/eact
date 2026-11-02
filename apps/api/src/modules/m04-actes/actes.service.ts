import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role, StatutActe } from '@prisma/client';
import { EVENEMENTS, estImmuable, peutAppliquer } from '@eact/shared';
import sanitizeHtml from 'sanitize-html';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Stockage } from '../../infrastructure/stockage/stockage';
import { DocumentsService } from '../documents/documents.service';
import { CircuitService } from '../m05-circuit/circuit.service';
import { AuditService } from '../m10-audit/audit.service';
import type { ModifierActeDto } from './actes.dto';

/** HTML produit par l'éditeur (BF-17) ; tout le reste est retiré (XSS, CDC tableau 24). */
const HTML_AUTORISE: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'],
  allowedAttributes: {},
};
const texteBrut = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').trim();

const GROUPES = {
  brouillons: [StatutActe.BROUILLON],
  enCircuit: [StatutActe.EN_CIRCUIT, StatutActe.PRET_A_SIGNER, StatutActe.TRANSMIS],
  aCorriger: [StatutActe.A_CORRIGER],
  signes: [StatutActe.SIGNE, StatutActe.EXECUTOIRE, StatutActe.ARCHIVE],
} as const;
export type GroupeStatut = keyof typeof GROUPES | 'tous';

const INCLUSIONS = {
  typeActe: true,
  structure: true,
  modele: { select: { libelle: true, version: true } },
  destinataires: { orderBy: { libelle: 'asc' } },
  pieces: { orderBy: { creeLe: 'asc' } },
  etapeCourante: true,
  versions: { select: { id: true } },
} satisfies Prisma.ActeInclude;
type ActeComplet = Prisma.ActeGetPayload<{ include: typeof INCLUSIONS }>;

/**
 * IActes — M04 « Rédaction et modèles d'actes » (BF-15 à BF-22, UC-06).
 * Règles : RG-02 (type + structure), RG-03 (champs obligatoires), RG-10 (immuable après signature),
 * RG-16 (seul un brouillon jamais soumis se supprime), RG-24 (pièces analysées), verrou optimiste (§14.2).
 */
@Injectable()
export class ActesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circuits: CircuitService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly stockage: Stockage,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────── Types et gabarits (UC-06 étapes 1-2) ───────────

  async typesPourRedacteur(u: UtilisateurConnecte) {
    const types = await this.prisma.typeActe.findMany({ where: { actif: true }, orderBy: { code: 'asc' } });
    return Promise.all(
      types.map(async (t) => {
        const structure = await this.circuits.structureEmettriceParDefaut(t.id, u.structureId);
        const circuit = structure ? await this.circuits.circuit(t.id, structure.id) : null;
        return {
          id: t.id,
          code: t.code,
          libelle: t.libelle,
          signeHorsMinistere: t.signeHorsMinistere,
          // UC-06, précondition : le type doit posséder un circuit actif
          nbEtapes: circuit?.etapes.length ?? null,
          structureChaine: structure?.chaine ?? [], // en-tête de l'aperçu (C3)
          signataire: t.signeHorsMinistere ? 'Président de la République ou Premier Ministre' : await this.circuits.signatairePrevu(t.code),
        };
      }),
    );
  }

  async modeles(typeActeId: string) {
    const modeles = await this.prisma.modeleActe.findMany({ where: { typeActeId }, orderBy: { libelle: 'asc' } });
    return {
      // RG-23 : sans GitHub App configurée (ou injoignable), les gabarits viennent du cache.
      source: process.env.GITHUB_APP_ID ? 'github' : 'cache',
      synchroniseLe: modeles.reduce<Date | null>((d, m) => (!d || m.misAJourLe > d ? m.misAJourLe : d), null),
      modeles: modeles.map((m) => ({
        id: m.id,
        libelle: m.libelle,
        description: m.description,
        version: m.version,
        langue: m.langue,
        commitSha: m.commitSha,
        misAJourLe: m.misAJourLe,
        contenu: m.contenuCache,
        ampliationsDefaut: m.ampliationsDefaut,
      })),
    };
  }

  // ─────────── Création (BF-15, BF-16) ───────────

  async creer(u: UtilisateurConnecte, typeActeId: string, modeleId?: string) {
    const type = await this.prisma.typeActe.findUnique({ where: { id: typeActeId } });
    if (!type?.actif) throw new NotFoundException("Type d'acte introuvable");
    const structure = await this.circuits.structureEmettriceParDefaut(typeActeId, u.structureId);
    if (!structure) {
      throw new UnprocessableEntityException({ code: 'CIRCUIT_ABSENT', message: "Aucun circuit n'est paramétré pour ce type dans votre structure" });
    }
    const modele = modeleId ? await this.prisma.modeleActe.findFirst({ where: { id: modeleId, typeActeId } }) : null;
    if (modeleId && !modele) throw new NotFoundException('Modèle introuvable');

    const acte = await this.prisma.acte.create({
      data: {
        typeActeId,
        structureId: structure.id,
        redacteurId: u.sub,
        modeleId: modele?.id,
        objet: '',
        contenu: modele ? sanitizeHtml(modele.contenuCache, HTML_AUTORISE) : '',
        langue: modele?.langue ?? 'FR',
        destinataires: { create: (modele?.ampliationsDefaut ?? []).map((libelle) => ({ libelle })) },
      },
    });
    this.events.emit(EVENEMENTS.ACTE_CREE, {
      acteurId: u.sub,
      action: EVENEMENTS.ACTE_CREE,
      ressourceType: 'acte',
      ressourceId: acte.id,
      details: { type: type.code, modele: modele?.cheminGithub, commit: modele?.commitSha },
    });
    return { id: acte.id };
  }

  // ─────────── Consultation ───────────

  /** « Mes actes » (C1) : actes rédigés par l'agent, avec compteurs par onglet. */
  async mesActes(u: UtilisateurConnecte, groupe: GroupeStatut = 'tous') {
    const actes = await this.prisma.acte.findMany({
      where: { redacteurId: u.sub },
      include: INCLUSIONS,
      orderBy: { misAJourLe: 'desc' },
    });
    const compteurs = Object.fromEntries(
      Object.entries(GROUPES).map(([g, statuts]) => [g, actes.filter((a) => (statuts as readonly StatutActe[]).includes(a.statut)).length]),
    );
    const filtres = groupe === 'tous' ? actes : actes.filter((a) => (GROUPES[groupe] as readonly StatutActe[]).includes(a.statut));
    return {
      compteurs: { tous: actes.length, ...compteurs },
      actes: filtres.map((a) => ({
        id: a.id,
        codeType: a.typeActe.code,
        objet: a.objet,
        statut: a.statut,
        reference: a.reference,
        jamaisSoumis: a.versions.length === 0,
        etapeCourante: a.etapeCourante?.libelle ?? null,
        champsManquants: a.statut === StatutActe.BROUILLON ? this.champsManquants(a).length : 0,
        misAJourLe: a.misAJourLe,
      })),
    };
  }

  private async charger(id: string): Promise<ActeComplet> {
    const acte = await this.prisma.acte.findUnique({ where: { id }, include: INCLUSIONS });
    if (!acte) throw new NotFoundException('Acte introuvable');
    return acte;
  }

  /**
   * RG-15 : rédacteur, membres du circuit (viseurs) et autorités ; un acte confidentiel n'est ouvert
   * qu'à son circuit. Les règles du parapheur (rôle de l'étape courante) s'ajouteront avec M05.
   */
  private async verifierLecture(acte: ActeComplet, u: UtilisateurConnecte) {
    if (acte.redacteurId === u.sub) return;
    const aVise = await this.prisma.visa.count({ where: { acteId: acte.id, viseurId: u.sub } });
    const autorite = u.roles.some((r) => r === Role.SECRETAIRE_GENERAL || r === Role.AUTORITE_SIGNATAIRE);
    if (aVise || (autorite && acte.confidentialite !== 'CONFIDENTIEL')) return;
    throw new ForbiddenException({ code: 'ACCES_REFUSE', message: "Vous n'avez pas accès à cet acte" });
  }

  private estModifiable(acte: ActeComplet, u: UtilisateurConnecte) {
    return acte.redacteurId === u.sub && (acte.statut === StatutActe.BROUILLON || acte.statut === StatutActe.A_CORRIGER);
  }

  /** RG-03 : champs obligatoires déclarés par le type (BF-64). */
  private champsManquants(acte: Pick<ActeComplet, 'objet' | 'contenu' | 'destinataires' | 'typeActe'>): string[] {
    const exiges = (acte.typeActe.champsObligatoires as string[]) ?? [];
    return exiges.filter(
      (champ) =>
        (champ === 'objet' && !acte.objet.trim()) ||
        (champ === 'contenu' && !texteBrut(acte.contenu)) ||
        (champ === 'ampliation' && acte.destinataires.length === 0),
    );
  }

  async detail(id: string, u: UtilisateurConnecte) {
    const acte = await this.charger(id);
    await this.verifierLecture(acte, u);
    if (acte.confidentialite === 'CONFIDENTIEL' && acte.redacteurId !== u.sub) {
      this.events.emit(EVENEMENTS.ACTE_CONSULTE_CONFIDENTIEL, {
        acteurId: u.sub,
        action: EVENEMENTS.ACTE_CONSULTE_CONFIDENTIEL,
        ressourceType: 'acte',
        ressourceId: acte.id,
      });
    }
    const circuit = await this.circuits.circuit(acte.typeActeId, acte.structureId);
    const modifiable = this.estModifiable(acte, u);
    const lignee = await this.circuits.ascendants(acte.structureId);
    return {
      id: acte.id,
      version: acte.version,
      statut: acte.statut,
      reference: acte.reference,
      objet: acte.objet,
      contenu: acte.contenu,
      langue: acte.langue,
      traductionRequise: acte.traductionRequise,
      confidentialite: acte.confidentialite,
      portee: acte.portee,
      misAJourLe: acte.misAJourLe,
      type: { id: acte.typeActe.id, code: acte.typeActe.code, libelle: acte.typeActe.libelle },
      structure: lignee[0],
      modele: acte.modele,
      ampliations: acte.destinataires.map((d) => d.libelle),
      pieces: acte.pieces.map((p) => ({
        id: p.id,
        nomFichier: p.nomFichier,
        typeMime: p.typeMime,
        tailleOctets: p.tailleOctets,
        statutAnalyse: p.statutAnalyse,
        motifRejet: p.motifRejet,
      })),
      circuit: circuit && {
        etapes: circuit.etapes.map((e) => ({ id: e.id, ordre: e.ordre, libelle: e.libelle, roleRequis: e.roleRequis, delaiHeures: e.delaiHeures })),
        signature: await this.circuits.signatairePrevu(acte.typeActe.code),
      },
      etapeCourante: acte.etapeCourante && { ordre: acte.etapeCourante.ordre, libelle: acte.etapeCourante.libelle },
      champsManquants: this.champsManquants(acte),
      modifiable,
      supprimable: modifiable && acte.statut === StatutActe.BROUILLON && acte.versions.length === 0,
      // Structures émettrices possibles : celle de l'agent et ses ascendants disposant d'un circuit pour ce type
      structuresPossibles: modifiable
        ? (
            await Promise.all(
              (await this.circuits.ascendants(u.structureId)).map(async (s) => ((await this.circuits.circuit(acte.typeActeId, s.id)) ? s : null)),
            )
          ).filter((s) => s !== null)
        : [],
    };
  }

  // ─────────── Enregistrement automatique (BF-17, BF-19, BF-21) ───────────

  private async acteModifiable(id: string, u: UtilisateurConnecte) {
    const acte = await this.charger(id);
    if (acte.redacteurId !== u.sub) throw new ForbiddenException({ code: 'ACCES_REFUSE', message: 'Seul le rédacteur modifie son projet' });
    if (estImmuable(acte.statut)) throw new ConflictException({ code: 'ACTE_IMMUABLE', message: 'Un acte signé ne se modifie plus (RG-10)' });
    if (!this.estModifiable(acte, u)) throw new ConflictException({ code: 'ACTE_EN_CIRCUIT', message: "L'acte est dans le circuit de validation" });
    return acte;
  }

  async modifier(id: string, dto: ModifierActeDto, u: UtilisateurConnecte) {
    const acte = await this.acteModifiable(id, u);
    if (dto.structureId && dto.structureId !== acte.structureId) {
      const lignee = await this.circuits.ascendants(u.structureId);
      if (!lignee.some((s) => s.id === dto.structureId) || !(await this.circuits.circuit(acte.typeActeId, dto.structureId))) {
        throw new UnprocessableEntityException({ code: 'STRUCTURE_INVALIDE', message: 'Structure émettrice non autorisée' });
      }
    }
    const { version, ampliations, contenu, ...champs } = dto;
    return this.prisma.$transaction(async (tx) => {
      // Verrou optimiste : aucune ligne modifiée si quelqu'un (un autre onglet) a enregistré entre-temps.
      const { count } = await tx.acte.updateMany({
        where: { id, version },
        data: {
          ...champs,
          ...(contenu !== undefined ? { contenu: sanitizeHtml(contenu, HTML_AUTORISE) } : {}),
          version: { increment: 1 },
        },
      });
      if (count === 0) {
        throw new ConflictException({ code: 'CONFLIT_VERSION', message: 'Le projet a été modifié ailleurs entre-temps : rechargez-le' });
      }
      if (ampliations) {
        await tx.destinataire.deleteMany({ where: { acteId: id } });
        const uniques = [...new Set(ampliations.map((a) => a.trim()).filter(Boolean))];
        await tx.destinataire.createMany({ data: uniques.map((libelle) => ({ acteId: id, libelle })) });
      }
      const maj = await tx.acte.findUniqueOrThrow({ where: { id }, select: { version: true, misAJourLe: true } });
      return maj;
    });
  }

  // ─────────── Suppression (RG-16, C10) ───────────

  async supprimer(id: string, u: UtilisateurConnecte) {
    const acte = await this.acteModifiable(id, u);
    if (acte.statut !== StatutActe.BROUILLON || acte.versions.length > 0) {
      throw new ConflictException({ code: 'DEJA_SOUMIS', message: 'Un projet déjà soumis ne se supprime pas : demandez son rejet motivé (RG-16)' });
    }
    await this.prisma.$transaction([
      this.prisma.piece.deleteMany({ where: { acteId: id } }),
      this.prisma.destinataire.deleteMany({ where: { acteId: id } }),
      this.prisma.acte.delete({ where: { id } }),
    ]);
    await Promise.all(acte.pieces.map((p) => this.stockage.supprimer(p.cheminObjet).catch(() => undefined)));
    this.events.emit(EVENEMENTS.ACTE_SUPPRIME, { acteurId: u.sub, action: EVENEMENTS.ACTE_SUPPRIME, ressourceType: 'acte', ressourceId: id, details: { objet: acte.objet } });
  }

  // ─────────── Soumission (BF-22, RG-03, RG-07 ; C6, C7) ───────────

  async soumettre(id: string, version: number, u: UtilisateurConnecte) {
    const acte = await this.acteModifiable(id, u);
    if (!peutAppliquer('soumettre', acte.statut)) throw new ConflictException({ code: 'TRANSITION_INTERDITE', message: `Soumission impossible depuis ${acte.statut}` });
    const manquants = this.champsManquants(acte);
    if (manquants.length) {
      throw new UnprocessableEntityException({ code: 'CHAMPS_MANQUANTS', message: 'Champs obligatoires manquants', champs: manquants });
    }
    if (acte.pieces.some((p) => p.statutAnalyse === 'EN_ATTENTE')) {
      throw new ConflictException({ code: 'PIECES_EN_ANALYSE', message: 'Attendez la fin de l’analyse des pièces jointes' });
    }
    if (acte.pieces.some((p) => p.statutAnalyse !== 'SAINE')) {
      throw new ConflictException({ code: 'PIECES_REFUSEES', message: 'Retirez les pièces refusées avant de soumettre' });
    }
    const circuit = await this.circuits.circuit(acte.typeActeId, acte.structureId);
    if (!circuit?.etapes.length) {
      throw new UnprocessableEntityException({ code: 'CIRCUIT_ABSENT', message: "Aucun circuit n'est paramétré pour ce type et cette structure" });
    }
    const resoumission = acte.statut === StatutActe.A_CORRIGER;
    // Après correction, le circuit reprend à l'étape de retour choisie par le viseur (RG-06), sinon au début.
    const dernierRenvoi = resoumission
      ? await this.prisma.visa.findFirst({ where: { acteId: id, decision: 'CORRECTION' }, orderBy: { creeLe: 'desc' } })
      : null;
    const etapeDepart = circuit.etapes.find((e) => e.ordre === dernierRenvoi?.etapeRetour) ?? circuit.etapes[0];

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.acte.updateMany({
        where: { id, version },
        data: {
          statut: StatutActe.EN_CIRCUIT,
          etapeCouranteId: etapeDepart.id,
          etapeEntreeLe: new Date(),
          tourCircuit: resoumission ? { increment: 1 } : undefined,
          version: { increment: 1 },
        },
      });
      if (count === 0) throw new ConflictException({ code: 'CONFLIT_VERSION', message: 'Le projet a été modifié ailleurs entre-temps : rechargez-le' });
      // BF-20 : chaque soumission fige une version du texte.
      await tx.versionActe.create({
        data: { acteId: id, numero: acte.versions.length + 1, objet: acte.objet, contenu: acte.contenu, auteurId: u.sub },
      });
      // RG-07 : le changement de statut est journalisé dans la même transaction.
      await this.audit.journaliser(
        {
          acteurId: u.sub,
          action: EVENEMENTS.ACTE_SOUMIS,
          ressourceType: 'acte',
          ressourceId: id,
          details: { etape: etapeDepart.ordre, version: acte.versions.length + 1, resoumission },
        },
        tx,
      );
    });
    // Après commit : notification du premier viseur (M12).
    this.events.emit(EVENEMENTS.ACTE_SOUMIS, { acteId: id, etapeId: etapeDepart.id });
    return { statut: StatutActe.EN_CIRCUIT, etape: { ordre: etapeDepart.ordre, libelle: etapeDepart.libelle } };
  }

  // ─────────── Pièces jointes (BF-18, RG-24 ; C5) ───────────

  async ajouterPiece(id: string, fichier: { originalname: string; size: number; buffer: Buffer }, u: UtilisateurConnecte) {
    await this.acteModifiable(id, u);
    const pieceId = randomUUID();
    const nomFichier = fichier.originalname.replace(/[\\/\0]/g, '_').slice(0, 200);
    const piece = await this.prisma.piece.create({
      data: {
        id: pieceId,
        acteId: id,
        nomFichier,
        typeMime: 'application/octet-stream', // fixé par le filtre 1 d'après le contenu
        tailleOctets: fichier.size,
        cheminObjet: `pieces/${id}/${pieceId}`,
      },
    });
    // Réponse immédiate ; le pipeline tourne en tâche de fond (le client interroge l'état).
    setImmediate(() => void this.documents.traiterPiece(pieceId, fichier.buffer, nomFichier, u.sub));
    return { id: piece.id, nomFichier, tailleOctets: piece.tailleOctets, statutAnalyse: piece.statutAnalyse };
  }

  async lirePiece(id: string, pieceId: string, u: UtilisateurConnecte) {
    const acte = await this.charger(id);
    await this.verifierLecture(acte, u);
    const piece = acte.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new NotFoundException('Pièce introuvable');
    if (piece.statutAnalyse !== 'SAINE') {
      throw new ForbiddenException({ code: 'PIECE_INDISPONIBLE', message: "Pièce non disponible tant qu'elle n'a pas été analysée (RG-24)" });
    }
    return { piece, contenu: await this.stockage.lire(piece.cheminObjet) };
  }

  async supprimerPiece(id: string, pieceId: string, u: UtilisateurConnecte) {
    const acte = await this.acteModifiable(id, u);
    const piece = acte.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new NotFoundException('Pièce introuvable');
    await this.prisma.piece.delete({ where: { id: pieceId } });
    await this.stockage.supprimer(piece.cheminObjet).catch(() => undefined);
  }
}
