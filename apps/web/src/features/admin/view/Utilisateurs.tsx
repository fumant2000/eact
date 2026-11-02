'use client';

// MVVM — Vues de l'organigramme, des comptes et des rôles (BF-06 à BF-08).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Dialogue } from '@/components/ui/Dialogue';
import { Button, cx, Input, Label } from '@/components/ui/primitives';
import { useProfil } from '@/features/auth/view-model/useSession';
import { useT, type CleTraduction } from '@/i18n';
import { notifierSucces } from '@/lib/notifications';
import { adminApi, ROLES, type Role, type StructureAdmin, type UtilisateurAdmin } from '../model/admin.api';

function Organigramme({ structures, onAjouter }: { structures: StructureAdmin[]; onAjouter: () => void }) {
  const { t } = useT();
  const enfants = (parentId: string | null): StructureAdmin[] => structures.filter((s) => s.parentId === parentId).sort((a, b) => a.code.localeCompare(b.code));
  const noeud = (s: StructureAdmin, profondeur: number) => (
    <li key={s.id}>
      <div className="flex items-baseline gap-2 py-1" style={{ paddingLeft: `${profondeur * 16}px` }}>
        <span className="reference text-xs font-semibold text-primary-700">{s.code}</span>
        <span className="text-sm">{s.libelle}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t('admin.agents', { n: s.agents })}</span>
      </div>
      <ul>{enfants(s.id).map((e) => noeud(e, profondeur + 1))}</ul>
    </li>
  );
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center justify-between font-semibold">
        {t('admin.organigramme')}
        <Button size="sm" variant="outline" onClick={onAjouter}><Plus size={14} aria-hidden /> {t('admin.ajouterStructure')}</Button>
      </h2>
      <ul>{enfants(null).map((s) => noeud(s, 0))}</ul>
    </section>
  );
}

