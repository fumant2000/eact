# Backlog priorisé EACT (P0 → P3)

> Cas d'étude : **MINESUP** (SG + DAG pilote). Le cahier des charges classe les modules en **Indispensable / Souhaitable / Plus tard**
> (MoSCoW). Ce document transforme ce classement en **ordre de livraison** :

| Priorité | Définition | Lien cahier des charges | Itération |
|---|---|---|---|
| **P0** | Chemin critique : sans lui, pas de démo bout-en-bout ni de recette | Indispensable, cœur | It. 0 (socle) + It. 1 + It. 2 |
| **P1** | Reste de l'Indispensable : requis pour le critère d'acceptation n°1 | Indispensable, complément | It. 3 |
| **P2** | Souhaitable : livré si le planning le permet | Souhaitable | It. 3 / fin |
| **P3** | Évolutions hors V1 | Plus tard (EV-01 à EV-07) | V2 |

**Fil rouge de la démo P0** : *rédiger une note de service → 2 visas → signer avec TOTP →
numéro `N° 26/0001/NS/MINESUP/SG/DAG` → PDF/A avec QR → scanner le QR → page publique
« Acte authentique » → journal d'audit intègre.*

---

## It. 0 — Socle technique (semaines 3-5, phase d'élaboration) — P0

| ID | Élément | Done quand… |
|---|---|---|
| S-01 | Monorepo, Docker Compose dev (`docker compose up`) | Tous les services `healthy` sur un poste vierge (ENF-15) |
| S-02 | CI GitHub Actions : lint, tests, build images | PR bloquée si rouge |
| S-03 | Schéma Prisma initial + seed (organigramme SG/DAG/SDACL/DAJ, types DEC/AM/D/CIR/NS/C/ATT, circuits) | `prisma migrate dev` + seed OK |
| S-04 | Charte graphique dans Tailwind + shell applicatif (menu, en-tête, i18n FR/EN) | Écran vide navigable FR/EN |
| S-05 | Bus d'événements interne + file BullMQ + worker | Événement `acte.soumis` consommé par le worker |
| S-06 | ADR 0001 → 0006 rédigées | Dans `docs/adr/` |

## P0 — Chemin critique (It. 1 et It. 2)

| Module | Exigences | Pourquoi P0 |
|---|---|---|
| M01 Auth | BF-01, BF-02 (TOTP), BF-03, BF-04 | La signature exige le TOTP (RG-12) |
| M02 Organisation | BF-06, BF-07, BF-08, BF-09, BF-10 | Le circuit et la délégation de signature (RG-11) en dépendent |
| M04 Rédaction | BF-15, BF-16, BF-17, BF-21, BF-22 | Point d'entrée de tout acte |
| M04 Pièces | BF-18 + RG-24 (ClamAV) | Pipeline tubes et filtres, cœur de l'architecture |
| M05 Parapheur | BF-22 → BF-26, BF-28 ; RG-04 → RG-07, RG-18, RG-19 | Cœur métier |
| M06 Signature | BF-29 → BF-33 ; RG-08 → RG-12 | **TF-07 / TF-08** = critère d'acceptation n°2 |
| M10 Audit | BF-48, BF-49, BF-50 | **TF-13** = critère d'acceptation n°2 ; branché dès le début sur le bus |
| M14 GitHub | BF-59 (gabarits + cache), RG-23 | Indispensable et utilisé dès UC-06 (rédaction) |
| M15 Admin | BF-64, BF-65 (via seed + écrans simples) | Types et circuits paramétrables (ENF-09) |
| M13 Vérif. publique | **BF-55, BF-56** *(promus de Souhaitable)* | Le QR code de BF-32 doit pointer vers une page qui existe ; c'est la démo anti-fraude |

## P1 — Complément Indispensable (It. 3)

| Module | Exigences |
|---|---|
| M01 | BF-05 réinitialisation mot de passe |
| M04 | BF-19 langue / traduction (RG-25), BF-20 versions et comparaison |
| M05 | BF-27 délais, alerte 75 %, relance (RG-20) |
| M08 Recherche | BF-40 → BF-43 (plein texte PostgreSQL, filtrage ABAC RG-15) |
| M09 Archivage | BF-44 → BF-47 (RG-14) |
| M14 GitHub | BF-60, BF-61 (anomalie anonymisée, RG-22), BF-62, BF-63 (webhooks HMAC) |
| M15 | BF-66 paramètres SMTP/SMS/GitHub chiffrés |
| Infra | Réplica PostgreSQL, 2 instances API, sauvegardes 3-2-1 (TF-15, TF-16) |

## P2 — Souhaitable

| Module | Exigences |
|---|---|
| M03 Courrier | BF-11 → BF-14 |
| M07 Diffusion et publication | BF-34 → BF-39 : notification, publication au Journal officiel, **transmission et suivi des projets de décret** (RG-13, états « Transmis » et « Exécutoire ») |
| M11 Tableau de bord | BF-51, BF-52 |
| M12 Notifications | BF-53 (WebSocket), BF-54 (e-mail, SMS) |
| M13 | BF-57 dépôt PDF pour comparer l'empreinte, BF-58 suivi usager |
| Transverse | Mode dégradé ENF-14, mode sombre, supervision Grafana complète |

## P3 — Hors V1 (évolutions)

EV-01 OCR · EV-02 mobile natif · EV-03 hors-ligne complet · EV-04 signature qualifiée (PKI) ·
EV-05 universités d'État et échanges avec d'autres administrations · EV-06 arrêtés conjoints (type AC,
circuit interministériel) · EV-07 SSO Keycloak.

---

## Projets de décret (spécifique MINESUP)

Le Ministre ne signe pas les décrets. Dans EACT, un projet de décret (type `DEC`) suit le circuit
interne de visas (P0, générique), puis passe à l'état **Transmis** vers la Présidence ou les services
du Premier Ministre, et le texte signé est enregistré avec sa référence externe (BF-37, BF-39 → **P2**).
Aucun numéro MINESUP n'est attribué à un décret.

## Correspondance avec le planning (CDC §25)

| Semaines | Phase UP | Contenu |
|---|---|---|
| 1-2 | Lancement | Validation CDC, entretien SDACL / DAG |
| 3-5 | Élaboration | **It. 0 socle** + dossier d'architecture + maquettes |
| 6-7 | Construction It. 1 | P0 : M01, M02, M04, M14 (gabarits), M15 seed |
| 8-9 | Construction It. 2 | P0 : M05, M06, M10, M13 (BF-55/56) → **démo bout-en-bout** |
| 10-11 | Construction It. 3 | P1 puis P2 selon avancement |
| 11-12 | Transition | Recette, TF-01 → TF-17, déploiement pilote |

> Écart assumé vs le CDC : l'itération 1 du CDC place aussi BF-59 + BF-64 en It. 1 (identique),
> mais nous **avançons BF-55/56 en It. 2** et **reculons BF-60 → BF-63 en It. 3**. À valider en équipe.
