"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  colorEstado,
  colorNivelInteres,
  esGerencia,
  etiquetaEstado,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type TipoTarea =
  | "SEGUIMIENTO_VENCIDO"
  | "SEGUIMIENTO_HOY"
  | "LEAD_CALIENTE"
  | "CITA_PENDIENTE"
  | "SEPARACION_VENCIDA"
  | "SEPARACION_HOY"
  | "SEPARACION_PRONTO"
  | "LIBERACION_SOLICITADA"
  | "CIERRE_SOLICITADO";

type TonoTarea = "red" | "gold" | "blue" | "green";

type Tarea = {
  id: string;
  tipo: TipoTarea;
  titulo: string;
  descripcion: string;
  accion: string;
  href: string;
  prioridad: number;
  fechaOrden: string;
  tono: TonoTarea;
  cliente?: Cliente;
  separacion?: Separacion;
  lote?: LoteCrm;
};

type FiltroTareas =
  | "TODAS"
  | "CRITICAS"
  | "HOY"
  | "PROXIMAS"
  | "CLIENTES"
  | "SEPARACIONES"
  | "APROBACIONES";

const obtenerFechaHoyISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const sumarDiasISO = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatearFechaLocal = (
  fecha: string | null | undefined
) => {
  if (!fecha) return "-";

  const fechaLimpia = fecha.split("T")[0];
  const [year, month, day] = fechaLimpia
    .split("-")
    .map(Number);

  if (!year || !month || !day) return "-";

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString("es-PE");
};

const nombreLote = (lote?: LoteCrm | null) =>
  lote ? `MZ ${lote.mz} - LOTE ${lote.lote}` : "Lote sin dato";

const esClienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

