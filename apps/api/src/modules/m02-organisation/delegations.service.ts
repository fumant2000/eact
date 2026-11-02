import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role, TypeDelegation } from '@prisma/client';
import { EVENEMENTS } from '@eact/shared';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from '../m01-auth/auth.service';

export interface NouvelleDelegation {
  delegataireId: string;
  type: TypeDelegation;
  du: string; // AAAA-MM-JJ
  au: string; // AAAA-MM-JJ, inclus
  mention: string;
  perimetre: string[];
  code?: string; // TOTP, exigé pour une délégation de signature
}

/** Rôles qui peuvent déclarer un intérim (on ne délègue que ce qu'on détient). */
const ROLES_INTERIM: Role[] = [Role.AUTORITE_SIGNATAIRE, Role.SECRETAIRE_GENERAL, Role.VISEUR, Role.JURISTE, Role.TRADUCTEUR];
const VERIFICATION_EXPIRATIONS_MS = 10 * 60_000;
const nom = (u: { prenom: string; nom: string }) => `${u.prenom} ${u.nom}`;

/** Bornes d'une journée à Yaoundé (UTC+1, sans heure d'été). */
const debutJour = (j: string) => new Date(`${j}T00:00:00+01:00`);
const finJour = (j: string) => new Date(`${j}T23:59:59.999+01:00`);

