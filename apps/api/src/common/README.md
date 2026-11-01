# common/

Éléments transverses du serveur (à implémenter en It. 0 / It. 1) :

| Dossier | Contenu | Exigence |
|---|---|---|
| `events/` | Types des événements du bus (réexport de `@eact/shared`) | CDC §11 |
| `idempotency/` | Intercepteur `Idempotency-Key` : rejoue la réponse mémorisée dans `cle_idempotence` | §16.3, TF-08 |
| `security/` | Gardes JWT, RBAC + ABAC (structure, confidentialité), garde « TOTP < 5 min » | BF-42, RG-12, RG-15 |
| `errors/` | Filtre d'exceptions → JSON `{ code, message }`, 409 sur conflit de version | §14.2 |
