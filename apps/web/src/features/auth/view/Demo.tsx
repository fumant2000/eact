'use client';

// Mode démonstration (DEMO_MODE=true côté API, jamais en production) : comptes en un clic et code TOTP affiché.
// Permet de présenter la double authentification et la signature sans téléphone.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, FlaskConical, KeyRound, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialogue } from '@/components/ui/Dialogue';
import { Button, cx } from '@/components/ui/primitives';
import { useT, type CleTraduction } from '@/i18n';
import { notifierErreur } from '@/lib/notifications';
import { authApi } from '../model/auth.api';

export function useModeDemo() {
  return useQuery({ queryKey: ['demo'], queryFn: authApi.demo, staleTime: 60_000, retry: false, meta: { silencieux: true } }).data;
}

type CompteDemo = Extract<NonNullable<ReturnType<typeof useModeDemo>>, { actif: true }>['comptes'][number];

/** Ce que chaque compte fait dans le parcours de démonstration (son rôle métier, pas seulement son rôle technique). */
function useMission() {
  const { t } = useT();
  return (matricule: string) => {
    const cle = `demo.mission.${matricule}` as CleTraduction;
    const texte = t(cle);
    return texte === cle ? null : texte;
  };
}

/**
 * Liste de sélection des comptes de démonstration : un clic choisit, double-clic ou Entrée entre.
 * Utilisée sur la page de connexion et dans « Changer de compte ».
 */
