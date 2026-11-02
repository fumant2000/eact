import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Langue, Niveau, Portee } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreerActeDto {
  @ApiProperty() @IsUUID()
  typeActeId!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  modeleId?: string;
}

/** BF-17 : enregistrement automatique ; champs facultatifs, version obligatoire (verrou optimiste). */
export class ModifierActeDto {
  @ApiProperty({ description: 'Version lue par le client (verrou optimiste)' }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  objet?: string;

  @ApiPropertyOptional({ description: 'HTML restreint (paragraphes, gras, italique, souligné, listes) ; nettoyé côté serveur' })
  @IsOptional() @IsString() @MaxLength(200_000)
  contenu?: string;

  @ApiPropertyOptional({ enum: Langue }) @IsOptional() @IsEnum(Langue)
  langue?: Langue;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  traductionRequise?: boolean;

  @ApiPropertyOptional({ enum: Niveau }) @IsOptional() @IsEnum(Niveau)
  confidentialite?: Niveau;

  @ApiPropertyOptional({ enum: Portee }) @IsOptional() @IsEnum(Portee)
  portee?: Portee;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  structureId?: string;

  @ApiPropertyOptional({ type: [String], description: "Liste d'ampliation (BF-16, BF-34)" })
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(120, { each: true })
  ampliations?: string[];
}

export class VersionDto {
  @ApiProperty() @IsInt() @Min(1)
  version!: number;
}
