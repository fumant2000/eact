# ADR 0002 — Monorepo npm workspaces

**Contexte.** Le frontend et le backend partagent les statuts d'acte, les transitions et les
schémas de validation (Zod). Le CDC prévoit un seul dépôt `eact` (§19.1).

**Décision.** Dépôt unique avec workspaces npm : `apps/api`, `apps/web`, `packages/shared`.

**Conséquences.**
+ Une règle métier (ex. transitions de statut) est écrite une fois.
+ Une PR = un changement cohérent front + back.
− Les Dockerfiles utilisent la racine comme contexte de build.
