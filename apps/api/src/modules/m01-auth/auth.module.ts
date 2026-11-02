import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtGarde } from '../../common/security/securite';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * M01 — Authentification et sécurité
 * Exigences : BF-01 à BF-05 · Priorité : P0
 * Interface fournie : IAuthentification (connexion, TOTP, jetons)
 *
 * Global : la garde JWT protège toutes les routes de l'API ; AuthService est requis par M06 (RG-12).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) throw new Error('JWT_ACCESS_SECRET manquant');
        return { secret };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtGarde }],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
