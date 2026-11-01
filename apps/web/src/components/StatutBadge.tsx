import { Archive, BadgeCheck, Ban, FilePen, PenTool, Route, Send, Stamp, Undo2, XCircle, type LucideIcon } from 'lucide-react';
import type { ValeurStatut } from '@eact/shared';
import fr from '@/i18n/fr.json';

// Couleur + icône + libellé : jamais la couleur seule (accessibilité, design-system §3).
const STYLES: Record<ValeurStatut, { classe: string; icone: LucideIcon }> = {
  BROUILLON: { classe: 'bg-border text-muted', icone: FilePen },
  EN_CIRCUIT: { classe: 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200', icone: Route },
  A_CORRIGER: { classe: 'bg-warning/10 text-warning', icone: Undo2 },
  REJETE: { classe: 'bg-danger/10 text-danger', icone: XCircle },
  PRET_A_SIGNER: { classe: 'bg-violet/10 text-violet', icone: PenTool },
  TRANSMIS: { classe: 'border border-violet text-violet', icone: Send },
  SIGNE: { classe: 'bg-seal text-seal-foreground', icone: Stamp },
  EXECUTOIRE: { classe: 'bg-success/10 text-success', icone: BadgeCheck },
  ARCHIVE: { classe: 'bg-primary-900 text-white', icone: Archive },
  RETIRE: { classe: 'border border-danger text-danger', icone: Ban },
};

export function StatutBadge({ statut }: { statut: ValeurStatut }) {
  const { classe, icone: Icone } = STYLES[statut];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}>
      <Icone size={12} aria-hidden />
      {fr[`statut.${statut}` as keyof typeof fr]}
    </span>
  );
}