function ChoixRoles({ valeur, onChange }: { valeur: Role[]; onChange: (r: Role[]) => void }) {
  const { t } = useT();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{t('admin.roles')} <span className="text-destructive" aria-hidden>*</span></legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={valeur.includes(r)} onChange={(e) => onChange(e.target.checked ? [...valeur, r] : valeur.filter((x) => x !== r))} />
            {t(`role.${r}` as CleTraduction)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AdminUtilisateurs() {
  const { t } = useT();
  const client = useQueryClient();
  const { data: profil } = useProfil();
  const { data: structures = [] } = useQuery({ queryKey: ['admin', 'structures'], queryFn: adminApi.structures });
  const { data: utilisateurs = [], isLoading } = useQuery({ queryKey: ['admin', 'utilisateurs'], queryFn: adminApi.utilisateurs });
  const [filtre, setFiltre] = useState('');
  const [creation, setCreation] = useState(false);
  const [nouvelleStructure, setNouvelleStructure] = useState(false);
  const [edition, setEdition] = useState<UtilisateurAdmin | null>(null);
  const [roles, setRoles] = useState<Role[]>(['REDACTEUR']);
  const rafraichir = () => client.invalidateQueries({ queryKey: ['admin'] });

  const action = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: async () => {
      notifierSucces('admin.enregistre');
      await rafraichir();
    },
  });
  const liste = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return utilisateurs.filter((u) => !f || `${u.prenom} ${u.nom} ${u.matricule} ${u.structure.code}`.toLowerCase().includes(f));
  }, [utilisateurs, filtre]);

  const champ = (f: FormData, n: string) => String(f.get(n) ?? '');
  const creer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    action.mutate(async () => {
      await adminApi.creerUtilisateur({ matricule: champ(f, 'matricule'), email: champ(f, 'email'), prenom: champ(f, 'prenom'), nom: champ(f, 'nom'), structureId: champ(f, 'structureId'), roles });
      notifierSucces('admin.activationEnvoyee');
      setCreation(false);
    });
  };
  const creerStructure = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    action.mutate(async () => {
      await adminApi.creerStructure({ code: champ(f, 'code'), libelle: champ(f, 'libelle'), parentId: champ(f, 'parentId') || undefined });
      setNouvelleStructure(false);
    });
  };
  const optionsStructures = structures.map((s) => <option key={s.id} value={s.id}>{s.chaine.join(' / ')} · {s.libelle}</option>);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('admin.utilisateurs')}</h1>
        <Button size="lg" onClick={() => { setRoles(['REDACTEUR']); setCreation(true); }}><Plus size={18} aria-hidden /> {t('admin.nouvelUtilisateur')}</Button>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <label className="relative block border-b border-border p-4">
            <span className="sr-only">{t('admin.filtrer')}</span>
            <Search size={16} className="absolute top-1/2 left-7 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={t('admin.filtrer')} className="pl-9" />
          </label>
          {isLoading && <p className="p-4 text-muted-foreground">{t('commun.chargement')}</p>}
          <ul className="divide-y divide-border">
            {liste.map((u) => (
              <li key={u.id} className={cx('flex flex-wrap items-center gap-3 p-4', !u.actif && 'opacity-60')}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {u.prenom} {u.nom} <span className="reference ml-1 text-xs font-normal text-muted-foreground">{u.matricule}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{u.structure.code} · {u.roles.map((r) => t(`role.${r}` as CleTraduction)).join(', ')}</p>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className={cx('rounded-full px-2 py-0.5', u.actif ? 'bg-[#e3f4ec] text-[#0b6447]' : 'bg-muted text-muted-foreground')}>{u.actif ? t('admin.actif') : t('admin.desactive')}</span>
                  {u.totpActive && <span className="rounded-full bg-[#fbf3e2] px-2 py-0.5 text-seal-700">{t('admin.2fa')}</span>}
                  {u.verrouille && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-destructive">{t('admin.verrouille')}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setRoles(u.roles); setEdition(u); }}>{t('admin.modifier')}</Button>
                  {u.verrouille && <Button size="sm" variant="outline" onClick={() => action.mutate(() => adminApi.deverrouiller(u.id))}>{t('admin.deverrouiller')}</Button>}
                  {u.id !== profil?.id && (
                    <Button size="sm" variant={u.actif ? 'outline-destructive' : 'outline'} onClick={() => action.mutate(() => adminApi.modifierUtilisateur(u.id, { actif: !u.actif }))}>
                      {u.actif ? t('admin.desactiver') : t('admin.reactiver')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Organigramme structures={structures} onAjouter={() => setNouvelleStructure(true)} />
      </div>

      <Dialogue ouvert={creation} onFermer={() => setCreation(false)} titre={t('admin.nouvelUtilisateur')}>
        <form className="space-y-4" onSubmit={creer}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="matricule">{t('admin.matricule')}</Label><Input id="matricule" name="matricule" required placeholder="MINESUP-08001" /></div>
            <div className="space-y-1"><Label htmlFor="email">{t('admin.email')}</Label><Input id="email" name="email" type="email" required /></div>
            <div className="space-y-1"><Label htmlFor="prenom">{t('admin.prenom')}</Label><Input id="prenom" name="prenom" required /></div>
            <div className="space-y-1"><Label htmlFor="nom">{t('admin.nom')}</Label><Input id="nom" name="nom" required /></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="structureId">{t('admin.structure')}</Label>
            <select id="structureId" name="structureId" required className="h-10 w-full rounded-md border border-input bg-card px-3">{optionsStructures}</select>
          </div>
          <ChoixRoles valeur={roles} onChange={setRoles} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreation(false)}>{t('commun.annuler')}</Button>
            <Button type="submit" disabled={!roles.length || action.isPending}>{t('admin.creer')}</Button>
          </div>
        </form>
      </Dialogue>

      <Dialogue ouvert={!!edition} onFermer={() => setEdition(null)} titre={edition ? `${edition.prenom} ${edition.nom}` : ''}>
        {edition && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action.mutate(async () => {
                await adminApi.modifierUtilisateur(edition.id, { structureId: champ(f, 'structureId'), roles });
                setEdition(null);
              });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="structure-edition">{t('admin.structure')}</Label>
              <select id="structure-edition" name="structureId" defaultValue={edition.structure.id} className="h-10 w-full rounded-md border border-input bg-card px-3">{optionsStructures}</select>
            </div>
            <ChoixRoles valeur={roles} onChange={setRoles} />
            <div className="flex flex-wrap justify-between gap-3">
              {edition.totpActive ? (
                <Button type="button" variant="outline-destructive" onClick={() => action.mutate(async () => { await adminApi.reinitialiserMfa(edition.id); setEdition(null); })}>{t('admin.reinitMfa')}</Button>
              ) : <span />}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setEdition(null)}>{t('commun.annuler')}</Button>
                <Button type="submit" disabled={!roles.length || action.isPending}>{t('admin.modifier')}</Button>
              </div>
            </div>
          </form>
        )}
      </Dialogue>

      <Dialogue ouvert={nouvelleStructure} onFermer={() => setNouvelleStructure(false)} titre={t('admin.ajouterStructure')}>
        <form className="space-y-4" onSubmit={creerStructure}>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1"><Label htmlFor="code">{t('admin.sigle')}</Label><Input id="code" name="code" required pattern="[A-Za-z0-9-]{2,20}" placeholder="SDRH" /></div>
            <div className="space-y-1"><Label htmlFor="libelle">{t('admin.libelle')}</Label><Input id="libelle" name="libelle" required minLength={3} /></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="parentId">{t('admin.parent')}</Label>
            <select id="parentId" name="parentId" className="h-10 w-full rounded-md border border-input bg-card px-3">
              <option value="">{t('admin.aucune')}</option>
              {optionsStructures}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setNouvelleStructure(false)}>{t('commun.annuler')}</Button>
            <Button type="submit" disabled={action.isPending}>{t('admin.creer')}</Button>
          </div>
        </form>
      </Dialogue>
    </section>
  );
}
