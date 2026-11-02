// Primitives d'interface à l'API calquée sur shadcn/ui, remplaçables sans toucher aux écrans.
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const VARIANTES = {
  default: 'bg-primary text-primary-foreground hover:bg-primary-800 dark:hover:bg-primary-300',
  outline: 'border border-input bg-card text-foreground hover:bg-accent',
  ghost: 'text-foreground hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  'outline-destructive': 'border border-destructive bg-card text-destructive hover:bg-destructive/10',
  // Seul bouton or de l'application : « Signer » (ADR 0007)
  seal: 'bg-seal-400 text-seal-foreground hover:brightness-95',
  link: 'text-primary underline underline-offset-4 hover:text-primary-800 px-0 h-auto',
} as const;
const TAILLES = { sm: 'h-8 px-3 text-sm', default: 'h-10 px-4', lg: 'h-12 px-6 text-base' } as const;

type OptionsBouton = { variant?: keyof typeof VARIANTES; size?: keyof typeof TAILLES; className?: string };

/** Classes d'un bouton, pour styler aussi un lien de navigation (pas de <button> dans un <a>). */
export function classesBouton({ variant = 'default', size = 'default', className }: OptionsBouton = {}) {
  return cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:min-h-0',
    TAILLES[size],
    VARIANTES[variant],
    className,
  );
}

export function Button({ variant, size, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & OptionsBouton) {
  return <button className={classesBouton({ variant, size, className })} {...props} />;
}

export function Input({ className, invalide, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalide?: boolean }) {
  return (
    <input
      aria-invalid={invalide || undefined}
      className={cx(
        'h-11 w-full rounded-md border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground sm:h-10 sm:text-sm',
        invalide ? 'border-destructive' : 'border-input',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx('text-sm font-medium text-foreground', className)} {...props} />;
}

const ALERTES = {
  info: { classe: 'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100', icone: Info },
  warning: { classe: 'border-[#f6d3ae] bg-[#fef3e7] text-[#9a4507]', icone: TriangleAlert },
  destructive: { classe: 'border-[#f5c2c4] bg-[#fdecec] text-[#a81f26]', icone: AlertCircle },
  success: { classe: 'border-[#b5dfc8] bg-[#e3f4ec] text-[#0b6447]', icone: CheckCircle2 },
} as const;

export function Alert({ variant = 'info', children, id }: { variant?: keyof typeof ALERTES; children: ReactNode; id?: string }) {
  const { classe, icone: Icone } = ALERTES[variant];
  return (
    <div id={id} role={variant === 'destructive' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-lg border p-3 text-sm', classe)}>
      <Icone size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8', className)}>{children}</div>;
}

export { cx };
