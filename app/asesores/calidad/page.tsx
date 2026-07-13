"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import type { ConfiguracionComercial } from "../../../lib/comercial";
import {
  LOTES_TABLE,
  esGerencia,
  etiquetaEstado,
  nombreCliente,
  type Cliente,
  type Cotizacion,
  type DocumentoSeparacion,
  type ExpedienteSeparacion,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type Severidad = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
type Categoria =
  | "DATOS"
  | "DUPLICADOS"
  | "SEGUIMIENTO"
  | "SEPARACIONES"
  | "LOTES"
  | "PERMISOS"
  | "COTIZACIONES"
  | "EXPEDIENTES"
  | "INTEGRACIONES"
  | "CONFIGURACION";

type Hallazgo = {
  id: string;
  severidad: Severidad;
  categoria: Categoria;
  titulo: string;
  descripcion: string;
  recomendacion: string;
  href?: string;
  accion?: string;
  entidad: string;
  responsable?: string;
};

type FiltroCategoria = Categoria | "TODAS";
type FiltroSeveridad = Severidad | "TODAS";

type CotizacionAuditoria = Pick<
  Cotizacion,
  | "id"
  | "numero"
  | "cliente_id"
  | "lote_id"
  | "asesor_id"
  | "estado"
  | "valida_hasta"
  | "aprobacion_solicitada_at"
  | "aprobada_at"
  | "enviada_at"
  | "aceptada_at"
  | "separacion_id"
  | "created_at"
  | "updated_at"
>;

type ExpedienteAuditoria = Pick<
  ExpedienteSeparacion,
  | "separacion_id"
  | "cliente_id"
  | "lote_id"
  | "asesor_id"
  | "estado"
  | "pago_monto"
  | "pago_fecha"
  | "pago_banco"
  | "pago_operacion"
  | "motivo_revision"
>;

type DocumentoAuditoria = Pick<
  DocumentoSeparacion,
  | "id"
  | "separacion_id"
  | "tipo"
  | "estado"
  | "nombre_archivo"
>;

type LeadPublicoAuditoria = {
  id: string;
  cliente_id: string | null;
  lote_id: number | null;
  asesor_id: string | null;
  nombre_completo: string;
  celular_normalizado: string;
  origen: string;
  estado: string;
  external_id: string | null;
  created_at: string;
};

type MetaEventoAuditoria = {
  id: string;
  meta_lead_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  received_at: string;
  last_attempt_at: string | null;
  processed_at: string | null;
};

type ConfiguracionAuditoria = Pick<
  ConfiguracionComercial,
  | "project_key"
  | "sla_primer_contacto_minutos"
  | "hora_inicio"
  | "hora_fin"
  | "descuento_asesor_max_porcentaje"
  | "vigencia_cotizacion_dias"
  | "monto_separacion_referencial"
  | "inicial_minima"
>;

const obtenerFechaHoyISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const restarDiasISO = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizar = (valor: string | null | undefined) =>
  (valor || "").replace(/\D/g, "").trim();

const clienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

const nombreLote = (lote?: LoteCrm | null) =>
  lote ? `MZ ${lote.mz} - LOTE ${lote.lote}` : "Lote sin dato";

const nombreAsesor = (
  asesorId: string | null | undefined,
  asesores: Map<string, Profile>
) => {
  if (!asesorId) return "Sin asesor";

  const asesor = asesores.get(asesorId);

  return asesor?.full_name || asesor?.email || "Asesor";
};

const pesoSeveridad: Record<Severidad, number> = {
  CRITICA: 1,
  ALTA: 2,
  MEDIA: 3,
  BAJA: 4,
};

const colorSeveridad = (severidad: Severidad) => {
  switch (severidad) {
    case "CRITICA":
      return {
        bg: "#fbe0dc",
        fg: "#8b2f25",
        border: "#f4b9b0",
      };
    case "ALTA":
      return {
        bg: "#fff0d6",
        fg: "#9a3412",
        border: "#fed7aa",
      };
    case "MEDIA":
      return {
        bg: "#fff8e1",
        fg: "#8a5a00",
        border: "#eed28a",
      };
    default:
      return {
        bg: "#eef6ff",
        fg: "#244d77",
        border: "#c7ddf4",
      };
  }
};

const etiquetaCategoria = (categoria: Categoria) => {
  switch (categoria) {
    case "DATOS":
      return "Datos";
    case "DUPLICADOS":
      return "Duplicados";
    case "SEGUIMIENTO":
      return "Seguimiento";
    case "SEPARACIONES":
      return "Separaciones";
    case "LOTES":
      return "Lotes";
    case "PERMISOS":
      return "Permisos";
    case "COTIZACIONES":
      return "Cotizaciones";
    case "EXPEDIENTES":
      return "Expedientes";
    case "INTEGRACIONES":
      return "Integraciones";
    case "CONFIGURACION":
      return "Configuracion";
  }
};

export default function CalidadPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [cotizaciones, setCotizaciones] = useState<
    CotizacionAuditoria[]
  >([]);
  const [expedientes, setExpedientes] = useState<
    ExpedienteAuditoria[]
  >([]);
  const [documentos, setDocumentos] = useState<
    DocumentoAuditoria[]
  >([]);
  const [leadsPublicos, setLeadsPublicos] = useState<
    LeadPublicoAuditoria[]
  >([]);
  const [eventosMeta, setEventosMeta] = useState<
    MetaEventoAuditoria[]
  >([]);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionAuditoria | null>(null);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [fechaAuditoria, setFechaAuditoria] = useState(() =>
    new Date().toISOString()
  );
  const [categoria, setCategoria] =
    useState<FiltroCategoria>("TODAS");
  const [severidad, setSeveridad] =
    useState<FiltroSeveridad>("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) {
      setError("Supabase no esta configurado.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    if (!perfil.profile) {
      setError(
        perfil.error || "No se pudo cargar tu perfil."
      );
      setCargando(false);
      return;
    }

    if (!esGerencia(perfil.profile)) {
      setCargando(false);
      return;
    }

    const [
      clientesResult,
      lotesResult,
      separacionesResult,
      asesoresResult,
      cotizacionesResult,
      expedientesResult,
      documentosResult,
      leadsResult,
      eventosMetaResult,
      configuracionResult,
    ] = await Promise.all([
      supabase.from("clientes").select(
        [
          "id",
          "nombres",
          "apellidos",
          "dni",
          "celular",
          "correo",
          "direccion",
          "fuente",
          "observaciones",
          "asesor_id",
          "lote_interes_id",
          "created_at",
          "updated_at",
          "nivel_interes",
          "estado_lead",
          "proxima_accion",
          "fecha_proximo_seguimiento",
          "canal_preferido",
          "estado_cita",
          "fecha_cita",
          "hora_cita",
        ].join(",")
      ),
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        ),
      supabase.from("separaciones").select(
        "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
      ),
      supabase
        .from("profiles")
        .select("id,full_name,email,role,phone,active")
        .order("full_name", {
          ascending: true,
          nullsFirst: false,
        }),
      supabase
        .from("cotizaciones")
        .select(
          "id,numero,cliente_id,lote_id,asesor_id,estado,valida_hasta,aprobacion_solicitada_at,aprobada_at,enviada_at,aceptada_at,separacion_id,created_at,updated_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("separacion_expedientes")
        .select(
          "separacion_id,cliente_id,lote_id,asesor_id,estado,pago_monto,pago_fecha,pago_banco,pago_operacion,motivo_revision"
        ),
      supabase
        .from("separacion_documentos")
        .select(
          "id,separacion_id,tipo,estado,nombre_archivo"
        ),
      supabase
        .from("leads_publicos")
        .select(
          "id,cliente_id,lote_id,asesor_id,nombre_completo,celular_normalizado,origen,estado,external_id,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("meta_lead_events")
        .select(
          "id,meta_lead_id,status,attempts,last_error,received_at,last_attempt_at,processed_at"
        )
        .order("received_at", { ascending: false })
        .limit(500),
      supabase
        .from("configuracion_comercial")
        .select(
          "project_key,sla_primer_contacto_minutos,hora_inicio,hora_fin,descuento_asesor_max_porcentaje,vigencia_cotizacion_dias,monto_separacion_referencial,inicial_minima"
        )
        .eq("project_key", "las_lomas")
        .maybeSingle(),
    ]);

    const errorActual =
      clientesResult.error ||
      lotesResult.error ||
      separacionesResult.error ||
      asesoresResult.error ||
      cotizacionesResult.error ||
      expedientesResult.error ||
      documentosResult.error ||
      leadsResult.error ||
      eventosMetaResult.error ||
      configuracionResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setClientes(
      (clientesResult.data || []) as unknown as Cliente[]
    );
    setLotes(
      (lotesResult.data || []) as unknown as LoteCrm[]
    );
    setSeparaciones(
      (separacionesResult.data || []) as unknown as Separacion[]
    );
    setCotizaciones(
      (cotizacionesResult.data || []) as unknown as CotizacionAuditoria[]
    );
    setExpedientes(
      (expedientesResult.data || []) as unknown as ExpedienteAuditoria[]
    );
    setDocumentos(
      (documentosResult.data || []) as unknown as DocumentoAuditoria[]
    );
    setLeadsPublicos(
      (leadsResult.data || []) as unknown as LeadPublicoAuditoria[]
    );
    setEventosMeta(
      (eventosMetaResult.data || []) as unknown as MetaEventoAuditoria[]
    );
    setConfiguracion(
      configuracionResult.data
        ? (configuracionResult.data as unknown as ConfiguracionAuditoria)
        : null
    );
    setAsesores(
      (asesoresResult.data || []) as unknown as Profile[]
    );
    setFechaAuditoria(new Date().toISOString());
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const asesoresPorId = useMemo(() => {
    const mapa = new Map<string, Profile>();

    asesores.forEach((asesor) => {
      mapa.set(asesor.id, asesor);
    });

    return mapa;
  }, [asesores]);

  const clientesPorId = useMemo(() => {
    const mapa = new Map<string, Cliente>();

    clientes.forEach((cliente) => {
      mapa.set(cliente.id, cliente);
    });

    return mapa;
  }, [clientes]);

  const lotesPorId = useMemo(() => {
    const mapa = new Map<number, LoteCrm>();

    lotes.forEach((lote) => {
      mapa.set(lote.id, lote);
    });

    return mapa;
  }, [lotes]);

  const separacionesActivasPorLote = useMemo(() => {
    const mapa = new Map<number, Separacion[]>();

    separaciones
      .filter((separacion) => separacion.estado === "ACTIVA")
      .forEach((separacion) => {
        if (!separacion.lote_id) return;

        const lista = mapa.get(separacion.lote_id) || [];
        lista.push(separacion);
        mapa.set(separacion.lote_id, lista);
      });

    return mapa;
  }, [separaciones]);

  const separacionesPorId = useMemo(
    () =>
      new Map(
        separaciones.map((separacion) => [
          separacion.id,
          separacion,
        ])
      ),
    [separaciones]
  );

  const expedientesPorSeparacion = useMemo(
    () =>
      new Map(
        expedientes.map((expediente) => [
          expediente.separacion_id,
          expediente,
        ])
      ),
    [expedientes]
  );

  const documentosPorSeparacion = useMemo(() => {
    const mapa = new Map<string, DocumentoAuditoria[]>();

    documentos.forEach((documento) => {
      const lista = mapa.get(documento.separacion_id) || [];
      lista.push(documento);
      mapa.set(documento.separacion_id, lista);
    });

    return mapa;
  }, [documentos]);

  const hallazgos = useMemo<Hallazgo[]>(() => {
    const hoy = obtenerFechaHoyISO();
    const limiteAbandono = restarDiasISO(7);
    const lista: Hallazgo[] = [];
    const dniMap = new Map<string, Cliente[]>();
    const celularMap = new Map<string, Cliente[]>();

    clientes.forEach((cliente) => {
      const asesor = nombreAsesor(cliente.asesor_id, asesoresPorId);
      const nombre = nombreCliente(cliente) || "Cliente sin nombre";
      const dni = normalizar(cliente.dni);
      const celular = normalizar(cliente.celular);

      if (dni) {
        const grupo = dniMap.get(dni) || [];
        grupo.push(cliente);
        dniMap.set(dni, grupo);
      }

      if (celular) {
        const grupo = celularMap.get(celular) || [];
        grupo.push(cliente);
        celularMap.set(celular, grupo);
      }

      if (!cliente.asesor_id) {
        lista.push({
          id: `cliente-sin-asesor-${cliente.id}`,
          severidad: "ALTA",
          categoria: "PERMISOS",
          titulo: "Cliente sin asesor asignado",
          descripcion: `${nombre} no tiene asesor responsable.`,
          recomendacion:
            "Asigna un asesor para que el lead tenga seguimiento y responsabilidad comercial.",
          href: `/asesores/clientes/${cliente.id}`,
          accion: "Abrir cliente",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (!cliente.celular) {
        lista.push({
          id: `cliente-sin-celular-${cliente.id}`,
          severidad: "ALTA",
          categoria: "DATOS",
          titulo: "Cliente sin celular",
          descripcion: `${nombre} no tiene numero de contacto.`,
          recomendacion:
            "Completa el celular; sin WhatsApp el asesor pierde capacidad de seguimiento.",
          href: `/asesores/clientes/${cliente.id}`,
          accion: "Completar datos",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (!cliente.dni && cliente.estado_lead !== "NUEVO") {
        lista.push({
          id: `cliente-sin-dni-${cliente.id}`,
          severidad: "MEDIA",
          categoria: "DATOS",
          titulo: "Cliente avanzado sin DNI",
          descripcion: `${nombre} avanzo en el embudo, pero aun no tiene DNI.`,
          recomendacion:
            "Solicita DNI antes de separar o generar documentos comerciales.",
          href: `/asesores/clientes/${cliente.id}`,
          accion: "Revisar cliente",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (
        cliente.nivel_interes === "CALIENTE" &&
        clienteActivo(cliente) &&
        !cliente.fecha_proximo_seguimiento
      ) {
        lista.push({
          id: `caliente-sin-fecha-${cliente.id}`,
          severidad: "CRITICA",
          categoria: "SEGUIMIENTO",
          titulo: "Lead caliente sin proximo seguimiento",
          descripcion: `${nombre} es caliente y no tiene una fecha de contacto programada.`,
          recomendacion:
            "Programa una accion inmediata para evitar que el lead se enfrie.",
          href: `/asesores/clientes/${cliente.id}#registrar-seguimiento`,
          accion: "Registrar seguimiento",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (
        clienteActivo(cliente) &&
        cliente.fecha_proximo_seguimiento &&
        cliente.fecha_proximo_seguimiento < hoy
      ) {
        lista.push({
          id: `seguimiento-vencido-${cliente.id}`,
          severidad:
            cliente.nivel_interes === "CALIENTE" ? "CRITICA" : "ALTA",
          categoria: "SEGUIMIENTO",
          titulo: "Seguimiento vencido",
          descripcion: `${nombre} debio ser contactado el ${cliente.fecha_proximo_seguimiento}.`,
          recomendacion:
            "Contacta al cliente y registra el resultado en su historial.",
          href: `/asesores/clientes/${cliente.id}#registrar-seguimiento`,
          accion: "Atender ahora",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (
        clienteActivo(cliente) &&
        !cliente.fecha_proximo_seguimiento &&
        (cliente.updated_at || cliente.created_at || "") < limiteAbandono
      ) {
        lista.push({
          id: `cliente-abandonado-${cliente.id}`,
          severidad: "MEDIA",
          categoria: "SEGUIMIENTO",
          titulo: "Cliente activo sin movimiento reciente",
          descripcion: `${nombre} no tiene proxima accion y no se actualiza hace mas de 7 dias.`,
          recomendacion:
            "Define si sigue interesado, reprograma seguimiento o descartalo.",
          href: `/asesores/clientes/${cliente.id}`,
          accion: "Revisar ficha",
          entidad: nombre,
          responsable: asesor,
        });
      }

      if (
        cliente.lote_interes_id &&
        !lotesPorId.has(Number(cliente.lote_interes_id))
      ) {
        lista.push({
          id: `lote-interes-inexistente-${cliente.id}`,
          severidad: "ALTA",
          categoria: "LOTES",
          titulo: "Cliente apunta a lote inexistente",
          descripcion: `${nombre} tiene lote de interes ID ${cliente.lote_interes_id}, pero no existe en la tabla de lotes.`,
          recomendacion:
            "Corrige el lote de interes para que reportes y fichas coincidan.",
          href: `/asesores/clientes/${cliente.id}`,
          accion: "Corregir lote",
          entidad: nombre,
          responsable: asesor,
        });
      }
    });

    dniMap.forEach((grupo, dni) => {
      if (grupo.length <= 1) return;

      lista.push({
        id: `duplicado-dni-${dni}`,
        severidad: "ALTA",
        categoria: "DUPLICADOS",
        titulo: "Clientes duplicados por DNI",
        descripcion: `${grupo.length} registros comparten el DNI ${dni}: ${grupo
          .map(nombreCliente)
          .join(", ")}.`,
        recomendacion:
          "Unifica la gestion comercial para evitar doble seguimiento o doble separacion.",
        href: `/asesores/clientes/${grupo[0].id}`,
        accion: "Revisar duplicado",
        entidad: `DNI ${dni}`,
      });
    });

    celularMap.forEach((grupo, celular) => {
      if (grupo.length <= 1) return;

      lista.push({
        id: `duplicado-celular-${celular}`,
        severidad: "MEDIA",
        categoria: "DUPLICADOS",
        titulo: "Clientes duplicados por celular",
        descripcion: `${grupo.length} registros comparten el celular ${celular}: ${grupo
          .map(nombreCliente)
          .join(", ")}.`,
        recomendacion:
          "Revisa si es el mismo cliente o si el numero pertenece a un familiar.",
        href: `/asesores/clientes/${grupo[0].id}`,
        accion: "Revisar registros",
        entidad: `Celular ${celular}`,
      });
    });

    separaciones.forEach((separacion) => {
      const cliente = separacion.cliente_id
        ? clientesPorId.get(separacion.cliente_id)
        : undefined;
      const lote = separacion.lote_id
        ? lotesPorId.get(Number(separacion.lote_id))
        : undefined;
      const entidad = lote ? nombreLote(lote) : "Separacion sin lote";
      const asesor = nombreAsesor(separacion.asesor_id, asesoresPorId);

      if (!separacion.cliente_id || !cliente) {
        lista.push({
          id: `separacion-sin-cliente-${separacion.id}`,
          severidad: "CRITICA",
          categoria: "SEPARACIONES",
          titulo: "Separacion sin cliente valido",
          descripcion:
            "Existe una separacion que no tiene cliente asociado o apunta a un cliente inexistente.",
          recomendacion:
            "Corrige o anula la separacion para evitar errores comerciales y documentarios.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Abrir separacion",
          entidad,
          responsable: asesor,
        });
      }

      if (!separacion.lote_id || !lote) {
        lista.push({
          id: `separacion-sin-lote-${separacion.id}`,
          severidad: "CRITICA",
          categoria: "SEPARACIONES",
          titulo: "Separacion sin lote valido",
          descripcion:
            "Existe una separacion que no tiene lote asociado o apunta a un lote inexistente.",
          recomendacion:
            "Corrige la relacion con el lote o anula la separacion.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Abrir separacion",
          entidad,
          responsable: asesor,
        });
      }

      if (separacion.estado === "ACTIVA" && !separacion.fecha_limite) {
        lista.push({
          id: `separacion-sin-fecha-${separacion.id}`,
          severidad: "ALTA",
          categoria: "SEPARACIONES",
          titulo: "Separacion activa sin fecha limite",
          descripcion: `${entidad} esta activa, pero no tiene fecha limite.`,
          recomendacion:
            "Define fecha limite para controlar vencimiento y cobranza de inicial.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Completar fecha",
          entidad,
          responsable: asesor,
        });
      }

      if (
        separacion.estado === "ACTIVA" &&
        separacion.fecha_limite &&
        separacion.fecha_limite < hoy
      ) {
        lista.push({
          id: `separacion-vencida-${separacion.id}`,
          severidad: "CRITICA",
          categoria: "SEPARACIONES",
          titulo: "Separacion vencida sin resolver",
          descripcion: `${entidad} vencio el ${separacion.fecha_limite}.`,
          recomendacion:
            "Confirma pago de inicial, solicita liberacion o eleva a gerencia.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Gestionar separacion",
          entidad,
          responsable: asesor,
        });
      }

      if (separacion.liberacion_solicitada) {
        lista.push({
          id: `liberacion-pendiente-${separacion.id}`,
          severidad: "ALTA",
          categoria: "SEPARACIONES",
          titulo: "Liberacion solicitada pendiente",
          descripcion: `${entidad} espera decision de gerencia.`,
          recomendacion:
            "Aprobar o rechazar la liberacion para destrabar el lote.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Resolver solicitud",
          entidad,
          responsable: asesor,
        });
      }
    });

    lotes.forEach((lote) => {
      const estado = (lote.estado || "").toUpperCase();
      const entidad = nombreLote(lote);
      const asesor = nombreAsesor(lote.asesor_id, asesoresPorId);
      const separacionesActivas =
        separacionesActivasPorLote.get(lote.id) || [];

      if (separacionesActivas.length > 1) {
        lista.push({
          id: `lote-separaciones-duplicadas-${lote.id}`,
          severidad: "CRITICA",
          categoria: "SEPARACIONES",
          titulo: "Lote con varias separaciones activas",
          descripcion: `${entidad} tiene ${separacionesActivas.length} separaciones activas al mismo tiempo.`,
          recomendacion:
            "Conserva una sola separacion y resuelve las duplicadas antes de continuar la venta.",
          href: "/asesores/separaciones",
          accion: "Revisar separaciones",
          entidad,
          responsable: asesor,
        });
      }

      if (
        ["SEPARADO", "CIERRE_SOLICITADO", "VENDIDO"].includes(estado) &&
        !lote.cliente_id
      ) {
        lista.push({
          id: `lote-sin-cliente-${lote.id}`,
          severidad: "CRITICA",
          categoria: "LOTES",
          titulo: "Lote reservado o vendido sin cliente",
          descripcion: `${entidad} esta en estado ${etiquetaEstado(
            lote.estado
          )}, pero no tiene cliente vinculado.`,
          recomendacion:
            "Vincula el cliente correcto o revisa si el estado del lote es incorrecto.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Abrir lote",
          entidad,
          responsable: asesor,
        });
      }

      if (
        ["SEPARADO", "CIERRE_SOLICITADO", "VENDIDO"].includes(estado) &&
        !lote.asesor_id
      ) {
        lista.push({
          id: `lote-sin-asesor-${lote.id}`,
          severidad: "ALTA",
          categoria: "LOTES",
          titulo: "Lote reservado o vendido sin asesor",
          descripcion: `${entidad} no tiene asesor responsable.`,
          recomendacion:
            "Asigna responsable para que comisiones, reportes y seguimiento sean correctos.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Abrir lote",
          entidad,
          responsable: asesor,
        });
      }

      if (estado === "DISPONIBLE" && separacionesActivas.length > 0) {
        lista.push({
          id: `lote-disponible-con-separacion-${lote.id}`,
          severidad: "CRITICA",
          categoria: "LOTES",
          titulo: "Lote disponible con separacion activa",
          descripcion: `${entidad} aparece disponible, pero tiene ${separacionesActivas.length} separacion activa.`,
          recomendacion:
            "Corrige el estado del lote o revisa la separacion asociada.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Revisar lote",
          entidad,
          responsable: asesor,
        });
      }

      if (estado === "SEPARADO" && separacionesActivas.length === 0) {
        lista.push({
          id: `lote-separado-sin-separacion-${lote.id}`,
          severidad: "ALTA",
          categoria: "LOTES",
          titulo: "Lote separado sin separacion activa",
          descripcion: `${entidad} esta separado, pero no tiene separacion activa registrada.`,
          recomendacion:
            "Crea la separacion correcta o cambia el estado del lote.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Revisar lote",
          entidad,
          responsable: asesor,
        });
      }

      if (
        estado === "CIERRE_SOLICITADO" &&
        separacionesActivas.length === 0
      ) {
        lista.push({
          id: `cierre-sin-separacion-${lote.id}`,
          severidad: "CRITICA",
          categoria: "EXPEDIENTES",
          titulo: "Cierre solicitado sin separacion activa",
          descripcion: `${entidad} solicita cierre, pero no existe una separacion activa que sustente la venta.`,
          recomendacion:
            "Devuelve el cierre a disponible y registra primero al comprador con su separacion.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Regularizar cierre",
          entidad,
          responsable: asesor,
        });
      }

      if (estado === "VENDIDO" && separacionesActivas.length > 0) {
        lista.push({
          id: `vendido-separacion-activa-${lote.id}`,
          severidad: "CRITICA",
          categoria: "EXPEDIENTES",
          titulo: "Venta cerrada con separacion aun activa",
          descripcion: `${entidad} esta vendido, pero su separacion no fue convertida o cerrada.`,
          recomendacion:
            "Revisa el cierre y convierte la separacion para que reportes y expediente coincidan.",
          href: "/asesores/separaciones",
          accion: "Revisar expediente",
          entidad,
          responsable: asesor,
        });
      }

      if (lote.cliente_id && !clientesPorId.has(lote.cliente_id)) {
        lista.push({
          id: `lote-cliente-inexistente-${lote.id}`,
          severidad: "CRITICA",
          categoria: "LOTES",
          titulo: "Lote vinculado a cliente inexistente",
          descripcion: `${entidad} apunta a un cliente que no existe en la tabla clientes.`,
          recomendacion:
            "Corrige la relacion para evitar documentos y reportes incorrectos.",
          href: `/asesores/lotes?lote=${lote.id}`,
          accion: "Abrir lote",
          entidad,
          responsable: asesor,
        });
      }
    });

    asesores.forEach((asesor) => {
      if (asesor.role !== "asesor") return;

      const tieneCartera =
        clientes.some((cliente) => cliente.asesor_id === asesor.id) ||
        lotes.some((lote) => lote.asesor_id === asesor.id);

      if (asesor.active === false && tieneCartera) {
        lista.push({
          id: `asesor-inactivo-cartera-${asesor.id}`,
          severidad: "ALTA",
          categoria: "PERMISOS",
          titulo: "Asesor inactivo con cartera asignada",
          descripcion: `${
            asesor.full_name || asesor.email || "Asesor"
          } esta inactivo, pero aun tiene clientes o lotes asignados.`,
          recomendacion:
            "Reasigna su cartera para que ningun cliente quede abandonado.",
          href: "/asesores/clientes",
          accion: "Revisar cartera",
          entidad: asesor.full_name || asesor.email || "Asesor",
        });
      }
    });

    cotizaciones.forEach((cotizacion) => {
      const entidad = cotizacion.numero || `Cotizacion ${cotizacion.id}`;
      const asesor = nombreAsesor(
        cotizacion.asesor_id,
        asesoresPorId
      );
      const separacion = cotizacion.separacion_id
        ? separacionesPorId.get(cotizacion.separacion_id)
        : undefined;

      if (!clientesPorId.has(cotizacion.cliente_id)) {
        lista.push({
          id: `cotizacion-cliente-${cotizacion.id}`,
          severidad: "CRITICA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion sin cliente valido",
          descripcion: `${entidad} apunta a un cliente inexistente.`,
          recomendacion:
            "Corrige la relacion antes de enviar o convertir la propuesta.",
          href: "/asesores/cotizaciones",
          accion: "Revisar cotizacion",
          entidad,
          responsable: asesor,
        });
      }

      if (!lotesPorId.has(Number(cotizacion.lote_id))) {
        lista.push({
          id: `cotizacion-lote-${cotizacion.id}`,
          severidad: "CRITICA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion sin lote valido",
          descripcion: `${entidad} apunta a un lote inexistente.`,
          recomendacion:
            "Anula la propuesta o vincula el lote correcto antes de continuar.",
          href: "/asesores/cotizaciones",
          accion: "Revisar cotizacion",
          entidad,
          responsable: asesor,
        });
      }

      if (!asesoresPorId.has(cotizacion.asesor_id)) {
        lista.push({
          id: `cotizacion-asesor-${cotizacion.id}`,
          severidad: "ALTA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion sin responsable valido",
          descripcion: `${entidad} no tiene un usuario responsable disponible.`,
          recomendacion:
            "Reasigna la propuesta para conservar trazabilidad y seguimiento.",
          href: "/asesores/cotizaciones",
          accion: "Revisar cotizacion",
          entidad,
          responsable: asesor,
        });
      }

      if (
        ["BORRADOR", "PENDIENTE_APROBACION", "ENVIADA"].includes(
          String(cotizacion.estado)
        ) &&
        cotizacion.valida_hasta < hoy
      ) {
        lista.push({
          id: `cotizacion-vencida-${cotizacion.id}`,
          severidad:
            cotizacion.estado === "BORRADOR" ? "MEDIA" : "ALTA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion vencida sin resolver",
          descripcion: `${entidad} vencio el ${cotizacion.valida_hasta} y continua en estado ${cotizacion.estado}.`,
          recomendacion:
            "Renueva la propuesta, marcala vencida o registra la decision del cliente.",
          href: "/asesores/cotizaciones",
          accion: "Gestionar cotizacion",
          entidad,
          responsable: asesor,
        });
      }

      if (
        cotizacion.estado === "PENDIENTE_APROBACION" &&
        !cotizacion.aprobacion_solicitada_at
      ) {
        lista.push({
          id: `cotizacion-aprobacion-${cotizacion.id}`,
          severidad: "ALTA",
          categoria: "COTIZACIONES",
          titulo: "Aprobacion sin fecha de solicitud",
          descripcion: `${entidad} espera aprobacion, pero no registra cuando fue solicitada.`,
          recomendacion:
            "Revisa la propuesta y vuelve a registrar el flujo de aprobacion.",
          href: "/asesores/cotizaciones?estado=PENDIENTE_APROBACION",
          accion: "Revisar aprobacion",
          entidad,
          responsable: asesor,
        });
      }

      if (cotizacion.estado === "ENVIADA" && !cotizacion.enviada_at) {
        lista.push({
          id: `cotizacion-envio-${cotizacion.id}`,
          severidad: "ALTA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion enviada sin fecha",
          descripcion: `${entidad} figura enviada, pero no tiene evidencia temporal del envio.`,
          recomendacion:
            "Confirma el envio y registra nuevamente el estado de la propuesta.",
          href: "/asesores/cotizaciones",
          accion: "Revisar envio",
          entidad,
          responsable: asesor,
        });
      }

      if (cotizacion.estado === "ACEPTADA" && !cotizacion.aceptada_at) {
        lista.push({
          id: `cotizacion-aceptacion-${cotizacion.id}`,
          severidad: "ALTA",
          categoria: "COTIZACIONES",
          titulo: "Cotizacion aceptada sin fecha",
          descripcion: `${entidad} figura aceptada, pero no registra la fecha de aceptacion.`,
          recomendacion:
            "Regulariza la aceptacion antes de generar la separacion.",
          href: "/asesores/cotizaciones",
          accion: "Revisar aceptacion",
          entidad,
          responsable: asesor,
        });
      }

      if (cotizacion.estado === "CONVERTIDA") {
        if (!cotizacion.separacion_id || !separacion) {
          lista.push({
            id: `cotizacion-convertida-${cotizacion.id}`,
            severidad: "CRITICA",
            categoria: "COTIZACIONES",
            titulo: "Cotizacion convertida sin separacion",
            descripcion: `${entidad} figura convertida, pero no existe su separacion vinculada.`,
            recomendacion:
              "Reconstruye la relacion antes de cerrar la venta o emitir documentos.",
            href: "/asesores/cotizaciones",
            accion: "Revisar conversion",
            entidad,
            responsable: asesor,
          });
        } else if (
          separacion.cliente_id !== cotizacion.cliente_id ||
          Number(separacion.lote_id) !== Number(cotizacion.lote_id) ||
          separacion.asesor_id !== cotizacion.asesor_id
        ) {
          lista.push({
            id: `cotizacion-conversion-inconsistente-${cotizacion.id}`,
            severidad: "CRITICA",
            categoria: "COTIZACIONES",
            titulo: "Conversion con datos inconsistentes",
            descripcion: `${entidad} y su separacion no coinciden en cliente, lote o asesor.`,
            recomendacion:
              "Deten el cierre y corrige la relacion comercial antes de continuar.",
            href: `/asesores/separaciones?separacion=${separacion.id}`,
            accion: "Revisar separacion",
            entidad,
            responsable: asesor,
          });
        }
      }
    });

    separaciones.forEach((separacion) => {
      const expediente = expedientesPorSeparacion.get(separacion.id);
      const lote = separacion.lote_id
        ? lotesPorId.get(Number(separacion.lote_id))
        : undefined;
      const entidad = lote ? nombreLote(lote) : `Separacion ${separacion.id}`;
      const asesor = nombreAsesor(
        separacion.asesor_id,
        asesoresPorId
      );

      if (
        separacion.estado === "ACTIVA" &&
        lote?.estado === "CIERRE_SOLICITADO" &&
        !expediente
      ) {
        lista.push({
          id: `cierre-expediente-ausente-${separacion.id}`,
          severidad: "CRITICA",
          categoria: "EXPEDIENTES",
          titulo: "Cierre sin expediente iniciado",
          descripcion: `${entidad} solicita cierre sin pago ni documentos registrados.`,
          recomendacion:
            "Inicia el expediente, carga DNI y voucher y envialo a revision.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Completar expediente",
          entidad,
          responsable: asesor,
        });
      }

      if (
        separacion.estado === "ACTIVA" &&
        lote?.estado === "CIERRE_SOLICITADO" &&
        expediente &&
        expediente.estado !== "VALIDADO"
      ) {
        lista.push({
          id: `cierre-expediente-pendiente-${separacion.id}`,
          severidad: "ALTA",
          categoria: "EXPEDIENTES",
          titulo: "Cierre esperando validacion documental",
          descripcion: `${entidad} no puede venderse porque el expediente esta ${expediente.estado}.`,
          recomendacion:
            "Resuelve observaciones o valida documentos antes de aprobar la venta.",
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Revisar expediente",
          entidad,
          responsable: asesor,
        });
      }
    });

    expedientes.forEach((expediente) => {
      const separacion = separacionesPorId.get(expediente.separacion_id);
      const lote = lotesPorId.get(Number(expediente.lote_id));
      const entidad = lote
        ? nombreLote(lote)
        : `Expediente ${expediente.separacion_id}`;
      const asesor = nombreAsesor(expediente.asesor_id, asesoresPorId);
      const documentosExpediente =
        documentosPorSeparacion.get(expediente.separacion_id) || [];

      if (!separacion) {
        lista.push({
          id: `expediente-separacion-${expediente.separacion_id}`,
          severidad: "CRITICA",
          categoria: "EXPEDIENTES",
          titulo: "Expediente sin separacion valida",
          descripcion: `${entidad} no tiene una separacion asociada disponible.`,
          recomendacion:
            "Revisa la integridad del registro antes de usar sus documentos.",
          href: "/asesores/separaciones",
          accion: "Revisar expedientes",
          entidad,
          responsable: asesor,
        });
        return;
      }

      if (
        separacion.cliente_id !== expediente.cliente_id ||
        Number(separacion.lote_id) !== Number(expediente.lote_id) ||
        separacion.asesor_id !== expediente.asesor_id
      ) {
        lista.push({
          id: `expediente-datos-${expediente.separacion_id}`,
          severidad: "CRITICA",
          categoria: "EXPEDIENTES",
          titulo: "Expediente no coincide con la separacion",
          descripcion: `${entidad} tiene diferencias de cliente, lote o asesor.`,
          recomendacion:
            "Deten el cierre y corrige la relacion antes de validar documentos.",
          href: `/asesores/separaciones?separacion=${expediente.separacion_id}`,
          accion: "Revisar expediente",
          entidad,
          responsable: asesor,
        });
      }

      if (expediente.estado === "VALIDADO") {
        const dniValidado = documentosExpediente.some(
          (documento) =>
            documento.tipo === "DNI" && documento.estado === "VALIDADO"
        );
        const voucherValidado = documentosExpediente.some(
          (documento) =>
            ["VOUCHER_SEPARACION", "VOUCHER_INICIAL"].includes(
              documento.tipo
            ) && documento.estado === "VALIDADO"
        );
        const pagoCompleto =
          Number(expediente.pago_monto || 0) > 0 &&
          Boolean(expediente.pago_fecha) &&
          Boolean(expediente.pago_banco?.trim()) &&
          Boolean(expediente.pago_operacion?.trim());

        if (!dniValidado || !voucherValidado || !pagoCompleto) {
          lista.push({
            id: `expediente-validado-incompleto-${expediente.separacion_id}`,
            severidad: "CRITICA",
            categoria: "EXPEDIENTES",
            titulo: "Expediente validado con requisitos incompletos",
            descripcion: `${entidad} figura validado, pero falta pago, DNI o voucher aprobado.`,
            recomendacion:
              "Reabre la revision documental y completa los requisitos antes de vender.",
            href: `/asesores/separaciones?separacion=${expediente.separacion_id}`,
            accion: "Auditar expediente",
            entidad,
            responsable: asesor,
          });
        }
      }

      if (
        expediente.estado === "OBSERVADO" &&
        !expediente.motivo_revision?.trim()
      ) {
        lista.push({
          id: `expediente-observado-sin-motivo-${expediente.separacion_id}`,
          severidad: "MEDIA",
          categoria: "EXPEDIENTES",
          titulo: "Expediente observado sin motivo",
          descripcion: `${entidad} fue observado sin indicar que debe corregirse.`,
          recomendacion:
            "Registra una observacion concreta para que el asesor pueda subsanarla.",
          href: `/asesores/separaciones?separacion=${expediente.separacion_id}`,
          accion: "Completar observacion",
          entidad,
          responsable: asesor,
        });
      }
    });

    const limiteEventoMeta = new Date(
      new Date(fechaAuditoria).getTime() - 5 * 60 * 1000
    ).toISOString();
    const eventosMetaCompletados = eventosMeta.filter(
      (evento) => evento.status === "COMPLETADO"
    );

    eventosMeta.forEach((evento) => {
      if (evento.status === "ERROR") {
        lista.push({
          id: `meta-error-${evento.id}`,
          severidad: "ALTA",
          categoria: "INTEGRACIONES",
          titulo: "Meta entrego un lead con error",
          descripcion: `El lead ${evento.meta_lead_id} no completo su ingreso al CRM: ${
            evento.last_error || "error sin detalle"
          }`,
          recomendacion:
            "Corrige el error o recupera el Lead ID desde Leads entrantes antes de activar campanas.",
          href: "/asesores/leads",
          accion: "Revisar Meta",
          entidad: evento.meta_lead_id,
          responsable: "Gerencia",
        });
      }

      if (
        ["PENDIENTE", "PROCESANDO"].includes(evento.status) &&
        evento.received_at < limiteEventoMeta
      ) {
        lista.push({
          id: `meta-atascado-${evento.id}`,
          severidad: "ALTA",
          categoria: "INTEGRACIONES",
          titulo: "Evento Meta atascado",
          descripcion: `El lead ${evento.meta_lead_id} lleva mas de 5 minutos en ${evento.status}.`,
          recomendacion:
            "Revisa el webhook y recupera el lead para no perder el SLA comercial.",
          href: "/asesores/leads",
          accion: "Revisar evento",
          entidad: evento.meta_lead_id,
          responsable: "Gerencia",
        });
      }
    });

    if (eventosMetaCompletados.length === 0) {
      lista.push({
        id: "meta-sin-prueba-completa",
        severidad: eventosMeta.length > 0 ? "ALTA" : "MEDIA",
        categoria: "INTEGRACIONES",
        titulo: "Meta Lead Ads aun no esta validado extremo a extremo",
        descripcion:
          "No existe un evento Meta completado que confirme webhook, Graph API, Supabase y CRM.",
        recomendacion:
          "Realiza una sola prueba oficial antes de publicar la primera campana pagada.",
        href: "/asesores/leads",
        accion: "Abrir Leads entrantes",
        entidad: "Meta Lead Ads",
        responsable: "Gerencia",
      });
    }

    leadsPublicos
      .filter((lead) => lead.origen === "META_LEAD_ADS")
      .forEach((lead) => {
        const entidad = lead.nombre_completo || lead.external_id || lead.id;

        if (lead.estado !== "DESCARTADO" && !lead.cliente_id) {
          lista.push({
            id: `meta-lead-sin-cliente-${lead.id}`,
            severidad: "CRITICA",
            categoria: "INTEGRACIONES",
            titulo: "Lead Meta sin cliente creado",
            descripcion: `${entidad} ingreso desde Meta, pero no tiene cliente vinculado.`,
            recomendacion:
              "Recupera el lead y verifica que la captura cree o reutilice al cliente.",
            href: "/asesores/leads",
            accion: "Revisar lead",
            entidad,
            responsable: "Gerencia",
          });
        }

        if (lead.estado === "NUEVO" && !lead.asesor_id) {
          lista.push({
            id: `meta-lead-sin-asesor-${lead.id}`,
            severidad: "ALTA",
            categoria: "INTEGRACIONES",
            titulo: "Lead Meta nuevo sin asesor",
            descripcion: `${entidad} no tiene responsable para el primer contacto.`,
            recomendacion:
              "Asigna el lead o revisa la distribucion automatica antes de aumentar presupuesto.",
            href: "/asesores/leads",
            accion: "Asignar lead",
            entidad,
            responsable: "Sin asesor",
          });
        }
      });

    if (!configuracion) {
      lista.push({
        id: "configuracion-comercial-ausente",
        severidad: "CRITICA",
        categoria: "CONFIGURACION",
        titulo: "Falta configuracion comercial",
        descripcion:
          "No existe la configuracion del proyecto Las Lomas para SLA, inicial y cotizaciones.",
        recomendacion:
          "Completa Reglas comerciales antes de permitir cotizaciones y reparto de leads.",
        href: "/asesores/configuracion",
        accion: "Configurar CRM",
        entidad: "Las Lomas",
        responsable: "Gerencia",
      });
    } else {
      if (
        configuracion.sla_primer_contacto_minutos <= 0 ||
        configuracion.vigencia_cotizacion_dias <= 0 ||
        configuracion.inicial_minima <= 0 ||
        configuracion.monto_separacion_referencial < 0 ||
        configuracion.hora_inicio >= configuracion.hora_fin
      ) {
        lista.push({
          id: "configuracion-comercial-invalida",
          severidad: "CRITICA",
          categoria: "CONFIGURACION",
          titulo: "Reglas comerciales invalidas",
          descripcion:
            "SLA, horario, vigencia, inicial o separacion contienen valores que impiden operar correctamente.",
          recomendacion:
            "Corrige los valores desde Reglas comerciales y vuelve a ejecutar la auditoria.",
          href: "/asesores/configuracion",
          accion: "Corregir reglas",
          entidad: "Las Lomas",
          responsable: "Gerencia",
        });
      }

      if (
        configuracion.descuento_asesor_max_porcentaje < 0 ||
        configuracion.descuento_asesor_max_porcentaje > 30
      ) {
        lista.push({
          id: "descuento-asesor-invalido",
          severidad: "ALTA",
          categoria: "CONFIGURACION",
          titulo: "Limite de descuento fuera de rango",
          descripcion:
            "El descuento permitido al asesor no es consistente con las reglas del CRM.",
          recomendacion:
            "Define un porcentaje entre 0 y 30 antes de emitir propuestas.",
          href: "/asesores/configuracion",
          accion: "Revisar descuentos",
          entidad: "Reglas comerciales",
          responsable: "Gerencia",
        });
      }
    }

    const gerentesActivos = asesores.filter(
      (asesor) =>
        asesor.active !== false &&
        ["admin", "jefe_ventas"].includes(asesor.role)
    );
    const asesoresActivos = asesores.filter(
      (asesor) => asesor.active !== false && asesor.role === "asesor"
    );

    if (gerentesActivos.length === 0) {
      lista.push({
        id: "equipo-sin-gerencia",
        severidad: "CRITICA",
        categoria: "PERMISOS",
        titulo: "No hay gerencia activa",
        descripcion:
          "El CRM no tiene admin o jefe de ventas activo para aprobar cierres y expedientes.",
        recomendacion:
          "Activa al menos un responsable de gerencia antes de iniciar operaciones.",
        entidad: "Equipo CRM",
        responsable: "Gerencia",
      });
    }

    if (asesoresActivos.length === 0) {
      lista.push({
        id: "equipo-sin-asesores",
        severidad: "CRITICA",
        categoria: "PERMISOS",
        titulo: "No hay asesores activos",
        descripcion:
          "No existe un asesor habilitado para recibir leads y gestionar ventas.",
        recomendacion:
          "Crea o activa las cuentas comerciales antes de lanzar publicidad.",
        entidad: "Equipo CRM",
        responsable: "Gerencia",
      });
    }

    return lista.sort((a, b) => {
      const severidadOrden =
        pesoSeveridad[a.severidad] - pesoSeveridad[b.severidad];

      if (severidadOrden !== 0) return severidadOrden;

      return a.categoria.localeCompare(b.categoria);
    });
  }, [
    asesores,
    asesoresPorId,
    clientes,
    clientesPorId,
    configuracion,
    cotizaciones,
    documentosPorSeparacion,
    eventosMeta,
    expedientes,
    expedientesPorSeparacion,
    fechaAuditoria,
    leadsPublicos,
    lotes,
    lotesPorId,
    separaciones,
    separacionesActivasPorLote,
    separacionesPorId,
  ]);

  const hallazgosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return hallazgos.filter((hallazgo) => {
      if (categoria !== "TODAS" && hallazgo.categoria !== categoria) {
        return false;
      }

      if (severidad !== "TODAS" && hallazgo.severidad !== severidad) {
        return false;
      }

      if (!texto) return true;

      return [
        hallazgo.titulo,
        hallazgo.descripcion,
        hallazgo.recomendacion,
        hallazgo.entidad,
        hallazgo.responsable,
        hallazgo.categoria,
        hallazgo.severidad,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, categoria, hallazgos, severidad]);

  const resumen = useMemo(
    () => ({
      total: hallazgos.length,
      criticas: hallazgos.filter(
        (hallazgo) => hallazgo.severidad === "CRITICA"
      ).length,
      altas: hallazgos.filter(
        (hallazgo) => hallazgo.severidad === "ALTA"
      ).length,
      cotizaciones: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "COTIZACIONES"
      ).length,
      expedientes: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "EXPEDIENTES"
      ).length,
      integraciones: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "INTEGRACIONES"
      ).length,
    }),
    [hallazgos]
  );

  const controlesLanzamiento = useMemo(() => {
    const tieneCritico = (...categoriasAuditadas: Categoria[]) =>
      hallazgos.some(
        (hallazgo) =>
          hallazgo.severidad === "CRITICA" &&
          categoriasAuditadas.includes(hallazgo.categoria)
      );
    const gerenciaActiva = asesores.some(
      (asesor) =>
        asesor.active !== false &&
        ["admin", "jefe_ventas"].includes(asesor.role)
    );
    const asesorActivo = asesores.some(
      (asesor) => asesor.active !== false && asesor.role === "asesor"
    );
    const metaCompletado = eventosMeta.some(
      (evento) => evento.status === "COMPLETADO"
    );

    return [
      {
        id: "cartera",
        label: "Cartera y seguimiento",
        detalle: "Clientes, duplicados y responsables",
        listo: !tieneCritico("DATOS", "DUPLICADOS", "SEGUIMIENTO"),
        categoria: "DATOS" as FiltroCategoria,
      },
      {
        id: "inventario",
        label: "Inventario comercial",
        detalle: "Lotes y separaciones consistentes",
        listo: !tieneCritico("LOTES", "SEPARACIONES"),
        categoria: "LOTES" as FiltroCategoria,
      },
      {
        id: "cotizaciones",
        label: "Cotizaciones",
        detalle: "Propuestas y conversiones trazables",
        listo: !tieneCritico("COTIZACIONES"),
        categoria: "COTIZACIONES" as FiltroCategoria,
      },
      {
        id: "expedientes",
        label: "Cierres documentales",
        detalle: "Pago, DNI, voucher y separacion",
        listo: !tieneCritico("EXPEDIENTES"),
        categoria: "EXPEDIENTES" as FiltroCategoria,
      },
      {
        id: "operacion",
        label: "Reglas y equipo",
        detalle: "Configuracion y usuarios activos",
        listo:
          Boolean(configuracion) &&
          gerenciaActiva &&
          asesorActivo &&
          !tieneCritico("CONFIGURACION", "PERMISOS"),
        categoria: "CONFIGURACION" as FiltroCategoria,
      },
      {
        id: "meta",
        label: "Meta Lead Ads",
        detalle: "Prueba completa de punta a punta",
        listo: metaCompletado && !tieneCritico("INTEGRACIONES"),
        categoria: "INTEGRACIONES" as FiltroCategoria,
      },
    ];
  }, [asesores, configuracion, eventosMeta, hallazgos]);

  const controlesAprobados = controlesLanzamiento.filter(
    (control) => control.listo
  ).length;
  const controlesPendientes =
    controlesLanzamiento.length - controlesAprobados;
  const estadoLanzamiento =
    controlesPendientes > 0 || resumen.criticas > 0
      ? {
          etiqueta: "BLOQUEADO",
          titulo: "Aun no conviene iniciar ventas en produccion",
          detalle: `${controlesPendientes} controles requieren atencion antes del lanzamiento.`,
          color: "#8f241b",
          fondo: "#fff4f2",
          borde: "#efb9b2",
        }
      : resumen.altas > 0
        ? {
            etiqueta: "CON OBSERVACIONES",
            titulo: "El CRM puede operar con ajustes pendientes",
            detalle: `Quedan ${resumen.altas} hallazgos altos que deben tener responsable y fecha de correccion.`,
            color: "#7a4b00",
            fondo: "#fff8e8",
            borde: "#e8cd86",
          }
        : {
            etiqueta: "LISTO",
            titulo: "Controles esenciales aprobados",
            detalle:
              "El CRM no presenta bloqueos criticos detectados por esta auditoria.",
            color: "#17633a",
            fondo: "#eff8f1",
            borde: "#b9dcc3",
          };

  const categorias: {
    id: FiltroCategoria;
    label: string;
  }[] = [
    {
      id: "TODAS",
      label: "Todas",
    },
    {
      id: "DATOS",
      label: "Datos",
    },
    {
      id: "DUPLICADOS",
      label: "Duplicados",
    },
    {
      id: "SEGUIMIENTO",
      label: "Seguimiento",
    },
    {
      id: "SEPARACIONES",
      label: "Separaciones",
    },
    {
      id: "LOTES",
      label: "Lotes",
    },
    {
      id: "PERMISOS",
      label: "Permisos",
    },
    {
      id: "COTIZACIONES",
      label: "Cotizaciones",
    },
    {
      id: "EXPEDIENTES",
      label: "Expedientes",
    },
    {
      id: "INTEGRACIONES",
      label: "Integraciones",
    },
    {
      id: "CONFIGURACION",
      label: "Configuracion",
    },
  ];

  const severidades: {
    id: FiltroSeveridad;
    label: string;
  }[] = [
    {
      id: "TODAS",
      label: "Todas",
    },
    {
      id: "CRITICA",
      label: "Criticas",
    },
    {
      id: "ALTA",
      label: "Altas",
    },
    {
      id: "MEDIA",
      label: "Medias",
    },
    {
      id: "BAJA",
      label: "Bajas",
    },
  ];

  if (!cargando && !modoGerencia) {
    return (
      <AsesorLayout
        title="Calidad CRM"
        subtitle="Modulo reservado para admin y jefe de ventas."
      >
        <div style={emptyBox}>
          Tu usuario no tiene permisos para ver auditoria comercial.
        </div>
      </AsesorLayout>
    );
  }

  return (
    <AsesorLayout
      title="Calidad CRM"
      subtitle="Auditoria comercial de datos, procesos y riesgos operativos."
    >
      <section>
        <div style={header}>
          <div>
            <h1 style={title}>Auditoria comercial</h1>
            <p style={subtitle}>
              Detecta problemas que pueden costar ventas: datos
              incompletos, duplicados, seguimientos vencidos,
              separaciones, cotizaciones, cierres documentales e
              integraciones inconsistentes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void cargar()}
            style={refreshButton}
          >
            Actualizar auditoria
          </button>
        </div>

        <div
          style={{
            ...launchStatus,
            color: estadoLanzamiento.color,
            background: estadoLanzamiento.fondo,
            borderColor: estadoLanzamiento.borde,
          }}
        >
          <div style={launchStatusCopy}>
            <span style={launchEyebrow}>
              Preparacion para lanzamiento · {estadoLanzamiento.etiqueta}
            </span>
            <h2 style={launchTitle}>{estadoLanzamiento.titulo}</h2>
            <p style={launchDescription}>{estadoLanzamiento.detalle}</p>
          </div>

          <div style={launchScore}>
            <strong>
              {controlesAprobados}/{controlesLanzamiento.length}
            </strong>
            <span>controles aprobados</span>
          </div>
        </div>

        <div style={launchChecksGrid}>
          {controlesLanzamiento.map((control) => (
            <button
              key={control.id}
              type="button"
              onClick={() => {
                setSeveridad("TODAS");
                setCategoria(control.categoria);
              }}
              style={{
                ...launchCheck,
                ...(control.listo ? launchCheckReady : launchCheckPending),
              }}
            >
              <span style={launchCheckStatus}>
                {control.listo ? "APROBADO" : "PENDIENTE"}
              </span>
              <strong>{control.label}</strong>
              <small>{control.detalle}</small>
            </button>
          ))}
        </div>

        <div style={summaryGrid}>
          <button
            type="button"
            onClick={() => {
              setSeveridad("TODAS");
              setCategoria("TODAS");
            }}
            style={summaryCard}
          >
            <span>Total hallazgos</span>
            <strong>{resumen.total}</strong>
          </button>

          <button
            type="button"
            onClick={() => setSeveridad("CRITICA")}
            style={summaryCardRed}
          >
            <span>Criticos</span>
            <strong>{resumen.criticas}</strong>
          </button>

          <button
            type="button"
            onClick={() => setSeveridad("ALTA")}
            style={summaryCardGold}
          >
            <span>Altos</span>
            <strong>{resumen.altas}</strong>
          </button>

          <button
            type="button"
            onClick={() => setCategoria("COTIZACIONES")}
            style={summaryCardBlue}
          >
            <span>Cotizaciones</span>
            <strong>{resumen.cotizaciones}</strong>
          </button>

          <button
            type="button"
            onClick={() => setCategoria("EXPEDIENTES")}
            style={summaryCardGreen}
          >
            <span>Expedientes</span>
            <strong>{resumen.expedientes}</strong>
          </button>

          <button
            type="button"
            onClick={() => setCategoria("INTEGRACIONES")}
            style={summaryCardPurple}
          >
            <span>Integraciones</span>
            <strong>{resumen.integraciones}</strong>
          </button>
        </div>

        <div style={toolbar}>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar hallazgo, cliente, lote o asesor"
            style={search}
          />

          <select
            value={categoria}
            onChange={(event) =>
              setCategoria(event.target.value as FiltroCategoria)
            }
            style={select}
          >
            {categorias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={severidad}
            onChange={(event) =>
              setSeveridad(event.target.value as FiltroSeveridad)
            }
            style={select}
          >
            {severidades.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>Cargando auditoria...</div>
        ) : hallazgosFiltrados.length === 0 ? (
          <div style={emptyBox}>
            No hay hallazgos con estos filtros. Buen signo: el
            proceso comercial esta ordenado en esta vista.
          </div>
        ) : (
          <div style={findingsGrid}>
            {hallazgosFiltrados.map((hallazgo) => {
              const severidadColor = colorSeveridad(
                hallazgo.severidad
              );

              return (
                <article key={hallazgo.id} style={findingCard}>
                  <div style={findingTop}>
                    <div>
                      <span style={categoryLabel}>
                        {etiquetaCategoria(hallazgo.categoria)}
                      </span>
                      <h2 style={findingTitle}>{hallazgo.titulo}</h2>
                    </div>

                    <span
                      style={{
                        ...severityBadge,
                        background: severidadColor.bg,
                        color: severidadColor.fg,
                        borderColor: severidadColor.border,
                      }}
                    >
                      {hallazgo.severidad}
                    </span>
                  </div>

                  <p style={findingDescription}>
                    {hallazgo.descripcion}
                  </p>

                  <div style={metaGrid}>
                    <div style={metaBox}>
                      <span>Entidad</span>
                      <strong>{hallazgo.entidad}</strong>
                    </div>

                    <div style={metaBox}>
                      <span>Responsable</span>
                      <strong>{hallazgo.responsable || "-"}</strong>
                    </div>
                  </div>

                  <div style={recommendationBox}>
                    <span>Recomendacion</span>
                    <strong>{hallazgo.recomendacion}</strong>
                  </div>

                  {hallazgo.href && (
                    <Link href={hallazgo.href} style={primaryButton}>
                      {hallazgo.accion || "Abrir"}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div style={legendBox}>
          <h2 style={sectionTitle}>Como usar este panel</h2>
          <p style={legendText}>
            Atiende primero los hallazgos criticos, luego los altos.
            Cuando un hallazgo desaparece tras corregir datos o estados,
            significa que el proceso vuelve a estar consistente.
          </p>
        </div>
      </section>
    </AsesorLayout>
  );
}

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  maxWidth: 760,
  lineHeight: 1.45,
};

const refreshButton: React.CSSProperties = {
  height: 42,
  border: "1px solid #c8d8bf",
  background: "#f5e6b8",
  color: "#4f3f16",
  borderRadius: 12,
  padding: "0 14px",
  fontWeight: 950,
  cursor: "pointer",
};

const launchStatus: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  padding: "16px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  marginBottom: 12,
};

const launchStatusCopy: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const launchEyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
};

const launchTitle: React.CSSProperties = {
  margin: 0,
  color: "inherit",
  fontSize: 21,
  fontWeight: 950,
};

const launchDescription: React.CSSProperties = {
  margin: 0,
  color: "inherit",
  lineHeight: 1.4,
};

const launchScore: React.CSSProperties = {
  minWidth: 126,
  display: "grid",
  justifyItems: "end",
  gap: 2,
};

const launchChecksGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
  marginBottom: 18,
};

const launchCheck: React.CSSProperties = {
  minHeight: 92,
  border: "1px solid",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  alignContent: "start",
  gap: 4,
  textAlign: "left",
  cursor: "pointer",
  color: "#1f2937",
};

const launchCheckReady: React.CSSProperties = {
  background: "#f4faf5",
  borderColor: "#c9e4d0",
};

const launchCheckPending: React.CSSProperties = {
  background: "#fff7f5",
  borderColor: "#efc3bd",
};

const launchCheckStatus: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 950,
  color: "#536171",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryBase: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  textAlign: "left",
  cursor: "pointer",
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const summaryCard: React.CSSProperties = {
  ...summaryBase,
  background: "#ffffff",
  color: "#0f172a",
};

const summaryCardRed: React.CSSProperties = {
  ...summaryBase,
  background: "#fff1ef",
  color: "#8b2f25",
  borderColor: "#f3c7c0",
};

const summaryCardGold: React.CSSProperties = {
  ...summaryBase,
  background: "#fff8e1",
  color: "#8a5a00",
  borderColor: "#eed28a",
};

const summaryCardBlue: React.CSSProperties = {
  ...summaryBase,
  background: "#eef6ff",
  color: "#244d77",
  borderColor: "#c7ddf4",
};

const summaryCardGreen: React.CSSProperties = {
  ...summaryBase,
  background: "#eef8f1",
  color: "#17633a",
  borderColor: "#c9e7d2",
};

const summaryCardPurple: React.CSSProperties = {
  ...summaryBase,
  background: "#f4f1ff",
  color: "#4c3d8f",
  borderColor: "#d8d1ff",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 18,
};

const search: React.CSSProperties = {
  width: "min(100%, 430px)",
  height: 42,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
};

const select: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 800,
};

const findingsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const findingCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const findingTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const categoryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const findingTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 950,
};

const severityBadge: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const findingDescription: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.45,
};

const metaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
};

const metaBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
  color: "#334155",
  fontSize: 13,
};

const recommendationBox: React.CSSProperties = {
  borderRadius: 14,
  background: "#fbfdfb",
  border: "1px solid #d9e6db",
  padding: 11,
  display: "grid",
  gap: 4,
  color: "#1f2937",
  fontSize: 13,
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: 38,
  borderRadius: 10,
  textDecoration: "none",
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 13,
};

const legendBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 20,
  fontWeight: 950,
};

const legendText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  lineHeight: 1.45,
};

const alert: React.CSSProperties = {
  background: "#fff3d6",
  color: "#7a4b12",
  border: "1px solid #f2d492",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 16,
  borderRadius: 14,
  fontWeight: 800,
};
