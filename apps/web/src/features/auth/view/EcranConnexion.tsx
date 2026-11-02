'use client';

// MVVM — Vue : maquettes B1 (connexion), B2 (second facteur), B3 (enrôlement), B4 (verrouillage).
import { Copy, Download, Eye, EyeOff, Lock, LogIn, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Input, Label } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { useConnexionViewModel } from '../view-model/useConnexionViewModel';
import { CadreAuth } from './CadreAuth';
import { SaisieCode } from './SaisieCode';

// Comptes du seed (apps/api/prisma/seed.ts) — affichés uniquement en développement, pour les démonstrations.
const COMPTES_DEMO = [
  ['MINESUP-04812', 'Christelle EBOGO', 'Rédactrice · SP'],
  ['MINESUP-02845', 'Marie BELINGA', 'Chef de service · SP'],
  ['MINESUP-03107', 'Abdou NJOYA', 'Directeur · DAG'],
  ['MINESUP-00017', 'Ibrahim BELLO', 'Secrétaire Général · TOTP'],
  ['MINESUP-00001', 'Roger ESSOMBA', 'Ministre · TOTP'],
  ['MINESUP-02019', 'Hervé TCHAMBA', 'Administrateur · enrôlement TOTP'],
  ['MINESUP-07341', 'Aïcha MOUSSA', 'Auditrice · IGS'],
] as const;

function IconeTitre({ children, ton = 'primaire' }: { children: React.ReactNode; ton?: 'primaire' | 'danger' }) {
  return (
    <span className={`grid size-12 place-items-center rounded-lg ${ton === 'danger' ? 'bg-[#fdecec] text-destructive' : 'bg-accent text-primary'}`}>
      {children}
    </span>
  );
}

export function EcranConnexion() {
  const { t } = useT();
  const vm = useConnexionViewModel();
  const sessionExpiree = useSearchParams().get('session') === 'expiree';

  return (
    <CadreAuth>
      {vm.ecran === 'identifiants' && <FormulaireIdentifiants vm={vm} sessionExpiree={sessionExpiree} />}
      {vm.ecran === 'mfa' && <FormulaireCode vm={vm} />}
      {vm.ecran === 'enrolement' && <Enrolement vm={vm} />}
      {vm.ecran === 'codesSecours' && <CodesSecours vm={vm} />}
      {vm.ecran === 'verrouille' && <CompteVerrouille vm={vm} />}
      {vm.ecran === 'identifiants' && process.env.NODE_ENV === 'development' && <ComptesDemo t={t} />}
    </CadreAuth>
  );
}

type VM = ReturnType<typeof useConnexionViewModel>;

