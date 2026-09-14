import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ERP_PIN_COOKIE } from "@/lib/erp-auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isApiAuth = path.startsWith("/api/erp-auth");
  if (isApiAuth) return supabaseResponse;

  const hasPin = request.cookies.get(ERP_PIN_COOKIE)?.value === "1";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Mantener sesión Supabase si existe (RRHH / gastos / documentos)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGestion = path.startsWith("/gestion");
  const isLogin = path === "/login";
  // Acceso ERP solo por PIN (como TPV / cocina). Supabase sigue para datos.
  const allowed = Boolean(hasPin);

  if (isGestion && !allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLogin && allowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/gestion";
    return NextResponse.redirect(url);
  }

  // user se consulta para refrescar cookies de sesión Supabase si existe
  void user;

  return supabaseResponse;
}
