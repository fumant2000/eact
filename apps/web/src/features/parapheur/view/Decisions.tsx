'use client';

// Composants du parapheur : badge d'échéance et boîtes de décision viser, corriger, rejeter (BF-24 à BF-26).
import { AlertTriangle, Check, Clock, Hourglass, Undo2, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Dialogue } from '@/components/ui/Dialogue';
import { Alert, Button, cx, Label } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { etatEcheance } from '../model/parapheur.api';

export function BadgeEcheance({ echeance }: { echeance: string | null }) {
  const { t } = useT();
  const e = etatEcheance(echeance);
  if (!e) return null;
  const [classe, Icone, libelle] =
    e.niveau === 'retard'
      ? ['bg-[#fdecec] text-[#a81f26]', AlertTriangle, e.jours >= 1 ? t('echeance.retard', { n: e.jours }) : t('echeance.retardH', { n: e.heures })]
      : e.niveau === 'proche'
        ? ['bg-[#fef3e7] text-[#9a4507]', Hourglass, t('echeance.heures', { n: e.heures })]
        : ['bg-muted text-muted-foreground', Clock, t('echeance.jour', { n: e.jours })];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium whitespace-nowrap', classe)}>
      <Icone size={14} aria-hidden /> {libelle}
    </span>
  );
}

function Entete({ icone, ton, children }: { icone: ReactNode; ton: 'primaire' | 'alerte' | 'danger'; children: ReactNode }) {
  const fond = { primaire: 'bg-accent text-primary', alerte: 'bg-[#fef3e7] text-warning', danger: 'bg-[#fdecec] text-destructive' }[ton];
  return (
    <span className="flex items-center gap-3">
      <span className={cx('grid size-10 place-items-center rounded-lg', fond)} aria-hidden>{icone}</span>
      {children}
    </span>
  );
}

function ZoneMotif({ id, libelle, obligatoire, valeur, onChange, erreur }: { id: string; libelle: string; obligatoire?: boolean; valeur: string; onChange: (v: string) => void; erreur?: boolean }) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {libelle} {obligatoire ? <span className="text-destructive" aria-hidden>*</span> : <span className="font-normal text-muted-foreground">{t('visa.facultative')}</span>}
      </Label>
      <textarea
        id={id}
        rows={3}
        maxLength={500}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur || undefined}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className={cx('w-full rounded-md border bg-card p-3', erreur ? 'border-destructive' : 'border-input')}
      />
      <div className="flex justify-between text-xs">
        <span id={`${id}-erreur`} className="text-destructive">{erreur && t('motif.obligatoire')}</span>
        <span className="text-muted-foreground">{valeur.length} / 500</span>
      </div>
    </div>
  );
}

/** Viser (observation facultative). */
export function DialogueVisa({
  ouvert,
  objet,
  etapeSuivante,
  onAnnuler,
  onConfirmer,
  enCours,
}: {
  ouvert: boolean;
  objet: string;
  etapeSuivante: string | null;
  onAnnuler: () => void;
  onConfirmer: (observation?: string) => void;
  enCours?: boolean;
}) {
  const { t } = useT();
  const [observation, setObservation] = useState('');
  return (
    <Dialogue ouvert={ouvert} onFermer={onAnnuler} titre={<Entete icone={<Check size={20} />} ton="primaire">{t('visa.titre')}</Entete>}>
      <div className="space-y-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="font-semibold">{objet}</p>
          <p className="text-sm text-muted-foreground">{etapeSuivante ? t('visa.etapeSuivante', { e: etapeSuivante }) : t('visa.derniereEtape')}</p>
        </div>
        <ZoneMotif id="observation-visa" libelle={t('visa.observation')} valeur={observation} onChange={setObservation} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onAnnuler}>{t('commun.annuler')}</Button>
          <Button autoFocus disabled={enCours} onClick={() => { onConfirmer(observation.trim() || undefined); setObservation(''); }}>
            {t('visa.confirmer')}
          </Button>
        </div>
      </div>
    </Dialogue>
  );
}

/** Demander une correction : étape de retour + motif obligatoire (RG-06). */
export function DialogueCorrection({
  ouvert,
  redacteur,
  etapesFranchies,
  onAnnuler,
  onConfirmer,
  enCours,
}: {
  ouvert: boolean;
  redacteur: string;
  etapesFranchies: { ordre: number; libelle: string; viseurs: string[] }[];
  onAnnuler: () => void;
  onConfirmer: (etapeRetour: number, motif: string) => void;
  enCours?: boolean;
}) {
  const { t } = useT();
  const [retour, setRetour] = useState(0);
  const [motif, setMotif] = useState('');
  const [essai, setEssai] = useState(false);
  const choix = [{ ordre: 0, libelle: t('correction.redaction'), aide: t('correction.redactionAide', { nom: redacteur }) }, ...etapesFranchies.map((e) => ({ ordre: e.ordre, libelle: e.libelle, aide: e.viseurs.join(', ') }))];
  return (
    <Dialogue ouvert={ouvert} onFermer={onAnnuler} titre={<Entete icone={<Undo2 size={20} />} ton="alerte">{t('correction.titre')}</Entete>}>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t('correction.renvoyer')} <span className="text-destructive" aria-hidden>*</span></legend>
          {choix.map((c) => (
            <label key={c.ordre} className={cx('flex cursor-pointer items-start gap-3 rounded-lg border p-3', retour === c.ordre ? 'border-primary bg-accent' : 'border-border')}>
              <input type="radio" name="retour" checked={retour === c.ordre} onChange={() => setRetour(c.ordre)} className="mt-1 size-4 accent-primary" />
              <span>
                <span className="block font-semibold">{c.libelle}</span>
                <span className="block text-sm text-muted-foreground">{c.aide}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ZoneMotif id="motif-correction" libelle={t('correction.motif')} obligatoire valeur={motif} onChange={setMotif} erreur={essai && !motif.trim()} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onAnnuler}>{t('commun.annuler')}</Button>
          <Button
            disabled={enCours}
            onClick={() => {
              setEssai(true);
              if (motif.trim()) onConfirmer(retour, motif.trim());
            }}
          >
            {t('correction.envoyer')}
          </Button>
        </div>
      </div>
    </Dialogue>
  );
}

/** Rejeter définitivement : motif obligatoire, bouton désactivé tant qu'il manque (RG-05). */
export function DialogueRejet({ ouvert, onAnnuler, onConfirmer, enCours }: { ouvert: boolean; onAnnuler: () => void; onConfirmer: (motif: string) => void; enCours?: boolean }) {
  const { t } = useT();
  const [motif, setMotif] = useState('');
  return (
    <Dialogue ouvert={ouvert} onFermer={onAnnuler} alerte titre={<Entete icone={<XCircle size={20} />} ton="danger">{t('rejet.titre')}</Entete>}>
      <div className="space-y-4">
        <Alert variant="destructive">{t('rejet.avertissement')}</Alert>
        <ZoneMotif id="motif-rejet" libelle={t('rejet.motif')} obligatoire valeur={motif} onChange={setMotif} erreur={!motif.trim()} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onAnnuler} autoFocus>{t('commun.annuler')}</Button>
          <Button variant="destructive" disabled={!motif.trim() || enCours} onClick={() => onConfirmer(motif.trim())}>{t('rejet.confirmer')}</Button>
        </div>
      </div>
    </Dialogue>
  );
}
