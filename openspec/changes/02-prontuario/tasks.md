# Tasks

## 1. Modelo e guarda

- [ ] 1.1 Modelos `Evolucao` e `RascunhoEvolucao` no Prisma, com migration
- [ ] 1.2 Aplicar a coluna criptografada da 01 aos campos de texto — reutilizar, não duplicar
- [ ] 1.3 `comum/guarda/`: função pura de cálculo de elegibilidade, recebendo último registro e nascimento
- [ ] 1.4 `GUARDA_PRONTUARIO_ANOS` em config, padrão 20, boot recusado abaixo de 5
- [ ] 1.5 Teste da função de guarda: caso comum, paciente que era menor, reativação com novo registro
- [ ] 1.6 Teste de boot recusado com prazo inválido

## 2. Evolução

- [ ] 2.1 Schemas Zod de evolução em `packages/shared`
- [ ] 2.2 `POST /pacientes/:id/evolucoes` com data e hora do servidor, vínculo opcional ao atendimento
- [ ] 2.3 `GET /pacientes/:id/evolucoes`, carregando texto sob demanda
- [ ] 2.4 Recusa de evolução para paciente arquivado
- [ ] 2.5 Evento `EVOLUCAO_LISTADA` ao abrir a lista, sem decifrar texto
- [ ] 2.6 Evento `EVOLUCAO_LIDA` emitido pelo serviço de criptografia ao decifrar, não pelo controller
- [ ] 2.7 Teste: texto ilegível ao ler a coluna direto no Postgres
- [ ] 2.8 Teste: abrir a lista gera `EVOLUCAO_LISTADA` e nenhum `EVOLUCAO_LIDA`
- [ ] 2.9 Teste: abrir uma evolução gera exatamente um `EVOLUCAO_LIDA` para aquele id

## 3. Retificação

- [ ] 3.1 `POST /evolucoes/:id/retificar` transacional: anterior recebe `vigente = false`, nova encadeia
- [ ] 3.2 `GET /evolucoes/:id/historico` devolvendo a cadeia completa em ordem cronológica
- [ ] 3.3 Confirmar ausência de `PATCH` e `DELETE` em `/evolucoes/:id`
- [ ] 3.4 Teste: cadeia íntegra após duas retificações
- [ ] 3.5 Teste: pedido de exclusão recusado

## 4. Rascunho

- [ ] 4.1 `PUT`, `GET` e `DELETE` de `/prontuario/rascunho`, texto criptografado
- [ ] 4.2 Unicidade por paciente e atendimento
- [ ] 4.3 Remoção do rascunho ao gravar a evolução correspondente
- [ ] 4.4 Teste: rascunho sobrevive a sessão expirada e reautenticação
- [ ] 4.5 Teste: rascunho não reaparece depois de consumido

## 5. Exportação

- [ ] 5.1 Geração de PDF no servidor com cadastro, atendimentos e todas as versões de evolução
- [ ] 5.2 Rodapé com data de emissão, identificação da profissional e aviso de sigilo
- [ ] 5.3 Versões marcadas como vigente ou retificada
- [ ] 5.4 Paciente sem evolução gera PDF indicando a ausência
- [ ] 5.5 Exportação registrada na auditoria, com `EVOLUCAO_LIDA` para cada evolução incluída
- [ ] 5.6 Download servido pelo BFF, sem expor a API

## 6. Telas

- [ ] 6.1 Rota `pacientes/[id]/prontuario` dentro do shell existente
- [ ] 6.2 Lista de evoluções com data, vínculo ao atendimento e indicação de retificação
- [ ] 6.3 Editor em `textarea`, sem editor rico, com indicador de rascunho salvo
- [ ] 6.4 Recuperação de rascunho oferecida ao abrir, com opção de descartar
- [ ] 6.5 Fluxo de retificação com a versão anterior visível ao lado
- [ ] 6.6 Histórico de versões de uma evolução
- [ ] 6.7 Botão de exportar prontuário
- [ ] 6.8 No perfil do paciente: acesso ao prontuário, contagem e data da evolução mais recente
- [ ] 6.9 No perfil de paciente arquivado: data de elegibilidade e prazo que a originou
- [ ] 6.10 Rodar o script de comparação visual contra o `design-ref`

## 7. Backup

- [ ] 7.1 Serviço de `pg_dump` agendado em container próprio
- [ ] 7.2 Cifragem da saída com chave guardada fora do servidor de aplicação
- [ ] 7.3 Log de execução
- [ ] 7.4 Restaurar em banco limpo e confirmar que as evoluções voltam legíveis
- [ ] 7.5 Procedimento de restauração documentado no README

## 8. Fechamento

- [ ] 8.1 Conferir cada cenário das duas delta specs contra o comportamento real
- [ ] 8.2 Confirmar que a rota de prontuário não é cacheada
- [ ] 8.3 `pnpm -r test` e `pnpm -r build`
- [ ] 8.4 `openspec validate 02-prontuario`