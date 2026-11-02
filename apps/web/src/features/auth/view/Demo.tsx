'use client';

// Mode démonstration (DEMO_MODE=true côté API, jamais en production) : comptes en un clic et code TOTP affiché.
// Permet de présenter la double authentification et la signature sans téléphone.
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, FlaskConical, KeyRound, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cx } from '@/components/ui/primitives';
import { useT, type CleTraduction } from '@/i18n';
import { notifierErreur } from '@/lib/notifications';
import { authApi } from '../model/auth.api';

export function useModeDemo() {
  return useQuery({ queryKey: ['demo'], queryFn: authApi.demo, staleTime: 60_000, retry: false, meta: { silencieux: true } }).data;
}

/** Panneau de la page de connexion, replié par défaut pour ne pas écraser le formulaire :
 *  on déplie, on choisit un compte dans la liste, puis « Entrer » ou « Pré-remplir ». */
export function PanneauDemo({ remplir }: { remplir: (matricule: string, motDePasse: string) => void }) {
  const { t } = useT();
  const router = useRouter();
  const demo = useModeDemo();
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  if (!demo?.actif) return null;
  const compte = demo.comptes.find((c) => c.matricule === choisi) ?? null;

  async function entrer(matricule: string) {
    setEnCours(true);
    try {
      await authApi.connexionDemo(matricule);
      router.replace('/mon-travail');
      router.refresh();
    } catch (e) {
      notifierErreur(e);
      setEnCours(false);
    }
  }

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
          <p className="text-xs text-muted-foreground">{t('demo.aide', { mdp: demo.motDePasse })}</p>
          <ul role="listbox" aria-label={t('demo.choisir')} className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
            {demo.comptes.map((c) => {
              const actif = c.matricule === choisi;
              return (
                <li
                  key={c.matricule}
                  role="option"
                  aria-selected={actif}
                  tabIndex={0}
                  onClick={() => setChoisi(c.matricule)}
                  onDoubleClick={() => void entrer(c.matricule)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void entrer(c.matricule);
                    if (e.key === ' ') { e.preventDefault(); setChoisi(c.matricule); }
                  }}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                    actif ? 'bg-primary-50 dark:bg-accent' : 'hover:bg-accent',
                  )}
                >
                  <span className={cx('h-2 w-2 flex-none rounded-full', actif ? 'bg-primary' : 'bg-transparent')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{c.nom}</span>
                    <span className="text-xs text-muted-foreground"> · {c.roles.map((r) => t(`role.${r}` as CleTraduction)).join(', ')}</span>
                  </span>
                  {c.totp && <span className="rounded bg-[#fbf3e2] px-1.5 text-[11px] text-seal-700">2FA</span>}
                  {c.verrouille && <span className="rounded bg-[#fdecec] px-1.5 text-[11px] text-destructive">{t('demo.verrouille')}</span>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {compte ? `${compte.matricule} · ${compte.structure}` : t('demo.choisir')}
            </p>
            <Button size="sm" variant="outline" disabled={!compte} onClick={() => compte && remplir(compte.matricule, demo.motDePasse)}>
              <KeyRound size={14} aria-hidden /> {t('demo.remplir')}
            </Button>
            <Button size="sm" disabled={!compte || enCours} onClick={() => compte && void entrer(compte.matricule)}>
              <LogIn size={14} aria-hidden /> {t('demo.entrer')}
            </Button>
          </div>
        </div>
      )}
    </section>
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
