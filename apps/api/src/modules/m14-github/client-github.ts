import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';

export class GithubIndisponible extends Error {}

const API = 'https://api.github.com';
const SEUIL_DISJONCTEUR = 5; // échecs consécutifs (CDC §19.3)
const OUVERTURE_MS = 60_000;

/** Client REST GitHub avec disjoncteur (CDC §19.3) ; authentification : GitHub App, sinon GITHUB_TOKEN, sinon anonyme. */
@Injectable()
export class ClientGithub {
  private readonly logger = new Logger(ClientGithub.name);
  private jetonInstallation?: { valeur: string; expire: number };
  private echecs = 0;
  private ouvertJusqua = 0;

  private jwtApplication(): string | null {
    const appId = process.env.GITHUB_APP_ID;
    const chemin = process.env.GITHUB_PRIVATE_KEY_PATH ?? process.env.GITHUB_APP_KEY_FILE;
    if (!appId || !chemin) return null;
    let cle: string;
    try {
      cle = readFileSync(chemin, 'utf8');
    } catch {
      return null;
    }
    if (!cle.includes('PRIVATE KEY')) return null;
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const maintenant = Math.floor(Date.now() / 1000);
    const corps = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iat: maintenant - 60, exp: maintenant + 540, iss: appId })}`;
    return `${corps}.${createSign('RSA-SHA256').update(corps).sign(cle, 'base64url')}`;
  }

  private async autorisation(): Promise<string | null> {
    if (this.jetonInstallation && this.jetonInstallation.expire > Date.now() + 60_000) return `Bearer ${this.jetonInstallation.valeur}`;
    const jwt = this.jwtApplication();
    if (jwt && process.env.GITHUB_INSTALLATION_ID) {
      const r = await this.brut('POST', `/app/installations/${process.env.GITHUB_INSTALLATION_ID}/access_tokens`, `Bearer ${jwt}`);
      const j = (await r.json()) as { token: string; expires_at: string };
      this.jetonInstallation = { valeur: j.token, expire: new Date(j.expires_at).getTime() };
      return `Bearer ${j.token}`;
    }
    return process.env.GITHUB_TOKEN ? `Bearer ${process.env.GITHUB_TOKEN}` : null;
  }

  private async brut(methode: string, chemin: string, autorisation: string | null) {
    const debut = Date.now();
    const r = await fetch(`${API}${chemin}`, {
      method: methode,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'EACT-MINESUP',
        ...(autorisation ? { Authorization: autorisation } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    this.logger.log(`${methode} ${chemin.split('?')[0]} → ${r.status} (${Date.now() - debut} ms, quota restant ${r.headers.get('x-ratelimit-remaining') ?? '?'})`);
    if (!r.ok) throw new GithubIndisponible(`GitHub ${r.status} sur ${chemin.split('?')[0]}`);
    return r;
  }

  get configure(): boolean {
    const depot = process.env.GITHUB_TEMPLATES_REPO;
    return !!depot && !depot.startsWith('org/');
  }

  async get<T>(chemin: string): Promise<T> {
    if (Date.now() < this.ouvertJusqua) throw new GithubIndisponible('Disjoncteur ouvert : GitHub momentanément ignoré');
    try {
      const r = await this.brut('GET', chemin, await this.autorisation());
      this.echecs = 0;
      return (await r.json()) as T;
    } catch (e) {
      if (++this.echecs >= SEUIL_DISJONCTEUR) {
        this.ouvertJusqua = Date.now() + OUVERTURE_MS;
        this.logger.warn(`Disjoncteur GitHub ouvert pour ${OUVERTURE_MS / 1000} s`);
      }
      throw e instanceof GithubIndisponible ? e : new GithubIndisponible((e as Error).message);
    }
  }
}
