import { Module } from '@nestjs/common';

/**
 * M05 — Circuit de validation (parapheur électronique)
 * Exigences : BF-22 à BF-28 · Priorité : P0
 * Interface fournie : IParapheur
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class CircuitModule {}
