export type CategoriaGasto =
  | "Proveedores"
  | "Personal"
  | "Servicios"
  | "Alquiler"
  | "Mantenimiento"
  | "Marketing"
  | "Impuestos"
  | "Transporte"
  | "Otros"
  | "Nóminas y SS";

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
  proveedor_nombre: string | null;
  base_imponible: number;
  porcentaje_iva: number;
};

export type Ingreso = {
  id: string;
  importe: number;
  categoria: CategoriaIngreso;
  metodo_pago: MetodoPago;
  user_id: string;
  created_at: string;
  base_imponible: number;
  porcentaje_iva: number;
};

export type Empleado = {
  id: string;
  created_at: string;
  nombre: string;
  puesto: string;
  salario_bruto: number;
  coste_seguridad_social: number;
  porcentaje_retencion_irpf: number;
  activo: boolean;
};

export type NominaPagada = {
  id: string;
  created_at: string;
  empleado_id: string;
  mes_anio: string;
  importe_neto: number;
  importe_irpf: number;
};

export type CategoriaDocumento =
  | "factura_proveedor"
  | "albaran"
  | "contrato_empleado"
  | "impuesto"
  | "otro";

export type Documento = {
  id: string;
  created_at: string;
  nombre: string;
  url_archivo: string;
  storage_path: string;
  categoria: CategoriaDocumento;
  gasto_id: string | null;
  proveedor_nombre: string | null;
  user_id: string;
};

export const CATEGORIAS_DOCUMENTO: {
  value: CategoriaDocumento;
  label: string;
}[] = [
  { value: "factura_proveedor", label: "Factura proveedor" },
  { value: "albaran", label: "Albarán" },
  { value: "contrato_empleado", label: "Contrato empleado" },
  { value: "impuesto", label: "Impuesto" },
  { value: "otro", label: "Otro" },
];

export const DOCUMENTOS_BUCKET = "documentos_adjuntos";

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
  "Nóminas y SS",
];

/** Categorías que cuentan como gasto operativo (no laboral) en P&G */
export const CATEGORIAS_OPERATIVAS: CategoriaGasto[] = [
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

export const IVA_OPCIONES = [0, 4, 10, 21] as const;

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
          proveedor_nombre?: string | null;
          base_imponible: number;
          porcentaje_iva?: number;
        };
        Update: Partial<Gasto>;
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
          base_imponible: number;
          porcentaje_iva?: number;
        };
        Update: Partial<Ingreso>;
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
      empleados: {
        Row: Empleado;
        Insert: {
          id?: string;
          created_at?: string;
          nombre: string;
          puesto: string;
          salario_bruto: number;
          coste_seguridad_social?: number;
          porcentaje_retencion_irpf?: number;
          activo?: boolean;
        };
        Update: Partial<Empleado>;
        Relationships: [];
      };
      nominas_pagadas: {
        Row: NominaPagada;
        Insert: {
          id?: string;
          created_at?: string;
          empleado_id: string;
          mes_anio: string;
          importe_neto: number;
          importe_irpf: number;
        };
        Update: Partial<NominaPagada>;
        Relationships: [
          {
            foreignKeyName: "nominas_pagadas_empleado_id_fkey";
            columns: ["empleado_id"];
            isOneToOne: false;
            referencedRelation: "empleados";
            referencedColumns: ["id"];
          },
        ];
      };
      documentos: {
        Row: Documento;
        Insert: {
          id?: string;
          created_at?: string;
          nombre: string;
          url_archivo: string;
          storage_path: string;
          categoria: CategoriaDocumento;
          gasto_id?: string | null;
          proveedor_nombre?: string | null;
          user_id?: string;
        };
        Update: Partial<Documento>;
        Relationships: [
          {
            foreignKeyName: "documentos_gasto_id_fkey";
            columns: ["gasto_id"];
            isOneToOne: false;
            referencedRelation: "gastos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documentos_user_id_fkey";
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
