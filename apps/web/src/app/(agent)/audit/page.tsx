'use client';

// I1 · Journal d'audit et I3 · Vérifier l'intégrité (auditeur, administrateur).
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Alert, Button } from '@/components/ui/primitives';
import { useAuditViewModel } from '@/features/audit/view-model/useAuditViewModel';
import { useT } from '@/i18n';

export default function AuditPage() {
  const { t, langue } = useT();
  const vm = useAuditViewModel();

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary-900 dark:text-foreground">{t('menu.audit')}</h1>
        <Button onClick={vm.verifier} disabled={vm.verificationEnCours}>
          <ShieldCheck size={18} aria-hidden /> {langue === 'FR' ? "Vérifier l'intégrité" : 'Verify integrity'}
        </Button>
      </header>

      {vm.resultat &&
        (vm.resultat.integre ? (
          <Alert variant="success">
            {langue === 'FR' ? 'Chaîne intègre : chaque entrée contient bien l’empreinte de la précédente.' : 'Chain intact: every entry holds the previous entry’s hash.'}
          </Alert>
        ) : (
          <Alert variant="destructive">
            <ShieldAlert size={16} className="mr-1 inline" aria-hidden />
            {langue === 'FR' ? 'Rupture détectée à l’entrée n° ' : 'Break detected at entry #'}
            <strong className="font-mono">{vm.resultat.premiereRupture}</strong>
          </Alert>
        ))}
      {vm.erreur && <Alert variant="destructive">{vm.erreur}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="h-10 px-4 font-medium">N°</th>
              <th className="px-4 font-medium">{langue === 'FR' ? 'Horodatage' : 'Timestamp'}</th>
              <th className="px-4 font-medium">Action</th>
              <th className="px-4 font-medium">{langue === 'FR' ? 'Ressource' : 'Resource'}</th>
              <th className="px-4 font-medium">{langue === 'FR' ? 'Empreinte' : 'Hash'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vm.chargement && (
              <tr><td colSpan={5} className="p-4 text-muted-foreground">{t('commun.chargement')}</td></tr>
            )}
            {vm.entrees.map((e) => (
              <tr key={e.id} className="h-12">
                <td className="px-4 font-mono tabular-nums">{e.id}</td>
                <td className="px-4 tabular-nums">{new Date(e.horodatage).toLocaleString(langue === 'FR' ? 'fr-FR' : 'en-GB')}</td>
                <td className="px-4 font-mono text-xs">{e.action}</td>
                <td className="px-4 text-muted-foreground">{e.ressourceType}</td>
                <td className="px-4 font-mono text-xs text-muted-foreground" title={e.hash}>{e.hash.slice(0, 4)}…{e.hash.slice(-4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
