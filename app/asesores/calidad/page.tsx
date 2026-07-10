"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  esGerencia,
  etiquetaEstado,
  nombreCliente,
  type Cliente,
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
  | "PERMISOS";

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
  const [asesores, setAsesores] = useState<Profile[]>([]);
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
    ]);

    const errorActual =
      clientesResult.error ||
      lotesResult.error ||
      separacionesResult.error ||
      asesoresResult.error;

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
    setAsesores(
      (asesoresResult.data || []) as unknown as Profile[]
    );
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
    lotes,
    lotesPorId,
    separaciones,
    separacionesActivasPorLote,
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
      duplicados: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "DUPLICADOS"
      ).length,
      lotes: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "LOTES"
      ).length,
      separaciones: hallazgos.filter(
        (hallazgo) => hallazgo.categoria === "SEPARACIONES"
      ).length,
    }),
    [hallazgos]
  );

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
              separaciones mal registradas y lotes inconsistentes.
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
            onClick={() => setCategoria("DUPLICADOS")}
            style={summaryCardBlue}
          >
            <span>Duplicados</span>
            <strong>{resumen.duplicados}</strong>
          </button>

          <button
            type="button"
            onClick={() => setCategoria("LOTES")}
            style={summaryCardGreen}
          >
            <span>Lotes</span>
            <strong>{resumen.lotes}</strong>
          </button>

          <button
            type="button"
            onClick={() => setCategoria("SEPARACIONES")}
            style={summaryCardPurple}
          >
            <span>Separaciones</span>
            <strong>{resumen.separaciones}</strong>
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
