"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  CRM_ESTADOS,
  LOTES_TABLE,
  colorEstado,
  etiquetaEstado,
  esGerencia,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
} from "../../lib/crm";

type SeparacionDirectaForm = {
  nombres: string;
  apellidos: string;
  dni: string;
  celular: string;
  correo: string;
  ocupacion: string;
  direccion: string;
  montoSeparacion: string;
  inicial: string;
  fechaPagoInicial: string;
  meses: string;
  observaciones: string;
};

const separacionDirectaVacia: SeparacionDirectaForm = {
  nombres: "",
  apellidos: "",
  dni: "",
  celular: "",
  correo: "",
  ocupacion: "",
  direccion: "",
  montoSeparacion: "",
  inicial: "6000",
  fechaPagoInicial: "",
  meses: "24",
  observaciones: "",
};

const EMPRESA_RAZON_SOCIAL =
  "INMOBILIARIA KOMODO S.A.C.";
const EMPRESA_RUC = "20612152404";
const PROYECTO_NOMBRE = "Las Lomas de Malabrigo";
const PROYECTO_UBICACION =
  "PREDIO LA PAMPA, distrito de Razuri, Provincia de Ascope, Departamento La Libertad.";
const BANCO_NOMBRE = "INTERBANK";
const BANCO_CUENTA = "600-3005917902";
const BANCO_CCI = "003-600-003005917902-45";
const EMPRESA_CELULAR = "933008638";
const EMPRESA_EMAIL = "inmobiliariakomodo@gmail.com";
const DIAS_VIGENCIA_SEPARACION = 7;
const LOGO_LAS_LOMAS = "/las-lomas-logo.png";

