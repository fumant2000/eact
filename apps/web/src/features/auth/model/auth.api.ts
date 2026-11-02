// MVVM — Modèle : types et appels de l'API M01. Les jetons restent dans des cookies httpOnly.
import { appelApi } from '@/lib/api';

export type EtapeConnexion = 'CONNECTE' | 'MFA' | 'ENROLEMENT';
export interface ReponseEtape {
  etape: EtapeConnexion;
  codesSecours?: string[];
}

export interface Profil {
  id: string;
  matricule: string;
  email: string;
  prenom: string;
  nom: string;
  langue: 'FR' | 'EN';
  roles: string[];
  structure: { id: string; code: string; libelle: string };
  totpActive: boolean;
  codesSecoursRestants: number;
  delegationsActives: { id: string; type: string; mention: string; fin: string; perimetre: string[]; delegant: string }[];
}

export const authApi = {
  connecter: (identifiant: string, motDePasse: string) =>
    appelApi<ReponseEtape>('/v1/auth/login', { method: 'POST', json: { identifiant, motDePasse } }),
  verifierCode: (code: string) => appelApi<ReponseEtape>('/v1/auth/mfa/verify', { method: 'POST', json: { code } }),
  demarrerEnrolement: () =>
    appelApi<{ cleManuelle: string; qrCode: string }>('/v1/auth/mfa/enrolement', { method: 'POST' }),
  confirmerEnrolement: (code: string) =>
    appelApi<ReponseEtape>('/v1/auth/mfa/enrolement/confirmation', { method: 'POST', json: { code } }),
  profil: () => appelApi<Profil>('/v1/auth/moi'),
  deconnecter: () => appelApi<{ ok: true }>('/v1/auth/logout', { method: 'POST' }),
  // Mode démonstration (DEMO_MODE=true côté API)
  demo: () =>
    appelApi<
      | { actif: false }
      | { actif: true; motDePasse: string; comptes: { matricule: string; nom: string; structure: string; roles: string[]; totp: boolean; verrouille: boolean }[] }
    >('/v1/auth/demo'),
  connexionDemo: (matricule: string) => appelApi<ReponseEtape>('/v1/auth/demo/connexion', { method: 'POST', json: { matricule } }),
  codeDemoMfa: () => appelApi<{ code: string; valableEncore: number }>('/v1/auth/demo/code-mfa'),
  codeDemo: () => appelApi<{ code: string; valableEncore: number }>('/v1/auth/demo/code'),
  demanderReinitialisation: (identifiant: string) =>
    appelApi<{ destinataire?: string }>('/v1/auth/mot-de-passe/oubli', { method: 'POST', json: { identifiant } }),
  reinitialiser: (jeton: string, motDePasse: string) =>
    appelApi<{ ok: true }>('/v1/auth/mot-de-passe/reinitialisation', { method: 'POST', json: { jeton, motDePasse } }),
};

/** Politique de la maquette B5, identique au serveur (auth.dto.ts). */
export const reglesMotDePasse = (mdp: string, confirmation: string) => ({
  longueur: mdp.length >= 10,
  majChiffre: /[A-Z]/.test(mdp) && /\d/.test(mdp),
  special: /[^A-Za-z0-9]/.test(mdp),
  identique: mdp.length > 0 && mdp === confirmation,
});
