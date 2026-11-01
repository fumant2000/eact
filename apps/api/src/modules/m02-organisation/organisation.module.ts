import { Module } from '@nestjs/common';

/**
 * M02 — Organisation, utilisateurs et délégations
 * Exigences : BF-06 à BF-10 · Priorité : P0
 * Interface fournie : IUtilisateurs, IStructures, IDelegations
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class OrganisationModule {}
