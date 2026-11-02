import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DecisionVisa, Role, StatutActe, TypeDelegation, type EtapeCircuit, type Prisma } from '@prisma/client';
import { EVENEMENTS, peutAppliquer } from '@eact/shared';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../m10-audit/audit.service';

export interface StructureChaine {
  id: string;
  code: string;
  libelle: string;
  /** Codes de la racine vers la structure : ['SG', 'DAG'] → référence « …/MINESUP/SG/DAG ». */
  chaine: string[];
}

export interface Viseur {
  id: string;
  nom: string;
  structure: string;
  /** Renseigné si la personne vise comme intérimaire (RG-04). */
  interimDe?: { nom: string; mention: string };
}

export interface DecisionDto {
  decision: DecisionVisa;
  version: number;
  observation?: string;
  /** CORRECTION : 0 = retour à la rédaction, sinon ordre d'une étape déjà franchie (RG-06, maquette D4). */
  etapeRetour?: number;
}

type ActeCircuit = Prisma.ActeGetPayload<{ include: { etapeCourante: true; redacteur: true; typeActe: true; pieces: true } }>;

const nomComplet = (u: { prenom: string; nom: string }) => `${u.prenom} ${u.nom}`;

/**
 * IParapheur — M05 (BF-22 à BF-28 ; RG-04 à RG-07, RG-18, RG-19 ; UC-08).
 * Qui vise : les étapes « VISEUR » suivent la hiérarchie du rédacteur (1re étape → sa structure,
 * 2e → la structure parente…, jusqu'à la structure émettrice) ; les autres rôles (juriste, traducteur, SG)
 * reviennent à leurs titulaires. Un intérimaire déclaré (délégation INTERIM) vise à la place du titulaire.
 */
