"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { supabase } from "../../../lib/supabase";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  colorNivelInteres,
  esGerencia,
  etiquetaCanalPreferido,
  etiquetaEstadoCita,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  nombreCliente,
  type Cliente,
  type Profile,
} from "../../../lib/crm";

type TipoAlerta =
  | "CRITICA"
  | "HOY"
  | "CITA";

type Alerta = {
  id: string;
  tipo: TipoAlerta;
  titulo: string;
  descripcion: string;
  cliente: Cliente;
  prioridad: number;
};

const obtenerFechaHoyISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

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

export default function AlertasPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );

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
        perfil.error ||
          "No se pudo cargar tu perfil."
      );
      setCargando(false);
      return;
    }

    const modoGerencia = esGerencia(perfil.profile);

    let query = supabase
      .from("clientes")
      .select(
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
          "created_at",
          "updated_at",
          "situacion_inicial",
          "capacidad_cuota",
          "tiempo_decision",
          "intencion_compra",
          "canal_preferido",
          "puntaje_lead",
          "nivel_interes",
          "estado_lead",
          "proxima_accion",
          "fecha_proximo_seguimiento",
          "objecion_principal",
          "estado_cita",
          "fecha_cita",
          "hora_cita",
        ].join(",")
      )
      .order("created_at", {
        ascending: false,
      });

    if (!modoGerencia) {
      query = query.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const { data, error: clientesError } =
      await query;

    if (clientesError) {
      setError(clientesError.message);
      setCargando(false);
      return;
    }

    const activos = (
      (data || []) as unknown as Cliente[]
    ).filter(
      (cliente) =>
        cliente.estado_lead !== "VENDIDO" &&
        cliente.estado_lead !== "PERDIDO"
    );

    setClientes(activos);
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const alertas = useMemo(() => {
    const hoy = obtenerFechaHoyISO();
    const lista: Alerta[] = [];

    clientes.forEach((cliente) => {
      const fechaSeguimiento =
        cliente.fecha_proximo_seguimiento || "";

      const esCaliente =
        cliente.nivel_interes === "CALIENTE";

      const seguimientoVencido =
        fechaSeguimiento !== "" &&
        fechaSeguimiento < hoy;

      const seguimientoHoy =
        fechaSeguimiento !== "" &&
        fechaSeguimiento === hoy;

      const citaSolicitada =
        cliente.canal_preferido === "CITA_OFICINA" &&
        cliente.estado_cita === "CITA_SOLICITADA";

      if (esCaliente && seguimientoVencido) {
        lista.push({
          id: `critica-${cliente.id}`,
          tipo: "CRITICA",
          titulo: "Lead caliente vencido",
          descripcion:
            "Este cliente es caliente y su seguimiento ya venció. Debe atenderse primero para que no se enfríe.",
          cliente,
          prioridad: 1,
        });
      }

      if (seguimientoHoy) {
        lista.push({
          id: `hoy-${cliente.id}`,
          tipo: "HOY",
          titulo: "Seguimiento para hoy",
          descripcion:
            "Este cliente debe ser contactado durante el día.",
          cliente,
          prioridad: esCaliente ? 2 : 3,
        });
      }

      if (citaSolicitada) {
        lista.push({
          id: `cita-${cliente.id}`,
          tipo: "CITA",
          titulo: "Cita solicitada sin programar",
          descripcion:
            "El cliente pidió cita en oficina. Falta pactar fecha y hora.",
          cliente,
          prioridad: esCaliente ? 2 : 4,
        });
      }
    });

    return lista.sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }

      const fechaA =
        a.cliente.fecha_proximo_seguimiento ||
        "9999-12-31";

      const fechaB =
        b.cliente.fecha_proximo_seguimiento ||
        "9999-12-31";

      return fechaA.localeCompare(fechaB);
    });
  }, [clientes]);

  const criticas = alertas.filter(
    (alerta) => alerta.tipo === "CRITICA"
  );

  const paraHoy = alertas.filter(
    (alerta) => alerta.tipo === "HOY"
  );

  const citas = alertas.filter(
    (alerta) => alerta.tipo === "CITA"
  );

  const modoGerencia = esGerencia(profile);

  const renderAlerta = (alerta: Alerta) => {
    const cliente = alerta.cliente;

    const color = colorNivelInteres(
      cliente.nivel_interes
    );

    const cardStyle =
      alerta.tipo === "CRITICA"
        ? alertaCardRoja
        : alerta.tipo === "CITA"
          ? alertaCardDorada
          : alertaCardAzul;

    return (
      <article key={alerta.id} style={cardStyle}>
        <div style={alertaTop}>
          <div>
            <div style={alertaTipo}>
              {alerta.titulo}
            </div>

            <h3 style={clienteNombre}>
              {nombreCliente(cliente)}
            </h3>
          </div>

          <span
            style={{
              ...leadBadge,
              background: color.bg,
              color: color.fg,
            }}
          >
            {etiquetaNivelInteres(
              cliente.nivel_interes
            )}
          </span>
        </div>

        <p style={alertaDescripcion}>
          {alerta.descripcion}
        </p>

        <div style={infoGrid}>
          <div style={infoBox}>
            <span>WhatsApp</span>
            <strong>{cliente.celular || "-"}</strong>
          </div>

          <div style={infoBox}>
            <span>Estado</span>
            <strong>
              {etiquetaEstadoLead(
                cliente.estado_lead
              )}
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
        </div>

        {cliente.fecha_proximo_seguimiento && (
          <div style={fechaBox}>
            Seguimiento:{" "}
            <strong>
              {formatearFechaLocal(
                cliente.fecha_proximo_seguimiento
              )}
            </strong>
          </div>
        )}

        {cliente.canal_preferido ===
          "CITA_OFICINA" && (
          <div style={citaBox}>
            Estado cita:{" "}
            <strong>
              {etiquetaEstadoCita(
                cliente.estado_cita
              )}
            </strong>
            {" · "}
            {cliente.fecha_cita
              ? formatearFechaLocal(
                  cliente.fecha_cita
                )
              : "fecha por pactar"}
            {cliente.hora_cita
              ? ` - ${cliente.hora_cita}`
              : ""}
          </div>
        )}

        <Link
          href="/asesores/clientes"
          style={accionButton}
        >
          Ir a clientes
        </Link>
      </article>
    );
  };

  const renderGrupo = (
    titulo: string,
    descripcion: string,
    items: Alerta[],
    tono: "red" | "gold" | "blue"
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
            <p style={grupoSubtitle}>
              {descripcion}
            </p>
          </div>

          <span style={grupoCount}>
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div style={emptyBox}>
            No hay alertas en este grupo.
          </div>
        ) : (
          <div style={alertasGrid}>
            {items.map(renderAlerta)}
          </div>
        )}
      </section>
    );
  };

  return (
    <AsesorLayout
      title="Alertas"
      subtitle={
        modoGerencia
          ? "Alertas comerciales del equipo."
          : "Alertas comerciales de tus clientes."
      }
    >
      <section>
        <div style={pageHeader}>
          <div>
            <h1 style={title}>
              Alertas comerciales
            </h1>

            <p style={subtitle}>
              Prioriza leads calientes, seguimientos
              vencidos y citas pendientes de programación.
            </p>
          </div>

          <div style={totalBox}>
            <span>Alertas</span>
            <strong>{alertas.length}</strong>
          </div>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>
            Cargando alertas...
          </div>
        ) : (
          <>
            {renderGrupo(
              "Críticas",
              "Leads calientes vencidos o con atención atrasada.",
              criticas,
              "red"
            )}

            {renderGrupo(
              "Para hoy",
              "Seguimientos que deben realizarse durante el día.",
              paraHoy,
              "blue"
            )}

            {renderGrupo(
              "Citas por programar",
              "Clientes que solicitaron cita en oficina, pero aún no tienen fecha y hora.",
              citas,
              "gold"
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

const alertasGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(280px,1fr))",
  gap: 14,
};

const alertaCardRoja: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #f3c7c0",
  borderLeft: "5px solid #dc2626",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(220,38,38,.08)",
  display: "grid",
  gap: 12,
};

const alertaCardDorada: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #eed28a",
  borderLeft: "5px solid #d97706",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(217,119,6,.08)",
  display: "grid",
  gap: 12,
};

const alertaCardAzul: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #c7ddf4",
  borderLeft: "5px solid #2563eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(37,99,235,.08)",
  display: "grid",
  gap: 12,
};

const alertaTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const alertaTipo: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const clienteNombre: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 950,
};

const alertaDescripcion: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.45,
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

const fechaBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#eef6ff",
  color: "#244d77",
  padding: "8px 10px",
  fontSize: 13,
};

const citaBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#fff8e1",
  color: "#7a4b12",
  padding: "8px 10px",
  fontSize: 13,
};

const accionButton: React.CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  height: 38,
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
