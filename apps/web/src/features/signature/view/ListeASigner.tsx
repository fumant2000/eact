'use client';

// MVVM — Vue E1 « À signer ». Le signataire ne signe pas depuis la liste : « Examiner » ouvre la fiche,
// où se trouve le seul bouton or de l'application (guide §5, point 2).
import { useQuery } from '@tanstack/react-query';
import { Lock, PenTool } from 'lucide-react';
import Link from 'next/link';
import { classesBouton } from '@/components/ui/primitives';
import { CodeType } from '@/features/actes/view/Document';
import { useT } from '@/i18n';
import { signatureApi } from '../model/signature.api';

export function ListeASigner() {
  const { t, langue } = useT();
  const { data = [], isLoading } = useQuery({ queryKey: ['a-signer'], queryFn: signatureApi.aSigner, refetchInterval: 60_000 });
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-primary-900 dark:text-foreground">{t('signature.titre')}</h1>
        <p className="mt-1 text-muted-foreground">{t('signature.sousTitre', { n: data.length })}</p>
      </header>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {isLoading && <li className="p-6 text-muted-foreground">{t('commun.chargement')}</li>}
        {!isLoading && data.length === 0 && <li className="p-6 text-muted-foreground">{t('signature.vide')}</li>}
        {data.map((a) => (
          <li key={a.id} className="grid items-center gap-3 p-4 md:grid-cols-[60px_1fr_auto_auto]">
            <CodeType code={a.codeType} />
            <div className="min-w-0">
              <p className="font-semibold">
                {a.objet}
                {a.confidentialite === 'CONFIDENTIEL' && <Lock size={14} className="ml-2 inline text-muted-foreground" aria-label={t('confidentiel')} />}
              </p>
              <p className="text-sm text-muted-foreground">{a.redacteur} · {a.structure} · {t('signature.nbVisas', { n: a.nbVisas })}</p>
              <p className="text-sm text-muted-foreground">{t('signature.qualite', { q: a.qualite })}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d8c8f3] bg-[#f0eafb] px-3 py-1 text-sm text-[#5a32a3]">
              <PenTool size={14} aria-hidden /> {t('signature.pret')}
              {a.pretDepuis && <span className="tabular-nums">· {new Date(a.pretDepuis).toLocaleDateString(langue === 'FR' ? 'fr-FR' : 'en-GB')}</span>}
            </span>
            <Link href={`/actes/${a.id}`} className={classesBouton({ variant: 'outline' })}>{t('signature.examiner')}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
