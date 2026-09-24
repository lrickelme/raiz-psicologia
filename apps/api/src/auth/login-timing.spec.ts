import "reflect-metadata";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { loginSchema } from "@raiz/shared";
import { beforeAll, describe, expect, it } from "vitest";
import type { AuditoriaService } from "../auditoria/auditoria.service";
import { LOGIN_PISO_MS } from "../comum/config";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { LoginRateLimitGuard } from "./login-rate-limit.guard";
import { gerarHashSenha } from "./senha";
import type { SessaoStore } from "./sessao.store";
import { TentativasLogin } from "./tentativas-login";
import { LOGIN_MAX_FALHAS } from "./auth.constantes";

const EMAIL = "profissional@exemplo.com";
const SENHA = "senha-correta-da-profissional";
const IP = "203.0.113.7";

/**
 * Comparar o tempo dos dois caminhos entre si é instável em CI: basta uma
 * pausa de GC em uma das medições para o teste piscar. O que se afirma aqui é
 * que cada recusa respeita o piso configurado e que as duas são idênticas em
 * status e corpo — as duas coisas que o piso existe para garantir. O sucesso
 * é afirmado ao contrário: ele não pode pagar o piso.
 */
async function medir<T>(tarefa: () => Promise<T>): Promise<{
  decorridoMs: number;
  resultado: T | undefined;
  erro: unknown;
}> {
  const inicio = process.hrtime.bigint();
  try {
    const resultado = await tarefa();
    return { decorridoMs: msDesde(inicio), resultado, erro: undefined };
  } catch (erro) {
    return { decorridoMs: msDesde(inicio), resultado: undefined, erro };
  }
}

function msDesde(inicio: bigint): number {
  return Number(process.hrtime.bigint() - inicio) / 1e6;
}

describe("piso de tempo do login", () => {
  let auth: AuthService;
  let tentativas: TentativasLogin;

  beforeAll(async () => {
    const usuario = {
      id: "01a0a21d-4da0-7ab0-9968-4b741ebadb4b",
      email: EMAIL,
      nome: "Profissional",
      senhaHash: await gerarHashSenha(SENHA),
      criadoEm: new Date(),
    };

    const prisma = {
      usuario: {
        findUnique: async ({ where }: { where: { email: string } }) =>
          where.email === EMAIL ? usuario : null,
      },
    };
    const sessoes: Pick<SessaoStore, "criar" | "limparExpiradas"> = {
      criar: async () => "token-de-teste",
      limparExpiradas: async () => {},
    };
    const auditoria: Pick<AuditoriaService, "registrar"> = {
      registrar: async () => {},
    };

    tentativas = new TentativasLogin();
    auth = new AuthService(
      prisma as never,
      sessoes as SessaoStore,
      tentativas,
      auditoria as AuditoriaService,
    );
    await auth.onModuleInit();
  });

  it("segura a recusa de e-mail inexistente até o piso", async () => {
    const { decorridoMs, erro } = await medir(() =>
      auth.login({ email: "ninguem@exemplo.com", senha: "errada" }, IP),
    );

    expect(erro).toBeInstanceOf(UnauthorizedException);
    expect(decorridoMs).toBeGreaterThanOrEqual(LOGIN_PISO_MS);
  });

  it("segura a recusa de senha incorreta até o piso", async () => {
    const { decorridoMs, erro } = await medir(() =>
      auth.login({ email: EMAIL, senha: "errada" }, IP),
    );

    expect(erro).toBeInstanceOf(UnauthorizedException);
    expect(decorridoMs).toBeGreaterThanOrEqual(LOGIN_PISO_MS);
  });

  it("recusa e-mail inexistente e senha incorreta com status e corpo idênticos", async () => {
    const desconhecido = await medir(() =>
      auth.login({ email: "ninguem@exemplo.com", senha: "errada" }, IP),
    );
    const senhaErrada = await medir(() =>
      auth.login({ email: EMAIL, senha: "errada" }, IP),
    );

    const recusa = (erro: unknown) => {
      const excecao = erro as UnauthorizedException;
      return { status: excecao.getStatus(), corpo: excecao.getResponse() };
    };

    expect(recusa(desconhecido.erro)).toEqual(recusa(senhaErrada.erro));
    expect(recusa(desconhecido.erro).status).toBe(401);
  });

  it("não aplica o piso ao login válido", async () => {
    tentativas.limpar(IP);
    const { decorridoMs, resultado } = await medir(() =>
      auth.login({ email: EMAIL, senha: SENHA }, IP),
    );

    expect(resultado).toBe("token-de-teste");
    expect(decorridoMs).toBeLessThan(LOGIN_PISO_MS);
  });

  it("não aplica o piso ao 429 do rate limit", async () => {
    const ipBloqueado = "203.0.113.99";
    const contador = new TentativasLogin();
    for (let i = 0; i < LOGIN_MAX_FALHAS; i++) contador.registrarFalha(ipBloqueado);

    const guard = new LoginRateLimitGuard(contador);
    const contexto = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: ipBloqueado }),
        getResponse: () => ({ header: () => {} }),
      }),
    } as unknown as ExecutionContext;

    const { decorridoMs, erro } = await medir(async () =>
      guard.canActivate(contexto),
    );

    expect((erro as { getStatus(): number }).getStatus()).toBe(429);
    expect(decorridoMs).toBeLessThan(LOGIN_PISO_MS);
  });

  it("não aplica o piso ao 422 de payload inválido", async () => {
    const pipe = new ZodValidationPipe(loginSchema);

    const { decorridoMs, erro } = await medir(async () =>
      pipe.transform({ email: "não é e-mail", senha: "" }),
    );

    expect((erro as { getStatus(): number }).getStatus()).toBe(422);
    expect(decorridoMs).toBeLessThan(LOGIN_PISO_MS);
  });
});
