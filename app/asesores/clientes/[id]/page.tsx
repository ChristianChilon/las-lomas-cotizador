"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AsesorLayout from "../../../../components/layout/AsesorLayout";
import { supabase } from "../../../../lib/supabase";
import {
  LOTES_TABLE,
  colorNivelInteres,
  etiquetaCanalPreferido,
  etiquetaCapacidadCuota,
  etiquetaEstadoCita,
  etiquetaEstadoLead,
  etiquetaIntencionCompra,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  etiquetaResultadoSeguimiento,
  etiquetaSituacionInicial,
  etiquetaTiempoDecision,
  etiquetaTipoContacto,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
  type Separacion,
  type SeguimientoCliente,
} from "../../../../lib/crm";

import { obtenerPerfilActual } from "../../../../lib/auth/clientAuth";

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

const formatearFechaHora = (
  fecha: string | null | undefined
) => {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleString("es-PE");
};

type SeguimientoForm = {
  tipoContacto: string;
  resultado: string;
  comentario: string;
  fechaProximoSeguimiento: string;
};

const seguimientoVacio: SeguimientoForm = {
  tipoContacto: "WHATSAPP",
  resultado: "CONTACTADO",
  comentario: "",
  fechaProximoSeguimiento: "",
};

const obtenerTipoContactoInicial = (cliente: Cliente) => {
  if (cliente.canal_preferido === "LLAMADA") {
    return "LLAMADA";
  }

  if (cliente.canal_preferido === "CITA_OFICINA") {
    return "CITA";
  }

  return "WHATSAPP";
};

const tiposContacto = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "LLAMADA", label: "Llamada" },
  { value: "CITA", label: "Cita" },
  { value: "VISITA_OFICINA", label: "Visita en oficina" },
  { value: "ENVIO_INFO", label: "Envío de información" },
  { value: "RECORDATORIO", label: "Recordatorio" },
  { value: "OTRO", label: "Otro" },
];

const resultadosSeguimiento = [
  { value: "CONTACTADO", label: "Contactado" },
  { value: "NO_RESPONDE", label: "No responde" },
  { value: "INTERESADO", label: "Interesado" },
  { value: "DUDAS", label: "Tiene dudas" },
  { value: "AGENDO_CITA", label: "Agendó cita" },
  { value: "SEPARARA_PRONTO", label: "Separará pronto" },
  { value: "DESCARTADO", label: "Descartado" },
];

