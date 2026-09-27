#!/bin/bash
# Exercita o ciclo completo de backup (spec prontuario, "Backup verificado"):
#
#   1. gera um par de chaves age descartável, só para este exercício;
#   2. faz um backup do banco de origem com a imagem de backup;
#   3. sobe um Postgres limpo e restaura nele;
#   4. lê os dois bancos pela criptografia da aplicação e compara o texto
#      decifrado das evoluções e dos motivos de atendimento.
#
# Origem padrão: o Postgres do docker-compose (localhost:5433). A
# RAIZ_CHAVE_CRIPTOGRAFIA vem de apps/api/.env. Nada é escrito na origem.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
imagem=raiz-backup
porta_restaurado="${PORTA_RESTAURADO:-5439}"
origem_host="${ORIGEM_PGHOST:-localhost}"
origem_porta="${ORIGEM_PGPORT:-5433}"
origem_usuario="${ORIGEM_PGUSER:-raiz}"
origem_senha="${ORIGEM_PGPASSWORD:-raiz}"
origem_banco="${ORIGEM_PGDATABASE:-raiz}"

trabalho="$(mktemp -d)"
# Arquivos gerados nos containers ficam com o usuário de quem roda o script.
como_eu=(--user "$(id -u):$(id -g)")
container="raiz-restauracao-$$"
limpar() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$trabalho"
}
trap limpar EXIT

echo "== Construindo a imagem de backup"
docker build -q -t "$imagem" "$raiz/infra/backup" >/dev/null

echo "== Gerando par de chaves age descartável"
docker run --rm "${como_eu[@]}" --entrypoint age-keygen -v "$trabalho:/trabalho" "$imagem" -o /trabalho/identidade.age 2>/dev/null
publica="$(grep -o 'age1[0-9a-z]*' "$trabalho/identidade.age")"

echo "== Backup da origem ($origem_banco@$origem_host:$origem_porta)"
docker run --rm "${como_eu[@]}" --network host -v "$trabalho:/backups" \
  -e PGHOST="$origem_host" -e PGPORT="$origem_porta" -e PGUSER="$origem_usuario" \
  -e PGPASSWORD="$origem_senha" -e PGDATABASE="$origem_banco" \
  -e BACKUP_AGE_RECIPIENT="$publica" \
  "$imagem" agora
arquivo="$(basename "$(ls -1 "$trabalho"/raiz-*.dump.age)")"
if head -c 64 "$trabalho/$arquivo" | grep -aq "PGDMP"; then
  echo "O arquivo de backup não está cifrado." >&2
  exit 1
fi

echo "== Subindo Postgres limpo na porta $porta_restaurado"
docker run -d --rm --name "$container" -p "$porta_restaurado:5432" \
  -e POSTGRES_USER=raiz -e POSTGRES_PASSWORD=raiz -e POSTGRES_DB=raiz_restaurado \
  postgres:16-alpine >/dev/null
until docker exec "$container" pg_isready -U raiz -d raiz_restaurado >/dev/null 2>&1; do sleep 1; done
sleep 2

echo "== Restaurando $arquivo"
docker run --rm "${como_eu[@]}" --network host -v "$trabalho:/backups" \
  -e PGHOST=localhost -e PGPORT="$porta_restaurado" -e PGUSER=raiz \
  -e PGPASSWORD=raiz -e PGDATABASE=raiz_restaurado \
  "$imagem" restaurar "/backups/$arquivo" /backups/identidade.age

echo "== Conferindo as garantias do banco restaurado"
gatilhos="$(docker exec "$container" psql -U raiz -d raiz_restaurado -Atc \
  "SELECT count(*) FROM pg_trigger WHERE tgname IN ('evolucao_sem_alteracao', 'auditoria_sem_alteracao', 'auditoria_sem_truncate')")"
if [ "$gatilhos" != "3" ]; then
  echo "Gatilhos de imutabilidade ausentes no banco restaurado ($gatilhos de 3)." >&2
  exit 1
fi
echo "Gatilhos de imutabilidade de evolução e auditoria presentes."

echo "== Comparando o conteúdo decifrado"
cd "$raiz/apps/api"
npx tsx scripts/verificar-restauracao.ts \
  "postgresql://$origem_usuario:$origem_senha@$origem_host:$origem_porta/$origem_banco" \
  "postgresql://raiz:raiz@localhost:$porta_restaurado/raiz_restaurado"
