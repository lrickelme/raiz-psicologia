#!/bin/bash
# agendar (padrão)  roda backup.sh no horário de BACKUP_CRON, em primeiro plano
# agora             um backup imediato e sai
# restaurar ...     ver restaurar.sh
set -euo pipefail

case "${1:-agendar}" in
  agora)
    exec backup.sh
    ;;
  restaurar)
    shift
    exec restaurar.sh "$@"
    ;;
  agendar)
    if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
      echo "BACKUP_AGE_RECIPIENT não definida: informe a chave pública age (ver README, Backup)." >&2
      exit 1
    fi
    # O crond do busybox não repassa o ambiente aos jobs: grava-o para o job ler.
    export -p > /etc/backup.env
    echo "$BACKUP_CRON bash -c '. /etc/backup.env; backup.sh' >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
    echo "Backup agendado: \"$BACKUP_CRON\" ($TZ), destino $BACKUP_DIR."
    exec crond -f -l 8
    ;;
  *)
    exec "$@"
    ;;
esac
