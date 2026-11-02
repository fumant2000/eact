import { PageResultat } from '@/features/verification/VerificationPublique';
import type { Verification } from '@/features/signature/model/signature.api';

// UC-17 — cible du QR code (BF-55, BF-56, RG-21), rendue côté serveur sans authentification.
export const dynamic = 'force-dynamic';

async function verifier(code: string): Promise<Verification | null> {
  const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3000';
  try {
    const r = await fetch(`${api}/public/verifier/${encodeURIComponent(code)}`, { cache: 'no-store' });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export default async function VerifierPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const decode = decodeURIComponent(code).slice(0, 20);
  return <PageResultat code={decode} acte={await verifier(decode)} />;
}
