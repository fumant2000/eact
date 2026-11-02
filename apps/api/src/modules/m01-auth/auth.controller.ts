import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import {
  COOKIE_ACCES,
  COOKIE_MFA,
  COOKIE_RAFRAICHISSEMENT,
  Public,
  UtilisateurCourant,
  type UtilisateurConnecte,
} from '../../common/security/securite';
import { CodeDto, ConnexionDemoDto, ConnexionDto, OubliDto, ReinitialisationDto } from './auth.dto';
import { AuthService, type ResultatConnexion } from './auth.service';

// Cookies httpOnly : le JavaScript du navigateur ne lit jamais les jetons (CDC tableau 24).
const base: CookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' };
const COOKIES = {
  [COOKIE_ACCES]: { ...base, sameSite: 'lax', maxAge: 15 * 60_000 },
  [COOKIE_RAFRAICHISSEMENT]: { ...base, sameSite: 'strict', maxAge: 12 * 3600_000 },
  [COOKIE_MFA]: { ...base, sameSite: 'strict', maxAge: 5 * 60_000 },
} satisfies Record<string, CookieOptions>;

const ip = (req: Request) => req.ip ?? 'inconnue';

@ApiTags('M01 — Authentification')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Pose les cookies selon l'étape et ne renvoie au navigateur que l'étape suivante. */
  private repondre(res: Response, r: ResultatConnexion) {
    if (r.etape === 'CONNECTE') {
      res.clearCookie(COOKIE_MFA, base);
      res.cookie(COOKIE_ACCES, r.jetons.acces, COOKIES[COOKIE_ACCES]);
      res.cookie(COOKIE_RAFRAICHISSEMENT, r.jetons.rafraichissement, COOKIES[COOKIE_RAFRAICHISSEMENT]);
      return { etape: r.etape, codesSecours: r.codesSecours };
    }
    res.cookie(COOKIE_MFA, r.jetonMfa, COOKIES[COOKIE_MFA]);
    return { etape: r.etape };
  }

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: ConnexionDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.repondre(res, await this.auth.connecter(dto.identifiant, dto.motDePasse, ip(req)));
  }

  @Public() @Post('mfa/verify') @HttpCode(200)
  async verifierMfa(@Body() dto: CodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.repondre(res, await this.auth.verifierMfa(req.cookies?.[COOKIE_MFA], dto.code, ip(req)));
  }

  @Public() @Post('mfa/enrolement') @HttpCode(200)
  demarrerEnrolement(@Req() req: Request) {
    return this.auth.demarrerEnrolement(req.cookies?.[COOKIE_MFA]);
  }

  @Public() @Post('mfa/enrolement/confirmation') @HttpCode(200)
  async confirmerEnrolement(@Body() dto: CodeDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.repondre(res, await this.auth.confirmerEnrolement(req.cookies?.[COOKIE_MFA], dto.code, ip(req)));
  }

  @Public() @Post('refresh') @HttpCode(200)
  async rafraichir(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const jetons = await this.auth.rafraichir(req.cookies?.[COOKIE_RAFRAICHISSEMENT]);
    res.cookie(COOKIE_ACCES, jetons.acces, COOKIES[COOKIE_ACCES]);
    res.cookie(COOKIE_RAFRAICHISSEMENT, jetons.rafraichissement, COOKIES[COOKIE_RAFRAICHISSEMENT]);
    return { ok: true };
  }

  @Post('logout') @HttpCode(200)
  async deconnecter(@UtilisateurCourant() u: UtilisateurConnecte, @Res({ passthrough: true }) res: Response) {
    await this.auth.deconnecter(u.sid, u.sub);
    for (const nom of Object.keys(COOKIES)) res.clearCookie(nom, base);
    return { ok: true };
  }

  @Get('moi')
  moi(@UtilisateurCourant() u: UtilisateurConnecte) {
    return this.auth.profil(u.sub);
  }

  // ─────────── Mode démonstration (DEMO_MODE=true, jamais en production) ───────────

  private exigerDemo() {
    if (!AuthService.modeDemo()) throw new NotFoundException();
  }

  @Public() @Get('demo')
  async demo() {
    if (!AuthService.modeDemo()) return { actif: false };
    return { actif: true, motDePasse: process.env.DEMO_MOT_DE_PASSE ?? 'Minesup@2026', comptes: await this.auth.comptesDemo() };
  }

  @Public() @Post('demo/connexion') @HttpCode(200)
  async connexionDemo(@Body() dto: ConnexionDemoDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.exigerDemo();
    return this.repondre(res, await this.auth.connexionDemo(dto.matricule, ip(req)));
  }

  @Public() @Get('demo/code-mfa')
  codeDemoMfa(@Req() req: Request) {
    this.exigerDemo();
    return this.auth.codeDemoMfa(req.cookies?.[COOKIE_MFA]);
  }

  @Get('demo/code')
  codeDemo(@UtilisateurCourant() u: UtilisateurConnecte) {
    this.exigerDemo();
    return this.auth.codeDemo(u.sub);
  }

  @Public() @Post('mot-de-passe/oubli') @HttpCode(202)
  oubli(@Body() dto: OubliDto, @Req() req: Request) {
    return this.auth.demanderReinitialisation(dto.identifiant, ip(req));
  }

  @Public() @Post('mot-de-passe/reinitialisation') @HttpCode(200)
  async reinitialiser(@Body() dto: ReinitialisationDto, @Req() req: Request) {
    await this.auth.reinitialiser(dto.jeton, dto.motDePasse, ip(req));
    return { ok: true };
  }
}
