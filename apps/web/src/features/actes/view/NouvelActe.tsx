'use client';

// MVVM — Vues de l'assistant « Nouvel acte » : type d'acte, puis modèle et aperçu (UC-06).
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { Alert, Button } from '@/components/ui/primitives';
import { useT, type CleTraduction } from '@/i18n';
import { SANS_MODELE, useNouvelActeViewModel } from '../view-model/useNouvelActeViewModel';
import { CodeType, CorpsActe, EnTeteOfficiel, TitreActe } from './Document';

function Etapes({ courante, codeType }: { courante: 1 | 2; codeType?: string }) {
  const { t } = useT();
  const etapes = [t('nouvel.etapeType') + (courante > 1 && codeType ? ` · ${codeType}` : ''), t('nouvel.etapeModele'), t('nouvel.etapeRedaction')];
  return (
    <ol className="flex flex-wrap items-center gap-3" aria-label="Étapes">
      {etapes.map((libelle, i) => {
        const n = i + 1;
        const fait = n < courante;
        const actif = n === courante;
        return (
          <li key={libelle} className="flex items-center gap-3" aria-current={actif ? 'step' : undefined}>
            {i > 0 && <span className={`h-0.5 w-10 ${fait || actif ? 'bg-success' : 'bg-border'}`} aria-hidden />}
            <span
              className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${
                fait ? 'bg-success text-white' : actif ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'
              }`}
            >
              {fait ? <Check size={16} aria-hidden /> : n}
            </span>
            <span className={actif ? 'font-semibold text-primary' : fait ? 'text-success' : 'text-muted-foreground'}>{libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}

const carte = (choisie: boolean, desactivee = false) =>
  `flex w-full gap-4 rounded-lg border bg-card p-5 text-left transition ${
    desactivee ? 'cursor-not-allowed opacity-60' : 'hover:border-primary-300'
  } ${choisie ? 'border-primary ring-2 ring-primary-100 dark:ring-primary-900' : 'border-border'}`;

function Radio({ choisi }: { choisi: boolean }) {
  return (
    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${choisi ? 'border-primary' : 'border-input'}`} aria-hidden>
      {choisi && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  );
}

export function NouvelActe() {
  const { t, langue } = useT();
  const vm = useNouvelActeViewModel();
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB');

  if (vm.etape === 'type') {
    return (
      <section className="mx-auto max-w-6xl space-y-6">
        <Link href="/mes-actes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden /> {t('mesActes.titre')}
        </Link>
        <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('nouvel.titre')}</h1>
        <Etapes courante={1} />
        {vm.erreur && <Alert variant="destructive">{vm.erreur}</Alert>}
        <fieldset>
          <legend className="mb-4 text-lg font-semibold">{t('nouvel.question')}</legend>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vm.types.map((type) => {
              const desactive = type.nbEtapes === null;
              const choisi = vm.typeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  role="radio"
                  aria-checked={choisi}
                  aria-disabled={desactive}
                  disabled={desactive}
                  onClick={() => vm.choisirType(type.id)}
                  className={carte(choisi, desactive)}
                >
                  <Radio choisi={choisi} />
                  <span className="space-y-2">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <CodeType code={type.code} /> {type.libelle}
                    </span>
                    <span className="block text-muted-foreground">{t(`type.desc.${type.code}` as CleTraduction)}</span>
                    <span className="block text-sm">{t('nouvel.signataire', { s: type.signataire })}</span>
                    <span className="block text-sm">
                      {desactive ? <span className="text-warning">{t('nouvel.sansCircuit')}</span> : t('nouvel.circuit', { n: type.nbEtapes! })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Button variant="outline" size="lg" onClick={vm.annuler}>{t('commun.annuler')}</Button>
          <Button size="lg" disabled={!vm.typeId} onClick={vm.continuer}>
            {t('nouvel.continuer')} <ArrowRight size={18} aria-hidden />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <button onClick={vm.revenirAuType} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden /> {t('nouvel.etapeType')}
      </button>
      <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('nouvel.titreType', { type: vm.type?.libelle ?? '' })}</h1>
      <Etapes courante={2} codeType={vm.type?.code} />
      {vm.depuisCache && vm.synchroniseLe && <Alert>{t('nouvel.cache', { d: new Date(vm.synchroniseLe).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB') })}</Alert>}
      {vm.erreur && <Alert variant="destructive">{vm.erreur}</Alert>}

      <div className="grid gap-8 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="mb-3 text-lg font-semibold">{t('nouvel.choisirModele')}</legend>
          {[...vm.modeles.map((m) => ({ id: m.id, libelle: m.libelle, description: m.description, version: `v${m.version}`, maj: m.misAJourLe })), { id: SANS_MODELE, libelle: t('nouvel.sansModele'), description: t('nouvel.sansModeleDesc'), version: '', maj: null }].map(
            (m) => (
              <button key={m.id} type="button" role="radio" aria-checked={vm.modeleId === m.id} onClick={() => vm.choisirModele(m.id)} className={carte(vm.modeleId === m.id)}>
                <Radio choisi={vm.modeleId === m.id} />
                <span className="flex-1 space-y-1">
                  <span className="flex justify-between gap-2 font-semibold">
                    {m.libelle} <span className="reference text-sm font-normal text-muted-foreground">{m.version}</span>
                  </span>
                  <span className="block text-muted-foreground">{m.description}</span>
                  {m.maj && <span className="block text-sm">{t('nouvel.majLe', { d: date(m.maj) })}</span>}
                </span>
              </button>
            ),
          )}
        </fieldset>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('nouvel.apercu')}</h2>
          <div className="space-y-5 rounded-lg border border-border bg-white p-6 text-[#1a2033] shadow-sm">
            <EnTeteOfficiel chaine={vm.type?.structureChaine ?? []} />
            {vm.type && <TitreActe code={vm.type.code} numero="____" objet="portant [objet]" />}
            {vm.modele ? <CorpsActe html={vm.modele.contenu} /> : <div className="h-24 rounded bg-muted" aria-hidden />}
            {vm.modele && vm.modele.ampliationsDefaut.length > 0 && (
              <p className="font-serif text-sm">
                <span className="font-bold underline">{t('editeur.ampliations')}</span> {vm.modele.ampliationsDefaut.join(', ')}
              </p>
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('nouvel.prerempli')}</p>
        </div>
      </div>

      <div className="flex justify-between gap-3 border-t border-border pt-6">
        <Button variant="outline" size="lg" onClick={vm.revenirAuType}>{t('nouvel.retour')}</Button>
        <Button size="lg" onClick={vm.commencer} disabled={vm.creationEnCours}>
          {t('nouvel.commencer')} <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </section>
  );
}
