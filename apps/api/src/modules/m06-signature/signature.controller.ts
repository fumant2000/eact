import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { ActesService } from '../m04-actes/actes.service';
import { SignatureService } from './signature.service';

export class SignatureDto {
  @ApiProperty({ example: '307194', description: 'Code TOTP (RG-12)' }) @IsString() @MaxLength(10)
  code!: string;
}

const Uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('M06 — Signature')
@Controller('v1')
export class SignatureController {
  constructor(
    private readonly signature: SignatureService,
    private readonly actes: ActesService,
  ) {}

  /** E1 : actes prêts à signer relevant de ma compétence (titulaire ou délégation en cours). */
  @Get('signature')
  aSigner(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.signature.aSigner(u);
  }

  /** E2 / E6 : puis-je signer, en quelle qualité ; ou résultat de la signature. */
  @Get('actes/:id/signature')
  async etat(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    const acte = await this.actes.detail(id, u); // contrôle d'accès (RG-15)
    if (acte.reference) return { signe: true, resultat: await this.signature.resultat(id) };
    const c = await this.signature.competence(u, acte.type.code, acte.redacteurId);
    return {
      signe: false,
      peutSigner: acte.statut === 'PRET_A_SIGNER' && c.peut,
      qualite: c.peut ? c.qualite : null,
      raison: c.peut ? null : c.raison,
    };
  }

  /** UC-09. Exactement une fois (§16.3) : la clé d'idempotence rejouée renvoie la même référence. */
  @Post('actes/:id/signature')
  @HttpCode(201)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Identifiant unique de la tentative (UUID)' })
  signer(
    @Param('id', Uuid) id: string,
    @Body() dto: SignatureDto,
    @Headers('idempotency-key') cle: string | undefined,
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Req() req: Request,
  ) {
    return this.signature.signer(id, u, dto.code, cle, req.ip ?? 'inconnue');
  }

  /** BF-32 : PDF/A signé. */
  @Get('actes/:id/pdf')
  async pdf(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte, @Res() res: Response) {
    await this.actes.detail(id, u);
    const { fichier, nom } = await this.signature.lirePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nom}"`);
    res.send(fichier);
  }
}
