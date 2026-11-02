import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Role, type Utilisateur } from '@prisma/client';
import { EVENEMENTS } from '@eact/shared';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import type { UtilisateurConnecte } from '../../common/security/securite';
import { ChiffrementService } from '../../infrastructure/crypto/chiffrement.service';
import { MessagerieService } from '../../infrastructure/messagerie/messagerie.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { EntreeAudit } from '../m10-audit/audit.service';

/** BF-02 : second facteur obligatoire pour ces rôles. */
export const ROLES_MFA_OBLIGATOIRE: Role[] = [Role.AUTORITE_SIGNATAIRE, Role.SECRETAIRE_GENERAL, Role.ADMINISTRATEUR];

const ECHECS_MAX_MOT_DE_PASSE = 5; // BF-03
const ECHECS_MAX_TOTP = 3; // maquette B2
const ECHECS_MAX_TOTP_SIGNATURE = 5; // maquette E3
const DUREE_VERROU_MS = 15 * 60_000; // BF-03
const INACTIVITE_MAX_MS = 30 * 60_000; // BF-04
const VALIDITE_LIEN_MS = 30 * 60_000; // BF-05
const NB_CODES_SECOURS = 8;

authenticator.options = { window: 1 }; // tolère ±30 s de décalage d'horloge du téléphone

export interface JetonsSession {
  acces: string;
  rafraichissement: string;
}

export type ResultatConnexion =
  | { etape: 'CONNECTE'; jetons: JetonsSession; codesSecours?: string[] }
  | { etape: 'MFA' | 'ENROLEMENT'; jetonMfa: string };

const empreinte = (s: string) => createHash('sha256').update(s).digest('hex');
const exigeMfa = (u: { totpActive: boolean; roles: { role: Role }[] }) =>
  u.totpActive || u.roles.some((r) => ROLES_MFA_OBLIGATOIRE.includes(r.role));

