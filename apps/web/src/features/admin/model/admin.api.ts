// MVVM — Modèle : administration (M15 paramétrage, M02 comptes et organigramme, M14 gabarits).
import { appelApi } from '@/lib/api';

export const ROLES = [
  'REDACTEUR',
  'VISEUR',
  'JURISTE',
  'TRADUCTEUR',
  'SECRETAIRE_GENERAL',
  'AUTORITE_SIGNATAIRE',
  'AGENT_COURRIER',
  'ARCHIVISTE',
  'ADMINISTRATEUR',
  'AUDITEUR',
] as const;
export type Role = (typeof ROLES)[number];
export const CHAMPS = ['objet', 'contenu', 'ampliation'] as const;

export interface Etape { id: string; ordre: number; libelle: string; roleRequis: Role; delaiHeures: number; utilisee: boolean }
export interface TypeAdmin {
  id: string;
  code: string;
  libelle: string;
  actif: boolean;
  signeHorsMinistere: boolean;
  dureeConservationAnnees: number | null;
  champsObligatoires: string[];
  nbActes: number;
  circuits: { id: string; actif: boolean; structure: { id: string; code: string; libelle: string; chaine: string[] }; etapes: Etape[] }[];
}
export interface StructureAdmin { id: string; code: string; libelle: string; parentId: string | null; agents: number; chaine: string[] }
export interface UtilisateurAdmin {
  id: string;
  matricule: string;
  email: string;
  prenom: string;
  nom: string;
  structure: { id: string; code: string; libelle: string };
  roles: Role[];
  actif: boolean;
  totpActive: boolean;
  verrouille: boolean;
}
export interface Gabarits {
  synchronisation: { source: 'github' | 'cache'; depot: string | null; derniereReussite: string | null; erreur: string | null };
  modeles: { id: string; type: { code: string; libelle: string }; libelle: string; version: string; langue: string; chemin: string; commitSha: string; misAJourLe: string; utilisations: number }[];
}

const json = (methode: string, corps?: unknown) => ({ method: methode, json: corps });

export const adminApi = {
  types: () => appelApi<TypeAdmin[]>('/v1/admin/types'),
  modifierType: (id: string, d: Partial<Pick<TypeAdmin, 'libelle' | 'champsObligatoires' | 'dureeConservationAnnees' | 'actif'>>) => appelApi<void>(`/v1/admin/types/${id}`, json('PATCH', d)),
  creerCircuit: (d: { typeActeId: string; structureId: string; etapes: Omit<Etape, 'id' | 'ordre' | 'utilisee'>[] }) => appelApi<{ id: string }>('/v1/admin/circuits', json('POST', d)),
  ajouterEtape: (circuitId: string, e: Omit<Etape, 'id' | 'ordre' | 'utilisee'>) => appelApi<{ id: string }>(`/v1/admin/circuits/${circuitId}/etapes`, json('POST', e)),
  modifierEtape: (id: string, e: Partial<Omit<Etape, 'id' | 'ordre' | 'utilisee'>>) => appelApi<void>(`/v1/admin/etapes/${id}`, json('PATCH', e)),
  supprimerEtape: (id: string) => appelApi<void>(`/v1/admin/etapes/${id}`, { method: 'DELETE' }),
  structures: () => appelApi<StructureAdmin[]>('/v1/admin/structures'),
  creerStructure: (d: { code: string; libelle: string; parentId?: string }) => appelApi<{ id: string }>('/v1/admin/structures', json('POST', d)),
  utilisateurs: () => appelApi<UtilisateurAdmin[]>('/v1/admin/utilisateurs'),
  creerUtilisateur: (d: { matricule: string; email: string; prenom: string; nom: string; structureId: string; roles: Role[] }) => appelApi<{ id: string }>('/v1/admin/utilisateurs', json('POST', d)),
  modifierUtilisateur: (id: string, d: { structureId?: string; roles?: Role[]; actif?: boolean }) => appelApi<void>(`/v1/admin/utilisateurs/${id}`, json('PATCH', d)),
  reinitialiserMfa: (id: string) => appelApi<void>(`/v1/admin/utilisateurs/${id}/mfa/reinitialisation`, { method: 'POST' }),
  deverrouiller: (id: string) => appelApi<void>(`/v1/admin/utilisateurs/${id}/deverrouillage`, { method: 'POST' }),
  gabarits: () => appelApi<Gabarits>('/v1/gabarits'),
  synchroniser: () => appelApi<Gabarits['synchronisation'] & { misAJour: number; inchanges: number; ignores: string[]; erreur: string | null }>('/v1/gabarits/synchronisation', { method: 'POST' }),
};
