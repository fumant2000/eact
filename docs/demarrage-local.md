# Démarrage local et démonstration

Deux façons de lancer EACT :

| Mode | Pour quoi | Ce qui tourne | RAM approx. |
|---|---|---|---|
| **Léger** (par défaut) | Développement quotidien, démonstrations en séance | Docker : PostgreSQL, Redis, Mailpit · Poste : API et web (rechargement à chaud) | ~1 Go |
| Complet | Montrer l'architecture cible (CDC §15), tester les images | Tous les conteneurs derrière nginx | 3 à 4 Go |

## 1. Mode léger

Prérequis : Node 22, Docker Desktop démarré.

```bash
cp .env.example .env        # la première fois ; changer les secrets si besoin
npm install
npm run infra               # postgres + redis + mailpit (Docker)
npm run infra:pdf           # gotenberg : PDF/A des actes signés (~1 Go de RAM, à lancer pour la signature)
npm run db:migrate          # applique les migrations Prisma
npm run db:seed             # organigramme, types d'actes, circuit NS, gabarits, comptes de démo
npm run dev:api             # terminal 1 → http://localhost:3000/docs (Swagger)
npm run dev:web             # terminal 2 → http://localhost:3001
```

| URL | Service |
|---|---|
| http://localhost:3001 | Application (le web relaie `/api` vers l'API, comme nginx en production) |
| http://localhost:3000/docs | Swagger de l'API |
| http://localhost:8025 | Mailpit : tous les e-mails envoyés par EACT arrivent ici, aucun ne sort |

Repartir d'une base propre : `npm run db:reset` (**efface toutes les données** de la base locale, puis rejoue
migrations et seed). Arrêter les conteneurs : `npm run infra:down`.

## 2. Services : lesquels sont lancés, et à quoi servent les autres

| Service | Mode léger | Rôle dans EACT | Quand l'allumer |
|---|---|---|---|
| PostgreSQL | ✅ | Référentiel unique : actes, séquenceur de numérotation (`FOR UPDATE`), journal d'audit en ajout seul | Toujours |
| Redis | ✅ | Files BullMQ (PDF/A, e-mails, relances, GitHub) et cache | Toujours (léger) |
| Mailpit | ✅ | Faux serveur SMTP : réinitialisation du mot de passe, notifications | Toujours en dev ; **démontrable en direct** |
| API NestJS | ✅ (poste) | Logique métier, 15 modules | Toujours |
| Web Next.js | ✅ (poste) | Interface MVVM | Toujours |
| Gotenberg | ✅ `npm run infra:pdf` | Conversion en PDF/A de l'acte signé (BF-32) | Pour toute démo de signature ; sans lui l'acte est signé et numéroté, le PDF est produit dès qu'il revient |
| Worker | ⏸ | Traitements asynchrones (PDF/A, antivirus, e-mails, GitHub) | Avec M06 et M12 |
| RustFS (S3) | ⏸ | Stockage objet des PDF/A et des pièces | Remplacé en mode léger par le disque local (`STOCKAGE=local`, dossier `apps/api/.stockage`) |
| ClamAV | ⏸ | Antivirus des pièces jointes (RG-24) ; ~1 Go de RAM et mises à jour Internet | Simulé en mode léger (`ANTIVIRUS=simule` : refuse le fichier de test EICAR) ; ClamAV réel en mode complet |
| nginx | ⏸ | Point d'entrée unique, TLS, limitation de débit (CT-12) | Mode complet |
| Prometheus, Grafana, Loki, Alloy | ⏸ | Supervision (ENF-03) | `docker compose --profile obs up -d`, pour la soutenance |

## 3. Comptes de démonstration

Mot de passe commun : `Minesup@2026` (variable `DEMO_MOT_DE_PASSE`). Ces comptes ne sont jamais créés en production.

**Mode démonstration** (`DEMO_MODE=true` dans `.env`, ignoré si `NODE_ENV=production`) : sur la page de connexion,
le panneau « Mode démonstration » permet d'**entrer en un clic** dans n'importe quel compte (le verrouillage éventuel
est levé), ou de **pré-remplir** le formulaire pour montrer le parcours normal. Sur les écrans de second facteur,
d'enrôlement et de signature, le **code de vérification courant s'affiche** avec un bouton « Utiliser » :
aucun téléphone n'est nécessaire.

| Matricule | Personne (fictive) | Rôles | Second facteur |
|---|---|---|---|
| MINESUP-04812 | Christelle EBOGO | Rédactrice · Service du Personnel | — |
| MINESUP-02845 | Marie BELINGA | Chef de service (viseuse) · SP | — |
| MINESUP-03107 | Abdou NJOYA | Directeur (viseur) · DAG | — |
| MINESUP-00017 | Ibrahim BELLO | Secrétaire Général, signataire par délégation | TOTP actif |
| MINESUP-00001 | Roger ESSOMBA | Ministre (autorité signataire) | TOTP actif |
| MINESUP-02019 | Hervé TCHAMBA | Administrateur · DSI | **Enrôlement à la 1re connexion** |
| MINESUP-07341 | Aïcha MOUSSA | Auditrice · IGS | — |
| MINESUP-05520 / 06233 | Solange MBARGA / Daniel FOTSO | Juriste / Traducteur | — |

