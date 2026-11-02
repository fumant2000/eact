/**
 * Données de démarrage : organigramme pilote (décret n° 2012/433), types d'actes (annexe B),
 * circuit d'une note de service, gabarits, et — hors production — comptes de démonstration.
 * Idempotent : peut être relancé sans dupliquer les données.
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { Langue, ModePublicite, PrismaClient, Role, TypeDelegation } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Secret TOTP partagé des comptes de démo : à ajouter dans l'application d'authentification du présentateur. */
const SECRET_TOTP_DEMO = 'JBSWY3DPEHPK3PXP';

/** Même format que ChiffrementService (AES-256-GCM, clé dérivée de SECRETS_ENCRYPTION_KEY). */
function chiffrer(clair: string): string {
  const cle = createHash('sha256').update(process.env.SECRETS_ENCRYPTION_KEY!).digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cle, iv);
  const chiffre = Buffer.concat([c.update(clair, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), chiffre]).toString('base64');
}

async function structure(code: string, libelle: string, parentId?: string) {
  return prisma.structure.upsert({ where: { code }, update: {}, create: { code, libelle, parentId } });
}

async function main() {
  const cab = await structure('CAB', 'Cabinet du Ministre');
  const sg = await structure('SG', 'Secrétariat Général');
  const dag = await structure('DAG', 'Direction des Affaires Générales', sg.id);
  const sp = await structure('SP', 'Service du Personnel', dag.id);
  await structure('SDACL', "Sous-Direction de l'Accueil, du Courrier et de Liaison", sg.id);
  const daj = await structure('DAJ', 'Division des Affaires Juridiques', sg.id);
  const ct = await structure('CT', 'Cellule de Traduction', sg.id);
  const dsi = await structure('DSI', "Division des Systèmes d'Information", sg.id);
  await structure('SDDA', 'Sous-Direction de la Documentation et des Archives', sg.id);
  const igs = await structure('IGS', 'Inspection Générale des Services');

  // null = conservation définitive (annexe C)
  const types = [
    { code: 'DEC', libelle: 'Projet de décret', modePublicite: ModePublicite.JOURNAL_OFFICIEL, signeHorsMinistere: true, dureeConservationAnnees: null },
    { code: 'AM', libelle: 'Arrêté ministériel', modePublicite: ModePublicite.PUBLICATION_OU_NOTIFICATION, dureeConservationAnnees: null },
    { code: 'D', libelle: 'Décision', modePublicite: ModePublicite.NOTIFICATION, dureeConservationAnnees: 30 },
    { code: 'CIR', libelle: 'Circulaire / instruction', modePublicite: ModePublicite.DIFFUSION, dureeConservationAnnees: null },
    { code: 'NS', libelle: 'Note de service', modePublicite: ModePublicite.DIFFUSION, dureeConservationAnnees: 10 },
    { code: 'C', libelle: 'Communiqué', modePublicite: ModePublicite.SITE_ET_PRESSE, dureeConservationAnnees: 10 },
    { code: 'ATT', libelle: 'Attestation / certificat', modePublicite: ModePublicite.REMISE, dureeConservationAnnees: 5 },
  ];
  for (const t of types) {
    await prisma.typeActe.upsert({
      where: { code: t.code },
      update: {},
      create: { ...t, champsObligatoires: ['objet', 'contenu'] },
    });
  }

  // Circuit observé pour une note de service (CDC tableau 3) : chef de service → directeur → SG.
  const ns = await prisma.typeActe.findUniqueOrThrow({ where: { code: 'NS' } });
  await prisma.circuitValidation.upsert({
    where: { typeActeId_structureId: { typeActeId: ns.id, structureId: dag.id } },
    update: {},
    create: {
      typeActeId: ns.id,
      structureId: dag.id,
      etapes: {
        create: [
          { ordre: 1, libelle: 'Visa du chef de service', roleRequis: Role.VISEUR, delaiHeures: 48 },
          { ordre: 2, libelle: 'Visa du directeur', roleRequis: Role.VISEUR, delaiHeures: 48 },
          { ordre: 3, libelle: 'Visa du Secrétaire Général', roleRequis: Role.SECRETAIRE_GENERAL, delaiHeures: 48 },
        ],
      },
    },
  });

  // Gabarits (cache de eact-gabarits, RG-23) — le contenu réel viendra du dépôt GitHub (BF-59).
  const d = await prisma.typeActe.findUniqueOrThrow({ where: { code: 'D' } });
  const gabarits = [
    {
      typeActeId: ns.id,
      libelle: 'Note de service standard DAG',
      cheminGithub: 'fr/note-de-service.md',
      contenuCache: [
        'RÉPUBLIQUE DU CAMEROUN — Paix – Travail – Patrie',
        "MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR",
        'SECRÉTARIAT GÉNÉRAL — DIRECTION DES AFFAIRES GÉNÉRALES',
        '',
        'NOTE DE SERVICE N° [attribuée à la signature]',
        'portant {{objet}}',
        '',
        "Il est porté à la connaissance de l'ensemble du personnel que…",
        '',
        'Article 1er. …',
        'Article 2. Les responsables veillent à la stricte exécution de la présente note de service.',
      ].join('\n'),
    },
    {
      typeActeId: d.id,
      libelle: 'Décision portant affectation de personnel',
      cheminGithub: 'fr/decision-affectation.md',
      contenuCache: [
        'RÉPUBLIQUE DU CAMEROUN — Paix – Travail – Patrie',
        "MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR",
        '',
        'DÉCISION N° [attribuée à la signature]',
        "portant affectation d'un agent au Service du Personnel",
        '',
        "LE MINISTRE DE L'ENSEIGNEMENT SUPÉRIEUR,",
        '',
        'Vu la Constitution ;',
        "Vu le décret n° 2012/433 du 1er octobre 2012 portant organisation du Ministère de l'Enseignement Supérieur ;",
        '',
        'DÉCIDE :',
        '',
        'Article 1er. Madame / Monsieur {{agent}} est affecté(e) au Service du Personnel.',
        'Article 2. La présente décision prend effet à compter de la date de prise de service.',
      ].join('\n'),
    },
  ];
  for (const g of gabarits) {
    await prisma.modeleActe.upsert({
      where: { typeActeId_langue_cheminGithub: { typeActeId: g.typeActeId, langue: Langue.FR, cheminGithub: g.cheminGithub } },
      update: {},
      create: { ...g, langue: Langue.FR, commitSha: 'seed' },
    });
  }

  if (process.env.NODE_ENV === 'production') return;

  // ───── Comptes de démonstration (noms fictifs) — mot de passe : DEMO_MOT_DE_PASSE ─────
  const motDePasseHash = await argon2.hash(process.env.DEMO_MOT_DE_PASSE ?? 'Minesup@2026', { type: argon2.argon2id });
  const comptes = [
    { matricule: 'MINESUP-00001', prenom: 'Roger', nom: 'ESSOMBA', structureId: cab.id, roles: [Role.AUTORITE_SIGNATAIRE], totp: true },
    { matricule: 'MINESUP-00017', prenom: 'Ibrahim', nom: 'BELLO', structureId: sg.id, roles: [Role.SECRETAIRE_GENERAL, Role.VISEUR, Role.AUTORITE_SIGNATAIRE], totp: true },
    { matricule: 'MINESUP-03107', prenom: 'Abdou', nom: 'NJOYA', structureId: dag.id, roles: [Role.VISEUR, Role.REDACTEUR] },
    { matricule: 'MINESUP-02845', prenom: 'Marie', nom: 'BELINGA', structureId: sp.id, roles: [Role.VISEUR, Role.REDACTEUR] },
    { matricule: 'MINESUP-04812', prenom: 'Christelle', nom: 'EBOGO', structureId: sp.id, roles: [Role.REDACTEUR] },
    { matricule: 'MINESUP-05520', prenom: 'Solange', nom: 'MBARGA', structureId: daj.id, roles: [Role.JURISTE] },
    { matricule: 'MINESUP-06233', prenom: 'Daniel', nom: 'FOTSO', structureId: ct.id, roles: [Role.TRADUCTEUR] },
    // Pas de TOTP : montre l'enrôlement obligatoire (maquette B3) à la première connexion.
    { matricule: 'MINESUP-02019', prenom: 'Hervé', nom: 'TCHAMBA', structureId: dsi.id, roles: [Role.ADMINISTRATEUR] },
    { matricule: 'MINESUP-07341', prenom: 'Aïcha', nom: 'MOUSSA', structureId: igs.id, roles: [Role.AUDITEUR] },
  ];
  const ids: Record<string, string> = {};
  for (const c of comptes) {
    const email = `${c.prenom[0]}.${c.nom}@minesup.test`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const u = await prisma.utilisateur.upsert({
      where: { matricule: c.matricule },
      update: {},
      create: {
        matricule: c.matricule,
        email,
        prenom: c.prenom,
        nom: c.nom,
        structureId: c.structureId,
        motDePasseHash,
        totpActive: !!c.totp,
        totpSecretChiffre: c.totp ? chiffrer(SECRET_TOTP_DEMO) : null,
      },
    });
    await prisma.utilisateurRole.createMany({ data: c.roles.map((role) => ({ utilisateurId: u.id, role })), skipDuplicates: true });
    ids[c.matricule] = u.id;
  }

  // BF-09 : le Ministre délègue sa signature au SG pour les notes de service, décisions et attestations.
  const delegantId = ids['MINESUP-00001'];
  const delegataireId = ids['MINESUP-00017'];
  if (!(await prisma.delegation.findFirst({ where: { delegantId, delegataireId } }))) {
    const jour = 24 * 3600_000;
    await prisma.delegation.create({
      data: {
        type: TypeDelegation.SIGNATURE,
        delegantId,
        delegataireId,
        debut: new Date(Date.now() - jour),
        fin: new Date(Date.now() + 60 * jour),
        mention: 'Pour le Ministre et par délégation, Le Secrétaire Général',
        perimetre: ['NS', 'D', 'ATT'],
      },
    });
  }
  console.log(`Seed : ${comptes.length} comptes de démo (mot de passe DEMO_MOT_DE_PASSE, secret TOTP ${SECRET_TOTP_DEMO})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
