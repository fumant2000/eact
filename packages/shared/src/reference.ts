/** Référence administrative, ex. N° 26/0042/NS/MINESUP/SG/DAG (format à confirmer sur des actes réels). */
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

/** Codes des types d'actes ; AC (arrêté conjoint) est réservé à la V2 (EV-06). */
export const CODES_TYPES_ACTES = ['DEC', 'AM', 'D', 'CIR', 'NS', 'C', 'ATT', 'AC'] as const;
export type CodeTypeActe = (typeof CODES_TYPES_ACTES)[number];

/** Décrets signés hors du ministère (Président ou Premier Ministre) : EACT transmet le projet puis enregistre le texte signé. */
export const TYPES_SIGNES_HORS_MINISTERE: readonly CodeTypeActe[] = ['DEC'];

export enum NiveauConfidentialite {
  PUBLIC = 'PUBLIC',
  INTERNE = 'INTERNE',
  CONFIDENTIEL = 'CONFIDENTIEL',
}
