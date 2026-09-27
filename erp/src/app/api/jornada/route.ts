import { NextResponse } from "next/server";
import { hasErpPinSession } from "@/lib/erp-auth";

export const dynamic = "force-dynamic";

const JORNADA_URL =
  process.env.TPV_JORNADA_URL ||
  process.env.NEXT_PUBLIC_TPV_JORNADA_URL ||
  "https://casa-torino-web.vercel.app/api/tpv-jornada";

function authHeaders(): HeadersInit {
  const syncKey = (process.env.TPV_SYNC_KEY || "").trim();
  const erpPin = (process.env.ERP_PIN || process.env.TPV_PIN || "").trim();
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
  };
  if (syncKey) headers["X-Tpv-Key"] = syncKey;
  else if (erpPin) headers["X-Erp-Pin"] = erpPin;
  return headers;
}

/** Proxy autenticado a la jornada TPV (incluye ventas con caja abierta). */
export async function GET() {
  const ok = await hasErpPinSession();
  if (!ok) {
    return NextResponse.json({ error: "Sesión ERP requerida" }, { status: 401 });
  }

  const r = await fetch(JORNADA_URL, {
    cache: "no-store",
    headers: authHeaders(),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
