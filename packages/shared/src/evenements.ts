/**
 * Événements du bus interne (invocation implicite, CDC §11).
 * Producteurs : modules métier. Consommateurs : audit, notifications, relances, diffusion.
 */
export const EVENEMENTS = {
  ACTE_CREE: 'acte.cree',
  ACTE_SOUMIS: 'acte.soumis',
  ACTE_VISE: 'acte.vise',
  ACTE_A_CORRIGER: 'acte.a_corriger',
  ACTE_REJETE: 'acte.rejete',
  ACTE_SIGNE: 'acte.signe',
  ACTE_TRANSMIS: 'acte.transmis',
  ACTE_PUBLIE: 'acte.publie',
  ACTE_NOTIFIE: 'acte.notifie',
  ACTE_EXECUTOIRE: 'acte.executoire',
  ACTE_ARCHIVE: 'acte.archive',
  ACTE_CONSULTE_CONFIDENTIEL: 'acte.consulte_confidentiel',
  UTILISATEUR_CONNECTE: 'utilisateur.connecte',
  DROITS_MODIFIES: 'utilisateur.droits_modifies',
  PIECE_ANALYSEE: 'piece.analysee',
  ANOMALIE_SIGNALEE: 'anomalie.signalee',
} as const;

export type NomEvenement = (typeof EVENEMENTS)[keyof typeof EVENEMENTS];
