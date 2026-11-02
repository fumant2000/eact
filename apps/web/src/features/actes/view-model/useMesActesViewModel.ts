'use client';

// MVVM — Vue-Modèle de « Mes actes » : onglets, filtre, action principale de chaque ligne.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { actesApi, type GroupeStatut, type LigneActe } from '../model/actes.api';

const GROUPES: Record<Exclude<GroupeStatut, 'tous'>, string[]> = {
  brouillons: ['BROUILLON'],
  enCircuit: ['EN_CIRCUIT', 'PRET_A_SIGNER', 'TRANSMIS'],
  aCorriger: ['A_CORRIGER'],
  signes: ['SIGNE', 'EXECUTOIRE', 'ARCHIVE'],
};

export type ActionLigne = 'reprendre' | 'corriger' | 'suivre' | 'voir';

/** Une seule action principale par ligne. */
export function actionDe(a: LigneActe): ActionLigne {
  if (a.statut === 'BROUILLON') return 'reprendre';
  if (a.statut === 'A_CORRIGER') return 'corriger';
  if (GROUPES.enCircuit.includes(a.statut)) return 'suivre';
  return 'voir';
}

export function useMesActesViewModel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['mes-actes'], queryFn: actesApi.mesActes });
  const [onglet, setOnglet] = useState<GroupeStatut>('tous');
  const [filtre, setFiltre] = useState('');

  const actes = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return (data?.actes ?? []).filter(
      (a) =>
        (onglet === 'tous' || GROUPES[onglet].includes(a.statut)) &&
        (!f || a.objet.toLowerCase().includes(f) || a.reference?.toLowerCase().includes(f)),
    );
  }, [data, onglet, filtre]);

  return {
    chargement: isLoading,
    erreur: error?.message,
    compteurs: data?.compteurs,
    aCorriger: (data?.actes ?? []).filter((a) => a.statut === 'A_CORRIGER'),
    actes,
    total: data?.actes.length ?? 0,
    onglet,
    setOnglet,
    filtre,
    setFiltre,
  };
}
