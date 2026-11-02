'use client';

// M13 — Vérification publique (UC-17, V-01 / V-02), mobile d'abord, sans connexion.
// Les données sont chargées par le serveur (page) puis affichées ici, dans la langue choisie.
import { FileCheck2, FileX2, Search, ShieldCheck, ShieldX, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { SelecteurLangue } from '@/components/SelecteurLangue';
import { Alert, Button, Input, Label } from '@/components/ui/primitives';
import { Logo } from '@/features/auth/view/CadreAuth';
import { signatureApi, type Verification } from '@/features/signature/model/signature.api';
import { useT } from '@/i18n';

function CadrePublic({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link href="/verifier"><Logo /></Link>
        <SelecteurLangue />
      </header>
      <main className="mx-auto max-w-xl space-y-6 p-4 py-8">{children}</main>
      <footer className="mx-auto max-w-xl px-4 pb-8 text-center text-xs text-muted-foreground">
        <p>{t('commun.ministere')}</p>
        <p>{t('verif.pied')}</p>
      </footer>
    </div>
  );
}

/** V-01 : saisie du code court. */
export function SaisieCodeVerification({ codeInitial = '' }: { codeInitial?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState(codeInitial);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const net = code.trim().toUpperCase();
        if (net) router.push(`/verifier/${encodeURIComponent(net)}`);
      }}
    >
      <Label htmlFor="code-verif">{t('verif.code')}</Label>
      <div className="flex gap-2">
        <Input id="code-verif" value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7Q2-9M" autoCapitalize="characters" autoComplete="off" className="reference text-lg tracking-widest" />
        <Button type="submit" size="lg"><Search size={18} aria-hidden /> {t('verif.verifier')}</Button>
      </div>
    </form>
  );
}

export function PageSaisie() {
  const { t } = useT();
  return (
    <CadrePublic>
      <h1 className="text-2xl font-bold text-primary-900 dark:text-foreground">{t('verif.titre')}</h1>
      <p className="text-muted-foreground">{t('verif.sousTitre')}</p>
      <SaisieCodeVerification />
    </CadrePublic>
  );
}

/** BF-57 : comparaison d'un PDF reçu avec l'original signé (le fichier n'est pas conservé). */
function ComparerPdf({ code }: { code: string }) {
  const { t } = useT();
  const champ = useRef<HTMLInputElement>(null);
  const [resultat, setResultat] = useState<{ identique: boolean; nom: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">{t('verif.comparerTitre')}</h2>
      <p className="text-sm text-muted-foreground">{t('verif.comparerTexte')}</p>
      <input
        ref={champ}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setEnCours(true);
          setErreur(null);
          try {
            setResultat({ identique: (await signatureApi.comparer(code, f)).identique, nom: f.name });
          } catch (err) {
            setErreur((err as Error).message);
          } finally {
            setEnCours(false);
          }
        }}
      />
      <Button variant="outline" onClick={() => champ.current?.click()} disabled={enCours}><Upload size={18} aria-hidden /> {t('verif.choisir')}</Button>
      {resultat &&
        (resultat.identique ? (
          <p className="flex gap-2 rounded-md bg-[#e3f4ec] p-3 text-[#0b6447]" role="status"><FileCheck2 size={18} className="shrink-0" aria-hidden /> <span><strong>{resultat.nom}</strong> — {t('verif.identique')}</span></p>
        ) : (
          <p className="flex gap-2 rounded-md bg-[#fdecec] p-3 text-[#a81f26]" role="alert"><FileX2 size={18} className="shrink-0" aria-hidden /> <span><strong>{resultat.nom}</strong> — {t('verif.different')}</span></p>
        ))}
      {erreur && <Alert variant="destructive">{erreur}</Alert>}
    </section>
  );
}

/** V-02 : résultat. Jamais le contenu d'un acte non public (RG-21). */
export function PageResultat({ code, acte }: { code: string; acte: Verification | null }) {
  const { t, langue } = useT();
  if (!acte) {
    return (
      <CadrePublic>
        <div className="space-y-2 rounded-lg border-2 border-destructive bg-card p-6">
          <p className="flex items-center gap-2 text-xl font-semibold text-destructive"><ShieldX aria-hidden /> {t('verif.introuvable')}</p>
          <p className="reference text-sm">{code}</p>
          <p className="text-muted-foreground">{t('verif.introuvableTexte')}</p>
        </div>
        <SaisieCodeVerification codeInitial={code} />
      </CadrePublic>
    );
  }
  const valide = acte.statut === 'VALIDE';
  const lignes: [string, ReactNode][] = [
    [t('signature.reference'), <span key="r" className="reference">{acte.reference}</span>],
    [t('verif.type'), acte.type],
    [t('verif.structure'), acte.structure],
    [t('verif.date'), new Date(acte.signeLe).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala', dateStyle: 'long', timeStyle: 'short' })],
    [t('verif.signataire'), `${acte.signataire ?? ''} · ${acte.qualite}`],
    [t('verif.objet'), acte.objet ?? <span key="o" className="text-muted-foreground italic">{t('verif.objetMasque')}</span>],
    [t('verif.empreinte'), <span key="e" className="reference text-xs break-all">{acte.empreinteTexte}</span>],
  ];
  return (
    <CadrePublic>
      <div className={`space-y-4 rounded-lg border-2 bg-card p-6 ${valide ? 'border-seal-400' : 'border-destructive'}`}>
        <p className={`flex items-center gap-2 text-2xl font-bold ${valide ? 'text-success' : 'text-destructive'}`}>
          {valide ? <ShieldCheck size={28} aria-hidden /> : <ShieldX size={28} aria-hidden />}
          {valide ? t('verif.authentique') : t('verif.retire')}
        </p>
        {!valide && <p className="text-muted-foreground">{t('verif.retireTexte')}</p>}
        <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[150px_1fr]">
          {lignes.map(([libelle, valeur]) => (
            <div key={libelle} className="contents">
              <dt className="text-muted-foreground">{libelle}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ComparerPdf code={code} />
      <Link href="/verifier" className="block text-center text-sm text-primary underline underline-offset-4">{t('verif.autre')}</Link>
    </CadrePublic>
  );
}
