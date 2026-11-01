# ADR 0003 — Numérotation par séquenceur centralisé

**Contexte.** RG-08 / RG-09 : séquence annuelle par (type, structure), sans doublon ni trou,
même avec 2 instances API et des signatures simultanées (TF-07), même en cas de requête rejouée (TF-08).

**Décision.** Table `compteur_numerotation (type_acte_id, structure_id, annee)` ; dans la
transaction de signature : `SELECT … FOR UPDATE` sur la ligne, incrément, écriture de
`acte.reference` (contrainte UNIQUE), audit, commit. Idempotence par en-tête `Idempotency-Key`
mémorisé dans `cle_idempotence`. Les séquences PostgreSQL natives sont **rejetées** (elles créent des trous au rollback).

**Conséquences.**
+ Algorithme centralisé simple et déterministe (cours ch. 3).
− Goulot par couple (type, structure) : acceptable (quelques dizaines de signatures/jour).
− La génération du PDF/A se fait **après** le commit, en worker, pour garder la transaction courte.
