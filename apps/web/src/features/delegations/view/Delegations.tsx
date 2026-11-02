'use client';

// MVVM — Vues F1 « Délégations » et F2 « Déclarer une délégation » (BF-09, BF-10).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, Clock, Plus, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { Dialogue } from '@/components/ui/Dialogue';
import { Alert, Button, classesBouton, cx, Input, Label } from '@/components/ui/primitives';
import { CodeDemo } from '@/features/auth/view/Demo';
import { SaisieCode } from '@/features/auth/view/SaisieCode';
import { useT, type CleTraduction } from '@/i18n';
import { ErreurApi } from '@/lib/api';
import { notifierErreur, notifierSucces } from '@/lib/notifications';
import { delegationsApi, type Delegation, type EtatDelegation, type TypeDelegation } from '../model/delegations.api';

const date = (iso: string, langue: string) => new Date(iso).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala' });
const initiales = (nom: string) => nom.split(' ').map((m) => m[0]).join('').slice(0, 2).toUpperCase();

function BadgeEtat({ etat }: { etat: EtatDelegation }) {
  const { t } = useT();
  const styles: Record<EtatDelegation, [string, ReactNode]> = {
    ACTIVE: ['border-[#b5dfc8] bg-[#e3f4ec] text-[#0b6447]', <Check key="a" size={14} aria-hidden />],
    A_VENIR: ['border-primary-200 bg-primary-50 text-primary-700', <Clock key="b" size={14} aria-hidden />],
    EXPIREE: ['border-border bg-muted text-muted-foreground', <Ban key="c" size={14} aria-hidden />],
    REVOQUEE: ['border-[#f5c2c4] bg-[#fdecec] text-[#a81f26]', <Ban key="d" size={14} aria-hidden />],
  };
  const [classe, icone] = styles[etat];
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium', classe)}>{icone} {t(`deleg.etat.${etat}`)}</span>;
}

function CarteDelegation({ d, onRevoquer }: { d: Delegation; onRevoquer: (d: Delegation) => void }) {
  const { t, langue } = useT();
  const personne = d.sens === 'ACCORDEE' ? d.delegataire : d.delegant;
  const inactive = d.etat === 'EXPIREE' || d.etat === 'REVOQUEE';
  return (
    <article className={cx('space-y-4 rounded-lg border border-border bg-card p-5', inactive && 'opacity-75')}>
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-50 font-semibold text-primary-700" aria-hidden>{initiales(personne.nom)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{d.sens === 'RECUE' ? t('deleg.de', { nom: personne.nom }) : personne.nom}</p>
          <p className="text-sm text-muted-foreground">{personne.structure}</p>
        </div>
        <BadgeEtat etat={d.etat} />
      </header>
      <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{t('deleg.nature')}</dt>
        <dd>{t(`deleg.type.${d.type}`)}</dd>
        <dt className="text-muted-foreground">{t('deleg.mention')}</dt>
        <dd className="italic">« {d.mention} »</dd>
        <dt className="text-muted-foreground">{t('deleg.periode')}</dt>
        <dd>{t('deleg.periodeValeur', { du: date(d.debut, langue), au: date(d.fin, langue) })}</dd>
        <dt className="text-muted-foreground">{t('deleg.actes')}</dt>
        <dd>{d.perimetre.length ? d.perimetre.join(', ') : t('deleg.tousActes')}</dd>
      </dl>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
        <span>
          {d.etat === 'A_VENIR'
            ? t('deleg.prendraEffet', { d: date(d.debut, langue) })
            : d.etat === 'EXPIREE'
              ? t('deleg.desactivee', { d: date(d.fin, langue) })
              : t('deleg.actesSignes', { n: d.actesSignes })}
        </span>
        {d.sens === 'ACCORDEE' && !inactive && (
          <Button variant="outline-destructive" size="sm" onClick={() => onRevoquer(d)}>{t('deleg.revoquer')}</Button>
        )}
      </footer>
    </article>
  );
}

