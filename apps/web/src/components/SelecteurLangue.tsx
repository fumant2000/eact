'use client';

import { useT, type Langue } from '@/i18n';

/** Segment FR | EN (ENF-12) ; variante sombre pour l'en-tête bleu. */
export function SelecteurLangue({ sombre = false }: { sombre?: boolean }) {
  const { langue, changerLangue } = useT();
  return (
    <div
      role="group"
      aria-label="Langue / Language"
      className={`inline-flex rounded-md p-0.5 ${sombre ? 'border border-white/20 bg-white/5' : 'bg-muted'}`}
    >
      {(['FR', 'EN'] as Langue[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={langue === l}
          onClick={() => changerLangue(l)}
          className={`rounded px-3 py-1 text-sm font-semibold ${
            langue === l
              ? sombre ? 'bg-white text-primary-800' : 'bg-card text-primary-800 shadow-sm dark:text-foreground'
              : sombre ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
