export const LOTES_TABLE = "las_lomas_lotes";

export const CRM_ESTADOS = [
  "DISPONIBLE",
  "EN_NEGOCIACION",
  "SEPARADO",
  "CIERRE_SOLICITADO",
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

/* =========================
   CALIFICADOR DE LEADS
========================= */

export const SITUACION_INICIAL = [
  "SIN_DEFINIR",
  "INICIAL_LISTA",
  "INICIAL_PARCIAL",
  "SIN_INICIAL",
  "SOLO_COTIZANDO",
] as const;

export type SituacionInicial =
  (typeof SITUACION_INICIAL)[number];

export const CAPACIDAD_CUOTA = [
  "SIN_DEFINIR",
  "PUEDE_CUOTA",
  "EVALUAR_CUOTA",
  "BUSCA_CUOTA_BAJA",
  "PAGO_CONTADO",
] as const;

export type CapacidadCuota =
  (typeof CAPACIDAD_CUOTA)[number];

export const TIEMPO_DECISION = [
  "SIN_DEFINIR",
  "HOY",
  "ESTA_SEMANA",
  "UNO_TRES_MESES",
  "SOLO_MIRANDO",
] as const;

export type TiempoDecision =
  (typeof TIEMPO_DECISION)[number];

export const INTENCION_COMPRA = [
  "SIN_DEFINIR",
  "VER_LOTES_SEPARAR",
  "RESOLVER_DUDAS",
  "INFO_GENERAL",
] as const;

export type IntencionCompra =
  (typeof INTENCION_COMPRA)[number];

export const CANAL_PREFERIDO = [
  "SIN_DEFINIR",
  "WHATSAPP_RAPIDO",
  "CITA_OFICINA",
  "LLAMADA",
  "SOLO_INFO",
] as const;

export type CanalPreferido =
  (typeof CANAL_PREFERIDO)[number];

export const PREGUNTAS_CALIFICADOR = {
  situacionInicial:
    "¿Cuentas actualmente con la inicial de S/ 6,000?",
  capacidadCuota:
    "¿Estás preparado para asumir cuotas mensuales desde S/600?",
  tiempoDecision:
    "¿Cuándo te gustaría separar tu lote?",
  canalPreferido:
    "¿Cómo prefieres avanzar?",
} as const;

export const OPCIONES_SITUACION_INICIAL = [
  { value: "SIN_DEFINIR", label: "Sin definir" },
  {
    value: "INICIAL_LISTA",
    label: "Tengo la inicial lista y quiero evaluar lote hoy.",
  },
  {
    value: "INICIAL_PARCIAL",
    label: "Tengo parte de la inicial y puedo completarla pronto.",
  },
  {
    value: "SIN_INICIAL",
    label: "Aún no tengo inicial, pero quiero información.",
  },
  {
    value: "SOLO_COTIZANDO",
    label: "Solo estoy cotizando por ahora.",
  },
] as const;

export const OPCIONES_CAPACIDAD_CUOTA = [
  { value: "SIN_DEFINIR", label: "Sin definir" },
  {
    value: "PUEDE_CUOTA",
    label: "Sí puedo asumir cuotas desde S/600",
  },
  {
    value: "EVALUAR_CUOTA",
    label: "Puedo pagar cuotas, pero necesito evaluar el monto exacto.",
  },
  {
    value: "BUSCA_CUOTA_BAJA",
    label: "Busco cuotas más bajas.",
  },
  {
    value: "PAGO_CONTADO",
    label: "Prefiero pagar al contado.",
  },
] as const;

export const OPCIONES_TIEMPO_DECISION = [
  { value: "SIN_DEFINIR", label: "Sin definir" },
  { value: "HOY", label: "Hoy." },
  { value: "ESTA_SEMANA", label: "Esta semana." },
  { value: "UNO_TRES_MESES", label: "En 1 a 3 meses." },
  {
    value: "SOLO_MIRANDO",
    label: "Solo estoy mirando opciones.",
  },
] as const;

export const OPCIONES_CANAL_PREFERIDO = [
  { value: "SIN_DEFINIR", label: "Sin definir" },
  {
    value: "CITA_OFICINA",
    label: "Cita en oficina para conocer el proyecto y separar mi lote.",
  },
  {
    value: "LLAMADA",
    label: "Llamada hoy con un asesor.",
  },
  {
    value: "WHATSAPP_RAPIDO",
    label: "WhatsApp: ver lotes y condiciones.",
  },
  {
    value: "SOLO_INFO",
    label: "Solo información por ahora.",
  },
] as const;

const etiquetaOpcion = (
  opciones: readonly { value: string; label: string }[],
  valor: string | null | undefined
) => opciones.find((opcion) => opcion.value === valor)?.label || "Sin definir";

const normalizarRespuestaCalificador = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const encontrarRespuesta = <T extends string>(
  respuestas: Set<string>,
  opciones: readonly { value: T; label: string }[]
): T | "SIN_DEFINIR" =>
  opciones.find(
    (opcion) =>
      opcion.value !== "SIN_DEFINIR" &&
      respuestas.has(normalizarRespuestaCalificador(opcion.label))
  )?.value || "SIN_DEFINIR";

export const extraerCalificacionMeta = (
  respuestas: Record<string, string[]>
) => {
  const valores = new Set(
    Object.values(respuestas)
      .flat()
      .map(normalizarRespuestaCalificador)
      .filter(Boolean)
  );

  const situacion_inicial = encontrarRespuesta(
    valores,
    OPCIONES_SITUACION_INICIAL
  );
  const capacidad_cuota = encontrarRespuesta(
    valores,
    OPCIONES_CAPACIDAD_CUOTA
  );
  const tiempo_decision = encontrarRespuesta(
    valores,
    OPCIONES_TIEMPO_DECISION
  );
  const canal_preferido = encontrarRespuesta(
    valores,
    OPCIONES_CANAL_PREFERIDO
  );

  return {
    situacion_inicial,
    capacidad_cuota,
    tiempo_decision,
    canal_preferido,
    tiene_respuestas: [
      situacion_inicial,
      capacidad_cuota,
      tiempo_decision,
      canal_preferido,
    ].some((valor) => valor !== "SIN_DEFINIR"),
  };
};

export const NIVEL_INTERES = [
  "FRIO",
  "TIBIO",
  "CALIENTE",
] as const;

export type NivelInteres =
  (typeof NIVEL_INTERES)[number];

export const ESTADO_LEAD = [
  "NUEVO",
  "CONTACTADO",
  "CALIFICADO",
  "SEGUIMIENTO",
  "NEGOCIANDO",
  "SEPARADO",
  "VENDIDO",
  "PERDIDO",
  "NO_RESPONDE",
] as const;

export type EstadoLead =
  (typeof ESTADO_LEAD)[number];

export const PROXIMA_ACCION = [
  "CONTACTAR",
  "ENVIAR_WHATSAPP",
  "LLAMAR",
  "AGENDAR_CITA",
  "ENVIAR_UBICACION",
  "ENVIAR_FICHA",
  "ESPERAR_PAGO",
  "VOLVER_A_CONTACTAR",
  "DESCARTAR",
] as const;

export type ProximaAccion =
  (typeof PROXIMA_ACCION)[number];

export const ESTADO_CITA = [
  "SIN_CITA",
  "CITA_SOLICITADA",
  "CITA_PROGRAMADA",
  "CITA_ASISTIO",
  "CITA_NO_ASISTIO",
  "CITA_CANCELADA",
] as const;

export type EstadoCita =
  (typeof ESTADO_CITA)[number];

export const etiquetaSituacionInicial = (
  valor: string | null | undefined
) => etiquetaOpcion(OPCIONES_SITUACION_INICIAL, valor);

export const etiquetaCapacidadCuota = (
  valor: string | null | undefined
) => etiquetaOpcion(OPCIONES_CAPACIDAD_CUOTA, valor);

export const etiquetaTiempoDecision = (
  valor: string | null | undefined
) => etiquetaOpcion(OPCIONES_TIEMPO_DECISION, valor);

export const etiquetaIntencionCompra = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "VER_LOTES_SEPARAR":
      return "Quiere ver lotes para separar";
    case "RESOLVER_DUDAS":
      return "Quiere resolver dudas";
    case "INFO_GENERAL":
      return "Solo información general";
    default:
      return "Sin definir";
  }
};

