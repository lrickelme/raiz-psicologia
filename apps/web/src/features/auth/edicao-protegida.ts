/**
 * Editores com texto clínico ainda não salvo. Enquanto houver algum, perder a
 * sessão não leva ao login: quem o registrou abre a reautenticação sem
 * desmontar o editor (design.md, "401 no editor: reautenticar sem
 * desmontar"). Vive só em memória, como o próprio texto.
 */
type AoPerderSessao = () => void;

const editores = new Set<AoPerderSessao>();

export function protegerEdicao(aoPerderSessao: AoPerderSessao): () => void {
  editores.add(aoPerderSessao);
  return () => {
    editores.delete(aoPerderSessao);
  };
}

/** Avisa os editores protegidos; `true` se algum assumiu a reautenticação. */
export function cederAosEditores(): boolean {
  editores.forEach((aoPerderSessao) => aoPerderSessao());
  return editores.size > 0;
}
