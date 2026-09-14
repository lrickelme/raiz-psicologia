# Delta for Plataforma

> A profissional usa o sistema como aplicativo instalado na tela de início do
> iPhone. Celular não é uso secundário: é o uso principal fora do consultório.
> Toda tela nasce funcionando em 390px de largura.

## ADDED Requirements

### Requirement: Layout mobile-first

O sistema MUST ser construído a partir da largura de 390px e expandir para telas
maiores, nunca o contrário. Nenhuma tela SHALL exigir rolagem horizontal em
qualquer largura a partir de 320px.

#### Scenario: Shell em tela estreita

- GIVEN a aplicação aberta em viewport de 390px
- WHEN qualquer rota autenticada é renderizada
- THEN a sidebar dá lugar a navegação inferior ou gaveta acionável
- AND o conteúdo ocupa a largura disponível sem corte lateral

#### Scenario: Shell em tela ampla

- GIVEN a aplicação aberta em viewport de 1280px
- WHEN qualquer rota autenticada é renderizada
- THEN a sidebar persistente do guia Raíz é exibida
- AND o conteúdo respeita a largura máxima definida nos tokens

#### Scenario: Tabelas e listagens

- GIVEN a listagem de pacientes em viewport de 390px
- WHEN a lista é renderizada
- THEN cada paciente aparece como card empilhado, não como linha de tabela
- AND nenhuma coluna é ocultada a ponto de esconder nome ou telefone

### Requirement: Instalação na tela de início

O sistema SHALL ser instalável como aplicativo na tela de início do iOS e do
Android, por meio de web app manifest. Uma vez instalado, MUST abrir em modo
standalone, sem barra de endereço do navegador.

#### Scenario: Instalação no iPhone

- GIVEN a aplicação aberta no Safari do iOS
- WHEN a profissional usa "Adicionar à Tela de Início"
- THEN o ícone instalado usa o ícone do Raíz, não uma captura da página
- AND o nome exibido é "Raíz"
- AND abrir o ícone inicia em modo standalone

#### Scenario: Áreas seguras

- GIVEN a aplicação em modo standalone em iPhone com notch
- WHEN qualquer tela é renderizada
- THEN nenhum conteúdo ou controle fica sob o notch ou sob o indicador inferior
- AND a cor de fundo das áreas seguras acompanha o tema Raíz

#### Scenario: Sem rede

- GIVEN a aplicação instalada e aberta sem conexão
- WHEN a profissional navega para qualquer tela
- THEN o shell é exibido com aviso claro de ausência de conexão
- AND a aplicação não mostra tela em branco nem erro genérico do navegador

### Requirement: Interação por toque

O sistema MUST NOT depender de `hover` para revelar ação ou informação
essencial. Todo alvo tocável SHALL ter no mínimo 44 por 44 pixels de área
efetiva.

#### Scenario: Ação sem hover

- GIVEN um card de paciente ou de atendimento
- WHEN a interface é usada por toque
- THEN todas as ações do item são alcançáveis sem passar o cursor
- AND estão visíveis ou atrás de um controle explícito

#### Scenario: Reagendar por toque

- GIVEN um atendimento `AGENDADO` exibido em viewport de 390px
- WHEN a profissional quer movê-lo de horário
- THEN existe caminho por toque que não depende de arrastar
- AND o resultado é idêntico ao do reagendamento por arrastar no desktop

#### Scenario: Campos de formulário

- GIVEN um formulário aberto no iPhone
- WHEN um campo recebe foco
- THEN o teclado apresentado corresponde ao tipo do campo
- AND o campo focado não fica encoberto pelo teclado

### Requirement: Agenda em tela estreita

O sistema MUST colapsar a visão semanal para a visão diária abaixo de 768px de
largura. A visão semanal em coluna estreita produz células ilegíveis e é pior do
que não oferecer a visão.

#### Scenario: Colapso automático

- GIVEN a agenda com visão semanal como preferência salva
- WHEN é aberta em viewport de 390px
- THEN a visão diária é exibida
- AND a preferência de visão semanal é preservada para quando voltar ao desktop

#### Scenario: Visão mensal no celular

- GIVEN a agenda em viewport de 390px
- WHEN a visão mensal é selecionada
- THEN cada dia mostra apenas indicador de quantidade de atendimentos
- AND tocar um dia abre a visão diária correspondente

### Requirement: Sessão compatível com uso diário em celular

O sistema SHALL distinguir expiração por inatividade de expiração absoluta. A
sessão MUST expirar após 30 minutos de inatividade **com a aplicação em
primeiro plano**, mas o cookie SHALL permanecer válido por até 7 dias, de modo
que reabrir o app instalado não exija digitar senha a cada uso.

O requisito de 30 minutos existe para proteger a tela exposta no consultório, não
para punir quem abre o app cinco vezes por dia. Tratar os dois casos com o mesmo
prazo tornaria o aplicativo inutilizável no celular e empurraria a profissional
para uma senha curta.

#### Scenario: Reabertura do app instalado

- GIVEN uma sessão iniciada há dois dias, sem uso desde ontem
- WHEN a profissional abre o app pela tela de início
- THEN a aplicação abre autenticada
- AND a contagem de inatividade em primeiro plano recomeça

#### Scenario: Tela esquecida aberta

- GIVEN o app aberto e em primeiro plano, sem interação há 30 minutos
- WHEN a profissional volta ao dispositivo
- THEN a aplicação exibe tela de bloqueio exigindo reautenticação

#### Scenario: Limite absoluto

- GIVEN uma sessão iniciada há mais de 7 dias
- WHEN a profissional abre o app
- THEN é exigido login completo, independentemente de uso recente