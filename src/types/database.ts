export type CategoriaGasto =
  | "Ingredientes"
  | "Personal"
  | "Servicios"
  | "Alquiler"
  | "Mantenimiento"
  | "Marketing"
  | "Impuestos"
  | "Transporte"
  | "Otros";

export type OrigenFondos = "Efectivo_Caja" | "Banco";

export type Gasto = {
  id: string;
  importe: number;
  concepto: string;
  categoria: CategoriaGasto;
  origen_fondos: OrigenFondos;
  user_id: string;
  created_at: string;
};

export const CATEGORIAS: CategoriaGasto[] = [
  "Ingredientes",
  "Personal",
  "Servicios",
  "Alquiler",
  "Mantenimiento",
  "Marketing",
  "Impuestos",
  "Transporte",
  "Otros",
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
