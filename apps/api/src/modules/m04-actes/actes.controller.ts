import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles, UtilisateurCourant, type UtilisateurConnecte } from '../../common/security/securite';
import { TAILLE_MAX_OCTETS } from '../documents/pipeline';
import { CreerActeDto, ModifierActeDto, VersionDto } from './actes.dto';
import { ActesService, type GroupeStatut } from './actes.service';

const Uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('M04 — Rédaction')
@Controller('v1')
export class ActesController {
  constructor(private readonly actes: ActesService) {}

  @Get('types-actes')
  @Roles(Role.REDACTEUR)
  types(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.typesPourRedacteur(u);
  }

  @Get('modeles')
  @Roles(Role.REDACTEUR)
  modeles(@Query('typeActeId', Uuid) typeActeId: string) {
    return this.actes.modeles(typeActeId);
  }

  @Get('actes')
  @Roles(Role.REDACTEUR)
  mesActes(@UtilisateurCourant() u: UtilisateurConnecte, @Query('groupe') groupe?: GroupeStatut) {
    return this.actes.mesActes(u, groupe);
  }

  @Post('actes')
  @Roles(Role.REDACTEUR)
  creer(@Body() dto: CreerActeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.creer(u, dto.typeActeId, dto.modeleId);
  }

  @Get('actes/:id')
  detail(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.detail(id, u);
  }

  @Get('actes/:id/suivi')
  suivi(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.suivi(id, u);
  }

  @Patch('actes/:id')
  modifier(@Param('id', Uuid) id: string, @Body() dto: ModifierActeDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.modifier(id, dto, u);
  }

  @Delete('actes/:id')
  @HttpCode(204)
  supprimer(@Param('id', Uuid) id: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.supprimer(id, u);
  }

  @Post('actes/:id/soumission')
  @HttpCode(200)
  soumettre(@Param('id', Uuid) id: string, @Body() dto: VersionDto, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.soumettre(id, dto.version, u);
  }

  /** BF-18 : 202, l'analyse suit (pipeline tubes et filtres). */
  @Post('actes/:id/pieces')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_OCTETS, files: 1 } }))
  ajouterPiece(
    @Param('id', Uuid) id: string,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @UtilisateurCourant() u: UtilisateurConnecte,
  ) {
    if (!fichier) throw new BadRequestException({ code: 'FICHIER_MANQUANT', message: 'Joignez un fichier (champ « fichier »)' });
    return this.actes.ajouterPiece(id, fichier, u);
  }

  @Get('actes/:id/pieces/:pieceId')
  async lirePiece(
    @Param('id', Uuid) id: string,
    @Param('pieceId', Uuid) pieceId: string,
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Res() res: Response,
  ) {
    const { piece, contenu } = await this.actes.lirePiece(id, pieceId, u);
    res.setHeader('Content-Type', piece.typeMime);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(piece.nomFichier)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(contenu);
  }

  @Delete('actes/:id/pieces/:pieceId')
  @HttpCode(204)
  supprimerPiece(@Param('id', Uuid) id: string, @Param('pieceId', Uuid) pieceId: string, @UtilisateurCourant() u: UtilisateurConnecte) {
    return this.actes.supprimerPiece(id, pieceId, u);
  }
}
