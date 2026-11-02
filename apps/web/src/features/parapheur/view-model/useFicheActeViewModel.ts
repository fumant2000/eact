'use client';

// MVVM — Vue-Modèle de la fiche d'un acte : document, frise du circuit, décisions (BF-24 à BF-26, BF-28).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { actesApi } from '@/features/actes/model/actes.api';
import { ErreurApi } from '@/lib/api';
import { notifierErreur, notifierSucces } from '@/lib/notifications';
import { parapheurApi, type Decision } from '../model/parapheur.api';

export type EtatEtape = 'fait' | 'courant' | 'aVenir' | 'renvoye';

export function useFicheActeViewModel(id: string) {
  const router = useRouter();
  const client = useQueryClient();
  const acte = useQuery({ queryKey: ['acte', id], queryFn: () => actesApi.detail(id) });
  const suivi = useQuery({ queryKey: ['suivi', id], queryFn: () => parapheurApi.suivi(id) });
  const [dialogue, setDialogue] = useState<Decision | null>(null);
  const [enCours, setEnCours] = useState(false);

  const a = acte.data;
  const s = suivi.data;

  /** État de chaque étape pour la frise (BF-28). */
  const etatEtape = (ordre: number): EtatEtape => {
    if (!a) return 'aVenir';
    if (['PRET_A_SIGNER', 'SIGNE', 'TRANSMIS', 'EXECUTOIRE', 'ARCHIVE'].includes(a.statut)) return 'fait';
    if (a.statut === 'EN_CIRCUIT' && a.etapeCourante) {
      if (ordre < a.etapeCourante.ordre) return 'fait';
      if (ordre === a.etapeCourante.ordre) return 'courant';
    }
    if (a.statut === 'A_CORRIGER' || a.statut === 'REJETE') {
      const derniere = s?.historique.filter((h) => h.type === 'VISA').at(-1);
      if (derniere?.type === 'VISA' && derniere.etape.ordre === ordre) return 'renvoye';
    }
    return 'aVenir';
  };
  /** Dernier visa d'une étape (acteur, date, observation) pour la frise. */
  const dernierVisa = (ordre: number) => s?.historique.filter((h) => h.type === 'VISA' && h.etape.ordre === ordre).at(-1);

  async function decider(decision: Decision, observation?: string, etapeRetour?: number) {
    if (!a) return;
    setEnCours(true);
    try {
      await parapheurApi.decider(id, { decision, version: a.version, observation, etapeRetour });
      notifierSucces(decision === 'FAVORABLE' ? 'parapheur.decision.FAVORABLE' : decision === 'CORRECTION' ? 'correction.envoyee' : 'rejet.effectue');
      setDialogue(null);
      await client.invalidateQueries({ queryKey: ['parapheur'] });
      router.push('/parapheur');
    } catch (e) {
      notifierErreur(e);
      // 409 : l'acte a changé entre-temps, on recharge la fiche.
      if (e instanceof ErreurApi && e.status === 409) {
        setDialogue(null);
        await Promise.all([acte.refetch(), suivi.refetch()]);
      }
    } finally {
      setEnCours(false);
    }
  }

  return {
    acte: a,
    suivi: s,
    chargement: acte.isLoading || suivi.isLoading,
    erreur: (acte.error ?? suivi.error)?.message,
    etatEtape,
    dernierVisa,
    etapesFranchies: s && a?.etapeCourante ? s.etapes.filter((e) => e.ordre < a.etapeCourante!.ordre) : [],
    dialogue,
    ouvrir: setDialogue,
    fermer: () => setDialogue(null),
    enCours,
    viser: (observation?: string) => decider('FAVORABLE', observation),
    corriger: (etapeRetour: number, motif: string) => decider('CORRECTION', motif, etapeRetour),
    rejeter: (motif: string) => decider('REJET', motif),
  };
}
