import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Politique de mot de passe (ENF-06). */
const POLITIQUE_MOT_DE_PASSE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

export class ConnexionDto {
  @ApiProperty({ example: 'MINESUP-04812', description: 'Matricule ou adresse e-mail (BF-01)' })
  @IsString() @IsNotEmpty() @MaxLength(160)
  identifiant!: string;

  @ApiProperty({ example: 'Minesup@2026' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  motDePasse!: string;
}

export class CodeDto {
  @ApiProperty({ example: '482917', description: 'Code TOTP à 6 chiffres ou code de secours XXXX-XXXX' })
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;
}

export class OubliDto {
  @ApiProperty({ example: 'MINESUP-04812' })
  @IsString() @IsNotEmpty() @MaxLength(160)
  identifiant!: string;
}

export class ReinitialisationDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(200)
  jeton!: string;

  @ApiProperty({ description: '10 caractères minimum, une majuscule, un chiffre, un caractère spécial' })
  @IsString() @MinLength(10) @MaxLength(200)
  @Matches(POLITIQUE_MOT_DE_PASSE, { message: 'Le mot de passe ne respecte pas la politique de sécurité' })
  motDePasse!: string;
}

export class ConnexionDemoDto {
  @ApiProperty({ example: 'MINESUP-00001' })
  @IsString() @IsNotEmpty() @MaxLength(40)
  matricule!: string;
}
