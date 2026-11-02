'use client';

// MVVM — Vue D2 « Fiche d'un acte » + cas D8 (visa non proposé). Mobile : colonnes empilées.
import { ArrowLeft, Building2, Check, CircleDot, Download, Hourglass, Info, Lock, PenTool, Route, ShieldCheck, Stamp, Undo2, UserCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { StatutBadge } from '@/components/StatutBadge';
import { Alert, Button, cx } from '@/components/ui/primitives';
import { actesApi } from '@/features/actes/model/actes.api';
import { CodeType, CorpsActe, EnTeteOfficiel, TitreActe } from '@/features/actes/view/Document';
import { useSignatureViewModel } from '@/features/signature/view-model/useSignatureViewModel';
import { CarteActeSigne, DialogueSignature, PanneauALaSignature } from '@/features/signature/view/Signature';
import { useT, type CleTraduction } from '@/i18n';
import { useFicheActeViewModel, type EtatEtape } from '../view-model/useFicheActeViewModel';
import { BadgeEcheance, DialogueCorrection, DialogueRejet, DialogueVisa } from './Decisions';

type VM = ReturnType<typeof useFicheActeViewModel>;

function Pastille({ etat }: { etat: EtatEtape | 'signature' }) {
  if (etat === 'fait') return <span className="grid size-8 place-items-center rounded-full bg-success text-white"><Check size={16} aria-hidden /></span>;
  if (etat === 'courant') return <span className="grid size-8 place-items-center rounded-full border-2 border-primary bg-card text-primary"><CircleDot size={14} aria-hidden /></span>;
  if (etat === 'renvoye') return <span className="grid size-8 place-items-center rounded-full bg-warning text-white"><Undo2 size={14} aria-hidden /></span>;
  return <span className="size-8 rounded-full border-2 border-border bg-card" aria-hidden />;
}

function Frise({ vm }: { vm: VM }) {
  const { t, langue } = useT();
  const a = vm.acte!;
  const s = vm.suivi!;
  const quand = (iso: string) => new Date(iso).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const soumission = s.historique.filter((h) => h.type === 'SOUMISSION').at(-1);
  const lignes: { cle: string; etat: EtatEtape; titre: string; detail: ReactNode; date?: string }[] = [
    {
      cle: 'redaction',
      etat: soumission ? 'fait' : 'courant',
      titre: t('fiche.soumission'),
      detail: (
        <>
          <span className="block text-muted-foreground">{s.redacteur.nom} · {s.redacteur.structure}</span>
          {soumission?.type === 'SOUMISSION' && <span className="block text-success">{t('fiche.soumis', { v: soumission.version })}</span>}
        </>
      ),
      date: soumission?.le,
    },
    ...s.etapes.map((e) => {
      const etat = vm.etatEtape(e.ordre);
      const visa = vm.dernierVisa(e.ordre);
      const moi = etat === 'courant' && s.peutViser;
      return {
        cle: String(e.ordre),
        etat,
        titre: e.libelle,
        date: etat === 'fait' || etat === 'renvoye' ? visa?.le : undefined,
        detail: (
          <>
            <span className="block text-muted-foreground">{moi ? `${t('fiche.vous')} · ` : ''}{visa && etat !== 'aVenir' ? visa.acteur : e.viseurs.join(', ')}</span>
            {etat === 'fait' && visa?.type === 'VISA' && <span className="block text-success">{t(`parapheur.decision.${visa.decision}` as CleTraduction)}</span>}
            {etat === 'renvoye' && visa?.type === 'VISA' && <span className="block text-warning">{t(`parapheur.decision.${visa.decision}` as CleTraduction)}</span>}
            {etat === 'courant' && <span className="block text-primary">{moi ? t('fiche.enAttenteVous') : t('fiche.enAttente')}</span>}
            {etat === 'aVenir' && <span className="block text-muted-foreground">{t('fiche.aVenir', { d: e.delaiHeures })}</span>}
            {visa?.type === 'VISA' && visa.observation && etat !== 'aVenir' && <span className="mt-2 block rounded-md bg-muted p-2 text-sm">« {visa.observation} »</span>}
          </>
        ),
      };
    }),
    {
      cle: 'signature',
      etat: ['SIGNE', 'EXECUTOIRE', 'ARCHIVE'].includes(a.statut) ? 'fait' : a.statut === 'PRET_A_SIGNER' ? 'courant' : 'aVenir',
      titre: t('fiche.signature'),
      detail: <span className="block text-muted-foreground">{a.circuit?.signature}</span>,
    },
  ];
  return (
    <ol className="relative space-y-6">
      {lignes.map((l, i) => (
        <li key={l.cle} className="relative flex gap-4" aria-current={l.etat === 'courant' ? 'step' : undefined}>
          {i < lignes.length - 1 && <span className={cx('absolute top-8 left-4 -ml-px h-[calc(100%+0.5rem)] w-0.5', l.etat === 'fait' ? 'bg-success' : 'bg-border')} aria-hidden />}
          <span className="relative z-10 shrink-0"><Pastille etat={l.etat} /></span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex justify-between gap-2 text-base font-semibold">
              {l.titre}
              {l.date && <span className="text-sm font-normal text-muted-foreground tabular-nums">{quand(l.date)}</span>}
            </p>
            {l.detail}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Historique({ vm }: { vm: VM }) {
  const { t, langue } = useT();
  return (
    <ol className="space-y-3 text-sm">
      {[...vm.suivi!.historique].reverse().map((h, i) => (
        <li key={i} className="border-l-2 border-border pl-3">
          <p className="text-muted-foreground tabular-nums">{new Date(h.le).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB')}</p>
          <p>
            <strong>{h.acteur}</strong> ·{' '}
            {h.type === 'SOUMISSION' ? t('fiche.soumis', { v: h.version }) : `${h.etape.libelle} — ${t(`parapheur.decision.${h.decision}` as CleTraduction)}`}
          </p>
          {h.type === 'VISA' && h.observation && <p className="text-muted-foreground">« {h.observation} »</p>}
        </li>
      ))}
    </ol>
  );
}

function MessageNonVisa({ vm }: { vm: VM }) {
  const { t, langue } = useT();
  const s = vm.suivi!;
  const a = vm.acte!;
  if (s.peutViser) {
    return s.interimDe ? (
      <div className="flex gap-3 rounded-lg border border-[#d8c8f3] bg-[#f0eafb] p-4 text-[#5a32a3]">
        <UserCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>{t('fiche.interim', { nom: s.interimDe.nom, mention: s.interimDe.mention })}</p>
      </div>
    ) : null;
  }
  if (['SIGNE', 'EXECUTOIRE', 'ARCHIVE', 'TRANSMIS', 'RETIRE'].includes(a.statut)) return null;
  if (a.statut === 'PRET_A_SIGNER') {
    return (
      <div className="flex gap-3 rounded-lg border border-[#d8c8f3] bg-[#f0eafb] p-4 text-[#5a32a3]">
        <PenTool size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>{t('signature.nonCompetent', { s: a.circuit?.signature ?? '' })}</p>
      </div>
    );
  }
  const messages: Record<string, ReactNode> = {
    REDACTEUR: t('fiche.redacteur'),
    DEJA_VISE: t('fiche.dejaVise', { d: s.dejaViseLe ? new Date(s.dejaViseLe).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB') : '' }),
    PAS_VOTRE_ETAPE: t('fiche.pasVotreEtape', { e: a.etapeCourante?.libelle ?? '' }),
    PIECES_EN_ANALYSE: t('fiche.piecesEnAnalyse'),
    HORS_CIRCUIT: t('fiche.horsCircuit'),
  };
  const Icone = s.raisonNonVisa === 'PIECES_EN_ANALYSE' ? Lock : s.raisonNonVisa === 'DEJA_VISE' ? ShieldCheck : Info;
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <Icone size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <p>{messages[s.raisonNonVisa ?? 'HORS_CIRCUIT']}</p>
    </div>
  );
}

function Info2({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function FicheActe({ id }: { id: string }) {
  const { t, langue } = useT();
  const vm = useFicheActeViewModel(id);
  const sig = useSignatureViewModel(id);
  const peutSigner = sig.etat?.signe === false && sig.etat.peutSigner;
  const signe = sig.etat?.signe ? sig.etat.resultat : null;
  const [onglet, setOnglet] = useState<'circuit' | 'historique'>('circuit');
  if (vm.erreur) return <Alert variant="destructive">{vm.erreur}</Alert>;
  if (!vm.acte || !vm.suivi) return <p className="text-muted-foreground">{t('commun.chargement')}</p>;
  const a = vm.acte;
  const s = vm.suivi;
  const fmt = (iso: string) => new Date(iso).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const total = (a.circuit?.etapes.length ?? 0) + 1;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href={peutSigner ? '/signature' : '/parapheur'} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden /> {peutSigner ? t('signature.titre') : t('fiche.retourParapheur')}
        </Link>
        <span className="mx-2">/</span>
        {a.type.libelle}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded border border-border bg-card px-2 py-1 text-sm"><CodeType code={a.type.code} /> {a.type.libelle}</span>
            {a.statut === 'EN_CIRCUIT' && a.etapeCourante ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
                <Route size={14} aria-hidden /> {t('fiche.enCircuit', { o: a.etapeCourante.ordre, t: total })}
              </span>
            ) : (
              <StatutBadge statut={a.statut} />
            )}
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-sm"><Building2 size={14} aria-hidden /> {t(`conf.${a.confidentialite}` as CleTraduction)}</span>
            {s.echeance && a.statut === 'EN_CIRCUIT' && <BadgeEcheance echeance={s.echeance} />}
          </div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{a.objet}</h1>
          <p className="text-sm text-muted-foreground">
            {t('fiche.redigePar', { nom: s.redacteur.nom, structure: s.redacteur.structure, v: s.numeroVersion })} ·{' '}
            <span className="reference">{a.reference ?? t('mesActes.refALaSignature')}</span>
          </p>
        </div>
        {peutSigner && (
          // Le SEUL bouton or de l'application (charte, ADR 0007)
          <Button variant="seal" size="lg" onClick={sig.ouvrir}><Stamp size={18} aria-hidden /> {t('signature.signer')}</Button>
        )}
        {s.peutViser && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline-destructive" onClick={() => vm.ouvrir('REJET')}><XCircle size={18} aria-hidden /> {t('rejet.bouton')}</Button>
            <Button variant="outline" onClick={() => vm.ouvrir('CORRECTION')}><Undo2 size={18} aria-hidden /> {t('correction.bouton')}</Button>
            <Button onClick={() => vm.ouvrir('FAVORABLE')}><Check size={18} aria-hidden /> {t('visa.viser')}</Button>
          </div>
        )}
      </header>

      {!peutSigner && <MessageNonVisa vm={vm} />}
      {signe && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Stamp size={20} className="text-seal-700" aria-hidden /> {t('signature.signe')}</h2>
          <CarteActeSigne r={signe} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">{t('fiche.apercu')}</h2>
          <article className="space-y-6 rounded-lg border border-border bg-white p-6 text-[#1a2033] shadow-sm sm:p-12">
            <EnTeteOfficiel chaine={a.structure.chaine} />
            <TitreActe code={a.type.code} numero={a.reference ?? <span className="reference rounded bg-primary-50 px-2 py-0.5 text-sm font-normal text-primary-700">{t('editeur.numero')}</span>} objet={a.objet} />
            <CorpsActe html={a.contenu} />
            <div className="grid gap-6 font-serif sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold underline">{t('editeur.ampliations')}</p>
                <ul className="text-sm">{a.ampliations.map((x) => <li key={x}>– {x}</li>)}</ul>
              </div>
              <div className="text-right">
                <p>{t('editeur.faitA')} <span className="reference text-sm text-muted-foreground">{t('editeur.dateSignature')}</span></p>
                <p className="mt-2 font-bold">{a.circuit?.signature}</p>
              </div>
            </div>
          </article>
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border p-4 font-semibold">{t('pieces.titre')} · {a.pieces.length}</h2>
            <ul className="divide-y divide-border">
              {a.pieces.length === 0 && <li className="p-4 text-muted-foreground">{t('pieces.aucune')}</li>}
              {a.pieces.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nomFichier}</span>
                    <span className="text-sm text-muted-foreground">{Math.max(1, Math.round(p.tailleOctets / 1024))} Ko</span>
                  </span>
                  {p.statutAnalyse === 'SAINE' ? (
                    <>
                      <span className="flex items-center gap-1 text-sm text-success"><ShieldCheck size={14} aria-hidden /> {t('fiche.analysee')}</span>
                      <a href={actesApi.urlPiece(a.id, p.id)} download aria-label={p.nomFichier} className="grid size-10 place-items-center rounded-md border border-input hover:bg-accent"><Download size={18} /></a>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><Hourglass size={14} aria-hidden /> {t('pieces.analyse')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {peutSigner && <PanneauALaSignature />}
          <section className="rounded-lg border border-border bg-card">
            <div role="tablist" className="flex border-b border-border px-4">
              {(['circuit', 'historique'] as const).map((o) => (
                <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)} className={cx('border-b-2 px-3 py-3', onglet === o ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground')}>
                  {t(o === 'circuit' ? 'fiche.circuit' : 'fiche.historique')}
                </button>
              ))}
            </div>
            <div className="p-5">{onglet === 'circuit' ? <Frise vm={vm} /> : <Historique vm={vm} />}</div>
          </section>
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">{t('fiche.informations')}</h2>
            <dl className="space-y-2">
              <Info2 libelle={t('fiche.structureEmettrice')}>{a.structure.chaine.join(' / ')}</Info2>
              <Info2 libelle={t('fiche.signatairePrevu')}>{a.circuit?.signature}</Info2>
              <Info2 libelle={t('fiche.langue')}>{a.langue === 'FR' ? t('editeur.francais') : t('editeur.anglais')} · {a.traductionRequise ? t('fiche.traductionRequise') : t('fiche.traductionNonRequise')}</Info2>
              {a.etapeCourante && <Info2 libelle={t('fiche.delaiEtape')}>{a.circuit?.etapes.find((e) => e.ordre === a.etapeCourante!.ordre)?.delaiHeures} h</Info2>}
              <Info2 libelle={t('fiche.creeLe')}>{fmt(s.creeLe)}</Info2>
              <Info2 libelle={t('fiche.identifiant')}><span className="reference text-xs">{a.id.slice(0, 4)}…{a.id.slice(-4)}</span></Info2>
            </dl>
          </section>
        </aside>
      </div>

      <DialogueSignature vm={sig} objet={a.objet} />
      <DialogueVisa ouvert={vm.dialogue === 'FAVORABLE'} objet={a.objet} etapeSuivante={s.etapeSuivante} onAnnuler={vm.fermer} onConfirmer={vm.viser} enCours={vm.enCours} />
      <DialogueCorrection ouvert={vm.dialogue === 'CORRECTION'} redacteur={s.redacteur.nom} etapesFranchies={vm.etapesFranchies} onAnnuler={vm.fermer} onConfirmer={vm.corriger} enCours={vm.enCours} />
      <DialogueRejet ouvert={vm.dialogue === 'REJET'} onAnnuler={vm.fermer} onConfirmer={vm.rejeter} enCours={vm.enCours} />
    </div>
  );
}
