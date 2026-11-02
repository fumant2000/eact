import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

/**
 * M02 — Organisation, utilisateurs et délégations
 * Exigences : BF-06 à BF-10 · Priorité : P0
 * Interfaces fournies : IUtilisateurs, IStructures, IDelegations
 */
@Module({ controllers: [DelegationsController], providers: [DelegationsService], exports: [DelegationsService] })
export class OrganisationModule {}
