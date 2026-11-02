/** Seed idempotent : organigramme (décret n° 2012/433), types d'actes, circuits, gabarits et, hors production, comptes de démo. */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireGabarit } from '@eact/shared';
import { Langue, ModePublicite, PrismaClient, Role, TypeDelegation } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Secret TOTP partagé des comptes de démo. */
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

  // Circuits émis par la DAG (CDC tableau 3) ; la signature suit la dernière étape.
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

  // Gabarits : copie locale du dossier gabarits/ chargée dans le cache (RG-23), resynchronisable depuis GitHub (BF-59).
  const dossier = join(__dirname, '..', '..', '..', 'gabarits');
  for (const langue of [Langue.FR, Langue.EN]) {
    const rep = join(dossier, langue.toLowerCase());
    if (!existsSync(rep)) continue;
    for (const fichier of readdirSync(rep).filter((f) => f.endsWith('.html'))) {
      const g = lireGabarit(readFileSync(join(rep, fichier), 'utf8'));
      const type = await prisma.typeActe.findUnique({ where: { code: g.type } });
      if (!type) continue;
      const cheminGithub = `${langue.toLowerCase()}/${fichier}`;
      const donnees = { libelle: g.libelle, version: g.version, description: g.description, ampliationsDefaut: g.ampliations, contenuCache: g.corps, commitSha: 'seed' };
      await prisma.modeleActe.upsert({
        where: { typeActeId_langue_cheminGithub: { typeActeId: type.id, langue, cheminGithub } },
        update: donnees,
        create: { typeActeId: type.id, langue, cheminGithub, ...donnees },
      });
    }
  }
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
    // Sans TOTP : enrôlement obligatoire à la première connexion (BF-02).
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
