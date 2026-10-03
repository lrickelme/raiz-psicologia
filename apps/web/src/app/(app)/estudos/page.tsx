import type { Metadata } from "next";
import { Quadro } from "@/features/estudos/quadro";

export const metadata: Metadata = { title: "Estudos · Raíz" };

export default function EstudosPage() {
  return <Quadro />;
}
