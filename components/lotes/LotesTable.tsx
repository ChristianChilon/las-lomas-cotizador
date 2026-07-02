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

    if (!formSeparacion.dni.trim()) {
      return "Ingresa el DNI del cliente.";
    }

    if (!formSeparacion.celular.trim()) {
      return "Ingresa el celular del cliente.";
    }

    if (!formSeparacion.correo.trim()) {
      return "Ingresa el correo del cliente.";
    }

    if (!formSeparacion.montoSeparacion.trim()) {
      return "Ingresa el monto de separacion.";
    }

    if (!formSeparacion.fechaPagoInicial) {
      return "Ingresa la fecha de pago de la inicial.";
    }

    return null;
  };

  const construirObservacionesFicha = () => {
    const partes = [
      `Ocupacion: ${formSeparacion.ocupacion || "-"}`,
      `Direccion: ${formSeparacion.direccion || "-"}`,
      `Inicial: ${formSeparacion.inicial || "-"}`,
      `Meses: ${formSeparacion.meses || "-"}`,
      `Fecha de pago inicial: ${
        formSeparacion.fechaPagoInicial || "-"
      }`,
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

  const obtenerPdfFicha = () => {
    const errorValidacion = validarFicha();

    if (errorValidacion) {
      setError(errorValidacion);
      return null;
    }

    if (pdfGenerado) return pdfGenerado;

    const nuevoPdf = crearPdfSeparacion(
      loteSeparacion!,
      formSeparacion,
      profile
    );

    setPdfGenerado(nuevoPdf);
    return nuevoPdf;
  };

  const descargarFicha = () => {
    const pdf = obtenerPdfFicha();
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
    const pdf = obtenerPdfFicha();
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
          formSeparacion.fechaPagoInicial || null,
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

            <div style={modalGrid}>
              <input
                required
                value={formSeparacion.nombres}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "nombres",
                    event.target.value
                  )
                }
                placeholder="Nombres *"
                style={input}
              />
              <input
                value={formSeparacion.apellidos}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "apellidos",
                    event.target.value
                  )
                }
                placeholder="Apellidos"
                style={input}
              />
              <input
                required
                value={formSeparacion.dni}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "dni",
                    event.target.value
                  )
                }
                placeholder="DNI *"
                style={input}
              />
              <input
                required
                value={formSeparacion.celular}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "celular",
                    event.target.value
                  )
                }
                placeholder="Celular *"
                style={input}
              />
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
                placeholder="Correo del cliente *"
                style={input}
              />
              <input
                value={formSeparacion.ocupacion}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "ocupacion",
                    event.target.value
                  )
                }
                placeholder="Ocupacion"
                style={input}
              />
              <input
                value={formSeparacion.direccion}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "direccion",
                    event.target.value
                  )
                }
                placeholder="Direccion"
                style={input}
              />
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
                placeholder="Monto de separacion *"
                style={input}
              />
              <input
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
                placeholder="Inicial"
                style={input}
              />
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
              <input
                type="number"
                min="1"
                value={formSeparacion.meses}
                onChange={(event) =>
                  actualizarSeparacionForm(
                    "meses",
                    event.target.value
                  )
                }
                placeholder="Cuotas / meses"
                style={input}
              />
            </div>

            <textarea
              value={formSeparacion.observaciones}
              onChange={(event) =>
                actualizarSeparacionForm(
                  "observaciones",
                  event.target.value
                )
              }
              placeholder="Observaciones para la ficha"
              style={modalTextarea}
            />

            <div style={fichaResumen}>
              <span>
                Precio:{" "}
                {formatearMoneda(
                  loteSeparacion.precio
                )}
              </span>
              <span>
                Area:{" "}
                {formatearArea(
                  loteSeparacion.area
                )}
              </span>
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
  width: "min(760px, 96vw)",
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
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const modalTextarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: 82,
  padding: 12,
  resize: "vertical",
  marginTop: 10,
};

