// MVVM — Modèle : types et appels de l'API M04 (rédaction).
import type { ValeurStatut } from '@eact/shared';
import { appelApi, ErreurApi } from '@/lib/api';

export type Langue = 'FR' | 'EN';
export type Niveau = 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL';
export type StatutPiece = 'EN_ATTENTE' | 'SAINE' | 'INFECTEE' | 'REJETEE';
export type GroupeStatut = 'tous' | 'brouillons' | 'enCircuit' | 'aCorriger' | 'signes';

export interface TypeActe {
  id: string;
  code: string;
  libelle: string;
  signeHorsMinistere: boolean;
  nbEtapes: number | null;
  structureChaine: string[];
  signataire: string;
}

export interface Modele {
  id: string;
  libelle: string;
  description: string | null;
  version: string;
  langue: Langue;
  commitSha: string;
  misAJourLe: string;
  contenu: string;
  ampliationsDefaut: string[];
}

export interface LigneActe {
  id: string;
  codeType: string;
  objet: string;
  statut: ValeurStatut;
  reference: string | null;
  jamaisSoumis: boolean;
  etapeCourante: string | null;
  champsManquants: number;
  misAJourLe: string;
}

export interface Structure {
  id: string;
  code: string;
  libelle: string;
  chaine: string[];
}

export interface Piece {
  id: string;
  nomFichier: string;
  typeMime: string;
  tailleOctets: number;
  statutAnalyse: StatutPiece;
  motifRejet: string | null;
}

export interface Acte {
  id: string;
  version: number;
  statut: ValeurStatut;
  reference: string | null;
  objet: string;
  contenu: string;
  langue: Langue;
  traductionRequise: boolean;
  confidentialite: Niveau;
  misAJourLe: string;
  type: { id: string; code: string; libelle: string };
  structure: Structure;
  modele: { libelle: string; version: string } | null;
  ampliations: string[];
  pieces: Piece[];
  circuit: { etapes: { id: string; ordre: number; libelle: string; delaiHeures: number }[]; signature: string } | null;
  etapeCourante: { ordre: number; libelle: string } | null;
  champsObligatoires: string[];
  champsManquants: string[];
  modifiable: boolean;
  supprimable: boolean;
  structuresPossibles: Structure[];
}

export type Brouillon = Pick<Acte, 'objet' | 'contenu' | 'langue' | 'traductionRequise' | 'confidentialite' | 'ampliations'> & {
  structureId: string;
};

export const actesApi = {
  types: () => appelApi<TypeActe[]>('/v1/types-actes'),
  modeles: (typeActeId: string) =>
    appelApi<{ source: 'cache' | 'github'; synchroniseLe: string | null; modeles: Modele[] }>(`/v1/modeles?typeActeId=${typeActeId}`),
  mesActes: () => appelApi<{ compteurs: Record<GroupeStatut, number>; actes: LigneActe[] }>('/v1/actes'),
  creer: (typeActeId: string, modeleId?: string) => appelApi<{ id: string }>('/v1/actes', { method: 'POST', json: { typeActeId, modeleId } }),
  detail: (id: string) => appelApi<Acte>(`/v1/actes/${id}`),
  enregistrer: (id: string, version: number, champs: Partial<Brouillon>) =>
    appelApi<{ version: number; misAJourLe: string }>(`/v1/actes/${id}`, { method: 'PATCH', json: { version, ...champs } }),
  soumettre: (id: string, version: number) =>
    appelApi<{ statut: string; etape: { ordre: number; libelle: string } }>(`/v1/actes/${id}/soumission`, { method: 'POST', json: { version } }),
  supprimer: (id: string) => appelApi<void>(`/v1/actes/${id}`, { method: 'DELETE' }),
  supprimerPiece: (id: string, pieceId: string) => appelApi<void>(`/v1/actes/${id}/pieces/${pieceId}`, { method: 'DELETE' }),
  urlPiece: (id: string, pieceId: string) => `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1/actes/${id}/pieces/${pieceId}`,

  /** XMLHttpRequest plutôt que fetch : seul moyen d'afficher la progression de l'envoi (C5). */
  envoyerPiece(id: string, fichier: File, progression: (pourcent: number) => void): Promise<Piece> {
    return new Promise((resoudre, rejeter) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1/actes/${id}/pieces`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => e.lengthComputable && progression(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        const corps = JSON.parse(xhr.responseText || 'null');
        if (xhr.status === 202) resoudre(corps);
        else rejeter(new ErreurApi(xhr.status, corps?.code, corps?.message ?? `Erreur ${xhr.status}`, corps ?? {}));
      };
      xhr.onerror = () => rejeter(new ErreurApi(0, 'RESEAU', 'Connexion interrompue'));
      const form = new FormData();
      form.append('fichier', fichier);
      xhr.send(form);
    });
  },
};

/** RG-03 côté poste : même règle que le serveur, recalculée à chaque frappe pour la liste « À compléter ». */
export function champsManquantsLocaux(exiges: string[], b: Pick<Brouillon, 'objet' | 'contenu' | 'ampliations'>): string[] {
  const texte = b.contenu.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return exiges.filter(
    (c) => (c === 'objet' && !b.objet.trim()) || (c === 'contenu' && !texte) || (c === 'ampliation' && b.ampliations.length === 0),
  );
}

export const EXTENSIONS_ACCEPTEES = ['pdf', 'docx', 'jpg', 'jpeg', 'png'];
export const TAILLE_MAX = 20 * 1024 * 1024; // BF-18
