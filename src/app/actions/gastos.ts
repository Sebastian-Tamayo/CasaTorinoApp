"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaGasto, OrigenFondos } from "@/types/database";
import { CATEGORIAS } from "@/types/database";

export type GastoFormState = {
  error?: string;
  success?: boolean;
};

const ORIGENES: OrigenFondos[] = ["Efectivo_Caja", "Banco"];

export async function createGasto(
  _prev: GastoFormState,
  formData: FormData,
): Promise<GastoFormState> {
  const importeRaw = String(formData.get("importe") ?? "").replace(",", ".");
  const importe = Number.parseFloat(importeRaw);
  const concepto = String(formData.get("concepto") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "") as CategoriaGasto;
  const origen_fondos = String(
    formData.get("origen_fondos") ?? "",
  ) as OrigenFondos;

  if (!Number.isFinite(importe) || importe <= 0) {
    return { error: "Introduce un importe válido mayor que 0." };
  }
  if (!concepto) {
    return { error: "El concepto es obligatorio." };
  }
  if (!CATEGORIAS.includes(categoria)) {
    return { error: "Selecciona una categoría." };
  }
  if (!ORIGENES.includes(origen_fondos)) {
    return { error: "Selecciona el origen de los fondos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión caducada. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase.from("gastos").insert({
    importe,
    concepto,
    categoria,
    origen_fondos,
    user_id: user.id,
  });

  if (error) {
    return { error: `No se pudo guardar el gasto: ${error.message}` };
  }

  revalidatePath("/gestion");
  revalidatePath("/gestion/historial");
  return { success: true };
}
