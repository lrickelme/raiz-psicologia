# Tasks

## 1. Modelo e guarda

- [x] 1.1 Modelos `Evolucao` e `RascunhoEvolucao` no Prisma, com migration
- [x] 1.2 Aplicar a coluna criptografada da 01 aos campos de texto — reutilizar, não duplicar
- [x] 1.3 `comum/guarda/`: função pura de cálculo de elegibilidade, recebendo último registro e nascimento
- [x] 1.4 `GUARDA_PRONTUARIO_ANOS` em config, padrão 20, boot recusado abaixo de 5
- [x] 1.5 Teste da função de guarda: caso comum, paciente que era menor, reativação com novo registro
- [x] 1.6 Teste de boot recusado com prazo inválido

## 2. Evolução

- [x] 2.1 Schemas Zod de evolução em `packages/shared`
- [x] 2.2 `POST /pacientes/:id/evolucoes` com data e hora do servidor, vínculo opcional ao atendimento
- [x] 2.3 `GET /pacientes/:id/evolucoes`, carregando texto sob demanda
- [x] 2.4 Recusa de evolução para paciente arquivado
- [x] 2.5 Evento `EVOLUCAO_LISTADA` ao abrir a lista, sem decifrar texto
- [x] 2.6 Evento `EVOLUCAO_LIDA` emitido pelo serviço de criptografia ao decifrar, não pelo controller
- [x] 2.7 Teste: texto ilegível ao ler a coluna direto no Postgres
- [x] 2.8 Teste: abrir a lista gera `EVOLUCAO_LISTADA` e nenhum `EVOLUCAO_LIDA`
- [x] 2.9 Teste: abrir uma evolução gera exatamente um `EVOLUCAO_LIDA` para aquele id

## 3. Retificação

- [x] 3.1 `POST /evolucoes/:id/retificar` transacional: anterior recebe `vigente = false`, nova encadeia
- [x] 3.2 `GET /evolucoes/:id/historico` devolvendo a cadeia completa em ordem cronológica
- [x] 3.3 Confirmar ausência de `PATCH` e `DELETE` em `/evolucoes/:id`
- [x] 3.4 Teste: cadeia íntegra após duas retificações
- [x] 3.5 Teste: pedido de exclusão recusado

## 4. Rascunho

- [x] 4.1 `PUT`, `GET` e `DELETE` de `/prontuario/rascunho`, texto criptografado
- [x] 4.2 Unicidade por paciente e atendimento
- [x] 4.3 Remoção do rascunho ao gravar a evolução correspondente
- [x] 4.4 Teste: rascunho sobrevive a sessão expirada e reautenticação
- [x] 4.5 Teste: rascunho não reaparece depois de consumido

## 5. Exportação

- [x] 5.1 Geração de PDF no servidor com cadastro, atendimentos e todas as versões de evolução
- [x] 5.2 Rodapé com data de emissão, identificação da profissional e aviso de sigilo
- [x] 5.3 Versões marcadas como vigente ou retificada
- [x] 5.4 Paciente sem evolução gera PDF indicando a ausência
- [x] 5.5 Exportação registrada na auditoria, com `EVOLUCAO_LIDA` para cada evolução incluída
- [x] 5.6 Download servido pelo BFF, sem expor a API

## 6. Telas

- [x] 6.1 Rota `pacientes/[id]/prontuario` dentro do shell existente
- [x] 6.2 Lista de evoluções com data, vínculo ao atendimento e indicação de retificação
- [x] 6.3 Editor em `textarea`, sem editor rico, com indicador de rascunho salvo
- [x] 6.4 Recuperação de rascunho oferecida ao abrir, com opção de descartar
- [x] 6.5 Fluxo de retificação com a versão anterior visível ao lado
- [x] 6.6 Histórico de versões de uma evolução
- [x] 6.7 Botão de exportar prontuário
- [x] 6.8 No perfil do paciente: acesso ao prontuário, contagem e data da evolução mais recente
- [x] 6.9 No perfil de paciente arquivado: data de elegibilidade e prazo que a originou
- [x] 6.10 Rodar o script de comparação visual contra o `design-ref`
- [x] 6.11 Cancelar o salvamento de rascunho agendado e aguardar o que está em
      voo antes de gravar a evolução; nenhum rascunho residual após gravar
- [x] 6.12 Tratar 401 no editor sem navegar para o login — nem pelo `chamarApi`
      nem pelo aviso de expiração global: reter o texto em memória,
      reautenticar em modal e restaurar o conteúdo integral
- [x] 6.13 Teste: gravar com salvamento em voo não recria rascunho
- [x] 6.14 Teste: 401 durante a edição preserva o trecho posterior ao último
      salvamento
- [x] 6.15 Teste: nada de texto clínico em localStorage, sessionStorage ou
      IndexedDB após um 401
- [x] 6.16 Infraestrutura de teste ponta a ponta no web (Playwright), onde rodam
      6.13–6.15

## 7. Backup

- [x] 7.1 Serviço de `pg_dump` agendado em container próprio
- [x] 7.2 Cifragem da saída com chave guardada fora do servidor de aplicação
- [x] 7.3 Log de execução
- [x] 7.4 Restaurar em banco limpo e confirmar que as evoluções voltam legíveis
- [x] 7.5 Procedimento de restauração documentado no README

## 8. Fechamento

- [x] 8.1 Conferir cada cenário das duas delta specs contra o comportamento real
- [x] 8.2 Confirmar que a rota de prontuário não é cacheada
- [x] 8.3 `pnpm -r test` e `pnpm -r build`
- [x] 8.4 `openspec validate 02-prontuario`
## 9. Telefone

- [x] 9.1 Schema Zod de telefone em packages/shared: normaliza para dígitos,
      descarta prefixo 55 quando restarem 12 ou 13 dígitos, exige 10 ou 11
- [x] 9.2 Formatador de exibição compartilhado, usado na listagem e no perfil
- [x] 9.3 Componente de campo com máscara progressiva, backspace por dígito e
      cursor estável
- [x] 9.4 Busca por telefone normalizando termo e dado
- [x] 9.5 Migration normalizando os registros existentes
- [x] 9.6 Teste da normalização: com máscara, com +55, com espaços, com 10 e 11
      dígitos, com quantidade inválida
- [x] 9.7 Teste da busca com termo mascarado e termo cru
