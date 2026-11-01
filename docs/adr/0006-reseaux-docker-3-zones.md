# ADR 0006 — Trois réseaux Docker = trois zones

**Contexte.** CT-12 : seul le proxy est exposé ; GitHub n'est joint qu'en sortie. CDC §15 : DMZ / applicatif / données.

**Décision.** Réseaux Compose `dmz` (nginx), `app` (nginx, web, api, worker, gotenberg, clamav),
`data` (`internal: true` : api, worker, migrate, postgres, redis, s3), `egress` (worker seul, accès Internet sortant).
Seul `nginx` publie des ports. Les services se désignent par leur nom DNS (transparence de localisation).

**Conséquences.**
+ La base n'est joignable ni depuis l'extérieur ni depuis le frontend (la présentation n'accède jamais aux données).
− Docker ne publie aucun port sur un réseau `internal` : en dev, `docker-compose.override.yml` rattache postgres, redis et s3
  à un réseau `devhost` pour exposer leurs ports sur 127.0.0.1 (5433, 6380, 9000/9001). Jamais en prod.
