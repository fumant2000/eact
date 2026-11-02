'use client';

// MVVM — Vue « Modèles et gabarits GitHub » (BF-59, RG-23).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Alert, Button } from '@/components/ui/primitives';
import { CodeType } from '@/features/actes/view/Document';
import { useT } from '@/i18n';
import { adminApi } from '../model/admin.api';

export function AdminGabarits() {
  const { t, langue } = useT();
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'gabarits'], queryFn: adminApi.gabarits });
  const synchro = useMutation({ mutationFn: adminApi.synchroniser, onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'gabarits'] }) });
  const fmt = (iso: string) => new Date(iso).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const s = data?.synchronisation;
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('admin.gabarits')}</h1>
          <p className="mt-1 text-muted-foreground">
            {s?.depot ? <>{t('admin.depot')} : <span className="reference">{s.depot}</span> · </> : null}
            {t('admin.derniereSynchro', { d: s?.derniereReussite ? fmt(s.derniereReussite) : t('admin.jamais') })}
          </p>
        </div>
        <Button size="lg" onClick={() => synchro.mutate()} disabled={synchro.isPending || !s?.depot}>
          <RefreshCw size={18} className={synchro.isPending ? 'animate-spin' : ''} aria-hidden /> {t('admin.synchroniser')}
        </Button>
      </header>
      {!s?.depot && !isLoading && <Alert>{t('admin.depotAucun')}</Alert>}
      {synchro.data && (synchro.data.erreur ? <Alert variant="warning">{t('admin.synchroEchec')} ({synchro.data.erreur})</Alert> : <Alert variant="success">{t('admin.synchroResultat', { m: synchro.data.misAJour, i: synchro.data.inchanges })}</Alert>)}
      {synchro.data?.ignores.map((x) => <Alert key={x} variant="warning">{x}</Alert>)}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr className="h-10">
              <th className="px-4 font-medium">Type</th>
              <th className="px-4 font-medium">{t('admin.libelle')}</th>
              <th className="px-4 font-medium">{t('admin.version')}</th>
              <th className="px-4 font-medium">{t('admin.commit')}</th>
              <th className="px-4 font-medium">{t('admin.utilisations')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.modeles.map((m) => (
              <tr key={m.id} className="h-12">
                <td className="px-4"><CodeType code={m.type.code} /></td>
                <td className="px-4"><span className="block font-medium">{m.libelle}</span><span className="reference text-xs text-muted-foreground">{m.chemin}</span></td>
                <td className="px-4 reference">v{m.version}</td>
                <td className="px-4 reference text-xs" title={m.commitSha}>{m.commitSha.slice(0, 7)} · {fmt(m.misAJourLe)}</td>
                <td className="px-4 tabular-nums">{m.utilisations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
