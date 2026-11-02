'use client';

// MVVM — Vue de l'éditeur d'acte : texte, pièces, contrôle, soumission, suppression (BF-17, BF-18, RG-03).
import { AlertCircle, ArrowLeft, Check, Download, Eye, History, Loader2, Send, ShieldAlert, ShieldCheck, Trash2, Undo2, Upload, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { StatutBadge } from '@/components/StatutBadge';
import { Dialogue } from '@/components/ui/Dialogue';
import { Alert, Button, cx, Label } from '@/components/ui/primitives';
import { parapheurApi } from '@/features/parapheur/model/parapheur.api';
import { useT, type CleTraduction } from '@/i18n';
import { actesApi, champsManquantsLocaux, type Acte, type Brouillon, type Niveau, type Piece } from '../model/actes.api';
import { useEditeurViewModel, type EnvoiLocal } from '../view-model/useEditeurViewModel';
import { CodeType, CorpsActe, EnTeteOfficiel, TitreActe } from './Document';
import { BarreOutils, useEditeurRiche, ZoneTexte } from './EditeurTexte';

type VM = ReturnType<typeof useEditeurViewModel>;

function Carte({ titre, droite, children }: { titre: string; droite?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center justify-between text-lg font-semibold">
        {titre} {droite && <span className="text-sm font-normal text-muted-foreground">{droite}</span>}
      </h2>
      {children}
    </section>
  );
}

function EtatEnregistrement({ vm }: { vm: VM }) {
  const { t, langue } = useT();
  const heure = vm.enregistreLe?.toLocaleTimeString(langue === 'FR' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const modele = vm.acte?.modele ? ` · ${t('editeur.modele', { m: vm.acte.modele.libelle, v: vm.acte.modele.version })}` : '';
  if (vm.etat === 'enCours') return <span className="flex items-center gap-1 text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden /> {t('editeur.enregistrement')}</span>;
  if (vm.etat === 'enAttente') return <span className="text-muted-foreground">{t('editeur.nonEnregistre')}</span>;
  if (vm.etat === 'erreur') return <span className="text-destructive">{t('editeur.erreurEnregistrement', { m: vm.erreurEnregistrement ?? '' })}</span>;
  if (vm.etat === 'conflit') return <span className="text-destructive">{t('editeur.conflit')}</span>;
  return <span className="flex items-center gap-1 text-success"><Check size={14} aria-hidden /> {t('editeur.enregistre', { h: heure ?? '' })}{modele}</span>;
}

// ─────────── Ampliations (BF-16, BF-34) ───────────
function Ampliations({ valeurs, onChange, invalide, lecture }: { valeurs: string[]; onChange: (v: string[]) => void; invalide?: boolean; lecture?: boolean }) {
  const { t } = useT();
  const [saisie, setSaisie] = useState<string | null>(null);
  const ajouter = () => {
    const v = saisie?.trim();
    if (v && !valeurs.includes(v)) onChange([...valeurs, v]);
    setSaisie(null);
  };
  return (
    <div id="champ-ampliation" tabIndex={-1} className={cx('space-y-2 rounded-md', invalide && 'p-2 ring-2 ring-destructive')}>
      <p className="font-serif text-sm font-bold underline">{t('editeur.ampliations')}</p>
      <ul className="flex flex-wrap gap-2">
        {valeurs.map((v) => (
          <li key={v} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-sm">
            {v}
            {!lecture && (
              <button type="button" aria-label={t('editeur.retirerAmpliation', { a: v })} onClick={() => onChange(valeurs.filter((x) => x !== v))} className="text-muted-foreground hover:text-destructive">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
        {!lecture &&
          (saisie === null ? (
            <li>
              <button type="button" onClick={() => setSaisie('')} className="rounded border border-dashed border-primary-300 px-2 py-1 text-sm font-medium text-primary">
                + {t('editeur.ajouterAmpliation')}
              </button>
            </li>
          ) : (
            <li>
              <input
                autoFocus
                aria-label={t('editeur.nouveauDestinataire')}
                placeholder={t('editeur.nouveauDestinataire')}
                value={saisie}
                maxLength={120}
                onChange={(e) => setSaisie(e.target.value)}
                onBlur={ajouter}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); ajouter(); }
                  if (e.key === 'Escape') setSaisie(null);
                }}
                className="h-8 rounded border border-input bg-card px-2 text-sm"
              />
            </li>
          ))}
      </ul>
    </div>
  );
}

// ─────────── Pièces jointes (BF-18) ───────────
function IconeFichier({ nom }: { nom: string }) {
  const ext = nom.split('.').pop()?.toUpperCase().slice(0, 4) ?? '?';
  const couleur = ext === 'PDF' ? 'bg-[#fdecec] text-[#a81f26]' : ext === 'DOCX' ? 'bg-primary-50 text-primary-700' : 'bg-[#e3f4ec] text-[#0b6447]';
  return <span className={`grid size-10 shrink-0 place-items-center rounded-md text-[10px] font-bold ${couleur}`} aria-hidden>{ext}</span>;
}

function LignePiece({ nom, etat, onRetirer, telecharger }: { nom: string; etat: ReactNode; onRetirer?: () => void; telecharger?: string }) {
  const { t } = useT();
  return (
    <li className="flex items-center gap-3 py-2">
      <IconeFichier nom={nom} />
      <div className="min-w-0 flex-1">
        {telecharger ? (
          <a href={telecharger} className="block truncate font-medium hover:underline" download>{nom}</a>
        ) : (
          <span className="block truncate font-medium">{nom}</span>
        )}
        <div className="text-sm">{etat}</div>
      </div>
      {telecharger && <a href={telecharger} download aria-label={nom} className="text-muted-foreground hover:text-foreground"><Download size={18} /></a>}
      {onRetirer && (
        <button type="button" onClick={onRetirer} aria-label={t('pieces.retirer', { nom })} className="text-muted-foreground hover:text-destructive">
          <Trash2 size={18} />
        </button>
      )}
    </li>
  );
}

function Pieces({ vm, acte, lecture }: { vm: VM; acte: Acte; lecture: boolean }) {
  const { t } = useT();
  const champ = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const etatServeur = (p: Piece): ReactNode => {
    const ko = <AlertCircle size={14} className="mr-1 inline" aria-hidden />;
    if (p.statutAnalyse === 'EN_ATTENTE') return <span className="text-muted-foreground"><Loader2 size={14} className="mr-1 inline animate-spin" aria-hidden />{t('pieces.analyse')}</span>;
    if (p.statutAnalyse === 'SAINE') return <span className="text-success"><ShieldCheck size={14} className="mr-1 inline" aria-hidden />{t('pieces.disponible')} · {Math.max(1, Math.round(p.tailleOctets / 1024))} Ko</span>;
    if (p.statutAnalyse === 'INFECTEE') return <span className="text-destructive"><ShieldAlert size={14} className="mr-1 inline" aria-hidden />{p.motifRejet}</span>;
    return <span className="text-destructive">{ko}{p.motifRejet}</span>;
  };
  const etatLocal = (e: EnvoiLocal): ReactNode => {
    if (!e.refus) {
      return (
        <span className="block text-muted-foreground">
          <span className="mb-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${e.progression}%` }} /></span>
          {t('pieces.envoi', { p: e.progression })}
        </span>
      );
    }
    const motif = e.refus.motif === 'tropGros' ? t('pieces.tropGros', { n: e.refus.mo ?? 0 }) : e.refus.motif === 'format' ? t('pieces.format') : e.refus.message;
    return <span className="text-destructive"><AlertCircle size={14} className="mr-1 inline" aria-hidden />{motif}</span>;
  };

  return (
    <Carte titre={t('pieces.titre')}>
      {!lecture && (
        <div
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); vm.ajouterFichiers(e.dataTransfer.files); }}
          className={cx('flex items-center gap-3 rounded-lg border-2 border-dashed p-4', survol ? 'border-primary bg-accent' : 'border-primary-200')}
        >
          <Upload size={22} className="text-primary" aria-hidden />
          <div>
            <p>
              {t('pieces.deposer')}{' '}
              <button type="button" className="text-primary underline underline-offset-4" onClick={() => champ.current?.click()}>{t('pieces.parcourir')}</button>
            </p>
            <p className="text-sm text-muted-foreground">{t('pieces.formats')}</p>
          </div>
          <input
            ref={champ}
            type="file"
            multiple
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => { if (e.target.files) vm.ajouterFichiers(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}
      <ul className="mt-3 divide-y divide-border" aria-live="polite">
        {acte.pieces.map((p) => (
          <LignePiece
            key={p.id}
            nom={p.nomFichier}
            etat={etatServeur(p)}
            onRetirer={lecture ? undefined : () => void vm.retirerPiece(p.id)}
            telecharger={p.statutAnalyse === 'SAINE' ? actesApi.urlPiece(acte.id, p.id) : undefined}
          />
        ))}
        {vm.envois.map((e) => (
          <LignePiece key={e.cle} nom={e.nomFichier} etat={etatLocal(e)} onRetirer={e.refus ? () => vm.retirerEnvoi(e.cle) : undefined} />
        ))}
        {lecture && acte.pieces.length === 0 && <li className="py-2 text-muted-foreground">{t('pieces.aucune')}</li>}
      </ul>
    </Carte>
  );
}

// ─────────── Panneaux latéraux ───────────
function Informations({ b, acte, modifier }: { b: Brouillon; acte: Acte; modifier: (c: Partial<Brouillon>) => void }) {
  const { t } = useT();
  return (
    <Carte titre={t('editeur.informations')}>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="champ-objet">{t('editeur.objet')} <span className="text-destructive" aria-hidden>*</span></Label>
          <textarea
            id="champ-objet"
            rows={2}
            maxLength={300}
            value={b.objet}
            onChange={(e) => modifier({ objet: e.target.value })}
            aria-describedby="aide-objet"
            className="w-full rounded-md border border-input bg-card p-3 text-base sm:text-sm"
          />
          <p id="aide-objet" className="text-xs text-muted-foreground">{t('editeur.objetAide')}</p>
        </div>
        {acte.structuresPossibles.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="champ-structure">{t('editeur.structure')}</Label>
            <select id="champ-structure" value={b.structureId} onChange={(e) => modifier({ structureId: e.target.value })} className="h-10 w-full rounded-md border border-input bg-card px-3">
              {acte.structuresPossibles.map((s) => (
                <option key={s.id} value={s.id}>{s.chaine.join(' / ')} · {s.libelle}</option>
              ))}
            </select>
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('editeur.langue')}</legend>
          <div className="flex gap-6">
            {(['FR', 'EN'] as const).map((l) => (
              <label key={l} className="flex items-center gap-2">
                <input type="radio" name="langue" checked={b.langue === l} onChange={() => modifier({ langue: l })} className="size-4 accent-primary" />
                {l === 'FR' ? t('editeur.francais') : t('editeur.anglais')}
              </label>
            ))}
          </div>
          <label className="flex items-start gap-2 pt-1">
            <input type="checkbox" checked={b.traductionRequise} onChange={(e) => modifier({ traductionRequise: e.target.checked })} className="mt-1 size-4 accent-primary" />
            <span>{t('editeur.traduction')}</span>
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('editeur.confidentialite')}</legend>
          <div className="grid grid-cols-3 rounded-md bg-muted p-1" role="radiogroup">
            {(['PUBLIC', 'INTERNE', 'CONFIDENTIEL'] as Niveau[]).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={b.confidentialite === n}
                onClick={() => modifier({ confidentialite: n })}
                className={cx('rounded px-2 py-2 text-sm', b.confidentialite === n ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {t(`conf.${n}` as CleTraduction)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t(`conf.aide.${b.confidentialite}` as CleTraduction)}</p>
        </fieldset>
      </div>
    </Carte>
  );
}

function CircuitPrevu({ acte }: { acte: Acte }) {
  const { t } = useT();
  if (!acte.circuit) return null;
  const etapes = [...acte.circuit.etapes.map((e) => ({ cle: e.id, ordre: e.ordre, libelle: e.libelle, delai: `${e.delaiHeures} h` })), { cle: 'sig', ordre: acte.circuit.etapes.length + 1, libelle: t('editeur.signatureEtape', { s: acte.circuit.signature }), delai: '' }];
  return (
    <Carte titre={t('editeur.circuitPrevu')} droite={t('editeur.nbEtapes', { n: etapes.length })}>
      <ol className="space-y-3">
        {etapes.map((e) => {
          const courante = acte.etapeCourante?.ordre === e.ordre;
          return (
            <li key={e.cle} className="flex items-center gap-3" aria-current={courante ? 'step' : undefined}>
              <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold', courante ? 'bg-primary text-primary-foreground' : e.cle === 'sig' ? 'bg-[#f0eafb] text-[#5a32a3]' : 'bg-accent text-accent-foreground')}>{e.ordre}</span>
              <span className={cx('flex-1', courante && 'font-semibold')}>{e.libelle}</span>
              <span className="text-sm text-muted-foreground">{e.delai}</span>
            </li>
          );
        })}
      </ol>
    </Carte>
  );
}

// ─────────── Écran ───────────
export function Editeur({ id }: { id: string }) {
  const { t } = useT();
  const vm = useEditeurViewModel(id);
  if (vm.erreurChargement) return <Alert variant="destructive">{vm.erreurChargement}</Alert>;
  if (!vm.acte || !vm.brouillon) return <p className="text-muted-foreground">{t('commun.chargement')}</p>;
  return <EditeurCharge key={vm.generation} vm={vm} acte={vm.acte} b={vm.brouillon} />;
}

/** Motif de la correction demandée (RG-06), visible tant que l'acte est à corriger. */
function BandeauCorrection({ id }: { id: string }) {
  const { t, langue } = useT();
  const { data } = useQuery({ queryKey: ['suivi', id], queryFn: () => parapheurApi.suivi(id) });
  const r = data?.dernierRenvoi;
  if (!r) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-[#f6d3ae] bg-[#fef3e7] p-4 text-[#9a4507]">
      <Undo2 size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t('c9.titre', { nom: r.viseur, d: new Date(r.le).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}</p>
        <p>« {r.observation} »</p>
        <p className="text-sm">{t('c9.retour')}</p>
      </div>
    </div>
  );
}

/** RG-03 : où se trouve chaque champ exigé, et où l'y conduire (id de l'élément à mettre au point). */
const CHAMPS: Record<string, { libelle: CleTraduction; ou: CleTraduction; cible: string }> = {
  objet: { libelle: 'aCompleter.objet', ou: 'aCompleter.objetOu', cible: 'champ-objet-document' },
  contenu: { libelle: 'aCompleter.contenu', ou: 'aCompleter.contenuOu', cible: 'champ-contenu' },
  ampliation: { libelle: 'aCompleter.ampliation', ou: 'aCompleter.ampliationOu', cible: 'champ-ampliation' },
};

function allerAuChamp(champ: string) {
  const el = document.getElementById(CHAMPS[champ]?.cible ?? '');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus();
}

/** Liste « À compléter » toujours visible : champs exigés cochés en direct (RG-03). */
function ACompleter({ exiges, restants }: { exiges: string[]; restants: string[] }) {
  const { t } = useT();
  return (
    <Carte titre={t('aCompleter.titre')}>
      <p className="mb-3 text-sm text-muted-foreground">{t('aCompleter.auto')}</p>
      <ul className="space-y-2">
        {exiges.map((c) => {
          const fait = !restants.includes(c);
          return (
            <li key={c} className="flex items-start gap-2">
              {fait ? <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />}
              <span className="flex-1">
                <span className={cx('block', fait ? 'text-success' : 'font-medium')}>
                  {t(CHAMPS[c]?.libelle ?? 'aCompleter.objet')}
                  <span className="sr-only">{fait ? ' (fait)' : ' (à faire)'}</span>
                </span>
                {!fait && (
                  <button type="button" onClick={() => allerAuChamp(c)} className="text-left text-sm text-primary underline underline-offset-4">
                    {t(CHAMPS[c]?.ou ?? 'aCompleter.objetOu')}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {restants.length === 0 && <p className="mt-3 text-sm font-medium text-success">{t('aCompleter.pret')}</p>}
    </Carte>
  );
}

function EditeurCharge({ vm, acte, b }: { vm: VM; acte: Acte; b: Brouillon }) {
  const { t } = useT();
  const lecture = !acte.modifiable;
  const editor = useEditeurRiche(b.contenu, (contenu) => vm.modifier({ contenu }), t('editeur.texte'));
  const structure = acte.structuresPossibles.find((s) => s.id === b.structureId) ?? acte.structure;
  // Recalculé à chaque frappe : la liste « À compléter » et les champs en rouge suivent la saisie.
  const restants = champsManquantsLocaux(acte.champsObligatoires, b);
  const manque = (c: string) => vm.manquants.includes(c) && restants.includes(c);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
        <Link href="/mes-actes" aria-label={t('editeur.retour')} className="grid size-11 place-items-center rounded-md border border-input hover:bg-accent">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <CodeType code={acte.type.code} />
            <span className="truncate text-lg font-semibold">{b.objet || t('mesActes.sansObjet')}</span>
            <StatutBadge statut={acte.statut} />
          </p>
          <p className="mt-1 text-sm">{lecture ? <span className="text-muted-foreground">{acte.etapeCourante && t('editeur.position', { e: acte.etapeCourante.libelle })}</span> : <EtatEnregistrement vm={vm} />}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled title={t('commun.bientot')}><History size={18} aria-hidden /> {t('editeur.versions')}</Button>
          <Button variant="outline" onClick={() => void vm.ouvrirApercu()}><Eye size={18} aria-hidden /> {t('editeur.apercuPdf')}</Button>
          {!lecture && (
            <Button onClick={vm.preparerSoumission} disabled={vm.actionEnCours || vm.etat === 'conflit'}>
              <Send size={18} aria-hidden /> {acte.statut === 'A_CORRIGER' ? t('editeur.resoumettre') : t('editeur.soumettre')}
            </Button>
          )}
        </div>
      </div>

      {vm.etat === 'conflit' && (
        <Alert variant="destructive">
          {t('editeur.conflit')}{' '}
          <button className="font-semibold underline" onClick={() => void vm.recharger()}>{t('editeur.recharger')}</button>
        </Alert>
      )}
      {lecture && <Alert>{t('editeur.lectureSeule')}</Alert>}
      {acte.statut === 'A_CORRIGER' && <BandeauCorrection id={acte.id} />}
      {vm.erreurAction && <Alert variant="destructive">{vm.erreurAction}</Alert>}
      {vm.manquants.length > 0 && restants.length > 0 && (
        <Alert variant="destructive">
          <strong>{t('soumission.completez')}</strong>
          <ul className="mt-1 list-disc pl-5">
            {restants.map((c) => (
              <li key={c}>
                <button type="button" className="text-left underline" onClick={() => allerAuChamp(c)}>
                  {t(CHAMPS[c]?.libelle ?? 'aCompleter.objet')}
                </button>{' '}
                — {t(CHAMPS[c]?.ou ?? 'aCompleter.objetOu')}
              </li>
            ))}
          </ul>
          {t('soumission.resteBrouillon')}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {!lecture && editor && <BarreOutils editor={editor} />}
          <article className="space-y-6 rounded-lg border border-border bg-white p-6 text-[#1a2033] shadow-sm sm:p-12">
            <EnTeteOfficiel chaine={structure.chaine} mention={t('editeur.enteteOfficiel')} />
            <TitreActe
              code={acte.type.code}
              numero={acte.reference ?? <span className="reference rounded bg-primary-50 px-2 py-0.5 text-sm font-normal text-primary-700">{t('editeur.numero')}</span>}
              objet={
                lecture ? (
                  b.objet
                ) : (
                  // L'objet se saisit là où il s'affiche (il reste aussi dans le panneau « Informations »).
                  <input
                    id="champ-objet-document"
                    value={b.objet}
                    maxLength={300}
                    onChange={(e) => vm.modifier({ objet: e.target.value })}
                    placeholder={t('editeur.objetPlaceholder')}
                    aria-label={t('editeur.objet')}
                    aria-invalid={manque('objet') || undefined}
                    className={cx(
                      'w-full max-w-xl rounded border bg-transparent px-3 py-1 text-center italic placeholder:text-muted-foreground',
                      manque('objet') ? 'border-destructive ring-2 ring-destructive' : 'border-dashed border-primary-300 hover:border-primary',
                    )}
                  />
                )
              }
            />
            {lecture ? <CorpsActe html={b.contenu} /> : <ZoneTexte editor={editor} invalide={manque('contenu')} />}
            <div className="grid gap-6 sm:grid-cols-2">
              <Ampliations valeurs={b.ampliations} onChange={(ampliations) => vm.modifier({ ampliations })} invalide={manque('ampliation')} lecture={lecture} />
              <div className="text-right font-serif">
                <p>{t('editeur.faitA')} <span className="reference text-sm text-muted-foreground">{t('editeur.dateSignature')}</span></p>
                <p className="mt-2 font-bold">{acte.circuit?.signature}</p>
              </div>
            </div>
          </article>
          {acte.supprimable && (
            <Button variant="outline-destructive" onClick={vm.demanderSuppression}><Trash2 size={18} aria-hidden /> {t('editeur.supprimerBrouillon')}</Button>
          )}
        </div>

        <aside className="space-y-6">
          {!lecture && <ACompleter exiges={acte.champsObligatoires} restants={restants} />}
          {lecture ? null : <Informations b={b} acte={acte} modifier={vm.modifier} />}
          <Pieces vm={vm} acte={acte} lecture={lecture} />
          <CircuitPrevu acte={acte} />
        </aside>
      </div>

      <Dialogue ouvert={vm.confirmation === 'soumettre'} onFermer={vm.fermerConfirmation} titre={t('soumission.titre')}>
        <p className="text-muted-foreground">{t('soumission.texte')}</p>
        <div className="mt-4"><CircuitPrevu acte={acte} /></div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={vm.fermerConfirmation}>{t('soumission.continuer')}</Button>
          <Button onClick={vm.soumettre} disabled={vm.actionEnCours} autoFocus>{acte.statut === 'A_CORRIGER' ? t('editeur.resoumettre') : t('editeur.soumettre')}</Button>
        </div>
      </Dialogue>

      <Dialogue ouvert={vm.confirmation === 'supprimer'} onFermer={vm.fermerConfirmation} titre={t('supprimer.titre')} alerte>
        <p className="text-muted-foreground">{t('supprimer.texte', { objet: b.objet || t('mesActes.sansObjet'), n: acte.pieces.length })}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={vm.fermerConfirmation} autoFocus>{t('commun.annuler')}</Button>
          <Button variant="destructive" onClick={vm.supprimer} disabled={vm.actionEnCours}>{t('commun.supprimer')}</Button>
        </div>
      </Dialogue>
    </div>
  );
}
