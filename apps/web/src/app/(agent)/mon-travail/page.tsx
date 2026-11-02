'use client';

// S-02 « Mon travail » : page d'arrivée. Les compteurs seront alimentés par le parapheur (It. 2).
import { FilePen, Inbox, PenTool, Undo2, UserCog } from 'lucide-react';
import { Alert } from '@/components/ui/primitives';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { actesApi } from '@/features/actes/model/actes.api';
import { useProfil } from '@/features/auth/view-model/useSession';
import { useT, type CleTraduction } from '@/i18n';

const COMPTEURS = [
  { cle: 'monTravail.aViser', icone: Inbox, roles: ['VISEUR', 'JURISTE', 'TRADUCTEUR', 'SECRETAIRE_GENERAL'] },
  { cle: 'monTravail.aSigner', icone: PenTool, roles: ['AUTORITE_SIGNATAIRE'] },
  { cle: 'monTravail.aCorriger', icone: Undo2, roles: ['REDACTEUR'], groupe: 'aCorriger', lien: '/mes-actes' },
  { cle: 'monTravail.brouillons', icone: FilePen, roles: ['REDACTEUR'], groupe: 'brouillons', lien: '/mes-actes' },
] as const;

export default function MonTravailPage() {
  const { t, langue } = useT();
  const { data: profil } = useProfil();
  const redacteur = !!profil?.roles.includes('REDACTEUR');
  const { data: mesActes } = useQuery({ queryKey: ['mes-actes'], queryFn: actesApi.mesActes, enabled: redacteur });
  if (!profil) return null;
  const visibles = COMPTEURS.filter((c) => c.roles.some((r) => profil.roles.includes(r)));

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary-900 dark:text-foreground">{t('monTravail.bonjour', { prenom: profil.prenom })}</h1>
        <p className="text-muted-foreground">{profil.structure.libelle}</p>
      </header>

      {profil.delegationsActives.map((d) => (
        <div key={d.id} className="flex items-start gap-3 rounded-lg border border-[#d8c8f3] bg-[#f0eafb] p-4 text-[#5a32a3]">
          <UserCog size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            {t('monTravail.delegation', {
              mention: d.mention,
              fin: new Date(d.fin).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB'),
              types: d.perimetre.length ? d.perimetre.join(', ') : '—',
            })}
          </p>
        </div>
      ))}

      {visibles.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibles.map((c) => (
            <li key={c.cle} className="relative rounded-lg border border-border bg-card p-5 hover:border-primary-300">
              <c.icone size={20} className="text-primary" aria-hidden />
              <p className="mt-3 text-3xl font-semibold tabular-nums">{'groupe' in c && mesActes ? mesActes.compteurs[c.groupe] : 0}</p>
              {'lien' in c ? (
                <Link href={c.lien} className="text-muted-foreground after:absolute after:inset-0">{t(c.cle)}</Link>
              ) : (
                <p className="text-muted-foreground">{t(c.cle)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Alert>{t('monTravail.prochainement')}</Alert>

      <div>
        <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">{t('monTravail.roles')}</h2>
        <ul className="flex flex-wrap gap-2">
          {profil.roles.map((r) => (
            <li key={r} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200">
              {t(`role.${r}` as CleTraduction)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
