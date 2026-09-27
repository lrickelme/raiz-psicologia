import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hojeLocal, instanteLocal, somarDias } from "@raiz/shared";
import { CAMPOS_CRIPTOGRAFADOS } from "../src/comum/criptografia/campos";
import { carregarChave } from "../src/comum/criptografia/cifra";
import { criptografiaDeColuna } from "../src/comum/criptografia/extensao";

/**
 * Evoluções fictícias de desenvolvimento, em linha de Terapia
 * Cognitivo-Comportamental, para os pacientes que já estão no banco. Textos
 * inventados, sem relação com pessoa real.
 *
 * Grava pela extensão de criptografia, como o `seed-dev`: o texto chega
 * cifrado à coluna e nenhuma trilha de auditoria é gerada. Diferente da API,
 * a data do registro é retroativa — só assim o prontuário de desenvolvimento
 * tem histórico. Cada evolução se liga a um atendimento realizado quando há;
 * as demais entram como avulsas, uma por semana antes dele.
 *
 * Evolução é imutável: paciente com 4 ou mais evoluções é pulado, para que
 * rodar de novo não duplique. Desfazer só com `pnpm seed:dev --recriar`.
 */
const prisma = new PrismaClient().$extends(
  criptografiaDeColuna(CAMPOS_CRIPTOGRAFADOS, carregarChave()),
);

const SESSOES = 4;

type Plano = {
  foco: string;
  sessoes: [string, string, string, string];
  /** Retificação de uma das sessões: a versão original tinha um erro de registro. */
  retificacao?: { sessao: number; original: string };
};

