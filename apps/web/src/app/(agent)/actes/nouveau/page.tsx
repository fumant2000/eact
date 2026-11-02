import { Suspense } from 'react';
import { NouvelActe } from '@/features/actes/view/NouvelActe';

// Assistant « Nouvel acte » (UC-06).
export default function NouvelActePage() {
  return (
    <Suspense>
      <NouvelActe />
    </Suspense>
  );
}
