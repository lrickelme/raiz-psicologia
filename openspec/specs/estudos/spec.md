# estudos Specification

## Purpose
Quadro de formação contínua da profissional: tópicos de estudo em três estados,
histórico de concluídos e labels de prioridade com nome, cor e ordem editáveis.

## Requirements

### Requirement: Cadastro de tópico de estudo

O sistema SHALL permitir criar e editar tópicos de estudo com título, descrição
opcional e, no máximo, uma label de prioridade. O título MUST ser obrigatório,
com até 200 caracteres. A descrição MUST ter até 2000 caracteres. Todo tópico
novo nasce no estado `A_ESTUDAR`.

O formulário MUST avisar, junto aos campos de texto, que estudos não é
prontuário e que ali não se registra dado identificável de paciente.

O sistema MUST NOT oferecer exclusão de tópico.

#### Scenario: Criação mínima

- GIVEN a profissional no quadro de estudos
- WHEN cria um tópico informando apenas o título
- THEN o tópico aparece na coluna "A estudar", sem label
- AND a coluna sobe o contador em um

#### Scenario: Título vazio

- GIVEN o formulário de novo tópico
- WHEN a profissional salva com o título em branco ou só com espaços
- THEN a API responde `422` apontando `titulo`
- AND a interface destaca o campo sem limpar os demais

#### Scenario: Troca e remoção da label

- GIVEN um tópico com a label "Alta"
- WHEN a profissional o edita e escolhe "Baixa"
- THEN o tópico passa a exibir "Baixa"
- AND, quando ela remove a label, o tópico fica sem prioridade

#### Scenario: Label inexistente

- GIVEN o formulário de tópico
- WHEN a requisição traz um `labelId` que não existe
- THEN a API responde `422` apontando `labelId`

#### Scenario: Aviso sobre dado de paciente

- GIVEN o formulário de novo tópico ou de edição
- WHEN ele é exibido
- THEN há um texto visível informando que estudos não é prontuário e não deve
  conter dado identificável de paciente

### Requirement: Estados do tópico

O sistema SHALL manter cada tópico em um de três estados: `A_ESTUDAR`,
`EM_ESTUDO` ou `CONCLUIDO`. A profissional SHALL poder mover o tópico de qualquer
estado para qualquer outro.

Concluir MUST gravar o instante da conclusão, definido pelo servidor. Sair de
`CONCLUIDO` MUST limpar esse instante. Um tópico MUST ter instante de conclusão
se, e somente se, estiver `CONCLUIDO`, e o banco MUST garantir isso.

Cada cartão MUST oferecer a mudança de estado por uma ação explícita (a caixa de
conclusão e o menu), operável por teclado e sem depender de arrastar nem de
`hover`. Depois de uma mudança de estado feita no cartão, o foco do teclado MUST
ficar na coluna de onde o cartão saiu, no mesmo controle do cartão que ocupou o
lugar dele, e nunca voltar ao início da página.

#### Scenario: Começar a estudar

- GIVEN um tópico em "A estudar"
- WHEN a profissional o move para "Em estudo"
- THEN ele sai da primeira coluna e aparece na segunda
- AND os contadores das duas colunas se ajustam

#### Scenario: Concluir

- GIVEN um tópico em "Em estudo"
- WHEN a profissional marca a caixa de conclusão do cartão
- THEN o tópico vai para "Concluídos", riscado, com a data da conclusão
- AND continua existindo no banco com todos os campos

#### Scenario: Concluir direto de "A estudar"

- GIVEN um tópico em "A estudar"
- WHEN a profissional marca a conclusão
- THEN o tópico vai para "Concluídos" sem passar por "Em estudo"

#### Scenario: Reabrir

- GIVEN um tópico concluído em 14/06
- WHEN a profissional o reabre para "Em estudo"
- THEN ele volta à coluna "Em estudo" sem data de conclusão
- AND, se for concluído de novo, a data gravada é a da nova conclusão

#### Scenario: Instante definido pelo servidor

- GIVEN uma requisição de conclusão que traz um instante de conclusão no corpo
- WHEN o servidor a processa
- THEN o instante do corpo é ignorado e o gravado é o do servidor

#### Scenario: Foco depois de concluir pelo teclado

- GIVEN três tópicos em "A estudar" e o foco na caixa de conclusão do primeiro
- WHEN a profissional a marca com Espaço
- THEN o tópico vai para "Concluídos"
- AND o foco fica na caixa de conclusão do tópico que passou a ser o primeiro da
  coluna, e um novo Espaço o conclui também

