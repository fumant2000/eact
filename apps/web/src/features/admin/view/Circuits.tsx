'use client';

// MVVM — Vues J4 (types d'actes) et J5 (éditeur de circuits) : BF-64, BF-65, ENF-08.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, cx, Input, Label } from '@/components/ui/primitives';
import { CodeType } from '@/features/actes/view/Document';
import { useT, type CleTraduction } from '@/i18n';
import { notifierSucces } from '@/lib/notifications';
import { adminApi, CHAMPS, ROLES, type Etape, type Role, type TypeAdmin } from '../model/admin.api';

const LIBELLES_CHAMPS: Record<string, CleTraduction> = { objet: 'aCompleter.objet', contenu: 'aCompleter.contenu', ampliation: 'aCompleter.ampliation' };

function SelectRole({ valeur, onChange, id }: { valeur: Role; onChange: (r: Role) => void; id?: string }) {
  const { t } = useT();
  return (
    <select id={id} value={valeur} onChange={(e) => onChange(e.target.value as Role)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
      {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}` as CleTraduction)}</option>)}
    </select>
  );
}

/** Une ligne d'étape : chaque champ s'enregistre quand on le quitte. */
function LigneEtape({ e, onModifier, onSupprimer }: { e: Etape; onModifier: (d: Partial<Etape>) => void; onSupprimer: () => void }) {
  const { t } = useT();
  return (
    <li className="grid items-center gap-2 py-2 sm:grid-cols-[32px_1fr_190px_90px_40px]">
      <span className="grid size-7 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{e.ordre}</span>
      <Input aria-label={t('admin.etape')} defaultValue={e.libelle} onBlur={(ev) => ev.target.value.trim() !== e.libelle && onModifier({ libelle: ev.target.value.trim() })} className="h-9" />
      <SelectRole valeur={e.roleRequis} onChange={(roleRequis) => onModifier({ roleRequis })} />
      <Input aria-label={t('admin.delai')} type="number" min={1} max={720} defaultValue={e.delaiHeures} onBlur={(ev) => Number(ev.target.value) !== e.delaiHeures && onModifier({ delaiHeures: Number(ev.target.value) })} className="h-9" />
      {e.utilisee ? (
        <span className="text-xs text-muted-foreground" title={t('admin.etapeUtilisee')}>—</span>
      ) : (
        <button type="button" aria-label={t('admin.supprimerEtape', { e: e.libelle })} onClick={onSupprimer} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:text-destructive">
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}

function NouvelleEtape({ onAjouter, libelleBouton }: { onAjouter: (e: { libelle: string; roleRequis: Role; delaiHeures: number }) => void; libelleBouton: string }) {
  const { t } = useT();
  const [libelle, setLibelle] = useState('');
  const [role, setRole] = useState<Role>('VISEUR');
  const [delai, setDelai] = useState(48);
  return (
    <div className="grid items-end gap-2 border-t border-dashed border-border pt-3 sm:grid-cols-[1fr_190px_90px_auto]">
      <div className="space-y-1"><Label className="text-xs">{t('admin.etape')}</Label><Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Visa du directeur" className="h-9" /></div>
      <div className="space-y-1"><Label className="text-xs">{t('admin.role')}</Label><SelectRole valeur={role} onChange={setRole} /></div>
      <div className="space-y-1"><Label className="text-xs">{t('admin.delai')}</Label><Input type="number" min={1} max={720} value={delai} onChange={(e) => setDelai(Number(e.target.value))} className="h-9" /></div>
      <Button size="sm" variant="outline" disabled={libelle.trim().length < 3} onClick={() => { onAjouter({ libelle: libelle.trim(), roleRequis: role, delaiHeures: delai }); setLibelle(''); }}>
        <Plus size={14} aria-hidden /> {libelleBouton}
      </Button>
    </div>
  );
}

function CarteType({ ty, structures, executer }: { ty: TypeAdmin; structures: { id: string; libelle: string; chaine: string[] }[]; executer: (f: () => Promise<unknown>) => void }) {
  const { t } = useT();
  const [structureNouveau, setStructureNouveau] = useState('');
  const sansCircuit = structures.filter((s) => !ty.circuits.some((c) => c.structure.id === s.id));
  return (
    <article className="space-y-4 rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <CodeType code={ty.code} />
        <h2 className="text-lg font-semibold">{ty.libelle}</h2>
        {ty.signeHorsMinistere && <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('admin.horsMinistere')}</span>}
        <span className="ml-auto text-sm text-muted-foreground">{t('admin.actesCrees', { n: ty.nbActes })}</span>
      </header>
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('admin.champsObligatoires')}</legend>
          <div className="flex flex-wrap gap-4">
            {CHAMPS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={ty.champsObligatoires.includes(c)}
                  onChange={(e) => executer(() => adminApi.modifierType(ty.id, { champsObligatoires: e.target.checked ? [...ty.champsObligatoires, c] : ty.champsObligatoires.filter((x) => x !== c) }))}
                />
                {t(LIBELLES_CHAMPS[c])}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1">
          <Label htmlFor={`conservation-${ty.id}`} className="text-sm">{t('admin.conservation')}</Label>
          <Input
            id={`conservation-${ty.id}`}
            type="number"
            min={1}
            max={100}
            placeholder={t('admin.definitive')}
            defaultValue={ty.dureeConservationAnnees ?? ''}
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              if (v !== ty.dureeConservationAnnees) executer(() => adminApi.modifierType(ty.id, { dureeConservationAnnees: v }));
            }}
            className="h-9"
          />
        </div>
      </div>

      {ty.circuits.length === 0 && <p className="text-sm text-warning">{t('admin.aucunCircuit')}</p>}
      {ty.circuits.map((c) => (
        <section key={c.id} className="rounded-md border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold">{t('admin.circuitPour', { s: `${c.structure.chaine.join(' / ')} · ${c.structure.libelle}` })}</h3>
          <div className="hidden text-xs text-muted-foreground sm:grid sm:grid-cols-[32px_1fr_190px_90px_40px] sm:gap-2">
            <span /> <span>{t('admin.etape')}</span> <span>{t('admin.role')}</span> <span>{t('admin.delai')}</span> <span />
          </div>
          <ol>
            {c.etapes.map((e) => (
              <LigneEtape key={e.id} e={e} onModifier={(d) => executer(() => adminApi.modifierEtape(e.id, d))} onSupprimer={() => executer(() => adminApi.supprimerEtape(e.id))} />
            ))}
          </ol>
          <NouvelleEtape libelleBouton={t('admin.ajouterEtape')} onAjouter={(e) => executer(() => adminApi.ajouterEtape(c.id, e))} />
        </section>
      ))}

      {/* Tout type peut recevoir un circuit, y compris le projet de décret (visas internes, ADR 0008). */}
      {sansCircuit.length > 0 && (
          <details className="rounded-md border border-dashed border-primary-300 p-4">
            <summary className="cursor-pointer text-sm font-medium text-primary">{t('admin.nouveauCircuit')}</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor={`structure-${ty.id}`} className="text-sm">{t('admin.structureEmettrice')}</Label>
                <select id={`structure-${ty.id}`} value={structureNouveau} onChange={(e) => setStructureNouveau(e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm">
                  <option value="">—</option>
                  {sansCircuit.map((s) => <option key={s.id} value={s.id}>{s.chaine.join(' / ')} · {s.libelle}</option>)}
                </select>
              </div>
              {structureNouveau && (
                <NouvelleEtape
                  libelleBouton={t('admin.nouveauCircuit')}
                  onAjouter={(e) => executer(async () => { await adminApi.creerCircuit({ typeActeId: ty.id, structureId: structureNouveau, etapes: [e] }); setStructureNouveau(''); })}
                />
              )}
            </div>
          </details>
        )}
    </article>
  );
}

export function AdminCircuits() {
  const { t } = useT();
  const client = useQueryClient();
  const { data: types = [], isLoading } = useQuery({ queryKey: ['admin', 'types'], queryFn: adminApi.types });
  const { data: structures = [] } = useQuery({ queryKey: ['admin', 'structures'], queryFn: adminApi.structures });
  const action = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => notifierSucces('admin.enregistre'),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'types'] }),
  });
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('admin.circuits')}</h1>
      <Alert>{t('admin.enf08')}</Alert>
      {isLoading && <p className="text-muted-foreground">{t('commun.chargement')}</p>}
      <div className={cx('space-y-6', action.isPending && 'opacity-80')}>
        {types.map((ty) => <CarteType key={ty.id} ty={ty} structures={structures} executer={(f) => action.mutate(f)} />)}
      </div>
    </section>
  );
}
