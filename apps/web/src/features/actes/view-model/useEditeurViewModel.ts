'use client';

// MVVM — Vue-Modèle de l'éditeur d'acte (C4 → C10).
// Enregistrement automatique (BF-17) : chaque saisie est envoyée 1 s après la dernière frappe, une requête à la fois,
// avec la version lue (verrou optimiste §14.2). Les pièces suivent le pipeline côté serveur (C5).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErreurApi } from '@/lib/api';
import { notifierErreur, notifierSucces } from '@/lib/notifications';
import { actesApi, EXTENSIONS_ACCEPTEES, TAILLE_MAX, type Acte, type Brouillon } from '../model/actes.api';

export type EtatEnregistrement = 'enregistre' | 'enAttente' | 'enCours' | 'erreur' | 'conflit';

export interface EnvoiLocal {
  cle: string;
  nomFichier: string;
  progression: number;
  refus?: { motif: 'tropGros' | 'format' | 'serveur'; mo?: number; message?: string };
}

const DELAI_ENREGISTREMENT_MS = 1000;
const depuis = (a: Acte): Brouillon => ({
  objet: a.objet,
  contenu: a.contenu,
  langue: a.langue,
  traductionRequise: a.traductionRequise,
  confidentialite: a.confidentialite,
  ampliations: a.ampliations,
  structureId: a.structure.id,
});

