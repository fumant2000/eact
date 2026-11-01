# Charte graphique EACT

> Statut : **proposition** à valider en équipe. Les jetons sont implémentés dans
> [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) (Tailwind v4 `@theme`).

## 1. Intention

EACT est un outil **institutionnel** (Ministère de l'Enseignement Supérieur) utilisé par des agents
peu familiers du numérique (CT-14). L'interface doit inspirer **confiance, sobriété et
lisibilité**, pas l'effet « startup ».

| Principe | Traduction visuelle |
|---|---|
| Autorité / confiance | Bleu profond institutionnel comme couleur primaire |
| Officialité de l'acte | Or « sceau » réservé à la signature et au QR de vérification |
| Ancrage camerounais | Vert et rouge de succès / danger inspirés du drapeau, sans folklore |
| Accessibilité (ENF-12) | Tous les couples texte/fond ≥ 4,5:1 (WCAG 2.1 AA), vérifiés |
| Bilinguisme (CT-01) | Libellés FR/EN externalisés, largeur des boutons prévue pour l'anglais **et** le français |

**Pourquoi pas le violet en primaire ?** Le violet évoque la créativité / le grand public ;
pour un parapheur administratif, le bleu est plus lisible et plus « État ». Le violet est
gardé pour un rôle précis : le statut **« Prêt à signer »**, qui doit se distinguer du bleu
« En circuit ».

## 2. Palette

### Primaire — « Bleu institutionnel » (marque : `#2D3C8F`)

| Jeton | Hex | Usage |
|---|---|---|
| `primary-50`  | `#EEF1FA` | Fond de ligne sélectionnée |
| `primary-100` | `#D9DFF3` | Fond de badge « En circuit » |
| `primary-200` | `#B6C1E8` | Bordures actives |
| `primary-300` | `#8C9BD8` | **Primaire en mode sombre** |
| `primary-400` | `#6274C4` | Icônes secondaires |
| `primary-500` | `#4357AE` | Liens, focus ring |
| `primary-600` | `#354799` | Survol bouton |
| `primary-700` | **`#2D3C8F`** | **Bouton principal, en-tête, marque** |
| `primary-800` | `#24306F` | Bouton pressé, barre latérale |
| `primary-900` | `#1C2553` | Titres sur fond clair |

### Accent — « Or sceau »

| Jeton | Hex | Usage |
|---|---|---|
| `seal-400` | `#D9A441` | Pastille « Signé », cachet, QR (fond, texte foncé dessus) |
| `seal-700` | `#8A6116` | Texte or sur fond blanc |

> Règle : l'or n'apparaît **que** pour ce qui a une valeur officielle (signature, sceau,
> vérification). Il ne sert jamais de couleur décorative.

### Sémantique

| Rôle | Clair | Sombre | Inspiration |
|---|---|---|---|
| Succès | `#0F7A55` | `#4CC38A` | Vert du drapeau `#007A5E` |
| Avertissement | `#B45309` | `#F0A84A` | — |
| Danger | `#C0262D` | `#F2777C` | Rouge du drapeau `#CE1126` |
| Info | `#4357AE` | `#8C9BD8` | Primaire |

### Neutres

| Jeton | Clair | Sombre |
|---|---|---|
| `background` | `#F7F8FB` | `#0F1424` |
| `surface` | `#FFFFFF` | `#171D33` |
| `border` | `#E3E6EE` | `#2A3250` |
| `foreground` | `#1A2033` | `#E6E9F2` |
| `muted` | `#5B6478` | `#9AA3B8` |

### Contrastes vérifiés (WCAG 2.1)

| Couple | Ratio | |
|---|---|---|
| Blanc sur `primary-700` (bouton) | 9,75 | AAA |
| `foreground` sur `background` | 15,23 | AAA |
| `muted` sur `background` | 5,59 | AA |
| Succès / Avert. / Danger sur blanc | 5,34 / 5,02 / 5,90 | AA |
| Violet `#6D3FC0` sur blanc | 6,73 | AA |
| Texte foncé sur or `#D9A441` | 7,19 | AAA |
| Sombre : `primary-300` sur `#0F1424` | 6,80 | AA |

## 3. Couleurs des statuts d'un acte (diagramme d'états §14.1)

Chaque statut a **une couleur + une icône + un libellé** (jamais la couleur seule).

| Statut | Couleur | Icône (lucide) |
|---|---|---|
| Brouillon | Neutre `muted` | `file-pen` |
| En circuit | Primaire `#4357AE` | `route` |
| À corriger | Avertissement `#B45309` | `undo-2` |
| Rejeté | Danger `#C0262D` | `x-circle` |
| Prêt à signer | Violet `#6D3FC0` | `pen-tool` |
| Transmis (projet de décret) | Violet, contour seul | `send` |
| Signé | Or `#D9A441` (texte foncé) | `stamp` |
| Exécutoire | Succès `#0F7A55` | `badge-check` |
| Archivé | `primary-900` | `archive` |
| Retiré / abrogé | Danger, contour seul | `ban` |

## 4. Typographie

| Usage | Police | Raison |
|---|---|---|
| Interface | **Inter** (libre, OFL) | Très lisible en petite taille, chiffres tabulaires pour les références |
| Actes PDF/A | **Source Serif 4** (libre) | Rendu « officiel » proche des actes papier |
| Références / codes | **JetBrains Mono** | `N° 26/0042/NS/MINESUP/SG/DAG` aligné et non ambigu |

Échelle : 12 / 14 (corps) / 16 / 20 / 24 / 30. Corps minimum 14 px.

## 5. Composants & règles d'interface

- **shadcn/ui + Tailwind v4** (cahier des charges §20), icônes **lucide**.
- Rayon `8px` (cartes), `6px` (boutons) : sobre, pas « bulle ».
- **Viser en 3 clics max** (ENF-12) : action principale toujours visible à droite de la ligne du parapheur.
- Actions destructrices (Rejeter) en bouton contour rouge + motif obligatoire (RG-05).
- **Signer** : seul bouton plein or de l'application, ouvre la saisie TOTP.
- Mode sombre : supporté via jetons, non prioritaire (P2).
- Responsive dès **360 px** (ENF-13).
- Bandeau « mode dégradé » orange lorsque le réseau tombe (ENF-14).

## 6. Mise en page type

```
┌───────────────────────────────────────────────────────────────┐
│ [Logo MIN] EACT          Recherche…        FR|EN  🔔  Profil   │  ← en-tête primary-800
├──────────────┬────────────────────────────────────────────────┤
│ Parapheur (7)│  Parapheur — 7 actes en attente                │
│ Mes actes    │  ┌─────────────────────────────────────────┐   │
│ Courrier     │  │ NS · Permanence courrier  ⏱ J-1  [Viser]│   │
│ Recherche    │  │ AM · Circulation Bonanjo  ⚠ retard [..] │   │
│ Archives     │  └─────────────────────────────────────────┘   │
│ Tableau bord │                                                │
│ Admin        │                                                │
└──────────────┴────────────────────────────────────────────────┘
```
