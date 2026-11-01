import { Module } from '@nestjs/common';

/**
 * M08 — Recherche et consultation
 * Exigences : BF-40 à BF-43 · Priorité : P1
 * Interface fournie : IRecherche
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class RechercheModule {}
