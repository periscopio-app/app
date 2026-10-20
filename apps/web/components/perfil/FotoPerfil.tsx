"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { prepararFoto } from "@/lib/perfil";
import { Alert, Avatar, Button, ConfirmDialog } from "@/components/ui";

/** Escolher, pré-visualizar, salvar e remover a foto de perfil. A imagem é reduzida no navegador antes do envio. */
export function FotoPerfil({
  nome,
  avatarUrl,
  onChanged,
}: {
  nome: string;
  avatarUrl: string | null;
  onChanged: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [novaFoto, setNovaFoto] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setErro(null);
    setOk(null);
    try {
      setNovaFoto(await prepararFoto(arquivo));
    } catch (err) {
      setNovaFoto(null);
      setErro(err instanceof Error ? err.message : "Não foi possível preparar a imagem.");
    }
  }

  async function salvar() {
    if (!novaFoto) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await api.put<{ avatarUrl: string | null }>("/api/me/photo", { dataBase64: novaFoto.base64 });
      setNovaFoto(null);
      setOk("Foto atualizada.");
      onChanged(r.avatarUrl);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar a foto agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    setSalvando(true);
    setErro(null);
    try {
      await api.delete("/api/me/photo");
      setConfirmarRemocao(false);
      setOk("Foto removida.");
      onChanged(null);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível remover a foto agora.");
    } finally {
      setSalvando(false);
    }
  }

  const exibida = novaFoto?.previewUrl ?? avatarUrl;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar nome={nome} url={exibida} tamanho="lg" decorativo={false} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <input
          ref={inputRef}
          id="foto-perfil"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={aoEscolher}
        />
        {novaFoto ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={salvar} disabled={salvando} className="min-h-10 px-4 text-sm">
              {salvando ? "Salvando..." : "Salvar esta foto"}
            </Button>
            <Button variant="ghost" onClick={() => setNovaFoto(null)} disabled={salvando} className="min-h-10 px-4 text-sm">
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={salvando} className="min-h-10 px-4 text-sm">
              <Camera className="h-4 w-4" aria-hidden="true" />
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {avatarUrl && (
              <Button variant="danger" onClick={() => setConfirmarRemocao(true)} disabled={salvando} className="min-h-10 px-4 text-sm">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remover foto
              </Button>
            )}
          </div>
        )}
        <p className="text-xs leading-relaxed text-neutral-800">
          JPG, PNG ou WEBP. A imagem é recortada em quadrado e reduzida antes do envio, e a localização da foto é descartada.
          Quem tiver o link da foto consegue abri-la, então envie apenas se concordar. Nunca use foto de aluno.
        </p>
        {erro && <Alert tom="erro">{erro}</Alert>}
        {ok && !erro && <Alert tom="ok">{ok}</Alert>}
      </div>

      <ConfirmDialog
        open={confirmarRemocao}
        onClose={() => setConfirmarRemocao(false)}
        onConfirm={remover}
        title="Remover a foto de perfil?"
        description="A foto será apagada do armazenamento. Você pode enviar outra quando quiser."
        confirmText="Remover foto"
        tone="danger"
        isLoading={salvando}
      />
    </div>
  );
}
