#!/bin/sh
#
# Crontab del sidecar "cron" de Daytuba Tasks (docker-compose, imagen busybox).
# El servidor de la app (Next.js standalone) no trae scheduler propio, así
# que este contenedor hace de crontab para los barridos diarios protegidos
# por CRON_SECRET:
#   - /api/cron/reminders    recordatorios vencidos
#   - /api/cron/moodle-sync  sync automático de Moodle + detección de cambios
#
# Variables de entorno esperadas:
#   CRON_SECRET               (obligatoria) secreto compartido con el web.
#   REMINDERS_CRON_SCHEDULE   (opcional) "min hora dommes_dow" en UTC.
#                             Por defecto "0 14 * * *" = 09:00 Panamá.
#   REMINDERS_URL             (opcional) endpoint de recordatorios.
#   MOODLE_SYNC_CRON_SCHEDULE (opcional) por defecto "0 11 * * *" = 06:00
#                             Panamá (antes del barrido de recordatorios, para
#                             que las tareas ya estén frescas a esa hora).
#   MOODLE_SYNC_URL           (opcional) endpoint de sync de Moodle.

set -eu

: "${CRON_SECRET:?CRON_SECRET es obligatoria}"
REMINDERS_CRON_SCHEDULE=${REMINDERS_CRON_SCHEDULE:-0 14 * * *}
REMINDERS_URL=${REMINDERS_URL:-http://web:3000/api/cron/reminders}
MOODLE_SYNC_CRON_SCHEDULE=${MOODLE_SYNC_CRON_SCHEDULE:-0 11 * * *}
MOODLE_SYNC_URL=${MOODLE_SYNC_URL:-http://web:3000/api/cron/moodle-sync}

cat > /etc/crontabs/root <<EOF
${REMINDERS_CRON_SCHEDULE} wget -q -O /dev/null --header="Authorization: Bearer ${CRON_SECRET}" "${REMINDERS_URL}" || echo "\$(date -u) cron de recordatorios FAILED" >> /tmp/cron.log 2>&1
${MOODLE_SYNC_CRON_SCHEDULE} wget -q -O /dev/null --header="Authorization: Bearer ${CRON_SECRET}" "${MOODLE_SYNC_URL}" || echo "\$(date -u) cron de sync Moodle FAILED" >> /tmp/cron.log 2>&1
EOF

exec crond -f -l 8
