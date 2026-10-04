import { NextResponse } from "next/server";
import { hasErpPinSession } from "@/lib/erp-auth";
import { getOpsKvJson, hasOpsKvConfig } from "@/lib/ops-kv";
import {
  emptyJornada,
  withJornadaTotals,
  type JornadaState,
} from "@/lib/tpv-ops";

export const dynamic = "force-dynamic";

/** Jornada TPV en vivo desde Supabase ops_kv (clave `jornada`). */
export async function GET() {
  const ok = await hasErpPinSession();
  if (!ok) {
    return NextResponse.json({ error: "Sesión ERP requerida" }, { status: 401 });
  }
  if (!hasOpsKvConfig()) {
    return NextResponse.json(
      { error: "Falta configuración Supabase en el ERP" },
      { status: 500 },
    );
  }

  try {
    const raw = await getOpsKvJson<JornadaState>("jornada");
    const state =
      raw && typeof raw === "object"
        ? {
            ...emptyJornada(),
            ...raw,
            sales: Array.isArray(raw.sales) ? raw.sales : [],
          }
        : emptyJornada();
    return NextResponse.json(withJornadaTotals(state));
  } catch (err) {
    console.error("[erp/api/jornada]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ops_kv" },
      { status: 500 },
    );
  }
}
