import { Module } from '@nestjs/common';

/**
 * M07 — Diffusion et publication (dont transmission des projets de décret)
 * Exigences : BF-34 à BF-39 · Priorité : P2
 * Interface fournie : IDiffusion
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class DiffusionModule {}
