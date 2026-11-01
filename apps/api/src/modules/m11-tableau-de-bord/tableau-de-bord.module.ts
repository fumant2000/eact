import { Module } from '@nestjs/common';

/**
 * M11 — Tableau de bord
 * Exigences : BF-51 à BF-52 · Priorité : P2
 * Interface fournie : IIndicateurs
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class TableauDeBordModule {}
