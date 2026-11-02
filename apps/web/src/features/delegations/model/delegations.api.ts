// MVVM — Modèle : délégations de signature et intérims (M02, BF-09, BF-10).
import { appelApi } from '@/lib/api';

export type TypeDelegation = 'SIGNATURE' | 'INTERIM';
export type EtatDelegation = 'ACTIVE' | 'A_VENIR' | 'EXPIREE' | 'REVOQUEE';

export interface Delegation {
  id: string;
  type: TypeDelegation;
  sens: 'ACCORDEE' | 'RECUE';
  delegant: { nom: string; structure: string };
  delegataire: { nom: string; structure: string; roles: string[] };
  debut: string;
  fin: string;
  mention: string;
  perimetre: string[];
  etat: EtatDelegation;
  actesSignes: number;
}

export interface Candidats {
  peutDeleguerSignature: boolean;
  personnes: { id: string; nom: string; structure: string; roles: string[] }[];
  types: { code: string; libelle: string }[];
}

export interface NouvelleDelegation {
  delegataireId: string;
  type: TypeDelegation;
  du: string;
  au: string;
  mention: string;
  perimetre: string[];
  code?: string;
}

export const delegationsApi = {
  lister: () => appelApi<Delegation[]>('/v1/delegations'),
  candidats: () => appelApi<Candidats>('/v1/delegations/candidats'),
  declarer: (d: NouvelleDelegation) => appelApi<{ id: string }>('/v1/delegations', { method: 'POST', json: d }),
  revoquer: (id: string) => appelApi<void>(`/v1/delegations/${id}/revocation`, { method: 'POST' }),
};