function codeDeSecours(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
  const car = [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join('');
  return `${car.slice(0, 4)}-${car.slice(4)}`;
}

/** c.ebogo@minesup.test → c.e•••@minesup.test (maquette B5). */
function masquerEmail(email: string): string {
  const [local, domaine] = email.split('@');
  return `${local.slice(0, 3)}•••@${domaine}`;
}

/**
 * IAuthentification — M01 (BF-01 à BF-05, RG-12).
 * Mots de passe Argon2id ; jeton d'accès JWT de 15 min ; jeton de rafraîchissement opaque, haché en base,
 * renouvelé à chaque usage et refusé après 30 min d'inactivité.
 */
@Injectable()
export class AuthService {
  private hashFactice?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventEmitter2,
    private readonly chiffrement: ChiffrementService,
    private readonly messagerie: MessagerieService,
  ) {}

  private auditer(e: EntreeAudit) {
    this.events.emit(e.action, e);
  }

  private trouver(identifiant: string) {
    const id = identifiant.trim();
    return this.prisma.utilisateur.findFirst({
      where: { OR: [{ matricule: { equals: id, mode: 'insensitive' } }, { email: { equals: id, mode: 'insensitive' } }] },
      include: { roles: true },
    });
  }

  private verifierVerrou(u: Pick<Utilisateur, 'verrouilleJusqua'>) {
    if (u.verrouilleJusqua && u.verrouilleJusqua > new Date()) {
      throw new ForbiddenException({
        code: 'COMPTE_VERROUILLE',
        message: 'Compte temporairement verrouillé',
        deverrouillageLe: u.verrouilleJusqua.toISOString(),
      });
    }
  }

  /** Incrémente les échecs et verrouille au-delà du seuil ; renvoie les essais restants. */
  private async enregistrerEchec(u: Utilisateur, seuil: number, ip: string): Promise<number> {
    const echecs = u.echecsConnexion + 1;
    const verrou = echecs >= seuil ? new Date(Date.now() + DUREE_VERROU_MS) : null;
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { echecsConnexion: verrou ? 0 : echecs, verrouilleJusqua: verrou },
    });
    if (verrou) {
      this.auditer({ acteurId: u.id, action: EVENEMENTS.COMPTE_VERROUILLE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip } });
      this.verifierVerrou({ verrouilleJusqua: verrou });
    }
    return seuil - echecs;
  }

  // ─────────── BF-01 / BF-03 : connexion ───────────

  async connecter(identifiant: string, motDePasse: string, ip: string): Promise<ResultatConnexion> {
    const u = await this.trouver(identifiant);
    if (!u) {
      // Même durée de calcul qu'un compte existant : ne révèle pas l'existence du matricule.
      this.hashFactice ??= argon2.hash(randomBytes(16).toString('hex'));
      await argon2.verify(await this.hashFactice, motDePasse);
      this.auditer({ action: EVENEMENTS.CONNEXION_ECHOUEE, ressourceType: 'utilisateur', details: { ip, raison: 'inconnu' } });
      throw new UnauthorizedException({ code: 'IDENTIFIANTS_INCORRECTS', message: 'Identifiants incorrects' });
    }
    this.verifierVerrou(u);

    if (!(await argon2.verify(u.motDePasseHash, motDePasse))) {
      this.auditer({ acteurId: u.id, action: EVENEMENTS.CONNEXION_ECHOUEE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip } });
      const essaisRestants = await this.enregistrerEchec(u, ECHECS_MAX_MOT_DE_PASSE, ip);
      throw new UnauthorizedException({ code: 'IDENTIFIANTS_INCORRECTS', message: 'Identifiants incorrects', essaisRestants });
    }
    if (!u.actif) throw new ForbiddenException({ code: 'COMPTE_DESACTIVE', message: 'Compte désactivé' });

    await this.prisma.utilisateur.update({ where: { id: u.id }, data: { echecsConnexion: 0, verrouilleJusqua: null } });

    if (exigeMfa(u)) {
      const jetonMfa = this.jwt.sign({ sub: u.id, typ: 'mfa' }, { expiresIn: '5m' });
      return { etape: u.totpActive ? 'MFA' : 'ENROLEMENT', jetonMfa };
    }
    return { etape: 'CONNECTE', jetons: await this.ouvrirSession(u.id, ip, false) };
  }

  private async utilisateurEnAttenteMfa(jetonMfa: string | undefined) {
    try {
      const { sub, typ } = this.jwt.verify<{ sub: string; typ: string }>(jetonMfa ?? '');
      if (typ !== 'mfa') throw new Error();
      const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: sub } });
      this.verifierVerrou(u);
      return u;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException({ code: 'MFA_EXPIRE', message: 'Vérification expirée : reconnectez-vous' });
    }
  }

  // ─────────── BF-02 : second facteur ───────────

  async verifierMfa(jetonMfa: string | undefined, code: string, ip: string): Promise<ResultatConnexion> {
    const u = await this.utilisateurEnAttenteMfa(jetonMfa);
    if (!u.totpActive || !u.totpSecretChiffre) throw new ConflictException({ code: 'MFA_NON_ACTIVE', message: 'Second facteur non activé' });

    const saisi = code.trim().toUpperCase().replace(/\s+/g, '');
    let valide = /^\d{6}$/.test(saisi) && authenticator.check(saisi, this.chiffrement.dechiffrer(u.totpSecretChiffre));
    let codeSecoursUtilise = false;
    if (!valide && u.codesSecours.includes(empreinte(saisi))) {
      // Code de secours : usage unique
      await this.prisma.utilisateur.update({
        where: { id: u.id },
        data: { codesSecours: u.codesSecours.filter((c) => c !== empreinte(saisi)) },
      });
      valide = codeSecoursUtilise = true;
    }
    if (!valide) {
      this.auditer({ acteurId: u.id, action: EVENEMENTS.MFA_ECHOUE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip } });
      const essaisRestants = await this.enregistrerEchec(u, ECHECS_MAX_TOTP, ip);
      throw new UnauthorizedException({ code: 'CODE_INVALIDE', message: 'Code invalide ou expiré', essaisRestants });
    }
    await this.prisma.utilisateur.update({ where: { id: u.id }, data: { echecsConnexion: 0 } });
    return { etape: 'CONNECTE', jetons: await this.ouvrirSession(u.id, ip, true, { codeSecoursUtilise }) };
  }

  /**
   * RG-12 : code TOTP redemandé pour une action sensible (signature), sans ouvrir de session.
   * 5 essais (maquette E3) puis verrouillage du compte, comme à la connexion (BF-03).
   */
  async verifierTotpAction(utilisateurId: string, code: string, ip: string): Promise<void> {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    this.verifierVerrou(u);
    if (!u.totpActive || !u.totpSecretChiffre) {
      throw new ForbiddenException({ code: 'MFA_NON_ACTIVE', message: 'Activez la vérification en deux étapes pour signer' });
    }
    const saisi = code.trim().replace(/\s+/g, '');
    if (/^\d{6}$/.test(saisi) && authenticator.check(saisi, this.chiffrement.dechiffrer(u.totpSecretChiffre))) {
      if (u.echecsConnexion) await this.prisma.utilisateur.update({ where: { id: u.id }, data: { echecsConnexion: 0 } });
      return;
    }
    this.auditer({ acteurId: u.id, action: EVENEMENTS.MFA_ECHOUE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip, contexte: 'signature' } });
    const essaisRestants = await this.enregistrerEchec(u, ECHECS_MAX_TOTP_SIGNATURE, ip);
    throw new UnauthorizedException({ code: 'CODE_INVALIDE', message: "Code incorrect : l'acte n'a pas été signé", essaisRestants });
  }

  // ─────────── BF-02 : enrôlement (maquette B3) ───────────

  async demarrerEnrolement(jetonMfa: string | undefined) {
    const u = await this.utilisateurEnAttenteMfa(jetonMfa);
    if (u.totpActive) throw new ConflictException({ code: 'MFA_DEJA_ACTIVE', message: 'Second facteur déjà activé' });
    const secret = authenticator.generateSecret(); // base32, 160 bits
    await this.prisma.utilisateur.update({ where: { id: u.id }, data: { totpSecretChiffre: this.chiffrement.chiffrer(secret) } });
    const uri = authenticator.keyuri(u.matricule, 'EACT MINESUP', secret);
    return { cleManuelle: secret.match(/.{1,4}/g)!.join(' '), qrCode: await toDataURL(uri, { margin: 1, width: 220 }) };
  }

  async confirmerEnrolement(jetonMfa: string | undefined, code: string, ip: string): Promise<ResultatConnexion> {
    const u = await this.utilisateurEnAttenteMfa(jetonMfa);
    if (u.totpActive || !u.totpSecretChiffre) throw new ConflictException({ code: 'ENROLEMENT_NON_DEMARRE', message: 'Enrôlement non démarré' });
    if (!authenticator.check(code.trim().replace(/\s+/g, ''), this.chiffrement.dechiffrer(u.totpSecretChiffre))) {
      throw new UnauthorizedException({ code: 'CODE_INVALIDE', message: 'Code invalide : vérifiez l’heure de votre téléphone' });
    }
    const codesSecours = Array.from({ length: NB_CODES_SECOURS }, codeDeSecours);
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { totpActive: true, codesSecours: codesSecours.map(empreinte) },
    });
    this.auditer({ acteurId: u.id, action: EVENEMENTS.MFA_ACTIVE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip } });
    // Les codes en clair ne sont montrés qu'une fois.
    return { etape: 'CONNECTE', jetons: await this.ouvrirSession(u.id, ip, true), codesSecours };
  }

  // ─────────── BF-04 : sessions ───────────

  private async jetonAcces(utilisateurId: string, sid: string): Promise<string> {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId }, include: { roles: true } });
    const charge: UtilisateurConnecte & { typ: 'acces' } = {
      sub: u.id,
      sid,
      roles: u.roles.map((r) => r.role),
      structureId: u.structureId,
      typ: 'acces',
    };
    return this.jwt.sign(charge, { expiresIn: '15m' });
  }

  private async ouvrirSession(utilisateurId: string, ip: string, mfa: boolean, details: Record<string, unknown> = {}): Promise<JetonsSession> {
    const rafraichissement = randomBytes(32).toString('base64url');
    const session = await this.prisma.sessionUtilisateur.create({
      data: { utilisateurId, empreinteJeton: empreinte(rafraichissement), adresseIp: ip, mfaVerifieLe: mfa ? new Date() : null },
    });
    this.auditer({
      acteurId: utilisateurId,
      action: EVENEMENTS.UTILISATEUR_CONNECTE,
      ressourceType: 'utilisateur',
      ressourceId: utilisateurId,
      details: { ip, mfa, ...details },
    });
    return { acces: await this.jetonAcces(utilisateurId, session.id), rafraichissement };
  }

  /** Renouvelle les deux jetons (rotation) ; refusé après 30 min sans activité ou si la session est révoquée. */
  async rafraichir(rafraichissement: string | undefined): Promise<JetonsSession> {
    const session = rafraichissement
      ? await this.prisma.sessionUtilisateur.findUnique({ where: { empreinteJeton: empreinte(rafraichissement) }, include: { utilisateur: true } })
      : null;
    if (
      !session ||
      session.revoqueLe ||
      !session.utilisateur.actif ||
      Date.now() - session.derniereActivite.getTime() > INACTIVITE_MAX_MS
    ) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIREE', message: 'Session expirée' });
    }
    const nouveau = randomBytes(32).toString('base64url');
    await this.prisma.sessionUtilisateur.update({
      where: { id: session.id },
      data: { empreinteJeton: empreinte(nouveau), derniereActivite: new Date() },
    });
    return { acces: await this.jetonAcces(session.utilisateurId, session.id), rafraichissement: nouveau };
  }

  async deconnecter(sid: string, utilisateurId: string) {
    await this.prisma.sessionUtilisateur.updateMany({ where: { id: sid, revoqueLe: null }, data: { revoqueLe: new Date() } });
    this.auditer({ acteurId: utilisateurId, action: EVENEMENTS.UTILISATEUR_DECONNECTE, ressourceType: 'utilisateur', ressourceId: utilisateurId });
  }

  async profil(utilisateurId: string) {
    const maintenant = new Date();
    const u = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      include: {
        roles: true,
        structure: true,
        delegationsRecues: {
          where: { actif: true, debut: { lte: maintenant }, fin: { gte: maintenant } },
          include: { delegant: { select: { prenom: true, nom: true } } },
        },
      },
    });
    return {
      id: u.id,
      matricule: u.matricule,
      email: u.email,
      prenom: u.prenom,
      nom: u.nom,
      langue: u.langue,
      roles: u.roles.map((r) => r.role),
      structure: { id: u.structure.id, code: u.structure.code, libelle: u.structure.libelle },
      totpActive: u.totpActive,
      codesSecoursRestants: u.codesSecours.length,
      delegationsActives: u.delegationsRecues.map((d) => ({
        id: d.id,
        type: d.type,
        mention: d.mention,
        fin: d.fin,
        perimetre: d.perimetre,
        delegant: `${d.delegant.prenom} ${d.delegant.nom}`,
      })),
    };
  }

  // ─────────── Mode démonstration (développement uniquement) ───────────
  // Permet de présenter EACT sans téléphone : connexion en un clic et code TOTP affiché à l'écran.
  // Inactif si DEMO_MODE n'est pas « true » ou si NODE_ENV=production (CDC tableau 24 : aucun contournement en production).

  static modeDemo(): boolean {
    return process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
  }

  async comptesDemo() {
    const comptes = await this.prisma.utilisateur.findMany({
      where: { actif: true },
      include: { roles: true, structure: true },
      orderBy: { matricule: 'asc' },
    });
    return comptes.map((u) => ({
      matricule: u.matricule,
      nom: `${u.prenom} ${u.nom}`,
      structure: u.structure.libelle,
      roles: u.roles.map((r) => r.role),
      totp: u.totpActive || u.roles.some((r) => ROLES_MFA_OBLIGATOIRE.includes(r.role)),
      verrouille: !!u.verrouilleJusqua && u.verrouilleJusqua > new Date(),
    }));
  }

  async connexionDemo(matricule: string, ip: string): Promise<ResultatConnexion> {
    const u = await this.prisma.utilisateur.findUnique({ where: { matricule } });
    if (!u?.actif) throw new UnauthorizedException({ code: 'IDENTIFIANTS_INCORRECTS', message: 'Compte de démonstration introuvable' });
    await this.prisma.utilisateur.update({ where: { id: u.id }, data: { echecsConnexion: 0, verrouilleJusqua: null } });
    return { etape: 'CONNECTE', jetons: await this.ouvrirSession(u.id, ip, true, { demo: true }) };
  }

  private codeCourant(secretChiffre: string | null) {
    if (!secretChiffre) throw new ConflictException({ code: 'MFA_NON_ACTIVE', message: 'Aucun secret TOTP pour ce compte' });
    const secret = this.chiffrement.dechiffrer(secretChiffre);
    return { code: authenticator.generate(secret), valableEncore: authenticator.timeRemaining() };
  }

  /** Code TOTP de l'utilisateur en attente de second facteur (écrans B2, B3). */
  async codeDemoMfa(jetonMfa: string | undefined) {
    const u = await this.utilisateurEnAttenteMfa(jetonMfa);
    return this.codeCourant(u.totpSecretChiffre);
  }

  /** Code TOTP de l'utilisateur connecté (signature, E3). */
  async codeDemo(utilisateurId: string) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    return this.codeCourant(u.totpSecretChiffre);
  }

  // ─────────── BF-05 : réinitialisation par lien à usage unique ───────────

  async demanderReinitialisation(identifiant: string, ip: string): Promise<{ destinataire?: string }> {
    const u = await this.trouver(identifiant);
    if (u?.actif) {
      const jeton = randomBytes(32).toString('base64url');
      await this.prisma.jetonReinitialisation.create({
        data: { utilisateurId: u.id, empreinteJeton: empreinte(jeton), expireLe: new Date(Date.now() + VALIDITE_LIEN_MS) },
      });
      const lien = `${process.env.WEB_URL ?? process.env.PUBLIC_BASE_URL}/mot-de-passe/nouveau?jeton=${jeton}`;
      await this.messagerie.envoyer({
        a: u.email,
        sujet: 'EACT — Réinitialisation de votre mot de passe',
        texte:
          `Bonjour ${u.prenom} ${u.nom},\n\nUne réinitialisation de votre mot de passe EACT a été demandée.\n` +
          `Ce lien est valable 30 minutes et ne sert qu'une fois :\n${lien}\n\n` +
          `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message et prévenez la DSI.\n\n` +
          `— EACT, Ministère de l'Enseignement Supérieur`,
      });
      this.auditer({ acteurId: u.id, action: EVENEMENTS.REINITIALISATION_DEMANDEE, ressourceType: 'utilisateur', ressourceId: u.id, details: { ip } });
    }
    // Réponse identique que le compte existe ou non ; on ne masque que l'adresse saisie par l'usager.
    return identifiant.includes('@') ? { destinataire: masquerEmail(identifiant.trim()) } : {};
  }

  async reinitialiser(jeton: string, motDePasse: string, ip: string) {
    const lien = await this.prisma.jetonReinitialisation.findUnique({ where: { empreinteJeton: empreinte(jeton) } });
    if (!lien || lien.utiliseLe || lien.expireLe < new Date()) {
      throw new GoneException({ code: 'LIEN_INVALIDE', message: "Ce lien n'est plus valable" });
    }
    const maintenant = new Date();
    await this.prisma.$transaction([
      this.prisma.jetonReinitialisation.update({ where: { id: lien.id }, data: { utiliseLe: maintenant } }),
      this.prisma.utilisateur.update({
        where: { id: lien.utilisateurId },
        data: { motDePasseHash: await argon2.hash(motDePasse, { type: argon2.argon2id }), echecsConnexion: 0, verrouilleJusqua: null },
      }),
      // Toutes les sessions ouvertes sont révoquées.
      this.prisma.sessionUtilisateur.updateMany({ where: { utilisateurId: lien.utilisateurId, revoqueLe: null }, data: { revoqueLe: maintenant } }),
    ]);
    this.auditer({
      acteurId: lien.utilisateurId,
      action: EVENEMENTS.MOT_DE_PASSE_REINITIALISE,
      ressourceType: 'utilisateur',
      ressourceId: lien.utilisateurId,
      details: { ip },
    });
  }
}
