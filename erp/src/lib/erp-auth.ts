import { cookies } from "next/headers";

export const ERP_PIN_COOKIE = "ct_erp_session";
export const ERP_PIN_MAX_AGE = 60 * 60 * 8; // 8 h jornada oficina

export function expectedErpPin() {
  return (
    process.env.ERP_PIN ||
    process.env.TPV_PIN ||
    "3212"
  ).trim();
}

export async function hasErpPinSession() {
  const jar = await cookies();
  return jar.get(ERP_PIN_COOKIE)?.value === "1";
}
