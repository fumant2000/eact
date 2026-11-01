# infrastructure/

Adaptateurs des **interfaces requises** (CDC tableau 19). Le métier n'importe que l'interface :
changer de technologie ne touche pas aux modules.

| Interface requise | Adaptateur V1 | Service Compose |
|---|---|---|
| `IStockage` | client S3 | `minio` |
| `IConvertisseurPdf` | client HTTP Gotenberg (PDF/A-2b) | `gotenberg` |
| `IAntivirus` | client clamd TCP | `clamav` |
| `IDepotGabarits` / `IAnomalies` | GitHub App (JWT RS256 → jeton d'installation), disjoncteur | sortie Internet du `worker` |
| `IMessagerie` | SMTP (nodemailer) / passerelle SMS | `mailpit` en dev |
| Persistance | `prisma/` | `postgres` |
