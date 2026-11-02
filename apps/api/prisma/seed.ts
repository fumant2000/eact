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
  // RG-03 : champs exigés à la soumission, paramétrables par type (BF-64).
  const AVEC_AMPLIATION = ['NS', 'D', 'ATT', 'CIR'];
  for (const t of types) {
    const champsObligatoires = AVEC_AMPLIATION.includes(t.code) ? ['objet', 'contenu', 'ampliation'] : ['objet', 'contenu'];
    await prisma.typeActe.upsert({
      where: { code: t.code },
      update: { champsObligatoires },
      create: { ...t, champsObligatoires },
    });
  }
  const typeParCode = async (code: string) => prisma.typeActe.findUniqueOrThrow({ where: { code } });
  const ns = await typeParCode('NS');
  const d = await typeParCode('D');
  const att = await typeParCode('ATT');

  // Circuits observés (CDC tableau 3, à confirmer à l'entretien), émis par la DAG. La signature suit la dernière étape.
  const circuits = [
    {
      typeActeId: ns.id,
      etapes: [
        { ordre: 1, libelle: 'Visa du chef de service', roleRequis: Role.VISEUR, delaiHeures: 48 },
        { ordre: 2, libelle: 'Visa du directeur', roleRequis: Role.VISEUR, delaiHeures: 48 },
        { ordre: 3, libelle: 'Visa du Secrétaire Général', roleRequis: Role.SECRETAIRE_GENERAL, delaiHeures: 48 },
      ],
    },
    {
      typeActeId: d.id,
      etapes: [
        { ordre: 1, libelle: 'Visa du chef de service', roleRequis: Role.VISEUR, delaiHeures: 48 },
        { ordre: 2, libelle: 'Visa du directeur', roleRequis: Role.VISEUR, delaiHeures: 48 },
        { ordre: 3, libelle: 'Contrôle de régularité (Division des Affaires Juridiques)', roleRequis: Role.JURISTE, delaiHeures: 72 },
        { ordre: 4, libelle: 'Visa du Secrétaire Général', roleRequis: Role.SECRETAIRE_GENERAL, delaiHeures: 48 },
      ],
    },
    {
      typeActeId: att.id,
      etapes: [
        { ordre: 1, libelle: 'Visa du chef de service', roleRequis: Role.VISEUR, delaiHeures: 24 },
        { ordre: 2, libelle: 'Visa du Secrétaire Général', roleRequis: Role.SECRETAIRE_GENERAL, delaiHeures: 24 },
      ],
    },
  ];
  for (const c of circuits) {
    await prisma.circuitValidation.upsert({
      where: { typeActeId_structureId: { typeActeId: c.typeActeId, structureId: dag.id } },
      update: {},
      create: { typeActeId: c.typeActeId, structureId: dag.id, etapes: { create: c.etapes } },
    });
  }

  // Gabarits (cache de eact-gabarits, RG-23) : corps de l'acte seulement, en HTML ; l'en-tête officiel,
  // le titre et le bloc de signature sont générés par EACT selon le type et la structure (BF-16).
  const gabarits = [
    {
      typeActeId: ns.id,
      libelle: 'Note de service · standard DAG',
      description: 'Préambule libre, articles numérotés, ampliation interne.',
      version: '2.3',
      cheminGithub: 'fr/note-de-service.html',
      ampliationsDefaut: ['SG', 'Toutes directions', 'Archives / Chrono'],
      contenuCache:
        "<p>Il est porté à la connaissance de l'ensemble du personnel que …</p>" +
        '<p><strong>Article 1er.</strong> …</p>' +
        '<p><strong>Article 2.</strong> Les responsables de structure veillent à la stricte application de la présente note de service.</p>',
    },
    {
      typeActeId: ns.id,
      libelle: 'Note de service · permanence et roulement',
      description: 'Organisation d’une permanence ; tableau des agents en pièce jointe.',
      version: '1.1',
      cheminGithub: 'fr/note-de-service-permanence.html',
      ampliationsDefaut: ['SG', 'DAG', 'SDACL', 'Intéressés', 'Archives / Chrono'],
      contenuCache:
        '<p>Il est porté à la connaissance du personnel qu’une permanence est organisée du … au …, selon le tableau joint.</p>' +
        '<p><strong>Article 1er.</strong> Les agents désignés assurent la permanence aux heures ouvrables.</p>' +
        '<p><strong>Article 2.</strong> Les chefs de service veillent à la stricte application de la présente note de service.</p>',
    },
    {
      typeActeId: d.id,
      libelle: 'Décision · affectation de personnel',
      description: 'Visas réglementaires, dispositif en articles, notification à l’intéressé.',
      version: '2.0',
      cheminGithub: 'fr/decision-affectation.html',
      ampliationsDefaut: ['Intéressé(e)', 'DAG', 'Service du Personnel', 'Archives / Chrono'],
      contenuCache:
        '<p><strong>LE MINISTRE DE L’ENSEIGNEMENT SUPÉRIEUR,</strong></p>' +
        '<p>Vu la Constitution ;</p>' +
        '<p>Vu le décret n° 2012/433 du 1er octobre 2012 portant organisation du Ministère de l’Enseignement Supérieur ;</p>' +
        '<p><strong>DÉCIDE :</strong></p>' +
        '<p><strong>Article 1er.</strong> Madame / Monsieur … est affecté(e) au Service du Personnel.</p>' +
        '<p><strong>Article 2.</strong> La présente décision prend effet à compter de la date de prise de service de l’intéressé(e).</p>',
    },
    {
      typeActeId: att.id,
      libelle: 'Attestation · présence effective',
      description: 'Constatation de présence au poste ; remise à l’agent demandeur.',
      version: '1.0',
      cheminGithub: 'fr/attestation-presence.html',
      ampliationsDefaut: ['Intéressé(e)', 'Archives / Chrono'],
      contenuCache:
        '<p>Je soussigné, Secrétaire Général du Ministère de l’Enseignement Supérieur, atteste que Madame / Monsieur …, matricule …, est en service effectif au … depuis le ….</p>' +
        '<p>En foi de quoi la présente attestation lui est délivrée pour servir et valoir ce que de droit.</p>',
    },
  ];
  for (const { typeActeId, cheminGithub, ...g } of gabarits) {
    // Le cache est rafraîchi à chaque seed (comme une synchronisation GitHub, BF-59).
    await prisma.modeleActe.upsert({
      where: { typeActeId_langue_cheminGithub: { typeActeId, langue: Langue.FR, cheminGithub } },
      update: { ...g, commitSha: 'seed' },
      create: { typeActeId, cheminGithub, ...g, langue: Langue.FR, commitSha: 'seed' },
    });
  }
  // Anciens gabarits du premier seed (en-tête dans le texte) : retirés s'ils ne servent à aucun acte.
  await prisma.modeleActe.deleteMany({ where: { cheminGithub: { endsWith: '.md' }, actes: { none: {} } } });

  if (process.env.NODE_ENV === 'production') return;

  // ───── Comptes de démonstration (noms fictifs) — mot de passe : DEMO_MOT_DE_PASSE ─────
  const motDePasseHash = await argon2.hash(process.env.DEMO_MOT_DE_PASSE ?? 'Minesup@2026', { type: argon2.argon2id });
  const comptes = [
    { matricule: 'MINESUP-00001', prenom: 'Roger', nom: 'ESSOMBA', structureId: cab.id, roles: [Role.AUTORITE_SIGNATAIRE], totp: true },
    { matricule: 'MINESUP-00017', prenom: 'Ibrahim', nom: 'BELLO', structureId: sg.id, roles: [Role.SECRETAIRE_GENERAL, Role.VISEUR], totp: true }, // signe par délégation (RG-11)
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
    await prisma.utilisateurRole.deleteMany({ where: { utilisateurId: u.id, role: { notIn: c.roles } } }); // le seed fait foi
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