export const etiquetaCanalPreferido = (
  valor: string | null | undefined
) => etiquetaOpcion(OPCIONES_CANAL_PREFERIDO, valor);

export const etiquetaNivelInteres = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "CALIENTE":
      return "Caliente";
    case "TIBIO":
      return "Tibio";
    case "FRIO":
      return "Frío";
    default:
      return "Frío";
  }
};

export const etiquetaEstadoLead = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "NUEVO":
      return "Nuevo";
    case "CONTACTADO":
      return "Contactado";
    case "CALIFICADO":
      return "Calificado";
    case "SEGUIMIENTO":
      return "Seguimiento";
    case "NEGOCIANDO":
      return "Negociando";
    case "SEPARADO":
      return "Separado";
    case "VENDIDO":
      return "Vendido";
    case "PERDIDO":
      return "Perdido";
    case "NO_RESPONDE":
      return "No responde";
    default:
      return "Nuevo";
  }
};

export const etiquetaProximaAccion = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "ENVIAR_WHATSAPP":
      return "Enviar WhatsApp";
    case "LLAMAR":
      return "Llamar";
    case "AGENDAR_CITA":
      return "Agendar cita";
    case "ENVIAR_UBICACION":
      return "Enviar ubicación";
    case "ENVIAR_FICHA":
      return "Enviar ficha";
    case "ESPERAR_PAGO":
      return "Esperar pago";
    case "VOLVER_A_CONTACTAR":
      return "Volver a contactar";
    case "DESCARTAR":
      return "Descartar";
    default:
      return "Contactar";
  }
};

