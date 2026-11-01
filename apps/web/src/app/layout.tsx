import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: "EACT — Ministère de l'Enseignement Supérieur",
  description: 'Gestion électronique des actes administratifs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
