'use client';

// MVVM — Vue D1 « Parapheur » : viser en 3 clics depuis la ligne (Viser → Confirmer → toast « Annuler »).
import { Check, ChevronRight, Lock, Search } from 'lucide-react';
import Link from 'next/link';
import { StatutBadge } from '@/components/StatutBadge';
import { Button, classesBouton, cx, Input } from '@/components/ui/primitives';
import { CodeType } from '@/features/actes/view/Document';
import { useT, type CleTraduction } from '@/i18n';
import { useParapheurViewModel, type FiltreParapheur } from '../view-model/useParapheurViewModel';
import { BadgeEcheance, DialogueVisa } from './Decisions';

const FILTRES: { cle: FiltreParapheur; libelle: CleTraduction; ton: string }[] = [
  { cle: 'tous', libelle: 'parapheur.filtre.tous', ton: '' },
  { cle: 'retard', libelle: 'parapheur.filtre.retard', ton: 'text-destructive border-[#f5c2c4]' },
  { cle: '24h', libelle: 'parapheur.filtre.24h', ton: 'text-warning border-[#f6d3ae]' },
  { cle: 'confidentiels', libelle: 'parapheur.filtre.confidentiels', ton: '' },
];

export function ParapheurTable() {
  const { t, langue } = useT();
  const vm = useParapheurViewModel();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB') : '—');

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('menu.parapheur')}</h1>
          <p className="mt-1 text-muted-foreground">{t('parapheur.sousTitre', { n: vm.total })}</p>
        </div>
        <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
          {(['aViser', 'recents'] as const).map((o) => (
            <button key={o} role="tab" aria-selected={vm.onglet === o} onClick={() => vm.setOnglet(o)} className={cx('rounded-md px-4 py-2', vm.onglet === o ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground')}>
              {t(`parapheur.onglet.${o}`)}{o === 'aViser' ? ` · ${vm.total}` : ''}
            </button>
          ))}
        </div>
      </header>

      {vm.onglet === 'aViser' ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('parapheur.filtre.tous')}>
            {FILTRES.map((f) => (
              <button
                key={f.cle}
                aria-pressed={vm.filtre === f.cle}
                onClick={() => vm.setFiltre(f.cle)}
                className={cx('rounded-full border px-4 py-1.5 text-sm font-medium', vm.filtre === f.cle ? 'border-primary bg-primary text-primary-foreground' : cx('border-border bg-card', f.ton))}
              >
                {t(f.libelle)} · {vm.compter(f.cle)}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap gap-3 border-b border-border p-4">
              <label className="relative min-w-60 flex-1">
                <span className="sr-only">{t('parapheur.filtrer')}</span>
                <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={vm.texte} onChange={(e) => vm.setTexte(e.target.value)} placeholder={t('parapheur.filtrer')} className="pl-9" />
              </label>
              <select aria-label={t('parapheur.tousTypes')} value={vm.type} onChange={(e) => vm.setType(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3">
                <option value="">{t('parapheur.tousTypes')}</option>
                {vm.types.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {vm.chargement && <p className="p-6 text-muted-foreground">{t('commun.chargement')}</p>}
            {!vm.chargement && vm.actes.length === 0 && <p className="p-6 text-muted-foreground">{t('parapheur.vide')}</p>}

            <ul className="divide-y divide-border">
              {vm.actes.map((a) => (
                <li key={a.id} className="grid items-center gap-3 p-4 md:grid-cols-[60px_1fr_180px_110px_150px_auto]">
                  <span><CodeType code={a.codeType} /></span>
                  <div className="min-w-0">
                    <Link href={`/actes/${a.id}`} className="font-semibold hover:underline">{a.objet}</Link>
                    {a.confidentialite === 'CONFIDENTIEL' && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"><Lock size={12} aria-hidden /> {t('confidentiel')}</span>
                    )}
                    <p className="text-sm text-muted-foreground">{a.redacteur} · {a.structureRedacteur}</p>
                  </div>
                  <span className="text-sm">{a.etape.libelle}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{date(a.recuLe)}</span>
                  <span><BadgeEcheance echeance={a.echeance} /></span>
                  <span className="flex justify-end gap-2">
                    <Button onClick={() => vm.demanderVisa(a)} disabled={a.piecesEnAnalyse} title={a.piecesEnAnalyse ? t('fiche.piecesEnAnalyse') : undefined}>
                      <Check size={18} aria-hidden /> {t('visa.viser')}
                    </Button>
                    <Link href={`/actes/${a.id}`} aria-label={t('parapheur.examiner', { objet: a.objet })} className={classesBouton({ variant: 'outline', className: 'w-10 px-0' })}>
                      <ChevronRight size={18} />
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {vm.recents.length === 0 && <li className="p-6 text-muted-foreground">{t('parapheur.vide')}</li>}
          {vm.recents.map((r) => (
            <li key={`${r.id}-${r.le}`} className="flex flex-wrap items-center gap-3 p-4">
              <CodeType code={r.codeType} />
              <Link href={`/actes/${r.id}`} className="min-w-0 flex-1 font-semibold hover:underline">{r.objet}</Link>
              <span className="text-sm text-muted-foreground">{r.etape} · {t(`parapheur.decision.${r.decision}`)} · {date(r.le)}</span>
              <StatutBadge statut={r.statut} />
            </li>
          ))}
        </ul>
      )}

      <DialogueVisa
        ouvert={!!vm.aConfirmer}
        objet={vm.aConfirmer?.objet ?? ''}
        etapeSuivante={vm.aConfirmer?.etapeSuivante ?? null}
        onAnnuler={vm.annulerConfirmation}
        onConfirmer={vm.confirmerVisa}
      />
    </section>
  );
}
