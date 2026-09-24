# Proposal: Prontuário

## Why

A `01-fundacao` entregou paciente, agenda e — por causa do campo de motivo de
atendimento — criptografia de coluna e auditoria já funcionando. Falta o registro
que dá sentido a tudo isso: a evolução clínica.

Esta change entrega escrita e leitura de evolução, retificação com histórico,
exportação do prontuário completo e a rotina de backup. É a change de maior risco
regulatório do projeto, e a única onde uma decisão errada de modelagem vira
problema ético e não apenas técnico.

## What Changes

Incluído:

- Evolução vinculada ao paciente e, quando houver, ao atendimento que a originou.
- Escrita com data e hora automáticas, não editáveis.
- Retificação versionada: a versão anterior nunca é apagada nem sobrescrita.
- Rascunho persistido no servidor, criptografado, para não perder texto longo.
- Exportação do prontuário completo do paciente em PDF.
- Rotina de backup do banco, criptografada e testada por restauração.
- Data de elegibilidade para descarte exibida no perfil do paciente.

Excluído:

- Expurgo automático. O sistema calcula e exibe a data; quem apaga é a
  profissional, deliberadamente. Automatizar destruição de prontuário é risco sem
  contrapartida.
- Adaptação para celular. Telas nascem desktop; a change 06 adapta.
- Modelos estruturados de evolução (SOAP, DAP). Texto livre na v1.

## Abordagem

A criptografia de coluna e o interceptor de auditoria já existem desde a 01. Esta
change os reutiliza em vez de criar caminho novo — se a evolução precisar de
tratamento especial de cripto, é sinal de que a abstração da 01 ficou errada e o
lugar de consertar é lá.

Retificação segue o mesmo padrão que a remarcação de atendimento: não edita,
encerra e encadeia. A consistência entre os dois vale mais do que otimizar cada
caso isoladamente.

A ordem é servidor antes de tela, como na 01, e o editor vem por último, porque é
a parte que mais se beneficia de ver o modelo funcionando.

## Riscos

- **Perda de texto longo.** Evolução é o único lugar da aplicação onde a pessoa
  digita por vários minutos. Perder isso por sessão expirada ou aba fechada é o
  pior defeito possível desta change, e a razão do rascunho persistido.
- **Rascunho como vazamento.** A saída óbvia seria `localStorage`, que gravaria
  texto clínico em claro no navegador — exatamente o que a criptografia de coluna
  existe para impedir. Por isso o rascunho vai para o servidor, criptografado.
- **PDF como cópia não rastreada.** Exportar é requisito legítimo, mas gera um
  arquivo fora do controle do sistema. A exportação é auditada e o PDF traz
  marcação de origem e data.
- **Backup não testado.** Backup que nunca foi restaurado não é backup. A tarefa
  de restauração é obrigatória, não opcional.