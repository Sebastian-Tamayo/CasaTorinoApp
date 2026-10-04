/** URLs del ecosistema Casa Torino (accesos del personal). */
export const ECOSISTEMA = {
  webPublica: "https://casa-torino-web.vercel.app",
  interno: "https://casa-torino-web.vercel.app/interno.html",
  reservas: "https://reservas-casatorino.vercel.app",
  tpv: "https://casa-torino-web.vercel.app/tpv.html",
  cocina: "https://casa-torino-web.vercel.app/cocina.html",
  erpLogin: "https://casa-torino-app.vercel.app/login",
  erpApp: "https://casa-torino-app.vercel.app/gestion",
  // Caja / Top ventas: el ERP lee Supabase ops_kv (claves cierres + jornada)
  cierresApi: "/api/cierres",
  jornadaApi: "/api/jornada",
} as const;
