# Audit du travail reçu (frontend + backend) et reprise dans EACT

> Date : 2 novembre 2026 · Référentiels : cahier des charges `EACT-CDC-001` v1.1, maquettes `EACT_P0_Interfaces`
> (dont le *Guide d'implémentation*), socle du dépôt (ADR 0001 → 0008).
> Code audité : `frontend/` (Next.js) et `backend/` (NestJS) transmis hors dépôt.

## 1. Verdict

**Le code reçu n'est pas fusionné.** Il est utile comme maquette fonctionnelle et comme source d'idées,
mais il contourne l'architecture retenue (pas de base de données, pas de contrôle d'accès sur les routes
métier) et ne respecte ni la charte ni la structure du frontend. Les éléments justes ont été **réécrits
dans notre socle** (voir §5). Le reste sert de référence.

## 2. Ce qui a été fait, et où le travail s'arrête

| Domaine | Fait | S'arrête à |
|---|---|---|
| M01 Authentification | Connexion matricule/e-mail, verrouillage 5 échecs / 15 min, second facteur TOTP en deux temps, codes de secours | Réinitialisation annoncée mais **aucun e-mail ni jeton** ; pas de rafraîchissement, de révocation ni d'inactivité 30 min |
| M02 Organisation | Organigramme (7 structures), 8 comptes, délégations avec périmètre, expiration automatique | Pas de création ni modification de compte |
| M04 Rédaction | Brouillon depuis un modèle, modification, suppression, « pièces » | Pièces = **métadonnées seules** (aucun fichier, antivirus simulé) |
| M05 Circuit | Soumission au circuit (statut `EN_CIRCUIT`, étape 1) | **Arrêt ici** : ni parapheur, ni visa, ni correction, ni rejet |
| M06 Signature | — | Ni numérotation, ni PDF/A, ni QR, ni empreinte |
| M10 Audit | Journal chaîné SHA-256, vérification d'intégrité | Journal dans un fichier JSON modifiable |
| M13, M07, M08, M09, M11, M12 | — | Non commencés |
| M14 GitHub | Bouton « Signaler une anomalie » | Issue **simulée** : numéro inventé (`140 + n`) présenté comme « transmis à GitHub » |

Volume : backend 1 231 lignes (5 modules, 18 routes) ; frontend ~2 000 lignes (7 pages).

## 3. Écarts avec le cahier des charges

| Gravité | Constat | Exigence |
|---|---|---|
| **Critique** | Aucune base de données : tout est en mémoire et réécrit dans `data/db.json` à chaque action. Pas de transaction ni de verrou : la numérotation sans doublon ni trou est impossible. Le `schema.prisma` (SQLite) n'est pas utilisé. | §11 (référentiel PostgreSQL), §16.4, RG-08, TF-07 |
| **Critique** | Aucune garde d'authentification sur `/v1/actes`, `/v1/audit`, `/v1/delegations`, `/v1/utilisateurs`. L'identité est un paramètre `?userId=` choisi par le client : n'importe qui agit au nom de n'importe qui ; `GET /v1/actes` sans paramètre renvoie aussi les actes confidentiels. | BF-42, RG-15, tableau 24 |
| **Critique** | Secret JWT par défaut codé en dur (`minesup-eact-secret-key-2026`), jeton de 8 h stocké en `localStorage` (exposé au XSS). Pas de jeton de rafraîchissement, pas de révocation, pas de fermeture après 30 min. | BF-04, §20 (JWT court + cookie httpOnly), tableau 24 |
| Élevée | Mots de passe en bcrypt ; secrets TOTP et codes de secours **en clair** ; le même secret TOTP pour tous les comptes. | ENF-06 (Argon2id), BF-66 |
| Élevée | Journal d'audit modifiable (fichier JSON) ; l'empreinte ne couvre ni l'acteur ni la ressource ; consultation sans authentification. | BF-49, ADR 0004 |
| Élevée | Anomalie « transmise à GitHub » alors que rien n'est envoyé ; anonymisation partielle (noms non retirés). | BF-61, RG-22 |
| Moyenne | Rôles et statuts propres (`SIGNATAIRE`, `SG`, `ADMIN`, langue `BILINGUE`) différents de l'énumération du CDC et du schéma ; identifiants `acte-<horodatage>` au lieu d'UUID. | RG-01, §17 |
| Moyenne | Règles inventées : ampliation obligatoire à la soumission ; circuit de note de service en 4 étapes au lieu de 3. | RG-03, tableau 3 |
| Moyenne | NestJS 10 et `ts-node` ; aucune validation des entrées (DTO non validés) ; aucun test. | ENF-07, tableau 24 |