/** M02 IDelegations — BF-09, BF-10, RG-11, RG-17. */
@Injectable()
export class DelegationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DelegationsService.name);
  private minuteur?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    void this.desactiverExpirees();
    this.minuteur = setInterval(() => void this.desactiverExpirees(), VERIFICATION_EXPIRATIONS_MS);
  }

  onModuleDestroy() {
    clearInterval(this.minuteur);
  }

  /** BF-10 / RG-17 : matérialise l'expiration (actif = false) ; la validité se juge toujours sur les dates. */
  async desactiverExpirees() {
    try {
      const expirees = await this.prisma.delegation.findMany({ where: { actif: true, fin: { lt: new Date() } } });
      for (const d of expirees) {
        await this.prisma.delegation.update({ where: { id: d.id }, data: { actif: false } });
        this.events.emit(EVENEMENTS.DELEGATION_EXPIREE, {
          action: EVENEMENTS.DELEGATION_EXPIREE,
          ressourceType: 'delegation',
          ressourceId: d.id,
          details: { fin: d.fin.toISOString() },
        });
      }
      if (expirees.length) this.logger.log(`${expirees.length} délégation(s) expirée(s) désactivée(s)`);
    } catch (e) {
      this.logger.warn(`Vérification des délégations impossible : ${(e as Error).message}`);
    }
  }

  private etat(d: { actif: boolean; debut: Date; fin: Date }) {
    const maintenant = new Date();
    if (d.fin < maintenant) return 'EXPIREE' as const;
    if (!d.actif) return 'REVOQUEE' as const;
    return d.debut > maintenant ? ('A_VENIR' as const) : ('ACTIVE' as const);
  }

  /** Délégations accordées et reçues. */
  async lister(u: UtilisateurConnecte) {
    const delegations = await this.prisma.delegation.findMany({
      where: { OR: [{ delegantId: u.sub }, { delegataireId: u.sub }] },
      include: {
        delegant: { include: { structure: true, roles: true } },
        delegataire: { include: { structure: true, roles: true } },
        _count: { select: { actesSignes: true } },
      },
      orderBy: { debut: 'desc' },
    });
    const ordre = { ACTIVE: 0, A_VENIR: 1, EXPIREE: 2, REVOQUEE: 3 };
    return delegations
      .map((d) => ({
        id: d.id,
        type: d.type,
        sens: d.delegantId === u.sub ? ('ACCORDEE' as const) : ('RECUE' as const),
        delegant: { nom: nom(d.delegant), structure: d.delegant.structure.libelle },
        delegataire: { nom: nom(d.delegataire), structure: d.delegataire.structure.libelle, roles: d.delegataire.roles.map((r) => r.role) },
        debut: d.debut,
        fin: d.fin,
        mention: d.mention,
        perimetre: d.perimetre,
        etat: this.etat(d),
        actesSignes: d._count.actesSignes,
      }))
      .sort((a, b) => ordre[a.etat] - ordre[b.etat]);
  }

  /** Personnes à qui déléguer et types d'actes délégables. */
  async candidats(u: UtilisateurConnecte) {
    const [personnes, types] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where: { actif: true, id: { not: u.sub } },
        include: { structure: true, roles: true },
        orderBy: { nom: 'asc' },
      }),
      this.prisma.typeActe.findMany({ where: { actif: true, signeHorsMinistere: false }, orderBy: { code: 'asc' } }),
    ]);
    return {
      peutDeleguerSignature: u.roles.includes(Role.AUTORITE_SIGNATAIRE),
      personnes: personnes.map((p) => ({ id: p.id, nom: nom(p), structure: p.structure.libelle, roles: p.roles.map((r) => r.role) })),
      types: types.map((t) => ({ code: t.code, libelle: t.libelle })),
    };
  }

  async declarer(u: UtilisateurConnecte, dto: NouvelleDelegation, ip: string) {
    if (dto.type === TypeDelegation.SIGNATURE && !u.roles.includes(Role.AUTORITE_SIGNATAIRE)) {
      throw new ForbiddenException({ code: 'ACCES_REFUSE', message: 'Seule l’autorité signataire délègue sa signature (RG-11)' });
    }
    if (dto.type === TypeDelegation.INTERIM && !u.roles.some((r) => ROLES_INTERIM.includes(r))) {
      throw new ForbiddenException({ code: 'ACCES_REFUSE', message: 'Vous n’avez pas d’attributions à confier par intérim' });
    }
    if (dto.delegataireId === u.sub) throw new UnprocessableEntityException({ code: 'DELEGATAIRE_INVALIDE', message: 'On ne se délègue pas à soi-même' });
    const delegataire = await this.prisma.utilisateur.findUnique({ where: { id: dto.delegataireId } });
    if (!delegataire?.actif) throw new NotFoundException({ code: 'INTROUVABLE', message: 'Délégataire introuvable ou désactivé' });

    const debut = debutJour(dto.du);
    const fin = finJour(dto.au);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) throw new BadRequestException({ code: 'DATES_INVALIDES', message: 'Dates invalides' });
    if (fin < debut) throw new UnprocessableEntityException({ code: 'DATES_INVALIDES', message: 'La date de fin précède la date de début' });
    if (fin < new Date()) throw new UnprocessableEntityException({ code: 'DATES_INVALIDES', message: 'La période est déjà passée' });

    const codes = new Set((await this.prisma.typeActe.findMany({ where: { signeHorsMinistere: false } })).map((t) => t.code));
    const perimetre = [...new Set(dto.perimetre)];
    if (perimetre.some((c) => !codes.has(c))) throw new UnprocessableEntityException({ code: 'PERIMETRE_INVALIDE', message: 'Type d’acte inconnu ou non délégable (projet de décret)' });
    if (dto.type === TypeDelegation.SIGNATURE && perimetre.length === 0) {
      throw new UnprocessableEntityException({ code: 'PERIMETRE_INVALIDE', message: 'Cochez au moins un type d’acte couvert' });
    }

    // Action sensible : TOTP exigé si le compte l'a activé, et toujours pour une délégation de signature.
    const moi = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: u.sub } });
    if (moi.totpActive || dto.type === TypeDelegation.SIGNATURE) await this.auth.verifierTotpAction(u.sub, dto.code ?? '', ip);

    const d = await this.prisma.delegation.create({
      data: { type: dto.type, delegantId: u.sub, delegataireId: dto.delegataireId, debut, fin, mention: dto.mention.trim(), perimetre },
    });
    this.events.emit(EVENEMENTS.DELEGATION_CREEE, {
      acteurId: u.sub,
      action: EVENEMENTS.DELEGATION_CREEE,
      ressourceType: 'delegation',
      ressourceId: d.id,
      details: { type: d.type, delegataire: dto.delegataireId, du: dto.du, au: dto.au, perimetre },
    });
    return { id: d.id };
  }

  async revoquer(u: UtilisateurConnecte, id: string) {
    const d = await this.prisma.delegation.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ code: 'INTROUVABLE', message: 'Délégation introuvable' });
    if (d.delegantId !== u.sub) throw new ForbiddenException({ code: 'ACCES_REFUSE', message: 'Seul l’auteur d’une délégation la révoque' });
    await this.prisma.delegation.update({ where: { id }, data: { actif: false } });
    // Les actes déjà signés avec cette délégation restent valides.
    this.events.emit(EVENEMENTS.DELEGATION_REVOQUEE, { acteurId: u.sub, action: EVENEMENTS.DELEGATION_REVOQUEE, ressourceType: 'delegation', ressourceId: id });
  }
}
