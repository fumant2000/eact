import { Suspense } from 'react';
import { EcranNouveauMotDePasse } from '@/features/auth/view/EcransMotDePasse';

// Nouveau mot de passe depuis le lien reçu par e-mail (BF-05).
export default function NouveauMotDePassePage() {
  return (
    <Suspense>
      <EcranNouveauMotDePasse />
    </Suspense>
  );
}
