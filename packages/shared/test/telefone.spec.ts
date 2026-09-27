import { describe, expect, it } from "vitest";
import { pacienteAlteracaoSchema, pacienteEntradaSchema } from "../src/paciente";
import {
  editarTelefone,
  formatarTelefone,
  mascararTelefone,
  normalizarTelefone,
  telefoneSchema,
} from "../src/telefone";

type Campo = { digitos: string; exibicao: string; cursor: number };

const vazio: Campo = { digitos: "", exibicao: "", cursor: 0 };

/** O que o navegador faz ao digitar um caractere na posição do cursor. */
function digitar(campo: Campo, tecla: string): Campo {
  const { exibicao, cursor } = campo;
  return editarTelefone({
    valor: exibicao.slice(0, cursor) + tecla + exibicao.slice(cursor),
    cursor: cursor + tecla.length,
    anteriores: campo.digitos,
    tipo: "insertText",
  });
}

function digitarTudo(campo: Campo, texto: string): Campo {
  return [...texto].reduce(digitar, campo);
}

/** Backspace sem seleção: o navegador remove o caractere antes do cursor. */
function apagar(campo: Campo): Campo {
  const { exibicao, cursor } = campo;
  return editarTelefone({
    valor: exibicao.slice(0, cursor - 1) + exibicao.slice(cursor),
    cursor: cursor - 1,
    anteriores: campo.digitos,
    tipo: "deleteContentBackward",
  });
}

function colar(campo: Campo, texto: string): Campo {
  const { exibicao, cursor } = campo;
  return editarTelefone({
    valor: exibicao.slice(0, cursor) + texto + exibicao.slice(cursor),
    cursor: cursor + texto.length,
    anteriores: campo.digitos,
    tipo: "insertFromPaste",
  });
}

/** Cursor em `|`: "(83) 99|322-9097" → campo com cursor na posição do `|`. */
function com(marcado: string): Campo {
  const cursor = marcado.indexOf("|");
  const exibicao = marcado.replace("|", "");
  return { digitos: exibicao.replace(/\D/g, ""), exibicao, cursor };
}

function marcar({ exibicao, cursor }: Campo): string {
  return `${exibicao.slice(0, cursor)}|${exibicao.slice(cursor)}`;
}

describe("normalização", () => {
  it.each([
    ["com máscara de celular", "(83) 99322-9097", "83993229097"],
    ["com máscara de fixo", "(83) 3221-4567", "8332214567"],
    ["com +55", "+55 (83) 99322-9097", "83993229097"],
    ["com 55 e fixo", "55 83 3221-4567", "8332214567"],
    ["com espaços", " 83 9 9322 9097 ", "83993229097"],
    ["cru, 11 dígitos", "83993229097", "83993229097"],
    ["cru, 10 dígitos", "8332214567", "8332214567"],
    ["DDD 55 não é prefixo de país", "(55) 99999-8888", "55999998888"],
    ["DDD 55 com +55", "+55 55 99999-8888", "55999998888"],
  ])("%s", (_caso, entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
    expect(telefoneSchema.parse(entrada)).toBe(esperado);
  });

  it.each([
    ["8 dígitos", "9322-9097"],
    ["9 dígitos", "993229097"],
    ["12 dígitos sem 55", "083993229097"],
    ["14 dígitos", "+55 (83) 99322-90971"],
  ])("recusa quantidade inválida: %s", (_caso, entrada) => {
    const resultado = telefoneSchema.safeParse(entrada);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toMatch(/10 dígitos \(fixo\) ou 11 \(celular\)/);
  });

  it("no cadastro: vazio ou sem dígitos é ausente, inválido aponta o campo", () => {
    const base = { nome: "Ana", valorConsultaPadrao: "150" };
    for (const telefone of ["", "  ", "()", undefined]) {
      expect(pacienteEntradaSchema.parse({ ...base, telefone }).telefone ?? null).toBeNull();
    }
    expect(pacienteEntradaSchema.parse({ ...base, telefone: "+55 (83) 99322-9097" }).telefone).toBe(
      "83993229097",
    );

    const invalido = pacienteEntradaSchema.safeParse({ ...base, telefone: "9322-9097" });
    expect(invalido.error?.issues.map((i) => i.path)).toEqual([["telefone"]]);

    // No PATCH, ausente não altera e null apaga.
    expect(pacienteAlteracaoSchema.parse({})).not.toHaveProperty("telefone", expect.anything());
    expect(pacienteAlteracaoSchema.parse({ telefone: null }).telefone).toBeNull();
  });
});

