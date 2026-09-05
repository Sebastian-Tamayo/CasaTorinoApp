export type CategoriaGasto =
  | "Proveedores"
  | "Personal"
  | "Servicios"
  | "Alquiler"
  | "Mantenimiento"
  | "Marketing"
  | "Impuestos"
  | "Transporte"
  | "Otros";

export type OrigenFondos = "Efectivo_Caja" | "Banco";

export type CategoriaIngreso = "venta_local" | "domicilios";

export type MetodoPago = "tarjeta" | "efectivo";

export type Gasto = {
  id: string;
  importe: number;
  concepto: string;
  categoria: CategoriaGasto;
  origen_fondos: OrigenFondos;
  user_id: string;
  created_at: string;
};

export type Ingreso = {
  id: string;
  importe: number;
  categoria: CategoriaIngreso;
  metodo_pago: MetodoPago;
  user_id: string;
  created_at: string;
};

export const CATEGORIAS: CategoriaGasto[] = [
  "Proveedores",
  "Personal",
  "Servicios",
  "Alquiler",
  "Mantenimiento",
  "Marketing",
  "Impuestos",
  "Transporte",
  "Otros",
];

export const CATEGORIAS_INGRESO: {
  value: CategoriaIngreso;
  label: string;
}[] = [
  { value: "venta_local", label: "Venta en Local" },
  { value: "domicilios", label: "Domicilios" },
];

export const METODOS_PAGO: {
  value: MetodoPago;
  label: string;
}[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      gastos: {
        Row: Gasto;
        Insert: {
          id?: string;
          importe: number;
          concepto: string;
          categoria: CategoriaGasto;
          origen_fondos: OrigenFondos;
          user_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          importe?: number;
          concepto?: string;
          categoria?: CategoriaGasto;
          origen_fondos?: OrigenFondos;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gastos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ingresos: {
        Row: Ingreso;
        Insert: {
          id?: string;
          importe: number;
          categoria: CategoriaIngreso;
          metodo_pago: MetodoPago;
          user_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          importe?: number;
          categoria?: CategoriaIngreso;
          metodo_pago?: MetodoPago;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingresos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      categoria_gasto: CategoriaGasto;
      origen_fondos: OrigenFondos;
    };
    CompositeTypes: Record<string, never>;
  };
};
