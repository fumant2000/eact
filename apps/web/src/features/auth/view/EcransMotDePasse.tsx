'use client';

// MVVM — Vues du mot de passe oublié : demande, lien envoyé, nouveau mot de passe, lien expiré (BF-05).
import { ArrowLeft, Check, Circle, MailCheck, Unlink } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Label } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { ErreurApi } from '@/lib/api';
import { authApi, reglesMotDePasse } from '../model/auth.api';
import { CadreAuth } from './CadreAuth';

export function EcranDemandeLien() {
  const { t } = useT();
  const [identifiant, setIdentifiant] = useState('');
  const [envoye, setEnvoye] = useState<{ destinataire?: string } | null>(null);
  const [attente, setAttente] = useState(0);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (attente <= 0) return;
    const m = setTimeout(() => setAttente(attente - 1), 1000);
    return () => clearTimeout(m);
  }, [attente]);

  async function envoyer() {
    setEnCours(true);
    try {
      setEnvoye(await authApi.demanderReinitialisation(identifiant));
      setAttente(60);
    } finally {
      setEnCours(false);
    }
  }

  if (envoye) {
    return (
      <CadreAuth>
        <Card>
          <span className="grid size-12 place-items-center rounded-lg bg-[#e3f4ec] text-success"><MailCheck size={22} aria-hidden /></span>
          <h2 className="mt-5 text-2xl font-bold text-primary-900 dark:text-foreground">{t('reinit.envoyeTitre')}</h2>
          <p className="mt-2 text-muted-foreground">{t('reinit.envoyeTexte', { a: envoye.destinataire ? ` à ${envoye.destinataire}` : '' })}</p>
          <Button variant="outline" className="mt-6" disabled={attente > 0 || enCours} onClick={envoyer}>
            {attente > 0 ? t('reinit.renvoyerDans', { t: `0:${String(attente).padStart(2, '0')}` }) : t('reinit.renvoyer')}
          </Button>
          <Link href="/connexion" className="mt-6 block text-sm text-primary underline underline-offset-4">{t('commun.retourConnexion')}</Link>
        </Card>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth>
      <Card>
        <Link href="/connexion" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} aria-hidden /> {t('auth.titre')}</Link>
        <h2 className="mt-4 text-2xl font-bold text-primary-900 dark:text-foreground">{t('reinit.titre')}</h2>
        <p className="mt-2 text-muted-foreground">{t('reinit.consigne')}</p>
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (identifiant.trim()) envoyer();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="identifiant">{t('auth.identifiant')}</Label>
            <Input id="identifiant" autoFocus required value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!identifiant.trim() || enCours}>{t('reinit.envoyer')}</Button>
        </form>
      </Card>
    </CadreAuth>
  );
}

function Regle({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? 'text-success' : 'text-muted-foreground'}`}>
      {ok ? <Check size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
      <span>{texte}</span>
      <span className="sr-only">{ok ? '(respectée)' : '(non respectée)'}</span>
    </li>
  );
}

export function EcranNouveauMotDePasse() {
  const { t } = useT();
  const router = useRouter();
  const jeton = useSearchParams().get('jeton') ?? '';
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [etat, setEtat] = useState<'saisie' | 'expire' | 'succes'>(jeton ? 'saisie' : 'expire');
  const [erreur, setErreur] = useState<string | null>(null);
  const regles = reglesMotDePasse(mdp, confirmation);
  const valide = Object.values(regles).every(Boolean);

  async function enregistrer() {
    setErreur(null);
    try {
      await authApi.reinitialiser(jeton, mdp);
      setEtat('succes');
    } catch (e) {
      if (e instanceof ErreurApi && e.status === 410) setEtat('expire');
      else setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  if (etat === 'expire') {
    return (
      <CadreAuth>
        <Card>
          <span className="grid size-12 place-items-center rounded-lg bg-[#fef3e7] text-warning"><Unlink size={22} aria-hidden /></span>
          <h2 className="mt-5 text-2xl font-bold text-primary-900 dark:text-foreground">{t('reinit.expireTitre')}</h2>
          <p className="mt-2 text-muted-foreground">{t('reinit.expireTexte')}</p>
          <Button className="mt-6" onClick={() => router.push('/mot-de-passe')}>{t('reinit.nouveauLien')}</Button>
        </Card>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth>
      <Card>
        <h2 className="text-2xl font-bold text-primary-900 dark:text-foreground">{t('reinit.nouveauTitre')}</h2>
        {etat === 'succes' ? (
          <div className="mt-6 space-y-6">
            <Alert variant="success">{t('reinit.succes')}</Alert>
            <Button onClick={() => router.push('/connexion')}>{t('commun.retourConnexion')}</Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (valide) enregistrer();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="mdp">{t('auth.motDePasse')}</Label>
              <Input id="mdp" type="password" autoComplete="new-password" autoFocus value={mdp} onChange={(e) => setMdp(e.target.value)} aria-describedby="regles-mdp" />
            </div>
            <ul id="regles-mdp" className="space-y-1">
              <Regle ok={regles.longueur} texte={t('reinit.regleLongueur')} />
              <Regle ok={regles.majChiffre} texte={t('reinit.regleMajChiffre')} />
              <Regle ok={regles.special} texte={t('reinit.regleSpecial')} />
              <Regle ok={regles.identique} texte={t('reinit.regleIdentique')} />
            </ul>
            <div className="space-y-2">
              <Label htmlFor="confirmation">{t('reinit.confirmer')}</Label>
              <Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </div>
            {erreur && <Alert variant="destructive">{erreur}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={!valide}>{t('reinit.enregistrer')}</Button>
          </form>
        )}
      </Card>
    </CadreAuth>
  );
}