## 4. Écarts avec les maquettes et le guide d'implémentation

| Constat | Attendu |
|---|---|
| Next 14 + Tailwind 3, pas de shadcn/ui | Next 16 + Tailwind v4 + shadcn/ui (guide §3, socle) |
| Logique métier dans les pages, appels API depuis les composants | MVVM : `features/<écran>/{model, view-model, view}` (CDC §12.2) |
| Palette fausse : `primary-700 = #2D3CBF` (au lieu de `#2D3C8F`), nuances 200→500 différentes ; couleurs `slate`/`amber` codées en dur | Jetons du guide §1 |
| Navigation en barre horizontale | Barre latérale de 248 px + en-tête bleu (composants AppSidebar, AppHeader) |
| Connexion centrée avec mot de passe pré-rempli | B1 en deux panneaux ; aucun champ pré-rempli |
| Bouton FR/EN sans effet | Libellés externalisés FR/EN (ENF-12) |
| Routes `/login`, `/actes`, `/organigramme` | `/connexion`, `/mes-actes`, `/admin/structures` (guide §6) |
| URL d'API `http://localhost:3001` codée en dur | `/api` relayé (nginx en conteneurs, Next en mode léger) |

## 5. Ce qui a été repris, réécrit ou écarté

| Élément reçu | Décision | Où dans le dépôt |
|---|---|---|
| Logique de verrouillage (5 échecs, 15 min, essais restants) | **Repris, réécrit** sur PostgreSQL, avec réponse identique pour un compte inconnu | `apps/api/src/modules/m01-auth/auth.service.ts` |
| Second facteur en deux temps (jeton temporaire 5 min) | **Repris** ; jeton en cookie httpOnly, 3 essais (maquette B2) | idem |
| Codes de secours | **Repris** ; stockés hachés, usage unique, 8 codes (B3) | idem |
| Enrôlement TOTP | **Ajouté** (absent du code reçu) : QR + clé manuelle, obligatoire pour signataires, SG et administrateurs | idem + `features/auth` |
| Réinitialisation du mot de passe | **Réalisée pour de vrai** : lien à usage unique de 30 min envoyé par e-mail (Mailpit en dev), politique B5, révocation des sessions | idem |
| Comptes et organigramme de démonstration | **Repris** (noms fictifs), rôles remappés sur l'énumération du CDC, mots de passe Argon2id, secrets TOTP chiffrés | `apps/api/prisma/seed.ts` |
| Délégation Ministre → SG avec périmètre (NS, D, ATT) | **Repris** ; champ `perimetre` ajouté au schéma (CDC fig. 4) | `schema.prisma`, seed, bandeau « Mon travail » |
| Gabarits note de service et décision | **Repris** comme cache de gabarits (RG-23) | seed |
| Anonymisation par expressions régulières (RG-22) | **À reprendre** au module M14 (P1), complétée par le retrait des noms | — |
| Écrans délégations, organigramme, éditeur | **Référence UX** pour les écrans F1/F2, J1, C4, à refaire selon les maquettes | — |
| `db.json`, `DatabaseService`, routes sans garde, `localStorage`, issue simulée | **Écartés** | — |

