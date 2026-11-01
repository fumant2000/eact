import { Module } from '@nestjs/common';

/**
 * M15 — Administration et paramétrage
 * Exigences : BF-64 à BF-66 · Priorité : P0 / P1
 * Interface fournie : IParametres
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class AdminModule {}
