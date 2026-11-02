import { BadRequestException, Controller, Get, HttpCode, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/security/securite';
import { VerificationService } from './verification.service';

/** Routes publiques (CDC tableau 25) : /public/…, limitées en débit par nginx en production. */
@ApiTags('M13 — Vérification publique')
@Public()
@Controller('public/verifier')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get(':code')
  verifier(@Param('code') code: string) {
    return this.verification.verifier(code.slice(0, 20));
  }

  @Post(':code/fichier')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  comparer(@Param('code') code: string, @UploadedFile() fichier?: Express.Multer.File) {
    if (!fichier) throw new BadRequestException({ code: 'FICHIER_MANQUANT', message: 'Joignez le PDF à comparer' });
    return this.verification.comparer(code.slice(0, 20), fichier.buffer);
  }
}
