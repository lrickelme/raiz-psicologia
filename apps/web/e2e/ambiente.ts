/** Portas e credencial do ambiente ponta a ponta — fora das de desenvolvimento. */
export const PORTA_API = 3334;
export const PORTA_WEB = 3100;
export const URL_API = `http://localhost:${PORTA_API}`;
// `localhost`, não 127.0.0.1: o cookie de sessão é `Secure`, e o Chromium só
// o aceita em http quando a origem é localhost.
export const URL_WEB = `http://localhost:${PORTA_WEB}`;

export const CREDENCIAL = {
  email: "e2e@exemplo.com",
  senha: "senha-do-ambiente-e2e",
  nome: "Profissional E2E",
};
