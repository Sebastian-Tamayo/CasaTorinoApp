import { NextResponse } from "next/server";
import { hasErpPinSession } from "@/lib/erp-auth";
import { getOpsKvJson, hasOpsKvConfig } from "@/lib/ops-kv";
import {
  buildCierresResponse,
  emptyCierres,
  type CierreItem,
} from "@/lib/tpv-ops";

export const dynamic = "force-dynamic";

/** Historial de cierres TPV desde Supabase ops_kv (clave `cierres`). */
export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get("month") || "").trim();
    const raw = await getOpsKvJson<{
      items?: CierreItem[];
      updatedAt?: number;
    }>("cierres");
    const store = raw && typeof raw === "object" ? raw : emptyCierres();
    return NextResponse.json(buildCierresResponse(store, month));
  } catch (err) {
    console.error("[erp/api/cierres]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ops_kv" },
      { status: 500 },
    );
  }
}
