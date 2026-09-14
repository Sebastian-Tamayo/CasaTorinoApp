import { NextResponse } from "next/server";
import {
  ERP_PIN_COOKIE,
  ERP_PIN_MAX_AGE,
  expectedErpPin,
} from "@/lib/erp-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const ok = cookie.split(";").some((c) => c.trim() === `${ERP_PIN_COOKIE}=1`);
  const res = NextResponse.json({ ok, maxAgeHours: 24 });
  if (ok) {
    // Sliding renewal — ERP abierto toda la jornada
    res.cookies.set(ERP_PIN_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ERP_PIN_MAX_AGE,
    });
  }
  return res;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();
  const refresh = Boolean(body.refresh);
  const cookie = request.headers.get("cookie") || "";
  const hasSession = cookie
    .split(";")
    .some((c) => c.trim() === `${ERP_PIN_COOKIE}=1`);

  if (refresh) {
    if (!hasSession) {
      return NextResponse.json(
        { ok: false, error: "Sesión caducada" },
        { status: 401 },
      );
    }
    const res = NextResponse.json({ ok: true, refreshed: true });
    res.cookies.set(ERP_PIN_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ERP_PIN_MAX_AGE,
    });
    return res;
  }

  const expected = expectedErpPin();

  if (!expected || pin !== expected) {
    return NextResponse.json({ ok: false, error: "PIN incorrecto" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ERP_PIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: ERP_PIN_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ERP_PIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
