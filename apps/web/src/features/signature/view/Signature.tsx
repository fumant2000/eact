'use client';

// MVVM — Vues de la signature : E2 (panneau « À la signature »), E3 (code), E4 (progression, succès), E6 (acte signé).
import { AlertCircle, Check, Clock, Copy, Download, ExternalLink, Hash, Loader2, Lock, QrCode, Smartphone, Stamp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Dialogue } from '@/components/ui/Dialogue';
import { Button, classesBouton, cx } from '@/components/ui/primitives';
import { CodeDemo } from '@/features/auth/view/Demo';
import { SaisieCode } from '@/features/auth/view/SaisieCode';
import { useT } from '@/i18n';
import { signatureApi, type ResultatSignature } from '../model/signature.api';
import type { useSignatureViewModel } from '../view-model/useSignatureViewModel';

type VM = ReturnType<typeof useSignatureViewModel>;
const horodatage = (iso: string) => `${new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'medium' }).replace(',', '')} WAT`;

/** E2 : ce qui va se passer au clic sur « Signer ». */
export function PanneauALaSignature() {
  const { t } = useT();
  const lignes: [ReactNode, string][] = [
    [<Smartphone key="a" size={18} />, t('signature.info1')],
    [<Hash key="b" size={18} />, t('signature.info2')],
    [<Clock key="c" size={18} />, t('signature.info3')],
    [<QrCode key="d" size={18} />, t('signature.info4')],
    [<Lock key="e" size={18} />, t('signature.info5')],
  ];
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 font-semibold">{t('signature.aLaSignature')}</h2>
      <ul className="space-y-3 text-sm">
        {lignes.map(([icone, texte]) => (
          <li key={texte} className="flex gap-3"><span className="mt-0.5 shrink-0 text-primary" aria-hidden>{icone}</span>{texte}</li>
        ))}
      </ul>
    </section>
  );
}

function Etape({ etat, children }: { etat: 'fait' | 'courant' | 'aVenir'; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      {etat === 'fait' ? (
        <span className="grid size-8 place-items-center rounded-full bg-success text-white"><Check size={16} aria-hidden /></span>
      ) : etat === 'courant' ? (
        <span className="grid size-8 place-items-center rounded-full border-2 border-primary text-primary"><Loader2 size={16} className="animate-spin" aria-hidden /></span>
      ) : (
        <span className="size-8 rounded-full border-2 border-border" aria-hidden />
      )}
      <span className={cx(etat === 'courant' && 'font-semibold', etat === 'aVenir' && 'text-muted-foreground')}>{children}</span>
    </li>
  );
}

/** E4 : carte de l'acte signé, réutilisée sur la fiche (E6). */
export function CarteActeSigne({ r, pied }: { r: ResultatSignature; pied?: ReactNode }) {
  const { t } = useT();
  const [copie, setCopie] = useState(false);
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="rounded-lg border border-[#ecd29c] bg-[#fbf3e2] p-4">
          <p className="text-sm text-seal-700">{t('signature.reference')}</p>
          <p className="reference text-2xl font-semibold text-foreground dark:text-[#1a2033]">{r.reference}</p>
        </div>
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('signature.signePar')}</dt>
          <dd>{r.signataire} · {r.qualite}</dd>
          <dt className="text-muted-foreground">{t('signature.horodatage')}</dt>
          <dd className="reference">{horodatage(r.signeLe)}</dd>
          <dt className="text-muted-foreground">{t('signature.empreinte')}</dt>
          <dd className="flex items-center gap-2">
            <span className="reference" title={r.empreinteSha256 ?? ''}>SHA-256 · {r.empreinteSha256?.slice(0, 4)}…{r.empreinteSha256?.slice(-4)}</span>
            <button
              type="button"
              aria-label={t('signature.copierEmpreinte')}
              onClick={() => { void navigator.clipboard?.writeText(r.empreinteSha256 ?? ''); setCopie(true); }}
              className="grid size-8 place-items-center rounded-md border border-input hover:bg-accent"
            >
              {copie ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </dd>
          <dt className="text-muted-foreground">{t('signature.codeCourt')}</dt>
          <dd className="reference">{r.codeVerification}</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          {r.pdfDisponible ? (
            <a href={signatureApi.urlPdf(r.acteId)} target="_blank" rel="noopener" className={classesBouton()}>
              <Download size={18} aria-hidden /> {t('signature.telecharger')}
            </a>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" aria-hidden /> {t('signature.pdfEnCours')}</span>
          )}
          <a href={`/verifier/${r.codeVerification}`} target="_blank" rel="noopener" className={classesBouton({ variant: 'outline' })}>
            <ExternalLink size={16} aria-hidden /> {t('signature.verifierPublic')}
          </a>
          {pied}
        </div>
      </div>
      <figure className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL produite par l'API */}
        <img src={r.qrCode} alt={`QR : ${r.urlVerification}`} className="mx-auto size-44 rounded-lg border-2 border-seal-400 bg-white p-2" />
        <figcaption className="mt-2 max-w-44 text-xs text-muted-foreground">{t('signature.qrImprime')}</figcaption>
      </figure>
    </div>
  );
}

