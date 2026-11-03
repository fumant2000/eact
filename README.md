# EACT — Gestion électronique des actes administratifs

Rédaction, circuit de visas (parapheur), signature électronique et vérification publique des actes administratifs
du **Ministère de l'Enseignement Supérieur (MINESUP)** — pilote : Secrétariat Général et Direction des Affaires
Générales. ENSPD, UE Architecture logicielle & Objets répartis. Cahier des charges `EACT-CDC-001` v1.1.

---

## 1. Prérequis

| Outil | Pour quoi |
|---|---|
| **Docker Desktop** (ou Docker Engine + Compose v2), démarré, 4 Go de RAM libres | Lancer l'application complète |
| **Git** | Récupérer le projet |
| **Node.js 22+** (facultatif) | Tests et développement avec rechargement à chaud |

Ports utilisés sur le poste : `8080` (application), `3000` (API), `8025` et `1025` (Mailpit), `5433` (PostgreSQL),
`6380` (Redis), `3002` (Gotenberg), `9000` et `9001` (stockage S3). Un port déjà pris se change dans `.env` (§6).

## 2. Installation et lancement

```bash
git clone https://github.com/fumant2000/eact.git
cd eact
cp .env.example .env
docker compose up -d
```

La commande construit les images (5 à 10 minutes la première fois, quelques secondes ensuite), applique les
migrations, charge les données de démonstration (organigramme, types d'actes, circuits, modèles, comptes) et
démarre tous les services.

| Adresse | Service |
|---|---|
| http://localhost:8080 | **Application** |
| http://localhost:8025 | Mailpit : reçoit tous les e-mails envoyés par l'application (aucun ne sort) |
| http://localhost:3000/docs | API REST (Swagger) |

| Action | Commande |
|---|---|
| Arrêter (données conservées) | `docker compose down` |
| Arrêter et effacer la base | `docker compose down -v` |
| Prendre en compte une modification du code | `docker compose up -d` |
| Suivre les journaux | `docker compose logs -f api web` |

## 3. Comptes de démonstration

Mot de passe commun : **`Minesup@2026`**. Avec `DEMO_MODE=true` (valeur de `.env.example`, ignorée en production),
le panneau « Mode démonstration » de la page de connexion permet d'entrer dans un compte en un clic, et le code
de vérification en deux étapes s'affiche à l'écran : aucun téléphone n'est nécessaire.

| Matricule | Personne (fictive) | Rôle | Vérification en deux étapes |
|---|---|---|---|
| MINESUP-04812 | Christelle EBOGO | Rédactrice · Service du Personnel | — |
| MINESUP-02845 | Marie BELINGA | Chef de service (viseuse) | — |
| MINESUP-03107 | Abdou NJOYA | Directeur des Affaires Générales (viseur) | — |
| MINESUP-00017 | Ibrahim BELLO | Secrétaire Général, signataire par délégation | oui |
| MINESUP-00001 | Roger ESSOMBA | Ministre (autorité signataire) | oui |
| MINESUP-02019 | Hervé TCHAMBA | Administrateur | enrôlement à la 1re connexion |
| MINESUP-07341 | Aïcha MOUSSA | Auditrice | — |
| MINESUP-05520 / 06233 | Solange MBARGA / Daniel FOTSO | Juriste / Traducteur | — |

Pour utiliser un vrai téléphone avec les comptes Ministre et SG : dans Google Authenticator, Microsoft
Authenticator ou FreeOTP, « Saisir une clé de configuration » → `JBSWY3DPEHPK3PXP`, type « basé sur l'heure ».

## 4. Utilisation : parcours complet

1. **Connexion** — en rédactrice : « Mon travail » n'affiche que les entrées de son rôle. Cinq mauvais mots de
   passe verrouillent un compte 15 minutes ; « Mot de passe oublié ? » envoie un lien à usage unique visible dans Mailpit.
2. **Rédaction** — « Nouvel acte » → Note de service → modèle « standard DAG » : en-tête officiel et ampliations
   pré-remplis, enregistrement automatique. « Soumettre » sans objet affiche les champs manquants.
3. **Pièces jointes** — un PDF passe « Analyse en cours » puis « Disponible » ; un `.exe` renommé en `.pdf` est
   refusé (le type est lu dans le contenu, pas dans le nom).
4. **Soumission** — l'acte passe « En circuit » ; il n'est plus modifiable. Mailpit montre l'e-mail
   « Un acte attend votre visa ».
5. **Visas** — Marie BELINGA vise depuis son parapheur ; Abdou NJOYA peut viser, demander une correction (retour à
   une étape) ou rejeter avec motif ; puis visa du Secrétaire Général. La fiche de l'acte montre la frise des visas.
6. **Signature** — Ibrahim BELLO → « À signer » → « Signer » → code de vérification → référence
   `N° 26/0001/NS/MINESUP/SG/DAG` attribuée, puis PDF/A avec cachet, QR code et code court.
7. **Vérification publique** — scanner le QR (ou http://localhost:8080/verifier) : page « Acte authentique »,
   sans compte. Un PDF déposé est déclaré « identique » ou « modifié ».
8. **Journal d'audit** — Aïcha MOUSSA → Journal d'audit → « Vérifier l'intégrité » : chaque action est tracée dans
   un journal chaîné qu'on ne peut ni modifier ni effacer.
9. **Paramétrage sans code** — Hervé TCHAMBA → Administration → Types et circuits : « Créer un circuit » pour
   l'arrêté ministériel (AM) le rend aussitôt rédigeable ; « Désactiver » un circuit ou un type le retire des
   nouveaux actes, les actes déjà en circuit vont au bout.
10. **Délégation** — Roger ESSOMBA → Délégations → « Déclarer une délégation » (délégataire, période, types
    d'actes) : les actes concernés arrivent dans « À signer » du délégataire.

**QR scanné par un téléphone** : le QR contient `PUBLIC_BASE_URL` (par défaut `localhost`, injoignable depuis un
téléphone). Mettre l'adresse IP du poste sur le réseau local, par exemple `PUBLIC_BASE_URL=http://192.168.1.20:8080`
dans `.env`, puis `docker compose up -d` : les actes signés ensuite portent cette adresse.

## 5. Ce qui a été réalisé (P0)

Fil rouge réalisé de bout en bout : rédiger une note de service → visas → signature avec code de vérification →
numéro officiel → PDF/A avec QR → vérification publique → journal d'audit intègre.

| Module | Réalisé | Exigences |
|---|---|---|
| M01 Authentification | Connexion par matricule ou e-mail, verrouillage après 5 échecs, vérification en deux étapes (TOTP) avec enrôlement par QR et codes de secours, sessions courtes renouvelées (cookies httpOnly, fermeture après 30 min d'inactivité), mot de passe oublié par lien à usage unique | BF-01 à BF-05 |
| M02 Organisation | Organigramme, comptes et rôles, délégations de signature et intérims (périmètre, période, révocation) | BF-06 à BF-10 |
| M04 Rédaction | Assistant type → modèle → éditeur, enregistrement automatique avec détection des conflits, champs obligatoires, pièces jointes analysées (type réel, antivirus, empreinte SHA-256), aperçu A4, soumission | BF-15 à BF-18, BF-21, BF-22 |
| M05 Parapheur | Viseurs déterminés par l'organigramme, visa, correction avec retour à une étape, rejet motivé, frise de suivi | BF-22 à BF-26, BF-28 |
| M06 Signature | Signature avec code TOTP, numérotation unique et sans trou même en accès concurrent, horodatage serveur, PDF/A avec QR et code court, requête rejouée sans second numéro | BF-29 à BF-33 |
| M10 Audit | Journal chaîné SHA-256 en ajout seul, vérification d'intégrité | BF-48 à BF-50 |
| M12 Notifications | E-mails : acte à viser, prêt à signer, à corriger, rejeté, signé | BF-54 |
| M13 Vérification publique | Page « Acte authentique » par QR ou code, comparaison d'un PDF déposé | BF-55 à BF-57 |
| M14 Modèles d'actes | Modèles versionnés dans Git (`gabarits/`), copiés en base, synchronisables depuis GitHub, rédaction maintenue si GitHub est indisponible | BF-59, RG-23 |
| M15 Administration | Types d'actes, circuits et étapes paramétrables sans code, activation et désactivation | BF-64, BF-65 |

Hors P0, affichés « bientôt » dans le menu : courrier (M03), diffusion et publication (M07, dont la transmission
des projets de décret), recherche (M08), archivage (M09), tableau de bord (M11).

## 6. Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `HTTP_PORT`, `PUBLIC_BASE_URL` | Port de l'application et adresse imprimée dans les QR codes |
| `API_HOST_PORT`, `MAILPIT_HOST_PORT`, `PG_HOST_PORT`, `REDIS_HOST_PORT`, `GOTENBERG_HOST_PORT`, `S3_HOST_PORT`, `S3_CONSOLE_HOST_PORT` | Ports publiés sur le poste |
| `DEMO_MODE` | Connexion en un clic et code affiché (`true` en démonstration ; sans effet en production) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SECRETS_ENCRYPTION_KEY` | Secrets ; à générer avec `openssl rand -base64 48` hors démonstration |

## 7. Développement avec rechargement à chaud

L'API et le web tournent sur le poste, PostgreSQL, Redis, Mailpit et Gotenberg dans Docker. Arrêter d'abord
l'application complète (`docker compose down`), qui utilise les mêmes ports.

```bash
npm install
npm run infra          # postgres, redis, mailpit
npm run infra:pdf      # gotenberg (PDF/A des actes signés)
npm run db:migrate     # migrations
npm run db:seed        # données de démonstration
npm run dev:api        # terminal 1 → http://localhost:3000/docs
npm run dev:web        # terminal 2 → http://localhost:3001
```

Base remise à zéro : `npm run db:reset` (efface toutes les données locales).

**Ajouter un modèle d'acte** : créer un fichier `gabarits/fr/<nom>.html` de cette forme, puis `docker compose up -d`.

```html
<!--
type: AM
libelle: Arrêté ministériel · nomination
version: 1.0
description: Visas, considérants, articles.
ampliations: SG | DAJ | Intéressé
-->
<p><strong>Article 1er.</strong> …</p>
```

Seul le corps de l'acte est dans le fichier (balises `p`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `h2`, `h3`) :
l'en-tête officiel, le titre et le bloc de signature sont produits par l'application. Le type doit aussi avoir un
circuit (Administration → Types et circuits).

## 8. Tests

```bash
npm install
npm run lint && npm test && npm run build       # vérifications statiques, tests unitaires, compilation
node tests/recette/lancer.cjs                   # recettes de bout en bout (application lancée)
```

Les recettes jouent les parcours réels contre l'API : **176 contrôles** sur l'authentification, la rédaction,
le parapheur, la signature (dont 20 signatures simultanées sans doublon de numéro), la vérification publique,
les délégations et l'administration. Elles modifient la base et vident Mailpit : à lancer sur une base de
développement, puis `docker compose down -v && docker compose up -d` pour repartir de zéro.
`node tests/recette/lancer.cjs m05 m06` n'en lance qu'une partie.

## 9. Organisation du code

```
apps/api          API NestJS : modules m01-auth … m15-admin, pipeline des pièces, Prisma (schéma, migrations, données)
apps/web          Interface Next.js : app/ (pages), features/<écran>/{model, view-model, view}
packages/shared   Règles partagées : statuts et transitions d'un acte, format des références, événements
gabarits/         Modèles d'actes (HTML)
infra/            nginx, PostgreSQL, sauvegardes, supervision
tests/recette/    Recettes de bout en bout
```