export function useEditeurViewModel(id: string) {
  const router = useRouter();
  const client = useQueryClient();
  const requete = useQuery({
    queryKey: ['acte', id],
    queryFn: () => actesApi.detail(id),
    // Tant qu'une pièce est en analyse, on interroge l'état chaque seconde.
    refetchInterval: (q) => (q.state.data?.pieces.some((p) => p.statutAnalyse === 'EN_ATTENTE') ? 1000 : false),
  });
  const acte = requete.data;

  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [generation, setGeneration] = useState(0); // change → l'éditeur de texte repart du serveur
  const version = useRef(0);
  const [etat, setEtat] = useState<EtatEnregistrement>('enregistre');
  const [enregistreLe, setEnregistreLe] = useState<Date | null>(null);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const aEnvoyer = useRef<Partial<Brouillon>>({});
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envoiEnCours = useRef<Promise<void> | null>(null);

  // Brouillon local initialisé une fois depuis le serveur (puis après « Recharger »).
  useEffect(() => {
    if (acte && brouillon === null) {
      setBrouillon(depuis(acte));
      version.current = acte.version;
      setEnregistreLe(new Date(acte.misAJourLe));
    }
  }, [acte, brouillon]);

  const envoyer = useCallback(async (): Promise<void> => {
    if (envoiEnCours.current) {
      await envoiEnCours.current;
      return Object.keys(aEnvoyer.current).length ? envoyer() : undefined;
    }
    const champs = aEnvoyer.current;
    if (!Object.keys(champs).length) return;
    aEnvoyer.current = {};
    setEtat('enCours');
    envoiEnCours.current = (async () => {
      try {
        const r = await actesApi.enregistrer(id, version.current, champs);
        version.current = r.version;
        setEnregistreLe(new Date(r.misAJourLe));
        setErreurEnregistrement(null);
        setEtat(Object.keys(aEnvoyer.current).length ? 'enAttente' : 'enregistre');
      } catch (e) {
        if (e instanceof ErreurApi && e.code === 'CONFLIT_VERSION') setEtat('conflit');
        else {
          aEnvoyer.current = { ...champs, ...aEnvoyer.current }; // rien n'est perdu : nouvel essai à la prochaine saisie
          setErreurEnregistrement(e instanceof Error ? e.message : String(e));
          setEtat('erreur');
          notifierErreur(e);
        }
      } finally {
        envoiEnCours.current = null;
      }
    })();
    await envoiEnCours.current;
  }, [id]);

  const modifier = useCallback(
    (champs: Partial<Brouillon>) => {
      setBrouillon((b) => (b ? { ...b, ...champs } : b));
      aEnvoyer.current = { ...aEnvoyer.current, ...champs };
      setEtat((e) => (e === 'conflit' ? e : 'enAttente'));
      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => void envoyer(), DELAI_ENREGISTREMENT_MS);
    },
    [envoyer],
  );

  /** Envoie immédiatement ce qui attend (avant soumission ou départ). */
  const vider = useCallback(async () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    await envoyer();
  }, [envoyer]);

  // Prévient la perte de saisie si l'onglet est fermé avant l'enregistrement.
  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => {
      if (Object.keys(aEnvoyer.current).length || envoiEnCours.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, []);

  const recharger = async () => {
    aEnvoyer.current = {};
    setBrouillon(null);
    setEtat('enregistre');
    await requete.refetch();
    setGeneration((g) => g + 1);
  };

  // ─────────── Pièces jointes (C5) ───────────
  const [envois, setEnvois] = useState<EnvoiLocal[]>([]);
  const majEnvoi = (cle: string, maj: Partial<EnvoiLocal>) => setEnvois((l) => l.map((e) => (e.cle === cle ? { ...e, ...maj } : e)));

  const ajouterFichiers = (fichiers: FileList | File[]) => {
    for (const f of Array.from(fichiers)) {
      const cle = `${f.name}-${f.size}-${Date.now()}-${Math.random()}`;
      const extension = f.name.split('.').pop()?.toLowerCase() ?? '';
      // Contrôle immédiat côté poste ; le serveur refait le contrôle sur le contenu (filtre 1).
      const refus: EnvoiLocal['refus'] =
        f.size > TAILLE_MAX ? { motif: 'tropGros', mo: Math.ceil(f.size / 1024 / 1024) } : !EXTENSIONS_ACCEPTEES.includes(extension) ? { motif: 'format' } : undefined;
      setEnvois((l) => [...l, { cle, nomFichier: f.name, progression: 0, refus }]);
      if (refus) continue;
      actesApi
        .envoyerPiece(id, f, (p) => majEnvoi(cle, { progression: p }))
        .then(async () => {
          await client.invalidateQueries({ queryKey: ['acte', id] });
          setEnvois((l) => l.filter((e) => e.cle !== cle));
        })
        .catch((e: Error) => {
          majEnvoi(cle, { refus: { motif: 'serveur', message: e.message } });
          notifierErreur(e);
        });
    }
  };
  const retirerEnvoi = (cle: string) => setEnvois((l) => l.filter((e) => e.cle !== cle));
  const retirerPiece = async (pieceId: string) => {
    try {
      await actesApi.supprimerPiece(id, pieceId);
      notifierSucces('toast.pieceRetiree');
    } catch (e) {
      notifierErreur(e);
    }
    await client.invalidateQueries({ queryKey: ['acte', id] });
  };

  // ─────────── Soumission (C6, C7) et suppression (C10) ───────────
  const [manquants, setManquants] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<'soumettre' | 'supprimer' | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState(false);

  const preparerSoumission = async () => {
    setErreurAction(null);
    await vider();
    const frais = (await requete.refetch()).data;
    if (!frais) return;
    setManquants(frais.champsManquants);
    if (!frais.champsManquants.length) setConfirmation('soumettre');
  };

  const executer = async (action: () => Promise<void>) => {
    setActionEnCours(true);
    setErreurAction(null);
    try {
      await action();
    } catch (e) {
      setErreurAction(e instanceof Error ? e.message : String(e));
      setConfirmation(null);
      notifierErreur(e);
    } finally {
      setActionEnCours(false);
    }
  };

  return {
    acte,
    brouillon,
    generation,
    chargement: requete.isLoading,
    erreurChargement: requete.error?.message,
    etat,
    enregistreLe,
    erreurEnregistrement,
    modifier,
    recharger,

    envois,
    ajouterFichiers,
    retirerEnvoi,
    retirerPiece,

    manquants,
    confirmation,
    fermerConfirmation: () => setConfirmation(null),
    preparerSoumission,
    soumettre: () =>
      executer(async () => {
        await actesApi.soumettre(id, version.current);
        notifierSucces('toast.soumis');
        await client.invalidateQueries({ queryKey: ['mes-actes'] });
        router.push('/mes-actes?soumis=1');
      }),
    demanderSuppression: () => setConfirmation('supprimer'),
    supprimer: () =>
      executer(async () => {
        await actesApi.supprimer(id);
        notifierSucces('toast.supprime');
        await client.invalidateQueries({ queryKey: ['mes-actes'] });
        router.push('/mes-actes');
      }),
    erreurAction,
    actionEnCours,
  };
}
