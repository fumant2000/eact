import { Suspense } from 'react';
import { EcranConnexion } from '@/features/auth/view/EcranConnexion';

// Connexion et second facteur (BF-01 à BF-03).
export default function ConnexionPage() {
  return (
    <Suspense>
      <EcranConnexion />
    </Suspense>
  );
}
