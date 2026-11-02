// Messages d'erreur compréhensibles par un agent : le code de l'API choisit le libellé, jamais la pile technique.
import type { CleTraduction } from '@/i18n';
import { ErreurApi } from './api';

const MESSAGES: Record<string, CleTraduction> = {
  RESEAU: 'erreur.RESEAU',
  ERREUR_INTERNE: 'erreur.ERREUR_INTERNE',
  NON_AUTHENTIFIE: 'erreur.SESSION_EXPIREE',
  SESSION_EXPIREE: 'erreur.SESSION_EXPIREE',
  ACCES_REFUSE: 'erreur.ACCES_REFUSE',
  INTROUVABLE: 'erreur.INTROUVABLE',
  CONFLIT_VERSION: 'editeur.conflit',
  TROP_VOLUMINEUX: 'erreur.TROP_VOLUMINEUX',
  REQUETE_INVALIDE: 'erreur.DONNEES_INVALIDES',
  DONNEES_INVALIDES: 'erreur.DONNEES_INVALIDES',
  TROP_DE_REQUETES: 'erreur.TROP_DE_REQUETES',
};

/** Les autres codes métier (PIECES_EN_ANALYSE, CIRCUIT_ABSENT…) ont déjà un message rédigé en français par l'API. */
export function messageErreur(e: unknown, t: (cle: CleTraduction, v?: Record<string, string | number>) => string): string {
  if (!(e instanceof ErreurApi)) return t('erreur.INCONNUE');
  const cle = e.code ? MESSAGES[e.code] : undefined;
  if (e.code === 'ERREUR_INTERNE') return t('erreur.ERREUR_INTERNE', { ref: String(e.details.reference ?? '—') });
  if (cle) return t(cle);
  return e.message || t('erreur.INCONNUE');
}
