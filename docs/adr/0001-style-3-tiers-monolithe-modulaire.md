# ADR 0001 — 3-tiers + monolithe modulaire

**Contexte.** 7 étudiants, 12 semaines, exigences fortes d'intégrité (numérotation, audit) et
de maintenabilité (ENF-08), extension future à d'autres structures (EV-05).

**Décision.** Présentation Next.js (MVVM) / serveur NestJS en **un seul déployable** découpé en
15 modules (M01–M15) / PostgreSQL référentiel. Communication inter-modules par interfaces
injectées et par bus d'événements. Un second point d'entrée (`worker.ts`) exécute les files BullMQ.

**Conséquences.**
+ Transactions ACID locales (signature + numéro + audit dans la même transaction).
+ Une seule image Docker pour `api` et `worker`.
+ Extraction en microservice possible module par module (frontières déjà tracées).
− Discipline nécessaire : interdiction d'importer le dépôt Prisma d'un autre module (règle ESLint `no-restricted-imports`).
