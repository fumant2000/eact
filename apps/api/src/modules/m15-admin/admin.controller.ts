import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Request } from 'express';
import { Roles, UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { AdminService } from './admin.service';

class EtapeDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) libelle!: string;
  @ApiProperty({ enum: Role }) @IsEnum(Role) roleRequis!: Role;
  @ApiProperty({ example: 48 }) @IsInt() @Min(1) @Max(720) delaiHeures!: number;
}

class EtapePartielleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) libelle?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) roleRequis?: Role;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(720) delaiHeures?: number;
}

class CircuitDto {
  @ApiProperty() @IsUUID() typeActeId!: string;
  @ApiProperty() @IsUUID() structureId!: string;
  @ApiProperty({ type: [EtapeDto] }) @IsArray() @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => EtapeDto) etapes!: EtapeDto[];
}

class ActivationDto {
  @ApiProperty() @IsBoolean() actif!: boolean;
}
class TypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(80) libelle?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) champsObligatoires?: string[];
  @ApiPropertyOptional({ nullable: true, description: 'null = conservation définitive' }) @IsOptional() @IsInt() @Min(1) @Max(100) dureeConservationAnnees?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() actif?: boolean;
}

class StructureDto {
  @ApiProperty({ example: 'SDRH' }) @IsString() @Matches(/^[A-Za-z0-9-]{2,20}$/) code!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) libelle!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
}

class UtilisateurDto {
  @ApiProperty({ example: 'MINESUP-08001' }) @IsString() @Matches(/^[A-Za-z0-9-]{3,20}$/) matricule!: string;
  @ApiProperty() @IsEmail() @MaxLength(160) email!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) prenom!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) nom!: string;
  @ApiProperty() @IsUUID() structureId!: string;
  @ApiProperty({ enum: Role, isArray: true }) @IsArray() @IsEnum(Role, { each: true }) roles!: Role[];
}

class ModifUtilisateurDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() structureId?: string;
  @ApiPropertyOptional({ enum: Role, isArray: true }) @IsOptional() @IsArray() @IsEnum(Role, { each: true }) roles?: Role[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() actif?: boolean;
}

const Uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('M15 — Administration')
@Controller('v1/admin')
@Roles(Role.ADMINISTRATEUR)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('types') types() {
    return this.admin.types();
  }

  @Patch('types/:id') @HttpCode(204)
  modifierType(@Param('id', Uuid) id: string, @Body() d: TypeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.modifierType(u, id, d);
  }

  @Post('circuits')
  creerCircuit(@Body() d: CircuitDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.creerCircuit(u, d);
  }

  /** Désactivé : plus de nouveaux actes ; les actes déjà en circuit vont au bout. */
  @Patch('circuits/:id')
  modifierCircuit(@Param('id', Uuid) id: string, @Body() d: ActivationDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.modifierCircuit(u, id, d.actif);
  }

  @Post('circuits/:id/etapes')
  ajouterEtape(@Param('id', Uuid) id: string, @Body() e: EtapeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.ajouterEtape(u, id, e);
  }

  @Patch('etapes/:id') @HttpCode(204)
  modifierEtape(@Param('id', Uuid) id: string, @Body() e: EtapePartielleDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.modifierEtape(u, id, e);
  }

  @Delete('etapes/:id') @HttpCode(204)
  supprimerEtape(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.supprimerEtape(u, id);
  }

  @Get('structures') structures() {
    return this.admin.structures();
  }

  @Post('structures')
  creerStructure(@Body() d: StructureDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.creerStructure(u, d);
  }

  @Get('utilisateurs') utilisateurs() {
    return this.admin.utilisateurs();
  }

  @Post('utilisateurs')
  creerUtilisateur(@Body() d: UtilisateurDto, @UtilisateurCourant() u: UtilisateurConnecte, @Req() req: Request) {
    return this.admin.creerUtilisateur(u, d, req.ip ?? 'inconnue');
  }

  @Patch('utilisateurs/:id') @HttpCode(204)
  modifierUtilisateur(@Param('id', Uuid) id: string, @Body() d: ModifUtilisateurDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.modifierUtilisateur(u, id, d);
  }

  @Post('utilisateurs/:id/mfa/reinitialisation') @HttpCode(204)
  reinitialiserMfa(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.reinitialiserMfa(u, id);
  }

  @Post('utilisateurs/:id/deverrouillage') @HttpCode(204)
  deverrouiller(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.admin.deverrouiller(u, id);
  }
}
