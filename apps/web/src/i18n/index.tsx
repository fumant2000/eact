'use client';

// ENF-12 : libellés externalisés, FR par défaut, EN au choix de l'utilisateur (mémorisé sur le poste).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import en from './en.json';
import fr from './fr.json';

export type Langue = 'FR' | 'EN';
export type CleTraduction = keyof typeof fr;
const DICTIONNAIRES: Record<Langue, Record<string, string>> = { FR: fr, EN: en };

interface ContexteLangue {
  langue: Langue;
  changerLangue: (l: Langue) => void;
  t: (cle: CleTraduction, variables?: Record<string, string | number>) => string;
}

const Contexte = createContext<ContexteLangue | null>(null);

export function LangueProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>('FR');
  useEffect(() => {
    const memorisee = localStorage.getItem('eact_langue');
    if (memorisee === 'EN' || memorisee === 'FR') setLangue(memorisee);
  }, []);
  useEffect(() => {
    document.documentElement.lang = langue.toLowerCase();
  }, [langue]);

  const changerLangue = useCallback((l: Langue) => {
    localStorage.setItem('eact_langue', l);
    setLangue(l);
  }, []);
  const t = useCallback(
    (cle: CleTraduction, variables: Record<string, string | number> = {}) =>
      Object.entries(variables).reduce(
        (texte, [k, v]) => texte.replaceAll(`{${k}}`, String(v)),
        DICTIONNAIRES[langue][cle] ?? fr[cle] ?? cle,
      ),
    [langue],
  );
  return <Contexte.Provider value={{ langue, changerLangue, t }}>{children}</Contexte.Provider>;
}

export function useT(): ContexteLangue {
  const c = useContext(Contexte);
  if (!c) throw new Error('useT doit être utilisé sous <LangueProvider>');
  return c;
}
