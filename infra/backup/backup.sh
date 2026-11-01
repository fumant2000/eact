#!/bin/sh
# Sauvegarde complète quotidienne (CDC §16.6) ; le WAL archivé assure le RPO d'1 h.
# La copie hors site (NAS, autre bâtiment) se fait par rsync depuis l'hôte.
set -e
while true; do
  f="/backups/eact-$(date +%Y%m%d-%H%M).dump"
  pg_dump -Fc -f "$f" && echo "Sauvegarde OK : $f"
  find /backups -name 'eact-*.dump' -mtime +30 -delete
  sleep 86400
done
