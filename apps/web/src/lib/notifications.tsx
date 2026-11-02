'use client';

// Toasts (Sonner, guide d'implémentation §3) : erreurs inattendues et confirmations d'action.
// Les erreurs de formulaire restent affichées à côté du champ ; le toast sert à ce qui n'a pas d'emplacement.
import { useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { useT, type CleTraduction } from '@/i18n';
import { ErreurApi } from './api';
import { messageErreur } from './erreurs';

type Traducteur = ReturnType<typeof useT>['t'];
let traduire: Traducteur | null = null;

export function notifierErreur(e: unknown) {
  // 401 : la coque renvoie déjà vers la connexion
  if (e instanceof ErreurApi && e.status === 401) return;
  const message = traduire ? messageErreur(e, traduire) : e instanceof Error ? e.message : String(e);
  // Même message, même toast : pas d'empilement si plusieurs requêtes échouent ensemble (réseau coupé).
  toast.error(message, { id: message, duration: 8000 });
}

export function notifierSucces(cle: CleTraduction, options?: { action?: { label: string; onClick: () => void } }) {
  toast.success(traduire ? traduire(cle) : cle, { duration: 5000, ...options });
}

export function Notifications() {
  const { t } = useT();
  useEffect(() => {
    traduire = t;
  }, [t]);
  return (
    <Toaster
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-foreground !text-background !border-0 !rounded-lg !shadow-lg',
          error: '!bg-[#a81f26] !text-white',
          actionButton: '!bg-white !text-foreground',
        },
      }}
    />
  );
}
