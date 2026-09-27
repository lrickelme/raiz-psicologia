# Backup do banco fora da aplicação (design.md, "Backup fora da aplicação"):
# se a API estiver fora do ar, o backup continua rodando. Mesma versão major
# do servidor, para o pg_dump ser compatível.
FROM postgres:16-alpine

RUN apk add --no-cache age bash tzdata

COPY backup.sh restaurar.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restaurar.sh /usr/local/bin/entrypoint.sh

ENV TZ=America/Sao_Paulo \
    BACKUP_DIR=/backups \
    BACKUP_CRON="0 3 * * *" \
    BACKUP_RETENCAO_DIAS=30 \
    BACKUP_MANTER_MINIMO=7

ENTRYPOINT ["entrypoint.sh"]
CMD ["agendar"]
