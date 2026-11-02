/**
 * Gabarit d'acte (exemples : gabarits/fr/*.html) : HTML précédé d'un commentaire `<!-- clé: valeur -->`
 * (type et libelle obligatoires ; ampliations séparées par « | »).
 * Seul le corps vient du gabarit : en-tête officiel, titre et signature sont produits par EACT (BF-16).
 */
export interface Gabarit {
  type: string;
  libelle: string;
  version: string;
  description: string | null;
  ampliations: string[];
  corps: string;
}

export function lireGabarit(texte: string): Gabarit {
  const m = texte.replace(/^﻿/, '').match(/^\s*<!--([\s\S]*?)-->\s*([\s\S]*)$/);
  if (!m) throw new Error('Gabarit sans en-tête de métadonnées <!-- … -->');
  const meta: Record<string, string> = {};
  for (const ligne of m[1].split(/\r?\n/)) {
    const i = ligne.indexOf(':');
    if (i > 0) meta[ligne.slice(0, i).trim().toLowerCase()] = ligne.slice(i + 1).trim();
  }
  if (!meta.type || !meta.libelle) throw new Error('Métadonnées « type » et « libelle » obligatoires');
  return {
    type: meta.type.toUpperCase(),
    libelle: meta.libelle,
    version: meta.version || '1.0',
    description: meta.description || null,
    ampliations: (meta.ampliations ?? '').split('|').map((a) => a.trim()).filter(Boolean),
    corps: m[2].trim(),
  };
}
