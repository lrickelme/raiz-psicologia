#!/bin/bash
# uso: restaurar.sh <backup.dump.age> <identidade.age>
#
# Decifra com a chave PRIVADA age e restaura no banco indicado pelas
# variáveis do libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE), que
# precisa estar vazio. Para as evoluções voltarem legíveis, a API que usar o
# banco restaurado precisa da mesma RAIZ_CHAVE_CRIPTOGRAFIA da origem.
set -euo pipefail

arquivo="${1:?informe o arquivo de backup (.dump.age)}"
identidade="${2:?informe o arquivo da chave privada age}"
: "${PGDATABASE:?defina PGDATABASE}"

if [ -n "$(psql --no-password -Atc "SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1")" ]; then
  echo "O banco $PGDATABASE não está vazio; restaure em um banco novo." >&2
  exit 1
fi

age --decrypt --identity "$identidade" "$arquivo" \
  | pg_restore --no-owner --exit-on-error --no-password --dbname "$PGDATABASE"
echo "Restaurado: $(basename "$arquivo") em $PGDATABASE@${PGHOST:-localhost}:${PGPORT:-5432}."
