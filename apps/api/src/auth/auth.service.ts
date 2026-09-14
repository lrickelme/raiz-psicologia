import { randomBytes } from "node:crypto";
import { setTimeout as dormir } from "node:timers/promises";
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import type { LoginInput } from "@raiz/shared";
import { LOGIN_PISO_MS } from "../comum/config";
import { PrismaService } from "../prisma/prisma.service";
import { gerarHashSenha, verificarSenha } from "./senha";
import { SessaoStore } from "./sessao.store";
import { TentativasLogin } from "./tentativas-login";

/** Mesma resposta para e-mail desconhecido e senha errada (spec auth). */
const CREDENCIAL_INVALIDA = {
  error: "Credencial inválida",
  message: "E-mail ou senha incorretos",
};

/**
 * Espera até `pisoMs` ter passado desde `inicio`. O laço reconsulta o relógio
 * em vez de confiar em uma espera só, porque `setTimeout` pode acordar cedo.
 */
async function aguardarPiso(inicio: bigint, pisoMs: number): Promise<void> {
  for (;;) {
    const decorridoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    if (decorridoMs >= pisoMs) return;
    await dormir(pisoMs - decorridoMs);
  }
}

@Injectable()
export class AuthService implements OnModuleInit {
  /**
   * Hash de descarte, gerado no boot com os mesmos parâmetros do hash real.
   * Quando o e-mail não existe, a senha informada é verificada contra ele e o
   * resultado é jogado fora: sem isso, pular o Argon2 tornaria a resposta de
   * conta inexistente mais rápida que a de senha errada.
   */
  private hashDeDescarte = "";

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoStore,
    private readonly tentativas: TentativasLogin,
  ) {}

  async onModuleInit(): Promise<void> {
    this.hashDeDescarte = await gerarHashSenha(randomBytes(32).toString("hex"));
  }

  /**
   * Devolve o token da nova sessão ou lança 401.
   *
   * O piso vale só para a recusa. O sucesso já se anuncia pelo status, pelo
   * `Set-Cookie` e pelo tamanho da resposta, então atrasá-lo não esconderia
   * nada — cobraria da profissional meio segundo por login em troca de nada.
   * Qualquer falha é segurada, não só o 401: se um caminho de erro futuro
   * passar a distinguir conta existente de inexistente, já nasce coberto.
   */
  async login(dados: LoginInput, ip: string): Promise<string> {
    const inicio = process.hrtime.bigint();
    try {
      return await this.autenticar(dados, ip);
    } catch (erro) {
      await aguardarPiso(inicio, LOGIN_PISO_MS);
      throw erro;
    }
  }

  private async autenticar(
    { email, senha }: LoginInput,
    ip: string,
  ): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    // Sem short-circuit: o Argon2 roda nos dois casos, contra o hash do
    // usuário ou contra o de descarte.
    const senhaConfere = await verificarSenha(
      usuario?.senhaHash ?? this.hashDeDescarte,
      senha,
    );

    if (usuario === null || !senhaConfere) {
      this.tentativas.registrarFalha(ip);
      throw new UnauthorizedException(CREDENCIAL_INVALIDA);
    }

    this.tentativas.limpar(ip);
    await this.sessoes.limparExpiradas();
    return this.sessoes.criar(usuario.id);
  }
}
