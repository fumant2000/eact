import { Suspense } from 'react';
import { MesActes } from '@/features/actes/view/MesActes';

// C1 · /mes-actes
export default function MesActesPage() {
  return (
    <Suspense>
      <MesActes />
    </Suspense>
  );
}