export default function LotesTable() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [clientes, setClientes] = useState<
    Record<string, Cliente>
  >({});
  const [asesores, setAsesores] = useState<
    Record<string, Profile>
  >({});
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("TODOS");
  const [asesorFiltro, setAsesorFiltro] =
    useState("TODOS");
  const [alcanceAsesor, setAlcanceAsesor] =
    useState("TODOS");
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState<number | null>(null);
  const [asignando, setAsignando] =
    useState<number | null>(null);
  const [aprobando, setAprobando] =
    useState<number | null>(null);
  const [loteSeparacion, setLoteSeparacion] =
    useState<LoteCrm | null>(null);
  const [formSeparacion, setFormSeparacion] =
    useState<SeparacionDirectaForm>(
      separacionDirectaVacia
    );
  const [pdfGenerado, setPdfGenerado] =
    useState<Blob | null>(null);
  const [pdfDescargado, setPdfDescargado] =
    useState(false);
  const [pdfEnviado, setPdfEnviado] =
    useState(false);
  const [enviandoPdf, setEnviandoPdf] =
    useState(false);
  const [creandoSeparacion, setCreandoSeparacion] =
    useState(false);

  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    const [
      lotesRes,
      clientesRes,
      perfilesRes,
    ] = await Promise.all([
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        )
        .order("mz", {
          ascending: true,
        })
        .order("lote", {
          ascending: true,
        }),
      supabase
        .from("clientes")
        .select(
          "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,created_at,updated_at"
        ),
      supabase
        .from("profiles")
        .select(
          "id,full_name,email,role,phone,active"
        ),
    ]);

    if (lotesRes.error) {
      setError(lotesRes.error.message);
      return;
    }

    setError(null);
    setLotes((lotesRes.data || []) as LoteCrm[]);

    const clientesMap: Record<string, Cliente> =
      {};
    ((clientesRes.data || []) as Cliente[]).forEach(
      (cliente) => {
        clientesMap[cliente.id] = cliente;
      }
    );
    setClientes(clientesMap);

    const asesoresMap: Record<string, Profile> =
      {};
    ((perfilesRes.data || []) as Profile[]).forEach(
      (asesor) => {
        asesoresMap[asesor.id] = asesor;
      }
    );
    setAsesores(asesoresMap);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);

    if (!supabase) return;

    const clienteSupabase = supabase;

    const canal = clienteSupabase
      .channel("crm_lotes_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LOTES_TABLE,
        },
        () => cargar()
      )
      .subscribe();

    return () => {
      clienteSupabase.removeChannel(canal);
    };
  }, []);

  const modoGerencia = esGerencia(profile);

  const resumenSeparacionDirecta = useMemo(() => {
    const precio = Number(loteSeparacion?.precio || 0);
    const montoSeparacion = Number(
      formSeparacion.montoSeparacion || 0
    );
    const inicial = Number(formSeparacion.inicial || 0);
    const meses = Math.max(
      Number(formSeparacion.meses || 0),
      0
    );
    const montoFinanciar = Math.max(precio - inicial, 0);
    const cuotaMensual =
      meses > 0 ? montoFinanciar / meses : 0;

    return {
      precio,
      montoSeparacion,
      inicial,
      meses,
      montoFinanciar,
      cuotaMensual,
    };
  }, [
    formSeparacion.inicial,
    formSeparacion.meses,
    formSeparacion.montoSeparacion,
    loteSeparacion?.precio,
  ]);

  const asesoresLista = useMemo(
    () =>
      Object.values(asesores).filter(
        (asesor) =>
          asesor.active !== false &&
          asesor.role === "asesor"
      ),
    [asesores]
  );

  const lotesFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, "");

    return lotes.filter((lote) => {
      const coincideEstado =
        estado === "TODOS" ||
        lote.estado === estado;

      const coincideAsesor =
        modoGerencia
          ? asesorFiltro === "TODOS" ||
            (asesorFiltro === "SIN_ASIGNAR"
              ? !lote.asesor_id
              : lote.asesor_id === asesorFiltro)
          : !profile ||
            alcanceAsesor === "TODOS" ||
            (alcanceAsesor === "MIOS"
              ? lote.asesor_id === profile.id
              : alcanceAsesor === "SIN_ASIGNAR"
              ? !lote.asesor_id
              : Boolean(lote.asesor_id) &&
                lote.asesor_id !== profile.id);

      const codigo =
        `${lote.mz}${lote.lote}`
          .toLowerCase()
          .replace(/[-\s]/g, "");

      const coincideTexto =
        !texto ||
        codigo.includes(texto) ||
        lote.mz.toLowerCase().includes(texto);

      return (
        coincideEstado &&
        coincideAsesor &&
        coincideTexto
      );
    });
  }, [
    alcanceAsesor,
    asesorFiltro,
    busqueda,
    estado,
    lotes,
    modoGerencia,
    profile,
  ]);

  const estadosPermitidos = (lote: LoteCrm) => {
    if (!profile) return [lote.estado];

    if (modoGerencia) {
      return Array.from(CRM_ESTADOS).filter(
        (estadoItem) =>
          estadoItem !== "SEPARADO" ||
          lote.estado === "SEPARADO"
      );
    }

    if (
      lote.asesor_id &&
      lote.asesor_id !== profile.id
    ) {
      return [lote.estado];
    }

    if (lote.estado === "DISPONIBLE") {
      return [
        "DISPONIBLE",
        "EN_NEGOCIACION",
        "CIERRE_SOLICITADO",
      ];
    }

    if (lote.estado === "EN_NEGOCIACION") {
      return [
        "EN_NEGOCIACION",
        "DISPONIBLE",
        "CIERRE_SOLICITADO",
      ];
    }

    if (lote.estado === "SEPARADO") {
      return [
        "SEPARADO",
        "CIERRE_SOLICITADO",
      ];
    }

    return [lote.estado];
  };

  const cambiarEstado = async (
    lote: LoteCrm,
    estadoNuevo: string
  ) => {
    if (!supabase || !profile) return;
    if (estadoNuevo === lote.estado) return;

    setGuardando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_cambiar_estado_lote", {
        p_lote_id: lote.id,
        p_estado_nuevo: estadoNuevo,
        p_motivo:
          "Cambio desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Lote ${lote.mz}-${lote.lote} actualizado.`
      );
      await cargar();
    }

    setGuardando(null);
  };

  const asignarLote = async (
    lote: LoteCrm,
    asesorId: string
  ) => {
    if (!supabase || !modoGerencia) return;

    setAsignando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_asignar_lote", {
        p_lote_id: lote.id,
        p_asesor_id: asesorId || null,
        p_motivo:
          "Asignacion desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Lote ${lote.mz}-${lote.lote} reasignado.`
      );
      await cargar();
    }

    setAsignando(null);
  };

  const aprobarCierre = async (lote: LoteCrm) => {
    if (!supabase || !modoGerencia) return;

    setAprobando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_aprobar_cierre_lote", {
        p_lote_id: lote.id,
        p_motivo:
          "Venta aprobada desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Venta aprobada para ${lote.mz}-${lote.lote}.`
      );
      await cargar();
    }

    setAprobando(null);
  };

  const abrirSeparacionDirecta = (lote: LoteCrm) => {
    setLoteSeparacion(lote);
    setFormSeparacion({
      ...separacionDirectaVacia,
      inicial: "6000",
      fechaPagoInicial: fechaVencimientoSeparacionIso(),
      meses: "24",
    });
    setPdfGenerado(null);
    setPdfDescargado(false);
    setPdfEnviado(false);
    setMensaje(null);
    setError(null);
  };

  const cerrarSeparacionDirecta = () => {
    setLoteSeparacion(null);
    setPdfGenerado(null);
    setPdfDescargado(false);
    setPdfEnviado(false);
    setFormSeparacion(separacionDirectaVacia);
  };

  const actualizarSeparacionForm = (
    campo: keyof SeparacionDirectaForm,
    valor: string
  ) => {
    setFormSeparacion((actual) => ({
      ...actual,
      [campo]: valor,
    }));
    setPdfGenerado(null);
    setPdfDescargado(false);
    setPdfEnviado(false);
  };

  const validarFicha = () => {
    if (!loteSeparacion) {
      return "Selecciona un lote.";
    }

    if (!formSeparacion.nombres.trim()) {
      return "Ingresa los nombres del cliente.";
    }

    if (!formSeparacion.apellidos.trim()) {
      return "Ingresa los apellidos del cliente.";
    }

    if (!formSeparacion.dni.trim()) {
      return "Ingresa el DNI del cliente.";
    }

    if (!formSeparacion.celular.trim()) {
      return "Ingresa el celular del cliente.";
    }

    if (!formSeparacion.correo.trim()) {
      return "Ingresa el correo del cliente.";
    }

    if (!formSeparacion.ocupacion.trim()) {
      return "Ingresa la ocupacion del cliente.";
    }

    if (!formSeparacion.direccion.trim()) {
      return "Ingresa la direccion del cliente.";
    }

    if (!formSeparacion.montoSeparacion.trim()) {
      return "Ingresa el monto de separacion.";
    }

    if (!formSeparacion.inicial.trim()) {
      return "Ingresa la inicial pactada.";
    }

    if (!formSeparacion.fechaPagoInicial) {
      return "Ingresa la fecha de pago de la inicial.";
    }

    if (!formSeparacion.meses.trim()) {
      return "Ingresa el numero de cuotas.";
    }

    return null;
  };

  const construirObservacionesFicha = () => {
    const partes = [
      `Ocupacion: ${formSeparacion.ocupacion || "-"}`,
      `Direccion: ${formSeparacion.direccion || "-"}`,
      `Monto de separacion: ${formatearMoneda(
        resumenSeparacionDirecta.montoSeparacion
      )}`,
      `Inicial: ${formSeparacion.inicial || "-"}`,
      `Monto a financiar: ${formatearMoneda(
        resumenSeparacionDirecta.montoFinanciar
      )}`,
      `Meses: ${formSeparacion.meses || "-"}`,
      `Cuota mensual estimada: ${formatearMoneda(
        resumenSeparacionDirecta.cuotaMensual
      )}`,
      `Fecha de pago inicial: ${
        formSeparacion.fechaPagoInicial || "-"
      }`,
      `Vigencia de separacion: ${DIAS_VIGENCIA_SEPARACION} dias calendario`,
      formSeparacion.observaciones
        ? `Observaciones: ${formSeparacion.observaciones}`
        : "",
    ];

    return partes.filter(Boolean).join("\n");
  };

  const nombreArchivoFicha = () => {
    if (!loteSeparacion) {
      return "ficha-separacion.pdf";
    }

    const cliente = `${formSeparacion.nombres}-${formSeparacion.apellidos}`
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    return `separacion-mz-${loteSeparacion.mz}-lote-${loteSeparacion.lote}-${cliente || "cliente"}.pdf`;
  };

  const obtenerPdfFicha = async () => {
    const errorValidacion = validarFicha();

    if (errorValidacion) {
      setError(errorValidacion);
      return null;
    }

    if (pdfGenerado) return pdfGenerado;

    try {
      const nuevoPdf = await crearPdfSeparacion(
        loteSeparacion!,
        formSeparacion,
        profile
      );

      setPdfGenerado(nuevoPdf);
      return nuevoPdf;
    } catch {
      setError(
        "No se pudo generar el PDF. Revisa los datos e intenta nuevamente."
      );
      return null;
    }
  };

  const descargarFicha = async () => {
    const pdf = await obtenerPdfFicha();
    if (!pdf) return;

    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = nombreArchivoFicha();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setPdfDescargado(true);
    setMensaje(
      "Ficha descargada. Ya puedes finalizar la separacion."
    );
  };

  const enviarFichaPorCorreo = async () => {
    const pdf = await obtenerPdfFicha();
    if (!pdf || !loteSeparacion) return;

    setEnviandoPdf(true);
    setError(null);
    setMensaje(null);

    const pdfBase64 = await blobToBase64(pdf);

    const response = await fetch(
      "/api/enviar-ficha-separacion",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: formSeparacion.correo.trim(),
          fileName: nombreArchivoFicha(),
          pdfBase64,
          subject: `Ficha de separacion MZ ${loteSeparacion.mz} - Lote ${loteSeparacion.lote}`,
          message:
            "Adjuntamos la ficha de separacion generada para el lote solicitado.",
        }),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(
        data?.error ||
          "No se pudo enviar el correo. Descarga el PDF o configura el servicio de correo."
      );
    } else {
      setPdfEnviado(true);
      setMensaje(
        "Ficha enviada por correo. Ya puedes finalizar la separacion."
      );
    }

    setEnviandoPdf(false);
  };

  const finalizarSeparacionDirecta = async () => {
    if (!supabase || !loteSeparacion) return;

    const errorValidacion = validarFicha();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    if (!pdfDescargado && !pdfEnviado) {
      setError(
        "Antes de finalizar debes descargar el PDF o enviarlo al correo del cliente."
      );
      return;
    }

    setCreandoSeparacion(true);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_crear_cliente_y_separacion",
      {
        p_lote_id: loteSeparacion.id,
        p_nombres: formSeparacion.nombres.trim(),
        p_apellidos:
          formSeparacion.apellidos.trim() || null,
        p_dni: formSeparacion.dni.trim(),
        p_celular: formSeparacion.celular.trim(),
        p_correo:
          formSeparacion.correo.trim() || null,
        p_direccion:
          formSeparacion.direccion.trim() || null,
        p_fuente: "Ficha de separacion",
        p_observaciones:
          construirObservacionesFicha(),
        p_monto: Number(
          formSeparacion.montoSeparacion || 0
        ),
        p_fecha_limite:
          fechaVencimientoSeparacionIso(),
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Cliente y separacion creados para ${loteSeparacion.mz}-${loteSeparacion.lote}.`
      );
      cerrarSeparacionDirecta();
      await cargar();
    }

    setCreandoSeparacion(false);
  };

  return (
    <section>
      <div style={toolbar}>
        <input
          value={busqueda}
          onChange={(event) =>
            setBusqueda(event.target.value)
          }
          placeholder="Buscar MZ o lote"
          style={input}
        />
        <select
          value={estado}
          onChange={(event) =>
            setEstado(event.target.value)
          }
          style={select}
        >
          <option value="TODOS">
            Todos los estados
          </option>
          {CRM_ESTADOS.map((item) => (
            <option key={item} value={item}>
              {etiquetaEstado(item)}
            </option>
          ))}
        </select>
        {modoGerencia && (
          <select
            value={asesorFiltro}
            onChange={(event) =>
              setAsesorFiltro(event.target.value)
            }
            style={select}
          >
            <option value="TODOS">
              Todos los asesores
            </option>
            <option value="SIN_ASIGNAR">
              Sin asignar
            </option>
            {asesoresLista.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.full_name || item.email}
              </option>
            ))}
          </select>
        )}
        {profile && !modoGerencia && (
          <select
            value={alcanceAsesor}
            onChange={(event) =>
              setAlcanceAsesor(event.target.value)
            }
            style={select}
          >
            <option value="TODOS">
              Todos los lotes
            </option>
            <option value="MIOS">
              Mis lotes
            </option>
            <option value="SIN_ASIGNAR">
              Sin asignar
            </option>
            <option value="OTROS">
              A cargo de otro asesor
            </option>
          </select>
        )}
      </div>

      {profile && !modoGerencia && (
        <div style={infoBox}>
          Para separar un lote con cliente, usa
          <strong> Separar con cliente</strong>. El
          sistema generara la ficha PDF y luego
          creara el cliente y la separacion.
        </div>
      )}

      {mensaje && (
        <div style={success}>{mensaje}</div>
      )}
      {error && <div style={alert}>{error}</div>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {[
                "Manzana",
                "Lote",
                "Area",
                "Precio",
                "Estado",
                "Cliente",
                "Asesor",
                "Accion",
              ].map((head) => (
                <th key={head} style={th}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lotesFiltrados.map((lote) => {
              const color = colorEstado(
                lote.estado
              );
              const cliente = lote.cliente_id
                ? clientes[lote.cliente_id]
                : null;
              const puedeVerDetalle =
                modoGerencia ||
                !lote.asesor_id ||
                lote.asesor_id === profile?.id;
              const asesor = lote.asesor_id
                ? asesores[lote.asesor_id]
                : null;
              const opciones =
                estadosPermitidos(lote);
              const puedeCambiar =
                opciones.length > 1;

              return (
                <tr key={lote.id}>
                  <td style={td}>{lote.mz}</td>
                  <td style={td}>{lote.lote}</td>
                  <td style={td}>
                    {formatearArea(lote.area)}
                  </td>
                  <td style={td}>
                    {formatearMoneda(
                      lote.precio
                    )}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        ...badge,
                        background: color.bg,
                        color: color.fg,
                      }}
                    >
                      {etiquetaEstado(
                        lote.estado
                      )}
                    </span>
                  </td>
                  <td style={td}>
                    {puedeVerDetalle
                      ? nombreCliente(cliente) || "-"
                      : "Asignado"}
                  </td>
                  <td style={td}>
                    {modoGerencia ? (
                      <select
                        value={lote.asesor_id || ""}
                        disabled={
                          asignando === lote.id
                        }
                        onChange={(event) =>
                          asignarLote(
                            lote,
                            event.target.value
                          )
                        }
                        style={selectSmall}
                      >
                        <option value="">
                          Sin asignar
                        </option>
                        {asesoresLista.map(
                          (item) => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.full_name ||
                                item.email}
                            </option>
                          )
                        )}
                      </select>
                    ) : asesor?.id === profile?.id ? (
                      "Asignado a ti"
                    ) : asesor ? (
                      "Asignado"
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={td}>
                    <div style={actionStack}>
                      <select
                        value={lote.estado}
                        disabled={
                          guardando === lote.id ||
                          !puedeCambiar
                        }
                        onChange={(event) =>
                          cambiarEstado(
                            lote,
                            event.target.value
                          )
                        }
                        style={selectSmall}
                      >
                        {opciones.map((item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {etiquetaEstado(item)}
                          </option>
                        ))}
                      </select>
                      {modoGerencia &&
                        lote.estado ===
                          "CIERRE_SOLICITADO" && (
                          <button
                            type="button"
                            disabled={
                              aprobando ===
                              lote.id
                            }
                            onClick={() =>
                              aprobarCierre(lote)
                            }
                            style={primarySmall}
                          >
                            {aprobando ===
                            lote.id
                              ? "Aprobando..."
                              : "Aprobar venta"}
                          </button>
                        )}
                      {profile &&
                        !modoGerencia &&
                        (lote.estado ===
                          "DISPONIBLE" ||
                          lote.estado ===
                            "EN_NEGOCIACION") && (
                          <button
                            type="button"
                            onClick={() =>
                              abrirSeparacionDirecta(
                                lote
                              )
                            }
                            style={secondarySmall}
                          >
                            Separar con cliente
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
      {loteSeparacion && (
        <div style={modalOverlay}>
          <div style={modalPanel}>
            <div style={modalHeader}>
              <div>
                <div style={modalEyebrow}>
                  Ficha de separacion
                </div>
                <h2 style={modalTitle}>
                  MZ {loteSeparacion.mz} - Lote{" "}
                  {loteSeparacion.lote}
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrarSeparacionDirecta}
                style={closeButton}
              >
                x
              </button>
            </div>

            <div style={modalSection}>
              <div style={sectionTitle}>
                Datos del comprador
              </div>
              <div style={modalGrid}>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Nombres *
                  </span>
                  <input
                    required
                    value={formSeparacion.nombres}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "nombres",
                        event.target.value
                      )
                    }
                    placeholder="Ej. Carlos Alberto"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Apellidos *
                  </span>
                  <input
                    required
                    value={formSeparacion.apellidos}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "apellidos",
                        event.target.value
                      )
                    }
                    placeholder="Ej. Ramirez Torres"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>DNI *</span>
                  <input
                    required
                    value={formSeparacion.dni}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "dni",
                        event.target.value
                      )
                    }
                    placeholder="Documento"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Celular *
                  </span>
                  <input
                    required
                    value={formSeparacion.celular}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "celular",
                        event.target.value
                      )
                    }
                    placeholder="Numero de contacto"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Correo *
                  </span>
                  <input
                    required
                    type="email"
                    value={formSeparacion.correo}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "correo",
                        event.target.value
                      )
                    }
                    placeholder="correo@cliente.com"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Ocupacion *
                  </span>
                  <input
                    required
                    value={formSeparacion.ocupacion}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "ocupacion",
                        event.target.value
                      )
                    }
                    placeholder="Actividad u ocupacion"
                    style={input}
                  />
                </label>
                <label
                  style={{
                    ...fieldGroup,
                    gridColumn: "1 / -1",
                  }}
                >
                  <span style={fieldLabel}>
                    Domicilio *
                  </span>
                  <input
                    required
                    value={formSeparacion.direccion}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "direccion",
                        event.target.value
                      )
                    }
                    placeholder="Direccion completa del cliente"
                    style={{
                      ...input,
                      width: "100%",
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={modalSection}>
              <div style={sectionTitle}>
                Condiciones comerciales
              </div>
              <div style={modalGrid}>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Monto de separacion *
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      formSeparacion.montoSeparacion
                    }
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "montoSeparacion",
                        event.target.value
                      )
                    }
                    placeholder="Ej. 1000.00"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Inicial pactada *
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formSeparacion.inicial}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "inicial",
                        event.target.value
                      )
                    }
                    placeholder="Ej. 6000.00"
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Fecha de pago de inicial *
                  </span>
                  <input
                    required
                    type="date"
                    value={
                      formSeparacion.fechaPagoInicial
                    }
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "fechaPagoInicial",
                        event.target.value
                      )
                    }
                    style={input}
                  />
                </label>
                <label style={fieldGroup}>
                  <span style={fieldLabel}>
                    Numero de cuotas *
                  </span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formSeparacion.meses}
                    onChange={(event) =>
                      actualizarSeparacionForm(
                        "meses",
                        event.target.value
                      )
                    }
                    placeholder="Ej. 24"
                    style={input}
                  />
                </label>
              </div>

              <div style={summaryGrid}>
                <div style={summaryCard}>
                  <span>Precio total</span>
                  <strong>
                    {formatearMoneda(
                      resumenSeparacionDirecta.precio
                    )}
                  </strong>
                </div>
                <div style={summaryCard}>
                  <span>Area</span>
                  <strong>
                    {formatearArea(
                      loteSeparacion.area
                    )}
                  </strong>
                </div>
                <div style={summaryCard}>
                  <span>Monto a financiar</span>
                  <strong>
                    {formatearMoneda(
                      resumenSeparacionDirecta.montoFinanciar
                    )}
                  </strong>
                </div>
                <div style={summaryCard}>
                  <span>Cuota mensual estimada</span>
                  <strong>
                    {formatearMoneda(
                      resumenSeparacionDirecta.cuotaMensual
                    )}
                  </strong>
                </div>
                <div style={summaryCard}>
                  <span>Vigencia de separacion</span>
                  <strong>
                    {DIAS_VIGENCIA_SEPARACION} dias
                  </strong>
                </div>
              </div>
            </div>

            <div style={modalSection}>
              <div style={sectionTitle}>
                Observaciones internas
              </div>
              <textarea
                value={formSeparacion.observaciones}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "observaciones",
                    event.target.value
                  )
                }
                placeholder="Notas internas para el CRM. No reemplazan las condiciones juridicas de la ficha."
                style={modalTextarea}
              />
            </div>

            <div style={modalActions}>
              <button
                type="button"
                onClick={descargarFicha}
                style={secondaryAction}
              >
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={enviarFichaPorCorreo}
                disabled={enviandoPdf}
                style={secondaryAction}
              >
                {enviandoPdf
                  ? "Enviando..."
                  : "Enviar PDF por correo"}
              </button>
              <button
                type="button"
                onClick={finalizarSeparacionDirecta}
                disabled={
                  creandoSeparacion ||
                  (!pdfDescargado && !pdfEnviado)
                }
                style={{
                  ...primaryAction,
                  opacity:
                    pdfDescargado || pdfEnviado
                      ? 1
                      : 0.55,
                }}
              >
                {creandoSeparacion
                  ? "Creando..."
                  : "Finalizar separacion"}
              </button>
            </div>

            <div style={modalHint}>
              Primero descarga o envia el PDF. Luego
              se habilita la creacion del cliente y
              la separacion.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 16,
  flexWrap: "wrap",
};

const input: React.CSSProperties = {
  height: 42,
  minWidth: 260,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
};

const select: React.CSSProperties = {
  ...input,
  minWidth: 210,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  boxShadow:
    "0 14px 36px rgba(15,23,42,.06)",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  color: "#334155",
  background: "#f7f8f5",
  fontSize: 13,
  fontWeight: 900,
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "13px 16px",
  borderBottom: "1px solid #eef0ec",
  color: "#111827",
  fontSize: 14,
};

const badge: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  fontSize: 12,
};

const selectSmall: React.CSSProperties = {
  height: 36,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 10px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 800,
};

const actionStack: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const primarySmall: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #2f6f43",
  padding: "0 12px",
  background: "#2f6f43",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondarySmall: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #c7b98f",
  padding: "0 12px",
  background: "#fff7dc",
  color: "#5f4a16",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
};

const infoBox: React.CSSProperties = {
  marginBottom: 12,
  background: "#eef6ff",
  color: "#244d77",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
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

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  zIndex: 1000,
};

const modalPanel: React.CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 80px rgba(15,23,42,.25)",
  padding: 18,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
};

const modalEyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const modalTitle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 22,
  color: "#111827",
  fontWeight: 950,
};

const closeButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
};

const modalGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const modalTextarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: 82,
  padding: 12,
  resize: "vertical",
  marginTop: 0,
};

const modalSection: React.CSSProperties = {
  border: "1px solid #e7e3d4",
  borderRadius: 16,
  background:
    "linear-gradient(135deg, #ffffff 0%, #fbf8ed 100%)",
  padding: 14,
  marginBottom: 12,
};

const sectionTitle: React.CSSProperties = {
  color: "#294f35",
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  marginBottom: 10,
};

const fieldGroup: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabel: React.CSSProperties = {
  color: "#5d6b58",
  fontSize: 12,
  fontWeight: 900,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const summaryCard: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid #d9d0aa",
  background: "#fffdf5",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  color: "#1f2937",
};

const modalActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const secondaryAction: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  padding: "0 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryAction: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #2f7d46",
  background: "#2f7d46",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 950,
  cursor: "pointer",
};

const modalHint: React.CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const formatoSoles = (valor: number) =>
  `S/ ${Number(valor || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fechaIsoDesdeDate = (fecha: Date) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fechaVencimientoSeparacionIso = () => {
  const fecha = new Date();
  fecha.setDate(
    fecha.getDate() + DIAS_VIGENCIA_SEPARACION
  );
  return fechaIsoDesdeDate(fecha);
};

const formatearFechaInput = (valor?: string) => {
  if (!valor) return "-";
  const [year, month, day] = valor.split("-");
  if (!year || !month || !day) return valor;
  return `${day}/${month}/${year}`;
};

const fechaLargaActual = () => {
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const fecha = new Date();
  return `${fecha.getDate()} de ${
    meses[fecha.getMonth()]
  } de ${fecha.getFullYear()}`;
};

const numeroMenorMilALetras = (numero: number) => {
  const unidades = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
  ];
  const especiales = [
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
  ];
  const decenas = [
    "",
    "",
    "veinte",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
  ];
  const centenas = [
    "",
    "ciento",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ];

  if (numero === 0) return "";
  if (numero === 100) return "cien";

  const centena = Math.floor(numero / 100);
  const resto = numero % 100;
  const partes: string[] = [];

  if (centena > 0) {
    partes.push(centenas[centena]);
  }

  if (resto > 0 && resto < 10) {
    partes.push(unidades[resto]);
  } else if (resto >= 10 && resto <= 15) {
    partes.push(especiales[resto - 10]);
  } else if (resto > 15 && resto < 20) {
    partes.push(`dieci${unidades[resto - 10]}`);
  } else if (resto === 20) {
    partes.push("veinte");
  } else if (resto > 20 && resto < 30) {
    partes.push(`veinti${unidades[resto - 20]}`);
  } else if (resto >= 30) {
    const decena = Math.floor(resto / 10);
    const unidad = resto % 10;
    partes.push(
      unidad
        ? `${decenas[decena]} y ${unidades[unidad]}`
        : decenas[decena]
    );
  }

  return partes.filter(Boolean).join(" ");
};

const numeroEnteroALetras = (numero: number): string => {
  const valor = Math.floor(Math.abs(numero));
  if (valor === 0) return "cero";

  const millones = Math.floor(valor / 1000000);
  const miles = Math.floor((valor % 1000000) / 1000);
  const resto = valor % 1000;
  const partes: string[] = [];

  if (millones > 0) {
    partes.push(
      millones === 1
        ? "un millon"
        : `${numeroMenorMilALetras(millones)} millones`
    );
  }

  if (miles > 0) {
    partes.push(
      miles === 1
        ? "mil"
        : `${numeroMenorMilALetras(miles)} mil`
    );
  }

  if (resto > 0) {
    partes.push(numeroMenorMilALetras(resto));
  }

  return partes.join(" ");
};

const numeroSolesEnLetras = (valor: number) => {
  const absoluto = Math.abs(Number(valor || 0));
  const entero = Math.floor(absoluto);
  const centimos = Math.round(
    (absoluto - entero) * 100
  );
  return `${numeroEnteroALetras(entero)} y ${String(
    centimos
  ).padStart(2, "0")}/100 soles`;
};

const escaparSvg = (valor: string | number) =>
  String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const envolverTexto = (
  texto: string,
  maxCaracteres: number
) => {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";

  palabras.forEach((palabra) => {
    const candidato = actual
      ? `${actual} ${palabra}`
      : palabra;

    if (candidato.length > maxCaracteres && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  });

  if (actual) lineas.push(actual);
  return lineas;
};

const textoMultilineaSvg = (
  x: number,
  y: number,
  texto: string,
  maxCaracteres: number,
  opciones: {
    size?: number;
    lineHeight?: number;
    weight?: number | string;
    color?: string;
    family?: string;
    justifyWidth?: number;
  } = {}
) => {
  const size = opciones.size || 24;
  const lineHeight = opciones.lineHeight || size + 10;
  const weight = opciones.weight || 400;
  const color = opciones.color || "#1f2937";
  const family =
    opciones.family ||
    "Arial, Helvetica, sans-serif";
  const justifyWidth = opciones.justifyWidth;
  const lineas = envolverTexto(texto, maxCaracteres);
  const svg = lineas
    .map(
      (linea, index) => {
        const justificar =
          justifyWidth && index < lineas.length - 1
            ? ` textLength="${justifyWidth}" lengthAdjust="spacing"`
            : "";
        return (
        `<text x="${x}" y="${
          y + index * lineHeight
        }" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}"${justificar}>${escaparSvg(
          linea
        )}</text>`
        );
      }
    )
    .join("");

  return {
    svg,
    nextY: y + lineas.length * lineHeight,
  };
};

const blobToDataUrl = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const cargarImagenDataUrl = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) return "";
  return blobToDataUrl(await response.blob());
};

const crearSvgFichaSeparacion = (
  lote: LoteCrm,
  form: SeparacionDirectaForm,
  profile: Profile | null,
  logoLasLomas: string
) => {
  const width = 1240;
  const height = 1754;
  const precio = Number(lote.precio || 0);
  const montoSeparacion = Number(
    form.montoSeparacion || 0
  );
  const inicial = Number(form.inicial || 0);
  const meses = Math.max(Number(form.meses || 0), 1);
  const montoFinanciar = Math.max(precio - inicial, 0);
  const cuotaMensual = montoFinanciar / meses;
  const nombreCompleto =
    `${form.nombres} ${form.apellidos}`.trim();
  const asesor =
    profile?.full_name || profile?.email || "-";
  const celularAsesor = profile?.phone || "-";
  const fechaEmision = fechaLargaActual();
  const vencimientoSeparacion =
    formatearFechaInput(fechaVencimientoSeparacionIso());
  const fechaPagoInicial = formatearFechaInput(
    form.fechaPagoInicial
  );
  const inicialEnLetras =
    numeroSolesEnLetras(inicial);

  const rojo = "#9f1d1d";
  const rojoOscuro = "#651515";
  const texto = "#252525";
  const textoSuave = "#636363";
  const borde = "#e1d7d7";
  const fondoSuave = "#fffafa";
  const resumenY = 690;
  const resumenAlto = 242;
  const condicionesY = resumenY + resumenAlto + 34;
  let clausulasY = 430;
  const clausulas = [
    `Comparecen ${EMPRESA_RAZON_SOCIAL}, con RUC No. ${EMPRESA_RUC}, en adelante LA EMPRESA; y el/la Sr(a). ${nombreCompleto}, identificado(a) con DNI No. ${form.dni}, de ocupacion ${form.ocupacion}, domiciliado(a) en ${form.direccion}, en adelante EL COMPRADOR.`,
    `EL COMPRADOR manifiesta su interes en separar el lote MZ ${lote.mz} - LOTE ${lote.lote}, con area de ${formatearArea(
      lote.area
    )}, integrante del proyecto ${PROYECTO_NOMBRE}, ubicado en ${PROYECTO_UBICACION}`,
    `El monto de separacion asciende a ${formatoSoles(
      montoSeparacion
    )}, suma que reserva temporalmente la disponibilidad comercial del lote, sujeta a verificacion administrativa de LA EMPRESA.`,
    `El precio total referencial asciende a ${formatoSoles(
      precio
    )}. La inicial pactada es de ${formatoSoles(
      inicial
    )} (${inicialEnLetras}), con fecha maxima de pago el ${fechaPagoInicial}. El saldo estimado a financiar es de ${formatoSoles(
      montoFinanciar
    )}, referencialmente en ${meses} cuotas mensuales de ${formatoSoles(
      cuotaMensual
    )}.`,
  ];

  const clausulasSvg = clausulas
    .map((clausula, index) => {
      const bloque = textoMultilineaSvg(
        92,
        clausulasY,
        `${index + 1}. ${clausula}`,
        126,
        {
          size: 18,
          lineHeight: 25,
          color: texto,
          justifyWidth: 1056,
        }
      );
      clausulasY = bloque.nextY + 12;
      return bloque.svg;
    })
    .join("");

  const fila = (
    y: number,
    etiqueta: string,
    valor: string
  ) =>
    `<text x="116" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="${textoSuave}">${escaparSvg(
      etiqueta
    )}</text><text x="548" y="${y}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900" fill="${texto}">${escaparSvg(
      valor
    )}</text>`;

  const titularBanco = textoMultilineaSvg(
    724,
    resumenY + 196,
    `Titular: ${EMPRESA_RAZON_SOCIAL}`,
    46,
    {
      size: 15,
      lineHeight: 20,
      weight: 800,
      color: textoSuave,
    }
  );
  const condicionVigencia = textoMultilineaSvg(
    92,
    condicionesY,
    `5. Vigencia de separacion: ${DIAS_VIGENCIA_SEPARACION} dias calendario desde la emision de esta ficha, con vencimiento el ${vencimientoSeparacion}. Vencido el plazo sin pago de inicial, LA EMPRESA podra liberar el lote previa revision interna.`,
    136,
    {
      size: 14,
      lineHeight: 20,
      weight: 700,
      color: "#555555",
      justifyWidth: 1056,
    }
  );
  const condicionIncumplimiento = textoMultilineaSvg(
    92,
    condicionVigencia.nextY + 10,
    "6. Incumplimiento o desistimiento: EL COMPRADOR perdera automaticamente el monto de separacion, sin opcion a reclamo, reembolso, compensacion ni reserva posterior.",
    136,
    {
      size: 14,
      lineHeight: 20,
      weight: 700,
      color: "#555555",
      justifyWidth: 1056,
    }
  );
  const constancia = textoMultilineaSvg(
    92,
    condicionIncumplimiento.nextY + 24,
    "EL COMPRADOR declara que adjunta copia de DNI y voucher de pago de separacion, documentos que forman parte del expediente comercial. En senal de conformidad, las partes suscriben la presente ficha.",
    126,
    {
      size: 17,
      lineHeight: 24,
      weight: 700,
      color: texto,
      justifyWidth: 1056,
    }
  );
  const fechaY = constancia.nextY + 38;
  const firmaLineaY = Math.max(fechaY + 185, 1438);
  const firmaCompradorNombre = textoMultilineaSvg(
    104,
    firmaLineaY + 56,
    `Nombre: ${nombreCompleto}`,
    34,
    {
      size: 15,
      lineHeight: 20,
      weight: 700,
      color: textoSuave,
    }
  );
  const firmaCompradorDatos = textoMultilineaSvg(
    104,
    firmaCompradorNombre.nextY + 2,
    `DNI: ${form.dni}`,
    36,
    {
      size: 15,
      lineHeight: 20,
      weight: 700,
      color: textoSuave,
    }
  );
  const firmaEmpresa = textoMultilineaSvg(
    480,
    firmaLineaY + 56,
    EMPRESA_RAZON_SOCIAL,
    31,
    {
      size: 15,
      lineHeight: 20,
      weight: 700,
      color: textoSuave,
    }
  );
  const firmaAsesorNombre = textoMultilineaSvg(
    846,
    firmaLineaY + 56,
    `Asesor: ${asesor}`,
    32,
    {
      size: 15,
      lineHeight: 20,
      weight: 700,
      color: textoSuave,
    }
  );

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#3c1b1b" flood-opacity=".10"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#ffffff"/>

  <image href="${logoLasLomas}" x="92" y="78" width="190" height="108" preserveAspectRatio="xMidYMid meet"/>
  <text x="620" y="110" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="${texto}">PRE-ACUERDO DE PAGO</text>
  <text x="620" y="148" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="950" fill="${rojoOscuro}">POR SEPARACION DE LOTE</text>
  <text x="620" y="188" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="${textoSuave}">${escaparSvg(
    EMPRESA_RAZON_SOCIAL
  )} | RUC ${escaparSvg(EMPRESA_RUC)}</text>
  <text x="620" y="216" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="${textoSuave}">${escaparSvg(
    PROYECTO_NOMBRE
  )}</text>
  <line x1="92" y1="246" x2="1148" y2="246" stroke="${borde}" stroke-width="2"/>

  <rect x="92" y="276" width="488" height="112" rx="14" fill="${fondoSuave}" stroke="${borde}" stroke-width="2"/>
  <text x="116" y="310" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="950" fill="${rojo}">LOTE SEPARADO</text>
  <text x="116" y="352" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="950" fill="${texto}">MZ ${escaparSvg(
    lote.mz
  )} - LOTE ${escaparSvg(lote.lote)}</text>
  <text x="116" y="380" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${textoSuave}">Area: ${escaparSvg(
    formatearArea(lote.area)
  )}</text>

  <rect x="660" y="276" width="488" height="112" rx="14" fill="${fondoSuave}" stroke="${borde}" stroke-width="2"/>
  <text x="684" y="310" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="950" fill="${rojo}">COMPRADOR</text>
  <text x="684" y="350" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="950" fill="${texto}">${escaparSvg(
    nombreCompleto
  )}</text>
  <text x="684" y="378" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="${textoSuave}">DNI: ${escaparSvg(
    form.dni
  )} | Celular: ${escaparSvg(form.celular)}</text>

  ${clausulasSvg}

  <rect x="92" y="${resumenY}" width="500" height="${resumenAlto}" rx="14" fill="${fondoSuave}" stroke="${borde}" stroke-width="2"/>
  <text x="116" y="${resumenY + 44}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="950" fill="${rojoOscuro}">Resumen economico pactado</text>
  ${fila(resumenY + 82, "Precio total", formatoSoles(precio))}
  ${fila(
    resumenY + 120,
    "Monto de separacion",
    formatoSoles(montoSeparacion)
  )}
  ${fila(resumenY + 158, "Inicial pactada", formatoSoles(inicial))}
  ${fila(
    resumenY + 196,
    "Monto a financiar",
    formatoSoles(montoFinanciar)
  )}
  ${fila(
    resumenY + 226,
    `Cuotas (${meses})`,
    formatoSoles(cuotaMensual)
  )}

  <rect x="692" y="${resumenY}" width="456" height="${resumenAlto}" rx="14" fill="#ffffff" stroke="${borde}" stroke-width="2"/>
  <text x="724" y="${resumenY + 44}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="950" fill="${rojoOscuro}">Cuentas oficiales</text>
  <text x="724" y="${resumenY + 84}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" fill="${texto}">Banco: ${escaparSvg(
    BANCO_NOMBRE
  )}</text>
  <text x="724" y="${resumenY + 124}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="${texto}">Cuenta: ${escaparSvg(
    BANCO_CUENTA
  )}</text>
  <text x="724" y="${resumenY + 164}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="${texto}">CCI: ${escaparSvg(
    BANCO_CCI
  )}</text>
  ${titularBanco.svg}

  <line x1="92" y1="${condicionesY - 24}" x2="1148" y2="${condicionesY - 24}" stroke="${borde}" stroke-width="2"/>
  ${condicionVigencia.svg}
  ${condicionIncumplimiento.svg}
  ${constancia.svg}

  <text x="794" y="${fechaY}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="850" fill="${texto}">Trujillo, ${escaparSvg(
    fechaEmision
  )}</text>

  <line x1="104" y1="${firmaLineaY}" x2="392" y2="${firmaLineaY}" stroke="${texto}" stroke-width="2"/>
  <text x="104" y="${firmaLineaY + 30}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="${texto}">Firma comprador</text>
  ${firmaCompradorNombre.svg}
  ${firmaCompradorDatos.svg}
  <text x="104" y="${firmaCompradorDatos.nextY + 2}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="${textoSuave}">Celular: ${escaparSvg(
    form.celular
  )}</text>

  <line x1="480" y1="${firmaLineaY}" x2="768" y2="${firmaLineaY}" stroke="${texto}" stroke-width="2"/>
  <text x="480" y="${firmaLineaY + 30}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="${texto}">CHRISTIAN CHILON CHILON</text>
  ${firmaEmpresa.svg}
  <text x="480" y="${firmaEmpresa.nextY + 2}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="${textoSuave}">RUC: ${escaparSvg(
    EMPRESA_RUC
  )}</text>

  <line x1="846" y1="${firmaLineaY}" x2="1136" y2="${firmaLineaY}" stroke="${texto}" stroke-width="2"/>
  <text x="846" y="${firmaLineaY + 30}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="${texto}">Firma asesor</text>
  ${firmaAsesorNombre.svg}
  <text x="846" y="${firmaAsesorNombre.nextY + 2}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="${textoSuave}">Celular: ${escaparSvg(
    celularAsesor
  )}</text>

  <circle cx="116" cy="1586" r="14" fill="${rojo}"/>
  <path d="M110.3 1578.4 C109.1 1579.2 108.7 1580.7 109.2 1582.1 C111.8 1589.2 116.7 1594.1 123.9 1596.8 C125.2 1597.3 126.7 1596.8 127.5 1595.6 L128.9 1593.5 C129.3 1592.8 129.1 1591.9 128.4 1591.5 L124.9 1589.6 C124.2 1589.2 123.3 1589.4 122.9 1590.1 L122.1 1591.2 C119.3 1589.8 116.2 1586.7 114.8 1583.9 L116.0 1583.1 C116.6 1582.7 116.9 1581.8 116.5 1581.1 L114.5 1577.6 C114.1 1576.9 113.2 1576.7 112.5 1577.1 Z" fill="#ffffff"/>
  <text x="140" y="1593" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="750" fill="${textoSuave}">${escaparSvg(
    EMPRESA_CELULAR
  )}</text>
  <circle cx="306" cy="1586" r="14" fill="${rojo}"/>
  <rect x="298" y="1579" width="17" height="13" rx="2" fill="none" stroke="#ffffff" stroke-width="2"/>
  <path d="M299 1581 L306.5 1587 L314 1581" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="330" y="1593" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="750" fill="${textoSuave}">${escaparSvg(
    EMPRESA_EMAIL
  )}</text>
  <circle cx="684" cy="1586" r="14" fill="${rojo}"/>
  <text x="684" y="1595" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="950" fill="#ffffff">f</text>
  <text x="708" y="1593" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="750" fill="${textoSuave}">Komodo Inmobiliaria</text>
  <circle cx="944" cy="1586" r="14" fill="${rojo}"/>
  <rect x="936" y="1578" width="16" height="16" rx="5" fill="none" stroke="#ffffff" stroke-width="2"/>
  <circle cx="944" cy="1586" r="4" fill="none" stroke="#ffffff" stroke-width="2"/>
  <circle cx="949" cy="1581" r="1.5" fill="#ffffff"/>
  <text x="968" y="1593" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="750" fill="${textoSuave}">Komodo Inmobiliaria</text>
  <path d="M0 1642 C250 1694 412 1698 620 1648 C816 1601 1000 1618 1240 1676 L1240 1754 L0 1754 Z" fill="#e8b1b1"/>
