import { Archive, BadgeCheck, Ban, FilePen, PenTool, Route, Send, Stamp, Undo2, XCircle, type LucideIcon } from 'lucide-react';
import type { ValeurStatut } from '@eact/shared';
import fr from '@/i18n/fr.json';

// Couleur + icône + libellé : jamais la couleur seule (ENF-11).
const STYLES: Record<ValeurStatut, { classe: string; icone: LucideIcon }> = {
  BROUILLON: { classe: 'border border-border bg-muted text-muted-foreground', icone: FilePen },
  EN_CIRCUIT: { classe: 'border border-primary-200 bg-primary-100 text-primary-700 dark:border-primary-800 dark:bg-primary-900 dark:text-primary-200', icone: Route },
  A_CORRIGER: { classe: 'border border-[#f6d3ae] bg-[#fef3e7] text-[#9a4507] dark:border-warning dark:bg-transparent dark:text-warning', icone: Undo2 },
  REJETE: { classe: 'border border-[#f5c2c4] bg-[#fdecec] text-[#a81f26] dark:border-destructive dark:bg-transparent dark:text-destructive', icone: XCircle },
  PRET_A_SIGNER: { classe: 'border border-[#d8c8f3] bg-[#f0eafb] text-[#5a32a3] dark:border-violet dark:bg-transparent dark:text-violet', icone: PenTool },
  TRANSMIS: { classe: 'border border-violet bg-card text-[#5a32a3] dark:text-violet', icone: Send },
  SIGNE: { classe: 'bg-seal text-seal-foreground', icone: Stamp },
  EXECUTOIRE: { classe: 'border border-[#b5dfc8] bg-[#e3f4ec] text-[#0b6447] dark:border-success dark:bg-transparent dark:text-success', icone: BadgeCheck },
  ARCHIVE: { classe: 'bg-primary-900 text-white', icone: Archive },
  RETIRE: { classe: 'border border-destructive bg-card text-[#a81f26] dark:text-destructive', icone: Ban },
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
