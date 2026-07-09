"use client";

import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { supabase } from "../../../lib/supabase";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  colorNivelInteres,
  esGerencia,
  etiquetaCanalPreferido,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  etiquetaResultadoSeguimiento,
  etiquetaTipoContacto,
  nombreCliente,
  type Cliente,
  type Profile,
  type SeguimientoCliente,
} from "../../../lib/crm";

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

const formatearFechaHora = (
  fecha: string | null | undefined
) => {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleString("es-PE");
};

type GrupoSeguimientos = {
  citasPorProgramar: Cliente[];
  vencidos: Cliente[];
  hoy: Cliente[];
  manana: Cliente[];
  proximos: Cliente[];
};

export default function SeguimientosPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );
  const [seguimientos, setSeguimientos] = useState<
    SeguimientoCliente[]
  >([]);
  const [error, setError] =
    useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    if (!supabase) return;

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
      });

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const { data: clientesData, error: clientesError } =
      await clientesQuery;

    if (clientesError) {
      setError(clientesError.message);
      setCargando(false);
      return;
    }

    const clientesActivos = (
      (clientesData || []) as unknown as Cliente[]
    ).filter(
    (cliente) =>
        cliente.estado_lead !== "VENDIDO" &&
        cliente.estado_lead !== "PERDIDO"
    );

    const clientesRelevantes = clientesActivos.filter(
    (cliente) =>
        Boolean(cliente.fecha_proximo_seguimiento) ||
        (cliente.canal_preferido === "CITA_OFICINA" &&
        cliente.estado_cita === "CITA_SOLICITADA")
    );

    setClientes(clientesRelevantes);

    const idsClientes = clientesRelevantes.map(
    (cliente) => cliente.id
    );

    if (idsClientes.length === 0) {
      setSeguimientos([]);
      setCargando(false);
      return;
    }

    const {
      data: seguimientosData,
      error: seguimientosError,
    } = await supabase
      .from("seguimientos_clientes")
      .select(
        "id,cliente_id,asesor_id,tipo_contacto,resultado,comentario,fecha_proximo_seguimiento,created_by,created_at"
      )
      .in("cliente_id", idsClientes)
      .order("created_at", {
        ascending: false,
      });

    if (seguimientosError) {
      setError(seguimientosError.message);
      setCargando(false);
      return;
    }

    setSeguimientos(
      (seguimientosData || []) as unknown as SeguimientoCliente[]
    );
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const seguimientosPorCliente = useMemo(() => {
    const mapa = new Map<string, SeguimientoCliente[]>();

    seguimientos.forEach((seguimiento) => {
      const lista =
        mapa.get(seguimiento.cliente_id) || [];

      lista.push(seguimiento);
      mapa.set(seguimiento.cliente_id, lista);
    });

    return mapa;
  }, [seguimientos]);

  const grupos = useMemo<GrupoSeguimientos>(() => {
    const hoy = obtenerFechaHoyISO();
    const manana = sumarDiasISO(1);

    const resultado: GrupoSeguimientos = {
        citasPorProgramar: [],
        vencidos: [],
        hoy: [],
        manana: [],
        proximos: [],
    };

    clientes.forEach((cliente) => {
        const citaPorProgramar =
        cliente.canal_preferido === "CITA_OFICINA" &&
        cliente.estado_cita === "CITA_SOLICITADA";

        if (citaPorProgramar) {
        resultado.citasPorProgramar.push(cliente);
        return;
        }

        const fecha =
        cliente.fecha_proximo_seguimiento || "";

        if (!fecha) return;

        if (fecha < hoy) {
        resultado.vencidos.push(cliente);
        return;
        }

        if (fecha === hoy) {
        resultado.hoy.push(cliente);
        return;
        }

        if (fecha === manana) {
        resultado.manana.push(cliente);
        return;
        }

        resultado.proximos.push(cliente);
    });

    const prioridad = (cliente: Cliente) => {
        if (cliente.nivel_interes === "CALIENTE") return 1;
        if (cliente.nivel_interes === "TIBIO") return 2;
        return 3;
    };

    const ordenar = (items: Cliente[]) =>
        items.sort((a, b) => {
        const prioridadA = prioridad(a);
        const prioridadB = prioridad(b);

        if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
        }

        const fechaA =
            a.fecha_proximo_seguimiento || "9999-12-31";
        const fechaB =
            b.fecha_proximo_seguimiento || "9999-12-31";

        return fechaA.localeCompare(fechaB);
        });

    resultado.citasPorProgramar = ordenar(
        resultado.citasPorProgramar
    );
    resultado.vencidos = ordenar(resultado.vencidos);
    resultado.hoy = ordenar(resultado.hoy);
    resultado.manana = ordenar(resultado.manana);
    resultado.proximos = ordenar(resultado.proximos);

    return resultado;
    }, [clientes]);

  const totalPendientes = clientes.length;

  const renderCliente = (cliente: Cliente) => {
    const color = colorNivelInteres(
      cliente.nivel_interes
    );

    const ultimoSeguimiento = (
      seguimientosPorCliente.get(cliente.id) || []
    )[0];

    const esVencido =
      (cliente.fecha_proximo_seguimiento || "") <
      obtenerFechaHoyISO();

    return (
      <article key={cliente.id} style={agendaCard}>
        <div style={cardTop}>
          <div>
            <strong style={clienteNombre}>
              {nombreCliente(cliente)}
            </strong>
            <div style={clienteDato}>
              WhatsApp: {cliente.celular || "-"}
            </div>
            <div style={clienteDato}>
              Fuente: {cliente.fuente || "-"}
            </div>
          </div>

          <span
            style={{
              ...leadBadge,
              background: color.bg,
              color: color.fg,
            }}
          >
            {etiquetaNivelInteres(cliente.nivel_interes)}
          </span>
        </div>

        <div style={infoGrid}>
          <div style={infoBox}>
            <span>Estado</span>
            <strong>
              {etiquetaEstadoLead(cliente.estado_lead)}
            </strong>
          </div>

          <div style={infoBox}>
            <span>Canal</span>
            <strong>
              {etiquetaCanalPreferido(
                cliente.canal_preferido
              )}
            </strong>
          </div>

          <div style={infoBox}>
            <span>Acción</span>
            <strong>
              {etiquetaProximaAccion(
                cliente.proxima_accion
              )}
            </strong>
          </div>

          <div style={infoBox}>
            <span>
              {esVencido
                ? "Vencido desde"
                : "Seguimiento"}
            </span>
            <strong
              style={{
                color: esVencido
                  ? "#8b2f25"
                  : "#244d77",
              }}
            >
              {formatearFechaLocal(
                cliente.fecha_proximo_seguimiento
              )}
            </strong>
          </div>
        </div>

        {cliente.canal_preferido === "CITA_OFICINA" && (
          <div style={citaBox}>
            Cita:{" "}
            {cliente.fecha_cita
              ? formatearFechaLocal(cliente.fecha_cita)
              : "por pactar"}
            {cliente.hora_cita
              ? ` - ${cliente.hora_cita}`
              : ""}
          </div>
        )}

        {ultimoSeguimiento ? (
          <div style={ultimoBox}>
            <strong>
              Último seguimiento:{" "}
              {etiquetaTipoContacto(
                ultimoSeguimiento.tipo_contacto
              )}{" "}
              ·{" "}
              {etiquetaResultadoSeguimiento(
                ultimoSeguimiento.resultado
              )}
            </strong>

            {ultimoSeguimiento.comentario && (
              <div style={ultimoTexto}>
                {ultimoSeguimiento.comentario}
              </div>
            )}

            <div style={ultimoFecha}>
              {formatearFechaHora(
                ultimoSeguimiento.created_at
              )}
            </div>
          </div>
        ) : (
          <div style={sinSeguimiento}>
            Sin seguimiento registrado todavía.
          </div>
        )}

        <div style={accionesCard}>
          <a
            href={`/asesores/clientes?seguimiento=${cliente.id}`}
            style={abrirCliente}
          >
            Registrar seguimiento
          </a>

          <a
            href={`/asesores/clientes/${cliente.id}`}
            style={verCliente}
          >
            Ver cliente
          </a>
        </div>
      </article>
    );
  };

  const renderGrupo = (
    titulo: string,
    descripcion: string,
    items: Cliente[],
    tono: "red" | "gold" | "green" | "blue"
  ) => {
    const colores = {
      red: {
        bg: "#fff1ef",
        fg: "#8b2f25",
        border: "#f3c7c0",
      },
      gold: {
        bg: "#fff8e1",
        fg: "#8a5a00",
        border: "#eed28a",
      },
      green: {
        bg: "#eef8f1",
        fg: "#17633a",
        border: "#c9e7d2",
      },
      blue: {
        bg: "#eef6ff",
        fg: "#244d77",
        border: "#c7ddf4",
      },
    }[tono];

    return (
      <section style={grupoBox}>
        <div
          style={{
            ...grupoHeader,
            background: colores.bg,
            color: colores.fg,
            borderColor: colores.border,
          }}
        >
          <div>
            <h2 style={grupoTitle}>{titulo}</h2>
            <p style={grupoSubtitle}>{descripcion}</p>
          </div>

          <span style={grupoCount}>
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div style={emptyBox}>
            No hay clientes en este grupo.
          </div>
        ) : (
          <div style={agendaGrid}>
            {items.map(renderCliente)}
          </div>
        )}
      </section>
    );
  };

  return (
    <AsesorLayout
      title="Seguimientos"
      subtitle={
        modoGerencia
          ? "Agenda comercial del equipo de ventas."
          : "Tu agenda comercial de clientes por contactar."
      }
    >
      <section>
        <div style={pageHeader}>
          <div>
            <h1 style={title}>
              Agenda de seguimientos
            </h1>
            <p style={subtitle}>
              Organiza los contactos vencidos, de hoy,
              de mañana y próximos para no perder leads.
            </p>
          </div>

          <div style={totalBox}>
            <span>Pendientes</span>
            <strong>{totalPendientes}</strong>
          </div>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>
            Cargando seguimientos...
          </div>
        ) : (
          <>
            {renderGrupo(
                "Citas por programar",
                "Clientes que solicitaron cita en oficina, pero aún no tienen fecha y hora pactada.",
                grupos.citasPorProgramar,
                "gold"
                )}
            
            {renderGrupo(
              "Vencidos",
              "Clientes que debieron ser contactados antes de hoy.",
              grupos.vencidos,
              "red"
            )}

            {renderGrupo(
              "Hoy",
              "Contactos que deben hacerse hoy.",
              grupos.hoy,
              "gold"
            )}

            {renderGrupo(
              "Mañana",
              "Clientes programados para mañana.",
              grupos.manana,
              "green"
            )}

            {renderGrupo(
              "Próximos",
              "Seguimientos programados después de mañana.",
              grupos.proximos,
              "blue"
            )}
          </>
        )}
      </section>
    </AsesorLayout>
  );
}

const pageHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 22,
};

const title: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: 15,
};

const totalBox: React.CSSProperties = {
  minWidth: 120,
  borderRadius: 18,
  background: "#fff3d6",
  color: "#8a5a00",
  padding: 14,
  display: "grid",
  gap: 4,
  textAlign: "center",
  fontWeight: 900,
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

const grupoBox: React.CSSProperties = {
  marginBottom: 22,
};

const grupoHeader: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: "14px 16px",
  marginBottom: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const grupoTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
};

const grupoSubtitle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 14,
  opacity: 0.85,
};

const grupoCount: React.CSSProperties = {
  minWidth: 42,
  height: 42,
  borderRadius: 999,
  background: "rgba(255,255,255,.75)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: 950,
};

const agendaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(280px,1fr))",
  gap: 14,
};

const agendaCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
  display: "grid",
  gap: 12,
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const clienteNombre: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 950,
};

const clienteDato: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 13,
};

const leadBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 8,
};

const infoBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
};

const citaBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#fff8e1",
  color: "#7a4b12",
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 900,
};

const ultimoBox: React.CSSProperties = {
  borderLeft: "3px solid #dbeafe",
  background: "#f8fafc",
  borderRadius: 10,
  padding: "9px 10px",
  color: "#334155",
  fontSize: 12,
};

const ultimoTexto: React.CSSProperties = {
  marginTop: 5,
  color: "#475569",
  lineHeight: 1.35,
};

const ultimoFecha: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 11,
};

const sinSeguimiento: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  color: "#64748b",
  padding: "10px",
  fontSize: 13,
  fontWeight: 800,
};

const abrirCliente: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  height: 36,
  borderRadius: 10,
  textDecoration: "none",
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 13,
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 16,
  borderRadius: 14,
  fontWeight: 800,
};

const accionesCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const verCliente: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  height: 36,
  borderRadius: 10,
  textDecoration: "none",
  background: "#f8fafc",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  fontWeight: 900,
  fontSize: 13,
};