export default function CentroTareasPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [filtro, setFiltro] =
    useState<FiltroTareas>("TODAS");
  const [error, setError] =
    useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

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

    const modoGerencia = esGerencia(perfil.profile);

    let clientesQuery = supabase
      .from("clientes")
      .select(
        [
          "id",
          "nombres",
          "apellidos",
          "dni",
          "celular",
          "correo",
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
      );

    let separacionesQuery = supabase
      .from("separaciones")
      .select(
        "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
      );

    let lotesQuery = supabase
      .from(LOTES_TABLE)
      .select(
        "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
      );

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      separacionesQuery = separacionesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      lotesQuery = lotesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const [
      clientesResult,
      separacionesResult,
      lotesResult,
    ] = await Promise.all([
      clientesQuery.order("fecha_proximo_seguimiento", {
        ascending: true,
        nullsFirst: false,
      }),
      separacionesQuery.order("fecha_limite", {
        ascending: true,
        nullsFirst: false,
      }),
      lotesQuery.order("updated_at", {
        ascending: false,
      }),
    ]);

    const errorActual =
      clientesResult.error ||
      separacionesResult.error ||
      lotesResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setClientes(
      ((clientesResult.data || []) as unknown as Cliente[]).filter(
        esClienteActivo
      )
    );
    setSeparaciones(
      (separacionesResult.data || []) as unknown as Separacion[]
    );
    setLotes(
      (lotesResult.data || []) as unknown as LoteCrm[]
    );
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const tareas = useMemo<Tarea[]>(() => {
    const hoy = obtenerFechaHoyISO();
    const pronto = sumarDiasISO(2);
    const clientesPorId = new Map(
      clientes.map((cliente) => [cliente.id, cliente])
    );
    const lotesPorId = new Map(
      lotes.map((lote) => [lote.id, lote])
    );
    const lista: Tarea[] = [];

    clientes.forEach((cliente) => {
      const fecha =
        cliente.fecha_proximo_seguimiento || "";
      const hrefCliente = `/asesores/clientes/${cliente.id}`;

      if (fecha && fecha < hoy) {
        lista.push({
          id: `seguimiento-vencido-${cliente.id}`,
          tipo: "SEGUIMIENTO_VENCIDO",
          titulo: "Seguimiento vencido",
          descripcion: `${nombreCliente(
            cliente
          )} debio ser contactado el ${formatearFechaLocal(
            fecha
          )}.`,
          accion: "Registrar seguimiento",
          href: hrefCliente,
          prioridad:
            cliente.nivel_interes === "CALIENTE" ? 1 : 2,
          fechaOrden: fecha,
          tono: "red",
          cliente,
        });
      }

      if (fecha && fecha === hoy) {
        lista.push({
          id: `seguimiento-hoy-${cliente.id}`,
          tipo: "SEGUIMIENTO_HOY",
          titulo: "Seguimiento para hoy",
          descripcion: `${nombreCliente(
            cliente
          )} tiene contacto programado para hoy.`,
          accion: "Atender cliente",
          href: hrefCliente,
          prioridad:
            cliente.nivel_interes === "CALIENTE" ? 2 : 3,
          fechaOrden: fecha,
          tono: "blue",
          cliente,
        });
      }

      if (
        cliente.nivel_interes === "CALIENTE" &&
        !fecha
      ) {
        lista.push({
          id: `lead-caliente-${cliente.id}`,
          tipo: "LEAD_CALIENTE",
          titulo: "Lead caliente sin fecha",
          descripcion: `${nombreCliente(
            cliente
          )} es caliente, pero no tiene proximo seguimiento.`,
          accion: "Programar accion",
          href: hrefCliente,
          prioridad: 2,
          fechaOrden: hoy,
          tono: "gold",
          cliente,
        });
      }

      if (
        cliente.canal_preferido === "CITA_OFICINA" &&
        cliente.estado_cita === "CITA_SOLICITADA"
      ) {
        lista.push({
          id: `cita-pendiente-${cliente.id}`,
          tipo: "CITA_PENDIENTE",
          titulo: "Cita por programar",
          descripcion: `${nombreCliente(
            cliente
          )} pidio cita en oficina y aun falta pactar fecha y hora.`,
          accion: "Programar cita",
          href: hrefCliente,
          prioridad: 2,
          fechaOrden: cliente.fecha_cita || hoy,
          tono: "gold",
          cliente,
        });
      }
    });

    separaciones
      .filter(
        (separacion) =>
          separacion.estado === "ACTIVA" ||
          Boolean(separacion.liberacion_solicitada)
      )
      .forEach((separacion) => {
        const cliente = separacion.cliente_id
          ? clientesPorId.get(separacion.cliente_id)
          : undefined;
        const lote = separacion.lote_id
          ? lotesPorId.get(Number(separacion.lote_id))
          : undefined;
        const fecha = separacion.fecha_limite || "";

        if (separacion.liberacion_solicitada) {
          lista.push({
            id: `liberacion-${separacion.id}`,
            tipo: "LIBERACION_SOLICITADA",
            titulo: modoGerencia
              ? "Liberacion pendiente"
              : "Liberacion solicitada",
            descripcion: modoGerencia
              ? `${nombreLote(
                  lote
                )} requiere revision para liberar o mantener la separacion.`
              : `${nombreLote(
                  lote
                )} esta esperando revision de gerencia.`,
            accion: "Revisar separacion",
            href: "/asesores/separaciones",
            prioridad: modoGerencia ? 1 : 3,
            fechaOrden:
              separacion.fecha_solicitud_liberacion ||
              fecha ||
              hoy,
            tono: "red",
            cliente,
            separacion,
            lote,
          });
        }

        if (!fecha || separacion.estado !== "ACTIVA") {
          return;
        }

        if (fecha < hoy) {
          lista.push({
            id: `separacion-vencida-${separacion.id}`,
            tipo: "SEPARACION_VENCIDA",
            titulo: "Separacion vencida",
            descripcion: `${nombreLote(
              lote
            )} vencio el ${formatearFechaLocal(
              fecha
            )}. Confirmar pago o solicitar liberacion.`,
            accion: "Gestionar separacion",
            href: "/asesores/separaciones",
            prioridad: 1,
            fechaOrden: fecha,
            tono: "red",
            cliente,
            separacion,
            lote,
          });
          return;
        }

        if (fecha === hoy) {
          lista.push({
            id: `separacion-hoy-${separacion.id}`,
            tipo: "SEPARACION_HOY",
            titulo: "Separacion vence hoy",
            descripcion: `${nombreLote(
              lote
            )} vence hoy. Confirmar inicial o documentacion.`,
            accion: "Contactar cliente",
            href: "/asesores/separaciones",
            prioridad: 1,
            fechaOrden: fecha,
            tono: "gold",
            cliente,
            separacion,
            lote,
          });
          return;
        }

        if (fecha <= pronto) {
          lista.push({
            id: `separacion-pronto-${separacion.id}`,
            tipo: "SEPARACION_PRONTO",
            titulo: "Separacion por vencer",
            descripcion: `${nombreLote(
              lote
            )} vence el ${formatearFechaLocal(
              fecha
            )}. Anticipar seguimiento.`,
            accion: "Revisar separacion",
            href: "/asesores/separaciones",
            prioridad: 3,
            fechaOrden: fecha,
            tono: "gold",
            cliente,
            separacion,
            lote,
          });
        }
      });

    lotes
      .filter(
        (lote) => lote.estado === "CIERRE_SOLICITADO"
      )
      .forEach((lote) => {
        const cliente = lote.cliente_id
          ? clientesPorId.get(lote.cliente_id)
          : undefined;

        lista.push({
          id: `cierre-${lote.id}`,
          tipo: "CIERRE_SOLICITADO",
          titulo: modoGerencia
            ? "Cierre por aprobar"
            : "Cierre en revision",
          descripcion: modoGerencia
            ? `${nombreLote(
                lote
              )} esta listo para validacion de venta.`
            : `${nombreLote(
                lote
              )} espera aprobacion de admin o jefe de ventas.`,
          accion: modoGerencia
            ? "Aprobar o revisar"
            : "Ver lote",
          href: "/asesores/lotes",
          prioridad: modoGerencia ? 1 : 3,
          fechaOrden: lote.updated_at || hoy,
          tono: modoGerencia ? "red" : "blue",
          cliente,
          lote,
        });
      });

    return lista.sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }

      const fecha = a.fechaOrden.localeCompare(b.fechaOrden);

      if (fecha !== 0) return fecha;

      return a.titulo.localeCompare(b.titulo);
    });
  }, [clientes, lotes, modoGerencia, separaciones]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((tarea) => {
      if (filtro === "TODAS") return true;
      if (filtro === "CRITICAS") {
        return tarea.prioridad === 1;
      }
      if (filtro === "HOY") {
        return [
          "SEGUIMIENTO_HOY",
          "SEPARACION_HOY",
        ].includes(tarea.tipo);
      }
      if (filtro === "PROXIMAS") {
        return tarea.tipo === "SEPARACION_PRONTO";
      }
      if (filtro === "CLIENTES") {
        return [
          "SEGUIMIENTO_VENCIDO",
          "SEGUIMIENTO_HOY",
          "LEAD_CALIENTE",
          "CITA_PENDIENTE",
        ].includes(tarea.tipo);
      }
      if (filtro === "SEPARACIONES") {
        return [
          "SEPARACION_VENCIDA",
          "SEPARACION_HOY",
          "SEPARACION_PRONTO",
          "LIBERACION_SOLICITADA",
        ].includes(tarea.tipo);
      }
      if (filtro === "APROBACIONES") {
        return [
          "LIBERACION_SOLICITADA",
          "CIERRE_SOLICITADO",
        ].includes(tarea.tipo);
      }

      return true;
    });
  }, [filtro, tareas]);

  const resumen = useMemo(
    () => ({
      total: tareas.length,
      criticas: tareas.filter(
        (tarea) => tarea.prioridad === 1
      ).length,
      hoy: tareas.filter((tarea) =>
        [
          "SEGUIMIENTO_HOY",
          "SEPARACION_HOY",
        ].includes(tarea.tipo)
      ).length,
      aprobaciones: tareas.filter((tarea) =>
        [
          "LIBERACION_SOLICITADA",
          "CIERRE_SOLICITADO",
        ].includes(tarea.tipo)
      ).length,
    }),
    [tareas]
  );

  const filtros: {
    id: FiltroTareas;
    label: string;
  }[] = [
    {
      id: "TODAS",
      label: "Todas",
    },
    {
      id: "CRITICAS",
      label: "Criticas",
    },
    {
      id: "HOY",
      label: "Hoy",
    },
    {
      id: "PROXIMAS",
      label: "Proximas",
    },
    {
      id: "CLIENTES",
      label: "Clientes",
    },
    {
      id: "SEPARACIONES",
      label: "Separaciones",
    },
    {
      id: "APROBACIONES",
      label: "Aprobaciones",
    },
  ];

  const renderTarea = (tarea: Tarea) => {
    const color =
      tarea.lote && tarea.tipo === "CIERRE_SOLICITADO"
        ? colorEstado(tarea.lote.estado)
        : tarea.cliente
          ? colorNivelInteres(tarea.cliente.nivel_interes)
          : {
              bg: "#eef2f7",
              fg: "#334155",
            };

    const cardStyle = {
      ...tareaCard,
      ...(tarea.tono === "red"
        ? tareaCardRed
        : tarea.tono === "gold"
          ? tareaCardGold
          : tarea.tono === "green"
            ? tareaCardGreen
            : tareaCardBlue),
    };

    return (
      <article key={tarea.id} style={cardStyle}>
        <div style={taskTop}>
          <div>
            <div style={taskType}>{tarea.titulo}</div>
            <h2 style={taskTitle}>
              {tarea.lote
                ? nombreLote(tarea.lote)
                : tarea.cliente
                  ? nombreCliente(tarea.cliente)
                  : "Tarea comercial"}
            </h2>
          </div>

          <span
            style={{
              ...taskBadge,
              background: color.bg,
              color: color.fg,
            }}
          >
            {tarea.lote
              ? etiquetaEstado(tarea.lote.estado)
              : tarea.cliente
                ? etiquetaNivelInteres(
                    tarea.cliente.nivel_interes
                  )
                : "Pendiente"}
          </span>
        </div>

        <p style={taskDescription}>
          {tarea.descripcion}
        </p>

        <div style={detailsGrid}>
          {tarea.cliente && (
            <>
              <div style={detailBox}>
                <span>Cliente</span>
                <strong>
                  {nombreCliente(tarea.cliente)}
                </strong>
              </div>

              <div style={detailBox}>
                <span>WhatsApp</span>
                <strong>
                  {tarea.cliente.celular || "-"}
                </strong>
              </div>

              <div style={detailBox}>
                <span>Estado lead</span>
                <strong>
                  {etiquetaEstadoLead(
                    tarea.cliente.estado_lead
                  )}
                </strong>
              </div>

              <div style={detailBox}>
                <span>Accion</span>
                <strong>
                  {etiquetaProximaAccion(
                    tarea.cliente.proxima_accion
                  )}
                </strong>
              </div>
            </>
          )}

          {tarea.separacion && (
            <>
              <div style={detailBox}>
                <span>Vencimiento</span>
                <strong>
                  {formatearFechaLocal(
                    tarea.separacion.fecha_limite
                  )}
                </strong>
              </div>

              <div style={detailBox}>
                <span>Separacion</span>
                <strong>
                  {formatearMoneda(
                    tarea.separacion.monto_separacion
                  )}
                </strong>
              </div>
            </>
          )}
        </div>

        <div style={taskActions}>
          <Link href={tarea.href} style={primaryButton}>
            {tarea.accion}
          </Link>

          {tarea.cliente && (
            <Link
              href={`/asesores/clientes/${tarea.cliente.id}`}
              style={secondaryButton}
            >
              Ver ficha
            </Link>
          )}
        </div>
      </article>
    );
  };

  return (
    <AsesorLayout
      title="Centro de tareas"
      subtitle={
        modoGerencia
          ? "Prioridades comerciales del equipo: leads, separaciones, liberaciones y cierres."
          : "Tu bandeja diaria para no perder leads ni separaciones."
      }
    >
      <section>
        <div style={summaryGrid}>
          <div style={summaryCard}>
            <span>Total pendiente</span>
            <strong>{resumen.total}</strong>
          </div>

          <div style={summaryCardRed}>
            <span>Criticas</span>
            <strong>{resumen.criticas}</strong>
          </div>

          <div style={summaryCardBlue}>
            <span>Para hoy</span>
            <strong>{resumen.hoy}</strong>
          </div>

          <div style={summaryCardGold}>
            <span>Aprobaciones</span>
            <strong>{resumen.aprobaciones}</strong>
          </div>
        </div>

        <div style={toolbar}>
          <div style={filterGroup}>
            {filtros.map((item) => {
              const active = filtro === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFiltro(item.id)}
                  style={{
                    ...filterButton,
                    ...(active ? filterButtonActive : {}),
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void cargar()}
            style={refreshButton}
          >
            Actualizar
          </button>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>
            Cargando centro de tareas...
          </div>
        ) : tareasFiltradas.length === 0 ? (
          <div style={emptyBox}>
            No hay tareas en este filtro. Buen momento para
            revisar nuevos leads o reportes.
          </div>
        ) : (
          <div style={tasksGrid}>
            {tareasFiltradas.map(renderTarea)}
          </div>
        )}
      </section>
    </AsesorLayout>
  );
}

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCardBase: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const summaryCard: React.CSSProperties = {
  ...summaryCardBase,
  background: "#ffffff",
  color: "#0f172a",
};

