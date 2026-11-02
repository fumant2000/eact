import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface EntreeAudit {
  acteurId?: string;
  action: string;
  ressourceType: string;
  ressourceId?: string;
  details?: Record<string, unknown>;
}

const HASH_ORIGINE = '0'.repeat(64);
// pg_advisory_xact_lock : une seule insertion à la fois pour garder l'ordre de la chaîne (ADR 0004)
const VERROU_CHAINE = 4242;

/**
 * JSON canonique : clés triées à tous les niveaux. Indispensable car `details` est stocké en jsonb,
 * et PostgreSQL réordonne les clés : sans cela, l'empreinte relue ne correspondrait plus à celle écrite.
 */
export function jsonCanonique(valeur: unknown): string {
  return JSON.stringify(valeur, (_cle, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

export function calculerHash(hashPrecedent: string, e: EntreeAudit, horodatage: Date): string {
  const contenu = jsonCanonique([
    hashPrecedent,
    horodatage.toISOString(),
    e.acteurId ?? null,
    e.action,
    e.ressourceType,
    e.ressourceId ?? null,
    e.details ?? {},
  ]);
  return createHash('sha256').update(contenu).digest('hex');
}

/**
 * IAudit — journal chaîné (BF-48 à BF-50).
 * Écoute tous les événements du bus (invocation implicite) : les modules métier
 * n'appellent l'audit directement que dans une transaction critique (signature).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('**', { async: true })
  async surEvenement(payload: EntreeAudit) {
    if (payload?.action && payload?.ressourceType) {
      await this.prisma.$transaction((tx) => this.journaliser(payload, tx));
    }
  }

  /** À appeler dans la transaction métier pour que l'audit soit atomique avec l'action. */
  async journaliser(e: EntreeAudit, tx: Prisma.TransactionClient) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${VERROU_CHAINE})`;
    const precedent = await tx.evenementAudit.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
    const hashPrecedent = precedent?.hash ?? HASH_ORIGINE;
    const horodatage = new Date();
    await tx.evenementAudit.create({
      data: {
        horodatage,
        acteurId: e.acteurId,
        action: e.action,
        ressourceType: e.ressourceType,
        ressourceId: e.ressourceId,
        details: (e.details ?? {}) as Prisma.InputJsonValue,
        hashPrecedent,
        hash: calculerHash(hashPrecedent, e, horodatage),
      },
    });
  }

  /** BF-50 / TF-13 : recalcule la chaîne et renvoie la première rupture. */
  async verifierIntegrite(): Promise<{ integre: boolean; premiereRupture?: string }> {
    let hashPrecedent = HASH_ORIGINE;
    let curseur: bigint | undefined;
    for (;;) {
      const lot = await this.prisma.evenementAudit.findMany({
        take: 1000,
        ...(curseur ? { skip: 1, cursor: { id: curseur } } : {}),
        orderBy: { id: 'asc' },
      });
      if (lot.length === 0) return { integre: true };
      for (const ev of lot) {
        const attendu = calculerHash(
          hashPrecedent,
          {
            acteurId: ev.acteurId ?? undefined,
            action: ev.action,
            ressourceType: ev.ressourceType,
            ressourceId: ev.ressourceId ?? undefined,
            details: ev.details as Record<string, unknown>,
          },
          ev.horodatage,
        );
        if (ev.hashPrecedent !== hashPrecedent || ev.hash !== attendu) {
          return { integre: false, premiereRupture: ev.id.toString() };
        }
        hashPrecedent = ev.hash;
      }
      curseur = lot[lot.length - 1].id;
    }
  }
}
