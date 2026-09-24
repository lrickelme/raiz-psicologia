# auth Specification

## Purpose
TBD - created by archiving change 01-fundacao. Update Purpose after archive.

## Requirements

### Requirement: Acesso restrito à profissional

O sistema MUST exigir sessão autenticada para todo endpoint sob `/api/v1`, com
exceção de `POST /api/v1/auth/login` e do health check. O sistema MUST NOT expor
qualquer rota de auto-cadastro; a credencial única é provisionada por migration
ou comando administrativo.

#### Scenario: Requisição sem sessão

- GIVEN uma requisição para `/api/v1/pacientes` sem cookie de sessão válido
- WHEN a API processa a requisição
- THEN responde `401` com corpo `application/problem+json`
- AND não executa nenhuma consulta ao banco

#### Scenario: Tentativa de auto-cadastro

- GIVEN qualquer verbo HTTP em `/api/v1/auth/registro`
- WHEN a requisição chega à API
- THEN responde `404`

### Requirement: Login com credencial forte

O sistema SHALL autenticar por e-mail e senha, com a senha armazenada em hash
Argon2id. O sistema MUST responder de forma indistinguível para e-mail
inexistente e senha incorreta, tanto no corpo e no status quanto no tempo de
resposta.

#### Scenario: Credencial válida

- GIVEN a credencial provisionada da profissional
- WHEN ela envia e-mail e senha corretos em `POST /api/v1/auth/login`
- THEN a API responde `204`
- AND define cookie de sessão com `HttpOnly`, `Secure` e `SameSite=Strict`
- AND registra evento `LOGIN_SUCESSO` na trilha de auditoria

#### Scenario: Senha incorreta

- GIVEN a credencial provisionada
- WHEN ela envia a senha errada
- THEN a API responde `401` com a mesma mensagem genérica usada para e-mail
      desconhecido
- AND registra evento `LOGIN_FALHA` na trilha de auditoria

#### Scenario: Tempo de resposta indistinguível

- GIVEN um e-mail inexistente e um e-mail existente com senha incorreta
- WHEN cada um é enviado a `POST /api/v1/auth/login`
- THEN a API aplica o mesmo piso de tempo às duas respostas
- AND verifica a senha contra um hash Argon2id de descarte quando o e-mail não
      existe, em vez de responder sem calcular o hash
- AND as duas respostas têm o mesmo status e o mesmo corpo
- AND o piso não se aplica ao `204` de credencial válida, que já se distingue
      pelo status e pelo cookie de sessão
- AND o piso não se aplica a `422` de payload inválido nem ao `429` do rate
      limit, que são recusados antes de consultar qualquer conta

#### Scenario: Tentativas repetidas

- GIVEN cinco falhas de login a partir do mesmo IP em cinco minutos
- WHEN uma sexta tentativa é feita
- THEN a API responde `429` e não avalia a senha

### Requirement: Expiração de sessão por inatividade

O sistema SHALL invalidar a sessão após 30 minutos sem requisição autenticada. A
sessão MUST ser renovada a cada requisição válida. Esse prazo existe porque o
sistema roda em consultório, onde a tela pode ficar exposta entre atendimentos.

#### Scenario: Sessão ociosa

- GIVEN uma sessão autenticada sem requisições há 30 minutos
- WHEN uma nova requisição usa aquele cookie
- THEN a API responde `401`
- AND o registro de sessão é removido do servidor

#### Scenario: Aviso na interface

- GIVEN uma sessão a dois minutos da expiração
- WHEN a interface detecta a proximidade
- THEN exibe aviso com opção de continuar conectada
- AND a escolha de continuar renova a sessão sem recarregar a página

### Requirement: Logout explícito

O sistema SHALL oferecer encerramento imediato da sessão, acessível de qualquer
tela do shell.

#### Scenario: Encerramento manual

- GIVEN uma sessão ativa
- WHEN a profissional aciona sair
- THEN a sessão é destruída no servidor
- AND o cookie é expirado no navegador
- AND a interface retorna à tela de login sem estado residual em memória

### Requirement: Trilha de auditoria

O sistema MUST registrar em tabela dedicada todo evento de autenticação e todo
acesso a dado de paciente, com data e hora, tipo de evento, identificador do
recurso e endereço de origem. Os registros MUST ser somente-inserção.

#### Scenario: Registro imutável

- GIVEN um evento gravado na trilha de auditoria
- WHEN qualquer código da aplicação tenta alterá-lo ou removê-lo
- THEN a operação falha
- AND nenhuma rota da API expõe alteração de auditoria
