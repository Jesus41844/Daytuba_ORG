#!/bin/sh
#
# Dispara el cron de recordatorios de Daytuba Tasks.
# Corre como sidecar en docker-compose (servicio "cron", imagen busybox).
# El servidor de la app (Next.js standalone) no trae scheduler propio, así
# que este contenedor hace de crontab: llama a /api/cron/reminders una vez al
# día (configurable) con el CRON_SECRET para autorizarse.
#
# Variables de entorno esperadas:
#   CRON_SECRET       (obligatoria) secreto compartido con el servicio web.
#   CRON_SCHEDULE     (opcional) "min hora dommes_dow" en UTC. Por defecto
#                     "0 14 * * *" = 09:00 en Panamá (UTC-5, sin DST).
#   REMINDERS_URL     (opcional) endpoint del cron. Por defecto apunta al
#                     servicio web del compose.

set -eu

: "${CRON_SECRET:?CRON_SECRET es obligatoria}"
CRON_SCHEDULE=${CRON_SCHEDULE:-0 14 * * *}
REMINDERS_URL=${REMINDERS_URL:-http://web:3000/api/cron/reminders}

cat > /etc/crontabs/root <<EOF
${CRON_SCHEDULE} wget -q -O /dev/null --header="Authorization: Bearer ${CRON_SECRET}" "${REMINDERS_URL}" || echo "\$(date -u) cron de recordatorios FAILED" >> /tmp/reminders.log 2>&1
EOF

exec crond -f -l 8