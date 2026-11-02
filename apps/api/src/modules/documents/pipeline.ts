import { createHash } from 'node:crypto';
import type { Antivirus } from '../../infrastructure/antivirus/antivirus';

/** Ce qui circule dans les tubes : le fichier et ce que les filtres en ont appris. */
export interface DocumentEnCours {
  contenu: Buffer;
  nomFichier: string;
  typeMime: string; // déterminé par le filtre 1 d'après le contenu, jamais d'après le navigateur
  empreinteSha256?: string;
}

/** Arrêt du pipeline : la pièce est refusée (format, taille) ou mise en quarantaine (menace). */
export class RejetFiltre extends Error {
  constructor(
    readonly statut: 'REJETEE' | 'INFECTEE',
    motif: string,
  ) {
    super(motif);
  }
}

/** Un filtre : indépendant, remplaçable, désactivable (CDC §13.1). */
export interface Filtre {
  readonly nom: string;
  readonly actif: boolean;
  traiter(doc: DocumentEnCours): Promise<DocumentEnCours>;
}

export const TAILLE_MAX_OCTETS = 20 * 1024 * 1024; // BF-18

const SIGNATURES: { mime: string; extensions: string[]; debut: number[] }[] = [
  { mime: 'application/pdf', extensions: ['pdf'], debut: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', extensions: ['png'], debut: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], debut: [0xff, 0xd8, 0xff] },
  // DOCX = archive ZIP (PK\x03\x04) ; l'extension distingue des autres ZIP
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'], debut: [0x50, 0x4b, 0x03, 0x04] },
];

/** Filtre 1 — contrôle du type (signature binaire + extension) et de la taille. */
export class FiltreTypeTaille implements Filtre {
  readonly nom = 'Contrôle type et taille';
  readonly actif = true;

  async traiter(doc: DocumentEnCours) {
    if (doc.contenu.length > TAILLE_MAX_OCTETS) {
      throw new RejetFiltre('REJETEE', `${Math.ceil(doc.contenu.length / 1024 / 1024)} Mo dépasse la limite de 20 Mo`);
    }
    const extension = doc.nomFichier.split('.').pop()?.toLowerCase() ?? '';
    const reconnu = SIGNATURES.find((s) => s.extensions.includes(extension) && s.debut.every((o, i) => doc.contenu[i] === o));
    if (!reconnu) throw new RejetFiltre('REJETEE', 'Format non accepté (PDF, DOCX, JPG, PNG)');
    return { ...doc, typeMime: reconnu.mime };
  }
}

/** Filtre 2 — antivirus (RG-24). */
export class FiltreAntivirus implements Filtre {
  readonly nom = 'Antivirus';
  readonly actif = true;
  constructor(private readonly antivirus: Antivirus) {}

  async traiter(doc: DocumentEnCours) {
    const r = await this.antivirus.analyser(doc.contenu);
    if (!r.sain) throw new RejetFiltre('INFECTEE', `Menace détectée (${r.menace}), fichier isolé`);
    return doc;
  }
}

/** Filtres 3, 4 et 6 : présents dans la chaîne, activés plus tard sans toucher aux autres. */
export class FiltreDesactive implements Filtre {
  readonly actif = false;
  constructor(readonly nom: string) {}
  async traiter(doc: DocumentEnCours) {
    return doc;
  }
}

/** Filtre 5 — empreinte SHA-256 (intégrité, ENF-05). */
export class FiltreEmpreinte implements Filtre {
  readonly nom = 'Empreinte SHA-256';
  readonly actif = true;
  async traiter(doc: DocumentEnCours) {
    return { ...doc, empreinteSha256: createHash('sha256').update(doc.contenu).digest('hex') };
  }
}

/** Les tubes : la sortie d'un filtre actif est l'entrée du suivant. */
export async function executerPipeline(filtres: Filtre[], doc: DocumentEnCours): Promise<DocumentEnCours> {
  let courant = doc;
  for (const filtre of filtres) {
    if (filtre.actif) courant = await filtre.traiter(courant);
  }
  return courant;
}
