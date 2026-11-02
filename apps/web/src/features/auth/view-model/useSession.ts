'use client';

// MVVM — Vue-Modèle de session : profil courant, déconnexion, et fermeture après 30 min d'inactivité (BF-04).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErreurApi, rafraichirSession } from '@/lib/api';
import { authApi } from '../model/auth.api';

const INACTIVITE_MAX_MS = 30 * 60_000;
const AVERTISSEMENT_MS = 2 * 60_000; // la fenêtre « Toujours là ? » apparaît 2 min avant
const RAFRAICHIR_TOUTES_MS = 10 * 60_000; // jeton d'accès de 15 min, renouvelé seulement si l'agent est actif

/** Lecture seule du profil connecté (pour les pages). */
export function useProfil() {
  return useQuery({ queryKey: ['session'], queryFn: authApi.profil, retry: false, staleTime: 5 * 60_000 });
}

/** Session complète : à n'utiliser qu'une fois, dans la coque (un seul minuteur d'inactivité). */
export function useSession() {
  const router = useRouter();
  const client = useQueryClient();
  const { data: profil, isLoading, error } = useProfil();

  const quitter = useCallback(
    async (raison?: 'expiree') => {
      await authApi.deconnecter().catch(() => undefined);
      client.clear();
      router.replace(raison ? '/connexion?session=expiree' : '/connexion');
    },
    [client, router],
  );

  // Non connecté : retour à la page de connexion.
  useEffect(() => {
    if (error instanceof ErreurApi && error.status === 401) router.replace('/connexion');
  }, [error, router]);

  // Suivi d'activité côté poste ; le serveur refuse lui aussi un rafraîchissement après 30 min.
  const derniereActivite = useRef(Date.now());
  const dernierRafraichissement = useRef(Date.now());
  const [resteAvantFermeture, setResteAvantFermeture] = useState<number | null>(null);

  useEffect(() => {
    if (!profil) return;
    const marquer = () => (derniereActivite.current = Date.now());
    const evenements = ['pointerdown', 'keydown', 'scroll'] as const;
    evenements.forEach((e) => window.addEventListener(e, marquer, { passive: true }));
    const minuteur = setInterval(() => {
      const maintenant = Date.now();
      const inactif = maintenant - derniereActivite.current;
      if (inactif >= INACTIVITE_MAX_MS) return void quitter('expiree');
      setResteAvantFermeture(inactif >= INACTIVITE_MAX_MS - AVERTISSEMENT_MS ? INACTIVITE_MAX_MS - inactif : null);
      if (inactif < RAFRAICHIR_TOUTES_MS && maintenant - dernierRafraichissement.current >= RAFRAICHIR_TOUTES_MS) {
        dernierRafraichissement.current = maintenant;
        void rafraichirSession().then((ok) => {
          if (!ok) void quitter('expiree');
        });
      }
    }, 1000);
    return () => {
      evenements.forEach((e) => window.removeEventListener(e, marquer));
      clearInterval(minuteur);
    };
  }, [profil, quitter]);

  return {
    profil,
    chargement: isLoading,
    deconnecter: () => quitter(),
    resteAvantFermeture,
    resterConnecte: () => {
      derniereActivite.current = Date.now();
      setResteAvantFermeture(null);
    },
    aRole: (...roles: string[]) => !!profil?.roles.some((r) => roles.includes(r)),
  };
}