function FormulaireIdentifiants({ vm, sessionExpiree }: { vm: VM; sessionExpiree: boolean }) {
  const { t } = useT();
  const [voir, setVoir] = useState(false);
  const soumettre = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    vm.connecter(String(f.get('identifiant')), String(f.get('motDePasse')));
  };
  const enErreur = vm.erreur?.code === 'IDENTIFIANTS_INCORRECTS';

  return (
    <Card>
      <h2 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('auth.titre')}</h2>
      <p className="mt-2 text-muted-foreground">{t('auth.sousTitre')}</p>
      <form onSubmit={soumettre} className="mt-6 space-y-5" noValidate>
        {sessionExpiree && !vm.erreur && <Alert variant="warning">{t('auth.sessionExpiree')}</Alert>}
        <div className="space-y-2">
          <Label htmlFor="identifiant">{t('auth.identifiant')}</Label>
          <Input id="identifiant" name="identifiant" autoComplete="username" required autoFocus invalide={enErreur} aria-describedby="erreur-connexion" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="motDePasse">{t('auth.motDePasse')}</Label>
            <Link href="/mot-de-passe" className="text-sm text-primary underline underline-offset-4">{t('auth.oublie')}</Link>
          </div>
          <div className="relative">
            <Input
              id="motDePasse"
              name="motDePasse"
              type={voir ? 'text' : 'password'}
              autoComplete="current-password"
              required
              invalide={enErreur}
              aria-describedby="erreur-connexion"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVoir(!voir)}
              aria-label={t('auth.afficher')}
              aria-pressed={voir}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
            >
              {voir ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {vm.erreur && (
          <Alert variant="destructive" id="erreur-connexion">
            {vm.erreur.code === 'IDENTIFIANTS_INCORRECTS' ? t('auth.erreurIdentifiants') : vm.erreur.code === 'MFA_EXPIRE' ? t('auth.sessionExpiree') : t('mfa.invalide')}{' '}
            {vm.erreur.essaisRestants !== undefined && <strong>{t('auth.essaisRestants', { n: vm.erreur.essaisRestants })}</strong>}
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={vm.enCours}>
          <LogIn size={18} aria-hidden /> {vm.enCours ? t('commun.chargement') : t('auth.seConnecter')}
        </Button>
        <p className="text-center text-sm text-muted-foreground">{t('auth.aide')}</p>
      </form>
    </Card>
  );
}

function FormulaireCode({ vm }: { vm: VM }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [secours, setSecours] = useState(false);
  const invalide = vm.erreur?.code === 'CODE_INVALIDE';
  const pret = secours ? code.length >= 8 : code.length === 6;

  return (
    <Card>
      <IconeTitre><Smartphone size={22} aria-hidden /></IconeTitre>
      <h2 className="mt-5 text-2xl font-bold text-primary-900 dark:text-foreground">{t('mfa.titre')}</h2>
      <p className="mt-2 text-muted-foreground">{secours ? t('mfa.saisirSecours') : t('mfa.consigne')}</p>
      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (pret) vm.verifierCode(code);
        }}
      >
        {secours ? (
          <Input
            autoFocus
            aria-label={t('mfa.saisirSecours')}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono tracking-widest"
            invalide={invalide}
            aria-describedby="erreur-code"
          />
        ) : (
          <SaisieCode valeur={code} onChange={setCode} invalide={invalide} idDescription="erreur-code" autoFocus />
        )}
        {vm.erreur && (
          <p id="erreur-code" role="alert" className="text-sm text-destructive">
            {t('mfa.invalide')} {vm.erreur.essaisRestants !== undefined && t('mfa.essais', { n: vm.erreur.essaisRestants })}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={!pret || vm.enCours}>
          {t('mfa.verifier')}
        </Button>
        <button
          type="button"
          className="block w-full text-center text-sm text-primary underline underline-offset-4"
          onClick={() => {
            setSecours(!secours);
            setCode('');
          }}
        >
          {secours ? t('mfa.codeTotp') : t('mfa.codeSecours')}
        </button>
      </form>
    </Card>
  );
}

function Enrolement({ vm }: { vm: VM }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  if (!vm.enrolement) return <Card>{t('commun.chargement')}</Card>;
  const etape = (n: number, texte: string) => (
    <span className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
      {texte}
    </span>
  );

  return (
    <Card className="lg:-mx-16">
      <h2 className="text-2xl font-bold text-primary-900 dark:text-foreground">{t('enrolement.titre')}</h2>
      <p className="mt-2 text-muted-foreground">{t('enrolement.consigne')}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL générée par l'API */}
        <img src={vm.enrolement.qrCode} alt="QR code d'enrôlement TOTP" className="size-44 rounded-lg border border-border bg-white p-2" />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) vm.confirmerEnrolement(code);
          }}
        >
          {etape(1, t('enrolement.etape1'))}
          {etape(2, t('enrolement.etape2'))}
          <span className="ml-10 flex items-center gap-2">
            <code className="rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-wider">{vm.enrolement.cleManuelle}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t('enrolement.copier')}
              onClick={() => navigator.clipboard?.writeText(vm.enrolement!.cleManuelle.replace(/ /g, ''))}
            >
              <Copy size={16} />
            </Button>
          </span>
          {etape(3, t('enrolement.etape3'))}
          <div className="ml-10">
            <SaisieCode valeur={code} onChange={setCode} invalide={!!vm.erreur} idDescription="erreur-enrolement" />
            {vm.erreur && <p id="erreur-enrolement" role="alert" className="mt-2 text-sm text-destructive">{t('mfa.invalide')}</p>}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={code.length !== 6 || vm.enCours}>{t('enrolement.activer')}</Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

