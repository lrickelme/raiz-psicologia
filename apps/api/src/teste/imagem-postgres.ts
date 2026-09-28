/**
 * A mesma imagem do `docker-compose.yml`, que é a que roda em produção. Não a
 * alpine: com musl, `en_US.utf8` ordena por byte (maiúsculas antes, acentuadas
 * no fim), e a ordenação por nome verificada aqui divergiria da entregue.
 */
export const IMAGEM_POSTGRES = "postgres:16";
