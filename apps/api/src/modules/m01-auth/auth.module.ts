import { Module } from '@nestjs/common';

/**
 * M01 — Authentification et sécurité
 * Exigences : BF-01 à BF-05 · Priorité : P0
 * Interface fournie : IAuthentification
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class AuthModule {}
