import { Suspense } from 'react';
import { MesActes } from '@/features/actes/view/MesActes';

// Mes actes du rédacteur (M04).
export default function MesActesPage() {
  return (
    <Suspense>
      <MesActes />
    </Suspense>
  );
}
