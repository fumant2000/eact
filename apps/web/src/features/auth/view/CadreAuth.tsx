'use client';

// Gabarit commun des écrans B1–B5 : panneau institutionnel à gauche (masqué sous 1024 px), carte à droite.
import { FileText, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { SelecteurLangue } from '@/components/SelecteurLangue';
import { useT } from '@/i18n';

export function Logo({ clair = false }: { clair?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={`grid size-10 place-items-center rounded-lg text-lg font-bold ${clair ? 'bg-white text-primary-800' : 'bg-primary text-primary-foreground'}`}
        aria-hidden
      >
        E
      </span>
      <span className={`text-xl font-bold tracking-[0.12em] ${clair ? 'text-white' : 'text-primary-900 dark:text-foreground'}`}>EACT</span>
    </span>
  );
}

export function CadreAuth({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-primary-800 p-12 text-white lg:flex"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        <Logo clair />
        <div className="max-w-lg space-y-4">
          <p className="text-sm font-semibold tracking-wide">{t('commun.republique')}</p>
          <p className="-mt-3 text-sm text-primary-200">{t('commun.devise')}</p>
          <h1 className="text-4xl leading-tight font-bold xl:text-5xl">{t('auth.accroche')}</h1>
          <p className="text-lg text-primary-100">{t('auth.sousAccroche')}</p>
        </div>
        <p className="flex gap-6 text-sm text-primary-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden /> {t('auth.connexionChiffree')}</span>
          <span className="flex items-center gap-2"><FileText size={16} aria-hidden /> {t('auth.journalise')}</span>
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center gap-4 px-4 py-10">
        <div className="flex w-full max-w-md items-center justify-between">
          <span className="lg:hidden"><Logo /></span>
          <span className="ml-auto"><SelecteurLangue /></span>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <footer className="flex w-full max-w-md flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>EACT v0.1.0</span>
          <span className="flex gap-4">
            <span>{t('commun.verifierActe')}</span>
            <span>{t('commun.protectionDonnees')}</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
