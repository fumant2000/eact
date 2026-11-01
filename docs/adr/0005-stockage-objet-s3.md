# ADR 0005 — Stockage objet derrière une interface S3

**Contexte.** PDF/A et pièces (~150 Go / 5 ans, ENF-02) ; hébergement sur site (CT-08) ;
logiciels libres (CT-10). Le CDC retient MinIO.

**Décision.** Le métier ne connaît que `IStockage` (put/get/URL signée). L'adaptateur V1 parle
le protocole S3 et cible **MinIO**. Fichiers confidentiels chiffrés au repos (SSE).

**Conséquences.**
+ Remplacement possible par un autre serveur S3 libre (Garage, SeaweedFS…) sans toucher au métier.
! Point à vérifier : la distribution communautaire de MinIO (images Docker, console) a beaucoup
  évolué en 2025 ; vérifier la licence et la disponibilité des images avant la mise en production
  et figer le tag d'image.
