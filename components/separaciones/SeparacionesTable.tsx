"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  colorEstado,
  esAdmin,
  esGerencia,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../lib/crm";

type SeparacionForm = {
  clienteId: string;
  loteId: string;
  monto: string;
  fechaLimite: string;
  observaciones: string;
  asesorId: string;
};

const formVacio: SeparacionForm = {
  clienteId: "",
  loteId: "",
  monto: "",
  fechaLimite: "",
  observaciones: "",
  asesorId: "",
};

type FiltroSeparaciones =
  | "TODAS"
  | "ACTIVAS"
  | "VENCIDAS"
  | "LIBERACION";

type EstadoVencimiento = {
  clave:
    | "VIGENTE"
    | "PRONTO"
    | "HOY"
    | "VENCIDA"
    | "SIN_FECHA"
    | "NO_ACTIVA";
  etiqueta: string;
  detalle: string;
  bg: string;
  fg: string;
  border: string;
};

const crearFechaLocal = (fecha?: string | null) => {
  if (!fecha) return null;

  const [year, month, day] = fecha
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const inicioDeHoy = () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
};

const pluralDias = (dias: number) =>
  dias === 1 ? "dia" : "dias";

const obtenerVencimientoSeparacion = (
  separacion: Separacion
): EstadoVencimiento => {
  const estado = separacion.estado?.toUpperCase();

  if (estado !== "ACTIVA") {
    return {
      clave: "NO_ACTIVA",
      etiqueta: estado || "Sin estado",
      detalle:
        estado === "CANCELADA"
          ? "Cancelada"
          : estado === "CONVERTIDA"
            ? "Convertida a venta"
            : estado === "VENCIDA"
              ? "Vencida"
              : "No activa",
      bg: "#f3f4f6",
      fg: "#4b5563",
      border: "#e5e7eb",
    };
  }

  const fechaLimite = crearFechaLocal(
    separacion.fecha_limite
  );

  if (!fechaLimite) {
    return {
      clave: "SIN_FECHA",
      etiqueta: "Sin fecha",
      detalle: "Sin fecha limite",
      bg: "#f3f4f6",
      fg: "#4b5563",
      border: "#e5e7eb",
    };
  }

  const diferenciaMs =
    fechaLimite.getTime() - inicioDeHoy().getTime();
  const dias = Math.round(
    diferenciaMs / (1000 * 60 * 60 * 24)
  );

  if (dias < 0) {
    const vencidaHace = Math.abs(dias);

    return {
      clave: "VENCIDA",
      etiqueta: "Vencida",
      detalle: `Vencida hace ${vencidaHace} ${pluralDias(
        vencidaHace
      )}`,
      bg: "#fbe0dc",
      fg: "#8b2f25",
      border: "#f4b9b0",
    };
  }

  if (dias === 0) {
    return {
      clave: "HOY",
      etiqueta: "Vence hoy",
      detalle: "Vence hoy",
      bg: "#fff0d6",
      fg: "#9a3412",
      border: "#fed7aa",
    };
  }

  if (dias <= 3) {
    return {
      clave: "PRONTO",
      etiqueta: "Vence pronto",
      detalle: `Vence en ${dias} ${pluralDias(dias)}`,
      bg: "#fff7dc",
      fg: "#7a4b12",
      border: "#f2d17a",
    };
  }

  return {
    clave: "VIGENTE",
    etiqueta: "Vigente",
    detalle: `Vence en ${dias} ${pluralDias(dias)}`,
    bg: "#e7f4eb",
    fg: "#17633a",
    border: "#b8dbc4",
  };
};

const formatearFechaLocal = (fecha?: string | null) => {
  const fechaLocal = crearFechaLocal(fecha);

  if (!fechaLocal) return "-";

  return fechaLocal.toLocaleDateString("es-PE");
};

