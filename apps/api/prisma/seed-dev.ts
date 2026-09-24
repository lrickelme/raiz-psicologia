import "dotenv/config";
import { PrismaClient, type StatusAtendimento } from "@prisma/client";
import {
  hojeLocal,
  inicioDaSemana,
  instanteLocal,
  somarDias,
  type DataLocal,
} from "@raiz/shared";
import { CAMPOS_CRIPTOGRAFADOS } from "../src/comum/criptografia/campos";
import { carregarChave } from "../src/comum/criptografia/cifra";
import { criptografiaDeColuna } from "../src/comum/criptografia/extensao";

/**
 * Dados fictícios de desenvolvimento (tarefa 7.1). Nomes, telefones e motivos
 * são inventados. Datas relativas a hoje em São Paulo, para que dashboard,
 * semana e mês tenham o que mostrar em qualquer dia em que o seed rodar.
 *
 * Grava pela extensão de criptografia, então `motivo` chega cifrado à coluna.
 * Não passa pelo interceptor: a carga não gera trilha de auditoria.
 */
const prisma = new PrismaClient().$extends(
  criptografiaDeColuna(CAMPOS_CRIPTOGRAFADOS, carregarChave()),
);

const recriar = process.argv.includes("--recriar");
const agora = new Date();
const hoje = hojeLocal(agora);
const segunda = inicioDaSemana(hoje);

const MOTIVOS_CANCELAMENTO = [
  "Viagem a trabalho na semana; retoma na seguinte.",
  "Filho doente, avisou pela manhã.",
  "Conflito com consulta médica.",
];
const MOTIVOS_FALTA = [
  "Não compareceu e não avisou; mensagem enviada à tarde.",
  "Disse ter esquecido o horário.",
];

type Paciente = { id: string; valor: string };
type Ocupado = { inicio: Date; fim: Date };
const ocupados: Ocupado[] = [];

function livre(inicio: Date, fim: Date): boolean {
  return !ocupados.some((o) => inicio < o.fim && o.inicio < fim);
}

function horario(data: DataLocal, hora: number, minutos: number) {
  const inicio = instanteLocal(data, hora * 60);
  return { inicio, fim: new Date(inicio.getTime() + minutos * 60_000) };
}

/**
 * Agenda se o intervalo estiver livre, repetindo a regra da constraint
 * `EXCLUDE` (encerrados por cancelamento ou remarcação não ocupam).
 * Cancelamento e remarcação valem em qualquer data; fora deles, o futuro é
 * sempre `AGENDADO` e o passado, `REALIZADO` salvo outro status pedido.
 */
async function agendar(
  paciente: Paciente,
  data: DataLocal,
  hora: number,
  opcoes: {
    minutos?: number;
    valor?: string;
    status?: StatusAtendimento;
    motivo?: string;
    remarcadoDeId?: string;
  } = {},
) {
  const { inicio, fim } = horario(data, hora, opcoes.minutos ?? 50);
  const liberaHorario = opcoes.status === "CANCELADO" || opcoes.status === "REMARCADO";
  const status: StatusAtendimento = liberaHorario
    ? opcoes.status!
    : fim > agora
      ? "AGENDADO"
      : (opcoes.status ?? "REALIZADO");
  if (!liberaHorario && !livre(inicio, fim)) return null;
  if (!liberaHorario) ocupados.push({ inicio, fim });

  return prisma.atendimento.create({
    data: {
      pacienteId: paciente.id,
      inicio,
      fim,
      status,
      valor: opcoes.valor ?? paciente.valor,
      motivo: status === "AGENDADO" || status === "REALIZADO" ? null : opcoes.motivo,
      remarcadoDeId: opcoes.remarcadoDeId,
    },
  });
}

async function criarPaciente(dados: {
  nome: string;
  valor: string;
  telefone?: string;
  email?: string;
  nascimento?: string;
  observacoes?: string;
}): Promise<Paciente> {
  const criado = await prisma.paciente.create({
    data: {
      nome: dados.nome,
      valorConsultaPadrao: dados.valor,
      telefone: dados.telefone,
      email: dados.email,
      nascimento: dados.nascimento ? new Date(`${dados.nascimento}T00:00:00Z`) : undefined,
      observacoes: dados.observacoes,
    },
  });
  return { id: criado.id, valor: dados.valor };
}

/**
 * Um horário semanal fixo de seis semanas atrás até quatro à frente. No
 * passado, a maioria é realizada; algumas viram falta ou cancelamento.
 */
async function horarioSemanal(
  paciente: Paciente,
  semente: number,
  diaDaSemana: number,
  hora: number,
  opcoes: { minutos?: number; valorAte?: { semana: number; valor: string } } = {},
) {
  for (let semana = -6; semana <= 4; semana++) {
    const data = somarDias(segunda, semana * 7 + diaDaSemana);
    const valor =
      opcoes.valorAte && semana < opcoes.valorAte.semana ? opcoes.valorAte.valor : undefined;
    const n = semente + semana + 6;
    let status: StatusAtendimento = "REALIZADO";
    let motivo: string | undefined;
    if (n % 9 === 4) {
      status = "FALTA";
      motivo = MOTIVOS_FALTA[n % MOTIVOS_FALTA.length];
    } else if (n % 7 === 3) {
      status = "CANCELADO";
      motivo = MOTIVOS_CANCELAMENTO[n % MOTIVOS_CANCELAMENTO.length];
    }
    await agendar(paciente, data, hora, { minutos: opcoes.minutos, valor, status, motivo });
  }
}

