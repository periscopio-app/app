import { redirect } from "next/navigation";

// Site único: a equipe agora vive dentro da página inicial.
export default function Equipe() {
  redirect("/#equipe");
}
