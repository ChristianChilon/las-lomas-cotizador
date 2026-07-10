"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  esGerencia,
  formatearMoneda,
  type Profile,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type MetaComercial = {
  id: string;
  periodo: string;
  asesor_id: string;
  meta_clientes: number;
  meta_seguimientos: number;
  meta_separaciones: number;
  meta_ventas: number;
  meta_monto_ventas: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type RegistroActividad = {
  id: string;
  asesor_id: string | null;
  created_at: string | null;
};

type LoteVenta = {
  id: number;
  asesor_id: string | null;
  estado: string;
  precio: number | null;
  updated_at: string | null;
};

type Reales = {
  clientes: number;
  seguimientos: number;
  separaciones: number;
  ventas: number;
  montoVentas: number;
};

type ResultadoAsesor = {
  asesor: Profile;
  meta: MetaComercial | null;
  reales: Reales;
  avanceGeneral: number | null;
  estado: EstadoRitmo;
};

type EstadoRitmo =
  | "SIN_META"
  | "CUMPLIDA"
  | "EN_RITMO"
  | "ATENCION"
  | "EN_RIESGO";

type MetaDraft = {
  meta_clientes: string;
  meta_seguimientos: string;
  meta_separaciones: string;
  meta_ventas: string;
  meta_monto_ventas: string;
};

const metaVacia: MetaDraft = {
  meta_clientes: "0",
  meta_seguimientos: "0",
  meta_separaciones: "0",
  meta_ventas: "0",
  meta_monto_ventas: "0",
};

const periodoActual = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const inicioPeriodo = (periodo: string) => `${periodo}-01`;

const siguientePeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month, 1);

  return `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(2, "0")}-01`;
};

const periodoAnterior = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month - 2, 1);

  return `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(2, "0")}`;
};

const etiquetaPeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);

  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
};

const estaEnPeriodo = (
  fecha: string | null | undefined,
  inicio: string,
  fin: string
) => Boolean(fecha && fecha >= inicio && fecha < fin);

const progreso = (real: number, meta: number) =>
  meta > 0 ? (real / meta) * 100 : null;

const limitarBarra = (valor: number | null) =>
  Math.max(0, Math.min(valor || 0, 100));

const porcentaje = (valor: number | null) =>
  valor === null
    ? "Sin meta"
    : `${valor.toLocaleString("es-PE", {
        maximumFractionDigits: 0,
      })}%`;

const avanceEsperado = (periodo: string) => {
  const actual = periodoActual();

  if (periodo < actual) return 100;
  if (periodo > actual) return 0;

  const hoy = new Date();
  const diasMes = new Date(
    hoy.getFullYear(),
    hoy.getMonth() + 1,
    0
  ).getDate();

  return (hoy.getDate() / diasMes) * 100;
};

const calcularAvanceGeneral = (
  meta: MetaComercial | null,
  reales: Reales
) => {
  if (!meta) return null;

  const avances = [
    progreso(reales.clientes, Number(meta.meta_clientes || 0)),
    progreso(
      reales.seguimientos,
      Number(meta.meta_seguimientos || 0)
    ),
    progreso(
      reales.separaciones,
      Number(meta.meta_separaciones || 0)
    ),
    progreso(reales.ventas, Number(meta.meta_ventas || 0)),
    progreso(
      reales.montoVentas,
      Number(meta.meta_monto_ventas || 0)
    ),
  ].filter((item): item is number => item !== null);

  if (avances.length === 0) return null;

  return (
    avances.reduce((acumulado, item) => acumulado + item, 0) /
    avances.length
  );
};

const calcularEstado = (
  avance: number | null,
  esperado: number
): EstadoRitmo => {
  if (avance === null) return "SIN_META";
  if (avance >= 100) return "CUMPLIDA";
  if (avance >= Math.max(esperado - 10, 0)) return "EN_RITMO";
  if (avance >= Math.max(esperado - 25, 0)) return "ATENCION";

  return "EN_RIESGO";
};

const etiquetaEstadoRitmo = (estado: EstadoRitmo) => {
  switch (estado) {
    case "CUMPLIDA":
      return "Cumplida";
    case "EN_RITMO":
      return "En ritmo";
    case "ATENCION":
      return "Atencion";
    case "EN_RIESGO":
      return "En riesgo";
    default:
      return "Sin meta";
  }
};