const PLANOS: Plano[] = [
  {
    foco: "Ansiedade generalizada",
    sessoes: [
      "Sessão de avaliação. Queixa principal de preocupação excessiva e difícil de controlar, sobretudo com trabalho e saúde dos pais, há cerca de um ano. Relata tensão muscular, irritabilidade e sono fragmentado. Psicoeducação sobre o modelo cognitivo e o ciclo da ansiedade. Metas acordadas: reduzir o tempo diário de preocupação e retomar atividade física. Tarefa: automonitoramento das preocupações (situação, pensamento, intensidade 0–10).",
      "Revisão do automonitoramento: preocupações concentradas no fim do dia, intensidade média 6/10. Identificadas distorções de catastrofização e subestimação da própria capacidade de enfrentamento. Introduzido o Registro de Pensamentos Disfuncionais com exemplo trazido pela paciente (e-mail da chefia interpretado como sinal de demissão). Tarefa: RPD diário e 'horário da preocupação' de 20 minutos.",
      "Paciente trouxe cinco RPDs preenchidos. Trabalhada a distinção entre preocupações produtivas e improdutivas; aplicada técnica de resolução de problemas para uma questão real (reorganização de prazos). Relata que o horário da preocupação reduziu a ruminação noturna. Iniciado treino de respiração diafragmática. Tarefa: manter RPD e praticar respiração duas vezes ao dia.",
      "Revisão de progresso: intensidade média das preocupações caiu para 3–4/10; voltou a caminhar três vezes por semana. Reconhece com mais facilidade a catastrofização e gera pensamentos alternativos. Discutidos sinais de alerta de recaída e estratégias já aprendidas. Combinado espaçar as sessões para quinzenais no próximo mês.",
    ],
    retificacao: {
      sessao: 1,
      original:
        "Revisão do automonitoramento: preocupações concentradas no fim do dia, intensidade média 8/10. Identificadas distorções de catastrofização e subestimação da própria capacidade de enfrentamento. Introduzido o Registro de Pensamentos Disfuncionais. Tarefa: RPD diário e 'horário da preocupação' de 20 minutos.",
    },
  },
  {
    foco: "Episódio depressivo leve a moderado",
    sessoes: [
      "Sessão de avaliação. Relata humor deprimido, perda de interesse por atividades antes prazerosas e isolamento social há quatro meses, após mudança de cidade. Nega ideação suicida; combinado reavaliar a cada sessão. Psicoeducação sobre a relação entre inatividade e humor. Tarefa: registro de atividades diárias com notas de prazer e domínio (0–10).",
      "Registro de atividades mostra longos períodos na cama e no celular, com prazer baixo. Introduzida ativação comportamental: selecionadas três atividades de baixo custo (caminhada curta, ligar para um amigo, cozinhar). Pensamento automático recorrente: 'não adianta, nada vai mudar'. Tarefa: agendar as três atividades na semana e registrar o humor antes e depois.",
      "Realizou duas das três atividades; humor após a caminhada subiu de 3 para 6. Trabalhada a crença 'não tenho energia para nada' com exame de evidências a partir do próprio registro. Identificados padrões de pensamento dicotômico. Mantém negação de ideação suicida. Tarefa: ampliar para cinco atividades e iniciar RPD em momentos de queda de humor.",
      "Relata melhora do ânimo e retomada de contato com dois amigos. Frequenta a academia do prédio duas vezes por semana. RPDs mostram maior flexibilidade para gerar interpretações alternativas. Revisados ganhos e plano para semanas difíceis (lista de atividades de ativação e pessoas de apoio). Próximo foco: crenças sobre desempenho no novo trabalho.",
    ],
  },
  {
    foco: "Transtorno de pânico",
    sessoes: [
      "Sessão de avaliação. Crises de início súbito com taquicardia, falta de ar e medo de morrer, três episódios no último mês; passou a evitar metrô e academia. Exames cardiológicos recentes normais. Psicoeducação sobre a resposta de luta ou fuga e o ciclo do pânico (sensação corporal, interpretação catastrófica, aumento da ansiedade). Tarefa: diário de crises e de situações evitadas.",
      "Diário registra uma crise no fim de semana, precedida por café em excesso e noite mal dormida. Identificada a interpretação 'meu coração vai parar' diante da taquicardia. Reestruturação cognitiva com exame de evidências (exames normais, crises anteriores terminaram sem dano). Construída hierarquia de situações evitadas. Tarefa: reduzir cafeína e ler material psicoeducativo.",
      "Iniciada exposição interoceptiva em sessão: hiperventilação por 60 segundos e corrida estacionária, com ansiedade de pico 7/10 caindo para 3/10 em poucos minutos. Paciente observou que as sensações são desconfortáveis mas não perigosas. Tarefa: repetir os exercícios em casa e primeiro item da hierarquia (uma estação de metrô acompanhado).",
      "Realizou a exposição de uma estação sozinho, ansiedade máxima 5/10. Nenhuma crise completa nas últimas duas semanas. Relata menor vigilância das sensações cardíacas. Planejados os próximos degraus da hierarquia (trajeto completo, academia em horário de pico) e revisada a prevenção de recaída.",
    ],
  },
  {
    foco: "Ansiedade social",
    sessoes: [
      "Sessão de avaliação. Intenso medo de avaliação negativa em reuniões e situações sociais; evita apresentar trabalhos e almoçar com colegas. Relata rubor e tremor nas mãos quando precisa falar. Psicoeducação sobre o modelo cognitivo da ansiedade social, incluindo foco de atenção em si e comportamentos de segurança. Tarefa: listar situações temidas com nota de ansiedade.",
      "Montada hierarquia de exposição a partir da lista. Identificados comportamentos de segurança (ensaiar frases, evitar contato visual, segurar o copo com as duas mãos). Pensamento central: 'vão perceber que estou nervosa e achar que sou incompetente'. Planejado experimento comportamental: fazer uma pergunta na reunião semanal sem ensaiar.",
      "Realizou o experimento: fez a pergunta, ansiedade 7/10 antes e 4/10 depois; ninguém comentou o nervosismo. Discutida a diferença entre a previsão e o resultado. Trabalhado o deslocamento do foco de atenção para a tarefa e para o interlocutor. Tarefa: almoçar com colegas uma vez e reduzir um comportamento de segurança.",
      "Almoçou com a equipe duas vezes e apresentou um relatório curto em reunião. Reconhece que superestimava o quanto os outros notam seus sinais de ansiedade. Revisada a hierarquia: próximos passos incluem apresentação mais longa e evento social fora do trabalho. Autoavaliação de progresso: 'mais confiante, ainda desconfortável'.",
    ],
  },
  {
    foco: "Insônia (TCC-I)",
    sessoes: [
      "Sessão de avaliação. Dificuldade para iniciar o sono há oito meses, latência de 60 a 90 minutos, com despertares e cansaço diurno. Passa longos períodos na cama tentando dormir e usa o celular até tarde. Psicoeducação sobre regulação do sono e o condicionamento cama–vigília. Tarefa: diário de sono por duas semanas.",
      "Diário de sono: tempo médio na cama de 9 horas para cerca de 5h30 de sono, eficiência próxima de 60%. Introduzidas regras de controle de estímulos (cama só para dormir, levantar após 20 minutos acordado, horário fixo para acordar). Definida janela de sono inicial de 6 horas. Tarefa: seguir as regras e manter o diário.",
      "Relata sonolência diurna nos primeiros dias da restrição, já em redução. Eficiência do sono subiu para 82%. Trabalhados pensamentos disfuncionais sobre o sono ('se eu não dormir oito horas, amanhã vai ser um desastre') com reestruturação cognitiva. Ampliada a janela de sono em 15 minutos. Tarefa: manter o protocolo e rotina de desaceleração sem telas.",
      "Latência média caiu para cerca de 20 minutos e os despertares diminuíram. Eficiência do sono acima de 85% por duas semanas. Paciente relata menos preocupação ao deitar. Revisado o plano de manutenção e o que fazer em noites ruins eventuais, sem voltar a ficar na cama acordado.",
    ],
    retificacao: {
      sessao: 0,
      original:
        "Sessão de avaliação. Dificuldade para manter o sono há oito meses, com despertares frequentes e cansaço diurno. Passa longos períodos na cama tentando dormir e usa o celular até tarde. Psicoeducação sobre regulação do sono. Tarefa: diário de sono por duas semanas.",
    },
  },
  {
    foco: "Perfeccionismo e esgotamento no trabalho",
    sessoes: [
      "Sessão de avaliação. Relata exaustão, dificuldade de desligar do trabalho e sensação de nunca fazer o suficiente. Trabalha frequentemente até tarde revisando entregas já concluídas. Psicoeducação sobre perfeccionismo disfuncional e custo das regras rígidas. Tarefa: registrar situações em que revisa ou refaz tarefas e o que teme que aconteça se não o fizer.",
      "Registro revela regras do tipo 'devo entregar tudo impecável' e 'se eu errar, vão perder a confiança em mim'. Identificadas distorções de pensamento tudo ou nada e desqualificação do positivo. Elaborada análise de vantagens e desvantagens da regra atual. Tarefa: experimento de entregar uma tarefa de baixo risco com uma revisão só.",
      "Entregou dois relatórios com uma revisão; nenhum retorno negativo. Paciente surpreso com a diferença entre a previsão e o resultado. Trabalhada a reformulação da regra para uma versão flexível ('posso ter padrões altos e aceitar margem de erro'). Iniciado planejamento de pausas e limite de horário. Tarefa: encerrar o expediente até as 19h em três dias.",
      "Cumpriu o limite de horário em quatro dias e retomou o violão à noite. Relata menos exaustão e culpa menor ao encerrar o dia. Revisadas as crenças intermediárias trabalhadas e os sinais de retorno ao padrão perfeccionista. Próximo foco: dificuldade em delegar tarefas à equipe.",
    ],
  },
  {
    foco: "Sintomas obsessivo-compulsivos de contaminação",
    sessoes: [
      "Sessão de avaliação. Pensamentos intrusivos de contaminação ao tocar maçanetas e dinheiro, seguidos de lavagem das mãos por vários minutos, cerca de duas horas por dia. Reconhece o exagero, mas relata forte desconforto se não lavar. Psicoeducação sobre o ciclo obsessão–compulsão e o papel do alívio temporário. Tarefa: registrar obsessões, compulsões e tempo gasto.",
      "Registro confirma cerca de 25 lavagens diárias. Construída hierarquia de exposição com prevenção de resposta (EPR), do item menos ao mais ansiogênico. Trabalhada a superestimação da ameaça e a intolerância à incerteza. Primeira exposição em sessão: tocar a maçaneta do consultório e adiar a lavagem por 15 minutos; ansiedade de 6 para 3.",
      "Realizou exposições diárias aos dois primeiros itens da hierarquia. Lavagens reduzidas para cerca de 15 por dia. Identificado o comportamento de neutralização mental ('está tudo bem, está tudo bem') como compulsão encoberta, combinada a sua redução. Tarefa: avançar para manusear dinheiro e adiar a lavagem por 30 minutos.",
      "Consegue manusear dinheiro e fazer compras sem lavagem imediata. Tempo diário com rituais estimado em 40 minutos. Relata mais tempo livre e menos conflito com a família. Revisados princípios da EPR para uso autônomo e planejados os itens restantes (banheiro público, transporte coletivo).",
    ],
  },
  {
    foco: "Baixa autoestima e crença central de inadequação",
    sessoes: [
      "Sessão de avaliação. Autocrítica intensa, comparação constante com outras pessoas e dificuldade em aceitar elogios. Relata sentir-se 'menos capaz' desde a adolescência. Psicoeducação sobre crenças centrais e como filtram a percepção de experiências. Tarefa: anotar autocríticas ao longo da semana.",
      "Autocríticas giram em torno de 'não sou bom o suficiente'. Construída a conceitualização cognitiva ligando experiências escolares, a crença central e as regras atuais ('só tenho valor se agradar a todos'). Introduzido o diário de dados positivos. Tarefa: registrar diariamente três evidências contrárias à crença.",
      "Diário de dados positivos com vinte registros, a maioria desqualificada inicialmente ('isso qualquer um faz'). Trabalhada a desqualificação do positivo. Aplicada técnica do continuum para a crença de inadequação: posicionou-se em 30 no início e em 55 ao fim da sessão. Tarefa: manter o diário e anotar elogios recebidos sem minimizá-los.",
      "Relata aceitar elogios com menos desconforto e menor frequência de comparações. Crença alternativa em construção: 'tenho qualidades e limitações, como qualquer pessoa', grau de crença 50%. Revisada a conceitualização com os avanços. Próximo foco: assertividade em situações de discordância.",
    ],
  },
  {
    foco: "Luto com ruminação e culpa",
    sessoes: [
      "Sessão de avaliação. Perda do pai há sete meses, após internação prolongada. Relata tristeza intensa, pensamentos repetitivos sobre o que poderia ter feito diferente e afastamento de atividades sociais. Acolhimento e psicoeducação sobre o processo de luto e a diferença entre recordar e ruminar. Tarefa: registrar momentos de ruminação e o que os antecede.",
      "Ruminações concentradas à noite, centradas em 'eu devia ter insistido para ele ir ao médico antes'. Trabalhado o viés retrospectivo com exame de evidências sobre o que se sabia na época. Técnica do gráfico de responsabilidade: a culpa atribuída a si caiu de 80% para 35%. Tarefa: carta ao pai, a ser lida na próxima sessão.",
      "Leitura da carta com forte emoção; paciente relatou alívio. Iniciada ativação comportamental com atividades significativas, incluindo retomar a horta que cultivava com o pai. Combinado tempo delimitado para recordações, reduzindo a ruminação à noite. Tarefa: duas atividades de ativação e registro do humor.",
      "Retomou a horta e um encontro semanal com a irmã. Ruminação noturna menos frequente; tristeza presente, porém com mais espaço para lembranças afetuosas. Revisadas as estratégias e datas potencialmente difíceis (aniversário de morte, festas de fim de ano), com plano de enfrentamento para cada uma.",
    ],
  },
  {
    foco: "Fobia específica de dirigir",
    sessoes: [
      "Sessão de avaliação. Evita dirigir há dois anos, após uma colisão leve sem feridos. Depende de terceiros para deslocamentos e relata prejuízo no trabalho. Ansiedade de 9/10 só de imaginar a direção em via movimentada. Psicoeducação sobre esquiva e manutenção do medo. Tarefa: listar situações de direção em ordem de dificuldade.",
      "Montada hierarquia de exposição com dez degraus, de sentar no carro parado até dirigir em avenida no horário de pico. Identificadas previsões catastróficas ('vou perder o controle e causar um acidente'). Exposição imaginária em sessão, ansiedade de 7 para 4. Tarefa: primeiros degraus (sentar no carro e dar partida) diariamente.",
      "Completou os três primeiros degraus e dirigiu no quarteirão com acompanhante, ansiedade máxima 6/10. Discutida a diferença entre a previsão catastrófica e o ocorrido. Trabalhados comportamentos de segurança (segurar o volante com força excessiva, evitar o retrovisor). Tarefa: trajeto curto em rua residencial três vezes na semana.",
      "Dirigiu sozinha até a padaria do bairro e em rua de movimento moderado. Ansiedade antecipatória reduziu. Reconhece a evitação como fator de manutenção do medo. Planejados os degraus finais (avenida e estacionamento de shopping) e revisado como lidar com um eventual trajeto difícil sem voltar a evitar.",
    ],
  },
  {
    foco: "Irritabilidade e conflitos no relacionamento",
    sessoes: [
      "Sessão de avaliação. Episódios de irritabilidade com discussões frequentes com a companheira, seguidos de arrependimento. Relata que 'explode' com situações pequenas após dias de estresse no trabalho. Psicoeducação sobre a relação entre pensamentos, emoção de raiva e comportamento. Tarefa: registrar episódios de raiva (gatilho, pensamento, intensidade, reação).",
      "Registro aponta gatilhos ligados à percepção de desconsideração (atrasos, louça acumulada). Pensamentos automáticos: 'ela não se importa comigo', com leitura mental e rotulação. Identificados sinais físicos precoces da escalada da raiva. Ensinada a técnica do tempo fora combinado. Tarefa: usar o tempo fora e completar RPD após cada episódio.",
      "Usou o tempo fora em duas ocasiões e evitou discussões maiores. Reestruturação cognitiva das interpretações de desconsideração, com geração de explicações alternativas. Iniciado treino de comunicação assertiva (falar do próprio sentimento e fazer pedidos específicos). Tarefa: praticar um pedido assertivo por dia.",
      "Relata redução importante das discussões e conversa franca com a companheira sobre divisão de tarefas. Intensidade média da raiva caiu de 8 para 4/10. Revisadas as estratégias e o manejo de semanas de alto estresse. Avaliada possibilidade de sessão com o casal, a combinar.",
    ],
  },
];

