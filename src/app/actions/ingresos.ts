"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaIngreso, MetodoPago } from "@/types/database";
import { CATEGORIAS_INGRESO, METODOS_PAGO } from "@/types/database";

export type IngresoFormState = {
  error?: string;
  success?: boolean;
};

export async function createIngreso(
  _prev: IngresoFormState,
  formData: FormData,
): Promise<IngresoFormState> {
  const importeRaw = String(formData.get("importe") ?? "").replace(",", ".");
  const importe = Number.parseFloat(importeRaw);
  const categoria = String(formData.get("categoria") ?? "") as CategoriaIngreso;
  const metodo_pago = String(formData.get("metodo_pago") ?? "") as MetodoPago;

  if (!Number.isFinite(importe) || importe <= 0) {
    return { error: "Introduce un importe válido mayor que 0." };
  }
  if (!CATEGORIAS_INGRESO.some((c) => c.value === categoria)) {
    return { error: "Selecciona una categoría de ingreso." };
  }
  if (!METODOS_PAGO.some((m) => m.value === metodo_pago)) {
    return { error: "Selecciona el método de pago." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión caducada. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase.from("ingresos").insert({
    importe,
    categoria,
    metodo_pago,
    user_id: user.id,
  });

  if (error) {
    return { error: `No se pudo guardar el ingreso: ${error.message}` };
  }

  revalidatePath("/gestion");
  revalidatePath("/gestion/historial");
  return { success: true };
}
