"use client";

import { GastoForm } from "@/components/gasto-form";

export function MovimientoForm() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Registrar gasto</h1>
        <p className="mt-1 text-sm text-ink/55">
          Los <strong>ingresos</strong> ya no se registran aquí: llegan solos
          cuando el TPV hace <strong>Fin de sesión</strong>. Aquí solo apuntas
          gastos (proveedores, suministros, etc.).
        </p>
      </div>
      <GastoForm />
    </div>
  );
}
