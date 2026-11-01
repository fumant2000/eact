# ADR 0005 — Stockage objet derrière une interface S3

**Contexte.** PDF/A et pièces (~150 Go / 5 ans, ENF-02) ; hébergement sur l'infrastructure de la DSI
(CT-08) ; logiciels libres (CT-10). Le CDC retient MinIO.

**Constat (1er novembre 2026).** Les images officielles `minio/minio` et `minio/mc` ne sont plus
disponibles (Docker Hub et quay.io) : `docker compose up` échouait. Le risque noté dans la première
version de cette ADR s'est réalisé.

**Décision.** Le métier ne connaît que `IStockage` (put/get/URL signée), implémenté avec le SDK AWS S3.
Le serveur V1 est **RustFS** (`rustfs/rustfs:1.0.4`, Apache-2.0), compatible avec l'API S3 de MinIO
(mêmes ports 9000 / console 9001, clés d'accès par variables d'environnement). Les buckets sont créés
par `s3-init` avec `aws-cli` : aucun outil propre à un fournisseur. Service nommé `s3`, variables
`S3_ROOT_USER` / `S3_ROOT_PASSWORD`. Vérifié en local : authentification (clé invalide rejetée),
création de bucket, versioning activé sur `actes`.

**Alternatives écartées.** SeaweedFS (mature, Apache-2.0, mais identités S3 par fichier de
configuration) ; Garage (AGPL, clés générées par CLI, plus d'étapes d'exploitation).

**Conséquences.**
+ Remplaçable par tout serveur S3 sans toucher au métier ni au script d'initialisation.
! RustFS est récent : à réévaluer avant la production (chiffrement au repos SSE, réplication,
  sauvegarde) ; SeaweedFS reste le plan B.
- Écart au CDC (§20, tableau 28) à signaler dans le dossier d'architecture.
