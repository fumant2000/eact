import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { TypeDelegation } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { DelegationsService } from './delegations.service';

export class NouvelleDelegationDto {
  @ApiProperty() @IsUUID()
  delegataireId!: string;

  @ApiProperty({ enum: TypeDelegation }) @IsEnum(TypeDelegation)
  type!: TypeDelegation;

  @ApiProperty({ example: '2026-11-02' }) @IsDateString({ strict: true })
  du!: string;

  @ApiProperty({ example: '2026-11-30', description: 'Inclus (jusqu’à 23:59)' }) @IsDateString({ strict: true })
  au!: string;

  @ApiProperty({ example: 'Pour le Ministre et par délégation, Le Secrétaire Général' }) @IsString() @MinLength(3) @MaxLength(200)
  mention!: string;

  @ApiProperty({ type: [String], example: ['NS', 'D', 'ATT'] }) @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  perimetre!: string[];

  @ApiPropertyOptional({ description: 'Code TOTP (délégation de signature)' }) @IsOptional() @IsString() @MaxLength(10)
  code?: string;
}

const Uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('M02 — Délégations')
@Controller('v1/delegations')
export class DelegationsController {
  constructor(private readonly delegations: DelegationsService) {}

  @Get()
  lister(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.delegations.lister(u);
  }

  @Get('candidats')
  candidats(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.delegations.candidats(u);
  }

  /** BF-09 */
  @Post()
  declarer(@Body() dto: NouvelleDelegationDto, @UtilisateurCourant() u: UtilisateurConnecte, @Req() req: Request) {
    return this.delegations.declarer(u, dto, req.ip ?? 'inconnue');
  }

  @Post(':id/revocation')
  @HttpCode(204)
  revoquer(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.delegations.revoquer(u, id);
  }
}
