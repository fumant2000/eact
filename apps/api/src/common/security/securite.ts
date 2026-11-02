import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import type { Request } from 'express';

export const COOKIE_ACCES = 'eact_at';
export const COOKIE_RAFRAICHISSEMENT = 'eact_rt';
export const COOKIE_MFA = 'eact_mfa';

/** Contenu du jeton d'accès (JWT court, 15 min). Le serveur reste sans état (CDC §16.2). */
export interface UtilisateurConnecte {
  sub: string;
  sid: string; // session (révocable) à laquelle appartient le jeton
  roles: Role[];
  structureId: string;
}

const CLE_PUBLIC = 'eact:public';
const CLE_ROLES = 'eact:roles';

/** Route accessible sans authentification (connexion, vérification publique, santé). */
export const Public = () => SetMetadata(CLE_PUBLIC, true);

/** RBAC : au moins un des rôles. L'ABAC (structure, confidentialité) est vérifié dans les services. */
export const Roles = (...roles: Role[]) => SetMetadata(CLE_ROLES, roles);

export const UtilisateurCourant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UtilisateurConnecte => ctx.switchToHttp().getRequest().utilisateur,
);

/** Jeton lu dans le cookie httpOnly, ou en en-tête Bearer (Swagger, tests). */
function extraireJeton(req: Request): string | undefined {
  const cookie = req.cookies?.[COOKIE_ACCES];
  if (cookie) return cookie;
  const [schema, jeton] = req.headers.authorization?.split(' ') ?? [];
  return schema === 'Bearer' ? jeton : undefined;
}

/** Garde globale (APP_GUARD) : toute route est protégée sauf @Public(). */
@Injectable()
export class JwtGarde implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const cibles = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, cibles)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { utilisateur?: UtilisateurConnecte }>();
    const jeton = extraireJeton(req);
    if (!jeton) throw new UnauthorizedException('Authentification requise');
    try {
      const charge = this.jwt.verify<UtilisateurConnecte & { typ?: string }>(jeton);
      if (charge.typ !== 'acces') throw new Error('type de jeton');
      req.utilisateur = charge;
    } catch {
      throw new UnauthorizedException('Session expirée');
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(CLE_ROLES, cibles);
    if (roles?.length && !roles.some((r) => req.utilisateur!.roles.includes(r))) {
      throw new ForbiddenException('Droits insuffisants pour cette action');
    }
    return true;
  }
}
