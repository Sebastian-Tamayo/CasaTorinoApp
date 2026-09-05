"use client";

import { listarMesesHistorico, labelMes, type MesKey } from "@/lib/meses";

type MonthSelectorProps = {
  value: MesKey;
  onChange: (mes: MesKey) => void;
  id?: string;
};

export function MonthSelector({
  value,
  onChange,
  id = "selector-mes",
}: MonthSelectorProps) {
  const opciones = listarMesesHistorico(18);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
        Mes a consultar
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-touch w-full appearance-none rounded-tpv border border-ink/10 bg-card px-4 pr-10 font-sans text-base font-semibold text-ink shadow-tpv outline-none ring-azul-colombia/30 focus:ring-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231C2541' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.9rem center",
        }}
      >
        {opciones.map((key) => (
          <option key={key} value={key}>
            {labelMes(key)}
          </option>
        ))}
      </select>
    </label>
  );
}
