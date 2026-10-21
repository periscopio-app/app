"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Pencil, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { resetMe } from "@/lib/capabilities";
import { ESPECIALIDADES, formatarTelefone, type MetricasPerfil as Metricas, type PerfilUsuario } from "@/lib/perfil";
import { Alert, Avatar, Button, Card, ConfirmDialog, Field } from "@/components/ui";
import { FotoPerfil } from "./FotoPerfil";
import { MetricasPerfil } from "./MetricasPerfil";

const fmtData = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Avisa o menu lateral para atualizar nome e foto sem recarregar a página. */
function avisarMenu(p: Pick<PerfilUsuario, "name" | "avatarUrl">) {
  resetMe();
  window.dispatchEvent(new CustomEvent("perfil-atualizado", { detail: { name: p.name, avatarUrl: p.avatarUrl } }));
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-neutral-800">{rotulo}</dt>
      <dd className="text-sm text-black">{valor || "—"}</dd>
    </div>
  );
}

export function MeuPainel() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const [erroMetricas, setErroMetricas] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [okForm, setOkForm] = useState(false);

  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErroPerfil(null);
    try {
      const r = await api.get<{ profile: PerfilUsuario }>("/api/me/profile");
      setPerfil(r.profile);
    } catch (e) {
      setErroPerfil(e instanceof ApiError ? e.message : "Não foi possível carregar seu perfil agora.");
    }
    try {
      const m = await api.get<{ metrics: Metricas }>("/api/me/metrics");
      setMetricas(m.metrics);
    } catch (e) {
      setErroMetricas(e instanceof ApiError ? e.message : "Não foi possível carregar seus indicadores agora.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirEdicao() {
    if (!perfil) return;
    setNome(perfil.name);
    setTelefone(formatarTelefone(perfil.phone));
    setBio(perfil.bio ?? "");
    setErroForm(null);
    setOkForm(false);
    setEditando(true);
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    setSalvando(true);
    setErroForm(null);
    try {
      const r = await api.patch<{ profile: PerfilUsuario }>("/api/me/profile", { name: nome, phone: telefone, bio });
      setPerfil(r.profile);
      setEditando(false);
      setOkForm(true);
      avisarMenu(r.profile);
    } catch (err) {
      setErroForm(err instanceof ApiError ? err.message : "Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function pedirExclusao() {
    setPedindo(true);
    setErroExclusao(null);
    try {
      await api.post("/api/me/deletion-request", {});
      setConfirmarExclusao(false);
      await carregar();
    } catch (err) {
      setErroExclusao(err instanceof ApiError ? err.message : "Não foi possível registrar o pedido agora.");
    } finally {
      setPedindo(false);
    }
  }

  if (erroPerfil && !perfil) {
    return <Alert tom="erro">{erroPerfil}</Alert>;
  }
  if (!perfil) {
    return (
      <div role="status" className="py-24 text-center text-sm text-neutral-800">
        Carregando seu painel...
      </div>
    );
  }

  const especialidade = perfil.specialty ? ESPECIALIDADES[perfil.specialty] ?? perfil.specialty : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar nome={perfil.name} url={perfil.avatarUrl} tamanho="md" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-black">Meu painel</h1>
          <p className="text-sm text-neutral-800">
            {perfil.roleLabel}
            {especialidade ? ` · ${especialidade}` : ""}
            {perfil.school?.name ? ` · ${perfil.school.name}` : ""}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6 md:p-8">
          <h2 className="text-xl font-bold text-black">Foto de perfil</h2>
          <FotoPerfil
            nome={perfil.name}
            avatarUrl={perfil.avatarUrl}
            onChanged={(url) => {
              const novo = { ...perfil, avatarUrl: url };
              setPerfil(novo);
              avisarMenu(novo);
            }}
          />
        </Card>

        <Card className="space-y-4 p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-black">Meus dados</h2>
            {!editando && (
              <Button variant="outline" onClick={abrirEdicao} className="min-h-10 px-4 text-sm">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
            )}
          </div>

          {okForm && !editando && <Alert tom="ok">Dados salvos.</Alert>}

          {editando ? (
            <form onSubmit={salvarDados} className="space-y-4" noValidate>
              <Field id="perfil-nome" label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" required />
              <Field
                id="perfil-telefone"
                label="Telefone com DDD (opcional)"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 91234-5678"
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="perfil-bio" className="text-sm font-semibold text-black">
                  Apresentação curta (opcional)
                </label>
                <textarea
                  id="perfil-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  aria-describedby="perfil-bio-contador"
                  className="rounded-xl border-[1.5px] border-input bg-white px-4 py-3 text-base text-black focus:border-roxo focus:outline-none focus:ring-2 focus:ring-roxo/30"
                />
                <p id="perfil-bio-contador" className="text-xs text-neutral-800">
                  {bio.length}/280. Não escreva dados de alunos.
                </p>
              </div>
              {erroForm && <Alert tom="erro">{erroForm}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={salvando} className="min-h-10 px-5 text-sm">
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="ghost" onClick={() => setEditando(false)} disabled={salvando} className="min-h-10 px-4 text-sm">
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-neutral-800">Deixe um campo opcional em branco para apagá-lo.</p>
            </form>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Linha rotulo="Nome" valor={perfil.name} />
              <Linha rotulo="Telefone" valor={formatarTelefone(perfil.phone)} />
              <div className="sm:col-span-2">
                <Linha rotulo="Apresentação" valor={perfil.bio} />
              </div>
            </dl>
          )}

          <div className="rounded-2xl border border-linha bg-ceu-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-black">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Definidos pela gestão da plataforma
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Linha rotulo="E-mail de acesso" valor={perfil.email} />
              <Linha rotulo="Perfil" valor={perfil.roleLabel} />
              <Linha rotulo="Escola" valor={perfil.school?.name} />
              <Linha rotulo="Especialidade" valor={especialidade} />
              <Linha rotulo="Registro no conselho" valor={perfil.classCode} />
              <Linha rotulo="CPF" valor={perfil.cpfMasked} />
              <Linha rotulo="Rede" valor={perfil.tenantName} />
              <Linha rotulo="Na plataforma desde" valor={fmtData(perfil.createdAt)} />
            </dl>
            <p className="mt-3 text-xs text-neutral-800">Algo errado aqui? Abra um chamado em “Suporte” no topo da tela.</p>
          </div>
        </Card>
      </div>

      {metricas ? (
        <MetricasPerfil metricas={metricas} />
      ) : erroMetricas ? (
        <Alert tom="erro">{erroMetricas}</Alert>
      ) : (
        <div role="status" className="py-6 text-center text-sm text-neutral-800">
          Calculando seus indicadores...
        </div>
      )}

      <Card className="space-y-3 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-black">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Privacidade e seus dados
        </h2>
        <p className="text-sm leading-relaxed text-neutral-800">
          Você pode pedir a eliminação da sua conta e dos seus dados pessoais (LGPD, art. 18). O pedido vai para a governança de dados, que responde no
          prazo legal. Registros de auditoria e de atendimento de casos podem ser mantidos quando a lei exigir. Enquanto o pedido não for tratado, sua conta
          continua funcionando.
        </p>
        {perfil.deletionRequest ? (
          <Alert tom="atencao">
            Pedido de eliminação registrado em {fmtData(perfil.deletionRequest.createdAt)}. Protocolo: <strong>{perfil.deletionRequest.protocol}</strong>.
          </Alert>
        ) : (
          <>
            {erroExclusao && <Alert tom="erro">{erroExclusao}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setConfirmarExclusao(true)} className="min-h-10 px-4 text-sm">
                Pedir eliminação da minha conta
              </Button>
              <Link href="/privacidade" className="inline-flex min-h-10 items-center px-3 text-sm font-semibold text-black underline">
                Política de privacidade
              </Link>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirmarExclusao}
        onClose={() => setConfirmarExclusao(false)}
        onConfirm={pedirExclusao}
        title="Pedir a eliminação da sua conta?"
        description="Vamos registrar o pedido com um protocolo. Nada é apagado agora: a governança de dados analisa e responde no prazo legal."
        confirmText="Registrar pedido"
        tone="danger"
        isLoading={pedindo}
      />
    </div>
  );
}