export default function SeparacionesTable() {
  const searchParams = useSearchParams();

  const separacionDesdeUrl =
    searchParams.get("separacion");
    
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [asesores, setAsesores] = useState<Profile[]>(
    []
  );
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [form, setForm] =
    useState<SeparacionForm>(formVacio);
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState(false);
  const [anulando, setAnulando] =
    useState<string | null>(null);
  const [filtroSeparaciones, setFiltroSeparaciones] =
    useState<FiltroSeparaciones>("TODAS");
  
  const [solicitandoLiberacion, setSolicitandoLiberacion] =
    useState<string | null>(null);

  const [rechazandoLiberacion, setRechazandoLiberacion] =
    useState<string | null>(null);

  const [motivosLiberacion, setMotivosLiberacion] =
    useState<Record<string, string>>({});

  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    const [
      clientesRes,
      lotesRes,
      separacionesRes,
      perfilesRes,
    ] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,created_at,updated_at"
        )
        .order("created_at", {
          ascending: false,
        }),
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
        .from("separaciones")
        .select(
          "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
        )
        .order("created_at", {
          ascending: false,
        }),
      supabase
        .from("profiles")
        .select(
          "id,full_name,email,role,phone,active"
        ),
    ]);

    if (
      clientesRes.error ||
      lotesRes.error ||
      separacionesRes.error
    ) {
      setError(
        clientesRes.error?.message ||
          lotesRes.error?.message ||
          separacionesRes.error?.message ||
          "No se pudo cargar la informacion."
      );
      return;
    }

    setError(null);
    setClientes((clientesRes.data || []) as Cliente[]);
    setLotes((lotesRes.data || []) as LoteCrm[]);
    setSeparaciones(
      (separacionesRes.data || []) as Separacion[]
    );
    setAsesores(
      ((perfilesRes.data || []) as Profile[]).filter(
        (asesor) =>
          asesor.active !== false &&
          asesor.role === "asesor"
      )
    );
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  useEffect(() => {
    if (!separacionDesdeUrl) return;
    if (separaciones.length === 0) return;

    const timer = window.setTimeout(() => {
      const fila = document.getElementById(
        `separacion-${separacionDesdeUrl}`
      );

      fila?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [separacionDesdeUrl, separaciones]);

  const modoGerencia = esGerencia(profile);
  const puedeAnular = esAdmin(profile);

  const lotesDisponibles = useMemo(
    () =>
      lotes.filter((lote) => {
        const estadoPermitido = [
          "DISPONIBLE",
          "EN_NEGOCIACION",
        ].includes(lote.estado);

        if (!estadoPermitido) return false;
        if (modoGerencia) return true;

        return (
          !lote.asesor_id ||
          lote.asesor_id === profile?.id
        );
      }),
    [lotes, modoGerencia, profile?.id]
  );

  const clientesMap = useMemo(() => {
    const map: Record<string, Cliente> = {};
    clientes.forEach((cliente) => {
      map[cliente.id] = cliente;
    });
    return map;
  }, [clientes]);

  const lotesMap = useMemo(() => {
    const map: Record<number, LoteCrm> = {};
    lotes.forEach((lote) => {
      map[lote.id] = lote;
    });
    return map;
  }, [lotes]);

  const asesoresMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    asesores.forEach((asesor) => {
      map[asesor.id] = asesor;
    });
    if (profile) {
      map[profile.id] = profile;
    }
    return map;
  }, [asesores, profile]);

  const resumenSeparaciones = useMemo(() => {
    return separaciones.reduce(
      (acumulado, separacion) => {
        const vencimiento =
          obtenerVencimientoSeparacion(separacion);

        if (separacion.estado === "ACTIVA") {
          acumulado.activas += 1;
        }

        if (vencimiento.clave === "VENCIDA") {
          acumulado.vencidas += 1;
        }

        if (vencimiento.clave === "HOY") {
          acumulado.hoy += 1;
        }

        if (vencimiento.clave === "PRONTO") {
          acumulado.pronto += 1;
        }

        if (separacion.liberacion_solicitada) {
          acumulado.liberacion += 1;
        }

        return acumulado;
      },
      {
        activas: 0,
        vencidas: 0,
        hoy: 0,
        pronto: 0,
        liberacion: 0,
      }
    );
  }, [separaciones]);

  const separacionesFiltradas = useMemo(() => {
    return separaciones.filter((separacion) => {
      const vencimiento =
        obtenerVencimientoSeparacion(separacion);

      if (filtroSeparaciones === "ACTIVAS") {
        return separacion.estado === "ACTIVA";
      }

      if (filtroSeparaciones === "VENCIDAS") {
        return vencimiento.clave === "VENCIDA";
      }

      if (filtroSeparaciones === "LIBERACION") {
        return Boolean(separacion.liberacion_solicitada);
      }

      return true;
    });
  }, [filtroSeparaciones, separaciones]);

  const filtros = [
    {
      key: "TODAS" as const,
      label: "Todas",
      count: separaciones.length,
    },
    {
      key: "ACTIVAS" as const,
      label: "Activas",
      count: resumenSeparaciones.activas,
    },
    {
      key: "VENCIDAS" as const,
      label: "Vencidas",
      count: resumenSeparaciones.vencidas,
    },
    {
      key: "LIBERACION" as const,
      label: "Liberacion solicitada",
      count: resumenSeparaciones.liberacion,
    },
  ];

  const actualizarForm = (
    campo: keyof SeparacionForm,
    valor: string
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const crearSeparacion = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    if (!supabase) return;

    setGuardando(true);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_crear_separacion", {
        p_lote_id: Number(form.loteId),
        p_cliente_id: form.clienteId,
        p_monto:
          form.monto.trim() === ""
            ? null
            : Number(form.monto),
        p_fecha_limite:
          form.fechaLimite || null,
        p_observaciones:
          form.observaciones.trim() || null,
        p_asesor_id:
          modoGerencia && form.asesorId
            ? form.asesorId
            : null,
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        "Separacion creada y lote actualizado."
      );
      setForm(formVacio);
      await cargar();
    }

    setGuardando(false);
  };

  const anularSeparacion = async (
    separacion: Separacion
  ) => {
    if (!supabase || !puedeAnular) return;

    setAnulando(separacion.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_anular_separacion", {
        p_separacion_id: separacion.id,
        p_motivo:
          "Anulacion desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje("Separacion anulada.");
      await cargar();
    }

    setAnulando(null);
  };

  const solicitarLiberacion = async (
    separacion: Separacion
  ) => {
    if (!supabase || !profile) return;

    const motivo =
      motivosLiberacion[separacion.id]?.trim() || "";

    if (!motivo) {
      setError(
        "Escribe el motivo de la liberación antes de solicitarla."
      );
      return;
    }

    setSolicitandoLiberacion(separacion.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_solicitar_liberacion_separacion",
      {
        p_separacion_id: separacion.id,
        p_motivo: motivo,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        "Solicitud de liberación enviada a gerencia."
      );
      setMotivosLiberacion((actual) => ({
        ...actual,
        [separacion.id]: "",
      }));
      await cargar();
    }

    setSolicitandoLiberacion(null);
  };

  const aprobarLiberacion = async (
    separacion: Separacion
  ) => {
    if (!supabase || !puedeAnular || !profile) return;

    setAnulando(separacion.id);
    setMensaje(null);
    setError(null);

    const motivo =
      separacion.motivo_liberacion ||
      "Liberación aprobada desde panel CRM";

    const { error: rpcError } =
      await supabase.rpc("crm_anular_separacion", {
        p_separacion_id: separacion.id,
        p_motivo: motivo,
      });

    if (rpcError) {
      setError(rpcError.message);
      setAnulando(null);
      return;
    }

    const {
      data: separacionesActivas,
      error: separacionesActivasError,
    } = await supabase
      .from("separaciones")
      .select("id")
      .eq("cliente_id", separacion.cliente_id)
      .eq("estado", "ACTIVA");

    if (separacionesActivasError) {
      setError(separacionesActivasError.message);
      setAnulando(null);
      return;
    }

    const tieneOtraSeparacionActiva =
      (separacionesActivas || []).length > 0;

    const { error: clienteUpdateError } = await supabase
      .from("clientes")
      .update(
        tieneOtraSeparacionActiva
          ? {
              estado_lead: "SEPARADO",
              proxima_accion: "ESPERAR_PAGO",
            }
          : {
              estado_lead: "SEGUIMIENTO",
              proxima_accion: "VOLVER_A_CONTACTAR",
              fecha_proximo_seguimiento: new Date()
                .toISOString()
                .slice(0, 10),
            }
      )
      .eq("id", separacion.cliente_id);

    if (clienteUpdateError) {
      setError(clienteUpdateError.message);
      setAnulando(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("separaciones")
      .update({
        liberacion_solicitada: false,
        fecha_liberacion_resuelta:
          new Date().toISOString(),
        resuelto_liberacion_por: profile.id,
      })
      .eq("id", separacion.id);

    if (updateError) {
      setError(updateError.message);
      setAnulando(null);
      return;
    }

    setMensaje(
      tieneOtraSeparacionActiva
        ? "Liberación aprobada. La separación fue anulada, pero el cliente mantiene otra separación activa."
        : "Liberación aprobada. La separación fue anulada y el cliente volvió a seguimiento."
    );

    await cargar();
    setAnulando(null);
  };

  const rechazarLiberacion = async (
    separacion: Separacion
  ) => {
    if (!supabase || !puedeAnular || !profile) return;

    setRechazandoLiberacion(separacion.id);
    setMensaje(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("separaciones")
      .update({
        liberacion_solicitada: false,
        motivo_liberacion:
          separacion.motivo_liberacion
            ? `${separacion.motivo_liberacion}\n\nSolicitud rechazada por gerencia.`
            : "Solicitud de liberación rechazada por gerencia.",
        fecha_liberacion_resuelta:
          new Date().toISOString(),
        resuelto_liberacion_por: profile.id,
      })
      .eq("id", separacion.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMensaje(
        "Solicitud de liberación rechazada."
      );
      await cargar();
    }

    setRechazandoLiberacion(null);
  };

  return (
    <section>
      <form onSubmit={crearSeparacion} style={formBox}>
        <div style={formGrid}>
          <select
            required
            value={form.clienteId}
            onChange={(event) =>
              actualizarForm(
                "clienteId",
                event.target.value
              )
            }
            style={input}
          >
            <option value="">Cliente</option>
            {clientes.map((cliente) => (
              <option
                key={cliente.id}
                value={cliente.id}
              >
                {nombreCliente(cliente)}
              </option>
            ))}
          </select>
          <select
            required
            value={form.loteId}
            onChange={(event) =>
              actualizarForm(
                "loteId",
                event.target.value
              )
            }
            style={input}
          >
            <option value="">Lote disponible</option>
            {lotesDisponibles.map((lote) => (
              <option
                key={lote.id}
                value={lote.id}
              >
                MZ {lote.mz} - Lote {lote.lote} -{" "}
                {formatearArea(lote.area)}
              </option>
            ))}
          </select>
          {modoGerencia && (
            <select
              value={form.asesorId}
              onChange={(event) =>
                actualizarForm(
                  "asesorId",
                  event.target.value
                )
              }
              style={input}
            >
              <option value="">
                Usar asesor del cliente
              </option>
              {asesores.map((asesor) => (
                <option
                  key={asesor.id}
                  value={asesor.id}
                >
                  {asesor.full_name ||
                    asesor.email}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monto}
            onChange={(event) =>
              actualizarForm("monto", event.target.value)
            }
            placeholder="Monto de separacion"
            style={input}
          />
          <input
            type="date"
            value={form.fechaLimite}
            onChange={(event) =>
              actualizarForm(
                "fechaLimite",
                event.target.value
              )
            }
            style={input}
          />
        </div>
        <textarea
          value={form.observaciones}
          onChange={(event) =>
            actualizarForm(
              "observaciones",
              event.target.value
            )
          }
          placeholder="Observaciones"
          style={textarea}
        />
        <button
          disabled={guardando}
          type="submit"
          style={primaryButton}
        >
          {guardando
            ? "Guardando..."
            : "Crear separacion"}
        </button>
      </form>

      {mensaje && (
        <div style={success}>{mensaje}</div>
      )}
      {error && <div style={alert}>{error}</div>}

      <div style={resumenBar}>
        <div style={resumenItem}>
          <strong>{resumenSeparaciones.vencidas}</strong>
          <span>Vencidas</span>
        </div>
        <div style={resumenItem}>
          <strong>{resumenSeparaciones.hoy}</strong>
          <span>Vencen hoy</span>
        </div>
        <div style={resumenItem}>
          <strong>{resumenSeparaciones.pronto}</strong>
          <span>Vencen pronto</span>
        </div>
        <div style={resumenItem}>
          <strong>{resumenSeparaciones.liberacion}</strong>
          <span>Liberacion solicitada</span>
        </div>
      </div>

      <div style={filtrosBar}>
        {filtros.map((filtro) => {
          const activo =
            filtroSeparaciones === filtro.key;

          return (
            <button
              key={filtro.key}
              type="button"
              onClick={() =>
                setFiltroSeparaciones(filtro.key)
              }
              style={{
                ...filterButton,
                ...(activo ? filterButtonActive : {}),
              }}
            >
              <span>{filtro.label}</span>
              <strong>{filtro.count}</strong>
            </button>
          );
        })}
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {[
                "Lote",
                "Cliente",
                "Asesor",
                "Monto",
                "Vencimiento",
                "Estado",
                "Registro",
                "Accion",
              ].map((head) => (
                <th key={head} style={th}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {separacionesFiltradas.map((separacion) => {
              const lote = separacion.lote_id
                ? lotesMap[separacion.lote_id]
                : null;
              const cliente =
                separacion.cliente_id
                  ? clientesMap[separacion.cliente_id]
                  : null;
              const asesor = separacion.asesor_id
                ? asesoresMap[separacion.asesor_id]
                : null;
              const estadoColor = colorEstado(
                lote?.estado || "SEPARADO"
              );
              const vencimiento =
                obtenerVencimientoSeparacion(
                  separacion
                );

              return (
                <tr
                  key={separacion.id}
                  id={`separacion-${separacion.id}`}
                  style={
                    separacionDesdeUrl === separacion.id
                      ? filaResaltada
                      : undefined
                  }
                >
                  <td style={td}>
                    {lote
                      ? `MZ ${lote.mz} - Lote ${lote.lote}`
                      : "-"}
                  </td>
                  <td style={td}>
                    {nombreCliente(cliente) || "-"}
                  </td>
                  <td style={td}>
                    {asesor?.full_name ||
                      asesor?.email ||
                      "-"}
                  </td>
                  <td style={td}>
                    {separacion.monto_separacion
                      ? formatearMoneda(
                          separacion.monto_separacion
                        )
                      : "-"}
                  </td>
                  <td style={td}>
                    <div style={vencimientoStack}>
                      <span style={vencimientoDate}>
                        {formatearFechaLocal(
                          separacion.fecha_limite
                        )}
                      </span>
                      <span
                        title={vencimiento.etiqueta}
                        style={{
                          ...vencimientoBadge,
                          background: vencimiento.bg,
                          color: vencimiento.fg,
                          borderColor:
                            vencimiento.border,
                        }}
                      >
                        {vencimiento.detalle}
                      </span>
                    </div>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        ...badge,
                        background: estadoColor.bg,
                        color: estadoColor.fg,
                      }}
                    >
                      {separacion.estado}
                    </span>
                  </td>
                  <td style={td}>
                    {separacion.created_at
                      ? new Date(
                          separacion.created_at
                        ).toLocaleDateString("es-PE")
                      : "-"}
                  </td>
                  <td style={td}>
                    {separacion.estado === "ACTIVA" ? (
                      separacion.liberacion_solicitada ? (
                        puedeAnular ? (
                          <div style={actionStack}>
                            <div style={liberacionNotice}>
                              Liberación solicitada
                              {separacion.motivo_liberacion && (
                                <small>
                                  Motivo: {separacion.motivo_liberacion}
                                </small>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={anulando === separacion.id}
                              onClick={() =>
                                aprobarLiberacion(separacion)
                              }
                              style={dangerButton}
                            >
                              {anulando === separacion.id
                                ? "Liberando..."
                                : "Aprobar liberación"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                rechazandoLiberacion === separacion.id
                              }
                              onClick={() =>
                                rechazarLiberacion(separacion)
                              }
                              style={secondaryButton}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <div style={liberacionNotice}>
                            Liberación solicitada
                            {separacion.motivo_liberacion && (
                              <small>
                                Motivo: {separacion.motivo_liberacion}
                              </small>
                            )}
                          </div>
                        )
                      ) : puedeAnular ? (
                        <button
                          type="button"
                          disabled={anulando === separacion.id}
                          onClick={() =>
                            anularSeparacion(separacion)
                          }
                          style={dangerButton}
                        >
                          {anulando === separacion.id
                            ? "Anulando..."
                            : "Anular"}
                        </button>
                      ) : (
                        <div style={actionStack}>
                          <textarea
                            value={motivosLiberacion[separacion.id] || ""}
                            onChange={(event) =>
                              setMotivosLiberacion((actual) => ({
                                ...actual,
                                [separacion.id]: event.target.value,
                              }))
                            }
                            placeholder="Motivo para liberar"
                            style={miniTextarea}
                          />

                          <button
                            type="button"
                            disabled={
                              solicitandoLiberacion === separacion.id
                            }
                            onClick={() =>
                              solicitarLiberacion(separacion)
                            }
                            style={warningButton}
                          >
                            {solicitandoLiberacion === separacion.id
                              ? "Solicitando..."
                              : "Solicitar liberación"}
                          </button>
                        </div>
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
            {separacionesFiltradas.length === 0 && (
              <tr>
                <td colSpan={8} style={emptyState}>
                  No hay separaciones para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const formBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 14px 36px rgba(15,23,42,.06)",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const input: React.CSSProperties = {
  height: 42,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
};

const textarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: 82,
  marginTop: 12,
  padding: 12,
  resize: "vertical",
};

const primaryButton: React.CSSProperties = {
  marginTop: 12,
  height: 42,
  border: 0,
  borderRadius: 12,
  padding: "0 18px",
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  height: 34,
  border: 0,
  borderRadius: 10,
  padding: "0 12px",
  background: "#f7dad6",
  color: "#8b2f25",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  height: 34,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 12px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
};

const warningButton: React.CSSProperties = {
  minHeight: 34,
  border: "1px solid #d9b85f",
  borderRadius: 10,
  padding: "0 12px",
  background: "#fff7dc",
  color: "#6b4e00",
  fontWeight: 900,
  cursor: "pointer",
};

const actionStack: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 220,
};

const miniTextarea: React.CSSProperties = {
  width: "100%",
  minHeight: 58,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 8,
  resize: "vertical",
  fontSize: 12,
  color: "#111827",
};

const liberacionNotice: React.CSSProperties = {
  borderRadius: 10,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  padding: 8,
  fontSize: 12,
  fontWeight: 900,
  display: "grid",
  gap: 4,
};

const filaResaltada: React.CSSProperties = {
  background: "#fff8e1",
  boxShadow: "inset 5px 0 0 #d97706",
};

const resumenBar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const resumenItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#ffffff",
  padding: "12px 14px",
  display: "grid",
  gap: 3,
  boxShadow: "0 10px 28px rgba(15,23,42,.05)",
};

const filtrosBar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 14,
};

const filterButton: React.CSSProperties = {
  height: 38,
  border: "1px solid #d7ded4",
  borderRadius: 999,
  padding: "0 12px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const filterButtonActive: React.CSSProperties = {
  background: "#0f3b2f",
  color: "#ffffff",
  borderColor: "#0f3b2f",
};

const vencimientoStack: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 136,
};

const vencimientoDate: React.CSSProperties = {
  color: "#111827",
  fontWeight: 800,
};

const vencimientoBadge: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: 999,
  border: "1px solid",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const emptyState: React.CSSProperties = {
  padding: "26px 16px",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 800,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
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