export const etiquetaEstadoCita = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "CITA_SOLICITADA":
      return "Cita solicitada";
    case "CITA_PROGRAMADA":
      return "Cita programada";
    case "CITA_ASISTIO":
      return "Asistió";
    case "CITA_NO_ASISTIO":
      return "No asistió";
    case "CITA_CANCELADA":
      return "Cancelada";
    default:
      return "Sin cita";
  }
};

export const colorNivelInteres = (
  nivel: string | null | undefined
) => {
  switch (nivel) {
    case "CALIENTE":
      return {
        bg: "#F7DAD6",
        fg: "#8B2F25",
      };
    case "TIBIO":
      return {
        bg: "#FFF3D6",
        fg: "#8A5A00",
      };
    case "FRIO":
      return {
        bg: "#E5E7EB",
        fg: "#374151",
      };
    default:
      return {
        bg: "#E5E7EB",
        fg: "#374151",
      };
  }
};

export type DatosCalificacionLead = {
  situacion_inicial?: SituacionInicial | string | null;
  capacidad_cuota?: CapacidadCuota | string | null;
  tiempo_decision?: TiempoDecision | string | null;
  canal_preferido?: CanalPreferido | string | null;
};

export const calcularCalificacionLead = (
  datos: DatosCalificacionLead
) => {
  let puntaje = 0;

  switch (datos.situacion_inicial) {
    case "INICIAL_LISTA":
      puntaje += 30;
      break;
    case "INICIAL_PARCIAL":
      puntaje += 20;
      break;
    case "SIN_INICIAL":
      puntaje += 5;
      break;
    case "SOLO_COTIZANDO":
      puntaje += 0;
      break;
  }

  switch (datos.capacidad_cuota) {
    case "PUEDE_CUOTA":
      puntaje += 25;
      break;
    case "EVALUAR_CUOTA":
      puntaje += 15;
      break;
    case "BUSCA_CUOTA_BAJA":
      puntaje += 5;
      break;
    case "PAGO_CONTADO":
      puntaje += 25;
      break;
  }

  switch (datos.tiempo_decision) {
    case "HOY":
      puntaje += 25;
      break;
    case "ESTA_SEMANA":
      puntaje += 20;
      break;
    case "UNO_TRES_MESES":
      puntaje += 10;
      break;
    case "SOLO_MIRANDO":
      puntaje += 0;
      break;
  }

  switch (datos.canal_preferido) {
    case "WHATSAPP_RAPIDO":
      puntaje += 10;
      break;
    case "CITA_OFICINA":
      puntaje += 20;
      break;
    case "LLAMADA":
      puntaje += 15;
      break;
    case "SOLO_INFO":
      puntaje += 0;
      break;
  }

  const puntajeFinal = Math.min(puntaje, 100);

  const nivel_interes: NivelInteres =
    puntajeFinal >= 70
      ? "CALIENTE"
      : puntajeFinal >= 40
        ? "TIBIO"
        : "FRIO";

  let proxima_accion: ProximaAccion = "CONTACTAR";
  let estado_cita: EstadoCita = "SIN_CITA";

  if (datos.canal_preferido === "WHATSAPP_RAPIDO") {
    proxima_accion = "ENVIAR_WHATSAPP";
  }

  if (datos.canal_preferido === "CITA_OFICINA") {
    proxima_accion = "AGENDAR_CITA";
    estado_cita = "CITA_SOLICITADA";
  }

  if (datos.canal_preferido === "LLAMADA") {
    proxima_accion = "LLAMAR";
  }

  if (datos.canal_preferido === "SOLO_INFO") {
    proxima_accion = "ENVIAR_UBICACION";
  }

  const estado_lead: EstadoLead =
    nivel_interes === "CALIENTE"
      ? "CALIFICADO"
      : nivel_interes === "TIBIO"
        ? "SEGUIMIENTO"
        : "NUEVO";

  return {
    puntaje_lead: puntajeFinal,
    nivel_interes,
    estado_lead,
    proxima_accion,
    estado_cita,
  };
};

