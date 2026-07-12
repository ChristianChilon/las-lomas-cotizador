"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  CONFIGURACION_COMERCIAL_BASE,
  type ConfiguracionComercial,
} from "../../lib/comercial";
import { crearPdfCotizacion } from "../../lib/cotizacionPdf";
import {
  ESTADOS_COTIZACION,
  LOTES_TABLE,
  esGerencia,
  etiquetaEstadoCotizacion,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type Cotizacion,
  type LoteCrm,
  type Profile,
} from "../../lib/crm";
import { supabase } from "../../lib/supabase";

type FormCotizacion = {
  clienteId: string;
  loteId: string;
  asesorId: string;
  precioOfertado: string;
  montoSeparacion: string;
  inicial: string;
  meses: string;
  validaHasta: string;
  observaciones: string;
  cotizacionAnteriorId: string;
};

const fechaIso = (fecha: Date) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sumarDias = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fechaIso(fecha);
};

const formVacio = (
  configuracion: ConfiguracionComercial,
  profile?: Profile | null
): FormCotizacion => ({
  clienteId: "",
  loteId: "",
  asesorId: profile?.role === "asesor" ? profile.id : "",
  precioOfertado: "",
  montoSeparacion: String(configuracion.monto_separacion_referencial),
  inicial: String(configuracion.inicial_minima),
  meses: "24",
  validaHasta: sumarDias(configuracion.vigencia_cotizacion_dias),
  observaciones: "",
  cotizacionAnteriorId: "",
});

const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";

  bytes.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });

  return btoa(binario);
};

const fechaLegible = (valor: string | null | undefined) => {
  if (!valor) return "-";
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(fecha);
};

const estadoVisual = (cotizacion: Cotizacion) => {
  if (
    ["BORRADOR", "ENVIADA"].includes(cotizacion.estado) &&
    cotizacion.valida_hasta < fechaIso(new Date())
  ) {
    return "VENCIDA";
  }

  return cotizacion.estado;
};

const colorEstado = (estado: string) => {
  switch (estado) {
    case "ENVIADA":
      return { bg: "#e8f0ff", fg: "#1d4ed8" };
    case "ACEPTADA":
      return { bg: "#e5f4e9", fg: "#17603a" };
    case "CONVERTIDA":
      return { bg: "#d8efe3", fg: "#0b5132" };
    case "RECHAZADA":
    case "ANULADA":
      return { bg: "#f3f4f6", fg: "#4b5563" };
    case "VENCIDA":
      return { bg: "#fee2e2", fg: "#991b1b" };
    case "PENDIENTE_APROBACION":
      return { bg: "#fff0c2", fg: "#7a4b00" };
    case "REEMPLAZADA":
      return { bg: "#f0e9ff", fg: "#6b3fa0" };
    default:
      return { bg: "#fff3d6", fg: "#805100" };
  }
};

