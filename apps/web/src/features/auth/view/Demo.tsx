'use client';

// Mode démonstration (DEMO_MODE=true côté API, jamais en production) : comptes en un clic et code TOTP affiché.
// Permet de présenter la double authentification et la signature sans téléphone.
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, KeyRound, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cx } from '@/components/ui/primitives';
import { useT, type CleTraduction } from '@/i18n';
import { notifierErreur } from '@/lib/notifications';
import { authApi } from '../model/auth.api';

export function useModeDemo() {
  return useQuery({ queryKey: ['demo'], queryFn: authApi.demo, staleTime: 60_000, retry: false, meta: { silencieux: true } }).data;
}

/** Panneau de la page de connexion : chaque compte en un clic, ou pré-rempli pour montrer le parcours normal. */
export function PanneauDemo({ remplir }: { remplir: (matricule: string, motDePasse: string) => void }) {
  const { t } = useT();
  const router = useRouter();
  const demo = useModeDemo();
  const [enCours, setEnCours] = useState<string | null>(null);
  if (!demo?.actif) return null;

  async function entrer(matricule: string) {
    setEnCours(matricule);
    try {
      await authApi.connexionDemo(matricule);
      router.replace('/mon-travail');
      router.refresh();
    } catch (e) {
      notifierErreur(e);
      setEnCours(null);
    }
  }

  return (
    <section className="mt-4 rounded-lg border-2 border-dashed border-primary-300 bg-card p-4" aria-labelledby="titre-demo">
      <h2 id="titre-demo" className="flex items-center gap-2 font-semibold text-primary-900 dark:text-foreground">
        <FlaskConical size={18} aria-hidden /> {t('demo.titre')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('demo.aide', { mdp: demo.motDePasse })}</p>
      <ul className="mt-3 divide-y divide-border">
        {demo.comptes.map((c) => (
          <li key={c.matricule} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {c.nom}
                {c.totp && <span className="ml-2 rounded bg-[#fbf3e2] px-1.5 py-0.5 text-[11px] text-seal-700">2FA</span>}
                {c.verrouille && <span className="ml-2 rounded bg-[#fdecec] px-1.5 py-0.5 text-[11px] text-destructive">{t('demo.verrouille')}</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {c.roles.map((r) => t(`role.${r}` as CleTraduction)).join(', ')} · {c.structure}
              </p>
            </div>
            <Button size="sm" variant="ghost" title={t('demo.remplir')} aria-label={`${t('demo.remplir')} : ${c.nom}`} onClick={() => remplir(c.matricule, demo.motDePasse)}>
              <KeyRound size={16} aria-hidden />
            </Button>
            <Button size="sm" onClick={() => void entrer(c.matricule)} disabled={!!enCours}>
              <LogIn size={16} aria-hidden /> {t('demo.entrer')}
            </Button>
          </li>
        ))}
      </ul>
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
