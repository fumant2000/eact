// Client HTTP commun (couche Modèle) : cookies httpOnly, renouvellement transparent du jeton d'accès.
const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ErreurApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let rafraichissementEnCours: Promise<boolean> | null = null;

/** Un seul rafraîchissement à la fois, même si plusieurs requêtes reçoivent 401 ensemble. */
export function rafraichirSession(): Promise<boolean> {
  rafraichissementEnCours ??= fetch(`${API}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => (rafraichissementEnCours = null));
  return rafraichissementEnCours;
}

export async function appelApi<T>(chemin: string, init: RequestInit & { json?: unknown } = {}, reessai = true): Promise<T> {
  const { json, ...reste } = init;
  const r = await fetch(`${API}${chemin}`, {
    ...reste,
    credentials: 'include',
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...reste.headers },
    body: json !== undefined ? JSON.stringify(json) : reste.body,
  });
  if (r.status === 401 && reessai && !chemin.startsWith('/v1/auth/') && (await rafraichirSession())) {
    return appelApi<T>(chemin, init, false);
  }
  const corps = await r.json().catch(() => null);
  if (!r.ok) {
    const message = Array.isArray(corps?.message) ? corps.message.join(' · ') : (corps?.message ?? `Erreur ${r.status}`);
    throw new ErreurApi(r.status, corps?.code, message, corps ?? {});
  }
  return corps as T;
}
