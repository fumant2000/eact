import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface StructureChaine {
  id: string;
  code: string;
  libelle: string;
  /** Codes de la racine vers la structure : ['SG', 'DAG'] → référence « …/MINESUP/SG/DAG ». */
  chaine: string[];
}

/** IParapheur (partie lecture du circuit) — circuits paramétrables par type × structure (BF-65, ENF-08). */
@Injectable()
export class CircuitService {
  constructor(private readonly prisma: PrismaService) {}

  /** La structure puis ses ascendants, de la plus proche à la racine. */
  async ascendants(structureId: string): Promise<StructureChaine[]> {
    const toutes = await this.prisma.structure.findMany({ select: { id: true, code: true, libelle: true, parentId: true } });
    const parId = new Map(toutes.map((s) => [s.id, s]));
    const lignee: (typeof toutes)[number][] = [];
    for (let s = parId.get(structureId); s; s = s.parentId ? parId.get(s.parentId) : undefined) lignee.push(s);
    return lignee.map((s, i) => ({
      id: s.id,
      code: s.code,
      libelle: s.libelle,
      chaine: lignee.slice(i).map((x) => x.code).reverse(),
    }));
  }

  /** Circuit actif du type pour la structure émettrice exactement. */
  circuit(typeActeId: string, structureId: string) {
    return this.prisma.circuitValidation.findFirst({
      where: { typeActeId, structureId, actif: true },
      include: { etapes: { orderBy: { ordre: 'asc' } } },
    });
  }

  /** Première structure (la sienne, puis ses ascendants) disposant d'un circuit pour ce type. */
  async structureEmettriceParDefaut(typeActeId: string, structureAgentId: string) {
    for (const s of await this.ascendants(structureAgentId)) {
      if (await this.circuit(typeActeId, s.id)) return s;
    }
    return null;
  }

  /**
   * Qui signera : une délégation active couvrant le type (BF-09), sinon le Ministre.
   * Libellé indicatif pour l'éditeur ; la vérification réelle (RG-11) se fait à la signature.
   */
  async signatairePrevu(codeType: string): Promise<string> {
    const maintenant = new Date();
    const delegation = await this.prisma.delegation.findFirst({
      where: { actif: true, debut: { lte: maintenant }, fin: { gte: maintenant }, perimetre: { has: codeType } },
      include: { delegataire: { include: { roles: true } } },
    });
    if (!delegation) return 'Le Ministre';
    return delegation.delegataire.roles.some((r) => r.role === Role.SECRETAIRE_GENERAL)
      ? 'Le Secrétaire Général'
      : `${delegation.delegataire.prenom} ${delegation.delegataire.nom}`;
  }
}