function CodesSecours({ vm }: { vm: VM }) {
  const { t } = useT();
  const telecharger = () => {
    const blob = new Blob([`EACT — codes de secours\n\n${vm.codesSecours.join('\n')}\n`], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'eact-codes-de-secours.txt' });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card>
      <h2 className="text-2xl font-bold text-primary-900 dark:text-foreground">{t('secours.titre')}</h2>
      <p className="mt-2 text-muted-foreground">{t('secours.consigne')}</p>
      <ul className="mt-6 grid grid-cols-2 gap-2">
        {vm.codesSecours.map((c) => (
          <li key={c} className="rounded-md bg-muted px-3 py-2 font-mono text-sm">{c}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={telecharger}><Download size={16} aria-hidden /> {t('secours.telecharger')}</Button>
        <Button onClick={vm.continuer}>{t('secours.continuer')}</Button>
      </div>
    </Card>
  );
}

function CompteVerrouille({ vm }: { vm: VM }) {
  const { t } = useT();
  const fin = vm.deverrouillageLe ? new Date(vm.deverrouillageLe).getTime() : Date.now();
  const [reste, setReste] = useState(Math.max(0, fin - Date.now()));
  useEffect(() => {
    const m = setInterval(() => setReste(Math.max(0, fin - Date.now())), 1000);
    return () => clearInterval(m);
  }, [fin]);
  const mm = String(Math.floor(reste / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((reste % 60_000) / 1000)).padStart(2, '0');

  return (
    <Card>
      <IconeTitre ton="danger"><Lock size={22} aria-hidden /></IconeTitre>
      <h2 className="mt-5 text-2xl font-bold text-primary-900 dark:text-foreground">{t('verrou.titre')}</h2>
      <p className="mt-2 text-muted-foreground">{t('verrou.texte')}</p>
      <div className="mt-6 rounded-lg bg-muted p-5 text-center">
        <p className="text-sm text-muted-foreground">{t('verrou.dans')}</p>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-primary-900 dark:text-foreground" aria-live="polite">{mm}:{ss}</p>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t('verrou.prevenir')}</p>
      <Button variant="link" className="mt-4" onClick={vm.recommencer}>{t('commun.retourConnexion')}</Button>
    </Card>
  );
}

function ComptesDemo({ t }: { t: ReturnType<typeof useT>['t'] }) {
  const remplir = (matricule: string) => {
    const champ = (id: string) => document.getElementById(id) as HTMLInputElement | null;
    champ('identifiant')!.value = matricule;
    champ('motDePasse')!.value = 'Minesup@2026';
    champ('motDePasse')!.focus();
  };
  return (
    <details className="mt-4 rounded-lg border border-dashed border-border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">{t('auth.comptesDemo')}</summary>
      <p className="mt-2 text-muted-foreground">Mot de passe : <code className="font-mono">Minesup@2026</code> · secret TOTP : <code className="font-mono">JBSWY3DPEHPK3PXP</code></p>
      <ul className="mt-3 divide-y divide-border">
        {COMPTES_DEMO.map(([matricule, nom, role]) => (
          <li key={matricule}>
            <button type="button" onClick={() => remplir(matricule)} className="flex w-full justify-between gap-2 py-2 text-left hover:text-primary">
              <span><strong>{nom}</strong> <span className="text-muted-foreground">· {role}</span></span>
              <code className="font-mono text-xs text-muted-foreground">{matricule}</code>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
