"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createGasto, type GastoFormState } from "@/app/actions/gastos";
import { CATEGORIAS, type OrigenFondos } from "@/types/database";

const initial: GastoFormState = {};

export function GastoForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createGasto, initial);
  const [origen, setOrigen] = useState<OrigenFondos | "">("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    if (state.success) {
      router.push("/gestion/historial");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Origen de fondos — botones grandes TPV */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Origen de los fondos
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <OrigenButton
            value="Efectivo_Caja"
            label="Efectivo Caja"
            hint="Caja física"
            selected={origen === "Efectivo_Caja"}
            onSelect={setOrigen}
            tone="caja"
          />
          <OrigenButton
            value="Banco"
            label="Banco"
            hint="Transferencia / tarjeta"
            selected={origen === "Banco"}
            onSelect={setOrigen}
            tone="banco"
          />
        </div>
        <input type="hidden" name="origen_fondos" value={origen} required />
      </fieldset>

      {/* Importe */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Importe (€)
        </span>
        <input
          name="importe"
          type="text"
          inputMode="decimal"
          required
          placeholder="0,00"
          className="min-h-14 rounded-tpv border border-ink/10 bg-card px-4 font-display text-3xl text-ink outline-none ring-azul-colombia/30 focus:ring-2"
        />
      </label>

      {/* Concepto */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Concepto
        </span>
        <input
          name="concepto"
          type="text"
          required
          maxLength={200}
          placeholder="Ej. Compra verdura mercado"
          className="min-h-touch rounded-tpv border border-ink/10 bg-card px-4 text-base text-ink outline-none ring-azul-colombia/30 focus:ring-2"
        />
      </label>

      {/* Categoría */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Categoría
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS.map((cat) => {
            const selected = categoria === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`min-h-touch rounded-tpv border px-3 text-sm font-medium transition active:scale-[0.98] ${
                  selected
                    ? "border-esmeralda bg-esmeralda text-white"
                    : "border-ink/10 bg-card text-ink"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="categoria" value={categoria} required />
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-sm text-rojo-colombia"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          role="status"
          className="rounded-tpv bg-esmeralda/10 px-3 py-2 text-sm text-esmeralda"
        >
          Gasto registrado correctamente.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !origen || !categoria}
        className="min-h-14 rounded-tpv bg-amarillo-colombia text-lg font-bold text-ink shadow-tpv transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar gasto"}
      </button>
    </form>
  );
}

function OrigenButton({
  value,
  label,
  hint,
  selected,
  onSelect,
  tone,
}: {
  value: OrigenFondos;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: (v: OrigenFondos) => void;
  tone: "caja" | "banco";
}) {
  const active =
    tone === "caja"
      ? "border-oro bg-oro/20 text-ink ring-2 ring-oro"
      : "border-azul-asturias bg-azul-asturias/15 text-ink ring-2 ring-azul-asturias";

  const idle = "border-ink/10 bg-card text-ink";

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-tpv-lg border px-3 text-center transition active:scale-[0.98] ${
        selected ? active : idle
      }`}
    >
      <span className="text-base font-bold leading-tight">{label}</span>
      <span className="text-xs text-ink/50">{hint}</span>
    </button>
  );
}