const fichaResumen: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
  color: "#334155",
  fontWeight: 900,
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

const limpiarPdfTexto = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const textoPdf = (
  x: number,
  y: number,
  texto: string,
  size = 11,
  font = "F1"
) =>
  `BT /${font} ${size} Tf ${x} ${y} Td (${limpiarPdfTexto(
    texto
  )}) Tj ET`;

const lineaPdf = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => `${x1} ${y1} m ${x2} ${y2} l S`;

const crearPdfSeparacion = (
  lote: LoteCrm,
  form: SeparacionDirectaForm,
  profile: Profile | null
) => {
  const precio = Number(lote.precio || 0);
  const montoSeparacion = Number(
    form.montoSeparacion || 0
  );
  const inicial = Number(form.inicial || 0);
  const montoFinanciar = Math.max(precio - inicial, 0);
  const nombreCompleto =
    `${form.nombres} ${form.apellidos}`.trim();
  const asesor =
    profile?.full_name || profile?.email || "-";

  const lines = [
    textoPdf(58, 790, "LAS LOMAS DE MALABRIGO", 16, "F2"),
    textoPdf(
      150,
      756,
      "PRE-ACUERDO DE PAGO POR SEPARACION DE LOTE",
      13,
      "F2"
    ),
    lineaPdf(150, 752, 445, 752),
    textoPdf(
      58,
      720,
      `Cliente: ${nombreCompleto}    DNI: ${form.dni}`
    ),
    textoPdf(
      58,
      700,
      `Ocupacion: ${form.ocupacion || "-"}    Celular: ${form.celular}`
    ),
    textoPdf(
      58,
      680,
      `Correo: ${form.correo || "-"}`
    ),
    textoPdf(
      58,
      660,
      `Direccion: ${form.direccion || "-"}`
    ),
    textoPdf(
      58,
      628,
      `Por concepto de separacion del lote MZ ${lote.mz} - LOTE ${lote.lote}.`
    ),
    textoPdf(
      58,
      608,
      "Proyecto: LAS LOMAS DE MALABRIGO."
    ),
    textoPdf(
      92,
      560,
      `Precio total: S/ ${precio.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      12,
      "F2"
    ),
    textoPdf(
      92,
      535,
      `Monto de separacion: S/ ${montoSeparacion.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      12,
      "F2"
    ),
    textoPdf(
      92,
      510,
      `Inicial: S/ ${inicial.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      12,
      "F2"
    ),
    textoPdf(
      92,
      485,
      `Fecha de pago de inicial: ${form.fechaPagoInicial || "-"}`
    ),
    textoPdf(
      92,
      460,
      `Monto a financiar: S/ ${montoFinanciar.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}    Cuotas de: ${form.meses || "-"}`
    ),
    textoPdf(
      58,
      420,
      "El comprador se compromete a cumplir con los pagos indicados."
    ),
    textoPdf(
      58,
      400,
      "En caso de incumplimiento o desistimiento, perdera la separacion sin opcion a reclamo.",
      10,
      "F2"
    ),
    textoPdf(
      360,
      350,
      `Fecha: ${new Date().toLocaleDateString("es-PE")}`
    ),
    lineaPdf(58, 255, 235, 255),
    textoPdf(58, 238, "Firma cliente", 10, "F2"),
    textoPdf(58, 222, `Nombre: ${nombreCompleto}`),
    textoPdf(58, 206, `DNI: ${form.dni}`),
    textoPdf(58, 190, `Celular: ${form.celular}`),
    lineaPdf(335, 255, 512, 255),
    textoPdf(335, 238, "Firma asesor", 10, "F2"),
    textoPdf(335, 222, `Asesor: ${asesor}`),
    textoPdf(335, 206, `Celular: ${profile?.phone || "-"}`),
    textoPdf(
      58,
      145,
      `Observaciones: ${form.observaciones || "-"}`
    ),
  ];

  const content = lines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
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
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], {
    type: "application/pdf",
  });
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
