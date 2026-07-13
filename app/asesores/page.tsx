"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../components/layout/AsesorLayout";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  colorEstado,
  esGerencia,
  etiquetaEstado,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type Cotizacion,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../lib/crm";

type DashboardData = {
  lotes: LoteCrm[];
  clientes: Cliente[];
  separaciones: Separacion[];
  cotizaciones: Cotizacion[];
  asesores: Profile[];
};

type AlertaEjecutiva = {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  accion: string;
  prioridad: number;
  tono: "red" | "gold" | "blue";
};

type AsesorPulso = {
  id: string;
  nombre: string;
  clientes: number;
  calientes: number;
  negociaciones: number;
  separados: number;
  cierres: number;
  vendidos: number;
  montoPipeline: number;
  puntaje: number;
};

const dataVacia: DashboardData = {
  lotes: [],
  clientes: [],
  separaciones: [],
  cotizaciones: [],
  asesores: [],
};

const pesosForecast = {
  EN_NEGOCIACION: 0.35,
  SEPARADO: 0.7,
  CIERRE_SOLICITADO: 0.95,
};

const obtenerFechaHoyISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const sumarDiasISO = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const inicioMesISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
};

const clienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

const nombreLote = (lote?: LoteCrm | null) =>
  lote ? `MZ ${lote.mz} - LOTE ${lote.lote}` : "Lote sin dato";

const nombreAsesor = (
  asesorId: string | null | undefined,
  asesores: Map<string, Profile>
) => {
  if (!asesorId) return "Sin asesor";

  const asesor = asesores.get(asesorId);

  return asesor?.full_name || asesor?.email || "Asesor";
};

