import { ShieldCheck, ShieldX } from 'lucide-react';

// UC-17 — page publique rendue côté serveur, cible du QR code (BF-55, BF-56, RG-21).
// Aucune authentification ; n'affiche jamais le contenu d'un acte non public.

interface ResultatVerification {
  reference: string;
  type: string;
  signeLe: string;
  signataire: string;
  statut: 'VALIDE' | 'RETIRE' | 'ABROGE';
  empreinteSha256: string;
}

async function verifier(code: string): Promise<ResultatVerification | null> {
  const api = process.env.API_INTERNAL_URL ?? 'http://api:3000';
  try {
    const r = await fetch(`${api}/public/verifier/${encodeURIComponent(code)}`, { cache: 'no-store' });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export default async function VerifierPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const acte = await verifier(code);

  return (
    <main className="mx-auto max-w-xl p-4 md:p-10">
      <p className="text-sm text-muted-foreground">Ministère de l&apos;Enseignement Supérieur — Vérification d&apos;un acte</p>
      {acte ? (
        <div className="mt-4 rounded-card border-2 border-seal bg-surface p-6">
          <div className="flex items-center gap-2 text-success">
            <ShieldCheck aria-hidden /> <h1 className="text-xl font-semibold">Acte authentique</h1>
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Référence</dt>
            <dd className="reference">{acte.reference}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{acte.type}</dd>
            <dt className="text-muted-foreground">Signé le</dt>
            <dd>{new Date(acte.signeLe).toLocaleString('fr-CM', { timeZone: 'Africa/Douala' }) /* fuseau unique du Cameroun */}</dd>
            <dt className="text-muted-foreground">Signataire</dt>
            <dd>{acte.signataire}</dd>
            <dt className="text-muted-foreground">Statut</dt>
            <dd>{acte.statut}</dd>
            <dt className="text-muted-foreground">Empreinte SHA-256</dt>
            <dd className="reference break-all text-xs">{acte.empreinteSha256}</dd>
          </dl>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-card bg-danger/10 p-6 text-danger">
          <ShieldX aria-hidden /> Aucun acte ne correspond au code <span className="reference">{code}</span>.
        </div>
      )}
    </main>
  );
}
