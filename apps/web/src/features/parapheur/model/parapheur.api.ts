// MVVM — Modèle : types métier + client API typé (CDC tableau 17).
import type { ValeurStatut } from '@eact/shared';

export interface ActeEnAttente {
  id: string;
  codeType: string;
  objet: string;
  statut: ValeurStatut;
  etape: string;
  echeance: string; // ISO 8601
  version: number; // verrou optimiste renvoyé au visa
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export const parapheurApi = {
  async lister(): Promise<ActeEnAttente[]> {
    const r = await fetch(`${API}/v1/parapheur`, { credentials: 'include' });
    if (!r.ok) throw new Error(`Parapheur indisponible (${r.status})`);
    return r.json();
  },

  async viser(acte: Pick<ActeEnAttente, 'id' | 'version'>, observation?: string): Promise<void> {
    const r = await fetch(`${API}/v1/actes/${acte.id}/visas`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'FAVORABLE', version: acte.version, observation }),
    });
    if (r.status === 409) throw new Error("L'acte a été modifié entre-temps : rechargez.");
    if (!r.ok) throw new Error(`Visa refusé (${r.status})`);
  },
};
