"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Building2, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Gasto } from "@/types/database";

function formatFecha(iso: string) {
  const d = new Date(iso);
  const diaMes = d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  const hora = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${diaMes} · ${hora}`;
}

function formatImporte(importe: number) {
  return Number(importe).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

function OrigenBadge({ origen }: { origen: Gasto["origen_fondos"] }) {
  const esCaja = origen === "Efectivo_Caja";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        esCaja
          ? "bg-oro/20 text-ink"
          : "bg-azul-asturias/15 text-azul-asturias"
      }`}
    >
      {esCaja ? (
        <Banknote className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Building2 className="size-3.5 shrink-0" aria-hidden />
      )}
      {esCaja ? "Efectivo" : "Banco"}
    </span>
  );
}

function HistorialSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-ink/50">Cargando…</p>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-tpv-lg bg-card p-4 shadow-tpv"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-8 w-28 rounded bg-ink/10" />
            <div className="h-5 w-20 rounded bg-ink/10" />
          </div>
          <div className="mt-3 h-4 w-3/4 rounded bg-ink/10" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-24 rounded-full bg-ink/10" />
            <div className="h-6 w-20 rounded-full bg-ink/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GastoCard({ gasto }: { gasto: Gasto }) {
  return (
    <article className="rounded-tpv-lg bg-card p-4 shadow-tpv">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-2xl font-bold leading-none text-ink">
          {formatImporte(gasto.importe)}
        </p>
        <time
          dateTime={gasto.created_at}
          className="shrink-0 text-xs font-medium capitalize text-ink/50"
        >
          {formatFecha(gasto.created_at)}
        </time>
      </div>

      <p className="mt-2 truncate font-sans text-sm font-medium text-ink/80">
        {gasto.concepto}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-esmeralda/10 px-2.5 py-1 text-xs font-semibold text-esmeralda">
          {gasto.categoria}
        </span>
        <OrigenBadge origen={gasto.origen_fondos} />
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-tpv-lg bg-card px-6 py-12 text-center shadow-tpv">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-cream">
        <Receipt className="size-7 text-ink/35" aria-hidden />
      </div>
      <p className="font-display text-xl text-ink">Sin movimientos aún</p>
      <p className="mt-2 max-w-xs text-sm text-ink/55">
        Cuando registres un gasto, aparecerá aquí al instante. La caja y el
        banco quedarán trazados.
      </p>
      <Link
        href="/gestion/nuevo"
        className="mt-6 inline-flex min-h-touch items-center justify-center rounded-tpv bg-amarillo-colombia px-6 text-sm font-bold text-ink shadow-tpv transition active:scale-[0.98]"
      >
        Registrar primer gasto
      </Link>
    </div>
  );
}

export function HistorialGastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("gastos")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setGastos([]);
      } else {
        setGastos((data as Gasto[]) ?? []);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Historial</h1>
        <p className="mt-1 font-sans text-sm text-ink/55">
          Movimientos más recientes primero
        </p>
      </header>

      {loading ? <HistorialSkeleton /> : null}

      {!loading && error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-4 py-3 text-sm text-rojo-colombia"
        >
          No se pudo cargar el historial: {error}
        </p>
      ) : null}

      {!loading && !error && gastos.length === 0 ? <EmptyState /> : null}

      {!loading && !error && gastos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {gastos.map((gasto) => (
            <li key={gasto.id}>
              <GastoCard gasto={gasto} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
