# ADR 0006 — Trois réseaux Docker = trois zones

**Contexte.** CT-12 : seul le proxy est exposé ; GitHub n'est joint qu'en sortie. CDC §15 : DMZ / applicatif / données.

**Décision.** Réseaux Compose `dmz` (nginx), `app` (nginx, web, api, worker, gotenberg, clamav),
`data` (`internal: true` : api, worker, postgres, redis, minio), `egress` (worker seul, accès Internet sortant).
Seul `nginx` publie des ports. Les services se désignent par leur nom DNS (transparence de localisation).

**Conséquences.**
+ La base n'est joignable ni depuis l'extérieur ni depuis le frontend (la présentation n'accède jamais aux données).
− En dev, les ports de postgres/minio sont publiés via `docker-compose.override.yml` pour les outils locaux.
