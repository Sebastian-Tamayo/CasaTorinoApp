"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createIngreso, type IngresoFormState } from "@/app/actions/ingresos";
import { totalConIva } from "@/lib/fiscal";
import {
  CATEGORIAS_INGRESO,
  IVA_OPCIONES,
  METODOS_PAGO,
  type CategoriaIngreso,
  type MetodoPago,
} from "@/types/database";

const initial: IngresoFormState = {};

export function IngresoForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createIngreso, initial);
  const [categoria, setCategoria] = useState<CategoriaIngreso | "">("");
  const [metodo, setMetodo] = useState<MetodoPago | "">("");
  const [base, setBase] = useState("");
  const [iva, setIva] = useState(10);

  const baseNum = Number.parseFloat(base.replace(",", ".")) || 0;
  const total = useMemo(() => totalConIva(baseNum, iva), [baseNum, iva]);

  useEffect(() => {
    if (state.success) {
      router.push("/gestion/historial");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink/60">
          Base imponible (€)
        </span>
        <input
          name="base_imponible"
          type="text"
          inputMode="decimal"
          required
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="0,00"
          className="min-h-14 rounded-tpv border border-ink/10 bg-card px-4 font-display text-3xl text-ink outline-none ring-esmeralda/30 focus:ring-2"
        />
      </label>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          IVA %
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {IVA_OPCIONES.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setIva(pct)}
              className={`min-h-touch rounded-tpv border text-sm font-bold transition active:scale-[0.98] ${
                iva === pct
                  ? "border-esmeralda bg-esmeralda text-white"
                  : "border-ink/10 bg-card text-ink"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
        <input type="hidden" name="porcentaje_iva" value={iva} />
        <p className="mt-2 text-sm text-ink/55">
          Total cobrado:{" "}
          <span className="font-display font-bold text-ink">
            {total.toLocaleString("es-ES", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Categoría
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIAS_INGRESO.map(({ value, label }) => {
            const selected = categoria === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategoria(value)}
                className={`flex min-h-20 flex-col items-center justify-center rounded-tpv-lg border px-3 text-center text-sm font-bold transition active:scale-[0.98] ${
                  selected
                    ? "border-esmeralda bg-esmeralda text-white ring-2 ring-esmeralda"
                    : "border-ink/10 bg-card text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="categoria" value={categoria} required />
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
          Método de pago
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {METODOS_PAGO.map(({ value, label }) => {
            const selected = metodo === value;
            const active =
              value === "efectivo"
                ? "border-oro bg-oro/20 text-ink ring-2 ring-oro"
                : "border-azul-asturias bg-azul-asturias/15 text-ink ring-2 ring-azul-asturias";

            return (
              <button
                key={value}
                type="button"
                onClick={() => setMetodo(value)}
                className={`flex min-h-20 flex-col items-center justify-center rounded-tpv-lg border px-3 text-center text-base font-bold transition active:scale-[0.98] ${
                  selected ? active : "border-ink/10 bg-card text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="metodo_pago" value={metodo} required />
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-tpv bg-rojo-colombia/10 px-3 py-2 text-sm text-rojo-colombia"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !categoria || !metodo || baseNum <= 0}
        className="min-h-14 rounded-tpv bg-esmeralda text-lg font-bold text-white shadow-tpv transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Registrar ingreso"}
      </button>
    </form>
  );
}