/** F1 */
export function ListeDelegations() {
  const { t } = useT();
  const client = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['delegations'], queryFn: delegationsApi.lister });
  const [aRevoquer, setARevoquer] = useState<Delegation | null>(null);
  const revocation = useMutation({
    mutationFn: (id: string) => delegationsApi.revoquer(id),
    onSuccess: async () => {
      notifierSucces('deleg.revoquee');
      setARevoquer(null);
      await client.invalidateQueries({ queryKey: ['delegations'] });
      await client.invalidateQueries({ queryKey: ['session'] });
    },
  });
  const accordees = data.filter((d) => d.sens === 'ACCORDEE');
  const recues = data.filter((d) => d.sens === 'RECUE');

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('deleg.titre')}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{t('deleg.sousTitre')}</p>
        </div>
        <Link href="/delegations/nouvelle" className={classesBouton({ size: 'lg' })}><Plus size={18} aria-hidden /> {t('deleg.declarer')}</Link>
      </header>
      {isLoading && <p className="text-muted-foreground">{t('commun.chargement')}</p>}
      {!isLoading && data.length === 0 && <p className="text-muted-foreground">{t('deleg.vide')}</p>}
      {[
        [t('deleg.accordees'), accordees],
        [t('deleg.recues'), recues],
      ].map(([titre, liste]) =>
        (liste as Delegation[]).length ? (
          <div key={titre as string} className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">{titre as string}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {(liste as Delegation[]).map((d) => <CarteDelegation key={d.id} d={d} onRevoquer={setARevoquer} />)}
            </div>
          </div>
        ) : null,
      )}
      <Dialogue ouvert={!!aRevoquer} onFermer={() => setARevoquer(null)} titre={t('deleg.revoquerTitre')} alerte>
        <p className="text-muted-foreground">{t('deleg.revoquerTexte', { nom: aRevoquer?.delegataire.nom ?? '' })}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setARevoquer(null)} autoFocus>{t('commun.annuler')}</Button>
          <Button variant="destructive" disabled={revocation.isPending} onClick={() => aRevoquer && revocation.mutate(aRevoquer.id)}>{t('deleg.revoquer')}</Button>
        </div>
      </Dialogue>
    </section>
  );
}

const aujourdhui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Douala' }); // AAAA-MM-JJ
const dansJours = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Africa/Douala' });

