"use client";

import { editarTelefone, mascararTelefone, soDigitos } from "@raiz/shared";
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentProps } from "react";
import { Campo } from "./campo";

type CampoTelefoneProps = Omit<
  ComponentProps<typeof Campo>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  /** Só dígitos, como a API grava. */
  value: string | null | undefined;
  onChange: (digitos: string) => void;
};

/**
 * Telefone com máscara progressiva, sem biblioteca (design.md, "Máscara sem
 * biblioteca"). O estado é a string de dígitos; o texto exibido é derivado
 * dela. Cada edição do navegador passa por `editarTelefone`, que decide os
 * dígitos e onde o cursor fica — o componente só reaplica essa posição depois
 * de o React reescrever o valor, o que por padrão jogaria o cursor para o fim.
 */
export function CampoTelefone({ value, onChange, ref, ...props }: CampoTelefoneProps) {
  const entrada = useRef<HTMLInputElement | null>(null);
  const cursorPendente = useRef<number | null>(null);
  // Uma edição recusada (12º dígito) não muda os dígitos, mas o cursor
  // precisa ser reposto mesmo assim: força a renderização.
  const [, redesenhar] = useState(0);
  const digitos = soDigitos(value ?? "");

  useLayoutEffect(() => {
    const campo = entrada.current;
    if (cursorPendente.current === null || !campo || campo !== document.activeElement) return;
    campo.setSelectionRange(cursorPendente.current, cursorPendente.current);
    cursorPendente.current = null;
  });

  function mudar(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.target;
    const edicao = editarTelefone({
      valor: campo.value,
      cursor: campo.selectionStart ?? campo.value.length,
      anteriores: digitos,
      tipo: (evento.nativeEvent as InputEvent).inputType,
    });
    cursorPendente.current = edicao.cursor;
    redesenhar((n) => n + 1);
    if (edicao.digitos !== digitos) onChange(edicao.digitos);
  }

  return (
    <Campo
      {...props}
      ref={(elemento) => {
        entrada.current = elemento;
        if (typeof ref === "function") ref(elemento);
        else if (ref) ref.current = elemento;
      }}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={mascararTelefone(digitos)}
      onChange={mudar}
    />
  );
}
