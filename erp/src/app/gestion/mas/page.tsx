"use client";

import Link from "next/link";
import {
  Briefcase,
  Calculator,
  Clock,
  FolderOpen,
  LayoutGrid,
  Receipt,
  Truck,
} from "lucide-react";

const modules = [
  {
    href: "/gestion/caja",
    label: "Caja TPV",
    desc: "Cierres de jornada e historial mensual",
    icon: Receipt,
  },
  {
    href: "/gestion/rrhh",
    label: "RRHH",
    desc: "Empleados y liquidar nóminas",
    icon: Briefcase,
  },
  {
    href: "/gestion/historial",
    label: "Historial gastos",
    desc: "Gastos del mes (ingresos vienen del TPV)",
    icon: Clock,
  },
  {
    href: "/gestion/documentos",
    label: "Documentos",
    desc: "Facturas, albaranes y gestoría",
    icon: FolderOpen,
  },
  {
    href: "/gestion/proveedores",
    label: "Proveedores",
    desc: "Gasto agrupado por proveedor",
    icon: Truck,
  },
  {
    href: "/gestion/fiscal",
    label: "Fiscal",
    desc: "IVA trimestral e IRPF",
    icon: Calculator,
  },
] as const;

export default function MasPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-oro">
          <LayoutGrid className="size-3.5" aria-hidden />
          ERP Casa Torino
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">Módulos</h1>
        <p className="mt-1 text-sm text-ink/55">
          Recaudación TPV, personal, documentos e impuestos
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {modules.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-20 items-center gap-4 rounded-tpv-lg bg-card px-4 py-3 shadow-tpv transition active:scale-[0.99]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-tpv bg-oro/15 text-oro">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg text-ink">
                  {label}
                </span>
                <span className="block text-sm text-ink/55">{desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
