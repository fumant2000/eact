# Recettes de bout en bout

Scripts Node (sans dépendance hors du dépôt) qui jouent les parcours réels contre l'API en marche, comme le
ferait un agent : connexion, rédaction, visas, signature, vérification publique, administration. Chaque ligne
`OK` / `KO` cite l'exigence du cahier des charges qu'elle vérifie (BF-xx, RG-xx, TF-xx).

```bash
docker compose up -d                       # la démo complète doit tourner
node tests/recette/lancer.cjs              # toutes les recettes
node tests/recette/lancer.cjs m05 m06      # parapheur et signature seulement
```

| Script | Module | Contrôles | Points forts |
|---|---|---|---|
| `recette-m01.cjs` | Authentification | 32 | verrouillage (y compris en parallèle), TOTP (essais non remis à zéro par une reconnexion), enrôlement, codes de secours, rotation et révocation des jetons, réinitialisation par Mailpit |
| `recette-m04.cjs` | Rédaction | 34 | RG-03, verrou optimiste, HTML nettoyé, pipeline des pièces (EICAR, faux PDF), RG-16, entrées invalides → 400 |
| `recette-m05.cjs` | Parapheur | 31 | qui vise quoi (RG-04), renvoi à une étape, correction, rejet, e-mails |
| `recette-m06.cjs` | Signature et vérification | 26 | RG-11, RG-12, **TF-07** (20 signatures simultanées), **TF-08** (rejeu), **TF-10** (PDF modifié), PDF/A |
| `recette-m02.cjs` | Délégations | 16 | délégation de signature, intérim d'un viseur, révocation, expiration |
| `recette-m15.cjs` | Administration | 37 | ENF-08 (circuit créé sans code), désactivation d'un circuit ou d'un type (actes en cours menés au bout), comptes, rôles, structures |

Variables : `EACT_API` (défaut `http://localhost:3000` : l’API directement, car nginx limite les connexions répétées), `EACT_MAILPIT` (défaut `http://localhost:8025/api/v1`).
Les scripts M02 et M06 lisent et écrivent directement en base par `docker compose exec postgres` (test de
concurrence, dates d'expiration).

**À lancer sur une base de développement, jamais pendant une démonstration** : les recettes créent des actes,
vident Mailpit, et la recette M01 change le mot de passe d'Abdou NJOYA et active la 2FA de l'administrateur.
Repartir de zéro ensuite : `docker compose down -v && docker compose up -d`.

Tests unitaires (Jest) : `npm test` — journal chaîné (empreinte indépendante de l'ordre des clés, TF-13) et
synchronisation des gabarits GitHub (panne, cache conservé, gabarits invalides).
