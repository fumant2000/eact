/**
 * Événements du bus interne (invocation implicite, CDC §11).
 * Producteurs : modules métier. Consommateurs : audit, notifications, relances, diffusion.
 */
export const EVENEMENTS = {
  ACTE_CREE: 'acte.cree',
  ACTE_SUPPRIME: 'acte.supprime',
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
  CONNEXION_ECHOUEE: 'utilisateur.connexion_echouee',
  COMPTE_VERROUILLE: 'utilisateur.compte_verrouille',
  MFA_ECHOUE: 'utilisateur.mfa_echoue',
  MFA_ACTIVE: 'utilisateur.mfa_active',
  UTILISATEUR_DECONNECTE: 'utilisateur.deconnecte',
  REINITIALISATION_DEMANDEE: 'utilisateur.reinitialisation_demandee',
  MOT_DE_PASSE_REINITIALISE: 'utilisateur.mot_de_passe_reinitialise',
  DROITS_MODIFIES: 'utilisateur.droits_modifies',
  DELEGATION_CREEE: 'delegation.creee',
  DELEGATION_REVOQUEE: 'delegation.revoquee',
  DELEGATION_EXPIREE: 'delegation.expiree',
  PIECE_ANALYSEE: 'piece.analysee',
  ANOMALIE_SIGNALEE: 'anomalie.signalee',
} as const;

export type NomEvenement = (typeof EVENEMENTS)[keyof typeof EVENEMENTS];
