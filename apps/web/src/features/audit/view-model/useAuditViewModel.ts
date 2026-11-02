'use client';

// MVVM — Modèle + Vue-Modèle du journal d'audit (I1, I3 ; BF-48 à BF-50).
import { useMutation, useQuery } from '@tanstack/react-query';
import { appelApi } from '@/lib/api';

export interface EntreeAudit {
  id: string;
  horodatage: string;
  acteurId: string | null;
  action: string;
  ressourceType: string;
  ressourceId: string | null;
  details: Record<string, unknown>;
  hash: string;
}

export function useAuditViewModel() {
  const journal = useQuery({
    queryKey: ['audit'],
    queryFn: () => appelApi<EntreeAudit[]>('/v1/audit?limite=100'),
  });
  const verification = useMutation({
    mutationFn: () => appelApi<{ integre: boolean; premiereRupture?: string }>('/v1/audit/verification'),
  });
  return {
    entrees: journal.data ?? [],
    chargement: journal.isLoading,
    erreur: journal.error?.message,
    verifier: () => verification.mutate(),
    verificationEnCours: verification.isPending,
    resultat: verification.data,
  };
}