/** Datas passadas das sessões, da mais antiga à mais recente. */
function datasDasSessoes(
  realizados: { id: string; fim: Date }[],
  arquivado: boolean,
  indice: number,
): { fim: Date; atendimentoId: string | null }[] {
  const reais = realizados.slice(-SESSOES).map((a) => ({ fim: a.fim, atendimentoId: a.id }));
  const faltam = SESSOES - reais.length;
  // Avulsas uma por semana antes da primeira sessão real (ou antes de hoje;
  // para arquivado, três meses antes, quando ainda estava em acompanhamento).
  const referencia = reais[0]
    ? reais[0].fim.toISOString().slice(0, 10)
    : somarDias(hojeLocal(), arquivado ? -90 : 0);
  const hora = 9 + (indice % 8);
  const avulsas = Array.from({ length: faltam }, (_, i) => ({
    fim: instanteLocal(somarDias(referencia, -7 * (faltam - i)), hora * 60 + 50),
    atendimentoId: null,
  }));
  return [...avulsas, ...reais];
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-dev-evolucoes não roda com NODE_ENV=production.");
  }

  const pacientes = await prisma.paciente.findMany({
    select: {
      id: true,
      nome: true,
      status: true,
      _count: { select: { evolucoes: true } },
      atendimentos: {
        where: { status: "REALIZADO", fim: { lt: new Date() } },
        select: { id: true, fim: true },
        orderBy: { fim: "asc" },
      },
    },
    orderBy: { nome: "asc" },
  });

  for (const [indice, paciente] of pacientes.entries()) {
    if (paciente._count.evolucoes >= SESSOES) {
      console.log(`${paciente.nome}: já tem ${paciente._count.evolucoes} evoluções, pulado.`);
      continue;
    }
    const plano = PLANOS[indice % PLANOS.length];
    const datas = datasDasSessoes(paciente.atendimentos, paciente.status === "ARQUIVADO", indice);

    for (const [sessao, { fim, atendimentoId }] of datas.entries()) {
      // Registrada cerca de 20 minutos depois do fim da sessão.
      const registradoEm = new Date(fim.getTime() + 20 * 60_000);
      const base = { pacienteId: paciente.id, atendimentoId };
      let retificaDeId: string | null = null;

      if (plano.retificacao?.sessao === sessao) {
        const original = await prisma.evolucao.create({
          data: { ...base, texto: plano.retificacao.original, registradoEm, vigente: false },
          select: { id: true },
        });
        retificaDeId = original.id;
      }
      await prisma.evolucao.create({
        data: {
          ...base,
          texto: plano.sessoes[sessao],
          // A correção vem dois dias depois do registro original, nunca no futuro.
          registradoEm: retificaDeId
            ? new Date(Math.min(registradoEm.getTime() + 2 * 24 * 3600_000, Date.now()))
            : registradoEm,
          retificaDeId,
        },
        select: { id: true },
      });
    }
    const vinculadas = datas.filter((d) => d.atendimentoId).length;
    console.log(
      `${paciente.nome}: ${SESSOES} evoluções (${plano.foco})` +
        (vinculadas ? `, ${vinculadas} ligada(s) a atendimento` : "") +
        (plano.retificacao ? ", com uma retificação" : "") +
        ".",
    );
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
