'use client';

// MVVM — Vue-Modèle du parapheur (BF-23) : filtres et visa différé de 5 s, annulable depuis le toast.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/i18n';
import { notifierErreur } from '@/lib/notifications';
import { etatEcheance, parapheurApi, type ActeAViser } from '../model/parapheur.api';

export type FiltreParapheur = 'tous' | 'retard' | '24h' | 'confidentiels';
const DELAI_ANNULATION_MS = 5000;

export function useParapheurViewModel() {
  const { t } = useT();
  const client = useQueryClient();
  const requete = useQuery({ queryKey: ['parapheur'], queryFn: parapheurApi.lister, refetchInterval: 60_000 });
  const [onglet, setOnglet] = useState<'aViser' | 'recents'>('aViser');
  const [filtre, setFiltre] = useState<FiltreParapheur>('tous');
  const [texte, setTexte] = useState('');
  const [type, setType] = useState('');
  const [aConfirmer, setAConfirmer] = useState<ActeAViser | null>(null);
  // Visas confirmés mais pas encore envoyés : la ligne disparaît tout de suite.
  const differes = useRef(new Map<string, { minuteur: ReturnType<typeof setTimeout>; acte: ActeAViser; observation?: string }>());
  const [masques, setMasques] = useState<Set<string>>(new Set());

  const tous = (requete.data?.aViser ?? []).filter((a) => !masques.has(a.id));
  const compter = (f: FiltreParapheur) => tous.filter((a) => correspond(a, f)).length;
  const actes = useMemo(
    () =>
      tous.filter(
        (a) =>
          correspond(a, filtre) &&
          (!type || a.codeType === type) &&
          (!texte.trim() || `${a.objet} ${a.redacteur}`.toLowerCase().includes(texte.trim().toLowerCase())),
      ),
    [tous, filtre, type, texte],
  );

  // Fermeture de l'onglet pendant le délai : on envoie quand même (keepalive), rien ne se perd.
  useEffect(() => {
    const auDepart = () => {
      for (const [id, d] of differes.current) {
        clearTimeout(d.minuteur);
        void parapheurApi.viserAuDepart(id, d.acte.version, d.observation);
      }
      differes.current.clear();
    };
    window.addEventListener('pagehide', auDepart);
    return () => window.removeEventListener('pagehide', auDepart);
  }, []);

  const reafficher = (id: string) => setMasques((m) => new Set([...m].filter((x) => x !== id)));

  function confirmerVisa(observation?: string) {
    const acte = aConfirmer;
    if (!acte) return;
    setAConfirmer(null);
    setMasques((m) => new Set(m).add(acte.id));
    const minuteur = setTimeout(async () => {
      differes.current.delete(acte.id);
      try {
        await parapheurApi.decider(acte.id, { decision: 'FAVORABLE', version: acte.version, observation });
      } catch (e) {
        notifierErreur(e);
        reafficher(acte.id);
      }
      await client.invalidateQueries({ queryKey: ['parapheur'] });
      setMasques((m) => new Set([...m].filter((x) => x !== acte.id)));
    }, DELAI_ANNULATION_MS);
    differes.current.set(acte.id, { minuteur, acte, observation });
    toast.success(t('visa.enregistre', { objet: acte.objet }), {
      duration: DELAI_ANNULATION_MS,
      action: {
        label: t('visa.annuler'),
        onClick: () => {
          clearTimeout(minuteur);
          differes.current.delete(acte.id);
          reafficher(acte.id);
          toast(t('visa.annule'));
        },
      },
    });
  }

  return {
    chargement: requete.isLoading,
    onglet,
    setOnglet,
    filtre,
    setFiltre,
    texte,
    setTexte,
    type,
    setType,
    types: [...new Set(tous.map((a) => a.codeType))].sort(),
    compter,
    actes,
    total: tous.length,
    recents: requete.data?.recents ?? [],
    aConfirmer,
    demanderVisa: setAConfirmer,
    annulerConfirmation: () => setAConfirmer(null),
    confirmerVisa,
  };
}

function correspond(a: ActeAViser, f: FiltreParapheur) {
  const e = etatEcheance(a.echeance);
  if (f === 'retard') return e?.niveau === 'retard';
  if (f === '24h') return e?.niveau === 'proche';
  if (f === 'confidentiels') return a.confidentialite === 'CONFIDENTIEL';
  return true;
}
