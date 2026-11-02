import { Module } from '@nestjs/common';
import { ClientGithub } from './client-github';
import { GabaritsService } from './gabarits.service';
import { GithubController } from './github.controller';

/** M14 Intégration GitHub — BF-59 (BF-60 à BF-63 en P1). RG-22 : rien de nominatif vers GitHub ; RG-23 : GitHub ne bloque jamais le métier. */
@Module({ controllers: [GithubController], providers: [ClientGithub, GabaritsService], exports: [GabaritsService] })
export class GithubModule {}
