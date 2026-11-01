import { Module } from '@nestjs/common';

/**
 * M04 — Rédaction et modèles d'actes
 * Exigences : BF-15 à BF-21 · Priorité : P0
 * Interface fournie : IActes
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class ActesModule {}
