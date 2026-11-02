import { Suspense } from 'react';
import { NouvelActe } from '@/features/actes/view/NouvelActe';

// C2–C3 · /actes/nouveau?etape=type|modele
export default function NouvelActePage() {
  return (
    <Suspense>
      <NouvelActe />
    </Suspense>
  );
}
