# EACT — Gestion électronique des actes administratifs

Cas d'étude : **Ministère de l'Enseignement Supérieur (MINESUP)** — Secrétariat Général et Direction des Affaires Générales (pilote) · ENSPD — UE Architecture Logicielle & Objets répartis.
Référence : cahier des charges `EACT-CDC-001` v1.1.

## Démarrage rapide (une commande)

Prérequis : Docker Desktop démarré.

```bash
cp .env.example .env      # la première fois
docker compose up -d      # construit, migre, charge les données de démo et démarre tout
```

| URL | Service |
|---|---|
| http://localhost:8080 | Application (connexion en un clic dans le panneau « Mode démonstration ») |
| http://localhost:8025 | Mailpit : tous les e-mails envoyés par EACT |
| http://localhost:3000/docs | Swagger de l'API |

Premier lancement : 5 à 10 minutes (construction des images) ; ensuite quelques secondes. Arrêt : `docker compose down`.
Comptes, scénario de présentation, QR scanné par un téléphone et développement avec rechargement à chaud :
[docs/demarrage-local.md](docs/demarrage-local.md).

## Pile

Next.js (MVVM) · NestJS (monolithe modulaire) · Prisma · PostgreSQL 16 · Redis + BullMQ · MinIO (S3) ·
Gotenberg (PDF/A) · ClamAV · Nginx · Prometheus / Grafana / Loki · GitHub Actions.

## Documentation

| Document | Contenu |
|---|---|
| [docs/demarrage-local.md](docs/demarrage-local.md) | Mode léger, rôle de chaque service, comptes et scénario de démo |
| [docs/audit-reprise-collaborateur.md](docs/audit-reprise-collaborateur.md) | Audit du code reçu et ce qui a été repris |
| [docs/architecture.md](docs/architecture.md) | Style, conteneurs, modules, cycle de vie, mécanismes répartis |
| [docs/backlog-priorites.md](docs/backlog-priorites.md) | Priorités P0 → P3 et planning des itérations |
| [docs/design-system.md](docs/design-system.md) | Charte graphique (couleurs, typo, statuts) |
| [docs/adr/](docs/adr/) | Décisions d'architecture |

## Structure

```
apps/api         NestJS : 15 modules M01–M15 + pipeline documents, Prisma
apps/web         Next.js : app router, features/<écran>/{model,view-model,view}
packages/shared  Statuts, transitions, format de référence, événements
infra/           nginx, postgres, prometheus, grafana, alloy, sauvegardes
```

## Conventions (CDC §22)

Branches `main` / `develop` / `feature/*` · PR relue par un autre membre · Conventional Commits ·
migrations Prisma versionnées · aucun secret dans le dépôt · une ADR par décision d'architecture.