export default function AsesoresDashboard() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [data, setData] = useState<DashboardData>(dataVacia);
  const [error, setError] =
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

    let clientesQuery = supabase.from("clientes").select(
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
        "nivel_interes",
        "estado_lead",
        "proxima_accion",
        "fecha_proximo_seguimiento",
        "canal_preferido",
        "estado_cita",
        "fecha_cita",
        "hora_cita",
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

    let cotizacionesQuery = supabase
      .from("cotizaciones")
      .select(
        "id,numero,cliente_id,lote_id,asesor_id,estado,precio_ofertado,valida_hasta,aprobacion_solicitada_at,enviada_at,aceptada_at,created_at,updated_at"
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
      cotizacionesQuery = cotizacionesQuery.eq(
        "asesor_id",
        perfil.profile.id
      );
    }

    const [
      clientesResult,
      lotesResult,
      separacionesResult,
      cotizacionesResult,
      asesoresResult,
    ] = await Promise.all([
      clientesQuery,
      lotesQuery,
      separacionesQuery,
      cotizacionesQuery,
      modoGerencia
        ? supabase
            .from("profiles")
            .select("id,full_name,email,role,phone,active")
            .eq("role", "asesor")
        : Promise.resolve({ data: [], error: null }),
    ]);

    const errorActual =
      clientesResult.error ||
      lotesResult.error ||
      separacionesResult.error ||
      cotizacionesResult.error ||
      asesoresResult.error;

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setData({
      clientes:
        (clientesResult.data || []) as unknown as Cliente[],
      lotes: (lotesResult.data || []) as unknown as LoteCrm[],
      separaciones:
        (separacionesResult.data || []) as unknown as Separacion[],
      cotizaciones:
        (cotizacionesResult.data || []) as unknown as Cotizacion[],
      asesores:
        (asesoresResult.data || []) as unknown as Profile[],
    });
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const asesoresPorId = useMemo(() => {
    const mapa = new Map<string, Profile>();

    data.asesores.forEach((asesor) => {
      mapa.set(asesor.id, asesor);
    });

    if (profile) {
      mapa.set(profile.id, profile);
    }

    return mapa;
  }, [data.asesores, profile]);

  const lotesPorId = useMemo(() => {
    const mapa = new Map<number, LoteCrm>();

    data.lotes.forEach((lote) => {
      mapa.set(lote.id, lote);
    });

    return mapa;
  }, [data.lotes]);

  const clientesPorId = useMemo(() => {
    const mapa = new Map<string, Cliente>();

    data.clientes.forEach((cliente) => {
      mapa.set(cliente.id, cliente);
    });

    return mapa;
  }, [data.clientes]);

  const resumen = useMemo(() => {
    const inicioMes = inicioMesISO();
    const pipeline = data.lotes.filter((lote) =>
      ["EN_NEGOCIACION", "SEPARADO", "CIERRE_SOLICITADO"].includes(
        lote.estado
      )
    );
    const vendidosMes = data.lotes.filter(
      (lote) =>
        lote.estado === "VENDIDO" &&
        (lote.updated_at || "") >= inicioMes
    );
    const pipelineMonto = pipeline.reduce(
      (acc, lote) => acc + Number(lote.precio || 0),
      0
    );
    const forecast = pipeline.reduce((acc, lote) => {
      const precio = Number(lote.precio || 0);

      if (lote.estado === "EN_NEGOCIACION") {
        return acc + precio * pesosForecast.EN_NEGOCIACION;
      }

      if (lote.estado === "SEPARADO") {
        return acc + precio * pesosForecast.SEPARADO;
      }

      if (lote.estado === "CIERRE_SOLICITADO") {
        return acc + precio * pesosForecast.CIERRE_SOLICITADO;
      }

      return acc;
    }, 0);

    const hoy = obtenerFechaHoyISO();
    const pronto = sumarDiasISO(3);
    const separacionesVencidas = data.separaciones.filter(
      (separacion) =>
        separacion.estado === "ACTIVA" &&
        Boolean(separacion.fecha_limite) &&
        String(separacion.fecha_limite) < hoy
    );
    const separacionesPronto = data.separaciones.filter(
      (separacion) =>
        separacion.estado === "ACTIVA" &&
        Boolean(separacion.fecha_limite) &&
        String(separacion.fecha_limite) >= hoy &&
        String(separacion.fecha_limite) <= pronto
    );
    const seguimientosVencidos = data.clientes.filter(
      (cliente) =>
        clienteActivo(cliente) &&
        Boolean(cliente.fecha_proximo_seguimiento) &&
        String(cliente.fecha_proximo_seguimiento) < hoy
    );
    const leadsCalientes = data.clientes.filter(
      (cliente) =>
        clienteActivo(cliente) &&
        cliente.nivel_interes === "CALIENTE"
    );
    const leadsCalientesSinFecha = leadsCalientes.filter(
      (cliente) => !cliente.fecha_proximo_seguimiento
    );
    const cotizacionesVigentes = data.cotizaciones.filter(
      (cotizacion) =>
        cotizacion.estado === "ENVIADA" &&
        cotizacion.valida_hasta >= hoy
    );
    const cotizacionesAceptadas = data.cotizaciones.filter(
      (cotizacion) => cotizacion.estado === "ACEPTADA"
    );
    const cotizacionesEvaluadas = data.cotizaciones.filter(
      (cotizacion) =>
        ["ENVIADA", "ACEPTADA", "RECHAZADA", "CONVERTIDA"].includes(
          cotizacion.estado
        )
    );
    const cotizacionesGanadas = cotizacionesEvaluadas.filter(
      (cotizacion) =>
        ["ACEPTADA", "CONVERTIDA"].includes(cotizacion.estado)
    );

    return {
      totalLotes: data.lotes.length,
      disponibles: data.lotes.filter(
        (lote) => lote.estado === "DISPONIBLE"
      ).length,
      clientes: data.clientes.length,
      leadsCalientes: leadsCalientes.length,
      pipeline: pipeline.length,
      pipelineMonto,
      forecast,
      cierres: data.lotes.filter(
        (lote) => lote.estado === "CIERRE_SOLICITADO"
      ).length,
      vendidosMes: vendidosMes.length,
      montoVendidoMes: vendidosMes.reduce(
        (acc, lote) => acc + Number(lote.precio || 0),
        0
      ),
      separacionesActivas: data.separaciones.filter(
        (separacion) => separacion.estado === "ACTIVA"
      ).length,
      separacionesVencidas: separacionesVencidas.length,
      separacionesPronto: separacionesPronto.length,
      seguimientosVencidos: seguimientosVencidos.length,
      leadsCalientesSinFecha: leadsCalientesSinFecha.length,
      cotizacionesPendientes: data.cotizaciones.filter(
        (cotizacion) => cotizacion.estado === "PENDIENTE_APROBACION"
      ).length,
      cotizacionesVigentes: cotizacionesVigentes.length,
      cotizacionesAceptadas: cotizacionesAceptadas.length,
      montoCotizado: [...cotizacionesVigentes, ...cotizacionesAceptadas].reduce(
        (acc, cotizacion) => acc + Number(cotizacion.precio_ofertado || 0),
        0
      ),
      conversionCotizaciones: cotizacionesEvaluadas.length
        ? (cotizacionesGanadas.length / cotizacionesEvaluadas.length) * 100
        : 0,
    };
  }, [data.clientes, data.cotizaciones, data.lotes, data.separaciones]);

  const alertas = useMemo<AlertaEjecutiva[]>(() => {
    const hoy = obtenerFechaHoyISO();
    const pronto = sumarDiasISO(3);
    const lista: AlertaEjecutiva[] = [];

    data.clientes
      .filter(
        (cliente) =>
          clienteActivo(cliente) &&
          cliente.nivel_interes === "CALIENTE" &&
          !cliente.fecha_proximo_seguimiento
      )
      .slice(0, 5)
      .forEach((cliente) => {
        lista.push({
          id: `hot-no-date-${cliente.id}`,
          titulo: "Lead caliente sin fecha",
          descripcion: `${nombreCliente(
            cliente
          )} necesita proximo seguimiento.`,
          href: `/asesores/clientes/${cliente.id}#registrar-seguimiento`,
          accion: "Programar",
          prioridad: 1,
          tono: "red",
        });
      });

    data.clientes
      .filter(
        (cliente) =>
          clienteActivo(cliente) &&
          Boolean(cliente.fecha_proximo_seguimiento) &&
          String(cliente.fecha_proximo_seguimiento) < hoy
      )
      .slice(0, 5)
      .forEach((cliente) => {
        lista.push({
          id: `follow-overdue-${cliente.id}`,
          titulo: "Seguimiento vencido",
          descripcion: `${nombreCliente(
            cliente
          )} debio ser contactado el ${
            cliente.fecha_proximo_seguimiento
          }.`,
          href: `/asesores/clientes/${cliente.id}#registrar-seguimiento`,
          accion: "Atender",
          prioridad: cliente.nivel_interes === "CALIENTE" ? 1 : 2,
          tono: cliente.nivel_interes === "CALIENTE" ? "red" : "gold",
        });
      });

    data.separaciones
      .filter(
        (separacion) =>
          separacion.estado === "ACTIVA" &&
          Boolean(separacion.fecha_limite) &&
          String(separacion.fecha_limite) < hoy
      )
      .slice(0, 5)
      .forEach((separacion) => {
        const lote = separacion.lote_id
          ? lotesPorId.get(Number(separacion.lote_id))
          : undefined;

        lista.push({
          id: `sep-overdue-${separacion.id}`,
          titulo: "Separacion vencida",
          descripcion: `${nombreLote(lote)} vencio el ${
            separacion.fecha_limite
          }.`,
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Gestionar",
          prioridad: 1,
          tono: "red",
        });
      });

    data.separaciones
      .filter(
        (separacion) =>
          separacion.estado === "ACTIVA" &&
          Boolean(separacion.fecha_limite) &&
          String(separacion.fecha_limite) >= hoy &&
          String(separacion.fecha_limite) <= pronto
      )
      .slice(0, 5)
      .forEach((separacion) => {
        const lote = separacion.lote_id
          ? lotesPorId.get(Number(separacion.lote_id))
          : undefined;

        lista.push({
          id: `sep-soon-${separacion.id}`,
          titulo: "Separacion por vencer",
          descripcion: `${nombreLote(lote)} vence el ${
            separacion.fecha_limite
          }.`,
          href: `/asesores/separaciones?separacion=${separacion.id}`,
          accion: "Revisar",
          prioridad: 2,
          tono: "gold",
        });
      });

    data.lotes
      .filter((lote) => lote.estado === "CIERRE_SOLICITADO")
      .slice(0, 5)
      .forEach((lote) => {
        lista.push({
          id: `close-${lote.id}`,
          titulo: modoGerencia
            ? "Cierre por aprobar"
            : "Cierre en revision",
          descripcion: `${nombreLote(lote)} espera validacion.`,
          href: "/asesores/lotes",
          accion: modoGerencia ? "Aprobar" : "Ver estado",
          prioridad: modoGerencia ? 1 : 3,
          tono: modoGerencia ? "blue" : "gold",
        });
      });

    if (modoGerencia) {
      data.cotizaciones
        .filter(
          (cotizacion) => cotizacion.estado === "PENDIENTE_APROBACION"
        )
        .slice(0, 5)
        .forEach((cotizacion) => {
          const lote = lotesPorId.get(Number(cotizacion.lote_id));

          lista.push({
            id: `quote-approval-${cotizacion.id}`,
            titulo: "Cotizacion por aprobar",
            descripcion: `${cotizacion.numero} de ${nombreLote(
              lote
            )} espera decision comercial.`,
            href: "/asesores/cotizaciones?estado=PENDIENTE_APROBACION",
            accion: "Revisar",
            prioridad: 1,
            tono: "red",
          });
        });
    }

    data.cotizaciones
      .filter((cotizacion) => cotizacion.estado === "ACEPTADA")
      .slice(0, 5)
      .forEach((cotizacion) => {
        const lote = lotesPorId.get(Number(cotizacion.lote_id));

        lista.push({
          id: `quote-accepted-${cotizacion.id}`,
          titulo: "Cotizacion aceptada",
          descripcion: `${cotizacion.numero} de ${nombreLote(
            lote
          )} debe convertirse en separacion.`,
          href: "/asesores/cotizaciones?estado=ACEPTADA",
          accion: "Formalizar",
          prioridad: 1,
          tono: "blue",
        });
      });

    data.cotizaciones
      .filter(
        (cotizacion) =>
          cotizacion.estado === "ENVIADA" &&
          cotizacion.valida_hasta <= sumarDiasISO(2)
      )
      .slice(0, 5)
      .forEach((cotizacion) => {
        const lote = lotesPorId.get(Number(cotizacion.lote_id));
        const vencida = cotizacion.valida_hasta < hoy;

        lista.push({
          id: `quote-expiry-${cotizacion.id}`,
          titulo: vencida
            ? "Cotizacion vencida sin respuesta"
            : "Cotizacion por vencer",
          descripcion: `${cotizacion.numero} de ${nombreLote(lote)} ${
            vencida ? "vencio" : "vence"
          } el ${cotizacion.valida_hasta}.`,
          href: vencida
            ? "/asesores/cotizaciones?estado=VENCIDA"
            : "/asesores/cotizaciones?estado=ENVIADA",
          accion: "Dar seguimiento",
          prioridad: vencida ? 1 : 2,
          tono: vencida ? "red" : "gold",
        });
      });

    return lista
      .sort((a, b) => a.prioridad - b.prioridad)
      .slice(0, 8);
  }, [
    data.clientes,
    data.cotizaciones,
    data.lotes,
    data.separaciones,
    lotesPorId,
    modoGerencia,
  ]);

  const pulsoAsesores = useMemo<AsesorPulso[]>(() => {
    if (!modoGerencia) return [];

    const mapa = new Map<string, AsesorPulso>();

    const asegurar = (asesorId: string | null | undefined) => {
      const id = asesorId || "sin-asesor";
      const existente = mapa.get(id);

      if (existente) return existente;

      const nuevo: AsesorPulso = {
        id,
        nombre: nombreAsesor(id === "sin-asesor" ? null : id, asesoresPorId),
        clientes: 0,
        calientes: 0,
        negociaciones: 0,
        separados: 0,
        cierres: 0,
        vendidos: 0,
        montoPipeline: 0,
        puntaje: 0,
      };

      mapa.set(id, nuevo);
      return nuevo;
    };

    data.clientes.forEach((cliente) => {
      const item = asegurar(cliente.asesor_id);
      item.clientes += 1;

      if (cliente.nivel_interes === "CALIENTE") {
        item.calientes += 1;
      }
    });

    data.lotes.forEach((lote) => {
      const item = asegurar(lote.asesor_id);
      const precio = Number(lote.precio || 0);

      if (lote.estado === "EN_NEGOCIACION") {
        item.negociaciones += 1;
        item.montoPipeline += precio;
      }

      if (lote.estado === "SEPARADO") {
        item.separados += 1;
        item.montoPipeline += precio;
      }

      if (lote.estado === "CIERRE_SOLICITADO") {
        item.cierres += 1;
        item.montoPipeline += precio;
      }

      if (lote.estado === "VENDIDO") {
        item.vendidos += 1;
      }
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        puntaje:
          item.vendidos * 20 +
          item.cierres * 12 +
          item.separados * 8 +
          item.negociaciones * 5 +
          item.calientes * 2,
      }))
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 6);
  }, [asesoresPorId, data.clientes, data.lotes, modoGerencia]);

  const lotesPorEstado = useMemo(() => {
    const estados = [
      "DISPONIBLE",
      "EN_NEGOCIACION",
      "SEPARADO",
      "CIERRE_SOLICITADO",
      "VENDIDO",
      "BLOQUEADO",
    ];

    return estados.map((estado) => ({
      estado,
      cantidad: data.lotes.filter((lote) => lote.estado === estado).length,
    }));
  }, [data.lotes]);

  const oportunidades = useMemo(
    () =>
      data.lotes
        .filter((lote) =>
          ["EN_NEGOCIACION", "SEPARADO", "CIERRE_SOLICITADO"].includes(
            lote.estado
          )
        )
        .sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0))
        .slice(0, 6),
    [data.lotes]
  );

  const calidadHref = modoGerencia
    ? "/asesores/calidad"
    : "/asesores/tareas";

  return (
    <AsesorLayout>
      <section>
        <div style={hero}>
          <div>
            <span style={eyebrow}>
              {modoGerencia ? "Centro de mando" : "Panel comercial"}
            </span>
            <h1 style={title}>
              {modoGerencia
                ? "Pulso ejecutivo Las Lomas"
                : "Tu dia comercial en Las Lomas"}
            </h1>
            <p style={subtitle}>
              {modoGerencia
                ? "Una lectura rapida de ventas, pipeline, riesgos y calidad operativa."
                : "Prioriza clientes, separaciones y oportunidades que necesitan accion."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void cargar()}
            style={refreshButton}
          >
            Actualizar
          </button>
        </div>

        {error && (
          <div style={alert}>
            {error}. Revisa la configuracion de Supabase o las politicas RLS.
          </div>
        )}

        {cargando ? (
          <div style={emptyBox}>Cargando centro de mando...</div>
        ) : (
          <>
            <div style={executiveGrid}>
              <MetricCard
                label="Pipeline bruto"
                value={formatearMoneda(resumen.pipelineMonto)}
                tone="blue"
                href="/asesores/pronostico"
              />
              <MetricCard
                label="Forecast ponderado"
                value={formatearMoneda(resumen.forecast)}
                tone="green"
                href="/asesores/pronostico"
              />
              <MetricCard
                label="Ventas del mes"
                value={formatearMoneda(resumen.montoVendidoMes)}
                detail={`${resumen.vendidosMes} lotes`}
                tone="red"
                href="/asesores/reportes"
              />
              <MetricCard
                label="Alertas criticas"
                value={
                  resumen.separacionesVencidas +
                  resumen.seguimientosVencidos +
                  resumen.leadsCalientesSinFecha
                }
                detail="Requieren accion"
                tone="gold"
                href={calidadHref}
              />
            </div>

            <div style={quickGrid}>
              <MetricCard
                label="Clientes"
                value={resumen.clientes}
                detail={`${resumen.leadsCalientes} calientes`}
                tone="gray"
                href="/asesores/clientes"
              />
              <MetricCard
                label="Cierres solicitados"
                value={resumen.cierres}
                detail="Pendientes de validar"
                tone="blue"
                href="/asesores/lotes"
              />
              <MetricCard
                label="Separaciones activas"
                value={resumen.separacionesActivas}
                detail={`${resumen.separacionesPronto} por vencer`}
                tone="gold"
                href="/asesores/separaciones"
              />
              <MetricCard
                label="Disponibles"
                value={modoGerencia ? resumen.disponibles : resumen.pipeline}
                detail={
                  modoGerencia
                    ? `${resumen.totalLotes} lotes totales`
                    : "Mis oportunidades"
                }
                tone="green"
                href="/asesores/lotes"
              />
            </div>

            <div style={quickGrid}>
              <MetricCard
                label="Cotizaciones vigentes"
                value={resumen.cotizacionesVigentes}
                detail={formatearMoneda(resumen.montoCotizado)}
                tone="blue"
                href="/asesores/cotizaciones?estado=ENVIADA"
              />
              <MetricCard
                label="Aceptadas por formalizar"
                value={resumen.cotizacionesAceptadas}
                detail="Pendientes de separacion"
                tone="green"
                href="/asesores/cotizaciones?estado=ACEPTADA"
              />
              <MetricCard
                label="Conversion cotizada"
                value={`${resumen.conversionCotizaciones.toFixed(1)}%`}
                detail="Aceptadas y convertidas"
                tone="gray"
                href="/asesores/cotizaciones"
              />
              <MetricCard
                label={modoGerencia ? "Aprobaciones comerciales" : "En aprobacion"}
                value={resumen.cotizacionesPendientes}
                detail="Cotizaciones fuera de autonomia"
                tone="gold"
                href="/asesores/cotizaciones?estado=PENDIENTE_APROBACION"
              />
            </div>

            <div style={mainGrid}>
              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Prioridad de hoy</h2>
                    <p style={panelText}>
                      Lo que puede perder ventas si no se atiende.
                    </p>
                  </div>
                  <Link href="/asesores/tareas" style={secondaryLink}>
                    Ver tareas
                  </Link>
                </div>

                {alertas.length === 0 ? (
                  <div style={emptyBox}>
                    Sin alertas urgentes. Buen momento para empujar nuevas oportunidades.
                  </div>
                ) : (
                  <div style={alertList}>
                    {alertas.map((item) => (
                      <div key={item.id} style={alertItem}>
                        <div>
                          <span
                            style={{
                              ...alertDot,
                              ...(item.tono === "red"
                                ? alertDotRed
                                : item.tono === "gold"
                                  ? alertDotGold
                                  : alertDotBlue),
                            }}
                          />
                          <strong>{item.titulo}</strong>
                          <p>{item.descripcion}</p>
                        </div>
                        <Link href={item.href} style={miniLink}>
                          {item.accion}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Oportunidades clave</h2>
                    <p style={panelText}>
                      Lotes de mayor valor en gestion comercial.
                    </p>
                  </div>
                  <Link href="/asesores/pronostico" style={secondaryLink}>
                    Ver forecast
                  </Link>
                </div>

                {oportunidades.length === 0 ? (
                  <div style={emptyBox}>
                    No hay oportunidades activas en este momento.
                  </div>
                ) : (
                  <div style={opportunityList}>
                    {oportunidades.map((lote) => {
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
                                : nombreAsesor(lote.asesor_id, asesoresPorId)}
                            </p>
                          </div>
                          <div style={opportunityRight}>
                            <span
                              style={{
                                ...stateBadge,
                                background: estadoColor.bg,
                                color: estadoColor.fg,
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
                )}
              </article>
            </div>

            <div style={mainGrid}>
              {modoGerencia && (
                <article style={panel}>
                  <div style={panelHeader}>
                    <div>
                      <h2 style={panelTitle}>Pulso por asesor</h2>
                      <p style={panelText}>
                        Ranking operativo por ventas, cierres, separaciones y leads.
                      </p>
                    </div>
                    <Link href="/asesores/reportes" style={secondaryLink}>
                      Reportes
                    </Link>
                  </div>

                  {pulsoAsesores.length === 0 ? (
                    <div style={emptyBox}>Sin actividad por asesor.</div>
                  ) : (
                    <div style={advisorList}>
                      {pulsoAsesores.map((asesor, index) => (
                        <div key={asesor.id} style={advisorItem}>
                          <span style={rankBadge}>{index + 1}</span>
                          <div>
                            <strong>{asesor.nombre}</strong>
                            <p>
                              {asesor.clientes} clientes - {asesor.calientes} calientes
                            </p>
                          </div>
                          <div style={advisorRight}>
                            <strong>{formatearMoneda(asesor.montoPipeline)}</strong>
                            <small>
                              {asesor.cierres} cierres - {asesor.vendidos} ventas
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )}

              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Inventario por estado</h2>
                    <p style={panelText}>
                      Distribucion actual de los lotes del proyecto.
                    </p>
                  </div>
                  <Link href="/asesores/lotes" style={secondaryLink}>
                    Ver lotes
                  </Link>
                </div>

                <div style={stateList}>
                  {lotesPorEstado.map((item) => {
                    const color = colorEstado(item.estado);
                    const total = Math.max(resumen.totalLotes, 1);
                    const width = `${Math.round((item.cantidad / total) * 100)}%`;

                    return (
                      <div key={item.estado} style={stateItem}>
                        <div style={stateTop}>
                          <span>{etiquetaEstado(item.estado)}</span>
                          <strong>{item.cantidad}</strong>
                        </div>
                        <div style={barTrack}>
                          <div
                            style={{
                              ...barFill,
                              width,
                              background: color.fg,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <div style={linksGrid}>
              <QuickLink
                href="/asesores/embudo"
                title="Embudo"
                text="Mover clientes por etapa comercial."
              />
              <QuickLink
                href="/asesores/agenda"
                title="Agenda"
                text="Revisar citas y seguimientos."
              />
              <QuickLink
                href="/asesores/separaciones"
                title="Separaciones"
                text="Gestionar vencimientos y liberaciones."
              />
              <QuickLink
                href="/asesores/metas"
                title={modoGerencia ? "Metas comerciales" : "Mis metas"}
                text="Medir objetivos mensuales y avance real."
              />
              {modoGerencia && (
                <QuickLink
                  href="/asesores/calidad"
                  title="Calidad CRM"
                  text="Detectar inconsistencias y datos incompletos."
                />
              )}
            </div>
          </>
        )}
      </section>
    </AsesorLayout>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  detail?: string;
  tone: "green" | "gold" | "red" | "gray" | "blue";
  href: string;
}) {
  const colors = {
    green: {
      bg: "#eef8f1",
      fg: "#17633a",
      border: "#c9e7d2",
    },
    gold: {
      bg: "#fff8e1",
      fg: "#8a5a00",
      border: "#eed28a",
    },
    red: {
      bg: "#fff1ef",
      fg: "#8b2f25",
      border: "#f3c7c0",
    },
    gray: {
      bg: "#f8fafc",
      fg: "#334155",
      border: "#e5e7eb",
    },
    blue: {
      bg: "#eef6ff",
      fg: "#244d77",
      border: "#c7ddf4",
    },
  }[tone];

  return (
    <Link
      href={href}
      style={{
        ...metricCard,
        background: colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </Link>
  );
}

function QuickLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} style={quickLink}>
      <strong>{title}</strong>
      <span>{text}</span>
    </Link>
  );
}

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
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
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.45,
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

const executiveGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 14,
};

const quickGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const metricCard: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  textDecoration: "none",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))",
  gap: 16,
  marginBottom: 16,
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 14,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 21,
  fontWeight: 950,
};

const panelText: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.4,
};

const secondaryLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  borderRadius: 10,
  padding: "0 11px",
  background: "#f8fafc",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const alertList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const alertItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  background: "#fbfbf8",
};

const alertDot: React.CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 999,
  marginRight: 8,
};

const alertDotRed: React.CSSProperties = {
  background: "#b23b2f",
};

const alertDotGold: React.CSSProperties = {
  background: "#d28a1f",
};

const alertDotBlue: React.CSSProperties = {
  background: "#2e6aa8",
};

const miniLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  borderRadius: 9,
  padding: "0 10px",
  background: "#2f7d46",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const opportunityList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const opportunityItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  background: "#fbfbf8",
};

const opportunityRight: React.CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "end",
  textAlign: "right",
};

const stateBadge: React.CSSProperties = {
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const advisorList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const advisorItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px 1fr auto",
  gap: 10,
  alignItems: "center",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  padding: 12,
  background: "#fbfbf8",
};

const rankBadge: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: "#0f3b2f",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
};

const advisorRight: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  textAlign: "right",
  gap: 3,
};

const stateList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const stateItem: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const stateTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#334155",
  fontWeight: 850,
};

const barTrack: React.CSSProperties = {
  height: 9,
  borderRadius: 999,
  background: "#eef2f7",
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const linksGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
};

const quickLink: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 5,
  textDecoration: "none",
  color: "#0f172a",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
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
