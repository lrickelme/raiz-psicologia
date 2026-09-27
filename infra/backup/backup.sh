#!/bin/bash
# Um backup: pg_dump em formato custom, cifrado com a chave PÚBLICA age.
# O servidor consegue cifrar, mas não decifrar — a chave privada fica fora
# dele. Conexão pelas variáveis padrão do libpq (PGHOST, PGPORT, PGUSER,
# PGPASSWORD, PGDATABASE).
set -euo pipefail

: "${BACKUP_AGE_RECIPIENT:?defina BACKUP_AGE_RECIPIENT com a chave pública age}"
: "${PGDATABASE:?defina PGDATABASE}"
dir="${BACKUP_DIR:-/backups}"
mkdir -p "$dir"
log="$dir/backup.log"

registrar() {
  local linha
  linha="$(date '+%Y-%m-%dT%H:%M:%S%z') $*"
  echo "$linha"
  echo "$linha" >> "$log"
}

destino="$dir/raiz-$(date '+%Y-%m-%dT%H%M%S').dump.age"
parcial="$destino.parcial"
inicio=$(date +%s)

falhou() {
  local status=$?
  rm -f "$parcial"
  registrar "FALHA status=$status arquivo=$(basename "$destino")"
  exit "$status"
}
trap falhou ERR

registrar "início banco=$PGDATABASE@${PGHOST:-localhost}:${PGPORT:-5432}"
# Grava em .parcial e só renomeia no fim: arquivo com o nome final é sempre
# um backup completo.
pg_dump --format=custom --no-password \
  | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$parcial"
mv "$parcial" "$destino"
trap - ERR

registrar "ok arquivo=$(basename "$destino") bytes=$(stat -c %s "$destino") duracao=$(( $(date +%s) - inicio ))s"

# Retenção só depois de um backup bem-sucedido, e nunca abaixo dos
# BACKUP_MANTER_MINIMO mais recentes: backups falhando por semanas não
# apagam os últimos bons.
retencao="${BACKUP_RETENCAO_DIAS:-0}"
minimo="${BACKUP_MANTER_MINIMO:-7}"
if [ "$retencao" -gt 0 ]; then
  ls -1t "$dir"/raiz-*.dump.age | tail -n +"$((minimo + 1))" | while read -r antigo; do
    if [ -n "$(find "$antigo" -mtime +"$retencao")" ]; then
      rm -f "$antigo"
      registrar "removido por retenção arquivo=$(basename "$antigo")"
    fi
  done
fi
