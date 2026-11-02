import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Langue } from '@prisma/client';
import { lireGabarit } from '@eact/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ClientGithub, GithubIndisponible } from './client-github';

interface EntreeContenu {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export interface EtatSynchronisation {
  source: 'github' | 'cache';
  depot: string | null;
  derniereTentative: Date | null;
  derniereReussite: Date | null;
  erreur: string | null;
}

/** M14 IDepotGabarits — BF-59, RG-23 : gabarits copiés en base ; la rédaction ne lit que ce cache, jamais GitHub. */
@Injectable()
export class GabaritsService {
  private readonly logger = new Logger(GabaritsService.name);
  private etat: EtatSynchronisation = { source: 'cache', depot: null, derniereTentative: null, derniereReussite: null, erreur: null };

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: ClientGithub,
    private readonly events: EventEmitter2,
  ) {}

  etatSynchronisation(): EtatSynchronisation {
    return { ...this.etat, depot: this.github.configure ? process.env.GITHUB_TEMPLATES_REPO! : null };
  }

  async synchroniser(acteurId: string) {
    const depot = process.env.GITHUB_TEMPLATES_REPO;
    // Sous-dossier et branche : permet de lire le dossier gabarits/ du dépôt du projet lui-même.
    const prefixe = (process.env.GITHUB_TEMPLATES_PATH ?? '').replace(/^\/+|\/+$/g, '');
    const ref = encodeURIComponent(process.env.GITHUB_TEMPLATES_REF ?? 'main');
    const chemin = (relatif: string) => (prefixe ? `${prefixe}/${relatif}` : relatif);
    this.etat.derniereTentative = new Date();
    if (!this.github.configure) {
      this.etat = { ...this.etat, source: 'cache', erreur: 'Aucun dépôt de gabarits configuré (GITHUB_TEMPLATES_REPO)' };
      return { ...this.etatSynchronisation(), misAJour: 0, inchanges: 0, ignores: [] as string[] };
    }
    let misAJour = 0;
    let inchanges = 0;
    const ignores: string[] = [];
    try {
      for (const langue of [Langue.FR, Langue.EN]) {
        let fichiers: EntreeContenu[];
        try {
          fichiers = await this.github.get<EntreeContenu[]>(`/repos/${depot}/contents/${chemin(langue.toLowerCase())}?ref=${ref}`);
        } catch (e) {
          if (e instanceof GithubIndisponible && e.message.includes(' 404 ')) continue; // dossier de langue absent
          throw e;
        }
        for (const f of fichiers.filter((x) => x.type === 'file' && x.name.endsWith('.html'))) {
          const contenu = await this.github.get<{ content: string; sha: string }>(`/repos/${depot}/contents/${f.path}?ref=${ref}`);
          // Identifiant du commit qui a modifié le fichier en dernier (traçabilité, BF-60)
          const [commit] = await this.github.get<{ sha: string }[]>(`/repos/${depot}/commits?path=${encodeURIComponent(f.path)}&sha=${ref}&per_page=1`);
          let g;
          try {
            g = lireGabarit(Buffer.from(contenu.content, 'base64').toString('utf8'));
          } catch (e) {
            ignores.push(`${f.path} : ${(e as Error).message}`);
            continue;
          }
          const type = await this.prisma.typeActe.findUnique({ where: { code: g.type } });
          if (!type) {
            ignores.push(`${f.path} : type « ${g.type} » inconnu`);
            continue;
          }
          const relatif = prefixe && f.path.startsWith(`${prefixe}/`) ? f.path.slice(prefixe.length + 1) : f.path;
          const cle = { typeActeId_langue_cheminGithub: { typeActeId: type.id, langue, cheminGithub: relatif } };
          const existant = await this.prisma.modeleActe.findUnique({ where: cle });
          const commitSha = commit?.sha ?? contenu.sha;
          if (existant?.commitSha === commitSha) {
            inchanges++;
            continue;
          }
          const donnees = { libelle: g.libelle, version: g.version, description: g.description, ampliationsDefaut: g.ampliations, contenuCache: g.corps, commitSha };
          await this.prisma.modeleActe.upsert({ where: cle, update: donnees, create: { typeActeId: type.id, langue, cheminGithub: relatif, ...donnees } });
          misAJour++;
        }
      }
      this.etat = { ...this.etat, source: 'github', derniereReussite: new Date(), erreur: null };
      this.events.emit('gabarits.synchronises', {
        acteurId,
        action: 'gabarits.synchronises',
        ressourceType: 'modele_acte',
        details: { depot, misAJour, inchanges, ignores: ignores.length },
      });
    } catch (e) {
      // RG-23 : l'échec ne touche pas le cache, la rédaction continue.
      this.etat = { ...this.etat, source: 'cache', erreur: (e as Error).message };
      this.logger.warn(`Synchronisation des gabarits impossible : ${(e as Error).message}`);
    }
    return { ...this.etatSynchronisation(), misAJour, inchanges, ignores };
  }
}
