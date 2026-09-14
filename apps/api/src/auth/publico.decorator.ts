import { SetMetadata } from "@nestjs/common";

export const PUBLICO = "publico";

/** Isenta a rota do AuthGuard global. Só login e health check devem usar. */
export const Publico = () => SetMetadata(PUBLICO, true);
