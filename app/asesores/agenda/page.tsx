"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  colorNivelInteres,
  esGerencia,
  etiquetaEstadoCita,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  nombreCliente,
  type Cliente,
  type Profile,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type TipoEvento = "SEGUIMIENTO" | "CITA";
type PeriodoAgenda =
  | "TODOS"
  | "ATRASADOS"
  | "HOY"
  | "SEMANA"
  | "FUTUROS"
  | "SIN_FECHA";

type EventoAgenda = {
  id: string;
  tipo: TipoEvento;
  cliente: Cliente;
  fecha: string | null;
  hora: string | null;
  titulo: string;
  detalle: string;
  prioridad: number;
  periodo: Exclude<PeriodoAgenda, "TODOS">;
};

type AsesorOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

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

const limpiarFecha = (fecha: string | null | undefined) =>
  fecha ? fecha.split("T")[0] : "";

const calcularPeriodo = (
  fecha: string | null | undefined
): Exclude<PeriodoAgenda, "TODOS"> => {
  const hoy = obtenerFechaHoyISO();
  const limiteSemana = sumarDiasISO(7);
  const limpia = limpiarFecha(fecha);

  if (!limpia) return "SIN_FECHA";
  if (limpia < hoy) return "ATRASADOS";
  if (limpia === hoy) return "HOY";
  if (limpia <= limiteSemana) return "SEMANA";

  return "FUTUROS";
};

