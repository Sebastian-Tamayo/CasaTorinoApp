"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  loadTopVentas,
  type TopPeriodo,
  type TopProducto,
} from "@/lib/top-ventas";
import { descargarInformeTopVentas } from "@/lib/descargar-informe";
import { round2 } from "@/lib/fiscal";

function formatImporte(importe: number) {
  return round2(Number(importe) || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function formatQty(qty: number) {
  const n = Number(qty) || 0;
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

const TOP_PERIODOS: { id: TopPeriodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "trimestre", label: "Trimestre" },
];

type Props = {
  /** Si true, muestra cabecera de página (ruta dedicada). */
  showPageHeader?: boolean;
};

export function TopVentasView({ showPageHeader = false }: Props) {
  const [topPeriodo, setTopPeriodo] = useState<TopPeriodo>("hoy");
  const [topProducts, setTopProducts] = useState<TopProducto[]>([]);
  const [topLabel, setTopLabel] = useState("Hoy");
  const [topTickets, setTopTickets] = useState(0);
  const [topTotal, setTopTotal] = useState(0);
  const [topOpenJornada, setTopOpenJornada] = useState(false);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTop() {
      setTopLoading(true);
      setTopError(null);
      try {
        const data = await loadTopVentas(topPeriodo);
        if (cancelled) return;
        setTopProducts(data.products || []);
        setTopLabel(data.label);
        setTopTickets(data.tickets || 0);
        setTopTotal(round2(data.total || 0));
        setTopOpenJornada(Boolean(data.fromOpenJornada));
      } catch (err) {
        if (!cancelled) {
          setTopError(
            err instanceof Error ? err.message : "Error al cargar top ventas",
          );
          setTopProducts([]);
        }
      } finally {
        if (!cancelled) setTopLoading(false);
      }
    }
    void loadTop();
    return () => {
      cancelled = true;
    };
  }, [topPeriodo]);

  function onDescargar() {
    descargarInformeTopVentas({
      periodo: topPeriodo,
      label: topLabel,
      products: topProducts,
      tickets: topTickets,
      total: topTotal,
      fromOpenJornada: topOpenJornada,
    });
  }

  const canDownload = !topLoading && !topError;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="top-ventas-title">
      {showPageHeader ? (
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-oro">
            Ranking TPV
          </p>
          <h1 id="top-ventas-title" className="mt-1 font-display text-2xl text-ink">
            Productos más vendidos
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            Ventas cobradas del TPV · {topLabel}
            {topOpenJornada ? " · caja abierta en vivo" : ""}
            {!topLoading && !topError
              ? ` · ${topProducts.length} productos`
              : ""}
          </p>
        </header>
      ) : (
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-oro">
            Ranking
          </p>
          <h2 id="top-ventas-title" className="mt-1 font-display text-xl text-ink">
            Productos más vendidos
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            Ventas cobradas del TPV · {topLabel}
            {topOpenJornada ? " · caja abierta en vivo" : ""}
            {!topLoading && !topError
              ? ` · ${topProducts.length} productos`
              : ""}
          </p>
        </header>
      )}

      <div
        className="grid grid-cols-4 gap-2"
        role="tablist"
        aria-label="Periodo top ventas"
      >
        {TOP_PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={topPeriodo === p.id}
            onClick={() => setTopPeriodo(p.id)}
            className={`min-h-touch rounded-tpv text-sm font-bold transition active:scale-[0.98] ${
              topPeriodo === p.id
                ? "bg-oro text-ink"
                : "bg-card text-ink shadow-tpv"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onDescargar}
        disabled={!canDownload}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-tpv bg-ink text-sm font-bold text-cream shadow-tpv transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Download className="size-4" aria-hidden />
        Descargar informe · {topLabel}
      </button>
      <p className="text-center text-[11px] text-ink/45">
        Excel (.xls) + vista para guardar PDF
      </p>

      {topLoading ? (
        <p className="text-sm text-ink/50">Cargando ranking…</p>
      ) : topError ? (
        <p className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia">
          {topError}
        </p>
      ) : (
        <article className="overflow-hidden rounded-tpv-lg bg-card shadow-tpv">
          <div className="border-b border-ink/5 px-4 py-3 text-xs text-ink/50">
            {topTickets} tickets · {formatImporte(topTotal)}
          </div>
          {topProducts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink/50">
              Sin ventas en este periodo.
            </p>
          ) : (
            <ol className="divide-y divide-ink/5">
              {topProducts.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oro/15 text-xs font-extrabold text-oro">
                    {i + 1}º
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink">
                      {p.name}
                    </span>
                    <span className="block text-xs text-ink/50">
                      {formatQty(p.qty)} uds
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-base font-bold text-ink">
                    {formatImporte(p.total)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      )}
    </section>
  );
}
