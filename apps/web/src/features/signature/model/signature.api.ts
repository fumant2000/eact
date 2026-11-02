// MVVM — Modèle : types et appels de l'API M06 (signature) et M13 (vérification publique).
import { appelApi } from '@/lib/api';

export interface ActeASigner {
  id: string;
  codeType: string;
  objet: string;
  confidentialite: 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL';
  redacteur: string;
  structure: string;
  nbVisas: number;
  pretDepuis: string | null;
  qualite: string;
}

export interface ResultatSignature {
  acteId: string;
  reference: string;
  signeLe: string;
  signataire: string | null;
  qualite: string;
  codeVerification: string;
  empreinteSha256: string | null;
  urlVerification: string;
  qrCode: string;
  pdfDisponible: boolean;
  rejoue?: boolean;
}

export type EtatSignature =
  | { signe: true; resultat: ResultatSignature }
  | { signe: false; peutSigner: boolean; qualite: string | null; raison: string | null };

export interface Verification {
  reference: string;
  type: string;
  structure: string;
  signeLe: string;
  signataire: string | null;
  qualite: string;
  statut: 'VALIDE' | 'RETIRE';
  empreinteTexte: string | null;
  empreintePdf: string | null;
  objet: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const signatureApi = {
  aSigner: () => appelApi<ActeASigner[]>('/v1/signature'),
  etat: (id: string) => appelApi<EtatSignature>(`/v1/actes/${id}/signature`),
  /** Même clé à chaque nouvel essai réseau : le serveur rejoue le même résultat (TF-08). */
  signer: (id: string, code: string, cle: string) =>
    appelApi<ResultatSignature>(`/v1/actes/${id}/signature`, { method: 'POST', json: { code }, headers: { 'Idempotency-Key': cle } }),
  urlPdf: (id: string) => `${API}/v1/actes/${id}/pdf`,
  comparer: async (code: string, fichier: File): Promise<{ identique: boolean; empreinteFichier: string }> => {
    const form = new FormData();
    form.append('fichier', fichier);
    const r = await fetch(`${API}/public/verifier/${encodeURIComponent(code)}/fichier`, { method: 'POST', body: form });
    if (!r.ok) throw new Error(`Comparaison impossible (${r.status})`);
    return r.json();
  },
};