const summaryCardRed: React.CSSProperties = {
  ...summaryCardBase,
  background: "#fff1ef",
  color: "#8b2f25",
  borderColor: "#f3c7c0",
};

const summaryCardBlue: React.CSSProperties = {
  ...summaryCardBase,
  background: "#eef6ff",
  color: "#244d77",
  borderColor: "#c7ddf4",
};

const summaryCardGold: React.CSSProperties = {
  ...summaryCardBase,
  background: "#fff8e1",
  color: "#8a5a00",
  borderColor: "#eed28a",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
};

const filterGroup: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterButton: React.CSSProperties = {
  border: "1px solid #d7ddcf",
  background: "#ffffff",
  color: "#36513f",
  borderRadius: 999,
  padding: "9px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const filterButtonActive: React.CSSProperties = {
  background: "#2f7d46",
  borderColor: "#2f7d46",
  color: "#ffffff",
};

const refreshButton: React.CSSProperties = {
  border: "1px solid #c8d8bf",
  background: "#f5e6b8",
  color: "#4f3f16",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 950,
  cursor: "pointer",
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

const tasksGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))",
  gap: 14,
};

const tareaCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const tareaCardRed: React.CSSProperties = {
  borderColor: "#f3c7c0",
  borderLeft: "5px solid #dc2626",
};

const tareaCardGold: React.CSSProperties = {
  borderColor: "#eed28a",
  borderLeft: "5px solid #d97706",
};

const tareaCardBlue: React.CSSProperties = {
  borderColor: "#c7ddf4",
  borderLeft: "5px solid #2563eb",
};

const tareaCardGreen: React.CSSProperties = {
  borderColor: "#c9e7d2",
  borderLeft: "5px solid #2f7d46",
};

const taskTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const taskType: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const taskTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 19,
  fontWeight: 950,
};

const taskBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const taskDescription: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.45,
};

const detailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
};

const detailBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
  color: "#334155",
  fontSize: 13,
};

const taskActions: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
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
  textAlign: "center",
};

const secondaryButton: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: 38,
  borderRadius: 10,
  textDecoration: "none",
  background: "#f8fafc",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  fontWeight: 900,
  fontSize: 13,
  textAlign: "center",
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 16,
  borderRadius: 14,
  fontWeight: 800,
};