function ListeComptes({ comptes, actuel, onEntrer, onRemplir, enCours }: {
  comptes: CompteDemo[];
  actuel?: string;
  onEntrer: (matricule: string) => void;
  onRemplir?: (matricule: string) => void;
  enCours: boolean;
}) {
  const { t } = useT();
  const mission = useMission();
  const [choisi, setChoisi] = useState<string | null>(null);
  const compte = comptes.find((c) => c.matricule === choisi) ?? null;
  return (
    <>
      <ul role="listbox" aria-label={t('demo.choisir')} className="max-h-72 overflow-y-auto rounded-md border border-border">
        {comptes.map((c) => {
          const estActuel = c.matricule === actuel;
          const actif = c.matricule === choisi;
          const texte = mission(c.matricule);
          return (
            <li
              key={c.matricule}
              role="option"
              aria-selected={actif}
              aria-disabled={estActuel}
              tabIndex={0}
              onClick={() => !estActuel && setChoisi(c.matricule)}
              onDoubleClick={() => !estActuel && onEntrer(c.matricule)}
              onKeyDown={(e) => {
                if (estActuel) return;
                if (e.key === 'Enter') onEntrer(c.matricule);
                if (e.key === ' ') {
                  e.preventDefault();
                  setChoisi(c.matricule);
                }
              }}
              className={cx(
                'flex gap-2 border-b border-border px-3 py-2 last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                estActuel ? 'cursor-default opacity-60' : 'cursor-pointer',
                actif ? 'bg-primary-50 dark:bg-accent' : !estActuel && 'hover:bg-accent',
              )}
            >
              <span className={cx('mt-1.5 h-2 w-2 flex-none rounded-full', actif ? 'bg-primary' : 'bg-transparent')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{c.nom}</span>
                  {c.totp && <span className="rounded bg-[#fbf3e2] px-1.5 text-[11px] text-seal-700">2FA</span>}
                  {c.verrouille && <span className="rounded bg-[#fdecec] px-1.5 text-[11px] text-destructive">{t('demo.verrouille')}</span>}
                  {estActuel && <span className="text-[11px] text-muted-foreground">{t('demo.compteActuel')}</span>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {c.roles.map((r) => t(`role.${r}` as CleTraduction)).join(', ')} · {c.structure}
                </span>
                {texte && <span className="mt-0.5 block text-xs text-foreground/80">{texte}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{compte ? compte.matricule : t('demo.choisir')}</p>
        {onRemplir && (
          <Button size="sm" variant="outline" disabled={!compte} onClick={() => compte && onRemplir(compte.matricule)}>
            <KeyRound size={14} aria-hidden /> {t('demo.remplir')}
          </Button>
        )}
        <Button size="sm" disabled={!compte || enCours} onClick={() => compte && onEntrer(compte.matricule)}>
          <LogIn size={14} aria-hidden /> {t('demo.entrer')}
        </Button>
      </div>
    </>
  );
}

/** « Qui fait quoi ? » : les circuits de démonstration, de la rédaction à la signature. */
function QuiFaitQuoi() {
  const { t } = useT();
  return (
    <details className="mt-3 rounded-md border border-border px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-primary-900 dark:text-foreground">{t('demo.quiFaitQuoi')}</summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
        <li>{t('demo.parcours.ns')}</li>
        <li>{t('demo.parcours.d')}</li>
        <li>{t('demo.parcours.att')}</li>
      </ol>
      <p className="mt-2 text-muted-foreground">{t('demo.parcours.ou')}</p>
      <p className="mt-1 text-muted-foreground">{t('demo.parcours.chef')}</p>
      <p className="mt-1 text-muted-foreground">{t('demo.parcours.apres')}</p>
    </details>
  );
}

/** Connexion de démonstration : remplace la session courante, sans mot de passe ni code. */
function useEntrerDemo() {
  const router = useRouter();
  const client = useQueryClient();
  const [enCours, setEnCours] = useState(false);
  async function entrer(matricule: string, quitterAvant = false) {
    setEnCours(true);
    try {
      if (quitterAvant) await authApi.deconnecter().catch(() => undefined);
      await authApi.connexionDemo(matricule);
      client.clear();
      router.replace('/mon-travail');
      router.refresh();
    } catch (e) {
      notifierErreur(e);
    } finally {
      setEnCours(false);
    }
  }
  return { entrer, enCours };
}

/** Panneau de la page de connexion, replié par défaut pour ne pas écraser le formulaire. */
export function PanneauDemo({ remplir }: { remplir: (matricule: string, motDePasse: string) => void }) {
  const { t } = useT();
  const demo = useModeDemo();
  const [ouvert, setOuvert] = useState(false);
  const { entrer, enCours } = useEntrerDemo();
  if (!demo?.actif) return null;

  return (
    <section className="mt-4 rounded-lg border border-dashed border-primary-300 bg-card text-sm">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls="liste-demo"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      >
        <FlaskConical size={16} className="text-primary" aria-hidden />
        <span className="font-medium text-primary-900 dark:text-foreground">{t('demo.titre')}</span>
        <span className="text-muted-foreground">· {t('demo.nbComptes', { n: demo.comptes.length })}</span>
        <ChevronDown size={16} aria-hidden className={cx('ml-auto text-muted-foreground transition-transform', ouvert && 'rotate-180')} />
      </button>
      {ouvert && (
        <div id="liste-demo" className="border-t border-dashed border-primary-300 p-3">
          <p className="mb-2 text-xs text-muted-foreground">{t('demo.aide', { mdp: demo.motDePasse })}</p>
          <ListeComptes comptes={demo.comptes} enCours={enCours} onEntrer={(m) => void entrer(m)} onRemplir={(m) => remplir(m, demo.motDePasse)} />
          <QuiFaitQuoi />
        </div>
      )}
    </section>
  );
}

/** Mode démonstration, menu du profil : passer d'un acteur du circuit à l'autre sans repasser par la connexion. */
export function DialogueChangerCompte({ ouvert, onFermer, actuel }: { ouvert: boolean; onFermer: () => void; actuel: string }) {
  const { t } = useT();
  const demo = useModeDemo();
  const { entrer, enCours } = useEntrerDemo();
  if (!demo?.actif) return null;
  return (
    <Dialogue ouvert={ouvert} onFermer={onFermer} titre={t('demo.changerCompte')} bloquant={enCours}>
      <p className="mb-3 text-sm text-muted-foreground">{t('demo.changerAide')}</p>
      <ListeComptes
        comptes={demo.comptes}
        actuel={actuel}
        enCours={enCours}
        onEntrer={(m) => void entrer(m, true).then(onFermer)}
      />
      <QuiFaitQuoi />
    </Dialogue>
  );
}

/** Code TOTP courant affiché sous le champ de saisie (B2, B3, E3). */
export function CodeDemo({ source, onUtiliser }: { source: 'mfa' | 'session'; onUtiliser: (code: string) => void }) {
  const { t } = useT();
  const demo = useModeDemo();
  const { data } = useQuery({
    queryKey: ['demo-code', source],
    queryFn: source === 'mfa' ? authApi.codeDemoMfa : authApi.codeDemo,
    enabled: !!demo?.actif,
    refetchInterval: 5000,
    retry: false,
    meta: { silencieux: true },
  });
  if (!demo?.actif || !data) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-3 rounded-md border border-dashed border-primary-300 bg-accent p-3 text-sm')}>
      <FlaskConical size={16} className="text-primary" aria-hidden />
      <span>
        {t('demo.code')} <strong className="reference text-base tracking-widest">{data.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</strong>
        <span className="text-muted-foreground"> · {t('demo.valable', { s: data.valableEncore })}</span>
      </span>
      <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onUtiliser(data.code)}>{t('demo.utiliser')}</Button>
    </div>
  );
}
