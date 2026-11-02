'use client';

// MVVM — Vue-Modèle de la connexion (BF-01 à BF-03) : automate d'étapes, sans import graphique.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErreurApi } from '@/lib/api';
import { authApi } from '../model/auth.api';

export type Ecran = 'identifiants' | 'mfa' | 'enrolement' | 'codesSecours' | 'verrouille';

export function useConnexionViewModel() {
  const router = useRouter();
  const [ecran, setEcran] = useState<Ecran>('identifiants');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<{ code?: string; essaisRestants?: number } | null>(null);
  const [deverrouillageLe, setDeverrouillageLe] = useState<string | null>(null);
  const [enrolement, setEnrolement] = useState<{ cleManuelle: string; qrCode: string } | null>(null);
  const [codesSecours, setCodesSecours] = useState<string[]>([]);

  const entrer = () => {
    router.replace('/mon-travail');
    router.refresh();
  };

  async function executer(action: () => Promise<void>) {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'COMPTE_VERROUILLE') {
        setDeverrouillageLe(String(e.details.deverrouillageLe));
        setEcran('verrouille');
      } else if (e instanceof ErreurApi && e.code === 'MFA_EXPIRE') {
        setEcran('identifiants');
        setErreur({ code: e.code });
      } else {
        setErreur({
          code: e instanceof ErreurApi ? e.code : 'RESEAU',
          essaisRestants: e instanceof ErreurApi ? (e.details.essaisRestants as number | undefined) : undefined,
        });
      }
    } finally {
      setEnCours(false);
    }
  }

  return {
    ecran,
    enCours,
    erreur,
    deverrouillageLe,
    enrolement,
    codesSecours,

    connecter: (identifiant: string, motDePasse: string) =>
      executer(async () => {
        const r = await authApi.connecter(identifiant, motDePasse);
        if (r.etape === 'CONNECTE') return entrer();
        if (r.etape === 'ENROLEMENT') setEnrolement(await authApi.demarrerEnrolement());
        setEcran(r.etape === 'MFA' ? 'mfa' : 'enrolement');
      }),

    verifierCode: (code: string) =>
      executer(async () => {
        await authApi.verifierCode(code);
        entrer();
      }),

    confirmerEnrolement: (code: string) =>
      executer(async () => {
        const r = await authApi.confirmerEnrolement(code);
        setCodesSecours(r.codesSecours ?? []);
        setEcran('codesSecours');
      }),

    continuer: entrer,
    recommencer: () => {
      setErreur(null);
      setEcran('identifiants');
    },
  };
}
