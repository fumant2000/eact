# ADR 0004 — Journal d'audit chaîné

**Contexte.** BF-48 → BF-50, TF-13 : toute altération du journal doit être détectée.

**Décision.** Table `evenement_audit` en ajout seul : `hash = SHA-256(hash_precedent || contenu canonique)`.
Trigger PostgreSQL refusant UPDATE/DELETE ; droits UPDATE/DELETE retirés au rôle applicatif.
Insertion sérialisée par `pg_advisory_xact_lock` pour garantir l'ordre de chaîne.
Le module Audit écoute **tous** les événements du bus (invocation implicite).

**Conséquences.**
+ Vérification d'intégrité à la demande (`GET /v1/audit/verification`).
− Un super-utilisateur base peut toujours réécrire toute la chaîne → ancrage périodique du dernier hash hors base (P2).
