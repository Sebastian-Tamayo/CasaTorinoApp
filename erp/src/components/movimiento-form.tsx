"use client";

import { useState } from "react";
import { GastoForm } from "@/components/gasto-form";
import { IngresoForm } from "@/components/ingreso-form";

type Modo = "gasto" | "ingreso";

export function MovimientoForm() {
  const [modo, setModo] = useState<Modo>("ingreso");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Tipo de movimiento"
        className="grid grid-cols-2 gap-2 rounded-tpv bg-card p-1.5 shadow-tpv"
      >
        <button
          type="button"
          role="tab"
          aria-selected={modo === "ingreso"}
          onClick={() => setModo("ingreso")}
          className={`min-h-touch rounded-[0.75rem] text-sm font-bold transition active:scale-[0.98] ${
            modo === "ingreso"
              ? "bg-esmeralda text-white"
              : "bg-transparent text-ink/55"
          }`}
        >
          Registrar Ingreso
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "gasto"}
          onClick={() => setModo("gasto")}
          className={`min-h-touch rounded-[0.75rem] text-sm font-bold transition active:scale-[0.98] ${
            modo === "gasto"
              ? "bg-rojo-colombia text-white"
              : "bg-transparent text-ink/55"
          }`}
        >
          Registrar Gasto
        </button>
      </div>

      <div>
        <h1 className="font-display text-2xl text-ink">
          {modo === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          {modo === "ingreso"
            ? "Registra ventas de local o domicilios y el método de pago."
            : "Elige el origen de fondos antes de guardar — evita descuadres de caja."}
        </p>
      </div>

      {modo === "ingreso" ? <IngresoForm /> : <GastoForm />}
    </div>
  );
}
