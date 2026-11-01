import Link from 'next/link';
import type { ReactNode } from 'react';
import fr from '@/i18n/fr.json';

const MENU = [
  { href: '/parapheur', cle: 'menu.parapheur' },
  { href: '/actes', cle: 'menu.mesActes' },
  { href: '/courrier', cle: 'menu.courrier' },
  { href: '/recherche', cle: 'menu.recherche' },
  { href: '/archives', cle: 'menu.archives' },
  { href: '/tableau-de-bord', cle: 'menu.tableauDeBord' },
] as const;

/** Coquille de l'espace agent : en-tête primary-800, menu latéral (design-system §6). */
export default function EspaceAgent({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-4 bg-primary-800 px-4 text-white">
        <span className="font-semibold tracking-wide">EACT</span>
        <span className="text-sm text-primary-200">Ministère de l&apos;Enseignement Supérieur</span>
        <span className="ml-auto text-sm">FR | EN</span>
      </header>
      <div className="flex flex-1">
        <nav className="hidden w-56 border-r border-border bg-surface p-3 md:block">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="block rounded-control px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-950"
            >
              {fr[m.cle]}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
