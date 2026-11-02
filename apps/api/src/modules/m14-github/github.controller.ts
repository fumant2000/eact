import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GabaritsService } from './gabarits.service';

@ApiTags('M14 — GitHub')
@Controller('v1/gabarits')
@Roles(Role.ADMINISTRATEUR)
export class GithubController {
  constructor(
    private readonly gabarits: GabaritsService,
    private readonly prisma: PrismaService,
  ) {}

  /** J6 : modèles en cache et état de la dernière synchronisation. */
  @Get()
  async lister() {
    const modeles = await this.prisma.modeleActe.findMany({
      include: { typeActe: { select: { code: true, libelle: true } }, _count: { select: { actes: true } } },
      orderBy: [{ typeActe: { code: 'asc' } }, { libelle: 'asc' }],
    });
    return {
      synchronisation: this.gabarits.etatSynchronisation(),
      modeles: modeles.map((m) => ({
        id: m.id,
        type: m.typeActe,
        libelle: m.libelle,
        version: m.version,
        langue: m.langue,
        chemin: m.cheminGithub,
        commitSha: m.commitSha,
        misAJourLe: m.misAJourLe,
        utilisations: m._count.actes,
      })),
    };
  }

  /** BF-59 : lecture du dépôt eact-gabarits et mise à jour du cache. */
  @Post('synchronisation')
  @HttpCode(200)
  synchroniser(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.gabarits.synchroniser(u.sub);
  }
}
