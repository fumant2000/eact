'use client';

// Boîte de dialogue modale (Dialog / AlertDialog du guide) : <dialog> natif = focus piégé et Échap gérés par le navigateur.
import { useEffect, useRef, type ReactNode } from 'react';

export function Dialogue({
  ouvert,
  onFermer,
  titre,
  children,
  alerte = false,
  large = false,
  bloquant = false,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: ReactNode;
  children: ReactNode;
  alerte?: boolean;
  large?: boolean;
  /** Traitement en cours : ni Échap ni clic extérieur ne ferment la fenêtre. */
  bloquant?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <dialog
      ref={ref}
      role={alerte ? 'alertdialog' : 'dialog'}
      aria-labelledby="titre-dialogue"
      onClose={onFermer}
      onCancel={(e) => bloquant && e.preventDefault()}
      onClick={(e) => !alerte && !bloquant && e.target === ref.current && onFermer()}
      className={`m-auto w-[calc(100%-2rem)] ${large ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40`}
    >
      {ouvert && (
        <div className="p-6">
          <h2 id="titre-dialogue" className="text-xl font-semibold text-primary-900 dark:text-foreground">{titre}</h2>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
}
