import { randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role } from '@prisma/client';
import { EVENEMENTS } from '@eact/shared';
import * as argon2 from 'argon2';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from '../m01-auth/auth.service';
import { CircuitService } from '../m05-circuit/circuit.service';

const CHAMPS_POSSIBLES = ['objet', 'contenu', 'ampliation'] as const;

export interface EtapeSaisie {
  libelle: string;
  roleRequis: Role;
  delaiHeures: number;
}

/** M15 Administration et paramétrage — BF-64, BF-65, ENF-08 ; M02 côté administrateur (BF-06 à BF-08). */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circuits: CircuitService,
    private readonly auth: AuthService,
    private readonly events: EventEmitter2,
  ) {}

  private journal(u: UtilisateurConnecte, action: string, ressourceType: string, ressourceId: string, details: Record<string, unknown> = {}) {
    this.events.emit(action, { acteurId: u.sub, action, ressourceType, ressourceId, details });
  }

  // ─────────── BF-64 / BF-65 : types et circuits ───────────

  async types() {
    const types = await this.prisma.typeActe.findMany({
      orderBy: { code: 'asc' },
      include: {
        circuits: { include: { structure: true, etapes: { orderBy: { ordre: 'asc' }, include: { _count: { select: { visas: true, actesEnCours: true } } } } } },
        _count: { select: { actes: true } },
      },
    });
    return Promise.all(
      types.map(async (t) => ({
        id: t.id,
        code: t.code,
        libelle: t.libelle,
        actif: t.actif,
        signeHorsMinistere: t.signeHorsMinistere,
        modePublicite: t.modePublicite,
        dureeConservationAnnees: t.dureeConservationAnnees,
        champsObligatoires: t.champsObligatoires as string[],
        nbActes: t._count.actes,
        circuits: await Promise.all(
          t.circuits.map(async (c) => ({
            id: c.id,
            actif: c.actif,
            structure: (await this.circuits.ascendants(c.structureId))[0],
            etapes: c.etapes.map((e) => ({
              id: e.id,
              ordre: e.ordre,
              libelle: e.libelle,
              roleRequis: e.roleRequis,
              delaiHeures: e.delaiHeures,
              utilisee: e._count.visas + e._count.actesEnCours > 0,
            })),
          })),
        ),
      })),
    );
  }

  async modifierType(u: UtilisateurConnecte, id: string, d: { libelle?: string; champsObligatoires?: string[]; dureeConservationAnnees?: number | null; actif?: boolean }) {
    if (d.champsObligatoires?.some((c) => !(CHAMPS_POSSIBLES as readonly string[]).includes(c))) {
      throw new UnprocessableEntityException({ code: 'CHAMP_INCONNU', message: `Champs possibles : ${CHAMPS_POSSIBLES.join(', ')}` });
    }
    await this.prisma.typeActe.update({ where: { id }, data: { ...d, champsObligatoires: d.champsObligatoires } });
    this.journal(u, 'parametrage.type_modifie', 'type_acte', id, d);
  }

  async creerCircuit(u: UtilisateurConnecte, d: { typeActeId: string; structureId: string; etapes: EtapeSaisie[] }) {
    if (!d.etapes.length) throw new UnprocessableEntityException({ code: 'ETAPES_REQUISES', message: 'Un circuit compte au moins une étape' });
    try {
      const c = await this.prisma.circuitValidation.create({
        data: { typeActeId: d.typeActeId, structureId: d.structureId, etapes: { create: d.etapes.map((e, i) => ({ ...e, ordre: i + 1 })) } },
      });
      this.journal(u, 'parametrage.circuit_cree', 'circuit', c.id, { etapes: d.etapes.length });
      return { id: c.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'DOUBLON', message: 'Ce type a déjà un circuit pour cette structure' });
      }
      throw e;
    }
  }

  async ajouterEtape(u: UtilisateurConnecte, circuitId: string, e: EtapeSaisie) {
    const derniere = await this.prisma.etapeCircuit.findFirst({ where: { circuitId }, orderBy: { ordre: 'desc' } });
    const etape = await this.prisma.etapeCircuit.create({ data: { ...e, circuitId, ordre: (derniere?.ordre ?? 0) + 1 } });
    this.journal(u, 'parametrage.etape_ajoutee', 'circuit', circuitId, { ...e });
    return { id: etape.id };
  }

  async modifierEtape(u: UtilisateurConnecte, id: string, e: Partial<EtapeSaisie>) {
    await this.prisma.etapeCircuit.update({ where: { id }, data: e });
    this.journal(u, 'parametrage.etape_modifiee', 'etape_circuit', id, e);
  }

  /** Une étape déjà franchie par un acte (visa) ou en cours ne se supprime pas : l'historique y renvoie. */
  async supprimerEtape(u: UtilisateurConnecte, id: string) {
    const e = await this.prisma.etapeCircuit.findUnique({ where: { id }, include: { _count: { select: { visas: true, actesEnCours: true } } } });
    if (!e) throw new NotFoundException({ code: 'INTROUVABLE', message: 'Étape introuvable' });
    if (e._count.visas + e._count.actesEnCours > 0) {
      throw new ConflictException({ code: 'ETAPE_UTILISEE', message: 'Étape déjà utilisée par des actes : modifiez-la plutôt' });
    }
    const restantes = await this.prisma.etapeCircuit.count({ where: { circuitId: e.circuitId } });
    if (restantes <= 1) throw new ConflictException({ code: 'ETAPES_REQUISES', message: 'Un circuit compte au moins une étape' });
    await this.prisma.$transaction(async (tx) => {
      await tx.etapeCircuit.delete({ where: { id } });
      // Renumérotation sans trou ; une à une pour respecter l'unicité (circuit, ordre).
      const suivantes = await tx.etapeCircuit.findMany({ where: { circuitId: e.circuitId, ordre: { gt: e.ordre } }, orderBy: { ordre: 'asc' } });
      for (const s of suivantes) await tx.etapeCircuit.update({ where: { id: s.id }, data: { ordre: s.ordre - 1 } });
    });
    this.journal(u, 'parametrage.etape_supprimee', 'circuit', e.circuitId, { libelle: e.libelle });
  }

  // ─────────── BF-06 : organigramme ───────────

  async structures() {
    const toutes = await this.prisma.structure.findMany({ include: { _count: { select: { agents: true } } }, orderBy: { code: 'asc' } });
    return Promise.all(
      toutes.map(async (s) => ({ id: s.id, code: s.code, libelle: s.libelle, parentId: s.parentId, agents: s._count.agents, chaine: (await this.circuits.ascendants(s.id))[0].chaine })),
    );
  }

  async creerStructure(u: UtilisateurConnecte, d: { code: string; libelle: string; parentId?: string }) {
    try {
      const s = await this.prisma.structure.create({ data: { code: d.code.toUpperCase(), libelle: d.libelle, parentId: d.parentId } });
      this.journal(u, 'parametrage.structure_creee', 'structure', s.id, { code: s.code });
      return { id: s.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'DOUBLON', message: 'Ce sigle existe déjà' });
      throw e;
    }
  }

  // ─────────── BF-07 / BF-08 : comptes et rôles ───────────

  async utilisateurs() {
    const liste = await this.prisma.utilisateur.findMany({ include: { roles: true, structure: true }, orderBy: [{ actif: 'desc' }, { nom: 'asc' }] });
    const maintenant = new Date();
    return liste.map((x) => ({
      id: x.id,
      matricule: x.matricule,
      email: x.email,
      prenom: x.prenom,
      nom: x.nom,
      structure: { id: x.structureId, code: x.structure.code, libelle: x.structure.libelle },
      roles: x.roles.map((r) => r.role),
      actif: x.actif,
      totpActive: x.totpActive,
      verrouille: !!x.verrouilleJusqua && x.verrouilleJusqua > maintenant,
    }));
  }

  /** BF-07 : le compte n'a pas de mot de passe connu ; l'agent le choisit par le lien reçu (BF-05). */
  async creerUtilisateur(u: UtilisateurConnecte, d: { matricule: string; email: string; prenom: string; nom: string; structureId: string; roles: Role[] }, ip: string) {
    if (!d.roles.length) throw new UnprocessableEntityException({ code: 'ROLES_REQUIS', message: 'Attribuez au moins un rôle (BF-08)' });
    try {
      const cree = await this.prisma.utilisateur.create({
        data: {
          matricule: d.matricule.trim().toUpperCase(),
          email: d.email.trim().toLowerCase(),
          prenom: d.prenom.trim(),
          nom: d.nom.trim().toUpperCase(),
          structureId: d.structureId,
          motDePasseHash: await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id }),
          roles: { create: d.roles.map((role) => ({ role })) },
        },
      });
      this.journal(u, EVENEMENTS.DROITS_MODIFIES, 'utilisateur', cree.id, { creation: true, roles: d.roles });
      await this.auth.demanderReinitialisation(cree.email, ip); // e-mail d'activation
      return { id: cree.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'DOUBLON', message: 'Matricule ou e-mail déjà utilisé' });
      throw e;
    }
  }

  async modifierUtilisateur(u: UtilisateurConnecte, id: string, d: { structureId?: string; roles?: Role[]; actif?: boolean }) {
    if (id === u.sub && (d.actif === false || (d.roles && !d.roles.includes(Role.ADMINISTRATEUR)))) {
      throw new ForbiddenException({ code: 'AUTO_RETRAIT', message: 'Un administrateur ne retire pas ses propres droits' });
    }
    if (d.roles && !d.roles.length) throw new UnprocessableEntityException({ code: 'ROLES_REQUIS', message: 'Au moins un rôle (BF-08)' });
    await this.prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({ where: { id }, data: { structureId: d.structureId, actif: d.actif } });
      if (d.roles) {
        await tx.utilisateurRole.deleteMany({ where: { utilisateurId: id, role: { notIn: d.roles } } });
        await tx.utilisateurRole.createMany({ data: d.roles.map((role) => ({ utilisateurId: id, role })), skipDuplicates: true });
      }
      // Désactivation : sessions révoquées ; le jeton d'accès déjà émis reste valable jusqu'à 15 min (BF-04).
      if (d.actif === false) await tx.sessionUtilisateur.updateMany({ where: { utilisateurId: id, revoqueLe: null }, data: { revoqueLe: new Date() } });
    });
    this.journal(u, EVENEMENTS.DROITS_MODIFIES, 'utilisateur', id, d);
  }

  async reinitialiserMfa(u: UtilisateurConnecte, id: string) {
    await this.prisma.utilisateur.update({ where: { id }, data: { totpActive: false, totpSecretChiffre: null, codesSecours: [] } });
    this.journal(u, EVENEMENTS.DROITS_MODIFIES, 'utilisateur', id, { mfaReinitialise: true });
  }

  async deverrouiller(u: UtilisateurConnecte, id: string) {
    await this.prisma.utilisateur.update({ where: { id }, data: { echecsConnexion: 0, echecsMfa: 0, verrouilleJusqua: null } });
    this.journal(u, EVENEMENTS.DROITS_MODIFIES, 'utilisateur', id, { deverrouille: true });
  }
}
