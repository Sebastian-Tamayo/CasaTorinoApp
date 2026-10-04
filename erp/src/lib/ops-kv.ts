/**
 * Lectura de public.ops_kv en Supabase (mismo store que el TPV).
 * Prefer service role; anon también funciona por RLS de ops_kv.
 */

function cleanToken(raw: string | undefined | null): string {
  let t = String(raw || "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1);
  }
  return t.trim();
}

function supabaseConfig() {
  const url = cleanToken(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).replace(/\/$/, "");
  const key = cleanToken(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
  return { url, key };
}

export function hasOpsKvConfig(): boolean {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

/** Lee el JSON de una clave ops_kv. null si no existe. */
export async function getOpsKvJson<T = unknown>(
  key: string,
): Promise<T | null> {
  const { url, key: apiKey } = supabaseConfig();
  if (!url || !apiKey) {
    throw new Error(
      "Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o ANON) en el ERP",
    );
  }
  const endpoint =
    `${url}/rest/v1/ops_kv?key=eq.${encodeURIComponent(key)}` +
    `&select=key,value,updated_at`;
  const r = await fetch(endpoint, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  let data: unknown = null;
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!r.ok) {
    let msg = `supabase ${r.status}`;
    if (data && typeof data === "object") {
      const d = data as { message?: unknown; error?: unknown };
      const candidate = d.message ?? d.error;
      if (typeof candidate === "string" && candidate.trim()) msg = candidate;
    } else if (typeof data === "string" && data.trim()) {
      msg = data;
    }
    throw new Error(msg);
  }
  if (!Array.isArray(data) || !data.length) return null;
  const row = data[0] as { value?: T };
  return row?.value ?? null;
}
