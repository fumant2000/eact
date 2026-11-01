/**
 * Cycle de vie d'un acte (CDC §14.1, figure 7).
 * Source unique des transitions : le serveur refuse toute transition absente d'ici,
 * le frontend s'en sert pour n'afficher que les actions possibles.
 */
export enum StatutActe {
  BROUILLON = 'BROUILLON',
  EN_CIRCUIT = 'EN_CIRCUIT',
  A_CORRIGER = 'A_CORRIGER',
  REJETE = 'REJETE',
  PRET_A_SIGNER = 'PRET_A_SIGNER',
  /** Projet de décret transmis à la Présidence ou aux services du Premier Ministre (BF-37). */
  TRANSMIS = 'TRANSMIS',
  SIGNE = 'SIGNE',
  EXECUTOIRE = 'EXECUTOIRE',
  ARCHIVE = 'ARCHIVE',
  RETIRE = 'RETIRE',
}

/** Accepte aussi la valeur brute renvoyée par Prisma ('BROUILLON'…). */
export type ValeurStatut = StatutActe | `${StatutActe}`;

export type ActionActe =
  | 'soumettre'
  | 'viser'
  | 'viserDerniereEtape'
  | 'demanderCorrection'
  | 'rejeter'
  | 'signer'
  | 'transmettre'
  | 'enregistrerTexteSigne'
  | 'rendreExecutoire'
  | 'archiver'
  | 'retirer';

const S = StatutActe;

export const TRANSITIONS: Record<ActionActe, { de: StatutActe[]; vers: StatutActe }> = {
  soumettre: { de: [S.BROUILLON, S.A_CORRIGER], vers: S.EN_CIRCUIT },
  viser: { de: [S.EN_CIRCUIT], vers: S.EN_CIRCUIT },
  viserDerniereEtape: { de: [S.EN_CIRCUIT], vers: S.PRET_A_SIGNER },
  demanderCorrection: { de: [S.EN_CIRCUIT, S.PRET_A_SIGNER], vers: S.A_CORRIGER },
  rejeter: { de: [S.EN_CIRCUIT, S.PRET_A_SIGNER], vers: S.REJETE },
  signer: { de: [S.PRET_A_SIGNER], vers: S.SIGNE },
  // Projet de décret (DEC) : le Ministre vise, l'autorité externe signe (BF-39).
  transmettre: { de: [S.PRET_A_SIGNER], vers: S.TRANSMIS },
  enregistrerTexteSigne: { de: [S.TRANSMIS], vers: S.SIGNE },
  // RG-13 : publication (acte réglementaire) ou notification (acte individuel).
  rendreExecutoire: { de: [S.SIGNE], vers: S.EXECUTOIRE },
  archiver: { de: [S.EXECUTOIRE], vers: S.ARCHIVE },
  retirer: { de: [S.SIGNE, S.EXECUTOIRE], vers: S.RETIRE },
};

export function peutAppliquer(action: ActionActe, statut: ValeurStatut): boolean {
  return TRANSITIONS[action].de.includes(statut as StatutActe);
}

export function actionsPossibles(statut: ValeurStatut): ActionActe[] {
  return (Object.keys(TRANSITIONS) as ActionActe[]).filter((a) => peutAppliquer(a, statut));
}

/** RG-10 / RG-14 : plus aucune modification de contenu à partir de la signature (ou de la transmission d'un décret). */
export function estImmuable(statut: ValeurStatut): boolean {
  return [S.TRANSMIS, S.SIGNE, S.EXECUTOIRE, S.ARCHIVE, S.RETIRE].includes(statut as StatutActe);
}