const formatearFechaLocal = (
  fecha: string | null | undefined
) => {
  const limpia = limpiarFecha(fecha);

  if (!limpia) return "Sin fecha";

  const [year, month, day] = limpia.split("-").map(Number);

  if (!year || !month || !day) return "Sin fecha";

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const normalizarWhatsApp = (
  celular: string | null | undefined
) => {
  const limpio = (celular || "").replace(/\D/g, "");

  if (!limpio) return "";
  if (limpio.startsWith("51")) return limpio;
  if (limpio.length === 9) return `51${limpio}`;

  return limpio;
};

const crearWhatsappUrl = (cliente: Cliente) => {
  const numero = normalizarWhatsApp(cliente.celular);

  if (!numero) return "";

  const mensaje = `Hola ${cliente.nombres}, soy tu asesor de Las Lomas de Malabrigo. Te escribo para hacer seguimiento y ayudarte con la informacion que necesitas.`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(
    mensaje
  )}`;
};

const clienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

const nombreAsesor = (
  asesorId: string | null | undefined,
  asesores: Map<string, AsesorOption>
) => {
  if (!asesorId) return "Sin asesor";

  const asesor = asesores.get(asesorId);

  return asesor?.full_name || asesor?.email || "Asignado";
};

export default function AgendaPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [asesores, setAsesores] = useState<AsesorOption[]>(
    []
  );
  const [periodo, setPeriodo] =
    useState<PeriodoAgenda>("HOY");
  const [asesorFiltro, setAsesorFiltro] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
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
      )
      .order("fecha_proximo_seguimiento", {
        ascending: true,
        nullsFirst: false,
      });

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const consultas = [
      clientesQuery,
      modoGerencia
        ? supabase
            .from("profiles")
            .select("id,full_name,email")
            .eq("active", true)
            .order("full_name", {
              ascending: true,
              nullsFirst: false,
            })
        : Promise.resolve({ data: [], error: null }),
    ] as const;

    const [clientesResult, asesoresResult] =
      await Promise.all(consultas);

    const errorActual =
      clientesResult.error || asesoresResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setClientes(
      ((clientesResult.data || []) as unknown as Cliente[]).filter(
        clienteActivo
      )
    );
    setAsesores(
      (asesoresResult.data || []) as unknown as AsesorOption[]
    );
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const asesoresPorId = useMemo(() => {
    const mapa = new Map<string, AsesorOption>();

    asesores.forEach((asesor) => {
      mapa.set(asesor.id, asesor);
    });

    return mapa;
  }, [asesores]);

  const eventos = useMemo<EventoAgenda[]>(() => {
    const lista: EventoAgenda[] = [];

    clientes.forEach((cliente) => {
      if (cliente.fecha_proximo_seguimiento) {
        const fecha = limpiarFecha(
          cliente.fecha_proximo_seguimiento
        );

        lista.push({
          id: `seguimiento-${cliente.id}`,
          tipo: "SEGUIMIENTO",
          cliente,
          fecha,
          hora: null,
          titulo: "Seguimiento comercial",
          detalle: etiquetaProximaAccion(
            cliente.proxima_accion
          ),
          prioridad:
            calcularPeriodo(fecha) === "ATRASADOS"
              ? 1
              : cliente.nivel_interes === "CALIENTE"
                ? 2
                : 3,
          periodo: calcularPeriodo(fecha),
        });
      }

      const tieneCita =
        cliente.estado_cita === "CITA_SOLICITADA" ||
        cliente.estado_cita === "CITA_PROGRAMADA" ||
        Boolean(cliente.fecha_cita);

      if (tieneCita) {
        const fecha = limpiarFecha(cliente.fecha_cita);

        lista.push({
          id: `cita-${cliente.id}`,
          tipo: "CITA",
          cliente,
          fecha: fecha || null,
          hora: cliente.hora_cita || null,
          titulo:
            cliente.estado_cita === "CITA_PROGRAMADA"
              ? "Cita programada"
              : "Cita por programar",
          detalle: etiquetaEstadoCita(cliente.estado_cita),
          prioridad:
            calcularPeriodo(fecha) === "ATRASADOS"
              ? 1
              : fecha
                ? 2
                : 1,
          periodo: calcularPeriodo(fecha),
        });
      }
    });

    return lista.sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }

      const fechaA = a.fecha || "0000-00-00";
      const fechaB = b.fecha || "0000-00-00";
      const fechaOrden = fechaA.localeCompare(fechaB);

      if (fechaOrden !== 0) return fechaOrden;

      return (a.hora || "").localeCompare(b.hora || "");
    });
  }, [clientes]);

  const eventosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return eventos.filter((evento) => {
      if (periodo !== "TODOS" && evento.periodo !== periodo) {
        return false;
      }

      if (
        modoGerencia &&
        asesorFiltro !== "TODOS" &&
        evento.cliente.asesor_id !== asesorFiltro
      ) {
        return false;
      }

      if (!texto) return true;

      return [
        nombreCliente(evento.cliente),
        evento.cliente.dni,
        evento.cliente.celular,
        evento.cliente.correo,
        evento.cliente.fuente,
        evento.titulo,
        evento.detalle,
        nombreAsesor(evento.cliente.asesor_id, asesoresPorId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [
    asesorFiltro,
    asesoresPorId,
    busqueda,
    eventos,
    modoGerencia,
    periodo,
  ]);

  const resumen = useMemo(
    () => ({
      atrasados: eventos.filter(
        (evento) => evento.periodo === "ATRASADOS"
      ).length,
      hoy: eventos.filter((evento) => evento.periodo === "HOY")
        .length,
      semana: eventos.filter(
        (evento) => evento.periodo === "SEMANA"
      ).length,
      sinFecha: eventos.filter(
        (evento) => evento.periodo === "SIN_FECHA"
      ).length,
    }),
    [eventos]
  );

  const filtros: {
    id: PeriodoAgenda;
    label: string;
  }[] = [
    {
      id: "TODOS",
      label: "Todas",
    },
    {
      id: "ATRASADOS",
      label: "Atrasados",
    },
    {
      id: "HOY",
      label: "Hoy",
    },
    {
      id: "SEMANA",
      label: "7 dias",
    },
    {
      id: "FUTUROS",
      label: "Futuros",
    },
    {
      id: "SIN_FECHA",
      label: "Sin fecha",
    },
  ];

  const renderEvento = (evento: EventoAgenda) => {
    const color = colorNivelInteres(
      evento.cliente.nivel_interes
    );
    const whatsappUrl = crearWhatsappUrl(evento.cliente);
    const cardStyle = {
      ...eventoCard,
      ...(evento.periodo === "ATRASADOS"
        ? eventoCardRed
        : evento.periodo === "HOY"
          ? eventoCardBlue
          : evento.periodo === "SIN_FECHA"
            ? eventoCardGold
            : eventoCardGreen),
    };

    return (
      <article key={evento.id} style={cardStyle}>
        <div style={eventTop}>
          <div>
            <div style={eventType}>
              {evento.tipo === "CITA" ? "Cita" : "Seguimiento"}
            </div>
            <h2 style={eventTitle}>{evento.titulo}</h2>
          </div>

          <span
            style={{
              ...leadBadge,
              background: color.bg,
              color: color.fg,
            }}
          >
            {etiquetaNivelInteres(
              evento.cliente.nivel_interes
            )}
          </span>
        </div>

        <div style={dateBox}>
          <strong>{formatearFechaLocal(evento.fecha)}</strong>
          <span>{evento.hora || evento.detalle}</span>
        </div>

        <div>
          <h3 style={clientName}>
            {nombreCliente(evento.cliente)}
          </h3>
          <p style={clientMeta}>
            {evento.cliente.celular || "Sin celular"} -{" "}
            {etiquetaEstadoLead(evento.cliente.estado_lead)}
          </p>
        </div>

        <div style={infoGrid}>
          <div style={infoBox}>
            <span>Accion</span>
            <strong>
              {etiquetaProximaAccion(
                evento.cliente.proxima_accion
              )}
            </strong>
          </div>

          <div style={infoBox}>
            <span>Asesor</span>
            <strong>
              {modoGerencia
                ? nombreAsesor(
                    evento.cliente.asesor_id,
                    asesoresPorId
                  )
                : "Tu cartera"}
            </strong>
          </div>
        </div>

        <div style={actions}>
          <Link
            href={`/asesores/clientes/${evento.cliente.id}`}
            style={primaryButton}
          >
            Ver ficha
          </Link>

          <a
            href={whatsappUrl || undefined}
            target="_blank"
            rel="noreferrer"
            style={{
              ...secondaryButton,
              opacity: whatsappUrl ? 1 : 0.5,
              pointerEvents: whatsappUrl ? "auto" : "none",
            }}
          >
            WhatsApp
          </a>
        </div>
      </article>
    );
  };

  return (
    <AsesorLayout
      title="Agenda"
      subtitle={
        modoGerencia
          ? "Agenda comercial del equipo: seguimientos, citas y atrasos."
          : "Tu agenda diaria para no dejar enfriar ningun cliente."
      }
    >
      <section>
        <div style={summaryGrid}>
          <button
            type="button"
            onClick={() => setPeriodo("ATRASADOS")}
            style={summaryCardRed}
          >
            <span>Atrasados</span>
            <strong>{resumen.atrasados}</strong>
          </button>

          <button
            type="button"
            onClick={() => setPeriodo("HOY")}
            style={summaryCardBlue}
          >
            <span>Hoy</span>
            <strong>{resumen.hoy}</strong>
          </button>

          <button
            type="button"
            onClick={() => setPeriodo("SEMANA")}
            style={summaryCardGreen}
          >
            <span>Proximos 7 dias</span>
            <strong>{resumen.semana}</strong>
          </button>

          <button
            type="button"
            onClick={() => setPeriodo("SIN_FECHA")}
            style={summaryCardGold}
          >
            <span>Sin fecha</span>
            <strong>{resumen.sinFecha}</strong>
          </button>
        </div>

        <div style={toolbar}>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar cliente, DNI, celular o asesor"
            style={search}
          />

          {modoGerencia && (
            <select
              value={asesorFiltro}
              onChange={(event) =>
                setAsesorFiltro(event.target.value)
              }
              style={select}
            >
              <option value="TODOS">Todos los asesores</option>
              {asesores.map((asesor) => (
                <option key={asesor.id} value={asesor.id}>
                  {asesor.full_name || asesor.email || "Asesor"}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => void cargar()}
            style={refreshButton}
          >
            Actualizar
          </button>
        </div>

        <div style={filterGroup}>
          {filtros.map((item) => {
            const active = periodo === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodo(item.id)}
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

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>Cargando agenda...</div>
        ) : eventosFiltrados.length === 0 ? (
          <div style={emptyBox}>
            No hay actividades en este filtro. Revisa el embudo
            para programar la siguiente accion comercial.
          </div>
        ) : (
          <div style={agendaGrid}>
            {eventosFiltrados.map(renderEvento)}
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

const summaryButtonBase: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const summaryCardRed: React.CSSProperties = {
  ...summaryButtonBase,
  background: "#fff1ef",
  color: "#8b2f25",
  border: "1px solid #f3c7c0",
};

const summaryCardBlue: React.CSSProperties = {
  ...summaryButtonBase,
  background: "#eef6ff",
  color: "#244d77",
  border: "1px solid #c7ddf4",
};

const summaryCardGreen: React.CSSProperties = {
  ...summaryButtonBase,
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
};

const summaryCardGold: React.CSSProperties = {
  ...summaryButtonBase,
  background: "#fff8e1",
  color: "#8a5a00",
  border: "1px solid #eed28a",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 12,
};

const search: React.CSSProperties = {
  width: "min(100%, 390px)",
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

const filterGroup: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 18,
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

const agendaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 14,
};

const eventoCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const eventoCardRed: React.CSSProperties = {
  borderColor: "#f3c7c0",
  borderLeft: "5px solid #dc2626",
};

const eventoCardBlue: React.CSSProperties = {
  borderColor: "#c7ddf4",
  borderLeft: "5px solid #2563eb",
};

const eventoCardGreen: React.CSSProperties = {
  borderColor: "#c9e7d2",
  borderLeft: "5px solid #2f7d46",
};

const eventoCardGold: React.CSSProperties = {
  borderColor: "#eed28a",
  borderLeft: "5px solid #d97706",
};

const eventTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const eventType: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const eventTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 19,
  fontWeight: 950,
};

const leadBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const dateBox: React.CSSProperties = {
  borderRadius: 14,
  background: "#f8fafc",
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#334155",
  fontSize: 14,
};

const clientName: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 950,
};

const clientMeta: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
};

const infoBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
  color: "#334155",
  fontSize: 13,
};

const actions: React.CSSProperties = {
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
