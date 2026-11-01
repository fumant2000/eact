/**
 * Référence administrative (CDC §1.4) :
 *   N° {année sur 2 chiffres}/{séquence sur 4 chiffres}/{code type}/MINESUP/{chaîne de structures}
 *   ex. N° 26/0042/NS/MINESUP/SG/DAG
 * Format exact à confirmer sur des actes réels anonymisés.
 */
export function formaterReference(p: {
  sequence: number;
  codeType: string;
  chaineStructures: string[];
  annee: number;
}): string {
  const aa = String(p.annee % 100).padStart(2, '0');
  const seq = String(p.sequence).padStart(4, '0');
  return `N° ${aa}/${seq}/${p.codeType}/MINESUP/${p.chaineStructures.join('/')}`;
}

/** Codes des types d'actes (annexe B). AC (arrêté conjoint) est réservé à la V2 (EV-06). */
export const CODES_TYPES_ACTES = ['DEC', 'AM', 'D', 'CIR', 'NS', 'C', 'ATT', 'AC'] as const;
export type CodeTypeActe = (typeof CODES_TYPES_ACTES)[number];

/**
 * Le Ministre ne signe pas les décrets : EACT gère leur projet, le circuit interne,
 * la transmission à la Présidence ou aux services du Premier Ministre, puis enregistre le texte signé.
 */
export const TYPES_SIGNES_HORS_MINISTERE: readonly CodeTypeActe[] = ['DEC'];

export enum NiveauConfidentialite {
  PUBLIC = 'PUBLIC',
  INTERNE = 'INTERNE',
  CONFIDENTIEL = 'CONFIDENTIEL',
}