#### Scenario: Foco quando a coluna esvazia

- GIVEN um único tópico em "Em estudo"
- WHEN a profissional o move para "Concluídos" pelo menu, usando o teclado
- THEN o foco vai para a coluna "Em estudo", agora vazia, e não para o início da
  página

#### Scenario: Movimento para o mesmo estado

- GIVEN um tópico em "Em estudo"
- WHEN chega uma requisição para movê-lo para "Em estudo"
- THEN a resposta é de sucesso, sem mudança
- AND o instante de conclusão de um tópico já concluído não é regravado

### Requirement: Arrastar entre colunas

A profissional SHALL poder mudar o status de um tópico arrastando o cartão de uma
coluna do quadro para outra, e a mudança MUST ser persistida no ato, com as
mesmas regras da mudança pelo cartão. Arrastar MUST NOT ser o único caminho: o
menu e a caixa de conclusão do cartão continuam disponíveis.

#### Scenario: Arrastar para "Em estudo"

- GIVEN um tópico em "A estudar"
- WHEN a profissional o arrasta e solta na coluna "Em estudo"
- THEN ele aparece em "Em estudo"
- AND, depois de recarregar a página, continua lá

#### Scenario: Arrastar para "Concluídos"

- GIVEN um tópico em "Em estudo"
- WHEN a profissional o solta em "Concluídos"
- THEN ele fica concluído, com o instante de conclusão definido pelo servidor

#### Scenario: Arrastar de volta de "Concluídos"

- GIVEN um tópico concluído
- WHEN a profissional o solta em "A estudar"
- THEN ele volta a "A estudar", sem instante de conclusão

#### Scenario: Menu e arrastar são equivalentes

- GIVEN dois tópicos iguais em "A estudar"
- WHEN um é movido para "Em estudo" pelo menu e o outro arrastando
- THEN os dois ficam no mesmo estado, pela mesma requisição

#### Scenario: Soltar fora de uma coluna

- GIVEN um tópico em "A estudar"
- WHEN a profissional o arrasta e o solta fora das colunas, ou na própria coluna
- THEN nada muda e nenhuma requisição de mudança de estado é feita

### Requirement: Quadro de estudos

O sistema SHALL apresentar os tópicos em três colunas ("A estudar", "Em estudo" e
"Concluídos"), cada uma com contador. O cabeçalho SHALL exibir o total de
pendentes (as duas primeiras colunas) e o de concluídos no mês corrente, no fuso
`America/Sao_Paulo`.

Nas duas colunas pendentes, a ordem MUST seguir a ordem da label (mais
prioritária primeiro), com os tópicos sem label por último e, dentro do mesmo
nível, os mais antigos primeiro.

A coluna "Concluídos" SHALL mostrar os cinco concluídos mais recentes e, quando
houver mais, um acesso ao histórico informando quantos ficaram de fora.

#### Scenario: Ordenação por prioridade

- GIVEN em "A estudar": um tópico sem label criado ontem, um "Baixa" criado hoje e
  um "Alta" criado hoje
- WHEN o quadro é aberto
- THEN a ordem é "Alta", "Baixa" e, por último, o tópico sem label

#### Scenario: Ordem segue a label, não o nome

- GIVEN a label "Alta" renomeada para "Urgente", sem mudar de ordem
- WHEN o quadro é aberto
- THEN os tópicos "Urgente" continuam no topo

#### Scenario: Contadores do cabeçalho

- GIVEN três tópicos em "A estudar", dois em "Em estudo", quatro concluídos neste
  mês e oito em meses anteriores
- WHEN o quadro é aberto
- THEN o cabeçalho mostra "5 pendentes · 4 concluídos este mês"
- AND a coluna "Concluídos" mostra o contador 12, cinco cartões e "+ 7 no
  histórico"

#### Scenario: Virada de mês no fuso local

- GIVEN um tópico concluído em 30/09 às 22h em São Paulo (01/10 em UTC)
- WHEN o quadro é aberto em 30/09
- THEN ele conta entre os concluídos deste mês

#### Scenario: Quadro vazio

- GIVEN nenhum tópico cadastrado
- WHEN o quadro é aberto
- THEN cada coluna mostra estado vazio
- AND a ação "+ Novo tópico" continua disponível

### Requirement: Histórico de concluídos

O sistema SHALL listar todos os tópicos concluídos, do mais recente para o mais
antigo, com título, label e data da conclusão, paginados em no máximo 50 por
página. Do histórico SHALL ser possível reabrir um tópico.

