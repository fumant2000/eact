import { Suspense } from 'react';
import { EcranNouveauMotDePasse } from '@/features/auth/view/EcransMotDePasse';

// B5 · /mot-de-passe/nouveau?jeton=… (lien reçu par e-mail)
export default function NouveauMotDePassePage() {
  return (
    <Suspense>
      <EcranNouveauMotDePasse />
    </Suspense>
  );
}