/** Original → remarcações → vigente, cada elo apontando para o anterior. */
async function cadeiaDeRemarcacao(
  paciente: Paciente,
  passos: { data: DataLocal; hora: number; motivo?: string }[],
) {
  let anteriorId: string | undefined;
  for (const [i, passo] of passos.entries()) {
    const ultimo = i === passos.length - 1;
    const criado = await agendar(paciente, passo.data, passo.hora, {
      status: ultimo ? undefined : "REMARCADO",
      motivo: passo.motivo,
      remarcadoDeId: anteriorId,
    });
    if (!criado) throw new Error(`Horário ocupado na cadeia de remarcação (${passo.data})`);
    anteriorId = criado.id;
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-dev não roda com NODE_ENV=production.");
  }

  const existentes = await prisma.paciente.count();
  if (existentes > 0 && !recriar) {
    console.log(
      `Já há ${existentes} paciente(s) no banco; nada foi alterado. ` +
        "Use `pnpm seed:dev --recriar` para apagar pacientes e atendimentos e recarregar.",
    );
    return;
  }
  if (recriar) {
    // Auditoria fica: é somente-inserção e não tem chave estrangeira.
    await prisma.$executeRawUnsafe("TRUNCATE atendimento, paciente");
  }

  const ana = await criarPaciente({
    nome: "Ana Beatriz Moura",
    valor: "180.00",
    telefone: "(11) 91234-0001",
    email: "ana.moura@exemplo.com",
    nascimento: "1991-03-14",
    observacoes: "Reajuste de R$ 150 para R$ 180 há duas semanas. Prefere contato por WhatsApp.",
  });
  const carlos = await criarPaciente({
    nome: "Carlos Eduardo Pinto",
    valor: "160.00",
    telefone: "(11) 91234-0002",
    email: "carlos.pinto@exemplo.com",
    nascimento: "1985-11-02",
  });
  const mariana = await criarPaciente({
    nome: "Mariana Lopes",
    valor: "170.00",
    telefone: "(11) 91234-0003",
    nascimento: "1998-07-21",
  });
  const rafael = await criarPaciente({
    nome: "Rafael Teixeira",
    valor: "140.00",
    telefone: "(21) 99876-0004",
    observacoes: "Recibo mensal para reembolso do plano.",
  });
  const julia = await criarPaciente({
    nome: "Júlia Andrade",
    valor: "200.00",
    email: "julia.andrade@exemplo.com",
    nascimento: "1979-01-30",
  });
  const otavio = await criarPaciente({
    nome: "Otávio Ribeiro",
    valor: "130.00",
    telefone: "(11) 91234-0006",
  });
  // Homônimo proposital de "Mariana Lopes" (spec pacientes, "Homônimos").
  const marianaHomonima = await criarPaciente({
    nome: "Mariana Lopes",
    valor: "150.00",
    telefone: "(31) 98765-0007",
    observacoes: "Homônima — conferir telefone antes de agendar.",
  });
  // Cadastro mínimo, como chega pelo WhatsApp: só nome e valor.
  await criarPaciente({ nome: "Tomás Vieira", valor: "150.00" });
  const silvia = await criarPaciente({
    nome: "Sílvia Tavares",
    valor: "150.00",
    telefone: "(11) 91234-0009",
  });

  // Cadeias primeiro, para que os horários semanais contornem os elos vigentes.
  await cadeiaDeRemarcacao(ana, [
    { data: somarDias(segunda, 7 + 1), hora: 16, motivo: "Pediu para trocar por reunião na escola da filha." },
    { data: somarDias(segunda, 7 + 3), hora: 16, motivo: "Nova troca: plantão no trabalho." },
    { data: somarDias(segunda, 7 + 4), hora: 9 },
  ]);
  await cadeiaDeRemarcacao(carlos, [
    { data: somarDias(segunda, -14 + 2), hora: 18, motivo: "Remarcado por atraso no voo de volta." },
    { data: somarDias(segunda, -14 + 3), hora: 18 },
  ]);

  // Hoje: três atendimentos, para o painel do dashboard.
  await agendar(otavio, hoje, 9);
  await agendar(mariana, hoje, 14);
  await agendar(rafael, hoje, 16);

  await horarioSemanal(ana, 0, 1, 10, { valorAte: { semana: -2, valor: "150.00" } });
  await horarioSemanal(carlos, 1, 2, 19);
  await horarioSemanal(mariana, 2, 3, 11);
  await horarioSemanal(rafael, 3, 0, 8);
  await horarioSemanal(julia, 4, 4, 15, { minutos: 80 });
  await horarioSemanal(otavio, 5, 2, 13);

  // Dia cheio na próxima semana, para o indicador de excedente da visão mensal.
  const diaCheio = somarDias(segunda, 7 + 2);
  for (const [paciente, hora] of [
    [marianaHomonima, 7],
    [julia, 9],
    [rafael, 10],
    [mariana, 15],
    [otavio, 17],
    [ana, 20],
  ] as const) {
    await agendar(paciente, diaCheio, hora);
  }

  // Arquivada: histórico passado preservado, futuros cancelados no arquivamento.
  for (let semana = -6; semana <= 2; semana++) {
    const data = somarDias(segunda, semana * 7 + 4);
    const futuro = horario(data, 18, 50).inicio > agora;
    await agendar(silvia, data, 18, {
      status: futuro ? "CANCELADO" : "REALIZADO",
      motivo: futuro ? "Paciente arquivada: encerrou o acompanhamento." : undefined,
    });
  }
  await prisma.paciente.update({ where: { id: silvia.id }, data: { status: "ARQUIVADO" } });

  const porStatus = await prisma.atendimento.groupBy({ by: ["status"], _count: true });
  console.log(
    `Dados fictícios carregados: ${await prisma.paciente.count()} pacientes, ` +
      porStatus.map((g) => `${g._count} ${g.status}`).join(", ") +
      ".",
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
