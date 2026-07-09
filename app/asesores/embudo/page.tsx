"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  colorNivelInteres,
  esGerencia,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type EstadoLead,
  type LoteCrm,
  type Profile,
  type ProximaAccion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type ColumnaEmbudo = {
  id: EstadoLead;
  titulo: string;
  descripcion: string;
  color: string;
  bg: string;
};

const columnas: ColumnaEmbudo[] = [
  {
    id: "NUEVO",
    titulo: "Nuevo",
    descripcion: "Lead ingresado, falta primer contacto.",
    color: "#334155",
    bg: "#f8fafc",
  },
  {
    id: "CONTACTADO",
    titulo: "Contactado",
    descripcion: "Ya hubo primer contacto.",
    color: "#244d77",
    bg: "#eef6ff",
  },
  {
    id: "CALIFICADO",
    titulo: "Calificado",
    descripcion: "Cliente con datos e interes real.",
    color: "#17633a",
    bg: "#eef8f1",
  },
  {
    id: "SEGUIMIENTO",
    titulo: "Seguimiento",
    descripcion: "Requiere proximo contacto.",
    color: "#8a5a00",
    bg: "#fff8e1",
  },
  {
    id: "NEGOCIANDO",
    titulo: "Negociando",
    descripcion: "Evalua lote, precio o forma de pago.",
    color: "#7a4b12",
    bg: "#f7e8d0",
  },
  {
    id: "SEPARADO",
    titulo: "Separado",
    descripcion: "Lote separado, falta completar cierre.",
    color: "#0f766e",
    bg: "#ecfdf5",
  },
  {
    id: "VENDIDO",
    titulo: "Vendido",
    descripcion: "Venta cerrada.",
    color: "#17633a",
    bg: "#e6f4ea",
  },
  {
    id: "NO_RESPONDE",
    titulo: "No responde",
    descripcion: "Cliente sin respuesta.",
    color: "#475569",
    bg: "#f1f5f9",
  },
  {
    id: "PERDIDO",
    titulo: "Perdido",
    descripcion: "Descartado o sin interes.",
    color: "#8b2f25",
    bg: "#fff1ef",
  },
];

const accionesPorEstado: Record<EstadoLead, ProximaAccion> = {
  NUEVO: "CONTACTAR",
  CONTACTADO: "VOLVER_A_CONTACTAR",
  CALIFICADO: "ENVIAR_FICHA",
  SEGUIMIENTO: "VOLVER_A_CONTACTAR",
  NEGOCIANDO: "ESPERAR_PAGO",
  SEPARADO: "ESPERAR_PAGO",
  VENDIDO: "DESCARTAR",
  PERDIDO: "DESCARTAR",
  NO_RESPONDE: "VOLVER_A_CONTACTAR",
};

const siguienteEstado: Partial<Record<EstadoLead, EstadoLead>> = {
  NUEVO: "CONTACTADO",
  CONTACTADO: "CALIFICADO",
  CALIFICADO: "NEGOCIANDO",
  SEGUIMIENTO: "NEGOCIANDO",
  NEGOCIANDO: "SEPARADO",
  NO_RESPONDE: "SEGUIMIENTO",
};

const limpiarCelularWhatsApp = (
  celular: string | null | undefined
) => {
  const limpio = (celular || "").replace(/\D/g, "");

  if (!limpio) return "";
  if (limpio.startsWith("51")) return limpio;
  if (limpio.length === 9) return `51${limpio}`;

  return limpio;
};

