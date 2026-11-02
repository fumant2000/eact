import { Suspense } from 'react';
import { EcranConnexion } from '@/features/auth/view/EcranConnexion';

// B1–B4 · /connexion
export default function ConnexionPage() {
  return (
    <Suspense>
      <EcranConnexion />
    </Suspense>
  );
}
