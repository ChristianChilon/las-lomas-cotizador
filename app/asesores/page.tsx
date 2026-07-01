"use client";

import { useEffect, useState } from "react";
import AsesorLayout from "../../components/layout/AsesorLayout";
import KpiCard from "../../components/dashboard/KpiCard";
import { supabase } from "../../lib/supabase";
import { LOTES_TABLE, type LoteCrm } from "../../lib/crm";

type Kpis = {
  totalLotes: number;
  disponibles: number;
  separados: number;
  vendidos: number;
  clientes: number;
  separacionesVigentes: number;
  separacionesVencidas: number;
};

export default function AsesoresDashboard() {
  const [kpis, setKpis] = useState<Kpis>({
    totalLotes: 0,
    disponibles: 0,
    separados: 0,
    vendidos: 0,
    clientes: 0,
    separacionesVigentes: 0,
    separacionesVencidas: 0,
  });

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      if (!supabase) return;

      const { data: lotes, error: lotesError } =
        await supabase
          .from(LOTES_TABLE)
          .select("id,estado");

      const {
        count: clientesCount,
        error: clientesError,
      } = await supabase
        .from("clientes")
        .select("id", {
          count: "exact",
          head: true,
        });

      const {
        data: separaciones,
        error: separacionesError,
      } = await supabase
        .from("separaciones")
        .select("id,estado");

      const errorActual =
        lotesError ||
        clientesError ||
        separacionesError;

      if (errorActual) {
        setError(errorActual.message);
        return;
      }

      const listaLotes =
        (lotes || []) as Pick<
          LoteCrm,
          "id" | "estado"
        >[];

      setKpis({
        totalLotes: listaLotes.length,
        disponibles: listaLotes.filter(
          (lote) =>
            lote.estado === "DISPONIBLE"
        ).length,
        separados: listaLotes.filter(
          (lote) =>
            lote.estado === "SEPARADO"
        ).length,
        vendidos: listaLotes.filter(
          (lote) =>
            lote.estado === "VENDIDO"
        ).length,
        clientes: clientesCount || 0,
        separacionesVigentes: (
          separaciones || []
        ).filter(
          (item) =>
            item.estado === "ACTIVA"
        ).length,
        separacionesVencidas: (
          separaciones || []
        ).filter(
          (item) =>
            item.estado === "VENCIDA"
        ).length,
      });
    };

    cargar();
  }, []);

  return (
    <AsesorLayout>
      <section>
        <div
          style={{
            marginBottom: 24,
          }}
        >
          <h1 style={title}>
            Dashboard comercial
          </h1>
          <p style={subtitle}>
            Resumen operativo de lotes, clientes y
            separaciones.
          </p>
        </div>

        {error && (
          <div style={alert}>
            {error}. Ejecuta primero el SQL CRM en
            Supabase si aun no lo hiciste.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          <KpiCard
            label="Total de lotes"
            value={kpis.totalLotes}
          />
          <KpiCard
            label="Disponibles"
            value={kpis.disponibles}
            tone="green"
          />
          <KpiCard
            label="Separados"
            value={kpis.separados}
            tone="gold"
          />
          <KpiCard
            label="Vendidos"
            value={kpis.vendidos}
            tone="red"
          />
          <KpiCard
            label="Clientes registrados"
            value={kpis.clientes}
            tone="gray"
          />
          <KpiCard
            label="Separaciones vigentes"
            value={kpis.separacionesVigentes}
            tone="gold"
          />
          <KpiCard
            label="Separaciones vencidas"
            value={kpis.separacionesVencidas}
            tone="red"
          />
        </div>
      </section>
    </AsesorLayout>
  );
}

const title: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: 15,
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
