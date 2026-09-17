import { NextResponse } from "next/server";
import { hasErpPinSession } from "@/lib/erp-auth";

export const dynamic = "force-dynamic";

const CONSUMO_URL =
  process.env.TPV_CONSUMO_URL ||
  process.env.NEXT_PUBLIC_TPV_CONSUMO_URL ||
  "https://casa-torino-web.vercel.app/api/tpv-consumo";

function syncHeaders(): HeadersInit {
  const syncKey = (process.env.TPV_SYNC_KEY || "").trim();
  const erpPin = (
    process.env.ERP_PIN ||
    process.env.TPV_PIN ||
    ""
  ).trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (syncKey) headers["X-Tpv-Key"] = syncKey;
  else if (erpPin) headers["X-Erp-Pin"] = erpPin;
  return headers;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || "";
  const url = new URL(CONSUMO_URL);
  if (month) url.searchParams.set("month", month);

  const r = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "Cache-Control": "no-store" },
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

export async function POST(request: Request) {
  const ok = await hasErpPinSession();
  if (!ok) {
    return NextResponse.json({ error: "Sesión ERP requerida" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const r = await fetch(CONSUMO_URL, {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}
