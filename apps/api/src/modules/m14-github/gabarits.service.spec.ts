import { GithubIndisponible, type ClientGithub } from './client-github';
import { GabaritsService } from './gabarits.service';

const GABARIT = `<!--
type: NS
libelle: Note de service · test
version: 3.0
ampliations: SG | DAG
-->
<p>Corps.</p>`;

/** Prisma réduit aux appels du service, en mémoire. */
function fausseBase() {
  const modeles = new Map<string, Record<string, unknown>>();
  const cle = (w: { typeActeId_langue_cheminGithub: { cheminGithub: string; langue: string } }) =>
    `${w.typeActeId_langue_cheminGithub.langue}:${w.typeActeId_langue_cheminGithub.cheminGithub}`;
  return {
    modeles,
    typeActe: { findUnique: async ({ where }: { where: { code: string } }) => (where.code === 'NS' ? { id: 't-ns' } : null) },
    modeleActe: {
      findUnique: async ({ where }: { where: Parameters<typeof cle>[0] }) => modeles.get(cle(where)) ?? null,
      upsert: async ({ where, update, create }: { where: Parameters<typeof cle>[0]; update: object; create: object }) => {
        const k = cle(where);
        modeles.set(k, { ...(modeles.get(k) ?? create), ...update });
      },
    },
  };
}

function fauxGithub(reponses: Record<string, unknown>, panne = false) {
  return {
    configure: true,
    get: async (chemin: string) => {
      if (panne) throw new GithubIndisponible('GitHub 503 sur /repos');
      const trouve = Object.entries(reponses).find(([prefixe]) => chemin.startsWith(prefixe));
      if (!trouve) throw new GithubIndisponible(`GitHub 404 sur ${chemin}`);
      return trouve[1];
    },
  } as unknown as ClientGithub;
}

describe('Synchronisation des gabarits (BF-59, RG-23)', () => {
  const evenements = { emit: jest.fn() };
  beforeEach(() => {
    process.env.GITHUB_TEMPLATES_REPO = 'minesup/eact-gabarits';
    process.env.GITHUB_TEMPLATES_PATH = 'gabarits';
  });

  it('lit les fichiers, les analyse et met le cache à jour avec le commit', async () => {
    const base = fausseBase();
    const github = fauxGithub({
      '/repos/minesup/eact-gabarits/contents/gabarits/fr?': [{ name: 'ns.html', path: 'gabarits/fr/ns.html', type: 'file' }],
      '/repos/minesup/eact-gabarits/contents/gabarits/fr/ns.html': { content: Buffer.from(GABARIT).toString('base64'), sha: 'blob1' },
      '/repos/minesup/eact-gabarits/commits': [{ sha: 'commit-abc' }],
    });
    const service = new GabaritsService(base as never, github, evenements as never);
    const r = await service.synchroniser('admin');
    expect(r).toMatchObject({ source: 'github', misAJour: 1, inchanges: 0 });
    expect(base.modeles.get('FR:fr/ns.html')).toMatchObject({ version: '3.0', commitSha: 'commit-abc', ampliationsDefaut: ['SG', 'DAG'], contenuCache: '<p>Corps.</p>' });

    // Même commit : rien à réécrire
    expect(await service.synchroniser('admin')).toMatchObject({ misAJour: 0, inchanges: 1 });
  });

  it('GitHub en panne : le cache est conservé et la source reste « cache »', async () => {
    const base = fausseBase();
    base.modeles.set('FR:fr/ns.html', { version: '2.3', commitSha: 'seed' });
    const service = new GabaritsService(base as never, fauxGithub({}, true), evenements as never);
    const r = await service.synchroniser('admin');
    expect(r.source).toBe('cache');
    expect(r.erreur).toContain('503');
    expect(base.modeles.get('FR:fr/ns.html')).toMatchObject({ version: '2.3' });
  });

  it('un gabarit mal formé ou d’un type inconnu est ignoré, pas bloquant', async () => {
    const base = fausseBase();
    const github = fauxGithub({
      '/repos/minesup/eact-gabarits/contents/gabarits/fr?': [
        { name: 'a.html', path: 'gabarits/fr/a.html', type: 'file' },
        { name: 'b.html', path: 'gabarits/fr/b.html', type: 'file' },
      ],
      '/repos/minesup/eact-gabarits/contents/gabarits/fr/a.html': { content: Buffer.from('<p>sans en-tête</p>').toString('base64'), sha: 'x' },
      '/repos/minesup/eact-gabarits/contents/gabarits/fr/b.html': { content: Buffer.from(GABARIT.replace('type: NS', 'type: ZZ')).toString('base64'), sha: 'y' },
      '/repos/minesup/eact-gabarits/commits': [{ sha: 'c' }],
    });
    const r = await new GabaritsService(base as never, github, evenements as never).synchroniser('admin');
    expect(r.misAJour).toBe(0);
    expect(r.ignores).toHaveLength(2);
    expect(r.source).toBe('github');
  });
});
