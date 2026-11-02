'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { LangueProvider } from '@/i18n';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={client}>
      <LangueProvider>{children}</LangueProvider>
    </QueryClientProvider>
  );
}
