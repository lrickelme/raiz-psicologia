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

### Salvamento em voo: cancelar o agendado, aguardar o enviado

Cada salvamento de rascunho leva um número de sequência monotônico; resposta
com número menor que o último aplicado é ignorada. Assim uma resposta atrasada
nunca sobrescreve estado posterior — o indicador de "rascunho salvo" não volta
para trás.

Gravar a evolução cancela o salvamento agendado que ainda não saiu (o
temporizador da pausa de digitação) e **aguarda** o que já está em voo antes de
emitir o `POST`. Abortar o `fetch` com `AbortController` não basta: ele só
descarta a resposta no navegador, e uma requisição que já chegou à API termina
e grava — possivelmente depois do `POST`, recriando o rascunho que a gravação
acabou de consumir. Aguardar custa, no pior caso, a latência de um `PUT`.

### 401 no editor: reautenticar sem desmontar

A regra global é ir para o login ao perder a sessão, e ela existe em dois
pontos do cliente: `chamarApi`, em qualquer 401, e o aviso de expiração do
shell, que navega sozinho quando a contagem zera — sem 401 nenhum. O
`proxy.ts` só age em navegação de página, que o editor não faz.

O editor é exceção nos dois pontos. Com texto não salvo, um 401 no salvamento
abre modal de reautenticação e mantém o componente montado, preservando o
estado do `textarea`; o aviso global, enquanto o editor tiver texto pendente,
cede a esse modal em vez de navegar. Redirecionar destruiria a única cópia do
trecho recente. Depois de entrar, o texto retido é reenviado como rascunho.

A retenção é só a memória do processo da página. `localStorage`,
`sessionStorage` e IndexedDB continuam proibidos: fechar a aba sem reautenticar
perde o trecho não salvo, e esse é o preço de não deixar texto clínico em
claro no dispositivo.

Os testes desse comportamento precisam de navegador real — requisição em voo,
401, armazenamento do navegador — e rodam em Playwright no `apps/web`.

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

## Telefone

### Só dígitos no banco, formatação na borda

A coluna `telefone` passa a guardar apenas dígitos, garantido no banco por
`CHECK (telefone ~ '^[0-9]+$')`. A quantidade — 10 (fixo) ou 11 (celular) — é
validada pelo schema Zod compartilhado, e não por constraint, por causa dos
dados legados (abaixo). Exibição formata; armazenamento nunca.

### Prefixo 55 só quando sobra

Normalizar é: remover tudo que não é dígito; se restarem 12 ou 13 dígitos
começando com `55`, remover o `55`; só então exigir 10 ou 11. Descartar o `55`
incondicionalmente quebraria o DDD 55 (região de Santa Maria, RS):
`(55) 99999-9999` tem 11 dígitos e é número nacional.

### Dados legados sem perda

Até aqui o telefone era gravado como digitado, sem validação de formato. A
migration aplica a mesma regra em SQL; vazio vira `NULL`. Registro que,
normalizado, não fechar 10 ou 11 dígitos fica com os dígitos que tem — apagá-lo
perderia dado, e completar dígitos seria inventá-lo. A migration conta esses
casos num `RAISE NOTICE`, e a API exige a correção na próxima edição do
cadastro. É por isso que a quantidade não vira `CHECK`.

### Busca

A busca já normaliza os dois lados desde a 01: `raiz_digitos(telefone)` no dado
e `replace(/\D/g, "")` no termo. Com o dado em dígitos, a função vira
identidade; ela é mantida para não recriar o índice de trigramas. A tarefa é
confirmar esse comportamento e cobri-lo com teste de termo mascarado e cru.

### Máscara sem biblioteca

Componente próprio, sem biblioteca de máscara. O requisito é estreito — dois
formatos — e os defeitos que a spec descreve (backspace que apaga só o
caractere da máscara, cursor que salta para o fim) vêm justamente de
bibliotecas que reformatam o valor inteiro a cada evento e perdem a posição.

O estado do campo é a string de dígitos; o texto exibido é derivado dela. A
posição do cursor é tratada como "quantos dígitos há à sua esquerda": após
formatar, o cursor volta para depois do mesmo dígito. Backspace sobre um
caractere de máscara remove o dígito anterior a ele. Formatação e cálculo de
cursor são funções puras em `packages/shared`, testáveis sem navegador.

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