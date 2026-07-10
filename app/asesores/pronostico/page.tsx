"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  colorEstado,
  esGerencia,
  etiquetaEstado,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type EtapaForecast =
  | "EN_NEGOCIACION"
  | "SEPARADO"
  | "CIERRE_SOLICITADO"
  | "VENDIDO";

type RiesgoSeparacion =
  | "VENCIDA"
  | "HOY"
  | "PRONTO"
  | "VIGENTE"
  | "SIN_FECHA";

type ForecastAsesor = {
  asesorId: string;
  asesorNombre: string;
  clientes: number;
  calientes: number;
  negociacion: number;
  separados: number;
  cierres: number;
  vendidos: number;
  montoNegociacion: number;
  montoSeparado: number;
  montoCierre: number;
  montoVendido: number;
  forecastPonderado: number;
  riesgo: number;
};

type SeparacionRiesgo = {
  separacion: Separacion;
  cliente?: Cliente;
  lote?: LoteCrm;
  riesgo: RiesgoSeparacion;
  detalle: string;
  prioridad: number;
};

const SIN_ASESOR_ID = "sin-asesor";

const pesosForecast: Record<EtapaForecast, number> = {
  EN_NEGOCIACION: 0.35,
  SEPARADO: 0.7,
  CIERRE_SOLICITADO: 0.95,
  VENDIDO: 1,
};

const inicioMesISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
};