/** F2 */
export function DeclarerDelegation() {
  const { t, langue } = useT();
  const router = useRouter();
  const client = useQueryClient();
  const { data: c } = useQuery({ queryKey: ['delegations-candidats'], queryFn: delegationsApi.candidats });
  const [delegataireId, setDelegataireId] = useState('');
  const [type, setType] = useState<TypeDelegation | null>(null);
  const [du, setDu] = useState(aujourdhui());
  const [au, setAu] = useState(dansJours(28));
  const [baseMention, setBaseMention] = useState('Pour le Ministre et par délégation');
  const [mentionLibre, setMentionLibre] = useState('');
  const [perimetre, setPerimetre] = useState<string[]>(['D', 'NS', 'ATT']);
  const [codeOuvert, setCodeOuvert] = useState(false);
  const [code, setCode] = useState('');
  const [erreurCode, setErreurCode] = useState<number | undefined | null>(null);

  const typeEffectif: TypeDelegation = type ?? (c?.peutDeleguerSignature ? 'SIGNATURE' : 'INTERIM');
  const personne = c?.personnes.find((p) => p.id === delegataireId);
  // Mention imprimée : « Pour le Ministre et par délégation, Le Secrétaire Général » (annexe A)
  const qualite = personne?.roles.includes('SECRETAIRE_GENERAL') ? 'Le Secrétaire Général' : (personne?.nom ?? '…');
  const mention = baseMention === 'autre' ? mentionLibre.trim() : `${baseMention}, ${qualite}`;
  const valide = !!delegataireId && du <= au && mention.length >= 3 && (typeEffectif === 'INTERIM' || perimetre.length > 0);
  const avecCode = typeEffectif === 'SIGNATURE' || !!c?.peutDeleguerSignature;
  const fmt = (j: string) => new Date(`${j}T12:00:00`).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit' });

  const declaration = useMutation({
    mutationFn: () => delegationsApi.declarer({ delegataireId, type: typeEffectif, du, au, mention, perimetre: typeEffectif === 'INTERIM' ? [] : perimetre, code: code || undefined }),
    meta: { silencieux: true },
    onSuccess: async () => {
      notifierSucces('deleg.creee');
      await client.invalidateQueries({ queryKey: ['delegations'] });
      router.push('/delegations');
    },
    onError: (e) => {
      if (e instanceof ErreurApi && e.code === 'CODE_INVALIDE') {
        setErreurCode((e.details.essaisRestants as number | undefined) ?? undefined);
        setCode('');
      } else {
        setCodeOuvert(false);
        notifierErreur(e);
      }
    },
  });
  const choixTypes = useMemo(() => (c?.peutDeleguerSignature ? (['SIGNATURE', 'INTERIM'] as const) : (['INTERIM'] as const)), [c]);

  return (
    <section className="space-y-6">
      <Link href="/delegations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} aria-hidden /> {t('deleg.titre')}</Link>
      <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('deleg.declarer')}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form
          className="space-y-6 rounded-lg border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valide) return;
            if (avecCode) {
              setErreurCode(null);
              setCodeOuvert(true);
            } else declaration.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="delegataire">{t('deleg.delegataire')} <span className="text-destructive" aria-hidden>*</span></Label>
            <select id="delegataire" required value={delegataireId} onChange={(e) => setDelegataireId(e.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-3">
              <option value="">{t('deleg.choisir')}</option>
              {c?.personnes.map((p) => (
                <option key={p.id} value={p.id}>{p.nom} · {p.roles.map((r) => t(`role.${r}` as CleTraduction)).join(', ')} · {p.structure}</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t('deleg.nature')} <span className="text-destructive" aria-hidden>*</span></legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {choixTypes.map((ty) => (
                <label key={ty} className={cx('flex cursor-pointer gap-3 rounded-lg border p-4', typeEffectif === ty ? 'border-primary bg-accent' : 'border-border')}>
                  <input type="radio" name="type" checked={typeEffectif === ty} onChange={() => setType(ty)} className="mt-1 size-4 accent-primary" />
                  <span>
                    <span className="block font-semibold">{t(`deleg.type.${ty}`)}</span>
                    <span className="block text-sm text-muted-foreground">{t(`deleg.typeAide.${ty}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="du">{t('deleg.du')} <span className="text-destructive" aria-hidden>*</span></Label>
              <Input id="du" type="date" required value={du} min={aujourdhui()} onChange={(e) => setDu(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="au">{t('deleg.au')} <span className="text-destructive" aria-hidden>*</span></Label>
              <Input id="au" type="date" required value={au} min={du} onChange={(e) => setAu(e.target.value)} invalide={au < du} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mention">{t('deleg.mentionPortee')} <span className="text-destructive" aria-hidden>*</span></Label>
            <select id="mention" value={baseMention} onChange={(e) => setBaseMention(e.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-3">
              <option>Pour le Ministre et par délégation</option>
              <option>P.O. le Ministre</option>
              <option value="autre">{t('deleg.mentionAutre')}</option>
            </select>
            {baseMention === 'autre' && <Input aria-label={t('deleg.mentionPortee')} value={mentionLibre} maxLength={200} onChange={(e) => setMentionLibre(e.target.value)} />}
          </div>
          {typeEffectif === 'SIGNATURE' && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t('deleg.actesCouverts')} <span className="text-destructive" aria-hidden>*</span></legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {c?.types.map((ty) => (
                  <label key={ty.code} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={perimetre.includes(ty.code)}
                      onChange={(e) => setPerimetre((p) => (e.target.checked ? [...p, ty.code] : p.filter((x) => x !== ty.code)))}
                    />
                    {ty.libelle} ({ty.code})
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Link href="/delegations" className={classesBouton({ variant: 'outline', size: 'lg' })}>{t('commun.annuler')}</Link>
            <Button type="submit" size="lg" disabled={!valide || declaration.isPending}>
              {avecCode && <Smartphone size={18} aria-hidden />} {avecCode ? t('deleg.confirmerCode') : t('deleg.confirmer')}
            </Button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">{t('deleg.apercu')}</h2>
            <div className="space-y-2 rounded-md border border-border bg-white p-4 text-center font-serif text-[#1a2033]">
              <p className="font-semibold">{mention || '…'}</p>
              <p className="font-sans text-xs font-semibold tracking-wide text-seal-700">{t('deleg.signeElectroniquement')} · {personne?.nom ?? '…'}</p>
            </div>
          </section>
          <section className="space-y-2 rounded-lg border border-border bg-card p-5 text-sm">
            <h2 className="font-semibold">{t('deleg.bonASavoir')}</h2>
            <p>{t('deleg.info1', { du: fmt(du), au: fmt(au) })}</p>
            <p>{t('deleg.info2')}</p>
            <p>{t('deleg.info3')}</p>
          </section>
        </aside>
      </div>

      <Dialogue ouvert={codeOuvert} onFermer={() => setCodeOuvert(false)} titre={t('deleg.codeTitre')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) declaration.mutate();
          }}
        >
          <p className="text-muted-foreground">{t('deleg.codeTexte')}</p>
          <SaisieCode valeur={code} onChange={setCode} invalide={erreurCode !== null} autoFocus />
          {erreurCode !== null && (
            <Alert variant="destructive">{t('mfa.invalide')} {erreurCode !== undefined && t('mfa.essais', { n: erreurCode })}</Alert>
          )}
          <CodeDemo source="session" onUtiliser={setCode} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCodeOuvert(false)}>{t('commun.annuler')}</Button>
            <Button type="submit" disabled={code.length !== 6 || declaration.isPending}>{t('deleg.confirmer')}</Button>
          </div>
        </form>
      </Dialogue>
    </section>
  );
}
