# Gabarits d'actes (contenu du dépôt `eact-gabarits`)

Copie de référence des modèles d'actes (CDC §19.1, BF-59). En exploitation, ce dossier est le contenu d'un dépôt
GitHub séparé, `eact-gabarits`, déclaré dans `GITHUB_TEMPLATES_REPO` : chaque modification passe par une revue
(pull request) et l'historique Git donne les versions de chaque modèle.

- `fr/*.html`, `en/*.html` : un fichier par modèle et par langue.
- En-tête obligatoire en commentaire HTML : `type` (code de l'annexe B), `libelle`, `version`, `description`,
  `ampliations` (séparées par `|`).
- Corps seulement : l'en-tête officiel bilingue, le titre « NOTE DE SERVICE N° … » et le bloc de signature sont
  produits par EACT selon le type et la structure (BF-16). Balises autorisées : `p`, `strong`, `em`, `u`, `ul`, `ol`,
  `li`, `h2`, `h3` (le reste est retiré à l'enregistrement).

Le seed charge ces fichiers dans le cache. L'administrateur peut ensuite synchroniser depuis GitHub
(Administration → Modèles) ; si GitHub est injoignable, la rédaction continue avec le cache (RG-23).