export default function CotizacionesTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionComercial>(CONFIGURACION_COMERCIAL_BASE);
  const [form, setForm] = useState<FormCotizacion>(() =>
    formVacio(CONFIGURACION_COMERCIAL_BASE)
  );
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [consultaProcesada, setConsultaProcesada] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const modoGerencia = esGerencia(profile);

  const cargar = useCallback(async (silencioso = false) => {
    if (!supabase) return;
    if (!silencioso) setCargando(true);

    const perfil = await obtenerPerfilActual();
    if (!perfil.profile) {
      setError(perfil.error || "No se pudo cargar el perfil.");
      setCargando(false);
      return;
    }

    setProfile(perfil.profile);

    const [cotizacionesRes, clientesRes, lotesRes, perfilesRes, configRes] =
      await Promise.all([
        supabase
          .from("cotizaciones")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes")
          .select(
            "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,lote_interes_id,created_at,updated_at"
          )
          .order("nombres", { ascending: true }),
        supabase
          .from(LOTES_TABLE)
          .select(
            "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
          )
          .order("mz", { ascending: true })
          .order("lote", { ascending: true }),
        supabase
          .from("profiles")
          .select("id,full_name,email,role,phone,active")
          .eq("role", "asesor")
          .eq("active", true),
        supabase
          .from("configuracion_comercial")
          .select("*")
          .eq("project_key", "las_lomas")
          .maybeSingle(),
      ]);

    if (cotizacionesRes.error) {
      setError(
        cotizacionesRes.error.message.includes("cotizaciones")
          ? "Ejecuta 012_crm_cotizaciones_comerciales.sql en Supabase para activar este modulo."
          : cotizacionesRes.error.message
      );
      setCargando(false);
      return;
    }

    if (clientesRes.error || lotesRes.error) {
      setError(clientesRes.error?.message || lotesRes.error?.message || "No se pudieron cargar los datos.");
      setCargando(false);
      return;
    }

    const nuevaConfiguracion = configRes.data
      ? ({
          ...CONFIGURACION_COMERCIAL_BASE,
          ...configRes.data,
        } as ConfiguracionComercial)
      : CONFIGURACION_COMERCIAL_BASE;

    setCotizaciones((cotizacionesRes.data || []) as Cotizacion[]);
    setClientes((clientesRes.data || []) as Cliente[]);
    setLotes((lotesRes.data || []) as LoteCrm[]);
    setAsesores((perfilesRes.data || []) as Profile[]);
    setConfiguracion(nuevaConfiguracion);
    setForm((actual) =>
      actual.clienteId || actual.loteId || actual.cotizacionAnteriorId
        ? actual
        : formVacio(nuevaConfiguracion, perfil.profile)
    );
    setError(null);
    setCargando(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => cargar());
  }, [cargar]);

  useEffect(() => {
    if (!supabase) return;
    const cliente = supabase;
    const canal = cliente
      .channel("crm_cotizaciones_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cotizaciones" },
        () => void cargar(true)
      )
      .subscribe();

    return () => {
      void cliente.removeChannel(canal);
    };
  }, [cargar]);

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

  const lotesCotizables = useMemo(
    () =>
      lotes.filter(
        (lote) =>
          ["DISPONIBLE", "EN_NEGOCIACION"].includes(lote.estado) &&
          (modoGerencia || !lote.asesor_id || lote.asesor_id === profile?.id)
      ),
    [lotes, modoGerencia, profile]
  );

  const loteForm = lotesPorId.get(Number(form.loteId));
  const precioLista = Number(loteForm?.precio || 0);
  const precioOfertado = Number(form.precioOfertado || 0);
  const inicial = Number(form.inicial || 0);
  const meses = Math.max(Number(form.meses || 0), 1);
  const descuentoMonto = Math.max(precioLista - precioOfertado, 0);
  const descuentoPorcentaje = precioLista
    ? (descuentoMonto / precioLista) * 100
    : 0;
  const saldo = Math.max(precioOfertado - inicial, 0);
  const cuota = saldo / meses;

  const cotizacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return cotizaciones.filter((cotizacion) => {
      const estado = estadoVisual(cotizacion);
      if (filtroEstado !== "TODOS" && estado !== filtroEstado) return false;
      if (!texto) return true;

      const cliente = clientesPorId.get(cotizacion.cliente_id);
      const lote = lotesPorId.get(cotizacion.lote_id);

      return [
        cotizacion.numero,
        nombreCliente(cliente),
        cliente?.celular,
        lote?.mz,
        lote?.lote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, clientesPorId, cotizaciones, filtroEstado, lotesPorId]);

  const resumen = useMemo(
    () => ({
      total: cotizaciones.length,
      enviadas: cotizaciones.filter((item) => estadoVisual(item) === "ENVIADA").length,
      aceptadas: cotizaciones.filter((item) => estadoVisual(item) === "ACEPTADA").length,
      vencidas: cotizaciones.filter((item) => estadoVisual(item) === "VENCIDA").length,
    }),
    [cotizaciones]
  );

  useEffect(() => {
    if (consultaProcesada || cargando || lotes.length === 0 || !profile) return;
    const timer = window.setTimeout(() => {
      if (searchParams.get("nueva") !== "1") {
        setConsultaProcesada(true);
        return;
      }

      const loteId = Number(searchParams.get("lote"));
      const lote = lotesPorId.get(loteId);
      const clienteId = searchParams.get("cliente") || "";
      const cliente = clientesPorId.get(clienteId);
      const mesesUrl = Number(searchParams.get("meses") || 24);
      const inicialUrl = Number(
        searchParams.get("inicial") || configuracion.inicial_minima
      );

      setForm({
        ...formVacio(configuracion, profile),
        clienteId: cliente ? cliente.id : "",
        asesorId:
          modoGerencia && cliente?.asesor_id
            ? cliente.asesor_id
            : profile.id,
        loteId: lote ? String(lote.id) : "",
        precioOfertado: lote ? String(lote.precio) : "",
        inicial: String(Math.max(0, inicialUrl)),
        meses: String(Math.min(60, Math.max(1, mesesUrl))),
      });
      setMostrarFormulario(true);
      setConsultaProcesada(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    cargando,
    clientesPorId,
    configuracion,
    consultaProcesada,
    lotes.length,
    lotesPorId,
    modoGerencia,
    profile,
    searchParams,
  ]);

  const actualizarForm = (campo: keyof FormCotizacion, valor: string) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  };

  const seleccionarCliente = (clienteId: string) => {
    const cliente = clientesPorId.get(clienteId);
    setForm((actual) => ({
      ...actual,
      clienteId,
      asesorId:
        modoGerencia && cliente?.asesor_id
          ? cliente.asesor_id
          : actual.asesorId || profile?.id || "",
    }));
  };

  const seleccionarLote = (loteId: string) => {
    const lote = lotesPorId.get(Number(loteId));
    setForm((actual) => ({
      ...actual,
      loteId,
      precioOfertado: lote ? String(lote.precio) : "",
    }));
  };

  const abrirNueva = (anterior?: Cotizacion) => {
    setError(null);
    setMensaje(null);

    if (anterior) {
      setForm({
        clienteId: anterior.cliente_id,
        loteId: String(anterior.lote_id),
        asesorId: anterior.asesor_id,
        precioOfertado: String(anterior.precio_ofertado),
        montoSeparacion: String(anterior.monto_separacion),
        inicial: String(anterior.inicial),
        meses: String(anterior.meses),
        validaHasta: sumarDias(configuracion.vigencia_cotizacion_dias),
        observaciones: anterior.observaciones || "",
        cotizacionAnteriorId: anterior.id,
      });
    } else {
      setForm(formVacio(configuracion, profile));
    }

    setMostrarFormulario(true);
  };

  const guardarCotizacion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !profile) return;

    if (!form.clienteId || !form.loteId) {
      setError("Selecciona cliente y lote.");
      return;
    }

    if (!form.asesorId) {
      setError("Selecciona el asesor responsable.");
      return;
    }

    if (precioOfertado <= 0 || precioOfertado > precioLista) {
      setError("Revisa el precio ofertado.");
      return;
    }

    setGuardando(true);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc("crm_crear_cotizacion", {
      p_cliente_id: form.clienteId,
      p_lote_id: Number(form.loteId),
      p_precio_ofertado: precioOfertado,
      p_monto_separacion: Number(form.montoSeparacion || 0),
      p_inicial: inicial,
      p_meses: meses,
      p_valida_hasta: form.validaHasta,
      p_observaciones: form.observaciones.trim() || null,
      p_asesor_id: form.asesorId,
      p_cotizacion_anterior_id: form.cotizacionAnteriorId || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        form.cotizacionAnteriorId
          ? "Nueva version creada correctamente."
          : "Cotizacion creada correctamente."
      );
      setMostrarFormulario(false);
      await cargar(true);
    }

    setGuardando(false);
  };

  const actualizarEstado = async (cotizacion: Cotizacion, estado: string) => {
    if (!supabase) return false;
    setProcesando(cotizacion.id);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_actualizar_estado_cotizacion",
      { p_cotizacion_id: cotizacion.id, p_estado: estado }
    );

    if (rpcError) {
      setError(rpcError.message);
      setProcesando(null);
      return false;
    }

    setMensaje(`Cotizacion ${etiquetaEstadoCotizacion(estado).toLowerCase()}.`);
    await cargar(true);
    setProcesando(null);
    return true;
  };

  const datosPdf = (cotizacion: Cotizacion) => {
    const cliente = clientesPorId.get(cotizacion.cliente_id);
    const lote = lotesPorId.get(cotizacion.lote_id);
    const asesor = asesoresPorId.get(cotizacion.asesor_id);

    if (!cliente || !lote) return null;

    return {
      numero: cotizacion.numero,
      version: cotizacion.version,
      fechaEmision: cotizacion.created_at.slice(0, 10),
      validaHasta: cotizacion.valida_hasta,
      cliente: nombreCliente(cliente),
      dni: cliente.dni,
      celular: cliente.celular,
      correo: cliente.correo,
      manzana: lote.mz,
      lote: lote.lote,
      area: Number(lote.area),
      precioLista: Number(cotizacion.precio_lista),
      precioOfertado: Number(cotizacion.precio_ofertado),
      descuentoMonto: Number(cotizacion.descuento_monto),
      descuentoPorcentaje: Number(cotizacion.descuento_porcentaje),
      montoSeparacion: Number(cotizacion.monto_separacion),
      inicial: Number(cotizacion.inicial),
      saldoFinanciar: Number(cotizacion.saldo_financiar),
      meses: Number(cotizacion.meses),
      cuotaMensual: Number(cotizacion.cuota_mensual),
      asesor: asesor?.full_name || asesor?.email || "Asesor comercial",
      telefonoAsesor: asesor?.phone,
      observaciones: cotizacion.observaciones,
    };
  };

  const obtenerPdf = (cotizacion: Cotizacion) => {
    const datos = datosPdf(cotizacion);
    if (!datos) {
      setError("No se pudo relacionar la cotizacion con su cliente o lote.");
      return null;
    }
    return crearPdfCotizacion(datos);
  };

  const nombrePdf = (cotizacion: Cotizacion) =>
    `${cotizacion.numero.toLowerCase()}-v${cotizacion.version}.pdf`;

  const descargarPdf = (cotizacion: Cotizacion) => {
    const pdf = obtenerPdf(cotizacion);
    if (!pdf) return;
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = nombrePdf(cotizacion);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const imprimirPdf = (cotizacion: Cotizacion) => {
    const pdf = obtenerPdf(cotizacion);
    if (!pdf) return;
    const url = URL.createObjectURL(pdf);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow?.print();
    };
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };

  const enviarCorreo = async (cotizacion: Cotizacion) => {
    const cliente = clientesPorId.get(cotizacion.cliente_id);
    const pdf = obtenerPdf(cotizacion);
    if (!cliente?.correo || !pdf) {
      setError("El cliente no tiene un correo registrado.");
      return;
    }

    setProcesando(cotizacion.id);
    setError(null);

    const response = await fetch("/api/enviar-ficha-separacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: cliente.correo,
        fileName: nombrePdf(cotizacion),
        pdfBase64: await blobToBase64(pdf),
        subject: `${cotizacion.numero} | Cotizacion Las Lomas de Malabrigo`,
        message:
          "Adjuntamos la cotizacion comercial solicitada. La disponibilidad del lote se confirma al formalizar la separacion.",
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error || "No se pudo enviar la cotizacion por correo.");
      setProcesando(null);
      return;
    }

    if (cotizacion.estado === "BORRADOR") {
      await actualizarEstado(cotizacion, "ENVIADA");
    } else {
      setMensaje("Cotizacion enviada por correo.");
      setProcesando(null);
    }
  };

  const enviarWhatsApp = async (cotizacion: Cotizacion) => {
    const cliente = clientesPorId.get(cotizacion.cliente_id);
    const lote = lotesPorId.get(cotizacion.lote_id);
    const celular = String(cliente?.celular || "").replace(/\D/g, "");

    if (!celular || !lote) {
      setError("El cliente no tiene un celular valido.");
      return;
    }

    const numero = celular.length === 9 ? `51${celular}` : celular;
    const mensajeWhatsapp = [
      `Hola ${cliente?.nombres || ""}, te envio la propuesta ${cotizacion.numero}.`,
      `Lote MZ ${lote.mz} - ${lote.lote}, ${formatearArea(lote.area)}.`,
      `Precio propuesto: ${formatearMoneda(cotizacion.precio_ofertado)}.`,
      `Inicial: ${formatearMoneda(cotizacion.inicial)} y ${cotizacion.meses} cuotas de ${formatearMoneda(cotizacion.cuota_mensual)}.`,
      `Vigente hasta ${fechaLegible(cotizacion.valida_hasta)}.`,
    ].join("\n");

    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsapp)}`,
      "_blank",
      "noopener,noreferrer"
    );

    if (cotizacion.estado === "BORRADOR") {
      await actualizarEstado(cotizacion, "ENVIADA");
    }
  };

  const iniciarSeparacion = (cotizacion: Cotizacion) => {
    router.push(
      `/asesores/lotes?separar=${cotizacion.lote_id}&cliente=${cotizacion.cliente_id}&cotizacion=${cotizacion.id}`
    );
  };

  if (cargando) {
    return <div style={infoBanner}>Cargando cotizaciones...</div>;
  }

  return (
    <section>
      {error && <div style={errorBanner}>{error}</div>}
      {mensaje && <div style={successBanner}>{mensaje}</div>}

      <div style={toolbar}>
        <div>
          <strong style={toolbarTitle}>Propuestas comerciales</strong>
          <p style={toolbarText}>
            Una cotizacion no reserva el lote. La disponibilidad cambia solo al completar la separacion.
          </p>
        </div>
        <button type="button" style={primaryButton} onClick={() => abrirNueva()}>
          Nueva cotizacion
        </button>
      </div>

      <div style={summaryGrid}>
        <Resumen label="Total" value={resumen.total} />
        <Resumen label="Enviadas" value={resumen.enviadas} />
        <Resumen label="Aceptadas" value={resumen.aceptadas} />
        <Resumen label="Vencidas" value={resumen.vencidas} danger={resumen.vencidas > 0} />
      </div>

      <div style={filters}>
        <input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar numero, cliente, celular, MZ o lote"
          style={input}
        />
        <select
          value={filtroEstado}
          onChange={(event) => setFiltroEstado(event.target.value)}
          style={input}
        >
          <option value="TODOS">Todos los estados</option>
          {ESTADOS_COTIZACION.map((estado) => (
            <option key={estado} value={estado}>
              {etiquetaEstadoCotizacion(estado)}
            </option>
          ))}
        </select>
        <button
          type="button"
          style={secondaryButton}
          onClick={() => {
            setBusqueda("");
            setFiltroEstado("TODOS");
          }}
        >
          Limpiar
        </button>
      </div>

      <div style={quotesGrid}>
        {cotizacionesFiltradas.map((cotizacion) => {
          const cliente = clientesPorId.get(cotizacion.cliente_id);
          const lote = lotesPorId.get(cotizacion.lote_id);
          const asesor = asesoresPorId.get(cotizacion.asesor_id);
          const estado = estadoVisual(cotizacion);
          const color = colorEstado(estado);
          const ocupado = procesando === cotizacion.id;

          return (
            <article key={cotizacion.id} style={quoteCard}>
              <div style={quoteHeader}>
                <div>
                  <strong style={quoteNumber}>{cotizacion.numero}</strong>
                  <span style={muted}>Version {cotizacion.version}</span>
                </div>
                <span style={{ ...statusBadge, background: color.bg, color: color.fg }}>
                  {etiquetaEstadoCotizacion(estado)}
                </span>
              </div>

              <div style={quoteBodyGrid}>
                <div>
                  <span style={label}>Cliente</span>
                  <strong>{nombreCliente(cliente) || "-"}</strong>
                  <span style={muted}>{cliente?.celular || "Sin celular"}</span>
                </div>
                <div>
                  <span style={label}>Lote</span>
                  <strong>{lote ? `MZ ${lote.mz} - Lote ${lote.lote}` : "-"}</strong>
                  <span style={muted}>{lote ? formatearArea(lote.area) : ""}</span>
                </div>
                <div>
                  <span style={label}>Precio propuesto</span>
                  <strong style={money}>{formatearMoneda(cotizacion.precio_ofertado)}</strong>
                  <span style={muted}>Descuento {Number(cotizacion.descuento_porcentaje).toFixed(2)}%</span>
                </div>
                <div>
                  <span style={label}>Financiamiento</span>
                  <strong>{cotizacion.meses} cuotas de {formatearMoneda(cotizacion.cuota_mensual)}</strong>
                  <span style={muted}>Inicial {formatearMoneda(cotizacion.inicial)}</span>
                </div>
              </div>

              <div style={quoteMeta}>
                <span>Vence: <strong>{fechaLegible(cotizacion.valida_hasta)}</strong></span>
                <span>Asesor: <strong>{asesor?.full_name || asesor?.email || "-"}</strong></span>
              </div>

              <div style={actions}>
                <button type="button" style={smallButton} onClick={() => descargarPdf(cotizacion)}>
                  PDF
                </button>
                <button type="button" style={smallButton} onClick={() => imprimirPdf(cotizacion)}>
                  Imprimir
                </button>
                {estado !== "PENDIENTE_APROBACION" && (
                  <>
                    <button type="button" style={smallButton} disabled={ocupado} onClick={() => void enviarCorreo(cotizacion)}>
                      Correo
                    </button>
                    <button type="button" style={smallButton} disabled={ocupado} onClick={() => void enviarWhatsApp(cotizacion)}>
                      WhatsApp
                    </button>
                  </>
                )}

                {estado === "PENDIENTE_APROBACION" && modoGerencia && (
                  <>
                    <button type="button" style={smallPrimary} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "BORRADOR")}>
                      Aprobar descuento
                    </button>
                    <button type="button" style={smallDanger} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "RECHAZADA")}>
                      Rechazar
                    </button>
                  </>
                )}

                {estado === "BORRADOR" && (
                  <button type="button" style={smallPrimary} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "ENVIADA")}>
                    Marcar enviada
                  </button>
                )}
                {estado === "ENVIADA" && (
                  <>
                    <button type="button" style={smallPrimary} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "ACEPTADA")}>
                      Aceptar
                    </button>
                    <button type="button" style={smallDanger} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "RECHAZADA")}>
                      Rechazar
                    </button>
                  </>
                )}
                {estado === "ACEPTADA" && (
                  <button type="button" style={smallPrimary} onClick={() => iniciarSeparacion(cotizacion)}>
                    Crear separacion
                  </button>
                )}
                {["BORRADOR", "ENVIADA", "RECHAZADA", "VENCIDA"].includes(estado) && (
                  <button type="button" style={smallButton} onClick={() => abrirNueva(cotizacion)}>
                    Nueva version
                  </button>
                )}
                {["BORRADOR", "ENVIADA"].includes(estado) && (
                  <button type="button" style={smallDanger} disabled={ocupado} onClick={() => void actualizarEstado(cotizacion, "ANULADA")}>
                    Anular
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {cotizacionesFiltradas.length === 0 && (
        <div style={emptyState}>No hay cotizaciones para los filtros seleccionados.</div>
      )}

      {mostrarFormulario && (
        <div style={overlay} role="presentation">
          <form style={modal} onSubmit={guardarCotizacion}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>
                  {form.cotizacionAnteriorId ? "Nueva version" : "Nueva cotizacion"}
                </h2>
                <p style={modalSubtitle}>Los calculos se validan nuevamente en Supabase.</p>
              </div>
              <button type="button" style={closeButton} onClick={() => setMostrarFormulario(false)} aria-label="Cerrar">
                x
              </button>
            </div>

            <div style={formGrid}>
              <label style={field}>
                <span style={label}>Cliente</span>
                <select value={form.clienteId} onChange={(event) => seleccionarCliente(event.target.value)} style={input} required disabled={Boolean(form.cotizacionAnteriorId)}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {nombreCliente(cliente)} | {cliente.celular || "sin celular"}
                    </option>
                  ))}
                </select>
              </label>

              <label style={field}>
                <span style={label}>Lote</span>
                <select value={form.loteId} onChange={(event) => seleccionarLote(event.target.value)} style={input} required disabled={Boolean(form.cotizacionAnteriorId)}>
                  <option value="">Seleccionar lote</option>
                  {lotesCotizables.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      MZ {lote.mz} - Lote {lote.lote} | {formatearMoneda(lote.precio)}
                    </option>
                  ))}
                </select>
              </label>

              {modoGerencia && (
                <label style={field}>
                  <span style={label}>Asesor responsable</span>
                  <select value={form.asesorId} onChange={(event) => actualizarForm("asesorId", event.target.value)} style={input} required>
                    <option value="">Seleccionar asesor</option>
                    {asesores.map((asesor) => (
                      <option key={asesor.id} value={asesor.id}>
                        {asesor.full_name || asesor.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={field}>
                <span style={label}>Precio de lista</span>
                <input value={precioLista ? formatearMoneda(precioLista) : ""} style={inputDisabled} disabled />
              </label>

              <label style={field}>
                <span style={label}>Precio ofertado</span>
                <input type="number" min="0" step="0.01" value={form.precioOfertado} onChange={(event) => actualizarForm("precioOfertado", event.target.value)} style={input} required />
              </label>

              <label style={field}>
                <span style={label}>Monto de separacion</span>
                <input type="number" min="0" step="0.01" value={form.montoSeparacion} onChange={(event) => actualizarForm("montoSeparacion", event.target.value)} style={input} required />
              </label>

              <label style={field}>
                <span style={label}>Inicial</span>
                <input type="number" min="0" step="0.01" value={form.inicial} onChange={(event) => actualizarForm("inicial", event.target.value)} style={input} required />
              </label>

              <label style={field}>
                <span style={label}>Numero de cuotas</span>
                <input type="number" min="1" max="60" value={form.meses} onChange={(event) => actualizarForm("meses", event.target.value)} style={input} required />
              </label>

              <label style={field}>
                <span style={label}>Valida hasta</span>
                <input type="date" min={fechaIso(new Date())} value={form.validaHasta} onChange={(event) => actualizarForm("validaHasta", event.target.value)} style={input} required />
              </label>
            </div>

            <div style={calculationBand}>
              <Calculo label="Descuento" value={`${formatearMoneda(descuentoMonto)} (${descuentoPorcentaje.toFixed(2)}%)`} warning={!modoGerencia && descuentoPorcentaje > configuracion.descuento_asesor_max_porcentaje} />
              <Calculo label="Saldo" value={formatearMoneda(saldo)} />
              <Calculo label="Cuota mensual" value={formatearMoneda(cuota)} accent />
            </div>

            <label style={field}>
              <span style={label}>Observaciones y condiciones especiales</span>
              <textarea value={form.observaciones} onChange={(event) => actualizarForm("observaciones", event.target.value)} style={textarea} placeholder="Detalle comercial visible en la propuesta" />
            </label>

            <div style={ruleNote}>
              Limite asesor: {configuracion.descuento_asesor_max_porcentaje.toFixed(2)}% de descuento. Inicial minima: {formatearMoneda(configuracion.inicial_minima)}. Los descuentos superiores se guardan como pendientes hasta que gerencia los apruebe.
            </div>

            <div style={modalActions}>
              <button type="button" style={secondaryButton} onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </button>
              <button type="submit" style={primaryButton} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cotizacion"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Resumen({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <article style={summaryCard}>
      <span style={summaryLabel}>{label}</span>
      <strong style={{ ...summaryValue, color: danger ? "#b42318" : "#0b2f24" }}>{value}</strong>
    </article>
  );
}

function Calculo({ label, value, accent = false, warning = false }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <div>
      <span style={summaryLabel}>{label}</span>
      <strong style={{ color: warning ? "#b42318" : accent ? "#17603a" : "#172033", display: "block", marginTop: 4 }}>
        {value}
      </strong>
    </div>
  );
}

const toolbar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 16 };
const toolbarTitle: React.CSSProperties = { display: "block", fontSize: 20, color: "#102a22" };
const toolbarText: React.CSSProperties = { margin: "5px 0 0", color: "#64748b", fontSize: 14 };
const summaryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 };
const summaryCard: React.CSSProperties = { background: "#fff", border: "1px solid #dde4df", padding: 16, boxShadow: "0 8px 22px rgba(22,42,32,.05)" };
const summaryLabel: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800, textTransform: "uppercase" };
const summaryValue: React.CSSProperties = { display: "block", fontSize: 28, marginTop: 4 };
const filters: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10, marginBottom: 16 };
const quotesGrid: React.CSSProperties = { display: "grid", gap: 12 };
const quoteCard: React.CSSProperties = { background: "#fff", border: "1px solid #dce3de", padding: 16, boxShadow: "0 8px 22px rgba(22,42,32,.05)" };
const quoteHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 12, borderBottom: "1px solid #edf0ee" };
const quoteNumber: React.CSSProperties = { color: "#0b2f24", display: "block", fontSize: 17 };
const statusBadge: React.CSSProperties = { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" };
const quoteBodyGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, padding: "14px 0" };
const quoteMeta: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "8px 24px", background: "#f6f8f6", padding: "9px 12px", color: "#52615a", fontSize: 13 };
const actions: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 };
const label: React.CSSProperties = { display: "block", color: "#64748b", fontSize: 12, fontWeight: 800, marginBottom: 5 };
const muted: React.CSSProperties = { display: "block", color: "#6b7280", fontSize: 12, marginTop: 4 };
const money: React.CSSProperties = { color: "#17603a", fontSize: 17 };
const input: React.CSSProperties = { width: "100%", minHeight: 44, border: "1px solid #cfd8d2", padding: "0 12px", background: "#fff", color: "#172033", boxSizing: "border-box" };
const inputDisabled: React.CSSProperties = { ...input, background: "#f2f4f2", color: "#667085" };
const textarea: React.CSSProperties = { ...input, minHeight: 90, padding: 12, resize: "vertical" };
const primaryButton: React.CSSProperties = { minHeight: 44, border: 0, background: "#0f6544", color: "#fff", padding: "0 18px", fontWeight: 900, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { minHeight: 44, border: "1px solid #bfcac3", background: "#fff", color: "#214438", padding: "0 14px", fontWeight: 800, cursor: "pointer" };
const smallButton: React.CSSProperties = { minHeight: 36, border: "1px solid #cbd5ce", background: "#fff", color: "#214438", padding: "0 11px", fontWeight: 800, cursor: "pointer" };
const smallPrimary: React.CSSProperties = { ...smallButton, background: "#0f6544", color: "#fff", borderColor: "#0f6544" };
const smallDanger: React.CSSProperties = { ...smallButton, background: "#fff5f4", color: "#a1281c", borderColor: "#efb9b3" };
const errorBanner: React.CSSProperties = { background: "#fff1ef", border: "1px solid #f1afa6", color: "#982619", padding: 14, marginBottom: 14, fontWeight: 700 };
const successBanner: React.CSSProperties = { background: "#eaf7ef", border: "1px solid #a9d5b8", color: "#17603a", padding: 14, marginBottom: 14, fontWeight: 700 };
const infoBanner: React.CSSProperties = { background: "#fff", border: "1px solid #dde4df", padding: 18, color: "#52615a" };
const emptyState: React.CSSProperties = { ...infoBanner, textAlign: "center", marginTop: 12 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(8,25,19,.58)", display: "grid", placeItems: "center", padding: 16, zIndex: 100000 };
const modal: React.CSSProperties = { width: "min(820px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#fff", padding: 20, boxShadow: "0 24px 70px rgba(0,0,0,.28)" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 };
const modalTitle: React.CSSProperties = { margin: 0, color: "#102a22", fontSize: 24 };
const modalSubtitle: React.CSSProperties = { margin: "4px 0 0", color: "#64748b", fontSize: 13 };
const closeButton: React.CSSProperties = { width: 40, height: 40, border: "1px solid #d8dfda", background: "#fff", fontSize: 18, cursor: "pointer" };
const formGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const field: React.CSSProperties = { display: "block" };
const calculationBand: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, background: "#f4f7f5", border: "1px solid #dce4df", padding: 14, margin: "16px 0" };
const ruleNote: React.CSSProperties = { background: "#fff8e5", border: "1px solid #ead6a0", color: "#684f13", padding: 12, marginTop: 14, fontSize: 13 };
const modalActions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginTop: 18 };
