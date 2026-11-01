/**
 * Données de démarrage : organigramme pilote (décret n° 2012/433), types d'actes (annexe B),
 * circuit d'une note de service. Comptes de démonstration : à ajouter ici avec des mots de passe de test uniquement.
 */
import { ModePublicite, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function structure(code: string, libelle: string, parentId?: string) {
  return prisma.structure.upsert({ where: { code }, update: {}, create: { code, libelle, parentId } });
}

async function main() {
  const sg = await structure('SG', 'Secrétariat Général');
  const dag = await structure('DAG', 'Direction des Affaires Générales', sg.id);
  await structure('SDACL', "Sous-Direction de l'Accueil, du Courrier et de Liaison", sg.id);
  await structure('DAJ', 'Division des Affaires Juridiques', sg.id);
  await structure('CT', 'Cellule de Traduction', sg.id);
  await structure('DSI', "Division des Systèmes d'Information", sg.id);
  await structure('SDDA', 'Sous-Direction de la Documentation et des Archives', sg.id);

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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
