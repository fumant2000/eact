'use client';

// Code à 6 chiffres en deux groupes de 3 (InputOTP du guide) ; collage accepté, police mono 22 px.
import { useRef } from 'react';

export function SaisieCode({
  valeur,
  onChange,
  invalide,
  idDescription,
  autoFocus,
}: {
  valeur: string;
  onChange: (v: string) => void;
  invalide?: boolean;
  idDescription?: string;
  autoFocus?: boolean;
}) {
  const cases = useRef<(HTMLInputElement | null)[]>([]);

  function saisir(index: number, brut: string) {
    // Case déjà remplie : on garde le chiffre tapé, pas l'ancien.
    const chiffres = (valeur[index] && brut.length === 2 ? brut.slice(1) : brut).replace(/\D/g, '');
    if (!chiffres) return;
    const tableau = valeur.padEnd(6, ' ').split('');
    chiffres.split('').forEach((c, k) => index + k < 6 && (tableau[index + k] = c));
    const suivant = tableau.join('').replace(/ /g, '').slice(0, 6);
    onChange(suivant);
    cases.current[Math.min(index + chiffres.length, 5)]?.focus();
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Code à 6 chiffres">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="contents">
          {i === 3 && <span className="w-1" aria-hidden />}
          <input
            ref={(el) => {
              cases.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && i === 0}
            aria-label={`Chiffre ${i + 1}`}
            aria-invalid={invalide || undefined}
            aria-describedby={idDescription}
            maxLength={6}
            value={valeur[i] ?? ''}
            onChange={(e) => saisir(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !valeur[i] && i > 0) {
                onChange(valeur.slice(0, i - 1));
                cases.current[i - 1]?.focus();
              } else if (e.key === 'Backspace') {
                onChange(valeur.slice(0, i));
              }
            }}
            className={`h-14 w-12 rounded-md border bg-card text-center font-mono text-[22px] text-foreground ${
              invalide ? 'border-destructive' : 'border-input'
            }`}
          />
        </span>
      ))}
    </div>
  );
}