const crearWhatsappUrl = (
  cliente: Cliente,
  lote?: LoteCrm
) => {
  const numero = limpiarCelularWhatsApp(cliente.celular);

  if (!numero) return "";

  const loteTexto = lote
    ? ` Me comunico por el lote MZ ${lote.mz} - LOTE ${lote.lote}, area ${formatearArea(
        lote.area
      )}, precio ${formatearMoneda(lote.precio)}.`
    : "";

  const mensaje = `Hola ${cliente.nombres}, soy tu asesor de Las Lomas de Malabrigo.${loteTexto} Te escribo para dar seguimiento y ayudarte con disponibilidad, ubicacion y condiciones de separacion.`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(
    mensaje
  )}`;
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

export default function EmbudoPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("TODOS");
  const [actualizando, setActualizando] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [mensaje, setMensaje] =
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
      .order("updated_at", {
        ascending: false,
        nullsFirst: false,
      });

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const [clientesResult, lotesResult] = await Promise.all([
      clientesQuery,
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        ),
    ]);

    const errorActual =
      clientesResult.error || lotesResult.error;

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
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const lotesPorId = useMemo(() => {
    const mapa = new Map<number, LoteCrm>();

    lotes.forEach((lote) => {
      mapa.set(lote.id, lote);
    });

    return mapa;
  }, [lotes]);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return clientes.filter((cliente) => {
      if (
        filtroNivel !== "TODOS" &&
        cliente.nivel_interes !== filtroNivel
      ) {
        return false;
      }

      if (!texto) return true;

      const lote = cliente.lote_interes_id
        ? lotesPorId.get(cliente.lote_interes_id)
        : null;

      return [
        nombreCliente(cliente),
        cliente.dni,
        cliente.celular,
        cliente.correo,
        cliente.fuente,
        cliente.nivel_interes,
        cliente.estado_lead,
        lote ? `mz ${lote.mz} lote ${lote.lote}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, clientes, filtroNivel, lotesPorId]);

  const clientesPorColumna = useMemo(() => {
    const mapa = new Map<EstadoLead, Cliente[]>();

    columnas.forEach((columna) => {
      mapa.set(columna.id, []);
    });

    clientesFiltrados.forEach((cliente) => {
      const estado = (cliente.estado_lead ||
        "NUEVO") as EstadoLead;
      const lista = mapa.get(estado) || mapa.get("NUEVO");

      lista?.push(cliente);
    });

    mapa.forEach((lista) => {
      lista.sort((a, b) => {
        const prioridadA = a.nivel_interes === "CALIENTE" ? 0 : 1;
        const prioridadB = b.nivel_interes === "CALIENTE" ? 0 : 1;

        if (prioridadA !== prioridadB) {
          return prioridadA - prioridadB;
        }

        return (b.updated_at || "").localeCompare(
          a.updated_at || ""
        );
      });
    });

    return mapa;
  }, [clientesFiltrados]);

  const resumen = useMemo(
    () => ({
      total: clientesFiltrados.length,
      calientes: clientesFiltrados.filter(
        (cliente) => cliente.nivel_interes === "CALIENTE"
      ).length,
      negociando: clientesFiltrados.filter(
        (cliente) => cliente.estado_lead === "NEGOCIANDO"
      ).length,
      separados: clientesFiltrados.filter(
        (cliente) => cliente.estado_lead === "SEPARADO"
      ).length,
      sinSeguimiento: clientesFiltrados.filter(
        (cliente) =>
          !cliente.fecha_proximo_seguimiento &&
          cliente.estado_lead !== "VENDIDO" &&
          cliente.estado_lead !== "PERDIDO"
      ).length,
    }),
    [clientesFiltrados]
  );

  const moverCliente = async (
    cliente: Cliente,
    nuevoEstado: EstadoLead
  ) => {
    if (!supabase) return;

    setActualizando(cliente.id);
    setError(null);
    setMensaje(null);

    const nuevaAccion = accionesPorEstado[nuevoEstado];

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        estado_lead: nuevoEstado,
        proxima_accion: nuevaAccion,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
      setActualizando(null);
      return;
    }

    setClientes((actuales) =>
      actuales.map((item) =>
        item.id === cliente.id
          ? {
              ...item,
              estado_lead: nuevoEstado,
              proxima_accion: nuevaAccion,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    setMensaje(
      `${nombreCliente(cliente)} movido a ${etiquetaEstadoLead(
        nuevoEstado
      )}.`
    );
    setActualizando(null);
  };

  const renderCliente = (cliente: Cliente) => {
    const color = colorNivelInteres(cliente.nivel_interes);
    const lote = cliente.lote_interes_id
      ? lotesPorId.get(cliente.lote_interes_id)
      : undefined;
    const estadoActual = (cliente.estado_lead ||
      "NUEVO") as EstadoLead;
    const siguiente = siguienteEstado[estadoActual];
    const whatsAppUrl = crearWhatsappUrl(cliente, lote);

    return (
      <article key={cliente.id} style={card}>
        <div style={cardTop}>
          <div>
            <h3 style={clienteNombre}>
              {nombreCliente(cliente)}
            </h3>
            <div style={clienteMeta}>
              WhatsApp: {cliente.celular || "-"}
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

        <div style={miniGrid}>
          <div style={miniBox}>
            <span>Puntaje</span>
            <strong>{cliente.puntaje_lead ?? 0}/100</strong>
          </div>

          <div style={miniBox}>
            <span>Accion</span>
            <strong>
              {etiquetaProximaAccion(
                cliente.proxima_accion
              )}
            </strong>
          </div>
        </div>

        {lote && (
          <div style={loteBox}>
            <strong>
              MZ {lote.mz} - LOTE {lote.lote}
            </strong>
            <span>
              {formatearArea(lote.area)} -{" "}
              {formatearMoneda(lote.precio)}
            </span>
          </div>
        )}

        <div style={fechaBox}>
          Proximo seguimiento:{" "}
          <strong>
            {formatearFechaLocal(
              cliente.fecha_proximo_seguimiento
            )}
          </strong>
        </div>

        <div style={acciones}>
          <Link
            href={`/asesores/clientes/${cliente.id}`}
            style={secondaryButton}
          >
            Ver ficha
          </Link>

          <a
            href={whatsAppUrl || undefined}
            target="_blank"
            rel="noreferrer"
            style={{
              ...secondaryButton,
              opacity: whatsAppUrl ? 1 : 0.5,
              pointerEvents: whatsAppUrl ? "auto" : "none",
            }}
          >
            WhatsApp
          </a>

          {siguiente && (
            <button
              type="button"
              disabled={actualizando === cliente.id}
              onClick={() => moverCliente(cliente, siguiente)}
              style={primaryButton}
            >
              {actualizando === cliente.id
                ? "Moviendo..."
                : `Mover a ${etiquetaEstadoLead(siguiente)}`}
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <AsesorLayout
      title="Embudo"
      subtitle={
        modoGerencia
          ? "Vista comercial del equipo por etapa del lead."
          : "Tu embudo comercial para ordenar clientes por etapa."
      }
    >
      <section>
        <div style={summaryGrid}>
          <div style={summaryCard}>
            <span>Total leads</span>
            <strong>{resumen.total}</strong>
          </div>

          <div style={summaryCardRed}>
            <span>Calientes</span>
            <strong>{resumen.calientes}</strong>
          </div>

          <div style={summaryCardGold}>
            <span>Negociando</span>
            <strong>{resumen.negociando}</strong>
          </div>

          <div style={summaryCardGreen}>
            <span>Separados</span>
            <strong>{resumen.separados}</strong>
          </div>

          <div style={summaryCardBlue}>
            <span>Sin fecha</span>
            <strong>{resumen.sinSeguimiento}</strong>
          </div>
        </div>

        <div style={toolbar}>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar cliente, DNI, celular, MZ o lote"
            style={search}
          />

          <select
            value={filtroNivel}
            onChange={(event) => setFiltroNivel(event.target.value)}
            style={select}
          >
            <option value="TODOS">Todos los niveles</option>
            <option value="CALIENTE">Calientes</option>
            <option value="TIBIO">Tibios</option>
            <option value="FRIO">Frios</option>
          </select>

          <button
            type="button"
            onClick={() => void cargar()}
            style={refreshButton}
          >
            Actualizar
          </button>
        </div>

        {mensaje && <div style={success}>{mensaje}</div>}
        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>Cargando embudo...</div>
        ) : (
          <div style={board}>
            {columnas.map((columna) => {
              const items =
                clientesPorColumna.get(columna.id) || [];

              return (
                <section key={columna.id} style={column}>
                  <div
                    style={{
                      ...columnHeader,
                      background: columna.bg,
                      color: columna.color,
                    }}
                  >
                    <div>
                      <h2>{columna.titulo}</h2>
                      <p>{columna.descripcion}</p>
                    </div>

                    <span>{items.length}</span>
                  </div>

                  <div style={cardsList}>
                    {items.length === 0 ? (
                      <div style={emptyColumn}>
                        Sin clientes en esta etapa.
                      </div>
                    ) : (
                      items.map(renderCliente)
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </AsesorLayout>
  );
}

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

const summaryCardGreen: React.CSSProperties = {
  ...summaryBase,
  background: "#eef8f1",
  color: "#17633a",
  borderColor: "#c9e7d2",
};

const summaryCardBlue: React.CSSProperties = {
  ...summaryBase,
  background: "#eef6ff",
  color: "#244d77",
  borderColor: "#c7ddf4",
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 18,
};

const search: React.CSSProperties = {
  width: "min(100%, 420px)",
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

const board: React.CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(300px, 340px)",
  gap: 14,
  overflowX: "auto",
  paddingBottom: 12,
};

const column: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 10,
};

const columnHeader: React.CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: "1px solid rgba(15,23,42,.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  minHeight: 112,
};

const cardsList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 11,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const clienteNombre: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 950,
};

const clienteMeta: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const leadBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const miniGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const miniBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
  color: "#334155",
  fontSize: 12,
};

const loteBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#eef8f1",
  color: "#17633a",
  padding: "8px 10px",
  display: "grid",
  gap: 3,
  fontSize: 13,
};

const fechaBox: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  color: "#475569",
  padding: "8px 10px",
  fontSize: 13,
};

const acciones: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const primaryButton: React.CSSProperties = {
  border: "none",
  minHeight: 36,
  borderRadius: 10,
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  padding: "0 10px",
};

const secondaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  borderRadius: 10,
  background: "#f8fafc",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  fontWeight: 900,
  textDecoration: "none",
  fontSize: 13,
};

const success: React.CSSProperties = {
  marginBottom: 12,
  background: "#e7f4eb",
  color: "#17633a",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};

const alert: React.CSSProperties = {
  marginBottom: 12,
  background: "#fbe0dc",
  color: "#8b2f25",
  borderRadius: 12,
  padding: 12,
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

const emptyColumn: React.CSSProperties = {
  ...emptyBox,
  fontSize: 13,
  textAlign: "center",
};