/* =========================
   TIPOS PRINCIPALES
========================= */

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
  lote_interes_id: number | null;

  situacion_inicial?: SituacionInicial | string | null;
  capacidad_cuota?: CapacidadCuota | string | null;
  tiempo_decision?: TiempoDecision | string | null;
  intencion_compra?: IntencionCompra | string | null;
  canal_preferido?: CanalPreferido | string | null;
  puntaje_lead?: number | null;
  nivel_interes?: NivelInteres | string | null;
  estado_lead?: EstadoLead | string | null;
  proxima_accion?: ProximaAccion | string | null;
  fecha_proximo_seguimiento?: string | null;
  objecion_principal?: string | null;
  estado_cita?: EstadoCita | string | null;
  fecha_cita?: string | null;
  hora_cita?: string | null;

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

export const ESTADOS_COTIZACION = [
  "PENDIENTE_APROBACION",
  "BORRADOR",
  "ENVIADA",
  "ACEPTADA",
  "RECHAZADA",
  "VENCIDA",
  "ANULADA",
  "REEMPLAZADA",
  "CONVERTIDA",
] as const;

export type EstadoCotizacion =
  (typeof ESTADOS_COTIZACION)[number];

export const etiquetaEstadoCotizacion = (
  estado: string | null | undefined
) => {
  switch (estado) {
    case "PENDIENTE_APROBACION":
      return "Pendiente de aprobación";
    case "BORRADOR":
      return "Borrador";
    case "ENVIADA":
      return "Enviada";
    case "ACEPTADA":
      return "Aceptada";
    case "RECHAZADA":
      return "Rechazada";
    case "VENCIDA":
      return "Vencida";
    case "ANULADA":
      return "Anulada";
    case "REEMPLAZADA":
      return "Reemplazada";
    case "CONVERTIDA":
      return "Convertida";
    default:
      return estado || "Sin estado";
  }
};

