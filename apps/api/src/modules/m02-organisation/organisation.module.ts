import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

/** M02 Organisation, utilisateurs et délégations — BF-06 à BF-10. */
@Module({ controllers: [DelegationsController], providers: [DelegationsService], exports: [DelegationsService] })
export class OrganisationModule {}
