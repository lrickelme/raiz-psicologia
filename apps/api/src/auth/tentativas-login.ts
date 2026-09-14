import { Injectable } from "@nestjs/common";
import { LOGIN_JANELA_MS, LOGIN_MAX_FALHAS } from "./auth.constantes";

/**
 * Contador de falhas de login por IP, em memória. Reinicia com o processo e
 * vale para uma instância só — suficiente para o consultório (usuário único,
 * API sem porta pública).
 */
@Injectable()
export class TentativasLogin {
  private readonly falhasPorIp = new Map<string, number[]>();

  /** Milissegundos até o IP poder tentar de novo; `0` se está liberado. */
  bloqueadoPor(ip: string): number {
    const falhas = this.recentes(ip);
    if (falhas.length < LOGIN_MAX_FALHAS) return 0;
    return falhas[0] + LOGIN_JANELA_MS - Date.now();
  }

  registrarFalha(ip: string): void {
    this.falhasPorIp.set(ip, [...this.recentes(ip), Date.now()]);
  }

  limpar(ip: string): void {
    this.falhasPorIp.delete(ip);
  }

  private recentes(ip: string): number[] {
    const inicioDaJanela = Date.now() - LOGIN_JANELA_MS;
    const falhas = (this.falhasPorIp.get(ip) ?? []).filter(
      (momento) => momento > inicioDaJanela,
    );
    if (falhas.length === 0) this.falhasPorIp.delete(ip);
    else this.falhasPorIp.set(ip, falhas);
    return falhas;
  }
}