#### Scenario: Consulta do histórico

- GIVEN 60 tópicos concluídos
- WHEN a profissional abre o histórico
- THEN a primeira página mostra os 50 mais recentes
- AND a segunda mostra os outros 10

#### Scenario: Reabrir pelo histórico

- GIVEN o histórico aberto
- WHEN a profissional reabre um tópico para "A estudar"
- THEN ele sai do histórico e aparece na coluna "A estudar" do quadro

### Requirement: Labels de prioridade

O sistema SHALL manter labels de prioridade como entidade própria, com nome, cor
e ordem. A profissional SHALL poder criar, renomear, trocar a cor, reordenar e
excluir labels numa tela de gestão acessível pelo quadro.

O nome MUST ser obrigatório, com até 30 caracteres, e único sem diferenciar
maiúsculas de minúsculas nem acentos. A ordem MUST definir a prioridade: a
primeira label é a mais prioritária.

O sistema MUST vir com três labels: "Alta" (vinho), "Média" (âmbar) e "Baixa"
(musgo), nessa ordem.

#### Scenario: Labels iniciais

- GIVEN o sistema recém-instalado, com as migrations aplicadas
- WHEN a profissional abre a gestão de labels
- THEN existem "Alta", "Média" e "Baixa", nessa ordem e com essas cores

#### Scenario: Renomear

- GIVEN a label "Média" usada por três tópicos
- WHEN a profissional a renomeia para "Normal"
- THEN os três tópicos passam a exibir "Normal"

#### Scenario: Nome repetido

- GIVEN a label "Alta"
- WHEN a profissional cria ou renomeia outra para "alta" ou "ALTA"
- THEN a API responde `409`
- AND a interface informa que já existe uma label com esse nome

#### Scenario: Reordenar

- GIVEN as labels "Alta", "Média" e "Baixa", nessa ordem
- WHEN a profissional move "Baixa" para o topo
- THEN a ordem passa a ser "Baixa", "Alta" e "Média"
- AND o quadro reordena os tópicos pendentes de acordo

#### Scenario: Nova label entra no fim

- GIVEN três labels
- WHEN a profissional cria "Leitura leve"
- THEN ela é a quarta na ordem, até ser movida

### Requirement: Paleta fechada de cores

A cor de uma label MUST ser escolhida de uma paleta fechada de papéis de cor do
Raíz: `VINHO`, `AMBAR`, `MUSGO`, `MUSGO_SUAVE`, `MARROM` e `BEGE`. O banco MUST guardar
o nome do papel, nunca um valor hexadecimal. Cada papel MUST ser exibido com um
par de fundo e texto que tenha contraste de pelo menos 4,5:1.

#### Scenario: Cor fora da paleta

- GIVEN a gestão de labels
- WHEN chega uma requisição com cor `#FF00FF` ou `ROXO`
- THEN a API responde `422` apontando `cor`

#### Scenario: Seletor restrito

- GIVEN o formulário de label
- WHEN a profissional escolhe a cor
- THEN o seletor oferece só os seis papéis da paleta, cada um com amostra e nome
- AND não há campo de cor livre

#### Scenario: Cor não é o único sinal

- GIVEN um cartão de tópico com label
- WHEN ele é exibido
- THEN o nome da label aparece escrito no pill, e não só a cor

### Requirement: Exclusão de label em uso bloqueada

O sistema MUST recusar a exclusão de uma label que esteja associada a algum
tópico, em qualquer estado, concluídos inclusive. Uma label sem tópicos SHALL
poder ser excluída.

#### Scenario: Label em uso

- GIVEN a label "Média" usada por dois tópicos pendentes e um concluído
- WHEN a profissional tenta excluí-la
- THEN a API responde `409` com a quantidade de tópicos que a usam (3)
- AND a interface explica que é preciso trocar a prioridade desses tópicos antes
- AND a label e os tópicos ficam inalterados

#### Scenario: Label livre

- GIVEN uma label que nenhum tópico usa
- WHEN a profissional a exclui e confirma
- THEN ela some da gestão e do seletor do formulário de tópico
- AND as demais labels mantêm a ordem relativa

#### Scenario: Corrida com associação

- GIVEN uma label sem tópicos
- WHEN um tópico é associado a ela entre a abertura do diálogo de exclusão e a
  confirmação
- THEN a exclusão é recusada com `409`, e o banco garante isso
