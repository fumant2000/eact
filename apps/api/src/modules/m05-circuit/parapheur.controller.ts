import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { DecisionVisa, Role } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Roles, UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { CircuitService } from './circuit.service';

export class DecisionVisaDto {
  @ApiProperty({ enum: DecisionVisa }) @IsEnum(DecisionVisa)
  decision!: DecisionVisa;

  @ApiProperty({ description: "Version de l'acte lue par le viseur (verrou optimiste)" }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ description: 'Obligatoire pour CORRECTION et REJET' }) @IsOptional() @IsString() @MaxLength(500)
  observation?: string;

  @ApiPropertyOptional({ description: 'CORRECTION : 0 = rédaction, sinon ordre d’une étape déjà franchie' }) @IsOptional() @IsInt() @Min(0)
  etapeRetour?: number;
}

const Uuid = new ParseUUIDPipe({ version: '4' });
const VISEURS = [Role.VISEUR, Role.JURISTE, Role.TRADUCTEUR, Role.SECRETAIRE_GENERAL];

@ApiTags('M05 — Parapheur')
@Controller('v1')
export class ParapheurController {
  constructor(private readonly circuits: CircuitService) {}

  /** BF-23 : actes en attente de mon visa, triés par échéance, et mes visas récents. */
  @Get('parapheur')
  @Roles(...VISEURS)
  parapheur(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.circuits.parapheur(u);
  }

  /** BF-24 à BF-26 (UC-08). Les droits fins (RG-04, RG-18, RG-19) sont vérifiés par le service. */
  @Post('actes/:id/visas')
  @HttpCode(200)
  @Roles(...VISEURS)
  decider(@Param('id', Uuid) id: string, @Body() dto: DecisionVisaDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.circuits.decider(id, dto, u);
  }
}
