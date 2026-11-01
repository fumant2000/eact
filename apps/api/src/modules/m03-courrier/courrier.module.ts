import { Module } from '@nestjs/common';

/**
 * M03 — Courrier arrivé et imputation
 * Exigences : BF-11 à BF-14 · Priorité : P2
 * Interface fournie : ICourrier
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class CourrierModule {}