const crearFechaLocal = (fecha?: string | null) => {
  if (!fecha) return null;

  const [year, month, day] = fecha
    .split("T")[0]
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const diasHasta = (fecha?: string | null) => {
  const fechaLocal = crearFechaLocal(fecha);

  if (!fechaLocal) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return Math.round(
    (fechaLocal.getTime() - hoy.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const formatearFechaLocal = (fecha?: string | null) => {
  const fechaLocal = crearFechaLocal(fecha);

  if (!fechaLocal) return "-";

  return fechaLocal.toLocaleDateString("es-PE");
};

const porcentaje = (valor: number) =>
  `${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;

const nombreLote = (lote?: LoteCrm | null) =>
  lote ? `MZ ${lote.mz} - LOTE ${lote.lote}` : "Lote sin dato";

const crearForecastVacio = (
  asesorId: string,
  asesorNombre: string
): ForecastAsesor => ({
  asesorId,
  asesorNombre,
  clientes: 0,
  calientes: 0,
  negociacion: 0,
  separados: 0,
  cierres: 0,
  vendidos: 0,
  montoNegociacion: 0,
  montoSeparado: 0,
  montoCierre: 0,
  montoVendido: 0,
  forecastPonderado: 0,
  riesgo: 0,
});

const obtenerRiesgoSeparacion = (
  separacion: Separacion
): {
  riesgo: RiesgoSeparacion;
  detalle: string;
  prioridad: number;
} => {
  if (separacion.estado !== "ACTIVA") {
    return {
      riesgo: "VIGENTE",
      detalle: "No activa",
      prioridad: 5,
    };
  }

  const dias = diasHasta(separacion.fecha_limite);

  if (dias === null) {
    return {
      riesgo: "SIN_FECHA",
      detalle: "Sin fecha limite",
      prioridad: 3,
    };
  }

  if (dias < 0) {
    const vencidaHace = Math.abs(dias);

    return {
      riesgo: "VENCIDA",
      detalle: `Vencida hace ${vencidaHace} ${
        vencidaHace === 1 ? "dia" : "dias"
      }`,
      prioridad: 1,
    };
  }

  if (dias === 0) {
    return {
      riesgo: "HOY",
      detalle: "Vence hoy",
      prioridad: 1,
    };
  }

  if (dias <= 3) {
    return {
      riesgo: "PRONTO",
      detalle: `Vence en ${dias} ${dias === 1 ? "dia" : "dias"}`,
      prioridad: 2,
    };
  }

  return {
    riesgo: "VIGENTE",
    detalle: `Vence en ${dias} dias`,
    prioridad: 4,
  };
};

const colorRiesgo = (riesgo: RiesgoSeparacion) => {
  switch (riesgo) {
    case "VENCIDA":
      return {
        bg: "#fbe0dc",
        fg: "#8b2f25",
        border: "#f4b9b0",
      };
    case "HOY":
      return {
        bg: "#fff0d6",
        fg: "#9a3412",
        border: "#fed7aa",
      };
    case "PRONTO":
      return {
        bg: "#fff7dc",
        fg: "#7a4b12",
        border: "#f2d17a",
      };
    case "SIN_FECHA":
      return {
        bg: "#f1f5f9",
        fg: "#475569",
        border: "#cbd5e1",
      };
    default:
      return {
        bg: "#e7f4eb",
        fg: "#17633a",
        border: "#b8dbc4",
      };
  }
};

export default function PronosticoPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [asesorFiltro, setAsesorFiltro] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

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

    let clientesQuery = supabase.from("clientes").select(
      [
        "id",
        "nombres",
        "apellidos",
        "dni",
        "celular",
        "correo",
        "asesor_id",
        "lote_interes_id",
        "nivel_interes",
        "estado_lead",
        "proxima_accion",
        "fecha_proximo_seguimiento",
        "created_at",
        "updated_at",
      ].join(",")
    );

    let lotesQuery = supabase
      .from(LOTES_TABLE)
      .select(
        "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
      );

    let separacionesQuery = supabase
      .from("separaciones")
      .select(
        "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
      );

    if (!modoGerencia) {
      clientesQuery = clientesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      lotesQuery = lotesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      separacionesQuery = separacionesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const [
      asesoresResult,
      clientesResult,
      lotesResult,
      separacionesResult,
    ] = await Promise.all([
      modoGerencia
        ? supabase
            .from("profiles")
            .select("id,full_name,email,role,phone,active")
            .eq("role", "asesor")
            .order("full_name", {
              ascending: true,
              nullsFirst: false,
            })
        : Promise.resolve({ data: [], error: null }),
      clientesQuery,
      lotesQuery,
      separacionesQuery,
    ]);

    const errorActual =
      asesoresResult.error ||
      clientesResult.error ||
      lotesResult.error ||
      separacionesResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setAsesores(
      (asesoresResult.data || []) as unknown as Profile[]
    );
    setClientes(
      (clientesResult.data || []) as unknown as Cliente[]
    );
    setLotes(
      (lotesResult.data || []) as unknown as LoteCrm[]
    );
    setSeparaciones(
      (separacionesResult.data || []) as unknown as Separacion[]
    );
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const asesoresPorId = useMemo(() => {
    const mapa = new Map<string, Profile>();

    asesores.forEach((asesor) => {
      mapa.set(asesor.id, asesor);
    });

    if (profile) {
      mapa.set(profile.id, profile);
    }

    return mapa;
  }, [asesores, profile]);

  const datosFiltrados = useMemo(() => {
    if (!modoGerencia || asesorFiltro === "TODOS") {
      return {
        clientes,
        lotes,
        separaciones,
      };
    }

    return {
      clientes: clientes.filter(
        (cliente) => cliente.asesor_id === asesorFiltro
      ),
      lotes: lotes.filter((lote) => lote.asesor_id === asesorFiltro),
      separaciones: separaciones.filter(
        (separacion) => separacion.asesor_id === asesorFiltro
      ),
    };
  }, [
    asesorFiltro,
    clientes,
    lotes,
    modoGerencia,
    separaciones,
  ]);

  const clientesPorId = useMemo(() => {
    const mapa = new Map<string, Cliente>();

    datosFiltrados.clientes.forEach((cliente) => {
      mapa.set(cliente.id, cliente);
    });

    return mapa;
  }, [datosFiltrados.clientes]);

  const lotesPorId = useMemo(() => {
    const mapa = new Map<number, LoteCrm>();

    datosFiltrados.lotes.forEach((lote) => {
      mapa.set(lote.id, lote);
    });

    return mapa;
  }, [datosFiltrados.lotes]);

  const forecastPorAsesor = useMemo(() => {
    const mapa = new Map<string, ForecastAsesor>();
    const asegurar = (
      asesorId: string | null | undefined
    ) => {
      const id = asesorId || SIN_ASESOR_ID;
      const existente = mapa.get(id);

      if (existente) return existente;

      const asesor = asesoresPorId.get(id);
      const nuevo = crearForecastVacio(
        id,
        asesor?.full_name ||
          asesor?.email ||
          (id === SIN_ASESOR_ID
            ? "Sin asesor asignado"
            : "Asesor")
      );
      mapa.set(id, nuevo);

      return nuevo;
    };

    datosFiltrados.clientes.forEach((cliente) => {
      const item = asegurar(cliente.asesor_id);
      item.clientes += 1;

      if (cliente.nivel_interes === "CALIENTE") {
        item.calientes += 1;
      }
    });

    datosFiltrados.lotes.forEach((lote) => {
      const item = asegurar(lote.asesor_id);
      const precio = Number(lote.precio || 0);

      if (lote.estado === "EN_NEGOCIACION") {
        item.negociacion += 1;
        item.montoNegociacion += precio;
      }

      if (lote.estado === "SEPARADO") {
        item.separados += 1;
        item.montoSeparado += precio;
      }

      if (lote.estado === "CIERRE_SOLICITADO") {
        item.cierres += 1;
        item.montoCierre += precio;
      }

      if (lote.estado === "VENDIDO") {
        item.vendidos += 1;
        item.montoVendido += precio;
      }
    });

    datosFiltrados.separaciones.forEach((separacion) => {
      const riesgo = obtenerRiesgoSeparacion(separacion);
      const item = asegurar(separacion.asesor_id);

      if (
        separacion.estado === "ACTIVA" &&
        ["VENCIDA", "HOY", "PRONTO", "SIN_FECHA"].includes(
          riesgo.riesgo
        )
      ) {
        item.riesgo += 1;
      }
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        forecastPonderado:
          item.montoNegociacion * pesosForecast.EN_NEGOCIACION +
          item.montoSeparado * pesosForecast.SEPARADO +
          item.montoCierre * pesosForecast.CIERRE_SOLICITADO,
      }))
      .sort((a, b) => {
        if (b.forecastPonderado !== a.forecastPonderado) {
          return b.forecastPonderado - a.forecastPonderado;
        }

        return b.montoVendido - a.montoVendido;
      });
  }, [
    asesoresPorId,
    datosFiltrados.clientes,
    datosFiltrados.lotes,
    datosFiltrados.separaciones,
  ]);

  const resumen = useMemo(
    () =>
      forecastPorAsesor.reduce(
        (acc, item) => ({
          clientes: acc.clientes + item.clientes,
          calientes: acc.calientes + item.calientes,
          negociacion: acc.negociacion + item.negociacion,
          separados: acc.separados + item.separados,
          cierres: acc.cierres + item.cierres,
          vendidos: acc.vendidos + item.vendidos,
          montoPipeline:
            acc.montoPipeline +
            item.montoNegociacion +
            item.montoSeparado +
            item.montoCierre,
          forecastPonderado:
            acc.forecastPonderado + item.forecastPonderado,
          montoVendido: acc.montoVendido + item.montoVendido,
          riesgo: acc.riesgo + item.riesgo,
        }),
        {
          clientes: 0,
          calientes: 0,
          negociacion: 0,
          separados: 0,
          cierres: 0,
          vendidos: 0,
          montoPipeline: 0,
          forecastPonderado: 0,
          montoVendido: 0,
          riesgo: 0,
        }
      ),
    [forecastPorAsesor]
  );

  const vendidosMes = useMemo(() => {
    const inicio = inicioMesISO();

    return datosFiltrados.lotes.filter(
      (lote) =>
        lote.estado === "VENDIDO" &&
        (lote.updated_at || "") >= inicio
    );
  }, [datosFiltrados.lotes]);

  const separacionesRiesgo = useMemo<SeparacionRiesgo[]>(
    () =>
      datosFiltrados.separaciones
        .filter((separacion) => separacion.estado === "ACTIVA")
        .map((separacion) => {
          const riesgo = obtenerRiesgoSeparacion(separacion);

          return {
            separacion,
            cliente: separacion.cliente_id
              ? clientesPorId.get(separacion.cliente_id)
              : undefined,
            lote: separacion.lote_id
              ? lotesPorId.get(Number(separacion.lote_id))
              : undefined,
            ...riesgo,
          };
        })
        .filter((item) => item.riesgo !== "VIGENTE")
        .sort((a, b) => a.prioridad - b.prioridad)
        .slice(0, 8),
    [
      clientesPorId,
      datosFiltrados.separaciones,
      lotesPorId,
    ]
  );

  const eficiencia = resumen.montoPipeline
    ? (resumen.forecastPonderado / resumen.montoPipeline) * 100
    : 0;

  return (
    <AsesorLayout
      title="Pronostico"
      subtitle={
        modoGerencia
          ? "Forecast comercial del equipo: pipeline, riesgo y valor ponderado."
          : "Tu forecast personal: oportunidades, separaciones y cierres."
      }
    >
      <section>
        <div style={toolbar}>
          <div>
            <h1 style={title}>Pronostico comercial</h1>
            <p style={subtitle}>
              Mide el valor real del pipeline usando pesos por etapa:
              negociacion 35%, separado 70% y cierre solicitado
              95%.
            </p>
          </div>

          <div style={toolbarActions}>
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
        </div>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <span>Pipeline bruto</span>
            <strong>{formatearMoneda(resumen.montoPipeline)}</strong>
          </div>

          <div style={summaryCardGreen}>
            <span>Forecast ponderado</span>
            <strong>
              {formatearMoneda(resumen.forecastPonderado)}
            </strong>
          </div>

          <div style={summaryCardBlue}>
            <span>Cierres solicitados</span>
            <strong>{resumen.cierres}</strong>
          </div>

          <div style={summaryCardGold}>
            <span>Separaciones en riesgo</span>
            <strong>{resumen.riesgo}</strong>
          </div>

          <div style={summaryCardRed}>
            <span>Ventas del mes</span>
            <strong>
              {formatearMoneda(
                vendidosMes.reduce(
                  (acc, lote) => acc + Number(lote.precio || 0),
                  0
                )
              )}
            </strong>
          </div>
        </div>

        <div style={insightGrid}>
          <article style={insightBox}>
            <span>Salud del forecast</span>
            <strong>{porcentaje(eficiencia)}</strong>
            <p>
              Relacion entre pipeline bruto y valor ponderado. Mientras
              mas alto, mas cerca esta el equipo de convertir
              oportunidades en caja.
            </p>
          </article>

          <article style={insightBox}>
            <span>Oportunidades activas</span>
            <strong>
              {resumen.negociacion + resumen.separados + resumen.cierres}
            </strong>
            <p>
              Lotes en negociacion, separados o con cierre solicitado.
              Este numero debe revisarse diariamente.
            </p>
          </article>

          <article style={insightBox}>
            <span>Leads calientes</span>
            <strong>{resumen.calientes}</strong>
            <p>
              Clientes con mayor probabilidad de avanzar a negociacion,
              separacion o cierre en los proximos dias.
            </p>
          </article>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>Cargando pronostico...</div>
        ) : (
          <>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Forecast por asesor</h2>
                <p style={sectionText}>
                  Lectura de valor por etapa, ventas y riesgo operativo.
                </p>
              </div>
            </div>

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Asesor</th>
                    <th style={th}>Clientes</th>
                    <th style={th}>Calientes</th>
                    <th style={th}>Neg.</th>
                    <th style={th}>Sep.</th>
                    <th style={th}>Cierres</th>
                    <th style={th}>Vendido</th>
                    <th style={th}>Pipeline</th>
                    <th style={th}>Forecast</th>
                    <th style={th}>Riesgo</th>
                  </tr>
                </thead>

                <tbody>
                  {forecastPorAsesor.map((item) => {
                    const pipeline =
                      item.montoNegociacion +
                      item.montoSeparado +
                      item.montoCierre;

                    return (
                      <tr key={item.asesorId}>
                        <td style={tdStrong}>{item.asesorNombre}</td>
                        <td style={td}>{item.clientes}</td>
                        <td style={td}>{item.calientes}</td>
                        <td style={td}>{item.negociacion}</td>
                        <td style={td}>{item.separados}</td>
                        <td style={td}>{item.cierres}</td>
                        <td style={td}>
                          {formatearMoneda(item.montoVendido)}
                        </td>
                        <td style={td}>{formatearMoneda(pipeline)}</td>
                        <td style={tdStrong}>
                          {formatearMoneda(item.forecastPonderado)}
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              ...riskPill,
                              ...(item.riesgo > 0
                                ? riskPillRed
                                : riskPillGreen),
                            }}
                          >
                            {item.riesgo}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {forecastPorAsesor.length === 0 && (
                    <tr>
                      <td colSpan={10} style={emptyTable}>
                        Todavia no hay datos suficientes para el
                        pronostico.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={sectionGrid}>
              <article style={panel}>
                <div style={sectionHeaderCompact}>
                  <div>
                    <h2 style={sectionTitle}>
                      Separaciones en riesgo
                    </h2>
                    <p style={sectionText}>
                      Vencidas, por vencer o sin fecha limite.
                    </p>
                  </div>
                  <Link
                    href="/asesores/separaciones"
                    style={secondaryButton}
                  >
                    Ver separaciones
                  </Link>
                </div>

                {separacionesRiesgo.length === 0 ? (
                  <div style={emptyBox}>
                    No hay separaciones en riesgo.
                  </div>
                ) : (
                  <div style={riskList}>
                    {separacionesRiesgo.map((item) => {
                      const color = colorRiesgo(item.riesgo);

                      return (
                        <div
                          key={item.separacion.id}
                          style={riskItem}
                        >
                          <div>
                            <strong>{nombreLote(item.lote)}</strong>
                            <p>
                              {item.cliente
                                ? nombreCliente(item.cliente)
                                : "Cliente sin dato"}
                            </p>
                          </div>

                          <div style={riskRight}>
                            <span
                              style={{
                                ...riskBadge,
                                background: color.bg,
                                color: color.fg,
                                borderColor: color.border,
                              }}
                            >
                              {item.detalle}
                            </span>
                            <small>
                              Limite:{" "}
                              {formatearFechaLocal(
                                item.separacion.fecha_limite
                              )}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article style={panel}>
                <div style={sectionHeaderCompact}>
                  <div>
                    <h2 style={sectionTitle}>Oportunidades clave</h2>
                    <p style={sectionText}>
                      Lotes con mayor probabilidad comercial por estado.
                    </p>
                  </div>
                  <Link href="/asesores/lotes" style={secondaryButton}>
                    Ver lotes
                  </Link>
                </div>

                <div style={opportunityList}>
                  {datosFiltrados.lotes
                    .filter((lote) =>
                      [
                        "EN_NEGOCIACION",
                        "SEPARADO",
                        "CIERRE_SOLICITADO",
                      ].includes(lote.estado)
                    )
                    .sort(
                      (a, b) =>
                        Number(b.precio || 0) - Number(a.precio || 0)
                    )
                    .slice(0, 8)
                    .map((lote) => {
                      const estadoColor = colorEstado(lote.estado);
                      const cliente = lote.cliente_id
                        ? clientesPorId.get(lote.cliente_id)
                        : undefined;

                      return (
                        <div key={lote.id} style={opportunityItem}>
                          <div>
                            <strong>{nombreLote(lote)}</strong>
                            <p>
                              {cliente
                                ? nombreCliente(cliente)
                                : "Sin cliente vinculado"}
                            </p>
                          </div>

                          <div style={riskRight}>
                            <span
                              style={{
                                ...riskBadge,
                                background: estadoColor.bg,
                                color: estadoColor.fg,
                                borderColor: estadoColor.bg,
                              }}
                            >
                              {etiquetaEstado(lote.estado)}
                            </span>
                            <small>{formatearMoneda(lote.precio)}</small>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    </AsesorLayout>
  );
}

const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  flexWrap: "wrap",
};

const toolbarActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  lineHeight: 1.45,
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

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
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

const summaryCardGold: React.CSSProperties = {
  ...summaryBase,
  background: "#fff8e1",
  color: "#8a5a00",
  borderColor: "#eed28a",
};

const summaryCardRed: React.CSSProperties = {
  ...summaryBase,
  background: "#fff1ef",
  color: "#8b2f25",
  borderColor: "#f3c7c0",
};

const insightGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const insightBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 7,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 12,
};

const sectionHeaderCompact: React.CSSProperties = {
  ...sectionHeader,
  alignItems: "flex-start",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 21,
  fontWeight: 950,
};

const sectionText: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.4,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
  marginBottom: 18,
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1060,
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  background: "#f8fafc",
  color: "#36513f",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "14px 16px",
  color: "#334155",
  fontWeight: 850,
  borderBottom: "1px solid #eef2f7",
  whiteSpace: "nowrap",
};

const tdStrong: React.CSSProperties = {
  ...td,
  color: "#0f172a",
  fontWeight: 950,
};

const riskPill: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 950,
};

const riskPillRed: React.CSSProperties = {
  background: "#fbe0dc",
  color: "#8b2f25",
};

const riskPillGreen: React.CSSProperties = {
  background: "#e7f4eb",
  color: "#17633a",
};

const sectionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 16,
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
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
  padding: "0 12px",
  whiteSpace: "nowrap",
};

const riskList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const riskItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fbfbf8",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const opportunityList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const opportunityItem: React.CSSProperties = {
  ...riskItem,
};

const riskRight: React.CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "end",
  textAlign: "right",
};

const riskBadge: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  border: "1px solid",
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
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

const emptyTable: React.CSSProperties = {
  ...td,
  textAlign: "center",
  color: "#64748b",
  padding: 24,
};