export type Cotizacion = {
  id: string;
  numero: string;
  grupo_id: string;
  version: number;
  cotizacion_anterior_id: string | null;
  cliente_id: string;
  lote_id: number;
  asesor_id: string;
  created_by: string | null;
  estado: EstadoCotizacion | string;
  precio_lista: number;
  precio_ofertado: number;
  descuento_monto: number;
  descuento_porcentaje: number;
  monto_separacion: number;
  inicial: number;
  meses: number;
  saldo_financiar: number;
  cuota_mensual: number;
  valida_hasta: string;
  observaciones: string | null;
  aprobacion_solicitada_at: string | null;
  aprobada_por: string | null;
  aprobada_at: string | null;
  enviada_at: string | null;
  aceptada_at: string | null;
  rechazada_at: string | null;
  convertida_at: string | null;
  separacion_id: string | null;
  created_at: string;
  updated_at: string;
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
  liberacion_solicitada?: boolean | null;
  motivo_liberacion?: string | null;
  fecha_solicitud_liberacion?: string | null;
  solicitado_liberacion_por?: string | null;
  fecha_liberacion_resuelta?: string | null;
  resuelto_liberacion_por?: string | null;
};

export const TIPOS_CONTACTO = [
  "WHATSAPP",
  "LLAMADA",
  "CITA",
  "VISITA_OFICINA",
  "ENVIO_INFO",
  "RECORDATORIO",
  "OTRO",
] as const;

export type TipoContacto =
  (typeof TIPOS_CONTACTO)[number];

export const RESULTADOS_SEGUIMIENTO = [
  "CONTACTADO",
  "NO_RESPONDE",
  "INTERESADO",
  "DUDAS",
  "AGENDO_CITA",
  "SEPARARA_PRONTO",
  "DESCARTADO",
] as const;

export type ResultadoSeguimiento =
  (typeof RESULTADOS_SEGUIMIENTO)[number];

export type SeguimientoCliente = {
  id: string;
  cliente_id: string;
  asesor_id: string | null;
  tipo_contacto: TipoContacto | string;
  resultado: ResultadoSeguimiento | string;
  comentario: string | null;
  fecha_proximo_seguimiento: string | null;
  created_by: string | null;
  created_at?: string;
};

export const etiquetaTipoContacto = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "WHATSAPP":
      return "WhatsApp";
    case "LLAMADA":
      return "Llamada";
    case "CITA":
      return "Cita";
    case "VISITA_OFICINA":
      return "Visita en oficina";
    case "ENVIO_INFO":
      return "Envío de información";
    case "RECORDATORIO":
      return "Recordatorio";
    case "OTRO":
      return "Otro";
    default:
      return "Sin tipo";
  }
};

export const etiquetaResultadoSeguimiento = (
  valor: string | null | undefined
) => {
  switch (valor) {
    case "CONTACTADO":
      return "Contactado";
    case "NO_RESPONDE":
      return "No responde";
    case "INTERESADO":
      return "Interesado";
    case "DUDAS":
      return "Tiene dudas";
    case "AGENDO_CITA":
      return "Agendó cita";
    case "SEPARARA_PRONTO":
      return "Separará pronto";
    case "DESCARTADO":
      return "Descartado";
    default:
      return "Sin resultado";
  }
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
    case "CIERRE_SOLICITADO":
      return "Cierre solicitado";
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
    case "CIERRE_SOLICITADO":
      return {
        bg: "#E4ECF7",
        fg: "#244D77",
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
