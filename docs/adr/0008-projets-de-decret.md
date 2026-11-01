# ADR 0008 — Projets de décret : transmis, pas signés

**Contexte.** Au MINESUP, le Ministre ne signe pas les décrets (Président de la République ou
Premier Ministre). Le ministère en prépare les projets, les fait viser en interne puis les transmet
(CDC §1.3, BF-37, BF-39). Le diagramme d'états générique ne prévoit pas ce cas.

**Décision.** Type `DEC` avec `signeHorsMinistere = true`. Après le dernier visa (dont celui du
Ministre), l'action `transmettre` fait passer l'acte de « Prêt à signer » à **« Transmis »**
(table `transmission_externe`, motif `SIGNATURE_DECRET`). À réception du texte signé,
`enregistrerTexteSigne` le passe à « Signé » avec sa `reference_externe` ; aucun numéro MINESUP
n'est attribué. Il devient « Exécutoire » à sa publication au Journal officiel (RG-13).
Le service de signature refuse un `DEC`.

**Conséquences.**
+ Même circuit de visas que les autres actes (P0), suivi de transmission en P2 avec M07.
! À confronter à la figure 7 du CDC MINESUP et à l'entretien SDACL / DAG.
