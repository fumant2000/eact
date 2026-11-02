// Éléments du document officiel (annexe A, maquettes C3/C4) : en-tête bilingue verrouillé, titre, bloc de signature.
import { LIBELLES_STRUCTURES, TITRES_TYPES } from '@eact/shared';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export function CodeType({ code }: { code: string }) {
  return <span className="reference inline-block rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-200">{code}</span>;
}

/** En-tête généré d'après la chaîne de structures (BF-16) ; jamais saisi par le rédacteur. */
export function EnTeteOfficiel({ chaine, mention }: { chaine: string[]; mention?: string }) {
  const colonne = (langue: 'fr' | 'en') => (
    <div className="text-center leading-snug">
      <p className="font-bold">{langue === 'fr' ? 'RÉPUBLIQUE DU CAMEROUN' : 'REPUBLIC OF CAMEROON'}</p>
      <p>{langue === 'fr' ? 'Paix – Travail – Patrie' : 'Peace – Work – Fatherland'}</p>
      <p className="font-bold">{langue === 'fr' ? "MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR" : 'MINISTRY OF HIGHER EDUCATION'}</p>
      {chaine.map((code) => (
        <p key={code}>{LIBELLES_STRUCTURES[code]?.[langue] ?? code}</p>
      ))}
    </div>
  );
  return (
    <div className="relative grid grid-cols-2 gap-6 rounded-md bg-muted/70 p-4 font-serif text-[13px] text-foreground">
      {mention && (
        <span className="absolute top-2 right-3 flex items-center gap-1 font-sans text-xs text-muted-foreground">
          <Lock size={12} aria-hidden /> {mention}
        </span>
      )}
      {colonne('fr')}
      {colonne('en')}
    </div>
  );
}

export function TitreActe({ code, numero, objet }: { code: string; numero: ReactNode; objet: ReactNode }) {
  return (
    <div className="space-y-2 text-center font-serif">
      <p className="text-lg font-bold">
        {TITRES_TYPES[code]?.fr ?? code} N° {numero}
      </p>
      <div className="italic">{objet}</div>
    </div>
  );
}

/** Corps HTML déjà nettoyé par le serveur (sanitize-html) : seules des balises de mise en forme subsistent. */
export function CorpsActe({ html }: { html: string }) {
  return <div className="corps-acte font-serif" dangerouslySetInnerHTML={{ __html: html }} />;
}
