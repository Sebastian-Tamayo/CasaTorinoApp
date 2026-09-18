/** Cuota IVA = base * (porcentaje / 100) */
export function cuotaIva(base: number, porcentaje: number) {
  return round2((base * porcentaje) / 100);
}

/** Total con IVA = base + cuota */
export function totalConIva(base: number, porcentaje: number) {
  return round2(base + cuotaIva(base, porcentaje));
}

/** Base a partir del total con IVA */
export function baseDesdeTotal(total: number, porcentaje: number) {
  if (porcentaje === 0) return round2(total);
  return round2(total / (1 + porcentaje / 100));
}

/** Euros → céntimos enteros (evita 19.999999999). */
export function toCents(n: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100);
}

/** Céntimos → euros con 2 decimales exactos. */
export function fromCents(cents: number) {
  return Math.round(Number(cents) || 0) / 100;
}

/** Redondeo monetario a 2 decimales vía céntimos. */
export function round2(n: number) {
  return fromCents(toCents(n));
}

export function parseDecimal(raw: string) {
  const n = Number.parseFloat(String(raw).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Parsea importe y lo deja en 2 decimales (o NaN). */
export function parseMoney(raw: string) {
  const n = parseDecimal(raw);
  return Number.isFinite(n) ? round2(n) : NaN;
}
