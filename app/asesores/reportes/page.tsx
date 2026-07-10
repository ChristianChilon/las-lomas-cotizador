"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  CONFIGURACION_COMERCIAL_BASE,
  diasCadencia,
  diasDesde,
  formatearDuracion,
  minutosAtencionEntre,
  minutosAtencionTranscurridos,
  type ConfiguracionComercial,
} from "../../../lib/comercial";
import {
  LOTES_TABLE,
  esGerencia,
  etiquetaEstadoLead,
  etiquetaNivelInteres,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
  type SeguimientoCliente,
  type Separacion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type HistorialLote = {
  id: string;
  lote_id: number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  cambiado_por: string | null;
  motivo: string | null;
  created_at: string | null;
};

type ResultadoSla = {
  estado: "PENDIENTE" | "CUMPLIDO" | "VENCIDO";
  minutos: number;
  respondido: boolean;
};

type AsesorResumen = {
  id: string;
  nombre: string;
  correo: string;
  activo: boolean;
  clientesNuevos: number;
  leadsCalientes: number;
  slaEvaluados: number;
  slaCumplidos: number;
  slaPendientes: number;
  slaPorcentaje: number | null;
  respuestaMuestras: number;
  respuestaTotalMinutos: number;
  respuestaPromedio: number | null;
  separaciones: number;
  cierres: number;
  ventas: number;
  montoVendido: number;
  conversionSeparacion: number;
  conversionVenta: number;
  seguimientosVencidos: number;
  oportunidadesEstancadas: number;
};

type FuenteResumen = {
  fuente: string;
  clientes: number;
  contactados: number;
  slaEvaluados: number;
  slaCumplidos: number;
  separados: number;
  vendidos: number;
  slaPorcentaje: number | null;
  conversionSeparacion: number;
  conversionVenta: number;
};

type OportunidadEstancada = {
  cliente: Cliente;
  asesorNombre: string;
  dias: number;
  limite: number;
  ultimaActividad: string | null;
};

const SIN_ASESOR_ID = "sin-asesor";

const periodoActual = () => {
  const hoy = new Date();

  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
};

const fechaHoyLocalISO = () => {
  const hoy = new Date();

  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(hoy.getDate()).padStart(2, "0")}`;
};

const inicioPeriodo = (periodo: string) => `${periodo}-01`;

const siguientePeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);
  const fecha = new Date(year, month, 1);

  return `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(2, "0")}-01`;
};

const etiquetaPeriodo = (periodo: string) => {
  const [year, month] = periodo.split("-").map(Number);

  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
};

const fechaEnPeriodo = (
  fecha: string | null | undefined,
  inicio: string,
  fin: string
) => Boolean(fecha && fecha >= inicio && fecha < fin);

const porcentaje = (valor: number | null) =>
  valor === null
    ? "Sin muestra"
    : `${valor.toLocaleString("es-PE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })}%`;

const mediana = (valores: number[]) => {
  if (valores.length === 0) return null;

  const ordenados = [...valores].sort((a, b) => a - b);
  const centro = Math.floor(ordenados.length / 2);

  if (ordenados.length % 2 === 0) {
    return (ordenados[centro - 1] + ordenados[centro]) / 2;
  }

  return ordenados[centro];
};

const nombreAsesor = (asesor?: Profile | null) =>
  asesor?.full_name || asesor?.email || "Asesor";

const normalizarFuente = (fuente: string | null | undefined) =>
  fuente?.trim() || "Sin fuente";

const clienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

const csvValor = (valor: string | number | null) => {
  const texto = String(valor ?? "");

  return `"${texto.replaceAll('"', '""')}"`;
};

const crearResumen = (
  id: string,
  nombre: string,
  correo: string,
  activo: boolean
): AsesorResumen => ({
  id,
  nombre,
  correo,
  activo,
  clientesNuevos: 0,
  leadsCalientes: 0,
  slaEvaluados: 0,
  slaCumplidos: 0,
  slaPendientes: 0,
  slaPorcentaje: null,
  respuestaMuestras: 0,
  respuestaTotalMinutos: 0,
  respuestaPromedio: null,
  separaciones: 0,
  cierres: 0,
  ventas: 0,
  montoVendido: 0,
  conversionSeparacion: 0,
  conversionVenta: 0,
  seguimientosVencidos: 0,
  oportunidadesEstancadas: 0,
});

export default function ReportesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [seguimientos, setSeguimientos] = useState<
    SeguimientoCliente[]
  >([]);
  const [separaciones, setSeparaciones] = useState<Separacion[]>([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [historial, setHistorial] = useState<HistorialLote[]>([]);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionComercial>(CONFIGURACION_COMERCIAL_BASE);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [asesorFiltro, setAsesorFiltro] = useState("TODOS");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
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
      setError(perfil.error || "No se pudo cargar tu perfil.");
      setCargando(false);
      return;
    }

    if (!esGerencia(perfil.profile)) {
      setCargando(false);
      return;
    }

    const [
      asesoresResult,
      clientesResult,
      seguimientosResult,
      separacionesResult,
      lotesResult,
      historialResult,
      configuracionResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role,phone,active")
        .eq("role", "asesor")
        .order("full_name", { ascending: true }),
      supabase.from("clientes").select(
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
          "nivel_interes",
          "estado_lead",
          "proxima_accion",
          "fecha_proximo_seguimiento",
          "created_at",
          "updated_at",
        ].join(",")
      ),
      supabase
        .from("seguimientos_clientes")
        .select(
          "id,cliente_id,asesor_id,tipo_contacto,resultado,comentario,fecha_proximo_seguimiento,created_by,created_at"
        )
        .order("created_at", { ascending: true }),
      supabase.from("separaciones").select(
        "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
      ),
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        ),
      supabase
        .from("historial_lotes")
        .select(
          "id,lote_id,estado_anterior,estado_nuevo,cambiado_por,motivo,created_at"
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("configuracion_comercial")
        .select(
          "project_key,sla_primer_contacto_minutos,cadencia_caliente_dias,cadencia_tibio_dias,cadencia_frio_dias,alerta_separacion_dias,hora_inicio,hora_fin,atender_sabado,atender_domingo"
        )
        .eq("project_key", "las_lomas")
        .maybeSingle(),
    ]);

    const faltaConfiguracion = Boolean(
      configuracionResult.error &&
        (configuracionResult.error.code === "42P01" ||
          configuracionResult.error.code === "PGRST205" ||
          configuracionResult.error.message.includes(
            "configuracion_comercial"
          ))
    );

    const errorActual =
      asesoresResult.error ||
      clientesResult.error ||
      seguimientosResult.error ||
      separacionesResult.error ||
      lotesResult.error ||
      historialResult.error ||
      (faltaConfiguracion ? null : configuracionResult.error);

    if (errorActual) {
      setError(errorActual.message);
      setCargando(false);
      return;
    }

    setAsesores((asesoresResult.data || []) as unknown as Profile[]);
    setClientes((clientesResult.data || []) as unknown as Cliente[]);
    setSeguimientos(
      (seguimientosResult.data || []) as unknown as SeguimientoCliente[]
    );
    setSeparaciones(
      (separacionesResult.data || []) as unknown as Separacion[]
    );
    setLotes((lotesResult.data || []) as unknown as LoteCrm[]);
    setHistorial(
      (historialResult.data || []) as unknown as HistorialLote[]
    );
    setConfiguracion(
      faltaConfiguracion || !configuracionResult.data
        ? CONFIGURACION_COMERCIAL_BASE
        : (configuracionResult.data as unknown as ConfiguracionComercial)
    );
    setCargando(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  const modoGerencia = esGerencia(profile);

  const analitica = useMemo(() => {
    const inicio = inicioPeriodo(periodo);
    const fin = siguientePeriodo(periodo);
    const hoyISO = fechaHoyLocalISO();
    const asesoresPorId = new Map(
      asesores.map((asesor) => [asesor.id, asesor])
    );
    const lotesPorId = new Map(lotes.map((lote) => [lote.id, lote]));
    const seguimientosPorCliente = new Map<
      string,
      SeguimientoCliente[]
    >();

    seguimientos.forEach((seguimiento) => {
      const lista =
        seguimientosPorCliente.get(seguimiento.cliente_id) || [];
      lista.push(seguimiento);
      seguimientosPorCliente.set(seguimiento.cliente_id, lista);
    });

    const perteneceFiltro = (asesorId: string | null | undefined) =>
      asesorFiltro === "TODOS"
        ? true
        : asesorId === asesorFiltro;

    const clientesPeriodo = clientes.filter(
      (cliente) =>
        perteneceFiltro(cliente.asesor_id) &&
        fechaEnPeriodo(cliente.created_at, inicio, fin)
    );
    const separacionesPeriodo = separaciones.filter(
      (separacion) =>
        perteneceFiltro(separacion.asesor_id) &&
        fechaEnPeriodo(separacion.created_at, inicio, fin)
    );

    const eventosUnicos = (estado: string) => {
      const mapa = new Map<number, HistorialLote>();

      historial.forEach((evento) => {
        if (
          evento.lote_id &&
          evento.estado_nuevo === estado &&
          fechaEnPeriodo(evento.created_at, inicio, fin)
        ) {
          mapa.set(Number(evento.lote_id), evento);
        }
      });

      return Array.from(mapa.values()).filter((evento) => {
        const lote = evento.lote_id
          ? lotesPorId.get(Number(evento.lote_id))
          : undefined;

        if (estado === "VENDIDO" && lote?.estado !== "VENDIDO") {
          return false;
        }

        return perteneceFiltro(lote?.asesor_id);
      });
    };

    const ventasPeriodo = eventosUnicos("VENDIDO");
    const cierresPeriodo = eventosUnicos("CIERRE_SOLICITADO");
    const clientesConSeparacion = new Set(
      separaciones
        .map((separacion) => separacion.cliente_id)
        .filter((id): id is string => Boolean(id))
    );
    const clientesVendidos = new Set(
      lotes
        .filter((lote) => lote.estado === "VENDIDO" && lote.cliente_id)
        .map((lote) => lote.cliente_id as string)
    );

    const evaluarSla = (cliente: Cliente): ResultadoSla => {
      const lista = seguimientosPorCliente.get(cliente.id) || [];
      const primerContacto = lista.find(
        (seguimiento) =>
          Boolean(seguimiento.created_at) &&
          Boolean(cliente.created_at) &&
          String(seguimiento.created_at) >= String(cliente.created_at)
      );

      if (primerContacto?.created_at) {
        const minutos = minutosAtencionEntre(
          cliente.created_at,
          primerContacto.created_at,
          configuracion
        );

        return {
          estado:
            minutos <= configuracion.sla_primer_contacto_minutos
              ? "CUMPLIDO"
              : "VENCIDO",
          minutos,
          respondido: true,
        };
      }

      const minutos = minutosAtencionTranscurridos(
        cliente.created_at,
        configuracion
      );

      return {
        estado:
          minutos >= configuracion.sla_primer_contacto_minutos
            ? "VENCIDO"
            : "PENDIENTE",
        minutos,
        respondido: false,
      };
    };

    const slaPorCliente = new Map(
      clientesPeriodo.map((cliente) => [cliente.id, evaluarSla(cliente)])
    );
    const mapaReportes = new Map<string, AsesorResumen>();

    asesores
      .filter(
        (asesor) =>
          asesorFiltro === "TODOS" || asesor.id === asesorFiltro
      )
      .forEach((asesor) => {
        mapaReportes.set(
          asesor.id,
          crearResumen(
            asesor.id,
            nombreAsesor(asesor),
            asesor.email || "-",
            asesor.active
          )
        );
      });

    const asegurarResumen = (asesorId: string | null | undefined) => {
      const id = asesorId || SIN_ASESOR_ID;
      const existente = mapaReportes.get(id);

      if (existente) return existente;

      if (asesorFiltro !== "TODOS" && id !== asesorFiltro) return null;

      const asesor = asesoresPorId.get(id);
      const nuevo = crearResumen(
        id,
        id === SIN_ASESOR_ID
          ? "Sin asesor asignado"
          : nombreAsesor(asesor),
        asesor?.email || "Pendiente de asignacion",
        asesor?.active ?? true
      );
      mapaReportes.set(id, nuevo);

      return nuevo;
    };

    clientesPeriodo.forEach((cliente) => {
      const resumen = asegurarResumen(cliente.asesor_id);
      if (!resumen) return;

      resumen.clientesNuevos += 1;
      if (cliente.nivel_interes === "CALIENTE") {
        resumen.leadsCalientes += 1;
      }

      if (clientesConSeparacion.has(cliente.id)) {
        resumen.conversionSeparacion += 1;
      }
      if (clientesVendidos.has(cliente.id)) {
        resumen.conversionVenta += 1;
      }

      const sla = slaPorCliente.get(cliente.id);
      if (!sla) return;

      if (sla.estado === "PENDIENTE") {
        resumen.slaPendientes += 1;
      } else {
        resumen.slaEvaluados += 1;
        if (sla.estado === "CUMPLIDO") resumen.slaCumplidos += 1;
      }

      if (sla.respondido) {
        resumen.respuestaMuestras += 1;
        resumen.respuestaTotalMinutos += sla.minutos;
      }
    });

    separacionesPeriodo.forEach((separacion) => {
      const resumen = asegurarResumen(separacion.asesor_id);
      if (resumen) resumen.separaciones += 1;
    });

    cierresPeriodo.forEach((evento) => {
      const lote = evento.lote_id
        ? lotesPorId.get(Number(evento.lote_id))
        : undefined;
      const resumen = asegurarResumen(lote?.asesor_id);
      if (resumen) resumen.cierres += 1;
    });

    ventasPeriodo.forEach((evento) => {
      const lote = evento.lote_id
        ? lotesPorId.get(Number(evento.lote_id))
        : undefined;
      const resumen = asegurarResumen(lote?.asesor_id);

      if (resumen && lote) {
        resumen.ventas += 1;
        resumen.montoVendido += Number(lote.precio || 0);
      }
    });

    const estancadas: OportunidadEstancada[] = clientes
      .filter(
        (cliente) =>
          perteneceFiltro(cliente.asesor_id) && clienteActivo(cliente)
      )
      .map((cliente) => {
        const lista = seguimientosPorCliente.get(cliente.id) || [];
        const ultimo = lista[lista.length - 1];
        const ultimaActividad = ultimo?.created_at || cliente.created_at || null;
        const dias = diasDesde(ultimaActividad);
        const limite = diasCadencia(cliente, configuracion);

        return {
          cliente,
          asesorNombre: cliente.asesor_id
            ? nombreAsesor(asesoresPorId.get(cliente.asesor_id))
            : "Sin asesor",
          dias,
          limite,
          ultimaActividad,
        };
      })
      .filter((item) => item.dias >= item.limite)
      .sort((a, b) => {
        const presionA = a.dias / Math.max(a.limite, 1);
        const presionB = b.dias / Math.max(b.limite, 1);

        if (presionB !== presionA) return presionB - presionA;
        return b.dias - a.dias;
      });

    estancadas.forEach((item) => {
      const resumen = asegurarResumen(item.cliente.asesor_id);
      if (resumen) resumen.oportunidadesEstancadas += 1;
    });

    clientes
      .filter(
        (cliente) =>
          perteneceFiltro(cliente.asesor_id) && clienteActivo(cliente)
      )
      .forEach((cliente) => {
        const fecha = cliente.fecha_proximo_seguimiento || "";
        if (fecha && fecha < hoyISO) {
          const resumen = asegurarResumen(cliente.asesor_id);
          if (resumen) resumen.seguimientosVencidos += 1;
        }
      });

    const reportes = Array.from(mapaReportes.values())
      .map((resumen) => ({
        ...resumen,
        slaPorcentaje:
          resumen.slaEvaluados > 0
            ? (resumen.slaCumplidos / resumen.slaEvaluados) * 100
            : null,
        respuestaPromedio:
          resumen.respuestaMuestras > 0
            ? resumen.respuestaTotalMinutos / resumen.respuestaMuestras
            : null,
        conversionSeparacion:
          resumen.clientesNuevos > 0
            ? (resumen.conversionSeparacion / resumen.clientesNuevos) * 100
            : 0,
        conversionVenta:
          resumen.clientesNuevos > 0
            ? (resumen.conversionVenta / resumen.clientesNuevos) * 100
            : 0,
      }))
      .sort((a, b) => {
        if (b.ventas !== a.ventas) return b.ventas - a.ventas;
        if (b.separaciones !== a.separaciones) {
          return b.separaciones - a.separaciones;
        }
        return (b.slaPorcentaje || 0) - (a.slaPorcentaje || 0);
      });

    const fuentesMapa = new Map<string, FuenteResumen>();

    clientesPeriodo.forEach((cliente) => {
      const fuente = normalizarFuente(cliente.fuente);
      const actual =
        fuentesMapa.get(fuente) || {
          fuente,
          clientes: 0,
          contactados: 0,
          slaEvaluados: 0,
          slaCumplidos: 0,
          separados: 0,
          vendidos: 0,
          slaPorcentaje: null,
          conversionSeparacion: 0,
          conversionVenta: 0,
        };
      const sla = slaPorCliente.get(cliente.id);

      actual.clientes += 1;
      if (sla?.respondido) actual.contactados += 1;
      if (sla && sla.estado !== "PENDIENTE") {
        actual.slaEvaluados += 1;
        if (sla.estado === "CUMPLIDO") actual.slaCumplidos += 1;
      }
      if (clientesConSeparacion.has(cliente.id)) actual.separados += 1;
      if (clientesVendidos.has(cliente.id)) actual.vendidos += 1;

      fuentesMapa.set(fuente, actual);
    });

    const fuentes = Array.from(fuentesMapa.values())
      .map((item) => ({
        ...item,
        slaPorcentaje:
          item.slaEvaluados > 0
            ? (item.slaCumplidos / item.slaEvaluados) * 100
            : null,
        conversionSeparacion:
          item.clientes > 0 ? (item.separados / item.clientes) * 100 : 0,
        conversionVenta:
          item.clientes > 0 ? (item.vendidos / item.clientes) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.clientes !== a.clientes) return b.clientes - a.clientes;
        return b.conversionSeparacion - a.conversionSeparacion;
      });

    const respuestas = Array.from(slaPorCliente.values())
      .filter((sla) => sla.respondido)
      .map((sla) => sla.minutos);
    const slaEvaluados = Array.from(slaPorCliente.values()).filter(
      (sla) => sla.estado !== "PENDIENTE"
    ).length;
    const slaCumplidos = Array.from(slaPorCliente.values()).filter(
      (sla) => sla.estado === "CUMPLIDO"
    ).length;
    const montoVendido = ventasPeriodo.reduce((total, evento) => {
      const lote = evento.lote_id
        ? lotesPorId.get(Number(evento.lote_id))
        : undefined;

      return total + Number(lote?.precio || 0);
    }, 0);

    return {
      reportes,
      fuentes,
      estancadas,
      resumen: {
        clientesNuevos: clientesPeriodo.length,
        slaPorcentaje:
          slaEvaluados > 0 ? (slaCumplidos / slaEvaluados) * 100 : null,
        slaPendientes: Array.from(slaPorCliente.values()).filter(
          (sla) => sla.estado === "PENDIENTE"
        ).length,
        respuestaMediana: mediana(respuestas),
        separaciones: separacionesPeriodo.length,
        cierres: cierresPeriodo.length,
        ventas: ventasPeriodo.length,
        montoVendido,
        estancadas: estancadas.length,
      },
    };
  }, [
    asesorFiltro,
    asesores,
    clientes,
    configuracion,
    historial,
    lotes,
    periodo,
    seguimientos,
    separaciones,
  ]);

  const exportarCsv = () => {
    const encabezados = [
      "Periodo",
      "Asesor",
      "Clientes nuevos",
      "Leads calientes",
      "SLA cumplido",
      "Respuesta promedio minutos",
      "Separaciones",
      "Cierres",
      "Ventas",
      "Monto vendido",
      "Conversion separacion",
      "Conversion venta",
      "Seguimientos vencidos",
      "Oportunidades estancadas",
    ];
    const filas = analitica.reportes.map((item) => [
      periodo,
      item.nombre,
      item.clientesNuevos,
      item.leadsCalientes,
      item.slaPorcentaje === null
        ? "Sin muestra"
        : item.slaPorcentaje.toFixed(1),
      item.respuestaPromedio === null
        ? "Sin muestra"
        : item.respuestaPromedio.toFixed(0),
      item.separaciones,
      item.cierres,
      item.ventas,
      item.montoVendido.toFixed(2),
      item.conversionSeparacion.toFixed(1),
      item.conversionVenta.toFixed(1),
      item.seguimientosVencidos,
      item.oportunidadesEstancadas,
    ]);
    const contenido = [encabezados, ...filas]
      .map((fila) => fila.map(csvValor).join(","))
      .join("\r\n");
    const archivo = new Blob(
      [String.fromCharCode(0xfeff), contenido],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = `analitica-comercial-${periodo}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  if (!cargando && !modoGerencia) {
    return (
      <AsesorLayout
        title="Analitica comercial"
        subtitle="Modulo reservado para admin y jefe de ventas."
      >
        <div style={emptyBox}>
          Tu usuario no tiene permisos para ver la analitica general.
        </div>
      </AsesorLayout>
    );
  }

  return (
    <AsesorLayout
      title="Analitica comercial"
      subtitle="Velocidad de respuesta, conversion, productividad y riesgo por asesor."
    >
      <section>
        <div style={toolbar}>
          <div>
            <span style={eyebrow}>Periodo analizado</span>
            <h2 style={title}>{etiquetaPeriodo(periodo)}</h2>
          </div>

          <div style={toolbarActions}>
            <label style={controlLabel}>
              Mes
              <input
                type="month"
                value={periodo}
                onChange={(event) => setPeriodo(event.target.value)}
                style={control}
              />
            </label>

            <label style={controlLabel}>
              Asesor
              <select
                value={asesorFiltro}
                onChange={(event) => setAsesorFiltro(event.target.value)}
                style={control}
              >
                <option value="TODOS">Todo el equipo</option>
                {asesores.map((asesor) => (
                  <option key={asesor.id} value={asesor.id}>
                    {nombreAsesor(asesor)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={exportarCsv}
              disabled={analitica.reportes.length === 0}
              style={secondaryButton}
            >
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={() => void cargar()}
              style={primaryButton}
            >
              Actualizar
            </button>
          </div>
        </div>

        {error && <div style={alert}>{error}</div>}

        <div style={summaryGrid}>
          <SummaryCard
            label="Clientes nuevos"
            value={analitica.resumen.clientesNuevos}
            detail={`${analitica.resumen.slaPendientes} aun dentro del SLA`}
            tone="gray"
          />
          <SummaryCard
            label="Cumplimiento SLA"
            value={porcentaje(analitica.resumen.slaPorcentaje)}
            detail={`Objetivo: ${configuracion.sla_primer_contacto_minutos} min`}
            tone={
              analitica.resumen.slaPorcentaje === null
                ? "gray"
                : analitica.resumen.slaPorcentaje === 100
                  ? "green"
                  : analitica.resumen.slaPorcentaje === 0
                    ? "red"
                    : "gold"
            }
          />
          <SummaryCard
            label="Respuesta mediana"
            value={
              analitica.resumen.respuestaMediana === null
                ? "Sin muestra"
                : formatearDuracion(
                    Math.round(analitica.resumen.respuestaMediana)
                  )
            }
            detail="Medida dentro del horario comercial"
            tone="blue"
          />
          <SummaryCard
            label="Separaciones"
            value={analitica.resumen.separaciones}
            detail={`${analitica.resumen.cierres} cierres solicitados`}
            tone="gold"
          />
          <SummaryCard
            label="Ventas"
            value={analitica.resumen.ventas}
            detail={formatearMoneda(analitica.resumen.montoVendido)}
            tone="green"
          />
          <SummaryCard
            label="Oportunidades estancadas"
            value={analitica.resumen.estancadas}
            detail="Superaron su cadencia de actividad"
            tone={analitica.resumen.estancadas > 0 ? "red" : "gray"}
          />
        </div>

        <article style={insightPanel}>
          <div>
            <h2 style={panelTitle}>Lectura gerencial</h2>
            <p style={panelText}>
              El reporte separa resultados del periodo de los riesgos
              operativos actuales. Las ventas se toman del historial
              inmutable de cambios a VENDIDO.
            </p>
          </div>
          <div style={insightMetric}>
            <span>Mejor fuente por volumen</span>
            <strong>{analitica.fuentes[0]?.fuente || "Sin datos"}</strong>
          </div>
          <div style={insightMetric}>
            <span>Regla SLA activa</span>
            <strong>
              {configuracion.sla_primer_contacto_minutos} minutos
            </strong>
          </div>
        </article>

        {cargando ? (
          <div style={emptyBox}>Cargando analitica comercial...</div>
        ) : (
          <>
            <article style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Rendimiento por asesor</h2>
                  <p style={panelText}>
                    Actividad, velocidad, conversion y resultados del periodo.
                  </p>
                </div>
              </div>

              <div style={tableScroll}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Asesor</th>
                      <th style={th}>Nuevos</th>
                      <th style={th}>SLA</th>
                      <th style={th}>Resp. prom.</th>
                      <th style={th}>Separaciones</th>
                      <th style={th}>Cierres</th>
                      <th style={th}>Ventas</th>
                      <th style={th}>Monto vendido</th>
                      <th style={th}>Conv. sep.</th>
                      <th style={th}>Conv. venta</th>
                      <th style={th}>Vencidos</th>
                      <th style={th}>Estancados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analitica.reportes.map((item) => (
                      <tr key={item.id}>
                        <td style={tdStrong}>
                          <div>{item.nombre}</div>
                          <span style={subText}>{item.correo}</span>
                          {!item.activo && (
                            <span style={inactiveBadge}>Inactivo</span>
                          )}
                        </td>
                        <td style={td}>{item.clientesNuevos}</td>
                        <td style={td}>
                          <SlaBadge value={item.slaPorcentaje} />
                        </td>
                        <td style={td}>
                          {item.respuestaPromedio === null
                            ? "-"
                            : formatearDuracion(
                                Math.round(item.respuestaPromedio)
                              )}
                        </td>
                        <td style={td}>{item.separaciones}</td>
                        <td style={td}>{item.cierres}</td>
                        <td style={td}>{item.ventas}</td>
                        <td style={td}>
                          {formatearMoneda(item.montoVendido)}
                        </td>
                        <td style={td}>
                          {porcentaje(item.conversionSeparacion)}
                        </td>
                        <td style={td}>
                          {porcentaje(item.conversionVenta)}
                        </td>
                        <td style={tdRisk}>
                          {item.seguimientosVencidos}
                        </td>
                        <td style={tdRisk}>
                          {item.oportunidadesEstancadas}
                        </td>
                      </tr>
                    ))}
                    {analitica.reportes.length === 0 && (
                      <tr>
                        <td colSpan={12} style={emptyTable}>
                          No hay asesores ni actividad para este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <div style={lowerGrid}>
              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Conversion por fuente</h2>
                    <p style={panelText}>
                      Calidad de los clientes captados durante el periodo.
                    </p>
                  </div>
                </div>

                {analitica.fuentes.length === 0 ? (
                  <div style={emptyBox}>No hay fuentes para este periodo.</div>
                ) : (
                  <div style={sourceList}>
                    {analitica.fuentes.map((fuente) => (
                      <div key={fuente.fuente} style={sourceItem}>
                        <div style={sourceTop}>
                          <div style={itemIdentity}>
                            <strong>{fuente.fuente}</strong>
                            <span>{fuente.clientes} clientes</span>
                          </div>
                          <span style={sourceConversion}>
                            {porcentaje(fuente.conversionSeparacion)} sep.
                          </span>
                        </div>
                        <div style={sourceMetrics}>
                          <span>SLA {porcentaje(fuente.slaPorcentaje)}</span>
                          <span>{fuente.contactados} contactados</span>
                          <span>{fuente.separados} separados</span>
                          <span>{fuente.vendidos} vendidos</span>
                        </div>
                        <ProgressBar
                          value={fuente.conversionSeparacion}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Oportunidades estancadas</h2>
                    <p style={panelText}>
                      Clientes activos que superaron su cadencia comercial.
                    </p>
                  </div>
                  <Link href="/asesores/tareas" style={smallLink}>
                    Abrir tareas
                  </Link>
                </div>

                {analitica.estancadas.length === 0 ? (
                  <div style={emptyBox}>
                    No hay oportunidades fuera de cadencia.
                  </div>
                ) : (
                  <div style={staleList}>
                    {analitica.estancadas.slice(0, 12).map((item) => (
                      <Link
                        key={item.cliente.id}
                        href={`/asesores/clientes/${item.cliente.id}`}
                        style={staleItem}
                      >
                        <div style={itemIdentity}>
                          <strong>{nombreCliente(item.cliente)}</strong>
                          <span>
                            {item.asesorNombre} - {etiquetaEstadoLead(
                              item.cliente.estado_lead
                            )}
                          </span>
                        </div>
                        <div style={staleRight}>
                          <span
                            style={{
                              ...levelBadge,
                              ...(item.cliente.nivel_interes === "CALIENTE"
                                ? badgeRed
                                : item.cliente.nivel_interes === "TIBIO"
                                  ? badgeGold
                                  : badgeGray),
                            }}
                          >
                            {etiquetaNivelInteres(
                              item.cliente.nivel_interes
                            )}
                          </span>
                          <strong>
                            {item.dias} dias / limite {item.limite}
                          </strong>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </>
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

function SlaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span style={{ ...badgeBase, ...badgeGray }}>Sin muestra</span>;
  }

  const color =
    value === 100 ? badgeGreen : value === 0 ? badgeRed : badgeGold;

  return (
    <span style={{ ...badgeBase, ...color }}>{porcentaje(value)}</span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={progressTrack}>
      <div
        style={{
          ...progressFill,
          width: `${Math.max(0, Math.min(value, 100))}%`,
        }}
      />
    </div>
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

const controlLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const control: React.CSSProperties = {
  height: 42,
  minWidth: 160,
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

const primaryButton: React.CSSProperties = {
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
  gridTemplateColumns: "minmax(280px,1fr) repeat(2,minmax(170px,220px))",
  gap: 14,
  alignItems: "center",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const insightMetric: React.CSSProperties = {
  borderRadius: 14,
  background: "#f8fafc",
  padding: 13,
  display: "grid",
  gap: 5,
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  marginBottom: 18,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
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
  lineHeight: 1.45,
};

const tableScroll: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1380,
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "13px 14px",
  background: "#f8fafc",
  color: "#36513f",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "13px 14px",
  color: "#334155",
  fontWeight: 850,
  borderBottom: "1px solid #eef2f7",
  whiteSpace: "nowrap",
};

const tdStrong: React.CSSProperties = {
  ...td,
  minWidth: 210,
  color: "#0f172a",
  fontWeight: 950,
};

const tdRisk: React.CSSProperties = {
  ...td,
  color: "#8b2f25",
  fontWeight: 950,
};

const subText: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 950,
};

const badgeGreen: React.CSSProperties = {
  background: "#e6f4ea",
  color: "#17633a",
};

const badgeGold: React.CSSProperties = {
  background: "#fff3d6",
  color: "#8a5a00",
};

const badgeRed: React.CSSProperties = {
  background: "#f7dad6",
  color: "#8b2f25",
};

const badgeGray: React.CSSProperties = {
  background: "#eef2f7",
  color: "#475569",
};

const inactiveBadge: React.CSSProperties = {
  ...badgeBase,
  ...badgeRed,
  marginTop: 8,
};

const lowerGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
  gap: 16,
};

const sourceList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const sourceItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "#fbfbf8",
  display: "grid",
  gap: 9,
};

const sourceTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const sourceConversion: React.CSSProperties = {
  color: "#17633a",
  fontWeight: 950,
};

const itemIdentity: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const sourceMetrics: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 12,
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
  background: "#2f7d46",
};

const staleList: React.CSSProperties = {
  display: "grid",
  gap: 9,
};

const staleItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "#fbfbf8",
  color: "#0f172a",
  textDecoration: "none",
};

const staleRight: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  textAlign: "right",
  gap: 6,
};

const levelBadge: React.CSSProperties = {
  ...badgeBase,
};

const smallLink: React.CSSProperties = {
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  padding: "0 11px",
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: "nowrap",
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
  padding: 24,
  color: "#64748b",
};
