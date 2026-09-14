import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { LoginRateLimitGuard } from "./login-rate-limit.guard";
import { SessaoStore } from "./sessao.store";
import { TentativasLogin } from "./tentativas-login";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessaoStore,
    TentativasLogin,
    LoginRateLimitGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
