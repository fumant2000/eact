# Brief Claude Design — interfaces P0 d'EACT

> Usage : copier tout le bloc **« Prompt »** ci-dessous dans Claude Design.
> Sources : [backlog P0](../backlog-priorites.md), [charte graphique](../design-system.md),
> [cycle de vie](../architecture.md#4-vue-comportementale--cycle-de-vie-dun-acte), CDC MINESUP v1.1.

## Inventaire des écrans P0 (36 écrans + 1 gabarit de document)

| ID | Écran | Module | Exigences | Rôles |
|---|---|---|---|---|
| **Authentification** |||||
| A-01 | Connexion (matricule ou e-mail + mot de passe) | M01 | BF-01 | Tous |
| A-02 | Saisie du code TOTP (second facteur) | M01 | BF-02 | Signataire, SG, admin |
| A-03 | Activation du TOTP (QR à scanner, codes de secours) | M01 | BF-02 | Signataire, SG, admin |
| A-04 | Compte verrouillé (15 min après 5 échecs) | M01 | BF-03 | Tous |
| A-05 | Avertissement d'inactivité puis session expirée | M01 | BF-04 | Tous |
| **Coquille applicative** |||||
| S-01 | Layout : en-tête, menu latéral selon le rôle, FR/EN, menu profil, mobile (tiroir + barre basse) | — | ENF-12/13 | Tous |
| S-02 | Accueil « Mon travail » : compteurs (à viser, à signer, à corriger, brouillons) + raccourcis | — | BF-23 | Tous |
| S-03 | Pages système : 403, 404, erreur serveur, hors ligne | — | — | Tous |
| **Rédaction (M04)** |||||
| R-01 | « Mes actes » : liste filtrable par statut, type, date | M04 | BF-15, BF-28 | Rédacteur |
| R-02 | Nouvel acte · étape 1 : choix du type (DEC, AM, D, CIR, NS, C, ATT) | M04 | BF-15 | Rédacteur |
| R-03 | Nouvel acte · étape 2 : choix du modèle (version, commit, badge « servi depuis le cache ») | M04/M14 | BF-15, BF-59, RG-23 | Rédacteur |
| R-04 | Éditeur d'acte : en-tête pré-rempli, objet, texte riche, visas, ampliation, langue, traduction requise, portée, confidentialité, enregistrement auto | M04 | BF-16, BF-17, BF-19, BF-21 | Rédacteur |
| R-05 | Pièces jointes : dépôt, progression, analyse antivirus (en cours / saine / infectée / refusée) | M04 | BF-18, RG-24 | Rédacteur |
| R-06 | Aperçu A4 de l'acte (rendu avant soumission) | M04 | BF-16 | Rédacteur |
| R-07 | Soumission : contrôle des champs obligatoires, erreurs, confirmation | M04/M05 | BF-22, RG-03 | Rédacteur |
| **Parapheur (M05)** |||||
| P-01 | Parapheur : actes en attente triés par échéance, retard, filtres, action « Viser » sur la ligne | M05 | BF-23 | Viseur, juriste, traducteur, SG |
| P-02 | Détail d'un acte : document, pièces, métadonnées, actions | M05 | BF-28 | Membres du circuit |
| P-03 | Suivi du circuit : position courante + historique des visas (frise) | M05 | BF-28, RG-07 | Membres du circuit, rédacteur |
| P-04 | Viser (observation facultative) | M05 | BF-24 | Viseur |
| P-05 | Demander une correction (étape de retour + motif obligatoire) | M05 | BF-25, RG-06 | Viseur |
| P-06 | Rejeter (motif obligatoire, confirmation) | M05 | BF-26, RG-05 | Viseur |
| P-07 | Conflit de version (acte modifié entre-temps → recharger) | M05 | §14.2 | Viseur |
| **Signature (M06)** |||||
| G-01 | « À signer » : actes prêts à signer | M06 | BF-29 | Ministre, délégataire |
| G-02 | Signature : aperçu final, mention de délégation, bouton « Signer » | M06 | BF-29, RG-11 | Ministre, délégataire |
| G-03 | Fenêtre TOTP de signature + traitement (numérotation, génération du PDF/A) | M06 | RG-12, BF-30 | Ministre, délégataire |
| G-04 | Acte signé : référence, horodatage, QR, empreinte SHA-256, téléchargement PDF/A | M06 | BF-30 → BF-33 | Ministre, délégataire, rédacteur |
| **Organisation (M02) et administration (M15)** |||||
| O-01 | Organigramme (arbre SG → directions → services) | M02 | BF-06 | Admin |
| O-02 | Utilisateurs : liste, recherche, statut actif / désactivé | M02 | BF-07 | Admin |
| O-03 | Fiche utilisateur : création / édition, rôles, structure, TOTP | M02 | BF-07, BF-08 | Admin |
| O-04 | Délégations : liste (actives, à venir, expirées) + déclaration (période, délégataire, mention) | M02 | BF-09, BF-10 | Ministre, SG, admin |
| C-01 | Types d'actes : liste + édition (code, mode de publicité, conservation, champs obligatoires) | M15 | BF-64 | Admin |
| C-02 | Circuits : éditeur d'étapes ordonnées (rôle requis, délai) par type × structure | M15 | BF-65 | Admin |
| **Audit (M10)** |||||
| U-01 | Journal d'audit : liste filtrable (acteur, action, ressource, période) | M10 | BF-48 | Auditeur |
| U-02 | Vérification d'intégrité : chaîne intègre / rupture détectée à l'entrée n | M10 | BF-49, BF-50 | Auditeur |
| **Vérification publique (M13)** — sans connexion, mobile d'abord |||||
| V-01 | Saisie de la référence + code court | M13 | BF-55 | Public |
| V-02 | Résultat : authentique / retiré / introuvable — jamais le contenu d'un acte non public | M13 | BF-56, RG-21 | Public |
| **Document** |||||
| D-01 | Gabarit PDF/A d'un acte signé (en-tête officiel, référence, corps, mention de signature, QR, empreinte) | M06 | BF-32, annexe A | — |

Hors P0 (ne pas maquetter) : mot de passe oublié (BF-05), recherche (M08), archives (M09), courrier (M03),
diffusion et transmission des décrets (M07), tableau de bord (M11), notifications (M12), dépôt d'un PDF
pour comparaison (BF-57). Prévoir seulement leurs entrées de menu, grisées « bientôt ».

---

## Prompt

```text
Tu es le designer produit d'EACT, une application web de gestion électronique des actes administratifs
pour le Ministère de l'Enseignement Supérieur du Cameroun (MINESUP). Tu conçois TOUT le design de la
première version (périmètre « P0 ») : le système de design, chaque écran listé plus bas avec tous ses
états, en desktop, tablette et mobile, et un prototype cliquable des parcours. Ton livrable sera
implémenté tel quel par l'équipe : sois précis, cohérent et réaliste.

## 1. Contexte

- Utilisateurs : agents du ministère (Secrétariat Général et Direction des Affaires Générales en pilote),
  souvent peu familiers du numérique ; le Ministre et ses délégataires pour la signature ; un
  administrateur informatique ; un auditeur de l'Inspection Générale ; et le public (usagers,
  étudiants) pour vérifier l'authenticité d'un acte via un QR code.
- Ce que fait l'application : un acte (note de service, décision, arrêté…) est rédigé à partir d'un
  modèle, circule dans un parapheur électronique où chaque responsable le vise, est signé par le
  Ministre avec un code à usage unique (TOTP), reçoit un numéro officiel unique, devient un PDF/A
  portant un QR code de vérification, et chaque action est tracée dans un journal d'audit infalsifiable.
- Ton : institutionnel, sobre, digne de confiance — mais MODERNE. Pense « service public numérique
  de qualité » (clarté, espace, hiérarchie forte), pas « intranet des années 2000 » ni « startup ».
- Bilingue français / anglais (langues officielles d'égale valeur). Le français est la langue par
  défaut ; tous les libellés doivent tenir dans les deux langues (prévoir +30 % de longueur).
- Logo : pour l'instant, le mot-symbole « EACT » (à toi de le composer proprement). Sous-titre :
  « Ministère de l'Enseignement Supérieur ».

## 2. Contraintes non négociables

- Accessibilité WCAG 2.1 AA : contraste ≥ 4,5:1 pour le texte, focus clavier visible, cibles tactiles
  ≥ 44 px, libellés explicites. Un statut n'est JAMAIS indiqué par la couleur seule : couleur + icône
  + libellé.
- Ergonomie : viser un acte en 3 clics maximum depuis le parapheur ; une seule action principale
  visible par ligne ou par écran ; prise en main en 2 h de formation.
- Responsive dès 360 px de large. Maquette chaque écran en 1440 px, 768 px et 375 px.
- Implémentation cible : React (Next.js) + Tailwind CSS v4 + composants shadcn/ui + icônes lucide.
  Ne dessine que ce qui est réalisable avec ces briques ; nomme les composants shadcn utilisés.
- Polices libres uniquement : Inter (interface), Source Serif 4 (documents officiels),
  JetBrains Mono (références et codes).

## 3. Palette IMPOSÉE (déjà validée, contrastes vérifiés)

Respecte ces couleurs et ces noms de jetons. Tu peux ajouter des nuances intermédiaires si elles
restent conformes AA ; justifie-les.

Primaire « Bleu institutionnel » (marque = 700) :
50 #EEF1FA · 100 #D9DFF3 · 200 #B6C1E8 · 300 #8C9BD8 · 400 #6274C4 · 500 #4357AE ·
600 #354799 · 700 #2D3C8F · 800 #24306F · 900 #1C2553 · 950 #121836
Accent « Or sceau » : seal-400 #D9A441 (fond, texte foncé dessus), seal-700 #8A6116 (texte sur blanc).
RÈGLE : l'or est réservé à ce qui a une valeur officielle (bouton « Signer », acte signé, cachet,
QR de vérification). Jamais décoratif. « Signer » est le SEUL bouton or de l'application.
Sémantique (clair / sombre) : succès #0F7A55 / #4CC38A · alerte #B45309 / #F0A84A ·
danger #C0262D / #F2777C · violet #6D3FC0 / #B79CF0.
Neutres (clair / sombre) : background #F7F8FB / #0F1424 · surface #FFFFFF / #171D33 ·
border #E3E6EE / #2A3250 · foreground #1A2033 / #E6E9F2 · muted #5B6478 / #9AA3B8.
Rayons : 8 px (cartes), 6 px (contrôles). Mode sombre : jetons fournis, à montrer sur 3 écrans
représentatifs seulement (parapheur, éditeur, vérification publique).

Statuts d'un acte (badge = couleur + icône lucide + libellé) :
Brouillon (neutre, file-pen) · En circuit (primaire, route) · À corriger (alerte, undo-2) ·
Rejeté (danger, x-circle) · Prêt à signer (violet, pen-tool) · Transmis — projet de décret envoyé à
la Présidence (violet en contour, send) · Signé (or, stamp) · Exécutoire (succès, badge-check) ·
Archivé (primaire 900, archive) · Retiré (danger en contour, ban).

## 4. Données réalistes à utiliser (fictives)

- Référence d'un acte signé : « N° 26/0042/NS/MINESUP/SG/DAG » (année/séquence/type/MINESUP/structures),
  toujours en JetBrains Mono, chiffres tabulaires.
- Types : DEC projet de décret, AM arrêté ministériel, D décision, CIR circulaire, NS note de service,
  C communiqué, ATT attestation.
- Structures : Secrétariat Général (SG), Direction des Affaires Générales (DAG), Sous-Direction de
  l'Accueil, du Courrier et de Liaison (SDACL), Division des Affaires Juridiques (DAJ),
  Cellule de Traduction, Division des Systèmes d'Information (DSI).
- Circuit type d'une note de service : chef de service → directeur → Secrétaire Général (48 h par étape).
- Mention de délégation : « Pour le Ministre et par délégation, Le Secrétaire Général ».
- Code de vérification imprimé sous le QR : « K7Q2-9M ». Empreinte SHA-256 tronquée « 3f9a…c21e ».
- Noms de personnes fictifs et variés ; jamais de personnalités réelles.

## 5. Rôles et navigation

Rôles (cumulables) : Rédacteur, Viseur (chef de service, sous-directeur, directeur), Juriste,
Traducteur, Secrétaire Général, Autorité signataire (Ministre ou délégataire), Administrateur,
Auditeur, Agent du courrier. Le menu n'affiche que ce que le rôle permet. Page d'arrivée :
« Mon travail » (S-02). Menu : Mon travail · Parapheur (avec compteur) · À signer (signataires) ·
Mes actes · Nouvel acte (bouton principal) · Délégations · Administration (Organigramme, Utilisateurs,
Types d'actes, Circuits) · Journal d'audit (auditeur). Entrées futures grisées « bientôt » :
Recherche, Archives, Courrier, Tableau de bord.
Mobile : tiroir de navigation + barre basse à 4 entrées (Mon travail, Parapheur, Nouvel acte, Profil).

## 6. Écrans à concevoir (avec tous leurs états)

Pour CHAQUE écran : état nominal, chargement (squelettes), vide, erreur, et les cas particuliers cités.

Authentification
- A-01 Connexion : matricule ou e-mail + mot de passe, choix de langue, erreur d'identifiants.
- A-02 Code TOTP à 6 chiffres (saisie case par case, collage accepté, erreur, renvoi impossible : expliquer).
- A-03 Activation TOTP : QR à scanner avec une application d'authentification, clé manuelle,
  confirmation par un premier code, codes de secours à conserver.
- A-04 Compte verrouillé 15 min après 5 échecs (compte à rebours, contact administrateur).
- A-05 Fenêtre « Votre session va expirer » à 28 min d'inactivité, puis écran « Session expirée »
  (les brouillons sont enregistrés).

Coquille
- S-01 Layout complet desktop / tablette / mobile.
- S-02 « Mon travail » : 4 compteurs (à viser, à signer, à corriger, brouillons), liste des 5 actes
  les plus urgents, raccourci « Nouvel acte ». Variante par rôle (rédacteur, viseur, Ministre).
- S-03 Pages 403, 404, erreur serveur ; bandeau « hors ligne — vos brouillons sont conservés ».

Rédaction
- R-01 « Mes actes » : tableau (référence ou « brouillon », type, objet, statut, étape courante,
  mise à jour), filtres par statut / type / période ; en mobile, cartes empilées.
- R-02 et R-03 Assistant « Nouvel acte » en étapes : type (cartes avec code, libellé, description)
  puis modèle (langue, version, date ; badge discret « servi depuis le cache » quand le dépôt de
  modèles est indisponible — ce n'est pas une erreur bloquante).
- R-04 Éditeur : en-tête officiel pré-rempli non modifiable (République du Cameroun / Paix – Travail –
  Patrie / MINESUP / structure), objet, éditeur de texte riche, visas réglementaires et liste
  d'ampliation pré-remplies et modifiables, langue (FR/EN) + case « traduction requise », portée
  (réglementaire / individuelle), confidentialité (Public / Interne / Confidentiel), indicateur
  d'enregistrement automatique (« Enregistré il y a 5 s »), bouton « Soumettre ».
  Disposition desktop : éditeur au centre, panneau latéral des propriétés et pièces.
- R-05 Pièces jointes : glisser-déposer, PDF/DOCX/JPG/PNG ≤ 20 Mo, progression, puis état d'analyse
  antivirus (en cours / saine / infectée → bloquée / type ou taille refusés). Une pièce n'est
  téléchargeable qu'une fois « saine ».
- R-06 Aperçu A4 fidèle au document final (sans numéro ni QR tant qu'il n'est pas signé).
- R-07 Soumission : liste des champs manquants avec lien vers chacun ; confirmation « L'acte est
  dans le parapheur de [nom], chef de service ».

Parapheur
- P-01 Parapheur : actes triés par échéance ; colonnes type, objet, rédacteur, étape, échéance ;
  badges « échéance proche » (75 % du délai) et « en retard » ; bouton « Viser » sur chaque ligne ;
  filtres. Mobile : cartes avec action principale.
- P-02 Détail : document lisible (aperçu A4 zoomable), pièces, métadonnées, et barre d'actions
  fixe : Viser (principal) · Demander une correction · Rejeter (contour danger).
- P-03 Suivi du circuit : frise verticale des étapes (faite, en cours, à venir), qui a visé quand,
  observations, retours en correction. Visible aussi par le rédacteur.
- P-04 Viser : fenêtre avec observation facultative, confirmation, puis toast et passage
  automatique à l'acte suivant.
- P-05 Correction : choix de l'étape de retour + motif obligatoire.
- P-06 Rejet : motif obligatoire + confirmation explicite (action définitive).
- P-07 Conflit : « Cet acte a été modifié par quelqu'un d'autre », bouton Recharger.

Signature
- G-01 « À signer » : liste des actes prêts à signer.
- G-02 Écran de signature : aperçu final, signataire, mention de délégation si délégataire (avec
  période de validité), bouton or « Signer ». Cas d'erreur : délégation expirée.
- G-03 Fenêtre TOTP (6 chiffres) puis état de traitement « Attribution du numéro… Génération du
  PDF/A… » ; erreur de code ; double clic sans effet.
- G-04 Acte signé : moment fort et solennel — grande référence en mono, date et heure de signature,
  QR, code court, empreinte, bouton « Télécharger le PDF/A », statut « Signé » or.

Organisation et administration
- O-01 Organigramme en arbre (déplier / replier), avec effectifs par structure.
- O-02 Utilisateurs : tableau, recherche, filtres rôle / structure / actif ; un compte ne se supprime
  jamais, il se désactive.
- O-03 Fiche utilisateur : identité, matricule, e-mail, structure, rôles multiples, état TOTP,
  réinitialisation du TOTP.
- O-04 Délégations : actives / à venir / expirées ; formulaire (délégataire, type signature ou
  intérim, période, mention) ; une délégation expire seule à sa date de fin.
- C-01 Types d'actes : liste + panneau d'édition (code, libellé, mode de publicité, durée de
  conservation, champs obligatoires).
- C-02 Éditeur de circuit : choisir type × structure, puis liste ordonnée d'étapes réordonnables
  (glisser), chaque étape = libellé, rôle requis, délai en heures. Aperçu du circuit en frise.

Audit
- U-01 Journal : tableau dense (horodatage, acteur, action, ressource, détails dépliables), filtres.
- U-02 Vérification d'intégrité : bouton « Vérifier la chaîne », progression, puis résultat
  « Journal intègre — 12 408 entrées vérifiées » (succès) ou « Rupture détectée à l'entrée n° 8 231 »
  (danger, détail).

Vérification publique (sans connexion, MOBILE D'ABORD : on y arrive en scannant un QR)
- V-01 Page sobre aux couleurs du ministère : champ référence + code court, explication en une phrase.
- V-02 Résultat : « Acte authentique » (cadre or, référence, type, date, signataire, statut,
  empreinte) ; variantes « Acte retiré » et « Aucun acte ne correspond ». Jamais le contenu d'un acte
  non public.

Document
- D-01 Gabarit A4 de l'acte signé (Source Serif 4) : en-tête bilingue République du Cameroun /
  Republic of Cameroon, Paix – Travail – Patrie, MINESUP, structure ; type et référence ; objet ;
  corps ; lieu et date (Yaoundé) ; mention de délégation et signataire ; bloc de signature
  électronique (date, heure, empreinte) ; QR + « Vérifier cet acte : https://{domaine}/verifier/K7Q2-9M » ;
  ampliations en pied.

## 7. Parcours à prototyper (cliquables)

1. Rédacteur : connexion → Mon travail → Nouvel acte (type NS, modèle) → éditer → joindre une pièce →
   soumettre.
2. Chef de service : parapheur → ouvrir → viser (3 clics max).
3. Directeur : parapheur → demander une correction ; le rédacteur corrige et resoumet.
4. Ministre (ou SG délégataire) : À signer → signer → TOTP → acte signé avec référence et QR.
5. Public, sur mobile : scanner le QR → page de vérification → acte authentique.
6. Auditeur : journal → vérifier l'intégrité.

## 8. Livrable attendu

1. Système de design : jetons (couleurs, typo, espacements, rayons, ombres, points de rupture),
   avec les mêmes noms que la palette ci-dessus ; échelle typographique ; grille.
2. Bibliothèque de composants avec leurs variantes et états (défaut, survol, focus, désactivé,
   erreur, chargement) : boutons (primaire, secondaire, contour, danger, or « Signer »), champs,
   sélecteurs, cases, éditeur riche, zone de dépôt, badges de statut, tableau dense + version cartes,
   frise de circuit, fenêtres modales, tiroir, toasts, bannières, onglets, assistant à étapes,
   saisie OTP, état vide, squelettes, pagination, en-tête, menu latéral, barre basse mobile.
   Indique pour chacun le composant shadcn/ui de départ.
3. Toutes les maquettes de la section 6, en 1440 / 768 / 375 px, avec leurs états.
4. Le prototype cliquable des 6 parcours.
5. Une note de transmission aux développeurs : règles de mise en page, espacements, comportements
   (responsive, focus, animations sobres ≤ 200 ms), textes FR et EN de chaque écran, et le code
   d'exemple React + Tailwind des composants clés utilisant les noms de jetons.

Avant de dessiner les 36 écrans, montre d'abord le système de design et 3 écrans pilotes
(P-01 Parapheur, R-04 Éditeur, G-04 Acte signé) pour validation de la direction visuelle.
```
