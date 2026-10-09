"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import "mapbox-gl/dist/mapbox-gl.css";
import { api, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";
import { AlertCircle, MapPinned } from "lucide-react";
import {
  ColumnChart,
  HBarChart,
  KpiGrid,
  SchoolServiceHeatmap,
  ServiceDemand,
  type Datum,
  type Heatmap,
  type Kpi,
  type ServiceRow,
} from "@/components/dashboard/TarumaCharts";

type Cell = number | null;

interface Planning {
  casesRegistered: Cell;
  suppressed: boolean;
  ratePer1000: number | null;
  professionals: Record<string, number>;
  professionalsTotal: number;
  lowerBound: boolean;
}

interface SchoolPoint {
  schoolId: string;
  name: string;
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  enrollment: number | null;
  externalCode: string | null;
  planning: Planning | null;
  ageBands: Record<string, Cell> | null;
  complaints: Record<string, Cell> | null;
  services: Record<string, Cell> | null;
  semInformacao: string[];
}

interface Dashboard {
  scope: "municipio" | "escola";
  totalCases: Cell;
  kpis: Kpi[];
  casesBySchool: Datum[];
  pilotBySchool: Datum[];
  ageBands: Datum[];
  complaints: Datum[];
  services: ServiceRow[];
  heatmap: Heatmap;
  notes: string[];
}

interface MapData {
  municipality: string;
  center: { latitude: number; longitude: number };
  source: string | null;
  referenceYear: number | null;
  capacity: Record<string, number>;
  serviceLabels: Record<string, string>;
  services: string[];
  dashboard: Dashboard;
  schools: SchoolPoint[];
  notice: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const show = (v: Cell | undefined) => (v == null ? "<5" : String(v));

export default function MapaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<SchoolPoint | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ address: "", latitude: "", longitude: "", enrollment: "", externalCode: "" });

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markersRef = useRef<import("mapbox-gl").Marker[]>([]);

  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const load = useCallback(async (cap?: Record<string, number>) => {
    try {
      const q = new URLSearchParams();
      if (slug) q.set("slug", slug);
      if (cap && Object.keys(cap).length) q.set("capacity", JSON.stringify(cap));
      const qs = q.toString() ? `?${q.toString()}` : "";
      const d = await api.get<MapData>(`/api/population/taruma${qs}`);
      setData(d);
      setCapacity((prev) => (Object.keys(prev).length ? prev : d.capacity));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o mapa.");
    }
  }, [slug]);

  useEffect(() => {
    api.get<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => undefined);
    load();
  }, [load]);

  // Mapa: criado uma vez, marcadores refeitos a cada atualização dos dados.
  useEffect(() => {
    if (!data || !MAPBOX_TOKEN || !mapEl.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !mapEl.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapEl.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [data.center.longitude, data.center.latitude],
          zoom: 10.5,
        });
        mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const placed = data.schools.filter((s) => s.latitude != null && s.longitude != null);
      const bounds = new mapboxgl.LngLatBounds();
      for (const s of placed) {
        const cases = s.planning?.casesRegistered ?? null;
        const size = cases == null ? 28 : Math.min(72, 30 + Math.sqrt(cases) * 3.2);
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `${s.name}: ${cases == null ? "sem dados" : cases + " casos"}`);
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;color:#000;font-weight:700;font-size:12px;cursor:pointer;` +
          (s.planning
            ? "background:#EFE3F4;border:2px solid #682880;"
            : "background:#F3F4F6;border:2px dashed #6B7280;");
        el.textContent = cases == null ? "?" : String(cases);
        el.addEventListener("click", () => setSelected(s));
        markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([s.longitude!, s.latitude!]).addTo(mapRef.current!));
        bounds.extend([s.longitude!, s.latitude!]);
      }
      if (placed.length > 0) mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 0 });
      else mapRef.current.jumpTo({ center: [data.center.longitude, data.center.latitude], zoom: 10.5 });
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    setForm({
      address: selected.address ?? "",
      latitude: selected.latitude?.toString() ?? "",
      longitude: selected.longitude?.toString() ?? "",
      enrollment: selected.enrollment?.toString() ?? "",
      externalCode: selected.externalCode ?? "",
    });
    setGeoMsg(null);
  }, [selected]);

  async function saveGeo(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setGeoMsg(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    try {
      await api.put(`/api/schools/${selected.schoolId}/geo`, {
        address: form.address,
        latitude: num(form.latitude),
        longitude: num(form.longitude),
        enrollment: num(form.enrollment),
        externalCode: form.externalCode,
      });
      setGeoMsg("Dados da escola salvos.");
      await load(capacity);
    } catch (err) {
      setGeoMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  async function geocode() {
    if (!selected) return;
    setGeoMsg(null);
    try {
      await api.put(`/api/schools/${selected.schoolId}/geo`, { address: form.address });
      await api.post(`/api/schools/${selected.schoolId}/geocode`, {});
      setGeoMsg("Localização encontrada pelo endereço.");
      await load(capacity);
    } catch (err) {
      setGeoMsg(err instanceof Error ? err.message : "Erro ao localizar.");
    }
  }

  const current = selected ? data?.schools.find((s) => s.schoolId === selected.schoolId) ?? selected : null;
  const input = "w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40";

  return (
    <div className="space-y-6">
      {me && <RoleBanner me={me} />}
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <MapPinned className="h-6 w-6" /> Tarumã: painel de prevalência e profissionais necessários
        </h1>
        <p className="text-sm text-black mt-0.5">
          {data?.source ? `Base NEMT ${data.referenceYear} (${data.source}). ` : ""}
          {data?.notice}
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-erro bg-[#FDECEA] px-4 py-3 text-sm text-black">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!data && !error && <p className="text-sm text-black" role="status">Carregando os dados de Tarumã…</p>}

      {data && (
        <>
          <KpiGrid kpis={data.dashboard.kpis} />

          <div className="grid gap-4 lg:grid-cols-2">
            {data.dashboard.scope === "municipio" && (
              <HBarChart
                title="Casos registrados por escola"
                subtitle="Ordenado do maior para o menor número de casos."
                data={data.dashboard.casesBySchool}
              />
            )}
            <ColumnChart
              title="Casos por faixa etária"
              subtitle="A faixa do piloto (6 a 9 anos e 11 meses) está destacada."
              data={data.dashboard.ageBands}
            />
            <HBarChart
              title="Queixas mais registradas"
              subtitle="Percentual sobre o total de casos; uma criança pode ter mais de uma queixa."
              data={data.dashboard.complaints}
              showShare
              color="ceu"
            />
            {data.dashboard.scope === "municipio" && (
              <HBarChart
                title="Casos na faixa do piloto (6 a 9 anos) por escola"
                subtitle="Onde o piloto alcança mais crianças."
                data={data.dashboard.pilotBySchool}
              />
            )}
          </div>

          <ServiceDemand rows={data.dashboard.services} />
          {data.dashboard.scope === "municipio" && <SchoolServiceHeatmap heat={data.dashboard.heatmap} />}

          <ul className="list-disc space-y-1 pl-5 text-xs text-black">
            {data.dashboard.notes.slice(1).map((n) => (<li key={n}>{n}</li>))}
          </ul>
        </>
      )}

      <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
        <h2 className="text-sm font-bold text-black mb-1">Capacidade por profissional (parâmetro provisório)</h2>
        <p className="text-xs text-black mb-3">Casos acompanhados por profissional. Valores iniciais de planejamento, a validar com a equipe clínica; altere para simular outro cenário.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data?.services.map((k) => (
            <label key={k} className="text-xs font-semibold text-black">
              {data.serviceLabels[k]}
              <input
                type="number"
                min={1}
                max={1000}
                value={capacity[k] ?? ""}
                onChange={(e) => setCapacity((c) => ({ ...c, [k]: Number(e.target.value) }))}
                className={`${input} mt-1`}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load(capacity)}
          className="mt-3 rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200 transition"
        >
          Recalcular
        </button>
      </section>

      <section className="rounded-2xl bg-white border border-linha p-2 shadow-suave">
        {MAPBOX_TOKEN ? (
          <div ref={mapEl} className="h-[420px] w-full rounded-xl" aria-label="Mapa das escolas de Tarumã" />
        ) : (
          <p className="p-4 text-sm text-black">
            Mapa indisponível: falta configurar o token público do Mapbox (NEXT_PUBLIC_MAPBOX_TOKEN). A tabela abaixo continua funcionando.
          </p>
        )}
        <p className="px-3 py-2 text-xs text-black">
          Círculo lilás = escola com dados (número = casos registrados). Escolas sem localização cadastrada aparecem nos gráficos e na tabela; informe o endereço para colocá-las no mapa.
        </p>
      </section>

      <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave overflow-x-auto">
        <h2 className="text-sm font-bold text-black mb-3">Escolas</h2>
        <table className="w-full text-sm text-black">
          <thead>
            <tr className="text-left text-xs border-b border-linha">
              <th className="py-2 pr-3">Escola</th>
              <th className="py-2 pr-3">Casos</th>
              <th className="py-2 pr-3">Por 1.000 matriculados</th>
              <th className="py-2 pr-3">Profissionais necessários</th>
              <th className="py-2">Sem informação</th>
            </tr>
          </thead>
          <tbody>
            {data && data.schools.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-neutral-500">
                  Nenhuma escola com dados populacionais cadastrada para este município ainda.
                </td>
              </tr>
            ) : (
              data?.schools.map((s) => (
                <tr
                  key={s.schoolId}
                  onClick={() => setSelected(s)}
                  className={`border-b border-linha cursor-pointer hover:bg-roxo-50 ${current?.schoolId === s.schoolId ? "bg-roxo-100" : ""}`}
                >
                  <td className="py-2 pr-3 font-semibold">{s.label}</td>
                  <td className="py-2 pr-3">{s.planning ? show(s.planning.casesRegistered) : "—"}</td>
                  <td className="py-2 pr-3">{s.planning?.ratePer1000 ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {s.planning ? `${s.planning.lowerBound ? "≥ " : ""}${s.planning.professionalsTotal}` : "—"}
                  </td>
                  <td className="py-2">
                    {s.semInformacao.length === 0 ? "Completa" : s.semInformacao.map((m) => (
                      <span key={m} className="mr-1 inline-block rounded-full border border-neutral-500 bg-neutral-100 px-2 py-0.5 text-[11px]">{m}</span>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {current && (
        <section className="rounded-2xl bg-white border border-linha p-4 shadow-suave grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-base font-bold text-black">{current.name}</h2>
            {current.planning ? (
              <div className="mt-2 space-y-3 text-sm text-black">
                <div>
                  <div className="text-xs font-semibold">Faixa etária (casos)</div>
                  {Object.entries(current.ageBands ?? {}).map(([k, v]) => (
                    <span key={k} className="mr-3">{k}: {show(v)}</span>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold">Profissionais necessários{current.planning.lowerBound ? " (mínimo; há valores ocultos)" : ""}</div>
                  <ul className="mt-1">
                    {data?.services.map((k) => (
                      <li key={k}>{data.serviceLabels[k]}: {current.planning!.professionals[k] ?? "<5 casos"}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold">Queixas mais registradas</div>
                  <ul className="mt-1">
                    {Object.entries(current.complaints ?? {})
                      .filter(([, v]) => v != null && v > 0)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 5)
                      .map(([k, v]) => <li key={k}>{k}: {v}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-black">Esta escola ainda não tem dados da base populacional vinculados. Informe a sigla da escola na base ao lado para vincular.</p>
            )}
          </div>
          <form onSubmit={saveGeo} className="space-y-3">
            <h3 className="text-sm font-bold text-black">Dados da escola (para o mapa)</h3>
            <label className="block text-xs font-semibold text-black">Endereço
              <input className={`${input} mt-1`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-black">Latitude
                <input className={`${input} mt-1`} inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-black">Longitude
                <input className={`${input} mt-1`} inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-black">Alunos matriculados
                <input className={`${input} mt-1`} inputMode="numeric" value={form.enrollment} onChange={(e) => setForm({ ...form, enrollment: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-black">Sigla na base
                <input className={`${input} mt-1`} value={form.externalCode} onChange={(e) => setForm({ ...form, externalCode: e.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200 transition">Salvar</button>
              <button type="button" onClick={geocode} className="rounded-xl bg-ceu-100 border border-ceu-700 px-4 py-2 text-sm font-semibold text-black hover:bg-ceu-300 transition">Localizar pelo endereço</button>
            </div>
            {geoMsg && <p role="status" className="text-xs text-black">{geoMsg}</p>}
          </form>
        </section>
      )}
    </div>
  );
}
