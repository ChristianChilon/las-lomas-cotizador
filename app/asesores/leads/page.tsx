"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  CONFIGURACION_COMERCIAL_BASE,
  formatearDuracion,
  minutosAtencionEntre,
  minutosAtencionTranscurridos,
  type ConfiguracionComercial,
} from "../../../lib/comercial";
import {
  LOTES_TABLE,
  esGerencia,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type EstadoLeadEntrante = "NUEVO" | "ATENDIDO" | "DESCARTADO";

type LeadEntrante = {
  id: string;
  cliente_id: string | null;
  lote_id: number | null;
  asesor_id: string | null;
  nombre_completo: string;
  celular_normalizado: string;
  correo_normalizado: string | null;
  mensaje: string | null;
  origen: string;
  estado: EstadoLeadEntrante;
  cliente_reutilizado: boolean;
  acepta_datos: boolean;
  acepta_comercial: boolean;
  atendido_at: string | null;
  created_at: string;
  updated_at: string;
  external_id: string | null;
  page_id: string | null;
  form_id: string | null;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  respuestas: Record<string, unknown> | null;
  meta_created_at: string | null;
};

type MetaEventError = {
  id: string;
  meta_lead_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  received_at: string;
};

type FiltroEstado = "TODOS" | EstadoLeadEntrante;
type FiltroOrigen = "TODOS" | "META_LEAD_ADS" | "COTIZADOR_WEB";

const formatearFechaHora = (fecha: string | null | undefined) => {
  if (!fecha) return "-";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "-";

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(valor);
};

const claveFechaPeru = (fecha: Date | string) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "";

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(valor);
  const obtener = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || "";

  return `${obtener("year")}-${obtener("month")}-${obtener("day")}`;
};

const etiquetaOrigen = (origen: string) => {
  if (origen === "META_LEAD_ADS") return "Meta Ads";
  if (origen === "COTIZADOR_WEB") return "Cotizador web";

  return origen || "Sin fuente";
};

const colorOrigen = (origen: string) => {
  if (origen === "META_LEAD_ADS") {
    return { color: "#1d4ed8", background: "#e8f0ff", border: "#bfd2ff" };
  }

  return { color: "#315c20", background: "#edf6e8", border: "#cce1c2" };
};

const colorEstadoLead = (estado: EstadoLeadEntrante) => {
  if (estado === "ATENDIDO") {
    return { color: "#17603a", background: "#e7f5ec", border: "#b9ddc7" };
  }

  if (estado === "DESCARTADO") {
    return { color: "#6b7280", background: "#f1f3f5", border: "#d8dde3" };
  }

  return { color: "#8a5400", background: "#fff3d7", border: "#efd18a" };
};

const textoRespuesta = (valor: unknown) => {
  if (Array.isArray(valor)) return valor.map(String).join(", ");
  if (valor === null || valor === undefined) return "-";

  return String(valor);
};

