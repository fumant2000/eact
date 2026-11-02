import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/security/securite';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from './audit.service';

@ApiTags('M10 — Journal d’audit')
@Controller('v1/audit')
@Roles(Role.AUDITEUR, Role.ADMINISTRATEUR)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /** BF-48 : entrées les plus récentes d'abord. */
  @Get()
  async lister(@Query('limite') limite = '50', @Query('apres') apres?: string) {
    const entrees = await this.prisma.evenementAudit.findMany({
      take: Math.min(Number(limite) || 50, 200),
      ...(apres ? { cursor: { id: BigInt(apres) }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
    });
    return entrees.map((e) => ({ ...e, id: e.id.toString() })); // BigInt non sérialisable en JSON
  }

  /** BF-50 / TF-13 : recalcul complet de la chaîne. */
  @Get('verification')
  verifier() {
    return this.audit.verifierIntegrite();
  }
}
