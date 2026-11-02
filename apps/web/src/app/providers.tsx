'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { LangueProvider } from '@/i18n';
import { Notifications, notifierErreur } from '@/lib/notifications';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
        // Toute erreur de chargement ou d'action non gérée sur place devient un toast lisible.
        queryCache: new QueryCache({ onError: (e, requete) => requete.meta?.silencieux !== true && notifierErreur(e) }),
        mutationCache: new MutationCache({ onError: (e, _v, _c, mutation) => mutation.meta?.silencieux !== true && notifierErreur(e) }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <LangueProvider>
        {children}
        <Notifications />
      </LangueProvider>
    </QueryClientProvider>
  );
}
