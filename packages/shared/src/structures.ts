/**
 * Libellés officiels bilingues des structures pour l'en-tête des actes (CT-01, annexe A).
 * Partagés par l'éditeur (aperçu) et la génération du PDF/A. À confirmer sur des actes réels.
 */
export const LIBELLES_STRUCTURES: Record<string, { fr: string; en: string }> = {
  CAB: { fr: 'CABINET DU MINISTRE', en: "MINISTER'S OFFICE" },
  SG: { fr: 'SECRÉTARIAT GÉNÉRAL', en: 'SECRETARIAT GENERAL' },
  DAG: { fr: 'DIRECTION DES AFFAIRES GÉNÉRALES', en: 'DEPARTMENT OF GENERAL AFFAIRS' },
  SP: { fr: 'SERVICE DU PERSONNEL', en: 'PERSONNEL SERVICE' },
  SDACL: { fr: "SOUS-DIRECTION DE L'ACCUEIL, DU COURRIER ET DE LIAISON", en: 'SUB-DEPARTMENT OF RECEPTION, MAIL AND LIAISON' },
  DAJ: { fr: 'DIVISION DES AFFAIRES JURIDIQUES', en: 'LEGAL AFFAIRS DIVISION' },
  CT: { fr: 'CELLULE DE TRADUCTION', en: 'TRANSLATION UNIT' },
  DSI: { fr: "DIVISION DES SYSTÈMES D'INFORMATION", en: 'INFORMATION SYSTEMS DIVISION' },
  SDDA: { fr: 'SOUS-DIRECTION DE LA DOCUMENTATION ET DES ARCHIVES', en: 'SUB-DEPARTMENT OF DOCUMENTATION AND ARCHIVES' },
  IGS: { fr: 'INSPECTION GÉNÉRALE DES SERVICES', en: 'GENERAL INSPECTORATE OF SERVICES' },
};

/** Titre de l'acte dans le document (« NOTE DE SERVICE N° … »). */
export const TITRES_TYPES: Record<string, { fr: string; en: string }> = {
  DEC: { fr: 'PROJET DE DÉCRET', en: 'DRAFT DECREE' },
  AM: { fr: 'ARRÊTÉ', en: 'ORDER' },
  D: { fr: 'DÉCISION', en: 'DECISION' },
  CIR: { fr: 'CIRCULAIRE', en: 'CIRCULAR' },
  NS: { fr: 'NOTE DE SERVICE', en: 'SERVICE NOTE' },
  C: { fr: 'COMMUNIQUÉ', en: 'PRESS RELEASE' },
  ATT: { fr: 'ATTESTATION', en: 'CERTIFICATE' },
};
