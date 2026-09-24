# Design: Prontuário

## Modelo de dados

```
Evolucao          id, pacienteId, atendimentoId?, texto (criptografado),
                  registradoEm, retificaDeId?, vigente Boolean,
                  criadoEm

RascunhoEvolucao  id, pacienteId, atendimentoId?, texto (criptografado),
                  atualizadoEm
                  @@unique([pacienteId, atendimentoId])
```

`Paciente` ganha apenas campos derivados de consulta, não colunas novas: a data
de elegibilidade é calculada, nunca persistida. Persistir data derivada de uma
configuração que pode mudar cria dois lugares para a verdade.

## Decisões

### Retificação encadeada, igual à remarcação

`retificaDeId` aponta para trás e `vigente` marca a ponta da cadeia. Retificar é
uma transação: a versão anterior recebe `vigente = false`, a nova é criada com
`retificaDeId` apontando para ela.

Alternativa descartada: coluna `versao` inteira com `@@unique([raizId, versao])`.
Funciona, mas obriga a carregar a cadeia inteira para descobrir a próxima versão,
e não é o padrão já estabelecido na remarcação de atendimento. Consistência entre
os dois vale mais do que a economia.

### Rascunho no servidor, nunca no navegador

O caminho óbvio — `localStorage` com debounce — gravaria texto clínico em claro
no disco do dispositivo, indexável por qualquer extensão do navegador e fora de
qualquer auditoria. Isso derruba a garantia de criptografia em repouso que o
resto do sistema mantém.

O rascunho vai para tabela própria, pela mesma coluna criptografada, com
`PUT /prontuario/rascunho` a cada poucos segundos de inatividade de digitação.
Tabela separada de `Evolucao`, e não um campo `finalizada` no mesmo modelo,
porque rascunho não é registro clínico: não entra no PDF, não entra na contagem
de guarda, e some quando a evolução é gravada.

Custo: uma requisição a cada pausa de digitação. Trivial para um usuário.

### Auditoria no ponto de decifragem, não no controller

O interceptor da 01 registra acesso por rota. Aqui isso não basta: a cliente
quer rastreamento por evolução individual, e abrir o prontuário lista várias.

Dois eventos, não um. `EVOLUCAO_LISTADA` diz que a lista foi aberta;
`EVOLUCAO_LIDA` diz que um texto específico foi decifrado. Colapsar os dois
encheria a trilha de registros de texto que ninguém leu, enfraquecendo-a
justamente como evidência.

`EVOLUCAO_LIDA` é emitido pelo serviço de criptografia, ao decifrar. No
controller, a trilha dependeria de cada rota nova lembrar de chamá-la; no ponto
de decifragem, qualquer caminho de leitura entra na trilha por construção —
inclusive a geração do PDF, que não precisa de tratamento próprio.

### PDF gerado no servidor

Geração no cliente exigiria trafegar todo o texto decifrado para o navegador e
montá-lo lá, ampliando a superfície. O PDF é montado na API, auditado na geração,
e entregue como download pelo BFF. Traz rodapé com data de emissão, identificação
da profissional e aviso de documento sigiloso.

### Prazo de guarda em configuração, com piso validado no boot

`GUARDA_PRONTUARIO_ANOS`, padrão 20. A aplicação recusa iniciar com valor abaixo
de 5. Falhar no boot é melhor do que descobrir pela tela que o sistema está
calculando um prazo que não se sustenta perante o conselho.

O cálculo vive em uma função pura, testável, que recebe data do último registro e
data de nascimento e devolve a data de elegibilidade — incluindo a regra de
paciente que era menor de idade.

### Backup fora da aplicação

`pg_dump` em container próprio, agendado, saída cifrada com `age` ou GPG, chave
guardada separada do servidor. Deliberadamente fora do código da aplicação: um
backup que depende da aplicação estar saudável falha exatamente quando é preciso.

A tarefa de restaurar em banco limpo é obrigatória nesta change. Backup nunca
restaurado é suposição, não garantia.

## Arquitetura

```
apps/api/src/
├── prontuario/     controller, service, repository, pdf/
└── comum/
    ├── criptografia/    (já existe desde a 01 — reutilizar, não duplicar)
    └── guarda/          cálculo puro de elegibilidade
```

## Endpoints

```
GET    /api/v1/pacientes/:id/evolucoes
POST   /api/v1/pacientes/:id/evolucoes
GET    /api/v1/evolucoes/:id/historico
POST   /api/v1/evolucoes/:id/retificar
GET    /api/v1/pacientes/:id/prontuario.pdf

GET    /api/v1/prontuario/rascunho     ?pacienteId=&atendimentoId=
PUT    /api/v1/prontuario/rascunho
DELETE /api/v1/prontuario/rascunho
```

Não existe `PATCH` nem `DELETE` em `/evolucoes/:id`. A ausência é a garantia.

## Frontend

```
apps/web/src/
├── app/(app)/pacientes/[id]/prontuario/page.tsx
└── features/prontuario/
```

Desktop primeiro, por decisão registrada. O editor é um `textarea` com contagem
de caracteres e indicador de rascunho salvo — sem editor rico na v1: formatação
não acrescenta nada ao texto clínico e traz risco de HTML injetado no PDF.

A lista de evoluções carrega os textos sob demanda, não todos de uma vez, para
que abrir o prontuário não gere dezenas de eventos de auditoria de leitura que
ninguém de fato leu.

## Testes

Obrigatórios: texto ilegível na coluna, cadeia de retificação íntegra após duas
retificações, rascunho sobrevivendo a sessão expirada, rascunho removido ao
gravar, cálculo de elegibilidade para paciente que era menor de idade, recusa de
boot com prazo abaixo de 5 anos, e restauração de backup em banco limpo.