@Injectable()
export class CircuitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ─────────── Organigramme et circuits ───────────

  /** La structure puis ses ascendants, de la plus proche à la racine. */
  async ascendants(structureId: string): Promise<StructureChaine[]> {
    const toutes = await this.prisma.structure.findMany({ select: { id: true, code: true, libelle: true, parentId: true } });
    const parId = new Map(toutes.map((s) => [s.id, s]));
    const lignee: (typeof toutes)[number][] = [];
    for (let s = parId.get(structureId); s; s = s.parentId ? parId.get(s.parentId) : undefined) lignee.push(s);
    return lignee.map((s, i) => ({ id: s.id, code: s.code, libelle: s.libelle, chaine: lignee.slice(i).map((x) => x.code).reverse() }));
  }

  /** Circuit actif du type pour la structure émettrice exactement. */
  circuit(typeActeId: string, structureId: string) {
    return this.prisma.circuitValidation.findFirst({
      where: { typeActeId, structureId, actif: true },
      include: { etapes: { orderBy: { ordre: 'asc' } } },
    });
  }

  /** Première structure (la sienne, puis ses ascendants) disposant d'un circuit pour ce type. */
  async structureEmettriceParDefaut(typeActeId: string, structureAgentId: string) {
    for (const s of await this.ascendants(structureAgentId)) {
      if (await this.circuit(typeActeId, s.id)) return s;
    }
    return null;
  }

  private delegationSignature(codeType: string) {
    const maintenant = new Date();
    return this.prisma.delegation.findFirst({
      where: { type: TypeDelegation.SIGNATURE, actif: true, debut: { lte: maintenant }, fin: { gte: maintenant }, perimetre: { has: codeType } },
      include: { delegataire: { include: { roles: true } } },
    });
  }

  /** Libellé du signataire prévu (BF-09) ; la vérification réelle (RG-11) se fait à la signature. */
  async signatairePrevu(codeType: string): Promise<string> {
    const d = await this.delegationSignature(codeType);
    if (!d) return 'Le Ministre';
    return d.delegataire.roles.some((r) => r.role === Role.SECRETAIRE_GENERAL) ? 'Le Secrétaire Général' : nomComplet(d.delegataire);
  }

  /** Destinataires de la notification « prêt à signer ». */
  async signatairesPossibles(codeType: string) {
    const d = await this.delegationSignature(codeType);
    if (d) return [d.delegataire];
    return this.prisma.utilisateur.findMany({ where: { actif: true, roles: { some: { role: Role.AUTORITE_SIGNATAIRE } } } });
  }

  // ─────────── RG-04 : qui peut viser une étape ───────────

  async viseursEligibles(acte: Pick<ActeCircuit, 'redacteurId' | 'redacteur' | 'structureId'>, etape: EtapeCircuit): Promise<Viseur[]> {
    let titulaires;
    if (etape.roleRequis === Role.VISEUR) {
      // Hiérarchie du rédacteur, coupée à la structure émettrice.
      const lignee = await this.ascendants(acte.redacteur.structureId);
      const fin = lignee.findIndex((s) => s.id === acte.structureId);
      const hierarchie = fin >= 0 ? lignee.slice(0, fin + 1) : [lignee[0]];
      const etapesViseur = await this.prisma.etapeCircuit.findMany({
        where: { circuitId: etape.circuitId, roleRequis: Role.VISEUR },
        orderBy: { ordre: 'asc' },
      });
      const rang = etapesViseur.findIndex((e) => e.id === etape.id);
      const structure = hierarchie[Math.min(Math.max(rang, 0), hierarchie.length - 1)];
      titulaires = await this.prisma.utilisateur.findMany({
        where: { actif: true, structureId: structure.id, roles: { some: { role: Role.VISEUR } } },
        include: { structure: true },
      });
    } else {
      titulaires = await this.prisma.utilisateur.findMany({
        where: { actif: true, roles: { some: { role: etape.roleRequis } } },
        include: { structure: true },
      });
    }
    titulaires = titulaires.filter((u) => u.id !== acte.redacteurId); // RG-19

    const maintenant = new Date();
    const interims = await this.prisma.delegation.findMany({
      where: { type: TypeDelegation.INTERIM, actif: true, debut: { lte: maintenant }, fin: { gte: maintenant }, delegantId: { in: titulaires.map((u) => u.id) } },
      include: { delegant: true, delegataire: { include: { structure: true } } },
    });
    return [
      ...titulaires.map((u) => ({ id: u.id, nom: nomComplet(u), structure: u.structure.libelle })),
      ...interims
        .filter((d) => d.delegataireId !== acte.redacteurId)
        .map((d) => ({
          id: d.delegataire.id,
          nom: nomComplet(d.delegataire),
          structure: d.delegataire.structure.libelle,
          interimDe: { nom: nomComplet(d.delegant), mention: d.mention },
        })),
    ];
  }

  private chargerActe(id: string) {
    return this.prisma.acte.findUnique({ where: { id }, include: { etapeCourante: true, redacteur: true, typeActe: true, pieces: true } });
  }

  /** D8 : pourquoi le visa n'est pas proposé (null = l'agent peut viser). */
  async raisonNonVisa(acte: ActeCircuit, u: UtilisateurConnecte): Promise<string | null> {
    if (acte.statut !== StatutActe.EN_CIRCUIT || !acte.etapeCourante) return 'HORS_CIRCUIT';
    if (acte.redacteurId === u.sub) return 'REDACTEUR'; // RG-19
    const dejaVise = await this.prisma.visa.findFirst({
      where: { acteId: acte.id, etapeId: acte.etapeCourante.id, viseurId: u.sub, tourCircuit: acte.tourCircuit },
    });
    if (dejaVise) return 'DEJA_VISE'; // RG-18
    if (!(await this.viseursEligibles(acte, acte.etapeCourante)).some((v) => v.id === u.sub)) return 'PAS_VOTRE_ETAPE'; // RG-04
    if (acte.pieces.some((p) => p.statutAnalyse === 'EN_ATTENTE')) return 'PIECES_EN_ANALYSE'; // RG-24
    return null;
  }

  /** RG-15 : membres du circuit = ceux qui ont visé et les viseurs prévus de chaque étape (fiche D2 consultable en amont). */
  async estMembreDuCircuit(acteId: string, u: UtilisateurConnecte) {
    const acte = await this.chargerActe(acteId);
    if (!acte || acte.statut === StatutActe.BROUILLON) return false;
    if (await this.prisma.visa.count({ where: { acteId, viseurId: u.sub } })) return true;
    const circuit = await this.circuit(acte.typeActeId, acte.structureId);
    for (const etape of circuit?.etapes ?? []) {
      if ((await this.viseursEligibles(acte, etape)).some((v) => v.id === u.sub)) return true;
    }
    return false;
  }

  // ─────────── BF-23 : parapheur ───────────

  echeance(acte: { etapeEntreeLe: Date | null }, etape: { delaiHeures: number }) {
    return acte.etapeEntreeLe ? new Date(acte.etapeEntreeLe.getTime() + etape.delaiHeures * 3600_000) : null;
  }

  async parapheur(u: UtilisateurConnecte) {
    const enCircuit = await this.prisma.acte.findMany({
      where: { statut: StatutActe.EN_CIRCUIT, redacteurId: { not: u.sub } },
      include: {
        etapeCourante: { include: { circuit: { include: { _count: { select: { etapes: true } } } } } },
        redacteur: { include: { structure: true } },
        typeActe: true,
        pieces: true,
      },
    });
    const aViser = [];
    for (const a of enCircuit) {
      if (!a.etapeCourante) continue;
      const eligibles = await this.viseursEligibles(a, a.etapeCourante);
      const moi = eligibles.find((v) => v.id === u.sub);
      if (!moi || (await this.raisonNonVisa(a, u)) === 'DEJA_VISE') continue;
      aViser.push({
        id: a.id,
        version: a.version,
        codeType: a.typeActe.code,
        objet: a.objet,
        confidentialite: a.confidentialite,
        redacteur: nomComplet(a.redacteur),
        structureRedacteur: a.redacteur.structure.libelle,
        etape: { ordre: a.etapeCourante.ordre, total: a.etapeCourante.circuit._count.etapes + 1, libelle: a.etapeCourante.libelle, delaiHeures: a.etapeCourante.delaiHeures },
        etapeSuivante: (await this.etapeSuivante(a.etapeCourante))?.libelle ?? null,
        recuLe: a.etapeEntreeLe,
        echeance: this.echeance(a, a.etapeCourante),
        piecesEnAnalyse: a.pieces.some((p) => p.statutAnalyse === 'EN_ATTENTE'),
        interimDe: moi.interimDe ?? null,
      });
    }
    aViser.sort((a, b) => (a.echeance?.getTime() ?? 0) - (b.echeance?.getTime() ?? 0));

    const recents = await this.prisma.visa.findMany({
      where: { viseurId: u.sub },
      orderBy: { creeLe: 'desc' },
      take: 20,
      include: { acte: { include: { typeActe: true } }, etape: true },
    });
    return {
      aViser,
      recents: recents.map((v) => ({
        id: v.acte.id,
        codeType: v.acte.typeActe.code,
        objet: v.acte.objet,
        statut: v.acte.statut,
        etape: v.etape.libelle,
        decision: v.decision,
        le: v.creeLe,
      })),
    };
  }

  private etapeSuivante(etape: EtapeCircuit) {
    return this.prisma.etapeCircuit.findFirst({ where: { circuitId: etape.circuitId, ordre: { gt: etape.ordre } }, orderBy: { ordre: 'asc' } });
  }

  // ─────────── BF-24 à BF-26 : viser, corriger, rejeter ───────────

  async decider(acteId: string, dto: DecisionDto, u: UtilisateurConnecte) {
    const acte = await this.chargerActe(acteId);
    if (!acte) throw new NotFoundException('Acte introuvable');
    const raison = await this.raisonNonVisa(acte, u);
    if (raison === 'PIECES_EN_ANALYSE') throw new ConflictException({ code: raison, message: "Une pièce est en cours d'analyse antivirus (RG-24)" });
    if (raison === 'DEJA_VISE') throw new ConflictException({ code: raison, message: 'Vous avez déjà visé cette étape (RG-18)' });
    if (raison === 'HORS_CIRCUIT') throw new ConflictException({ code: 'CONFLIT_VERSION', message: "L'acte a changé d'état entre-temps : rechargez-le" });
    if (raison) throw new ForbiddenException({ code: raison, message: "Ce visa ne vous revient pas (RG-04, RG-19)" });

    const etape = acte.etapeCourante!;
    const observation = dto.observation?.trim() || undefined;
    if (dto.decision !== DecisionVisa.FAVORABLE && !observation) {
      throw new UnprocessableEntityException({ code: 'MOTIF_OBLIGATOIRE', message: 'Le motif est obligatoire (RG-05, RG-06)' });
    }

    let donnees: Prisma.ActeUpdateManyMutationInput & { etapeCouranteId?: string | null };
    let evenement: string;
    let etapeRetour: number | undefined;
    if (dto.decision === DecisionVisa.FAVORABLE) {
      const suivante = await this.etapeSuivante(etape);
      if (suivante) {
        donnees = { etapeCouranteId: suivante.id, etapeEntreeLe: new Date() };
      } else {
        if (!peutAppliquer('viserDerniereEtape', acte.statut)) throw new ConflictException({ code: 'TRANSITION_INTERDITE', message: 'Transition interdite' });
        donnees = { statut: StatutActe.PRET_A_SIGNER, etapeCouranteId: null, etapeEntreeLe: new Date() };
      }
      evenement = EVENEMENTS.ACTE_VISE;
    } else if (dto.decision === DecisionVisa.CORRECTION) {
      etapeRetour = dto.etapeRetour ?? 0;
      if (etapeRetour === 0) {
        donnees = { statut: StatutActe.A_CORRIGER, etapeCouranteId: null, etapeEntreeLe: null };
      } else {
        const retour = await this.prisma.etapeCircuit.findFirst({ where: { circuitId: etape.circuitId, ordre: etapeRetour } });
        if (!retour || retour.ordre >= etape.ordre) {
          throw new UnprocessableEntityException({ code: 'ETAPE_RETOUR_INVALIDE', message: 'Choisissez la rédaction ou une étape déjà franchie' });
        }
        // Le circuit repart de cette étape : nouveau tour, le viseur concerné pourra viser à nouveau (RG-18).
        donnees = { etapeCouranteId: retour.id, etapeEntreeLe: new Date(), tourCircuit: { increment: 1 } };
      }
      evenement = EVENEMENTS.ACTE_A_CORRIGER;
    } else {
      if (!peutAppliquer('rejeter', acte.statut)) throw new ConflictException({ code: 'TRANSITION_INTERDITE', message: 'Transition interdite' });
      donnees = { statut: StatutActe.REJETE, etapeCouranteId: null, etapeEntreeLe: null };
      evenement = EVENEMENTS.ACTE_REJETE;
    }

    await this.prisma.$transaction(async (tx) => {
      // Verrou optimiste (§14.2, figure 8) : 0 ligne modifiée → 409.
      const { count } = await tx.acte.updateMany({ where: { id: acteId, version: dto.version }, data: { ...donnees, version: { increment: 1 } } });
      if (count === 0) throw new ConflictException({ code: 'CONFLIT_VERSION', message: "L'acte a été modifié entre-temps : rechargez-le" });
      await tx.visa.create({
        data: { acteId, etapeId: etape.id, viseurId: u.sub, tourCircuit: acte.tourCircuit, decision: dto.decision, observation, etapeRetour },
      });
      await this.audit.journaliser(
        { acteurId: u.sub, action: evenement, ressourceType: 'acte', ressourceId: acteId, details: { etape: etape.ordre, decision: dto.decision, etapeRetour } },
        tx,
      );
    });
    // Après commit : notifications (M12), sans champ `action` pour ne pas journaliser deux fois.
    this.events.emit(evenement, { acteId, decision: dto.decision });
    const apres = await this.prisma.acte.findUniqueOrThrow({ where: { id: acteId }, include: { etapeCourante: true } });
    return { statut: apres.statut, version: apres.version, etape: apres.etapeCourante && { ordre: apres.etapeCourante.ordre, libelle: apres.etapeCourante.libelle } };
  }

  // ─────────── BF-28 : position et historique ───────────

  async suivi(acteId: string, u: UtilisateurConnecte) {
    const acte = await this.prisma.acte.findUniqueOrThrow({
      where: { id: acteId },
      include: {
        etapeCourante: true,
        redacteur: { include: { structure: true } },
        typeActe: true,
        pieces: true,
        visas: { include: { viseur: { include: { structure: true } }, etape: true }, orderBy: { creeLe: 'asc' } },
        versions: { orderBy: { numero: 'asc' } },
      },
    });
    const circuit = await this.circuit(acte.typeActeId, acte.structureId);
    const etapes = await Promise.all(
      (circuit?.etapes ?? []).map(async (e) => ({
        ordre: e.ordre,
        libelle: e.libelle,
        delaiHeures: e.delaiHeures,
        viseurs: (await this.viseursEligibles(acte, e)).map((v) => v.nom),
      })),
    );
    const historique = [
      ...acte.versions.map((v) => ({ type: 'SOUMISSION' as const, le: v.creeLe, acteur: nomComplet(acte.redacteur), structure: acte.redacteur.structure.libelle, version: v.numero })),
      ...acte.visas.map((v) => ({
        type: 'VISA' as const,
        le: v.creeLe,
        acteur: nomComplet(v.viseur),
        structure: v.viseur.structure.libelle,
        etape: { ordre: v.etape.ordre, libelle: v.etape.libelle },
        decision: v.decision,
        observation: v.observation,
        etapeRetour: v.etapeRetour,
      })),
    ].sort((a, b) => a.le.getTime() - b.le.getTime());
    const dernierRenvoi = [...acte.visas].reverse().find((v) => v.decision === DecisionVisa.CORRECTION);
    const raison = await this.raisonNonVisa(acte, u);
    const moi = acte.etapeCourante && !raison ? (await this.viseursEligibles(acte, acte.etapeCourante)).find((v) => v.id === u.sub) : undefined;
    return {
      redacteur: { nom: nomComplet(acte.redacteur), structure: acte.redacteur.structure.libelle },
      creeLe: acte.creeLe,
      numeroVersion: acte.versions.length,
      etapes,
      historique,
      echeance: acte.etapeCourante ? this.echeance(acte, acte.etapeCourante) : null,
      etapeSuivante: acte.etapeCourante ? ((await this.etapeSuivante(acte.etapeCourante))?.libelle ?? null) : null,
      peutViser: raison === null,
      raisonNonVisa: raison,
      interimDe: moi?.interimDe ?? null,
      dejaViseLe: raison === 'DEJA_VISE' ? acte.visas.filter((v) => v.viseurId === u.sub).at(-1)?.creeLe ?? null : null,
      dernierRenvoi: dernierRenvoi && {
        viseur: nomComplet(dernierRenvoi.viseur),
        observation: dernierRenvoi.observation,
        le: dernierRenvoi.creeLe,
        etapeRetour: dernierRenvoi.etapeRetour,
      },
    };
  }
}
