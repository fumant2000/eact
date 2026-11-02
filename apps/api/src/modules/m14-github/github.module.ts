import { Module } from '@nestjs/common';
import { ClientGithub } from './client-github';
import { GabaritsService } from './gabarits.service';
import { GithubController } from './github.controller';

/**
 * M14 — Intégration de l'API GitHub
 * Exigences : BF-59 (P0) ; BF-60 à BF-63 (P1) · Interfaces fournies : IDepotGabarits, IAnomalies
 * RG-22 : aucune donnée nominative ni aucun contenu d'acte vers GitHub. RG-23 : GitHub ne bloque jamais le métier.
 */
@Module({ controllers: [GithubController], providers: [ClientGithub, GabaritsService], exports: [GabaritsService] })
export class GithubModule {}
