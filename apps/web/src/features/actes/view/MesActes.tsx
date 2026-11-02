'use client';

// MVVM — Vue C1 « Mes actes ». Tableau en bureau, cartes sous 768 px (guide §4).
import { Plus, Search, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StatutBadge } from '@/components/StatutBadge';
import { Alert, classesBouton, Input } from '@/components/ui/primitives';
import { useT, type CleTraduction } from '@/i18n';
import type { GroupeStatut, LigneActe } from '../model/actes.api';
import { actionDe, useMesActesViewModel } from '../view-model/useMesActesViewModel';
import { CodeType } from './Document';

const ONGLETS: GroupeStatut[] = ['tous', 'brouillons', 'enCircuit', 'aCorriger', 'signes'];
const LIBELLES_ACTION = { reprendre: 'action.reprendre', corriger: 'action.corrigerActe', suivre: 'action.suivre', voir: 'action.voir' } as const;

function Position({ a }: { a: LigneActe }) {
  const { t } = useT();
  if (a.statut === 'BROUILLON') {
    return <>{a.champsManquants ? t('mesActes.champsManquants', { n: a.champsManquants }) : t('mesActes.enregistreAuto')}</>;
  }
  return <>{a.etapeCourante ?? '—'}</>;
}

function SousLigne({ a }: { a: LigneActe }) {
  const { t } = useT();
  return (
    <span className="reference block text-xs text-muted-foreground">
      {a.reference ?? (a.jamaisSoumis ? t('mesActes.jamaisSoumis') : t('mesActes.refALaSignature'))}
    </span>
  );
}

function BoutonAction({ a }: { a: LigneActe }) {
  const { t } = useT();
  const action = actionDe(a);
  return (
    <Link href={`/actes/${a.id}/edition`} className={classesBouton({ variant: action === 'corriger' ? 'default' : 'outline', size: 'sm' })}>
      {t(LIBELLES_ACTION[action])}
    </Link>
  );
}

export function MesActes() {
  const { t, langue } = useT();
  const vm = useMesActesViewModel();
  const soumis = useSearchParams().get('soumis') === '1';
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB');

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('mesActes.titre')}</h1>
          <p className="mt-1 text-muted-foreground">{t('mesActes.sousTitre')}</p>
        </div>
        <Link href="/actes/nouveau" className={classesBouton({ size: 'lg' })}>
          <Plus size={18} aria-hidden /> {t('menu.nouvelActe')}
        </Link>
      </header>

      {soumis && <Alert variant="success">{t('mesActes.soumis')}</Alert>}
      {vm.aCorriger.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f6d3ae] bg-[#fef3e7] p-4 text-[#9a4507]">
          <Undo2 size={18} aria-hidden />
          <p className="flex-1">
            <strong>{t('mesActes.bandeauCorriger', { n: vm.aCorriger.length })}</strong> · {vm.aCorriger[0].objet}
          </p>
          <Link href={`/actes/${vm.aCorriger[0].id}/edition`} className="font-semibold underline underline-offset-4">{t('action.corrigerActe')}</Link>
        </div>
      )}
      {vm.erreur && <Alert variant="destructive">{vm.erreur}</Alert>}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 pt-2">
          <div role="tablist" className="flex flex-1 gap-1 overflow-x-auto">
            {ONGLETS.map((o) => (
              <button
                key={o}
                role="tab"
                aria-selected={vm.onglet === o}
                onClick={() => vm.setOnglet(o)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 whitespace-nowrap ${vm.onglet === o ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t(`mesActes.onglet.${o}` as CleTraduction)}
                <span className={`rounded-full px-2 text-xs ${vm.onglet === o ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{vm.compteurs?.[o] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="relative my-2 w-full sm:w-72">
            <span className="sr-only">{t('mesActes.filtrer')}</span>
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={vm.filtre} onChange={(e) => vm.setFiltre(e.target.value)} placeholder={t('mesActes.filtrer')} className="pl-9" />
          </label>
        </div>

        {vm.chargement && <p className="p-6 text-muted-foreground">{t('commun.chargement')}</p>}
        {!vm.chargement && vm.actes.length === 0 && <p className="p-6 text-muted-foreground">{t('mesActes.vide')}</p>}

        {/* Bureau */}
        {vm.actes.length > 0 && (
          <table className="hidden w-full text-sm md:table">
            <thead className="text-left text-muted-foreground">
              <tr className="h-10 border-b border-border">
                <th className="px-4 font-medium">{t('mesActes.col.type')}</th>
                <th className="px-4 font-medium">{t('mesActes.col.objet')}</th>
                <th className="px-4 font-medium">{t('mesActes.col.statut')}</th>
                <th className="px-4 font-medium">{t('mesActes.col.position')}</th>
                <th className="px-4 font-medium">{t('mesActes.col.modifie')}</th>
                <th className="px-4 text-right font-medium">{t('mesActes.col.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vm.actes.map((a) => (
                <tr key={a.id} className="h-16">
                  <td className="px-4"><CodeType code={a.codeType} /></td>
                  <td className="max-w-md px-4 py-3">
                    <span className="block font-semibold">{a.objet || t('mesActes.sansObjet')}</span>
                    <SousLigne a={a} />
                  </td>
                  <td className="px-4"><StatutBadge statut={a.statut} /></td>
                  <td className="px-4 text-muted-foreground"><Position a={a} /></td>
                  <td className="px-4 tabular-nums">{date(a.misAJourLe)}</td>
                  <td className="px-4 text-right"><BoutonAction a={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Mobile */}
        <ul className="divide-y divide-border md:hidden">
          {vm.actes.map((a) => (
            <li key={a.id} className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <CodeType code={a.codeType} />
                <StatutBadge statut={a.statut} />
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{date(a.misAJourLe)}</span>
              </div>
              <p className="font-semibold">{a.objet || t('mesActes.sansObjet')}</p>
              <SousLigne a={a} />
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <Position a={a} />
                <BoutonAction a={a} />
              </div>
            </li>
          ))}
        </ul>
        {vm.actes.length > 0 && (
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{vm.actes.length} / {vm.total}</p>
        )}
      </div>
    </section>
  );
}