</svg>`;
};

const convertirSvgEnJpegDataUrl = async (
  svg: string,
  width: number,
  height: number
) =>
  new Promise<string>((resolve, reject) => {
    const svgBlob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas no disponible."));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.96));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo renderizar la ficha."));
    };

    image.src = url;
  });

const crearPdfDesdeJpeg = (
  jpegDataUrl: string,
  width: number,
  height: number
) => {
  const base64 = jpegDataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const partesHex: string[] = [];

  for (let index = 0; index < binary.length; index += 1) {
    partesHex.push(
      binary
        .charCodeAt(index)
        .toString(16)
        .padStart(2, "0")
    );
  }

  const hexStream = `${partesHex.join("")}>`;
  const content = "q\n595 0 0 842 0 0 cm\n/Im1 Do\nQ";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>",
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hexStream.length} >>\nstream\n${hexStream}\nendstream`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], {
    type: "application/pdf",
  });
};

const crearPdfSeparacion = async (
  lote: LoteCrm,
  form: SeparacionDirectaForm,
  profile: Profile | null
) => {
  const logoLasLomas =
    await cargarImagenDataUrl(LOGO_LAS_LOMAS);
  const width = 1240;
  const height = 1754;
  const renderScale = 2;
  const renderWidth = width * renderScale;
  const renderHeight = height * renderScale;
  const svg = crearSvgFichaSeparacion(
    lote,
    form,
    profile,
    logoLasLomas
  );
  const jpegDataUrl = await convertirSvgEnJpegDataUrl(
    svg,
    renderWidth,
    renderHeight
  );

  return crearPdfDesdeJpeg(
    jpegDataUrl,
    renderWidth,
    renderHeight
  );
};

const blobToBase64 = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
};
