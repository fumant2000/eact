'use client';

// MVVM — Vue : composants seulement, aucune logique métier.
import { AlertTriangle } from 'lucide-react';
import { StatutBadge } from '@/components/StatutBadge';
import fr from '@/i18n/fr.json';
import { useParapheurViewModel } from '../view-model/useParapheurViewModel';

export function ParapheurTable() {
  const vm = useParapheurViewModel();

  return (
    <section className="space-y-4">
      <header className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold text-primary-900 dark:text-foreground">{fr['parapheur.titre']}</h1>
        <p className="text-muted">{fr['parapheur.enAttente'].replace('{n}', String(vm.actes.length))}</p>
      </header>

      {vm.erreur && <p className="rounded-card bg-danger/10 p-3 text-danger">{vm.erreur}</p>}

      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {vm.isLoading && <li className="p-4 text-muted">Chargement…</li>}
        {vm.actes.map((acte) => (
          <li key={acte.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="reference rounded bg-primary-50 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-950 dark:text-primary-200">
              {acte.codeType}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{acte.objet}</span>
            <StatutBadge statut={acte.statut} />
            {vm.estEnRetard(acte) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                <AlertTriangle size={14} aria-hidden /> En retard
              </span>
            )}
            {/* Action principale toujours visible : viser en ≤ 3 clics (ENF-12) */}
            <button
              type="button"
              onClick={() => vm.viser(acte)}
              disabled={vm.visaEnCours}
              className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-600 disabled:opacity-50"
            >
              {fr['action.viser']}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
