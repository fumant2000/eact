// MVVM — Modèle : types et appels de l'API M05 (parapheur, visas, suivi du circuit).
import type { ValeurStatut } from '@eact/shared';
import { appelApi } from '@/lib/api';

export type Decision = 'FAVORABLE' | 'CORRECTION' | 'REJET';

export interface ActeAViser {
  id: string;
  version: number;
  codeType: string;
  objet: string;
  confidentialite: 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL';
  redacteur: string;
  structureRedacteur: string;
  etape: { ordre: number; total: number; libelle: string; delaiHeures: number };
  etapeSuivante: string | null;
  recuLe: string | null;
  echeance: string | null;
  piecesEnAnalyse: boolean;
  interimDe: { nom: string; mention: string } | null;
}

export interface VisaRecent {
  id: string;
  codeType: string;
  objet: string;
  statut: ValeurStatut;
  etape: string;
  decision: Decision;
  le: string;
}

export interface Suivi {
  redacteur: { nom: string; structure: string };
  creeLe: string;
  numeroVersion: number;
  etapes: { ordre: number; libelle: string; delaiHeures: number; viseurs: string[]; franchieDOffice: boolean }[];
  historique: (
    | { type: 'SOUMISSION'; le: string; acteur: string; structure: string; version: number }
    | { type: 'VISA'; le: string; acteur: string; structure: string; etape: { ordre: number; libelle: string }; decision: Decision; observation: string | null; etapeRetour: number | null }
  )[];
  echeance: string | null;
  etapeSuivante: string | null;
  peutViser: boolean;
  raisonNonVisa: 'HORS_CIRCUIT' | 'REDACTEUR' | 'DEJA_VISE' | 'PAS_VOTRE_ETAPE' | 'PIECES_EN_ANALYSE' | null;
  interimDe: { nom: string; mention: string } | null;
  dejaViseLe: string | null;
  dernierRenvoi: { viseur: string; observation: string | null; le: string; etapeRetour: number | null } | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const parapheurApi = {
  lister: () => appelApi<{ aViser: ActeAViser[]; recents: VisaRecent[] }>('/v1/parapheur'),
  suivi: (id: string) => appelApi<Suivi>(`/v1/actes/${id}/suivi`),
  decider: (id: string, corps: { decision: Decision; version: number; observation?: string; etapeRetour?: number }) =>
    appelApi<{ statut: ValeurStatut; version: number }>(`/v1/actes/${id}/visas`, { method: 'POST', json: corps }),
  /** Envoi qui survit à la fermeture de l'onglet (visa différé encore en attente). */
  viserAuDepart: (id: string, version: number, observation?: string) =>
    fetch(`${API}/v1/actes/${id}/visas`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'FAVORABLE', version, observation }),
    }),
};

/** Badge d'échéance (DueBadge) : en retard, sous 24 h, ou J-n. */
export function etatEcheance(echeance: string | null, maintenant = Date.now()) {
  if (!echeance) return null;
  const ecart = new Date(echeance).getTime() - maintenant;
  const heures = Math.ceil(Math.abs(ecart) / 3600_000);
  if (ecart < 0) return { niveau: 'retard' as const, jours: Math.floor(heures / 24), heures };
  if (ecart < 24 * 3600_000) return { niveau: 'proche' as const, jours: 0, heures };
  return { niveau: 'normal' as const, jours: Math.ceil(ecart / (24 * 3600_000)), heures };
}