## 6. État après reprise (vérifié le 2 novembre 2026)

- **M01 complet côté API** : `POST /v1/auth/login`, `/mfa/verify`, `/mfa/enrolement`, `/mfa/enrolement/confirmation`,
  `/refresh`, `/logout`, `/mot-de-passe/oubli`, `/mot-de-passe/reinitialisation`, `GET /v1/auth/moi`.
  Garde JWT globale : toute route est protégée sauf `@Public()` ; RBAC par `@Roles()`.
- **M10 exposé** : `GET /v1/audit`, `GET /v1/audit/verification` (auditeur, administrateur). Chaque événement
  d'authentification est journalisé par le bus d'événements.
- **Frontend** : connexion B1, second facteur B2, enrôlement B3 + codes de secours, verrouillage B4,
  mot de passe B5 (demande, lien envoyé, nouveau, lien expiré), coque (en-tête, barre latérale par rôle,
  tiroir mobile, avertissement d'inactivité), « Mon travail », journal d'audit avec vérification.
  Jetons de couleur alignés sur le guide ; FR/EN fonctionnel.
- **Recette automatisée** : 29 contrôles de bout en bout au vert (BF-01 → BF-05, BF-09, BF-48, BF-50, RBAC),
  rejoués à travers le proxy Next ; **TF-13** vérifié : le trigger refuse la modification d'une entrée, et une
  falsification forcée est détectée à l'entrée exacte.

### Mise à jour — M04 Rédaction (2 novembre 2026)

- **API** : types rédigeables selon le circuit de la structure (UC-06, précondition), gabarits servis depuis le
  cache (RG-23), création avec structure émettrice déduite de l'organigramme (une agente du SP émet pour la DAG),
  enregistrement automatique avec verrou optimiste (409), HTML nettoyé côté serveur, contrôle RG-03 paramétrable
  par type (objet, texte, ampliation), suppression limitée aux brouillons jamais soumis (RG-16), soumission
  transactionnelle (version figée, journal, étape de départ).
- **Pipeline tubes et filtres** (CDC §13.1) : type lu dans le contenu, antivirus, empreinte SHA-256 ; filtres
  PDF/A, OCR et indexation présents mais désactivés. Stockage disque (mode léger) ou S3, antivirus simulé ou ClamAV.
- **Web** : C1 « Mes actes », C2/C3 assistant avec aperçu, C4 éditeur riche (TipTap) en mode concentration,
  C5 pièces avec progression et états d'analyse, C6 champs manquants, C7 confirmation, C10 suppression.
- **Recette** : 32 contrôles M04 de bout en bout, rejoués via le proxy Next (pièce de 15 Mo acceptée, 21 Mo refusée).
- **Bug corrigé dans le socle** : l'empreinte du journal d'audit dépendait de l'ordre des clés de `details`,
  que PostgreSQL réordonne (jsonb) ; une entrée intègre pouvait être déclarée falsifiée. Sérialisation canonique
  et tests unitaires ajoutés. Les entrées écrites avant la correction restent fausses : remettre la base de dev à
  zéro (`npm run db:reset`).

## 7. Suite du P0 (ordre proposé)

1. ~~M04 Rédaction~~ : fait (voir ci-dessus). Restent BF-20 versions et comparaison (C8) et l'aperçu PDF.
2. **M05 Parapheur** (D1 → D8) : file par rôle et structure, viser / corriger / rejeter, verrou optimiste (409).
3. **M06 Signature** (E1 → E6) : TOTP de moins de 5 min (RG-12), séquenceur déjà écrit (`signature.service.ts`),
   idempotence, PDF/A par Gotenberg + QR + SHA-256.
4. **M13 Vérification publique** (V-01, V-02) : cible du QR.
5. **M02 Délégations** (F1, F2) et administration minimale (J1 → J5).
6. Mise en place de **shadcn/ui** (les primitives actuelles en reprennent déjà l'API) et tests unitaires Jest de M01.
