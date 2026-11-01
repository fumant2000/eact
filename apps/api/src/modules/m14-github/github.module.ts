import { Module } from '@nestjs/common';

/**
 * M14 — Intégration de l'API GitHub
 * Exigences : BF-59 à BF-63 · Priorité : P0 (BF-59) / P1
 * Interface fournie : IDepotGabarits, IAnomalies
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class GithubModule {}