const colorEstadoRitmo = (estado: EstadoRitmo) => {
  switch (estado) {
    case "CUMPLIDA":
      return { bg: "#dff3e5", fg: "#17633a", border: "#b8dbc4" };
    case "EN_RITMO":
      return { bg: "#eef6ff", fg: "#244d77", border: "#c7ddf4" };
    case "ATENCION":
      return { bg: "#fff7dc", fg: "#7a4b12", border: "#f2d17a" };
    case "EN_RIESGO":
      return { bg: "#fff1ef", fg: "#8b2f25", border: "#f3c7c0" };
    default:
      return { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
  }
};

const crearReales = (): Reales => ({
  clientes: 0,
  seguimientos: 0,
  separaciones: 0,
  ventas: 0,
  montoVentas: 0,
});

const nombreAsesor = (asesor: Profile) =>
  asesor.full_name || asesor.email || "Asesor";

const numeroDraft = (valor: string) => {
  const numero = Number(valor);

  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

export default function MetasPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [metas, setMetas] = useState<MetaComercial[]>([]);
  const [clientes, setClientes] = useState<RegistroActividad[]>([]);
  const [seguimientos, setSeguimientos] = useState<
    RegistroActividad[]
  >([]);
  const [separaciones, setSeparaciones] = useState<
    RegistroActividad[]
  >([]);
  const [lotes, setLotes] = useState<LoteVenta[]>([]);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [setupPendiente, setSetupPendiente] = useState(false);
  const [asesorEditando, setAsesorEditando] =
    useState<Profile | null>(null);
  const [draft, setDraft] = useState<MetaDraft>(metaVacia);

  const cargar = useCallback(async () => {
    if (!supabase) {
      setError("Supabase no esta configurado.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);
    setMensaje(null);

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    if (!perfil.profile) {
      setError(perfil.error || "No se pudo cargar tu perfil.");
      setCargando(false);
      return;
    }

    const modoGerencia = esGerencia(perfil.profile);
    const inicio = inicioPeriodo(periodo);
    const fin = siguientePeriodo(periodo);

    let metasQuery = supabase
      .from("metas_comerciales")
      .select(
        "id,periodo,asesor_id,meta_clientes,meta_seguimientos,meta_separaciones,meta_ventas,meta_monto_ventas,created_by,created_at,updated_at"
      )
      .eq("periodo", inicio);
    let clientesQuery = supabase
      .from("clientes")
      .select("id,asesor_id,created_at")
      .gte("created_at", inicio)
      .lt("created_at", fin);
    let seguimientosQuery = supabase
      .from("seguimientos_clientes")
      .select("id,asesor_id,created_at")
      .gte("created_at", inicio)
      .lt("created_at", fin);
    let separacionesQuery = supabase
      .from("separaciones")
      .select("id,asesor_id,created_at")
      .gte("created_at", inicio)
      .lt("created_at", fin);
    let lotesQuery = supabase
      .from(LOTES_TABLE)
      .select("id,asesor_id,estado,precio,updated_at")
      .eq("estado", "VENDIDO")
      .gte("updated_at", inicio)
      .lt("updated_at", fin);

    if (!modoGerencia) {
      metasQuery = metasQuery.eq("asesor_id", perfil.profile.id);
      clientesQuery = clientesQuery.eq("asesor_id", perfil.profile.id);
      seguimientosQuery = seguimientosQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      separacionesQuery = separacionesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
      lotesQuery = lotesQuery.eq("asesor_id", perfil.profile.id);
    }

    const [
      perfilesResult,
      metasResult,
      clientesResult,
      seguimientosResult,
      separacionesResult,
      lotesResult,
    ] = await Promise.all([
      modoGerencia
        ? supabase
            .from("profiles")
            .select("id,full_name,email,role,phone,active")
            .eq("role", "asesor")
            .eq("active", true)
            .order("full_name", { ascending: true })
        : Promise.resolve({ data: [perfil.profile], error: null }),
      metasQuery,
      clientesQuery,
      seguimientosQuery,
      separacionesQuery,
      lotesQuery,
    ]);

    const tablaMetasNoExiste = Boolean(
      metasResult.error &&
        (metasResult.error.code === "42P01" ||
          metasResult.error.message.includes("metas_comerciales"))
    );

    setSetupPendiente(tablaMetasNoExiste);

    const errorActual =
      perfilesResult.error ||
      (tablaMetasNoExiste ? null : metasResult.error) ||
      clientesResult.error ||
      seguimientosResult.error ||
      separacionesResult.error ||
      lotesResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setAsesores(
      (perfilesResult.data || []) as unknown as Profile[]
    );
    setMetas(
      tablaMetasNoExiste
        ? []
        : ((metasResult.data || []) as unknown as MetaComercial[])
    );
    setClientes(
      (clientesResult.data || []) as unknown as RegistroActividad[]
    );
    setSeguimientos(
      (seguimientosResult.data || []) as unknown as RegistroActividad[]
    );
    setSeparaciones(
      (separacionesResult.data || []) as unknown as RegistroActividad[]
    );
    setLotes((lotesResult.data || []) as unknown as LoteVenta[]);
    setCargando(false);
  }, [periodo]);

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  const modoGerencia = esGerencia(profile);
  const esperado = avanceEsperado(periodo);

  const resultados = useMemo<ResultadoAsesor[]>(() => {
    const inicio = inicioPeriodo(periodo);
    const fin = siguientePeriodo(periodo);
    const metasPorAsesor = new Map(
      metas.map((meta) => [meta.asesor_id, meta])
    );
    const realesPorAsesor = new Map<string, Reales>();

    const obtenerReales = (asesorId: string | null) => {
      if (!asesorId) return null;

      const existente = realesPorAsesor.get(asesorId);
      if (existente) return existente;

      const nuevo = crearReales();
      realesPorAsesor.set(asesorId, nuevo);
      return nuevo;
    };

    clientes.forEach((item) => {
      if (estaEnPeriodo(item.created_at, inicio, fin)) {
        const reales = obtenerReales(item.asesor_id);
        if (reales) reales.clientes += 1;
      }
    });

    seguimientos.forEach((item) => {
      if (estaEnPeriodo(item.created_at, inicio, fin)) {
        const reales = obtenerReales(item.asesor_id);
        if (reales) reales.seguimientos += 1;
      }
    });

    separaciones.forEach((item) => {
      if (estaEnPeriodo(item.created_at, inicio, fin)) {
        const reales = obtenerReales(item.asesor_id);
        if (reales) reales.separaciones += 1;
      }
    });

    lotes.forEach((lote) => {
      if (
        lote.estado === "VENDIDO" &&
        estaEnPeriodo(lote.updated_at, inicio, fin)
      ) {
        const reales = obtenerReales(lote.asesor_id);
        if (reales) {
          reales.ventas += 1;
          reales.montoVentas += Number(lote.precio || 0);
        }
      }
    });

    return asesores
      .map((asesor) => {
        const meta = metasPorAsesor.get(asesor.id) || null;
        const reales = realesPorAsesor.get(asesor.id) || crearReales();
        const avanceGeneral = calcularAvanceGeneral(meta, reales);

        return {
          asesor,
          meta,
          reales,
          avanceGeneral,
          estado: calcularEstado(avanceGeneral, esperado),
        };
      })
      .sort((a, b) => {
        const avanceA = a.avanceGeneral ?? -1;
        const avanceB = b.avanceGeneral ?? -1;

        if (avanceB !== avanceA) return avanceB - avanceA;
        return nombreAsesor(a.asesor).localeCompare(
          nombreAsesor(b.asesor)
        );
      });
  }, [asesores, clientes, esperado, lotes, metas, periodo, seguimientos, separaciones]);

  const resumen = useMemo(
    () =>
      resultados.reduce(
        (acc, item) => ({
          asesores: acc.asesores + 1,
          conMeta: acc.conMeta + (item.meta ? 1 : 0),
          metaVentas:
            acc.metaVentas + Number(item.meta?.meta_ventas || 0),
          ventas: acc.ventas + item.reales.ventas,
          metaMonto:
            acc.metaMonto +
            Number(item.meta?.meta_monto_ventas || 0),
          montoVentas: acc.montoVentas + item.reales.montoVentas,
          enRiesgo:
            acc.enRiesgo +
            (item.estado === "EN_RIESGO" ||
            item.estado === "ATENCION"
              ? 1
              : 0),
        }),
        {
          asesores: 0,
          conMeta: 0,
          metaVentas: 0,
          ventas: 0,
          metaMonto: 0,
          montoVentas: 0,
          enRiesgo: 0,
        }
      ),
    [resultados]
  );

  const progresoVentasEquipo = progreso(
    resumen.ventas,
    resumen.metaVentas
  );
  const progresoMontoEquipo = progreso(
    resumen.montoVentas,
    resumen.metaMonto
  );

  const abrirEdicion = (resultado: ResultadoAsesor) => {
    const meta = resultado.meta;

    setAsesorEditando(resultado.asesor);
    setDraft(
      meta
        ? {
            meta_clientes: String(meta.meta_clientes || 0),
            meta_seguimientos: String(meta.meta_seguimientos || 0),
            meta_separaciones: String(meta.meta_separaciones || 0),
            meta_ventas: String(meta.meta_ventas || 0),
            meta_monto_ventas: String(meta.meta_monto_ventas || 0),
          }
        : metaVacia
    );
    setError(null);
    setMensaje(null);
  };

  const guardarMeta = async () => {
    if (!supabase || !profile || !asesorEditando || !modoGerencia) {
      return;
    }

    setGuardando(true);
    setError(null);
    setMensaje(null);

    const payload = {
      periodo: inicioPeriodo(periodo),
      asesor_id: asesorEditando.id,
      meta_clientes: Math.trunc(numeroDraft(draft.meta_clientes)),
      meta_seguimientos: Math.trunc(
        numeroDraft(draft.meta_seguimientos)
      ),
      meta_separaciones: Math.trunc(
        numeroDraft(draft.meta_separaciones)
      ),
      meta_ventas: Math.trunc(numeroDraft(draft.meta_ventas)),
      meta_monto_ventas: numeroDraft(draft.meta_monto_ventas),
      created_by: profile.id,
    };

    const { data, error: saveError } = await supabase
      .from("metas_comerciales")
      .upsert(payload, { onConflict: "periodo,asesor_id" })
      .select(
        "id,periodo,asesor_id,meta_clientes,meta_seguimientos,meta_separaciones,meta_ventas,meta_monto_ventas,created_by,created_at,updated_at"
      )
      .single();

    if (saveError) {
      setError(saveError.message);
      setGuardando(false);
      return;
    }

    const metaGuardada = data as unknown as MetaComercial;
    setMetas((actuales) => [
      ...actuales.filter(
        (item) => item.asesor_id !== metaGuardada.asesor_id
      ),
      metaGuardada,
    ]);
    setMensaje(
      `Meta de ${nombreAsesor(asesorEditando)} guardada para ${etiquetaPeriodo(periodo)}.`
    );
    setAsesorEditando(null);
    setGuardando(false);
  };

  const copiarMetasAnteriores = async () => {
    if (!supabase || !profile || !modoGerencia) return;

    setCopiando(true);
    setError(null);
    setMensaje(null);

    const anterior = periodoAnterior(periodo);
    const { data, error: copyError } = await supabase
      .from("metas_comerciales")
      .select(
        "asesor_id,meta_clientes,meta_seguimientos,meta_separaciones,meta_ventas,meta_monto_ventas"
      )
      .eq("periodo", inicioPeriodo(anterior));

    if (copyError) {
      setError(copyError.message);
      setCopiando(false);
      return;
    }

    const existentes = new Set(metas.map((item) => item.asesor_id));
    const asesoresActivos = new Set(asesores.map((item) => item.id));
    const nuevas = (data || [])
      .filter(
        (item) =>
          !existentes.has(item.asesor_id) &&
          asesoresActivos.has(item.asesor_id)
      )
      .map((item) => ({
        ...item,
        periodo: inicioPeriodo(periodo),
        created_by: profile.id,
      }));

    if (nuevas.length === 0) {
      setMensaje(
        "No hay metas anteriores pendientes de copiar para este mes."
      );
      setCopiando(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("metas_comerciales")
      .upsert(nuevas, { onConflict: "periodo,asesor_id" });

    if (insertError) {
      setError(insertError.message);
      setCopiando(false);
      return;
    }

    setCopiando(false);
    await cargar();
    setMensaje(
      `${nuevas.length} metas copiadas desde ${etiquetaPeriodo(anterior)}.`
    );
  };

  return (
    <AsesorLayout
      title={modoGerencia ? "Metas comerciales" : "Mis metas"}
      subtitle={
        modoGerencia
          ? "Objetivos mensuales, avance del equipo y alertas de ritmo comercial."
          : "Tu avance mensual en clientes, seguimiento, separaciones y ventas."
      }
    >
      <section>
        <div style={toolbar}>
          <div>
            <span style={eyebrow}>Periodo de medicion</span>
            <h2 style={title}>{etiquetaPeriodo(periodo)}</h2>
            <p style={subtitle}>
              Avance esperado al dia: {porcentaje(esperado)}.
            </p>
          </div>

          <div style={toolbarActions}>
            <label style={monthLabel}>
              Mes
              <input
                type="month"
                value={periodo}
                onChange={(event) => setPeriodo(event.target.value)}
                style={monthInput}
              />
            </label>

            {modoGerencia && (
              <button
                type="button"
                onClick={() => void copiarMetasAnteriores()}
                disabled={copiando || setupPendiente}
                style={secondaryButton}
              >
                {copiando ? "Copiando..." : "Copiar mes anterior"}
              </button>
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

        {setupPendiente && (
          <div style={setupAlert}>
            <strong>Configuracion pendiente en Supabase</strong>
            <span>
              Ejecuta el archivo 007_crm_metas_comerciales.sql para
              activar metas, permisos RLS y guardado por mes. El resto
              del CRM sigue funcionando con normalidad.
            </span>
          </div>
        )}

        {error && <div style={alert}>{error}</div>}
        {mensaje && <div style={successAlert}>{mensaje}</div>}

        <div style={summaryGrid}>
          <SummaryCard
            label="Meta de ventas"
            value={`${resumen.metaVentas} lotes`}
            detail={`${resumen.ventas} vendidos`}
            tone="blue"
          />
          <SummaryCard
            label="Avance en ventas"
            value={porcentaje(progresoVentasEquipo)}
            detail={`Ritmo esperado ${porcentaje(esperado)}`}
            tone="green"
          />
          <SummaryCard
            label="Meta de facturacion"
            value={formatearMoneda(resumen.metaMonto)}
            detail={`${formatearMoneda(resumen.montoVentas)} logrado`}
            tone="gold"
          />
          <SummaryCard
            label="Avance en monto"
            value={porcentaje(progresoMontoEquipo)}
            detail={`${resumen.conMeta} de ${resumen.asesores} con meta`}
            tone="green"
          />
          <SummaryCard
            label="Requieren atencion"
            value={resumen.enRiesgo}
            detail="Asesores debajo del ritmo esperado"
            tone={resumen.enRiesgo > 0 ? "red" : "gray"}
          />
        </div>

        <article style={insightPanel}>
          <div>
            <h3 style={panelTitle}>Lectura comercial del mes</h3>
            <p style={panelText}>
              El ritmo compara el avance promedio de cada objetivo con
              el porcentaje transcurrido del mes. Asi se detectan
              desviaciones antes del cierre, no cuando ya es tarde.
            </p>
          </div>
          <div style={insightProgress}>
            <span>Ventas del equipo</span>
            <strong>
              {resumen.ventas} / {resumen.metaVentas || 0}
            </strong>
            <ProgressBar value={progresoVentasEquipo} tone="#2f7d46" />
          </div>
          <div style={insightProgress}>
            <span>Monto vendido</span>
            <strong>{formatearMoneda(resumen.montoVentas)}</strong>
            <ProgressBar value={progresoMontoEquipo} tone="#9a6a12" />
          </div>
        </article>

        {cargando ? (
          <div style={emptyBox}>Cargando metas comerciales...</div>
        ) : resultados.length === 0 ? (
          <div style={emptyBox}>
            No hay asesores activos para medir en este periodo.
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Asesor</th>
                  <th style={th}>Clientes</th>
                  <th style={th}>Seguimientos</th>
                  <th style={th}>Separaciones</th>
                  <th style={th}>Ventas</th>
                  <th style={th}>Monto vendido</th>
                  <th style={th}>Avance global</th>
                  <th style={th}>Ritmo</th>
                  {modoGerencia && <th style={th}>Gestion</th>}
                </tr>
              </thead>

              <tbody>
                {resultados.map((item) => {
                  const colors = colorEstadoRitmo(item.estado);

                  return (
                    <tr key={item.asesor.id}>
                      <td style={tdStrong}>
                        <div>{nombreAsesor(item.asesor)}</div>
                        <span style={subText}>
                          {item.asesor.email || "Sin correo"}
                        </span>
                      </td>
                      <td style={td}>
                        <MetaCell
                          actual={item.reales.clientes}
                          meta={Number(item.meta?.meta_clientes || 0)}
                        />
                      </td>
                      <td style={td}>
                        <MetaCell
                          actual={item.reales.seguimientos}
                          meta={Number(
                            item.meta?.meta_seguimientos || 0
                          )}
                        />
                      </td>
                      <td style={td}>
                        <MetaCell
                          actual={item.reales.separaciones}
                          meta={Number(
                            item.meta?.meta_separaciones || 0
                          )}
                        />
                      </td>
                      <td style={td}>
                        <MetaCell
                          actual={item.reales.ventas}
                          meta={Number(item.meta?.meta_ventas || 0)}
                        />
                      </td>
                      <td style={tdWide}>
                        <MetaCell
                          actual={item.reales.montoVentas}
                          meta={Number(
                            item.meta?.meta_monto_ventas || 0
                          )}
                          money
                        />
                      </td>
                      <td style={tdWide}>
                        <strong>
                          {porcentaje(item.avanceGeneral)}
                        </strong>
                        <ProgressBar
                          value={item.avanceGeneral}
                          tone={colors.fg}
                        />
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            ...statusBadge,
                            background: colors.bg,
                            color: colors.fg,
                            borderColor: colors.border,
                          }}
                        >
                          {etiquetaEstadoRitmo(item.estado)}
                        </span>
                      </td>
                      {modoGerencia && (
                        <td style={td}>
                          <button
                            type="button"
                            onClick={() => abrirEdicion(item)}
                            disabled={setupPendiente}
                            style={editButton}
                          >
                            {item.meta ? "Editar" : "Definir"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {asesorEditando && (
          <div style={modalBackdrop} role="presentation">
            <div
              style={modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="meta-dialog-title"
            >
              <div style={modalHeader}>
                <div>
                  <span style={eyebrow}>Objetivos del mes</span>
                  <h3 id="meta-dialog-title" style={modalTitle}>
                    {nombreAsesor(asesorEditando)}
                  </h3>
                  <p style={modalSubtitle}>
                    {etiquetaPeriodo(periodo)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAsesorEditando(null)}
                  style={closeButton}
                >
                  Cerrar
                </button>
              </div>

              <div style={formGrid}>
                <MetaInput
                  label="Clientes nuevos"
                  value={draft.meta_clientes}
                  onChange={(value) =>
                    setDraft((actual) => ({
                      ...actual,
                      meta_clientes: value,
                    }))
                  }
                />
                <MetaInput
                  label="Seguimientos"
                  value={draft.meta_seguimientos}
                  onChange={(value) =>
                    setDraft((actual) => ({
                      ...actual,
                      meta_seguimientos: value,
                    }))
                  }
                />
                <MetaInput
                  label="Separaciones"
                  value={draft.meta_separaciones}
                  onChange={(value) =>
                    setDraft((actual) => ({
                      ...actual,
                      meta_separaciones: value,
                    }))
                  }
                />
                <MetaInput
                  label="Ventas cerradas"
                  value={draft.meta_ventas}
                  onChange={(value) =>
                    setDraft((actual) => ({
                      ...actual,
                      meta_ventas: value,
                    }))
                  }
                />
                <MetaInput
                  label="Monto vendido (S/)"
                  value={draft.meta_monto_ventas}
                  onChange={(value) =>
                    setDraft((actual) => ({
                      ...actual,
                      meta_monto_ventas: value,
                    }))
                  }
                  decimal
                  full
                />
              </div>

              <div style={modalFooter}>
                <button
                  type="button"
                  onClick={() => setAsesorEditando(null)}
                  style={cancelButton}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void guardarMeta()}
                  disabled={guardando}
                  style={saveButton}
                >
                  {guardando ? "Guardando..." : "Guardar metas"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AsesorLayout>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: "green" | "blue" | "gold" | "red" | "gray";
}) {
  const colors = {
    green: { bg: "#eef8f1", fg: "#17633a", border: "#c9e7d2" },
    blue: { bg: "#eef6ff", fg: "#244d77", border: "#c7ddf4" },
    gold: { bg: "#fff8e1", fg: "#8a5a00", border: "#eed28a" },
    red: { bg: "#fff1ef", fg: "#8b2f25", border: "#f3c7c0" },
    gray: { bg: "#f8fafc", fg: "#334155", border: "#e5e7eb" },
  }[tone];

  return (
    <article
      style={{
        ...summaryCard,
        background: colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function MetaCell({
  actual,
  meta,
  money = false,
}: {
  actual: number;
  meta: number;
  money?: boolean;
}) {
  const avance = progreso(actual, meta);

  return (
    <div style={metaCell}>
      <strong>
        {money ? formatearMoneda(actual) : actual}
        <span style={metaDivider}> / </span>
        <span style={metaTarget}>
          {money ? formatearMoneda(meta) : meta || "-"}
        </span>
      </strong>
      <ProgressBar value={avance} tone="#2f7d46" />
    </div>
  );
}

function ProgressBar({
  value,
  tone,
}: {
  value: number | null;
  tone: string;
}) {
  return (
    <div style={progressTrack}>
      <div
        style={{
          ...progressFill,
          width: `${limitarBarra(value)}%`,
          background: tone,
        }}
      />
    </div>
  );
}

function MetaInput({
  label,
  value,
  onChange,
  decimal = false,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal?: boolean;
  full?: boolean;
}) {
  return (
    <label style={{ ...field, ...(full ? fieldFull : {}) }}>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={decimal ? "0.01" : "1"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={input}
      />
    </label>
  );
}

const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const toolbarActions: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const eyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".06em",
};

const title: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: 28,
  fontWeight: 950,
  textTransform: "capitalize",
};

const subtitle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  lineHeight: 1.45,
};

const monthLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const monthInput: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  padding: "0 12px",
  fontWeight: 850,
};

const buttonBase: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  padding: "0 14px",
  fontWeight: 950,
  cursor: "pointer",
};

const refreshButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #2f7d46",
  background: "#2f7d46",
  color: "#ffffff",
};

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #c8d8bf",
  background: "#f5e6b8",
  color: "#4f3f16",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCard: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const insightPanel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  display: "grid",
  gridTemplateColumns: "minmax(280px,1fr) repeat(2,minmax(190px,240px))",
  gap: 18,
  alignItems: "center",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 20,
  fontWeight: 950,
};

const panelText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const insightProgress: React.CSSProperties = {
  display: "grid",
  gap: 7,
  borderRadius: 14,
  background: "#f8fafc",
  padding: 13,
  color: "#334155",
};

const setupAlert: React.CSSProperties = {
  background: "#eef6ff",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  display: "grid",
  gap: 5,
};

const alert: React.CSSProperties = {
  background: "#fff1ef",
  color: "#8b2f25",
  border: "1px solid #f3c7c0",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const successAlert: React.CSSProperties = {
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1280,
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
  minWidth: 210,
};

const tdWide: React.CSSProperties = {
  ...td,
  minWidth: 180,
};

const subText: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const metaCell: React.CSSProperties = {
  minWidth: 110,
  display: "grid",
  gap: 7,
};

const metaDivider: React.CSSProperties = {
  color: "#94a3b8",
};

const metaTarget: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
};

const progressTrack: React.CSSProperties = {
  height: 7,
  borderRadius: 999,
  background: "#e7edf2",
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 950,
};

const editButton: React.CSSProperties = {
  border: "1px solid #b8dbc4",
  background: "#eef8f1",
  color: "#17633a",
  borderRadius: 10,
  minHeight: 36,
  padding: "0 12px",
  fontWeight: 950,
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 18,
  borderRadius: 14,
  fontWeight: 800,
};

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15,23,42,.45)",
  display: "grid",
  placeItems: "center",
  padding: 20,
};

const modal: React.CSSProperties = {
  width: "min(620px,100%)",
  maxHeight: "calc(100vh - 40px)",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 30px 90px rgba(15,23,42,.28)",
  padding: 20,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const modalTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#111827",
  fontSize: 24,
  fontWeight: 950,
};

const modalSubtitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  textTransform: "capitalize",
};

const closeButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#475569",
  borderRadius: 10,
  minHeight: 36,
  padding: "0 11px",
  fontWeight: 850,
  cursor: "pointer",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 14,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const fieldFull: React.CSSProperties = {
  gridColumn: "1 / -1",
};

const input: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 44,
  borderRadius: 11,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  padding: "0 12px",
  fontSize: 15,
  fontWeight: 850,
  boxSizing: "border-box",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid #e5e7eb",
};

const cancelButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#475569",
};

const saveButton: React.CSSProperties = {
  ...buttonBase,
  border: "1px solid #2f7d46",
  background: "#2f7d46",
  color: "#ffffff",
};
