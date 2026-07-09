"use client";

import { useEffect, useMemo, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  esGerencia,
  formatearMoneda,
  type Cliente,
  type LoteCrm,
  type Profile,
  type Separacion,
} from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";

type AsesorResumen = {
  id: string;
  nombre: string;
  correo: string;
  activo: boolean;
  clientes: number;
  leadsCalientes: number;
  seguimientosVencidos: number;
  separacionesActivas: number;
  separacionesVencidas: number;
  cierresSolicitados: number;
  vendidos: number;
  montoSeparado: number;
  montoVendido: number;
  conversionSeparacion: number;
  conversionVenta: number;
  puntaje: number;
};

const SIN_ASESOR_ID = "sin-asesor";

const obtenerFechaHoyISO = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const porcentaje = (valor: number) =>
  `${valor.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;

const crearResumenVacio = (
  id: string,
  nombre: string,
  correo: string,
  activo: boolean
): AsesorResumen => ({
  id,
  nombre,
  correo,
  activo,
  clientes: 0,
  leadsCalientes: 0,
  seguimientosVencidos: 0,
  separacionesActivas: 0,
  separacionesVencidas: 0,
  cierresSolicitados: 0,
  vendidos: 0,
  montoSeparado: 0,
  montoVendido: 0,
  conversionSeparacion: 0,
  conversionVenta: 0,
  puntaje: 0,
});

const estadoClienteActivo = (cliente: Cliente) =>
  cliente.estado_lead !== "VENDIDO" &&
  cliente.estado_lead !== "PERDIDO";

export default function ReportesPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [asesores, setAsesores] = useState<Profile[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
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

    if (!esGerencia(perfil.profile)) {
      setCargando(false);
      return;
    }

    const [
      asesoresResult,
      clientesResult,
      separacionesResult,
      lotesResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role,phone,active")
        .eq("role", "asesor")
        .order("full_name", {
          ascending: true,
        }),
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
      supabase.from("separaciones").select(
        "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at,liberacion_solicitada,motivo_liberacion,fecha_solicitud_liberacion,solicitado_liberacion_por,fecha_liberacion_resuelta,resuelto_liberacion_por"
      ),
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        ),
    ]);

    const errorActual =
      asesoresResult.error ||
      clientesResult.error ||
      separacionesResult.error ||
      lotesResult.error;

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
    setSeparaciones(
      (separacionesResult.data || []) as unknown as Separacion[]
    );
    setLotes(
      (lotesResult.data || []) as unknown as LoteCrm[]
    );
    setCargando(false);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const reportes = useMemo(() => {
    const hoy = obtenerFechaHoyISO();
    const mapa = new Map<string, AsesorResumen>();

    asesores.forEach((asesor) => {
      mapa.set(
        asesor.id,
        crearResumenVacio(
          asesor.id,
          asesor.full_name || "Asesor sin nombre",
          asesor.email || "-",
          asesor.active
        )
      );
    });

    const asegurarResumen = (
      asesorId: string | null | undefined
    ) => {
      const id = asesorId || SIN_ASESOR_ID;
      const existente = mapa.get(id);

      if (existente) return existente;

      const nuevo = crearResumenVacio(
        id,
        "Sin asesor asignado",
        "Pendiente de asignacion",
        true
      );
      mapa.set(id, nuevo);

      return nuevo;
    };

    clientes.forEach((cliente) => {
      const resumen = asegurarResumen(cliente.asesor_id);

      resumen.clientes += 1;

      if (cliente.nivel_interes === "CALIENTE") {
        resumen.leadsCalientes += 1;
      }

      const fecha =
        cliente.fecha_proximo_seguimiento || "";

      if (
        estadoClienteActivo(cliente) &&
        fecha !== "" &&
        fecha < hoy
      ) {
        resumen.seguimientosVencidos += 1;
      }
    });

    separaciones.forEach((separacion) => {
      const resumen = asegurarResumen(
        separacion.asesor_id
      );
      const fecha = separacion.fecha_limite || "";

      if (separacion.estado === "ACTIVA") {
        resumen.separacionesActivas += 1;
      }

      if (
        separacion.estado === "VENCIDA" ||
        (separacion.estado === "ACTIVA" &&
          fecha !== "" &&
          fecha < hoy)
      ) {
        resumen.separacionesVencidas += 1;
      }
    });

    lotes.forEach((lote) => {
      const resumen = asegurarResumen(lote.asesor_id);
      const precio = Number(lote.precio || 0);

      if (lote.estado === "CIERRE_SOLICITADO") {
        resumen.cierresSolicitados += 1;
        resumen.montoSeparado += precio;
      }

      if (lote.estado === "SEPARADO") {
        resumen.montoSeparado += precio;
      }

      if (lote.estado === "VENDIDO") {
        resumen.vendidos += 1;
        resumen.montoVendido += precio;
      }
    });

    return Array.from(mapa.values())
      .map((resumen) => {
        const separacionesYVentas =
          resumen.separacionesActivas +
          resumen.cierresSolicitados +
          resumen.vendidos;

        const conversionSeparacion =
          resumen.clientes > 0
            ? (separacionesYVentas / resumen.clientes) * 100
            : 0;

        const conversionVenta =
          resumen.clientes > 0
            ? (resumen.vendidos / resumen.clientes) * 100
            : 0;

        const puntaje =
          resumen.vendidos * 20 +
          resumen.cierresSolicitados * 12 +
          resumen.separacionesActivas * 8 +
          resumen.leadsCalientes * 3 -
          resumen.seguimientosVencidos * 5 -
          resumen.separacionesVencidas * 6;

        return {
          ...resumen,
          conversionSeparacion,
          conversionVenta,
          puntaje,
        };
      })
      .sort((a, b) => {
        if (b.vendidos !== a.vendidos) {
          return b.vendidos - a.vendidos;
        }

        if (
          b.cierresSolicitados !== a.cierresSolicitados
        ) {
          return (
            b.cierresSolicitados - a.cierresSolicitados
          );
        }

        if (
          b.separacionesActivas !== a.separacionesActivas
        ) {
          return (
            b.separacionesActivas - a.separacionesActivas
          );
        }

        return b.puntaje - a.puntaje;
      });
  }, [asesores, clientes, lotes, separaciones]);

  const resumenGeneral = useMemo(
    () =>
      reportes.reduce(
        (acc, item) => ({
          asesores: acc.asesores + (item.id === SIN_ASESOR_ID ? 0 : 1),
          clientes: acc.clientes + item.clientes,
          calientes: acc.calientes + item.leadsCalientes,
          seguimientosVencidos:
            acc.seguimientosVencidos +
            item.seguimientosVencidos,
          separacionesActivas:
            acc.separacionesActivas +
            item.separacionesActivas,
          separacionesVencidas:
            acc.separacionesVencidas +
            item.separacionesVencidas,
          cierresSolicitados:
            acc.cierresSolicitados +
            item.cierresSolicitados,
          vendidos: acc.vendidos + item.vendidos,
          montoVendido:
            acc.montoVendido + item.montoVendido,
        }),
        {
          asesores: 0,
          clientes: 0,
          calientes: 0,
          seguimientosVencidos: 0,
          separacionesActivas: 0,
          separacionesVencidas: 0,
          cierresSolicitados: 0,
          vendidos: 0,
          montoVendido: 0,
        }
      ),
    [reportes]
  );

  const mejorAsesor = reportes.find(
    (item) => item.id !== SIN_ASESOR_ID
  );

  const estadoPuntaje = (puntaje: number) => {
    if (puntaje >= 40) return "Alto";
    if (puntaje >= 15) return "Medio";
    return "Revisar";
  };

  if (!cargando && !modoGerencia) {
    return (
      <AsesorLayout
        title="Reportes"
        subtitle="Modulo reservado para admin y jefe de ventas."
      >
        <div style={emptyBox}>
          Tu usuario no tiene permisos para ver reportes
          generales del equipo.
        </div>
      </AsesorLayout>
    );
  }

  return (
    <AsesorLayout
      title="Reportes"
      subtitle="Rendimiento comercial por asesor, separaciones, cierres y ventas."
    >
      <section>
        <div style={summaryGrid}>
          <div style={summaryCard}>
            <span>Asesores</span>
            <strong>{resumenGeneral.asesores}</strong>
          </div>

          <div style={summaryCard}>
            <span>Clientes</span>
            <strong>{resumenGeneral.clientes}</strong>
          </div>

          <div style={summaryCardGold}>
            <span>Leads calientes</span>
            <strong>{resumenGeneral.calientes}</strong>
          </div>

          <div style={summaryCardRed}>
            <span>Seguimientos vencidos</span>
            <strong>
              {resumenGeneral.seguimientosVencidos}
            </strong>
          </div>

          <div style={summaryCardGold}>
            <span>Separaciones activas</span>
            <strong>
              {resumenGeneral.separacionesActivas}
            </strong>
          </div>

          <div style={summaryCardRed}>
            <span>Separaciones vencidas</span>
            <strong>
              {resumenGeneral.separacionesVencidas}
            </strong>
          </div>

          <div style={summaryCardBlue}>
            <span>Cierres solicitados</span>
            <strong>
              {resumenGeneral.cierresSolicitados}
            </strong>
          </div>

          <div style={summaryCardGreen}>
            <span>Ventas</span>
            <strong>{resumenGeneral.vendidos}</strong>
          </div>
        </div>

        <div style={insightBox}>
          <div>
            <h2 style={insightTitle}>
              Lectura gerencial
            </h2>
            <p style={insightText}>
              Este reporte cruza clientes, separaciones y
              lotes para detectar productividad real y riesgo
              comercial por asesor.
            </p>
          </div>

          <div style={insightMetric}>
            <span>Monto vendido</span>
            <strong>
              {formatearMoneda(resumenGeneral.montoVendido)}
            </strong>
          </div>

          <div style={insightMetric}>
            <span>Mejor ubicado</span>
            <strong>
              {mejorAsesor?.nombre || "Sin datos"}
            </strong>
          </div>
        </div>

        {error && <div style={alert}>{error}</div>}

        {cargando ? (
          <div style={emptyBox}>
            Cargando reportes comerciales...
          </div>
        ) : reportes.length === 0 ? (
          <div style={emptyBox}>
            Todavia no hay datos suficientes para generar
            reportes.
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Asesor</th>
                  <th style={th}>Clientes</th>
                  <th style={th}>Calientes</th>
                  <th style={th}>Sep.</th>
                  <th style={th}>Vencidas</th>
                  <th style={th}>Cierres</th>
                  <th style={th}>Ventas</th>
                  <th style={th}>Monto vendido</th>
                  <th style={th}>Conv. sep.</th>
                  <th style={th}>Conv. venta</th>
                  <th style={th}>Salud</th>
                </tr>
              </thead>

              <tbody>
                {reportes.map((item) => {
                  const salud = estadoPuntaje(item.puntaje);
                  const saludStyle =
                    salud === "Alto"
                      ? badgeGreen
                      : salud === "Medio"
                        ? badgeGold
                        : badgeRed;

                  return (
                    <tr key={item.id}>
                      <td style={tdStrong}>
                        <div>{item.nombre}</div>
                        <span style={subText}>
                          {item.correo}
                        </span>
                        {!item.activo && (
                          <span style={inactiveBadge}>
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td style={td}>{item.clientes}</td>
                      <td style={td}>
                        {item.leadsCalientes}
                      </td>
                      <td style={td}>
                        {item.separacionesActivas}
                      </td>
                      <td
                        style={{
                          ...td,
                          color:
                            item.separacionesVencidas > 0
                              ? "#8b2f25"
                              : "#334155",
                          fontWeight: 950,
                        }}
                      >
                        {item.separacionesVencidas}
                      </td>
                      <td style={td}>
                        {item.cierresSolicitados}
                      </td>
                      <td style={td}>{item.vendidos}</td>
                      <td style={td}>
                        {formatearMoneda(item.montoVendido)}
                      </td>
                      <td style={td}>
                        {porcentaje(
                          item.conversionSeparacion
                        )}
                      </td>
                      <td style={td}>
                        {porcentaje(item.conversionVenta)}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            ...badgeBase,
                            ...saludStyle,
                          }}
                        >
                          {salud}
                        </span>
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

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCardBase: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 6,
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const summaryCard: React.CSSProperties = {
  ...summaryCardBase,
  background: "#ffffff",
  color: "#0f172a",
};

const summaryCardGreen: React.CSSProperties = {
  ...summaryCardBase,
  background: "#eef8f1",
  color: "#17633a",
  borderColor: "#c9e7d2",
};

const summaryCardGold: React.CSSProperties = {
  ...summaryCardBase,
  background: "#fff8e1",
  color: "#8a5a00",
  borderColor: "#eed28a",
};

const summaryCardRed: React.CSSProperties = {
  ...summaryCardBase,
  background: "#fff1ef",
  color: "#8b2f25",
  borderColor: "#f3c7c0",
};

const summaryCardBlue: React.CSSProperties = {
  ...summaryCardBase,
  background: "#eef6ff",
  color: "#244d77",
  borderColor: "#c7ddf4",
};

const insightBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  display: "grid",
  gridTemplateColumns:
    "minmax(280px,1fr) repeat(2,minmax(170px,220px))",
  gap: 14,
  alignItems: "center",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const insightTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 950,
};

const insightText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  lineHeight: 1.45,
};

const insightMetric: React.CSSProperties = {
  borderRadius: 14,
  background: "#f8fafc",
  padding: 13,
  display: "grid",
  gap: 5,
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

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1080,
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
  minWidth: 220,
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

const inactiveBadge: React.CSSProperties = {
  ...badgeBase,
  ...badgeRed,
  marginTop: 8,
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 16,
  borderRadius: 14,
  fontWeight: 800,
};
