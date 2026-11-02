'use client';

// MVVM — Vue-Modèle de la signature d'un acte (UC-09) : code TOTP, progression, résultat, acte suivant.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ErreurApi } from '@/lib/api';
import { notifierErreur } from '@/lib/notifications';
import { signatureApi, type ResultatSignature } from '../model/signature.api';

/** UUID v4 ; crypto.randomUUID n'existe qu'en contexte sécurisé (HTTPS ou localhost), pas sur http://IP-du-poste. */
function nouvelleCle(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const o = crypto.getRandomValues(new Uint8Array(16));
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = [...o].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type PhaseSignature = 'ferme' | 'code' | 'enCours' | 'signe';

export function useSignatureViewModel(acteId: string) {
  const client = useQueryClient();
  const etat = useQuery({ queryKey: ['signature', acteId], queryFn: () => signatureApi.etat(acteId) });
  const liste = useQuery({ queryKey: ['a-signer'], queryFn: signatureApi.aSigner, enabled: etat.data?.signe === false && etat.data.peutSigner });
  const [phase, setPhase] = useState<PhaseSignature>('ferme');
  const [erreur, setErreur] = useState<{ essaisRestants?: number } | null>(null);
  const [resultat, setResultat] = useState<ResultatSignature | null>(null);
  // Une clé par tentative de signature, conservée pour les renvois après coupure.
  const cle = useRef<string | null>(null);

  // Tant que le PDF/A est en cours de génération, on interroge l'état (BF-32).
  const suivi = useQuery({
    queryKey: ['signature-pdf', acteId],
    queryFn: () => signatureApi.etat(acteId),
    enabled: phase === 'signe' && !!resultat && !resultat.pdfDisponible,
    refetchInterval: 1500,
  });
  const pdfDisponible = resultat?.pdfDisponible || (suivi.data?.signe && suivi.data.resultat.pdfDisponible) || false;

  async function signer(code: string) {
    cle.current ??= nouvelleCle();
    setErreur(null);
    setPhase('enCours');
    try {
      const r = await signatureApi.signer(acteId, code, cle.current);
      setResultat(r);
      setPhase('signe');
      await Promise.all(['signature', 'a-signer', 'acte', 'suivi', 'mes-actes'].map((k) => client.invalidateQueries({ queryKey: [k] })));
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'CODE_INVALIDE') {
        // Code refusé : rien n'a été signé, une nouvelle clé servira au prochain essai.
        cle.current = null;
        setErreur({ essaisRestants: e.details.essaisRestants as number | undefined });
        setPhase('code');
      } else if (e instanceof ErreurApi && e.status === 0) {
        // Coupure réseau : on garde la clé ; le prochain envoi rendra le résultat déjà obtenu s'il y en a un.
        notifierErreur(e);
        setPhase('code');
      } else {
        cle.current = null;
        notifierErreur(e);
        setPhase('ferme');
      }
    }
  }

  const restants = (liste.data ?? []).filter((a) => a.id !== acteId);
  return {
    etat: etat.data,
    chargement: etat.isLoading,
    phase,
    ouvrir: () => {
      setErreur(null);
      setPhase('code');
    },
    fermer: () => setPhase('ferme'),
    signer,
    erreur,
    resultat: resultat && { ...resultat, pdfDisponible },
    acteSuivant: restants[0]?.id ?? null,
    nbRestants: restants.length,
  };
}
