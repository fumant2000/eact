import { Module } from '@nestjs/common';

/**
 * M13 — Vérification publique et suivi usager
 * Exigences : BF-55 à BF-58 · Priorité : P0 (BF-55/56) / P2
 * Interface fournie : IVerification
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class VerificationModule {}