describe("exibição", () => {
  it("formata os dois tamanhos válidos", () => {
    expect(formatarTelefone("83993229097")).toBe("(83) 99322-9097");
    expect(formatarTelefone("8332214567")).toBe("(83) 3221-4567");
  });

  it("legado com quantidade inválida aparece como está; ausente é null", () => {
    expect(formatarTelefone("32214567")).toBe("32214567");
    expect(formatarTelefone(null)).toBeNull();
  });

  it("máscara progressiva, trocando de formato no 11º dígito", () => {
    const passos = [..."83993229097"].map((_, i) => mascararTelefone("83993229097".slice(0, i + 1)));
    expect(passos).toEqual([
      "(8",
      "(83",
      "(83) 9",
      "(83) 99",
      "(83) 993",
      "(83) 9932",
      "(83) 9932-2",
      "(83) 9932-29",
      "(83) 9932-290",
      "(83) 9932-2909",
      "(83) 99322-9097",
    ]);
  });
});

describe("campo com máscara", () => {
  it("digitando celular: exibe mascarado e guarda só dígitos", () => {
    const campo = digitarTudo(vazio, "83993229097");
    expect(campo).toEqual({ digitos: "83993229097", exibicao: "(83) 99322-9097", cursor: 15 });
  });

  it("digitando fixo", () => {
    expect(digitarTudo(vazio, "8332214567").exibicao).toBe("(83) 3221-4567");
  });

  it("colar +55 (83) 99322-9097 normaliza e descarta o 55", () => {
    const campo = colar(vazio, "+55 (83) 99322-9097");
    expect(campo).toMatchObject({ digitos: "83993229097", exibicao: "(83) 99322-9097" });
    expect(campo.cursor).toBe(campo.exibicao.length);
  });

  it("backspace repetido remove um dígito por toque até esvaziar", () => {
    let campo = digitarTudo(vazio, "83993229097");
    const digitos: string[] = [];
    while (campo.digitos) {
      campo = apagar(campo);
      digitos.push(campo.digitos);
      expect(campo.cursor).toBe(campo.exibicao.length);
    }
    expect(digitos).toEqual([
      "8399322909",
      "839932290",
      "83993229",
      "8399322",
      "839932",
      "83993",
      "8399",
      "839",
      "83",
      "8",
      "",
    ]);
  });

  it("backspace logo depois de um caractere da máscara apaga o dígito anterior", () => {
    expect(marcar(apagar(com("(83) 99322-|9097")))).toBe("(83) 9932|-9097");
    expect(marcar(apagar(com("(83) |99322-9097")))).toBe("(8|9) 9322-9097");
  });

  it("apagar no meio não joga o cursor para o fim", () => {
    const campo = apagar(com("(83) 993|22-9097"));
    expect(campo.digitos).toBe("8399229097");
    expect(marcar(campo)).toBe("(83) 99|22-9097");
  });

  it("digitar no meio mantém o cursor depois do dígito digitado", () => {
    const campo = digitar(com("(83) 99|22-9097"), "3");
    expect(marcar(campo)).toBe("(83) 993|22-9097");
  });

  it("12º dígito digitado é ignorado sem mexer no que já estava", () => {
    const cheio = com("(83) 99|322-9097");
    const campo = digitar(cheio, "5");
    expect(campo.digitos).toBe("83993229097");
    expect(marcar(campo)).toBe("(83) 99|322-9097");
  });

  it("caractere que não é dígito é descartado sem deslocar o cursor", () => {
    expect(marcar(digitar(com("(83) 99|322-9097"), "a"))).toBe("(83) 99|322-9097");
  });
});