export default function LeadsEntrantesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<LeadEntrante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [eventosError, setEventosError] = useState<MetaEventError[]>([]);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionComercial>(CONFIGURACION_COMERCIAL_BASE);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("TODOS");
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("TODOS");
  const [filtroAsesor, setFiltroAsesor] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = async (silencioso = false) => {
    if (!supabase) return;

    if (!silencioso) setCargando(true);
    setError(null);

    const perfil = await obtenerPerfilActual();

    if (!perfil.profile) {
      setError(perfil.error || "No se pudo cargar tu perfil.");
      setCargando(false);
      return;
    }

    setProfile(perfil.profile);
    const modoGerencia = esGerencia(perfil.profile);
    let leadsQuery = supabase
      .from("leads_publicos")
      .select(
        [
          "id",
          "cliente_id",
          "lote_id",
          "asesor_id",
          "nombre_completo",
          "celular_normalizado",
          "correo_normalizado",
          "mensaje",
          "origen",
          "estado",
          "cliente_reutilizado",
          "acepta_datos",
          "acepta_comercial",
          "atendido_at",
          "created_at",
          "updated_at",
          "external_id",
          "page_id",
          "form_id",
          "ad_id",
          "adset_id",
          "campaign_id",
          "ad_name",
          "adset_name",
          "campaign_name",
          "respuestas",
          "meta_created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (!modoGerencia) {
      leadsQuery = leadsQuery.eq("asesor_id", perfil.profile.id);
    }

    const leadsResult = await leadsQuery;

    if (leadsResult.error) {
      setError(
        leadsResult.error.message.includes("external_id")
          ? "Falta ejecutar la migracion 010_crm_meta_lead_ads.sql en Supabase."
          : leadsResult.error.message
      );
      setCargando(false);
      return;
    }

    let clientesQuery = supabase
      .from("clientes")
      .select(
        "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,lote_interes_id,created_at,updated_at,nivel_interes,estado_lead,proxima_accion,fecha_proximo_seguimiento"
      );

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq("asesor_id", perfil.profile.id);
    }

    const [clientesResult, lotesResult, perfilesResult, configuracionResult] =
      await Promise.all([
        clientesQuery,
        supabase
          .from(LOTES_TABLE)
          .select("id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"),
        modoGerencia
          ? supabase
              .from("profiles")
              .select("id,full_name,email,role,phone,active")
              .eq("role", "asesor")
              .eq("active", true)
              .order("full_name", { ascending: true })
          : Promise.resolve({ data: [perfil.profile], error: null }),
        supabase
          .from("configuracion_comercial")
          .select(
            "project_key,sla_primer_contacto_minutos,cadencia_caliente_dias,cadencia_tibio_dias,cadencia_frio_dias,alerta_separacion_dias,hora_inicio,hora_fin,atender_sabado,atender_domingo"
          )
          .eq("project_key", "las_lomas")
          .maybeSingle(),
      ]);

    const errorCarga =
      clientesResult.error || lotesResult.error || perfilesResult.error;

    if (errorCarga) {
      setError(errorCarga.message);
      setCargando(false);
      return;
    }

    setLeads((leadsResult.data || []) as unknown as LeadEntrante[]);
    setClientes((clientesResult.data || []) as unknown as Cliente[]);
    setLotes((lotesResult.data || []) as unknown as LoteCrm[]);
    setAsesores((perfilesResult.data || []) as unknown as Profile[]);
    setConfiguracion(
      configuracionResult.data
        ? (configuracionResult.data as unknown as ConfiguracionComercial)
        : CONFIGURACION_COMERCIAL_BASE
    );

    if (modoGerencia) {
      const eventosResult = await supabase
        .from("meta_lead_events")
        .select("id,meta_lead_id,status,attempts,last_error,received_at")
        .eq("status", "ERROR")
        .order("received_at", { ascending: false })
        .limit(10);

      if (!eventosResult.error) {
        setEventosError(
          (eventosResult.data || []) as unknown as MetaEventError[]
        );
      }
    } else {
      setEventosError([]);
    }

    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(() => cargar());
  }, []);

  const modoGerencia = esGerencia(profile);
  const clientesPorId = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id, cliente])),
    [clientes]
  );
  const lotesPorId = useMemo(
    () => new Map(lotes.map((lote) => [lote.id, lote])),
    [lotes]
  );
  const asesoresPorId = useMemo(
    () => new Map(asesores.map((asesor) => [asesor.id, asesor])),
    [asesores]
  );

  const leadsFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return leads.filter((lead) => {
      if (filtroEstado !== "TODOS" && lead.estado !== filtroEstado) {
        return false;
      }

      if (filtroOrigen !== "TODOS" && lead.origen !== filtroOrigen) {
        return false;
      }

      if (filtroAsesor !== "TODOS" && lead.asesor_id !== filtroAsesor) {
        return false;
      }

      if (!texto) return true;

      const cliente = lead.cliente_id
        ? clientesPorId.get(lead.cliente_id)
        : null;

      return [
        lead.nombre_completo,
        lead.celular_normalizado,
        lead.correo_normalizado,
        lead.campaign_name,
        lead.adset_name,
        lead.ad_name,
        lead.external_id,
        nombreCliente(cliente),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [
    busqueda,
    clientesPorId,
    filtroAsesor,
    filtroEstado,
    filtroOrigen,
    leads,
  ]);

  const resumen = useMemo(() => {
    const hoy = claveFechaPeru(new Date());
    const nuevos = leads.filter((lead) => lead.estado === "NUEVO");

    return {
      total: leads.length,
      nuevos: nuevos.length,
      vencidos: nuevos.filter(
        (lead) =>
          minutosAtencionTranscurridos(
            lead.meta_created_at || lead.created_at,
            configuracion
          ) >= configuracion.sla_primer_contacto_minutos
      ).length,
      meta: leads.filter((lead) => lead.origen === "META_LEAD_ADS").length,
      atendidosHoy: leads.filter(
        (lead) =>
          lead.estado === "ATENDIDO" &&
          claveFechaPeru(lead.atendido_at || "") === hoy
      ).length,
    };
  }, [configuracion, leads]);

  const actualizarEstado = async (
    lead: LeadEntrante,
    estado: EstadoLeadEntrante
  ) => {
    if (!supabase) return;

    setActualizando(lead.id);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_actualizar_estado_lead_entrante",
      {
        p_lead_id: lead.id,
        p_estado: estado,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setActualizando(null);
      return;
    }

    setMensaje(
      estado === "ATENDIDO"
        ? "Lead marcado como atendido."
        : estado === "DESCARTADO"
          ? "Lead descartado."
          : "Lead reabierto."
    );
    await cargar(true);
    setActualizando(null);
  };

  const reasignar = async (lead: LeadEntrante, asesorId: string) => {
    if (!supabase || !asesorId) return;

    setActualizando(lead.id);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_reasignar_lead_entrante",
      {
        p_lead_id: lead.id,
        p_asesor_id: asesorId,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setActualizando(null);
      return;
    }

    setMensaje("Lead y cliente reasignados correctamente.");
    await cargar(true);
    setActualizando(null);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("TODOS");
    setFiltroOrigen("TODOS");
    setFiltroAsesor("TODOS");
  };

  return (
    <AsesorLayout
      title={modoGerencia ? "Leads entrantes" : "Mis leads entrantes"}
      subtitle={
        modoGerencia
          ? "Controla la entrada desde Meta Ads y el cotizador, el reparto y el SLA de primera respuesta."
          : "Atiende primero los leads nuevos y registra cada contacto dentro de su ficha."
      }
    >
      {eventosError.length > 0 && modoGerencia && (
        <section style={integrationAlert}>
          <div>
            <strong>
              Meta tiene {eventosError.length} evento
              {eventosError.length === 1 ? "" : "s"} pendiente
              {eventosError.length === 1 ? "" : "s"} de revision
            </strong>
            <p style={integrationAlertText}>
              El webhook guardo la solicitud, pero no pudo convertirla en lead.
              Revisa permisos, campos obligatorios o variables de Vercel.
            </p>
          </div>
          <details>
            <summary style={detailsSummary}>Ver errores</summary>
            <div style={errorList}>
              {eventosError.map((evento) => (
                <div key={evento.id} style={errorItem}>
                  <strong>{evento.meta_lead_id}</strong>
                  <span>{evento.last_error || "Error sin detalle"}</span>
                  <small>
                    {formatearFechaHora(evento.received_at)} · intento {evento.attempts}
                  </small>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {error && <div style={errorBanner}>{error}</div>}
      {mensaje && <div style={successBanner}>{mensaje}</div>}

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <span style={summaryLabel}>Nuevos</span>
          <strong style={summaryValue}>{resumen.nuevos}</strong>
          <small style={summaryHint}>Esperan primer contacto</small>
        </article>
        <article style={summaryCard}>
          <span style={summaryLabel}>SLA vencido</span>
          <strong
            style={{
              ...summaryValue,
              color: resumen.vencidos > 0 ? "#b42318" : "#17603a",
            }}
          >
            {resumen.vencidos}
          </strong>
          <small style={summaryHint}>
            Objetivo: {configuracion.sla_primer_contacto_minutos} min
          </small>
        </article>
        <article style={summaryCard}>
          <span style={summaryLabel}>Origen Meta Ads</span>
          <strong style={summaryValue}>{resumen.meta}</strong>
          <small style={summaryHint}>De {resumen.total} leads registrados</small>
        </article>
        <article style={summaryCard}>
          <span style={summaryLabel}>Atendidos hoy</span>
          <strong style={summaryValue}>{resumen.atendidosHoy}</strong>
          <small style={summaryHint}>Contactos cerrados hoy</small>
        </article>
      </section>

      <section style={filterBand}>
        <input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar nombre, celular, campaña o anuncio"
          style={searchInput}
        />
        <select
          value={filtroEstado}
          onChange={(event) =>
            setFiltroEstado(event.target.value as FiltroEstado)
          }
          style={selectControl}
        >
          <option value="TODOS">Todos los estados</option>
          <option value="NUEVO">Nuevos</option>
          <option value="ATENDIDO">Atendidos</option>
          <option value="DESCARTADO">Descartados</option>
        </select>
        <select
          value={filtroOrigen}
          onChange={(event) =>
            setFiltroOrigen(event.target.value as FiltroOrigen)
          }
          style={selectControl}
        >
          <option value="TODOS">Todos los orígenes</option>
          <option value="META_LEAD_ADS">Meta Ads</option>
          <option value="COTIZADOR_WEB">Cotizador web</option>
        </select>
        {modoGerencia && (
          <select
            value={filtroAsesor}
            onChange={(event) => setFiltroAsesor(event.target.value)}
            style={selectControl}
          >
            <option value="TODOS">Todos los asesores</option>
            {asesores.map((asesor) => (
              <option key={asesor.id} value={asesor.id}>
                {asesor.full_name || asesor.email || "Asesor"}
              </option>
            ))}
          </select>
        )}
        <button onClick={limpiarFiltros} style={secondaryButton}>
          Limpiar
        </button>
        <button
          onClick={() => void cargar(true)}
          style={secondaryButton}
          disabled={cargando}
        >
          Actualizar
        </button>
      </section>

      <section style={tableFrame}>
        {cargando ? (
          <div style={emptyState}>Cargando leads entrantes...</div>
        ) : leadsFiltrados.length === 0 ? (
          <div style={emptyState}>
            No hay leads que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <div style={tableScroll}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Lead</th>
                  <th style={th}>Origen e interés</th>
                  <th style={th}>Responsable</th>
                  <th style={th}>SLA y estado</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.map((lead) => {
                  const cliente = lead.cliente_id
                    ? clientesPorId.get(lead.cliente_id)
                    : null;
                  const lote = lead.lote_id ? lotesPorId.get(lead.lote_id) : null;
                  const asesor = lead.asesor_id
                    ? asesoresPorId.get(lead.asesor_id)
                    : null;
                  const fechaEntrada = lead.meta_created_at || lead.created_at;
                  const minutos =
                    lead.estado === "NUEVO"
                      ? minutosAtencionTranscurridos(fechaEntrada, configuracion)
                      : minutosAtencionEntre(
                          fechaEntrada,
                          lead.atendido_at,
                          configuracion
                        );
                  const slaVencido =
                    minutos >= configuracion.sla_primer_contacto_minutos;
                  const origenColor = colorOrigen(lead.origen);
                  const estadoColor = colorEstadoLead(lead.estado);
                  const whatsapp = `https://wa.me/51${lead.celular_normalizado}`;
                  const respuestas = Object.entries(lead.respuestas || {});

                  return (
                    <tr key={lead.id} style={tr}>
                      <td style={td}>
                        <strong style={leadName}>{lead.nombre_completo}</strong>
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          style={phoneLink}
                        >
                          {lead.celular_normalizado}
                        </a>
                        <span style={mutedText}>
                          {lead.correo_normalizado || "Sin correo"}
                        </span>
                        <span style={mutedText}>
                          Ingreso: {formatearFechaHora(fechaEntrada)}
                        </span>
                        {lead.cliente_reutilizado && (
                          <span style={reusedText}>Cliente existente reutilizado</span>
                        )}
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            color: origenColor.color,
                            background: origenColor.background,
                            borderColor: origenColor.border,
                          }}
                        >
                          {etiquetaOrigen(lead.origen)}
                        </span>
                        {lote && (
                          <strong style={interestText}>
                            MZ {lote.mz} · Lote {lote.lote}
                          </strong>
                        )}
                        {lead.campaign_name && (
                          <strong style={interestText}>
                            Campaña: {lead.campaign_name}
                          </strong>
                        )}
                        {lead.ad_name && (
                          <span style={mutedText}>Anuncio: {lead.ad_name}</span>
                        )}
                        {lead.origen === "META_LEAD_ADS" && (
                          <span
                            style={{
                              ...consentText,
                              color: lead.acepta_comercial ? "#17603a" : "#9a3412",
                            }}
                          >
                            {lead.acepta_comercial
                              ? "WhatsApp autorizado"
                              : "Sin opt-in para bot"}
                          </span>
                        )}
                        {respuestas.length > 0 && (
                          <details style={answersDetails}>
                            <summary style={answersSummary}>Ver respuestas</summary>
                            <div style={answersList}>
                              {respuestas.map(([pregunta, respuesta]) => (
                                <div key={pregunta}>
                                  <strong>{pregunta}</strong>
                                  <span>{textoRespuesta(respuesta)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>

                      <td style={td}>
                        {modoGerencia ? (
                          <select
                            value={lead.asesor_id || ""}
                            onChange={(event) =>
                              void reasignar(lead, event.target.value)
                            }
                            disabled={actualizando === lead.id}
                            style={advisorSelect}
                          >
                            <option value="" disabled>
                              Sin asignar
                            </option>
                            {asesores.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.full_name || item.email || "Asesor"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <strong style={assignedText}>Asignado a ti</strong>
                        )}
                        {modoGerencia && (
                          <span style={mutedText}>
                            {asesor?.email || "Requiere asignación"}
                          </span>
                        )}
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            color: estadoColor.color,
                            background: estadoColor.background,
                            borderColor: estadoColor.border,
                          }}
                        >
                          {lead.estado}
                        </span>
                        <strong
                          style={{
                            ...slaText,
                            color:
                              lead.estado === "DESCARTADO"
                                ? "#6b7280"
                                : slaVencido
                                  ? "#b42318"
                                  : "#17603a",
                          }}
                        >
                          {lead.estado === "NUEVO"
                            ? slaVencido
                              ? `SLA vencido · ${formatearDuracion(minutos)}`
                              : `En tiempo · ${formatearDuracion(minutos)}`
                            : lead.estado === "ATENDIDO"
                              ? `${slaVencido ? "Fuera de SLA" : "Dentro de SLA"} · ${formatearDuracion(minutos)}`
                              : "Cerrado sin gestión"}
                        </strong>
                        {lead.atendido_at && (
                          <span style={mutedText}>
                            Atendido: {formatearFechaHora(lead.atendido_at)}
                          </span>
                        )}
                      </td>

                      <td style={td}>
                        <div style={actions}>
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            style={primaryButton}
                          >
                            WhatsApp
                          </a>
                          {cliente && (
                            <Link
                              href={`/asesores/clientes/${cliente.id}#registrar-seguimiento`}
                              style={secondaryButton}
                            >
                              Registrar contacto
                            </Link>
                          )}
                          {lead.estado === "NUEVO" && (
                            <button
                              onClick={() =>
                                void actualizarEstado(lead, "ATENDIDO")
                              }
                              disabled={actualizando === lead.id}
                              style={secondaryButton}
                            >
                              Marcar atendido
                            </button>
                          )}
                          {lead.estado === "NUEVO" && (
                            <button
                              onClick={() =>
                                void actualizarEstado(lead, "DESCARTADO")
                              }
                              disabled={actualizando === lead.id}
                              style={dangerButton}
                            >
                              Descartar
                            </button>
                          )}
                          {modoGerencia && lead.estado !== "NUEVO" && (
                            <button
                              onClick={() => void actualizarEstado(lead, "NUEVO")}
                              disabled={actualizando === lead.id}
                              style={secondaryButton}
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AsesorLayout>
  );
}

const integrationAlert: React.CSSProperties = {
  marginBottom: 18,
  padding: "16px 18px",
  borderRadius: 8,
  border: "1px solid #efb4ab",
  background: "#fff1ef",
  color: "#7a271a",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
};

const integrationAlertText: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#9b3b2c",
  lineHeight: 1.45,
};

const detailsSummary: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 900,
};

const errorList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 8,
  maxWidth: 620,
};

const errorItem: React.CSSProperties = {
  display: "grid",
  gap: 3,
  paddingTop: 8,
  borderTop: "1px solid #efc4bd",
  fontSize: 12,
};

const errorBanner: React.CSSProperties = {
  marginBottom: 16,
  padding: "13px 15px",
  borderRadius: 8,
  border: "1px solid #efb4ab",
  background: "#fff1ef",
  color: "#8a2d20",
  fontWeight: 800,
};

const successBanner: React.CSSProperties = {
  marginBottom: 16,
  padding: "13px 15px",
  borderRadius: 8,
  border: "1px solid #b8dbc5",
  background: "#ebf7ef",
  color: "#17603a",
  fontWeight: 800,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid #dfe5dc",
  background: "#ffffff",
  display: "grid",
  gap: 5,
  boxShadow: "0 8px 20px rgba(15,23,42,.04)",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue: React.CSSProperties = {
  color: "#102a1e",
  fontSize: 28,
  lineHeight: 1,
};

const summaryHint: React.CSSProperties = {
  color: "#7a857d",
};

const filterBand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "14px 0",
  marginBottom: 4,
};

const searchInput: React.CSSProperties = {
  flex: "1 1 290px",
  minWidth: 220,
  height: 42,
  borderRadius: 7,
  border: "1px solid #d5ddd3",
  background: "#ffffff",
  padding: "0 13px",
  color: "#17211b",
};

const selectControl: React.CSSProperties = {
  minWidth: 170,
  height: 42,
  borderRadius: 7,
  border: "1px solid #d5ddd3",
  background: "#ffffff",
  padding: "0 11px",
  color: "#17211b",
};

const tableFrame: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid #dfe5dc",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const tableScroll: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1160,
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  padding: "13px 14px",
  background: "#eef2ec",
  borderBottom: "1px solid #d8dfd6",
  color: "#3e5145",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};

const tr: React.CSSProperties = {
  borderBottom: "1px solid #edf0ec",
};

const td: React.CSSProperties = {
  padding: 14,
  verticalAlign: "top",
  color: "#1f2937",
};

const leadName: React.CSSProperties = {
  display: "block",
  marginBottom: 5,
  color: "#12251a",
  fontSize: 15,
};

const phoneLink: React.CSSProperties = {
  display: "block",
  color: "#17603a",
  textDecoration: "none",
  fontWeight: 850,
  marginBottom: 3,
};

const mutedText: React.CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#6b7280",
  fontSize: 12,
  lineHeight: 1.4,
};

const reusedText: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  color: "#76510a",
  fontSize: 11,
  fontWeight: 850,
};

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 27,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 11,
  fontWeight: 900,
};

const interestText: React.CSSProperties = {
  display: "block",
  marginTop: 7,
  color: "#26352c",
  fontSize: 12,
};

const consentText: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  fontSize: 11,
  fontWeight: 900,
};

const answersDetails: React.CSSProperties = {
  marginTop: 8,
  maxWidth: 280,
};

const answersSummary: React.CSSProperties = {
  cursor: "pointer",
  color: "#47634f",
  fontSize: 11,
  fontWeight: 850,
};

const answersList: React.CSSProperties = {
  marginTop: 7,
  display: "grid",
  gap: 7,
  padding: 9,
  borderRadius: 6,
  background: "#f5f7f4",
  color: "#4b5563",
  fontSize: 11,
};

const advisorSelect: React.CSSProperties = {
  width: 190,
  minHeight: 38,
  borderRadius: 6,
  border: "1px solid #ccd6ca",
  background: "#ffffff",
  padding: "0 9px",
  color: "#203128",
  fontWeight: 750,
};

const assignedText: React.CSSProperties = {
  display: "block",
  color: "#17603a",
  fontSize: 13,
};

const slaText: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  fontSize: 12,
};

const actions: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  flexWrap: "wrap",
  width: 250,
};

const buttonBase: React.CSSProperties = {
  minHeight: 34,
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #17603a",
  background: "#17603a",
  color: "#ffffff",
};

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #c9d3c7",
  background: "#ffffff",
  color: "#31513d",
};

const dangerButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #e3aaa1",
  background: "#fff5f3",
  color: "#9b2c20",
};

const emptyState: React.CSSProperties = {
  padding: 32,
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 750,
};
