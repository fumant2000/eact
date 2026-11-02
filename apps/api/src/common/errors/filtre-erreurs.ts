import { randomBytes } from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const CODES_PAR_STATUT: Record<number, string> = {
  400: 'REQUETE_INVALIDE',
  401: 'NON_AUTHENTIFIE',
  403: 'ACCES_REFUSE',
  404: 'INTROUVABLE',
  409: 'CONFLIT',
  410: 'EXPIRE',
  413: 'TROP_VOLUMINEUX',
  422: 'DONNEES_INVALIDES',
  429: 'TROP_DE_REQUETES',
};

/** Format d'erreur uniforme `{ code, message }` ; une erreur inattendue reçoit une référence journalisée avec la pile. */
@Catch()
export class FiltreErreurs implements ExceptionFilter {
  private readonly logger = new Logger('Erreurs');

  catch(erreur: unknown, hote: ArgumentsHost) {
    const res = hote.switchToHttp().getResponse<Response>();

    if (erreur instanceof HttpException) {
      const statut = erreur.getStatus();
      const corps = erreur.getResponse();
      const objet = typeof corps === 'string' ? { message: corps } : (corps as Record<string, unknown>);
      // Erreurs de validation des DTO regroupées dans `champs`
      const validation = Array.isArray(objet.message) ? { message: 'Données invalides', champs: objet.message } : {};
      return res.status(statut).json({ code: CODES_PAR_STATUT[statut] ?? 'ERREUR', ...objet, ...validation, statusCode: undefined, error: undefined });
    }

    if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
      if (erreur.code === 'P2025') return res.status(404).json({ code: 'INTROUVABLE', message: 'Élément introuvable' });
      if (erreur.code === 'P2002') return res.status(409).json({ code: 'DOUBLON', message: 'Cet élément existe déjà' });
    }

    const reference = randomBytes(4).toString('hex').toUpperCase();
    this.logger.error(`[${reference}] ${erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur)}`);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: 'ERREUR_INTERNE', message: 'Erreur interne du serveur', reference });
  }
}
