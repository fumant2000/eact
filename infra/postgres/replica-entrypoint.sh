#!/bin/sh
# Initialise le réplica par pg_basebackup au premier démarrage, puis le lance en hot standby.
set -e
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  until pg_basebackup -h postgres -D "$PGDATA" -U "$PGUSER" -Fp -Xs -P -R; do
    echo "Primaire indisponible, nouvel essai dans 5 s"; sleep 5
  done
  chmod 0700 "$PGDATA"
fi
exec su-exec postgres postgres -c hot_standby=on
