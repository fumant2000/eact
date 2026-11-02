#!/bin/sh
# Sauvegarde complète quotidienne ; le WAL archivé assure le RPO d'1 h (copie hors site : rsync depuis l'hôte).
set -e
while true; do
  f="/backups/eact-$(date +%Y%m%d-%H%M).dump"
  pg_dump -Fc -f "$f" && echo "Sauvegarde OK : $f"
  find /backups -name 'eact-*.dump' -mtime +30 -delete
  sleep 86400
done
