'use client';

// MVVM — Vue-Modèle de l'assistant « Nouvel acte » (UC-06 étapes 1 à 3).
// L'étape est portée par l'URL : le bouton Précédent du navigateur fonctionne.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { actesApi } from '../model/actes.api';

export const SANS_MODELE = 'vierge';

export function useNouvelActeViewModel() {
  const router = useRouter();
  const params = useSearchParams();
  const etape = params.get('etape') === 'modele' ? 'modele' : 'type';
  const typeChoisiUrl = params.get('type');

  const types = useQuery({ queryKey: ['types-actes'], queryFn: actesApi.types });
  const [typeId, setTypeId] = useState<string | null>(typeChoisiUrl);
  const type = types.data?.find((t) => t.id === (typeChoisiUrl ?? typeId));

  const modeles = useQuery({
    queryKey: ['modeles', typeChoisiUrl],
    queryFn: () => actesApi.modeles(typeChoisiUrl!),
    enabled: etape === 'modele' && !!typeChoisiUrl,
  });
  const [modeleId, setModeleId] = useState<string | null>(null);
  const modeleCourant = modeleId ?? modeles.data?.modeles[0]?.id ?? SANS_MODELE;
  const modele = modeles.data?.modeles.find((m) => m.id === modeleCourant) ?? null;

  const creation = useMutation({
    mutationFn: () => actesApi.creer(typeChoisiUrl!, modeleCourant === SANS_MODELE ? undefined : modeleCourant),
    onSuccess: ({ id }) => router.push(`/actes/${id}/edition`),
  });

  return {
    etape,
    types: types.data ?? [],
    chargement: types.isLoading || modeles.isLoading,
    typeId: typeChoisiUrl ?? typeId,
    choisirType: setTypeId,
    type,
    continuer: () => typeId && router.push(`/actes/nouveau?etape=modele&type=${typeId}`),
    revenirAuType: () => router.push('/actes/nouveau'),
    annuler: () => router.push('/mes-actes'),
    depuisCache: modeles.data?.source === 'cache',
    synchroniseLe: modeles.data?.synchroniseLe ?? null,
    modeles: modeles.data?.modeles ?? [],
    modeleId: modeleCourant,
    choisirModele: setModeleId,
    modele,
    commencer: () => creation.mutate(),
    creationEnCours: creation.isPending,
    erreur: (types.error ?? modeles.error ?? creation.error)?.message,
  };
}
