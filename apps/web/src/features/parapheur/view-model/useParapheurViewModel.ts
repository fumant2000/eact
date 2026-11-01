'use client';

// MVVM — Vue-Modèle : état, propriétés calculées et commandes, sans aucun import graphique.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parapheurApi, type ActeEnAttente } from '../model/parapheur.api';

export function useParapheurViewModel() {
  const queryClient = useQueryClient();
  const { data: actes = [], isLoading, error } = useQuery({
    queryKey: ['parapheur'],
    queryFn: parapheurApi.lister,
    refetchInterval: 60_000,
  });

  const maintenant = Date.now();
  // Triés par échéance (BF-23) ; « en retard » recalculé à chaque rendu (liaison réactive).
  const tries = [...actes].sort((a, b) => a.echeance.localeCompare(b.echeance));
  const enRetard = tries.filter((a) => new Date(a.echeance).getTime() < maintenant);

  const visa = useMutation({
    mutationFn: (acte: ActeEnAttente) => parapheurApi.viser(acte),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['parapheur'] }),
  });

  return {
    actes: tries,
    enRetard,
    isLoading,
    erreur: (error ?? visa.error)?.message,
    estEnRetard: (a: ActeEnAttente) => new Date(a.echeance).getTime() < maintenant,
    viser: (a: ActeEnAttente) => visa.mutate(a),
    visaEnCours: visa.isPending,
  };
}
