export const LOTES_TABLE = "las_lomas_lotes";

export const CRM_ESTADOS = [
  "DISPONIBLE",
  "EN_NEGOCIACION",
  "SEPARADO",
  "VENDIDO",
  "BLOQUEADO",
] as const;

export type CrmEstado = (typeof CRM_ESTADOS)[number];

export type CrmRole =
  | "admin"
  | "jefe_ventas"
  | "asesor";

export const esAdmin = (
  profile?: Pick<Profile, "role"> | null
) => profile?.role === "admin";

export const esGerencia = (
  profile?: Pick<Profile, "role"> | null
) =>
  profile?.role === "admin" ||
  profile?.role === "jefe_ventas";

export const etiquetaRol = (
  role: CrmRole | string | null | undefined
) => {
  switch (role) {
    case "admin":
      return "Admin";
    case "jefe_ventas":
      return "Jefe de ventas";
    case "asesor":
      return "Asesor";
    default:
      return "Usuario";
  }
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: CrmRole;
  phone: string | null;
  active: boolean;
};

export type Cliente = {
  id: string;
  nombres: string;
  apellidos: string | null;
  dni: string | null;
  celular: string | null;
  correo: string | null;
  direccion: string | null;
  fuente: string | null;
  observaciones: string | null;
  asesor_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LoteCrm = {
  id: number;
  mz: string;
  lote: number;
  area: number;
  precio: number;
  estado: string;
  svg_id: string;
  cliente_id?: string | null;
  asesor_id?: string | null;
  updated_at?: string | null;
};

export type Separacion = {
  id: string;
  cliente_id: string | null;
  lote_id: number | null;
  asesor_id: string | null;
  monto_separacion: number | null;
  fecha_separacion: string | null;
  fecha_limite: string | null;
  estado: string;
  observaciones: string | null;
  created_at?: string;
  updated_at?: string;
};

export const etiquetaEstado = (
  estado: string | null | undefined
) => {
  switch ((estado || "").toUpperCase()) {
    case "DISPONIBLE":
      return "Disponible";
    case "EN_NEGOCIACION":
      return "En negociacion";
    case "SEPARADO":
      return "Separado";
    case "VENDIDO":
      return "Vendido";
    case "BLOQUEADO":
      return "Bloqueado";
    default:
      return estado || "Sin estado";
  }
};

export const colorEstado = (
  estado: string | null | undefined
) => {
  switch ((estado || "").toUpperCase()) {
    case "DISPONIBLE":
      return {
        bg: "#E6F4EA",
        fg: "#17633A",
      };
    case "EN_NEGOCIACION":
      return {
        bg: "#FFF3D6",
        fg: "#8A5A00",
      };
    case "SEPARADO":
      return {
        bg: "#F7E8D0",
        fg: "#7A4B12",
      };
    case "VENDIDO":
      return {
        bg: "#F7DAD6",
        fg: "#8B2F25",
      };
    case "BLOQUEADO":
      return {
        bg: "#E5E7EB",
        fg: "#374151",
      };
    default:
      return {
        bg: "#EEF2F7",
        fg: "#334155",
      };
  }
};

export const formatearMoneda = (
  valor: number | string | null | undefined
) =>
  `S/ ${Number(valor || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatearArea = (
  valor: number | string | null | undefined
) =>
  `${Number(valor || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m2`;

export const nombreCliente = (
  cliente?: Pick<
    Cliente,
    "nombres" | "apellidos"
  > | null
) =>
  cliente
    ? `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim()
    : "";