export default function ClienteDetallePage() {
  const params = useParams();
  const clienteId = String(params.id || "");

  const [cliente, setCliente] =
    useState<Cliente | null>(null);

  const [seguimientos, setSeguimientos] = useState<
    SeguimientoCliente[]
  >([]);

  const [separacionesCliente, setSeparacionesCliente] =
   useState<Separacion[]>([]);

  const [lotes, setLotes] = useState<LoteCrm[]>([]);

  const [
    loteInteresEditando,
    setLoteInteresEditando,
  ] = useState("");

  const [
    guardandoLoteInteres,
    setGuardandoLoteInteres,
  ] = useState(false);

  const [separacionEditando, setSeparacionEditando] =
    useState<{
      monto: string;
      fechaLimite: string;
      observaciones: string;
    } | null>(null);

  const [separandoLote, setSeparandoLote] =
    useState(false);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [seguimientoEditando, setSeguimientoEditando] =
    useState<SeguimientoForm>(seguimientoVacio);

  const [guardandoSeguimiento, setGuardandoSeguimiento] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [cargando, setCargando] = useState(true);

  const [mensaje, setMensaje] =
    useState<string | null>(null);

  const [programandoCita, setProgramandoCita] =
    useState(false);

  const [citaEditando, setCitaEditando] =
    useState<{
      fechaCita: string;
      horaCita: string;
    } | null>(null);

  useEffect(() => {
    const cargar = async () => {
      if (!supabase || !clienteId) return;

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

      const { data: clienteData, error: clienteError } =
        await supabase
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
              "lote_interes_id",
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
          .eq("id", clienteId)
          .single();

      if (clienteError) {
        setError(clienteError.message);
        setCargando(false);
        return;
      }

      const clienteCargado =
        clienteData as unknown as Cliente;

      setCliente(clienteCargado);

      setSeguimientoEditando({
        ...seguimientoVacio,
        tipoContacto: obtenerTipoContactoInicial(clienteCargado),
      });

      setLoteInteresEditando(
        clienteCargado.lote_interes_id
          ? String(clienteCargado.lote_interes_id)
          : ""
      );

      const { data: lotesData, error: lotesError } =
        await supabase
          .from(LOTES_TABLE)
          .select(
            "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
          )
          .order("mz", { ascending: true })
          .order("lote", { ascending: true });

      if (lotesError) {
        setError(lotesError.message);
        setCargando(false);
        return;
      }

      setLotes(
        (lotesData || []) as unknown as LoteCrm[]
      );

      const {
        data: seguimientosData,
        error: seguimientosError,
      } = await supabase
        .from("seguimientos_clientes")
        .select(
          "id,cliente_id,asesor_id,tipo_contacto,resultado,comentario,fecha_proximo_seguimiento,created_by,created_at"
        )
        .eq("cliente_id", clienteId)
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

      const {
        data: separacionesData,
        error: separacionesError,
      } = await supabase
        .from("separaciones")
        .select(
          "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
        )
        .eq("cliente_id", clienteId)
        .order("created_at", {
          ascending: false,
        });

      if (separacionesError) {
        setError(separacionesError.message);
        setCargando(false);
        return;
      }

      setSeparacionesCliente(
        (separacionesData || []) as unknown as Separacion[]
      );

      setCargando(false);
    };

    void Promise.resolve().then(cargar);
  }, [clienteId]);

  const iniciarProgramarCita = () => {
    if (!cliente) return;

    setMensaje(null);
    setError(null);

    setCitaEditando({
      fechaCita: cliente.fecha_cita || "",
      horaCita: cliente.hora_cita || "",
    });
  };

  const actualizarCitaEditando = (
    campo: "fechaCita" | "horaCita",
    valor: string
  ) => {
    setCitaEditando((actual) =>
      actual
        ? {
            ...actual,
            [campo]: valor,
          }
        : actual
    );
  };

  const guardarProgramacionCita = async () => {
    if (!supabase || !cliente || !citaEditando) return;

    if (!citaEditando.fechaCita) {
      setError("Selecciona la fecha de la cita.");
      return;
    }

    if (citaEditando.fechaCita < obtenerFechaHoyISO()) {
      setError("No puedes programar una cita en una fecha pasada.");
      return;
    }

    if (!citaEditando.horaCita.trim()) {
      setError("Registra la hora pactada de la cita.");
      return;
    }

    setProgramandoCita(true);
    setMensaje(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        estado_cita: "CITA_PROGRAMADA",
        fecha_cita: citaEditando.fechaCita,
        hora_cita: citaEditando.horaCita.trim(),
        fecha_proximo_seguimiento: citaEditando.fechaCita,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
      setProgramandoCita(false);
      return;
    }

    setCliente({
      ...cliente,
      estado_cita: "CITA_PROGRAMADA",
      fecha_cita: citaEditando.fechaCita,
      hora_cita: citaEditando.horaCita.trim(),
      fecha_proximo_seguimiento: citaEditando.fechaCita,
    });

    setMensaje("Cita programada correctamente.");
    setCitaEditando(null);
    setProgramandoCita(false);
  };

  const guardarLoteInteres = async () => {
    if (!supabase || !cliente) return;

    setGuardandoLoteInteres(true);
    setMensaje(null);
    setError(null);

    const nuevoLoteInteresId = loteInteresEditando
      ? Number(loteInteresEditando)
      : null;

    if (
      loteInteresEditando &&
      Number.isNaN(nuevoLoteInteresId)
    ) {
      setError("Selecciona un lote válido.");
      setGuardandoLoteInteres(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        lote_interes_id: nuevoLoteInteresId,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
      setGuardandoLoteInteres(false);
      return;
    }

    setCliente({
      ...cliente,
      lote_interes_id: nuevoLoteInteresId,
    });

    setMensaje(
      nuevoLoteInteresId
        ? "Lote de interés actualizado correctamente."
        : "Lote de interés quitado correctamente."
    );

    setGuardandoLoteInteres(false);
  };

  const iniciarSeparacionLote = () => {
    if (!cliente || !loteInteres) return;

    setMensaje(null);
    setError(null);

    if (loteInteres.estado !== "DISPONIBLE") {
      setError(
        "Solo puedes separar lotes disponibles. Este lote está en estado: " +
          loteInteres.estado
      );
      return;
    }

    setSeparacionEditando({
      monto: "",
      fechaLimite: "",
      observaciones: `Separación creada desde la ficha del cliente ${nombreCliente(cliente)}.`,
    });
  };

  const actualizarSeparacionEditando = (
    campo: "monto" | "fechaLimite" | "observaciones",
    valor: string
  ) => {
    setSeparacionEditando((actual) =>
      actual
        ? {
            ...actual,
            [campo]: valor,
          }
        : actual
    );
  };

  const crearSeparacionDesdeFicha = async () => {
    if (
      !supabase ||
      !profile ||
      !cliente ||
      !loteInteres ||
      !separacionEditando
    ) {
      return;
    }

    setMensaje(null);
    setError(null);

    if (loteInteres.estado !== "DISPONIBLE") {
      setError(
        "No se puede separar este lote porque no está disponible."
      );
      return;
    }

    if (
      separacionEditando.fechaLimite &&
      separacionEditando.fechaLimite < obtenerFechaHoyISO()
    ) {
      setError(
        "La fecha límite de separación no puede estar en una fecha pasada."
      );
      return;
    }

    const montoSeparacionTexto =
      separacionEditando.monto.trim();
    const montoSeparacion =
      montoSeparacionTexto === ""
        ? null
        : Number(montoSeparacionTexto);

    if (
      montoSeparacion !== null &&
      (Number.isNaN(montoSeparacion) || montoSeparacion < 0)
    ) {
      setError("Ingresa un monto de separación válido.");
      return;
    }

    setSeparandoLote(true);

    const { error: rpcError } = await supabase.rpc(
      "crm_crear_separacion",
      {
        p_lote_id: loteInteres.id,
        p_cliente_id: cliente.id,
        p_monto: montoSeparacion,
        p_fecha_limite:
          separacionEditando.fechaLimite || null,
        p_observaciones:
          separacionEditando.observaciones.trim() ||
          null,
        p_asesor_id: null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setSeparandoLote(false);
      return;
    }

    const { error: clienteUpdateError } = await supabase
      .from("clientes")
      .update({
        lote_interes_id: loteInteres.id,
        estado_lead: "SEPARADO",
        proxima_accion: "ESPERAR_PAGO",
      })
      .eq("id", cliente.id);

    if (clienteUpdateError) {
      setError(clienteUpdateError.message);
      setSeparandoLote(false);
      return;
    }

    setCliente({
      ...cliente,
      lote_interes_id: loteInteres.id,
      estado_lead: "SEPARADO",
      proxima_accion: "ESPERAR_PAGO",
    });

    setLotes((actuales) =>
      actuales.map((lote) =>
        lote.id === loteInteres.id
          ? {
              ...lote,
              estado: "SEPARADO",
              cliente_id: cliente.id,
              asesor_id: cliente.asesor_id || profile.id,
              updated_at: new Date().toISOString(),
            }
          : lote
      )
    );

    setSeparacionEditando(null);
    setMensaje(
      "Separación creada correctamente. El lote ahora está separado."
    );
    setSeparandoLote(false);
  };

  const quitarLoteInteres = async () => {
    if (!supabase || !cliente) return;
  
    if (loteInteres && loteInteres.estado !== "DISPONIBLE") {
      setError(
        "No puedes quitar este lote desde la ficha porque ya no está disponible. Si existe una separación activa, anúlala desde el módulo Separaciones."
      );
      return;
    }

    setGuardandoLoteInteres(true);
    setMensaje(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        lote_interes_id: null,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
      setGuardandoLoteInteres(false);
      return;
    }

    setCliente({
      ...cliente,
      lote_interes_id: null,
    });

    setLoteInteresEditando("");
    setMensaje("Lote de interés quitado correctamente.");
    setGuardandoLoteInteres(false);
  };

  const actualizarSeguimiento = (
    campo: keyof SeguimientoForm,
    valor: string
  ) => {
    setSeguimientoEditando((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const guardarSeguimientoCliente = async () => {
    if (!supabase || !profile || !cliente) return;

    if (!seguimientoEditando.comentario.trim()) {
      setError("Escribe un comentario del seguimiento.");
      return;
    }

    if (
      seguimientoEditando.fechaProximoSeguimiento &&
      seguimientoEditando.fechaProximoSeguimiento <
        obtenerFechaHoyISO()
    ) {
      setError(
        "El próximo seguimiento no puede estar en una fecha pasada."
      );
      return;
    }

    setGuardandoSeguimiento(true);
    setMensaje(null);
    setError(null);

    const asesorDelSeguimiento =
      cliente.asesor_id || profile.id;

    const { data: seguimientoCreado, error: insertError } =
      await supabase
        .from("seguimientos_clientes")
        .insert({
          cliente_id: cliente.id,
          asesor_id: asesorDelSeguimiento,
          tipo_contacto: seguimientoEditando.tipoContacto,
          resultado: seguimientoEditando.resultado,
          comentario: seguimientoEditando.comentario.trim(),
          fecha_proximo_seguimiento:
            seguimientoEditando.fechaProximoSeguimiento ||
            null,
          created_by: profile.id,
        })
        .select(
          "id,cliente_id,asesor_id,tipo_contacto,resultado,comentario,fecha_proximo_seguimiento,created_by,created_at"
        )
        .single();

    if (insertError) {
      setError(insertError.message);
      setGuardandoSeguimiento(false);
      return;
    }

    let nuevoEstadoLead =
      cliente.estado_lead || "SEGUIMIENTO";

    let nuevaProximaAccion =
      cliente.proxima_accion || "CONTACTAR";

    if (seguimientoEditando.resultado === "NO_RESPONDE") {
      nuevoEstadoLead = "NO_RESPONDE";
      nuevaProximaAccion = "VOLVER_A_CONTACTAR";
    }

    if (
      seguimientoEditando.resultado === "CONTACTADO" ||
      seguimientoEditando.resultado === "INTERESADO" ||
      seguimientoEditando.resultado === "DUDAS"
    ) {
      nuevoEstadoLead = "SEGUIMIENTO";
      nuevaProximaAccion = "VOLVER_A_CONTACTAR";
    }

    if (seguimientoEditando.resultado === "AGENDO_CITA") {
      nuevoEstadoLead = "CALIFICADO";
      nuevaProximaAccion = "AGENDAR_CITA";
    }

    if (seguimientoEditando.resultado === "SEPARARA_PRONTO") {
      nuevoEstadoLead = "NEGOCIANDO";
      nuevaProximaAccion = "ESPERAR_PAGO";
    }

    if (seguimientoEditando.resultado === "DESCARTADO") {
      nuevoEstadoLead = "PERDIDO";
      nuevaProximaAccion = "DESCARTAR";
    }

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        estado_lead: nuevoEstadoLead,
        proxima_accion: nuevaProximaAccion,
        fecha_proximo_seguimiento:
          seguimientoEditando.fechaProximoSeguimiento ||
          null,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
      setGuardandoSeguimiento(false);
      return;
    }

    setCliente({
      ...cliente,
      estado_lead: nuevoEstadoLead,
      proxima_accion: nuevaProximaAccion,
      fecha_proximo_seguimiento:
        seguimientoEditando.fechaProximoSeguimiento ||
        null,
    });

    if (seguimientoCreado) {
      setSeguimientos((actuales) => [
        seguimientoCreado as unknown as SeguimientoCliente,
        ...actuales,
      ]);
    }

    setSeguimientoEditando({
      ...seguimientoVacio,
      tipoContacto: obtenerTipoContactoInicial(cliente),
    });

    setMensaje("Seguimiento registrado correctamente.");
    setGuardandoSeguimiento(false);
  };

  if (cargando) {
    return (
      <AsesorLayout
        title="Cliente"
        subtitle="Cargando ficha del cliente."
      >
        <div style={emptyBox}>
          Cargando información del cliente...
        </div>
      </AsesorLayout>
    );
  }

  if (error || !cliente) {
    return (
      <AsesorLayout
        title="Cliente"
        subtitle="No se pudo cargar la ficha."
      >
        <div style={alert}>
          {error || "Cliente no encontrado."}
        </div>

        <Link href="/asesores/clientes" style={backButton}>
          Volver a clientes
        </Link>
      </AsesorLayout>
    );
  }

  const color = colorNivelInteres(cliente.nivel_interes);

  const loteInteres = cliente.lote_interes_id
    ? lotes.find(
        (lote) => lote.id === cliente.lote_interes_id
      )
    : null;
  
  const separacionesConLote =
    separacionesCliente.map((separacion) => ({
      separacion,
      lote: lotes.find(
        (lote) => lote.id === separacion.lote_id
      ),
    }));
  
  const lotesDisponibles = lotes.filter(
    (lote) => lote.estado === "DISPONIBLE"
  );

  const loteInteresNoDisponible =
    loteInteres && loteInteres.estado !== "DISPONIBLE";
  
  const loteInteresTieneSeparacion =
    loteInteres &&
    loteInteres.estado !== "DISPONIBLE";

  return (
    <AsesorLayout
      title="Cliente"
      subtitle="Ficha comercial individual del cliente."
    >
      <section>
        <div style={pageHeader}>
          <div>
            <div style={eyebrow}>Ficha del cliente</div>

            <h1 style={title}>
              {nombreCliente(cliente)}
            </h1>

            <p style={subtitle}>
              Vista completa del lead, su calificación,
              cita, próxima acción e historial comercial.
            </p>
          </div>

          <div style={headerActions}>
            <a href="#registrar-seguimiento" style={primaryButton}>
              Registrar seguimiento
            </a>

            <Link
              href="/asesores/clientes"
              style={secondaryButton}
            >
              Volver a clientes
            </Link>
          </div>
        </div>

        {mensaje && <div style={success}>{mensaje}</div>}

        {error && <div style={alert}>{error}</div>}

        <div style={summaryGrid}>
          <article style={mainCard}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Datos principales</h2>

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

            <div style={dataGrid}>
              <Info label="DNI" value={cliente.dni || "-"} />
              <Info
                label="WhatsApp"
                value={cliente.celular || "-"}
              />
              <Info
                label="Correo"
                value={cliente.correo || "-"}
              />
              <Info
                label="Fuente"
                value={cliente.fuente || "-"}
              />
              <Info
                label="Dirección"
                value={cliente.direccion || "-"}
              />
              <Info
                label="Registro"
                value={formatearFechaHora(
                  cliente.created_at
                )}
              />
            </div>

            {cliente.observaciones && (
              <div style={noteBox}>
                <strong>Observaciones:</strong>
                <p>{cliente.observaciones}</p>
              </div>
            )}
          </article>

          <article style={sideCard}>
            <h2 style={cardTitle}>Estado comercial</h2>

            <div style={scoreBox}>
              <span>Puntaje lead</span>
              <strong>
                {cliente.puntaje_lead ?? 0}/100
              </strong>
            </div>

            <Info
              label="Estado"
              value={etiquetaEstadoLead(
                cliente.estado_lead
              )}
            />

            <Info
              label="Próxima acción"
              value={etiquetaProximaAccion(
                cliente.proxima_accion
              )}
            />

            <Info
              label="Próximo seguimiento"
              value={formatearFechaLocal(
                cliente.fecha_proximo_seguimiento
              )}
            />
          </article>
        </div>

        <div style={sectionGrid}>
          <article style={card}>
            <h2 style={cardTitle}>Calificación del lead</h2>

            <div style={dataGrid}>
              <Info
                label="Inicial"
                value={etiquetaSituacionInicial(
                  cliente.situacion_inicial
                )}
              />

              <Info
                label="Capacidad de cuota"
                value={etiquetaCapacidadCuota(
                  cliente.capacidad_cuota
                )}
              />

              <Info
                label="Tiempo de decisión"
                value={etiquetaTiempoDecision(
                  cliente.tiempo_decision
                )}
              />

              <Info
                label="Intención"
                value={etiquetaIntencionCompra(
                  cliente.intencion_compra
                )}
              />

              <Info
                label="Canal preferido"
                value={etiquetaCanalPreferido(
                  cliente.canal_preferido
                )}
              />

              <Info
                label="Objeción principal"
                value={cliente.objecion_principal || "-"}
              />
            </div>
          </article>

          <article style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Cita</h2>

              {(cliente.estado_cita === "CITA_SOLICITADA" ||
                cliente.estado_cita === "CITA_PROGRAMADA") && (
                <button
                  type="button"
                  onClick={iniciarProgramarCita}
                  style={smallGoldButton}
                >
                  {cliente.estado_cita === "CITA_PROGRAMADA"
                    ? "Reprogramar cita"
                    : "Programar cita"}
                </button>
              )}
            </div>

            <div style={dataGrid}>
              <Info
                label="Estado cita"
                value={etiquetaEstadoCita(
                  cliente.estado_cita
                )}
              />

              <Info
                label="Fecha"
                value={formatearFechaLocal(
                  cliente.fecha_cita
                )}
              />

              <Info
                label="Hora"
                value={cliente.hora_cita || "-"}
              />
            </div>

            {cliente.estado_cita === "CITA_SOLICITADA" && (
              <div style={warningBox}>
                Este cliente solicitó cita, pero aún falta
                programar fecha y hora.
              </div>
            )}

            {citaEditando && (
              <div style={citaEditor}>
                <label style={miniLabel}>
                  Fecha de cita
                  <input
                    type="date"
                    min={obtenerFechaHoyISO()}
                    value={citaEditando.fechaCita}
                    onChange={(event) =>
                      actualizarCitaEditando(
                        "fechaCita",
                        event.target.value
                      )
                    }
                    style={miniInput}
                  />
                </label>

                <label style={miniLabel}>
                  Hora pactada
                  <input
                    type="text"
                    placeholder="Ejemplo: 4:00 p. m."
                    value={citaEditando.horaCita}
                    onChange={(event) =>
                      actualizarCitaEditando(
                        "horaCita",
                        event.target.value
                      )
                    }
                    style={miniInput}
                  />
                </label>

                <div style={miniActions}>
                  <button
                    type="button"
                    disabled={programandoCita}
                    onClick={guardarProgramacionCita}
                    style={primaryMiniButton}
                  >
                    {programandoCita
                      ? "Guardando..."
                      : "Guardar cita"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCitaEditando(null)}
                    style={secondaryMiniButton}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </article>

          <article style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Historial de separaciones del cliente</h2>
            </div>

            {separacionesConLote.length === 0 ? (
              <div style={emptyBox}>
                Este cliente aún no tiene historial de separaciones.
              </div>
            ) : (
              <div style={separacionesList}>
                {separacionesConLote.map(({ separacion, lote }) => (
                  <div key={separacion.id} style={separacionItem}>
                    <div style={separacionHeader}>
                      <strong>
                        {lote
                          ? `MZ ${lote.mz} - Lote ${lote.lote}`
                          : "Lote no encontrado"}
                      </strong>

                      <span style={separacionBadge}>
                        {separacion.estado}
                      </span>
                    </div>

                    <div style={miniGrid}>
                      <div style={miniInfo}>
                        <span>Monto</span>
                        <strong>
                          {formatearMoneda(
                            Number(separacion.monto_separacion || 0)
                          )}
                        </strong>
                      </div>

                      <div style={miniInfo}>
                        <span>Vence</span>
                        <strong>
                          {formatearFechaLocal(separacion.fecha_limite)}
                        </strong>
                      </div>

                      <div style={miniInfo}>
                        <span>Registro</span>
                        <strong>
                          {formatearFechaLocal(separacion.created_at)}
                        </strong>
                      </div>
                    </div>

                    {separacion.liberacion_solicitada && (
                      <div style={warningBox}>
                        Liberación solicitada.
                        {separacion.motivo_liberacion && (
                          <>
                            <br />
                            Motivo: {separacion.motivo_liberacion}
                          </>
                        )}
                      </div>
                    )}

                    <div style={loteActions}>
                      {lote && (
                        <a
                          href={`/asesores/lotes?lote=${lote.id}`}
                          style={secondaryMiniLink}
                        >
                          Ver lote
                        </a>
                      )}

                      <a
                        href={`/asesores/separaciones?separacion=${separacion.id}`}
                        style={secondaryMiniLink}
                      >
                        Ver separación
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Nuevo lote de interés</h2>

              {loteInteres && (
                <span style={loteEstadoBadge}>
                  {loteInteres.estado}
                </span>
              )}
            </div>

            {loteInteres ? (
              <div style={dataGrid}>
                <Info label="Manzana" value={loteInteres.mz} />

                <Info
                  label="Lote"
                  value={String(loteInteres.lote)}
                />

                <Info
                  label="Área"
                  value={formatearArea(loteInteres.area)}
                />

                <Info
                  label="Precio"
                  value={formatearMoneda(loteInteres.precio)}
                />

                <Info
                  label="Estado"
                  value={loteInteres.estado}
                />
              </div>
            ) : (
              <div style={emptyBox}>
                Este cliente aún no tiene un nuevo lote de interés asignado.
              </div>
            )}

            <div style={loteEditor}>
              {loteInteresNoDisponible && (
                <div style={warningBox}>
                  Este lote ya no está disponible. Estado actual:{" "}
                  <strong>{loteInteres.estado}</strong>. Puedes quitarlo o
                  cambiarlo por un lote disponible.
                </div>
              )}

              <label style={miniLabel}>
                Asignar o cambiar lote de interés
                <select
                  value={
                    loteInteresNoDisponible
                      ? ""
                      : loteInteresEditando
                  }
                  onChange={(event) =>
                    setLoteInteresEditando(event.target.value)
                  }
                  style={miniInput}
                >
                  <option value="">Selecciona un lote disponible</option>

                  {lotesDisponibles.map((lote) => (
                    <option key={lote.id} value={String(lote.id)}>
                      Mz {lote.mz} - Lote {lote.lote} |{" "}
                      {formatearArea(lote.area)} |{" "}
                      {formatearMoneda(lote.precio)} |{" "}
                      {lote.estado}
                    </option>
                  ))}
                </select>
              </label>

              <div style={loteActions}>
                <button
                  type="button"
                  disabled={guardandoLoteInteres}
                  onClick={guardarLoteInteres}
                  style={primaryMiniButton}
                >
                  {guardandoLoteInteres
                    ? "Guardando..."
                    : "Guardar lote de interés"}
                </button>

                {loteInteres &&
                  (loteInteresTieneSeparacion ? (
                    <button
                      type="button"
                      disabled
                      style={{
                        ...dangerMiniButton,
                        opacity: 0.45,
                        cursor: "not-allowed",
                      }}
                    >
                      Quitar lote bloqueado
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={guardandoLoteInteres}
                      onClick={quitarLoteInteres}
                      style={dangerMiniButton}
                    >
                      Quitar lote
                    </button>
                  ))}

                {loteInteres && (
                  <a
                    href={`/asesores/lotes?lote=${loteInteres.id}`}
                    style={secondaryMiniLink}
                  >
                    Ver lote
                  </a>
                )}
              </div>

              {loteInteresTieneSeparacion && (
                <div style={warningBox}>
                  Este lote ya tiene una separación activa o no está disponible.
                  Para liberarlo, primero debes anular la separación desde el
                  módulo Separaciones. No se puede quitar directamente desde
                  la ficha del cliente.
                </div>
              )}

              {loteInteres && loteInteres.estado === "DISPONIBLE" && (
                <div style={separarBox}>
                  <div>
                    <strong>Este lote está disponible.</strong>
                    <p>
                      Puedes crear una separación directamente desde la
                      ficha del cliente.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={iniciarSeparacionLote}
                    style={separarButton}
                  >
                    Separar este lote
                  </button>
                </div>
              )}

              
              {separacionEditando && (
                <div style={separacionEditor}>
                  <label style={miniLabel}>
                    Monto de separación
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ejemplo: 500"
                      value={separacionEditando.monto}
                      onChange={(event) =>
                        actualizarSeparacionEditando(
                          "monto",
                          event.target.value
                        )
                      }
                      style={miniInput}
                    />
                  </label>

                  <label style={miniLabel}>
                    Fecha límite
                    <input
                      type="date"
                      min={obtenerFechaHoyISO()}
                      value={separacionEditando.fechaLimite}
                      onChange={(event) =>
                        actualizarSeparacionEditando(
                          "fechaLimite",
                          event.target.value
                        )
                      }
                      style={miniInput}
                    />
                  </label>

                  <label style={miniLabel}>
                    Observaciones
                    <textarea
                      value={separacionEditando.observaciones}
                      onChange={(event) =>
                        actualizarSeparacionEditando(
                          "observaciones",
                          event.target.value
                        )
                      }
                      style={miniTextarea}
                    />
                  </label>

                  <div style={miniActions}>
                    <button
                      type="button"
                      disabled={separandoLote}
                      onClick={crearSeparacionDesdeFicha}
                      style={primaryMiniButton}
                    >
                      {separandoLote
                        ? "Separando..."
                        : "Confirmar separación"}
                    </button>

                    <button
                      type="button"
                      disabled={separandoLote}
                      onClick={() => setSeparacionEditando(null)}
                      style={secondaryMiniButton}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>

        <article id="registrar-seguimiento" style={card}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Registrar seguimiento</h2>
              <p style={smallText}>
                Agrega una llamada, WhatsApp, visita o recordatorio comercial.
              </p>
            </div>
          </div>

          <div style={seguimientoFormGrid}>
            <label style={miniLabel}>
              Tipo de contacto
              <select
                value={seguimientoEditando.tipoContacto}
                onChange={(event) =>
                  actualizarSeguimiento(
                    "tipoContacto",
                    event.target.value
                  )
                }
                style={miniInput}
              >
                {tiposContacto.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={miniLabel}>
              Resultado
              <select
                value={seguimientoEditando.resultado}
                onChange={(event) =>
                  actualizarSeguimiento(
                    "resultado",
                    event.target.value
                  )
                }
                style={miniInput}
              >
                {resultadosSeguimiento.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={miniLabel}>
              Próximo seguimiento
              <input
                type="date"
                min={obtenerFechaHoyISO()}
                value={
                  seguimientoEditando.fechaProximoSeguimiento
                }
                onChange={(event) =>
                  actualizarSeguimiento(
                    "fechaProximoSeguimiento",
                    event.target.value
                  )
                }
                style={miniInput}
              />
            </label>
          </div>

          <label style={miniLabel}>
            Comentario
            <textarea
              placeholder="Ejemplo: Cliente pidió ubicación, disponibilidad y condiciones de separación."
              value={seguimientoEditando.comentario}
              onChange={(event) =>
                actualizarSeguimiento(
                  "comentario",
                  event.target.value
                )
              }
              style={miniTextarea}
            />
          </label>

          <div style={miniActions}>
            <button
              type="button"
              disabled={guardandoSeguimiento}
              onClick={guardarSeguimientoCliente}
              style={primaryMiniButton}
            >
              {guardandoSeguimiento
                ? "Guardando..."
                : "Guardar seguimiento"}
            </button>
          </div>
        </article>

        <article style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>
              Historial comercial
            </h2>

            <span style={historyCount}>
              {seguimientos.length}
            </span>
          </div>

          {seguimientos.length === 0 ? (
            <div style={emptyBox}>
              Este cliente aún no tiene seguimientos
              registrados.
            </div>
          ) : (
            <div style={historyList}>
              {seguimientos.map((seguimiento) => (
                <div
                  key={seguimiento.id}
                  style={historyItem}
                >
                  <div style={historyTop}>
                    <strong>
                      {etiquetaTipoContacto(
                        seguimiento.tipo_contacto
                      )}{" "}
                      ·{" "}
                      {etiquetaResultadoSeguimiento(
                        seguimiento.resultado
                      )}
                    </strong>

                    <span>
                      {formatearFechaHora(
                        seguimiento.created_at
                      )}
                    </span>
                  </div>

                  {seguimiento.comentario && (
                    <p style={historyComment}>
                      {seguimiento.comentario}
                    </p>
                  )}

                  {seguimiento.fecha_proximo_seguimiento && (
                    <div style={nextFollowBox}>
                      Próximo seguimiento:{" "}
                      {formatearFechaLocal(
                        seguimiento.fecha_proximo_seguimiento
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </AsesorLayout>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 22,
};

const eyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const title: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: 34,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: 15,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  borderRadius: 12,
  padding: "0 14px",
  background: "#2f7d46",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
};

const secondaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  borderRadius: 12,
  padding: "0 14px",
  background: "#f8fafc",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
};

const backButton: React.CSSProperties = {
  ...secondaryButton,
  marginTop: 14,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)",
  gap: 16,
  marginBottom: 16,
};

const sectionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 16,
  marginBottom: 16,
};

const mainCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const sideCard: React.CSSProperties = {
  ...mainCard,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  ...mainCard,
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 21,
  fontWeight: 950,
};

const dataGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const infoBox: React.CSSProperties = {
  borderRadius: 13,
  background: "#f8fafc",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  color: "#334155",
};

const scoreBox: React.CSSProperties = {
  borderRadius: 16,
  background: "#fff3d6",
  color: "#8a5a00",
  padding: 16,
  display: "grid",
  gap: 4,
};

const leadBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const noteBox: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 14,
  background: "#f8fafc",
  padding: 12,
  color: "#334155",
};

const warningBox: React.CSSProperties = {
  marginTop: 12,
  borderRadius: 14,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  padding: 12,
  fontWeight: 800,
  lineHeight: 1.45,
};

const historyCount: React.CSSProperties = {
  minWidth: 38,
  height: 38,
  borderRadius: 999,
  background: "#eef6ff",
  color: "#244d77",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
};

const historyList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const historyItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderLeft: "4px solid #dbeafe",
  borderRadius: 14,
  padding: 14,
  background: "#fafaf8",
};

const historyTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#0f172a",
};

const historyComment: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#334155",
  lineHeight: 1.45,
};

const nextFollowBox: React.CSSProperties = {
  marginTop: 10,
  display: "inline-flex",
  borderRadius: 999,
  background: "#eef6ff",
  color: "#244d77",
  padding: "6px 10px",
  fontSize: 12,
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

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 16,
  borderRadius: 14,
  fontWeight: 800,
};

const success: React.CSSProperties = {
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const smallGoldButton: React.CSSProperties = {
  border: "1px solid #d8a930",
  background: "#fff3d6",
  color: "#7a4b12",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const citaEditor: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  border: "1px solid #eed28a",
  background: "#fffaf0",
  padding: 14,
  display: "grid",
  gap: 10,
};

const miniLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const miniInput: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
};

const miniActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryMiniButton: React.CSSProperties = {
  border: "none",
  background: "#2f7d46",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryMiniButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
};
const smallText: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const seguimientoFormGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
  marginBottom: 12,
};

const miniTextarea: React.CSSProperties = {
  ...miniInput,
  minHeight: 90,
  resize: "vertical",
};
const loteEstadoBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  background: "#eef6ff",
  color: "#244d77",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const loteEditor: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  border: "1px solid #dbeafe",
  background: "#f8fafc",
  padding: 14,
  display: "grid",
  gap: 10,
};

const loteActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const dangerMiniButton: React.CSSProperties = {
  border: "1px solid #f3c7c0",
  background: "#fff1ef",
  color: "#8b2f25",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryMiniLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #c7ddf4",
  background: "#f8fafc",
  color: "#244d77",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 900,
  textDecoration: "none",
};

const separarBox: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
  padding: 14,
  display: "grid",
  gap: 10,
};

const separarButton: React.CSSProperties = {
  border: "none",
  background: "#2f7d46",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 14px",
  fontWeight: 950,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
};

const separacionEditor: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  border: "1px solid #c9e7d2",
  background: "#f6fbf7",
  padding: 14,
  display: "grid",
  gap: 10,
};
const separacionesList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const separacionItem: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const separacionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const separacionBadge: React.CSSProperties = {
  borderRadius: 999,
  background: "#f8ead0",
  color: "#8a4b00",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 950,
};

const miniGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const miniInfo: React.CSSProperties = {
  borderRadius: 12,
  background: "#f8fafc",
  padding: 10,
  display: "grid",
  gap: 4,
  color: "#1f2937",
};