/** E3 + E4 : code TOTP, progression puis succès. */
export function DialogueSignature({ vm, objet }: { vm: VM; objet: string }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [etapeAffichee, setEtapeAffichee] = useState(0);
  const qualite = vm.etat && !vm.etat.signe ? vm.etat.qualite : null;

  // Progression E4 : les deux premières étapes défilent pendant l'appel, la 3e suit la génération réelle du PDF/A.
  useEffect(() => {
    if (vm.phase !== 'enCours') return setEtapeAffichee(0);
    const m = setInterval(() => setEtapeAffichee((e) => Math.min(e + 1, 2)), 400);
    return () => clearInterval(m);
  }, [vm.phase]);
  useEffect(() => {
    if (vm.phase === 'code') setCode('');
  }, [vm.phase]);

  const titre =
    vm.phase === 'signe' ? (
      <span className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-seal-400 text-seal-foreground"><Stamp size={20} aria-hidden /></span>{t('signature.signe')}</span>
    ) : vm.phase === 'enCours' ? (
      t('signature.enCours')
    ) : (
      <span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#fbf3e2] text-seal-700"><Stamp size={20} aria-hidden /></span>{t('signature.confirmer')}</span>
    );

  return (
    <Dialogue ouvert={vm.phase !== 'ferme'} onFermer={() => vm.phase !== 'enCours' && vm.fermer()} titre={titre} bloquant={vm.phase === 'enCours'} large={vm.phase === 'signe'}>
      {vm.phase === 'code' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void vm.signer(code);
          }}
        >
          <p className="text-muted-foreground">{t('signature.consigne', { objet })}</p>
          <SaisieCode valeur={code} onChange={setCode} invalide={!!vm.erreur} idDescription="erreur-signature" autoFocus />
          <CodeDemo source="session" onUtiliser={setCode} />
          {vm.erreur && (
            <p id="erreur-signature" role="alert" className="flex gap-2 rounded-md border border-[#f5c2c4] bg-[#fdecec] p-3 text-sm text-[#a81f26]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{t('signature.codeIncorrect')} {vm.erreur.essaisRestants !== undefined && <strong>{t('mfa.essais', { n: vm.erreur.essaisRestants })}</strong>}</span>
            </p>
          )}
          {qualite && <p className="text-sm text-muted-foreground">{t('signature.qualite', { q: qualite })}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button type="button" variant="outline" size="lg" onClick={vm.fermer}>{t('commun.annuler')}</Button>
            <Button type="submit" variant="seal" size="lg" disabled={code.length !== 6}>{vm.erreur ? t('signature.reessayer') : t('signature.maintenant')}</Button>
          </div>
        </form>
      )}

      {vm.phase === 'enCours' && (
        <div className="space-y-4" aria-live="polite">
          <ol className="space-y-3">
            <Etape etat={etapeAffichee >= 1 ? 'fait' : 'courant'}>{t('signature.etapeCode')}</Etape>
            <Etape etat={etapeAffichee >= 2 ? 'fait' : etapeAffichee === 1 ? 'courant' : 'aVenir'}>{t('signature.etapeReference')}</Etape>
            <Etape etat={etapeAffichee >= 2 ? 'courant' : 'aVenir'}>{t('signature.etapePdf')}</Etape>
            <Etape etat="aVenir">{t('signature.etapeArchivage')}</Etape>
          </ol>
          <p className="text-sm text-muted-foreground">{t('signature.neFermezPas')}</p>
        </div>
      )}

      {vm.phase === 'signe' && vm.resultat && (
        <div className="space-y-4">
          {vm.resultat.rejoue ? (
            <p className="rounded-md bg-accent p-3 text-sm">{t('signature.dejaSigne')}</p>
          ) : (
            <p className="text-muted-foreground">{t('signature.diffusion')}</p>
          )}
          <CarteActeSigne
            r={vm.resultat}
            pied={
              vm.acteSuivant ? (
                <Link href={`/actes/${vm.acteSuivant}`} className={classesBouton({ variant: 'outline' })}>{t('signature.acteSuivant', { n: vm.nbRestants })}</Link>
              ) : (
                <Link href="/signature" className={classesBouton({ variant: 'outline' })}>{t('signature.retourListe')}</Link>
              )
            }
          />
        </div>
      )}
    </Dialogue>
  );
}