**TOTP des comptes Ministre et SG** : dans Google Authenticator, Microsoft Authenticator ou FreeOTP,
« Saisir une clé de configuration » → clé `JBSWY3DPEHPK3PXP`, type « basé sur l'heure ».

## 4. Scénario de démonstration (état actuel : M01, M04, M05, M06, M10, M13)

1. **Connexion et rôles** : se connecter en rédactrice → « Mon travail » n'affiche que ses entrées de menu.
2. **Verrouillage (BF-03)** : 5 mauvais mots de passe sur Daniel FOTSO → message « il vous reste n essais »,
   puis écran de verrouillage avec compte à rebours de 15 min.
3. **Second facteur (BF-02)** : se connecter en SG → saisir le code du téléphone → bandeau de délégation
   « Pour le Ministre et par délégation… (NS, D, ATT) ».
4. **Enrôlement en direct (B3)** : se connecter en administrateur → scanner le QR avec un téléphone de la salle
   → confirmer → 8 codes de secours à télécharger.
5. **Mot de passe oublié (BF-05)** : « Mot de passe oublié ? » → ouvrir Mailpit (http://localhost:8025)
   devant la salle → cliquer le lien → politique de mot de passe vérifiée en direct → le lien ne fonctionne qu'une fois.
6. **Rédaction (UC-06)** : en rédactrice, « Nouvel acte » → Note de service → modèle « standard DAG » →
   l'en-tête officiel SG / DAG et l'ampliation sont pré-remplis ; saisir l'objet et le texte (« + Article »),
   l'indicateur « Enregistré à … » suit chaque frappe. Cliquer « Soumettre » sans objet : la liste des
   champs manquants s'affiche (RG-03).
7. **Pièces jointes et pipeline (BF-18, RG-24)** : déposer un PDF → « Analyse antivirus en cours » puis
   « Disponible ». Déposer un `.exe` renommé en `.pdf` → refusé par le filtre 1 (le type est lu dans le
   contenu, pas dans le nom). Le fichier de test EICAR est bloqué par l'antivirus simulé, mais Windows Defender
   le supprime souvent avant même l'envoi : c'est en soi une bonne illustration.
8. **Soumission (BF-22)** : confirmer → l'acte passe « En circuit », à l'étape « Visa du chef de service » ;
   il n'est plus modifiable et ne peut plus être supprimé (RG-16).
9. **Traçabilité (BF-48 → BF-50)** : se connecter en auditrice → Journal d'audit → « Vérifier l'intégrité ».
   Pour montrer TF-13, modifier une ligne en base (le trigger refuse ; en le désactivant, la vérification
   signale la rupture à l'entrée exacte).

10. **Circuit de visas (M05)** : la rédactrice soumet → Mailpit montre « Un acte attend votre visa » envoyé à
    Marie BELINGA (cheffe de service) → elle vise en 3 clics depuis son parapheur (5 s pour annuler) → Abdou NJOYA
    (directeur) demande une correction en renvoyant au chef de service → nouveau visa → visa du SG.
    La fiche de l'acte montre la frise : qui a visé, quand, avec quelle observation.
11. **Signature (M06)** : entrer comme Ibrahim BELLO (SG, signataire par délégation pour NS, D, ATT) → « À signer »
    → « Examiner » → bouton or « Signer » → code (affiché en mode démo) → référence `N° 26/0001/NS/MINESUP/SG/DAG`
    attribuée en direct, puis le PDF/A apparaît (quelques secondes). Télécharger le PDF : en-tête bilingue,
    cachet « Signé électroniquement », QR et code court.
12. **Vérification publique (M13)** : scanner le QR avec un téléphone → page « Acte authentique », sans compte.
    Déposer le PDF reçu : « identique ». Modifier le PDF (même un caractère) et le redéposer : « modifié ».

### Faire scanner le QR par un téléphone de la salle

Le QR contient `WEB_URL`. Par défaut `http://localhost:3001`, injoignable depuis un téléphone. Avant la démo :
1. relever l'adresse du PC sur le réseau de la salle (`ipconfig` → « Adresse IPv4 », ex. `192.168.1.20`) ;
2. dans `.env`, mettre `WEB_URL=http://192.168.1.20:3001`, puis relancer `npm run dev:api` ;
3. autoriser Node.js dans le pare-feu Windows (réseau privé) à la première demande ;
4. les actes signés **après** ce changement portent la bonne adresse (le QR est imprimé dans le PDF).

## 5. Mode complet

```bash
docker compose --profile dev up -d --build    # http://localhost:8080 (nginx)
```

Dans les conteneurs, les adresses des services (postgres, mailpit, gotenberg…) sont fixées dans
`docker-compose.yml` ; le `.env` ne décrit que le poste du développeur.
