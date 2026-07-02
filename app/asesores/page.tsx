"use client";

import { useEffect, useState } from "react";
import AsesorLayout from "../../components/layout/AsesorLayout";
import KpiCard from "../../components/dashboard/KpiCard";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  esGerencia,
  type LoteCrm,
  type Profile,
} from "../../lib/crm";

type Kpis = {
  totalLotes: number;
  disponibles: number;
  enNegociacion: number;
  separados: number;
  cierresSolicitados: number;
  vendidos: number;
  clientes: number;
  separacionesVigentes: number;
  separacionesVencidas: number;
};

const kpisVacios: Kpis = {
  totalLotes: 0,
  disponibles: 0,
  enNegociacion: 0,
  separados: 0,
  cierresSolicitados: 0,
  vendidos: 0,
  clientes: 0,
  separacionesVigentes: 0,
  separacionesVencidas: 0,
};

export default function AsesoresDashboard() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [kpis, setKpis] =
    useState<Kpis>(kpisVacios);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      if (!supabase) return;

      const perfil = await obtenerPerfilActual();
      setProfile(perfil.profile);

      if (!perfil.profile) {
        setError(
          perfil.error ||
            "No se pudo cargar tu perfil."
        );
        return;
      }

      const modoGerencia = esGerencia(perfil.profile);

      const { data: lotes, error: lotesError } =
        await supabase
          .from(LOTES_TABLE)
          .select("id,estado,asesor_id");

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
        .select("id,estado,asesor_id");

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
          "id" | "estado" | "asesor_id"
        >[];

      const lotesParaKpi = modoGerencia
        ? listaLotes
        : listaLotes.filter(
            (lote) =>
              lote.asesor_id ===
              perfil.profile?.id
          );

      setKpis({
        totalLotes: lotesParaKpi.length,
        disponibles: modoGerencia
          ? listaLotes.filter(
              (lote) =>
                lote.estado === "DISPONIBLE"
            ).length
          : 0,
        enNegociacion: lotesParaKpi.filter(
          (lote) =>
            lote.estado === "EN_NEGOCIACION"
        ).length,
        separados: lotesParaKpi.filter(
          (lote) =>
            lote.estado === "SEPARADO"
        ).length,
        cierresSolicitados:
          lotesParaKpi.filter(
            (lote) =>
              lote.estado ===
              "CIERRE_SOLICITADO"
          ).length,
        vendidos: modoGerencia
          ? listaLotes.filter(
              (lote) =>
                lote.estado === "VENDIDO"
            ).length
          : 0,
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

  const modoGerencia = esGerencia(profile);

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
            {modoGerencia
              ? "Resumen general de lotes, clientes y separaciones."
              : "Resumen de tus clientes, separaciones y lotes asignados."}
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
          {modoGerencia ? (
            <>
              <KpiCard
                label="Total de lotes"
                value={kpis.totalLotes}
              />
              <KpiCard
                label="Disponibles"
                value={kpis.disponibles}
                tone="green"
              />
            </>
          ) : (
            <KpiCard
              label="Mis lotes en gestion"
              value={kpis.totalLotes}
            />
          )}
          <KpiCard
            label={
              modoGerencia
                ? "En negociacion"
                : "Mis negociaciones"
            }
            value={kpis.enNegociacion}
            tone="gold"
          />
          <KpiCard
            label={
              modoGerencia
                ? "Separados"
                : "Mis separados"
            }
            value={kpis.separados}
            tone="gold"
          />
          <KpiCard
            label={
              modoGerencia
                ? "Cierres solicitados"
                : "Mis cierres solicitados"
            }
            value={kpis.cierresSolicitados}
          />
          {modoGerencia && (
            <KpiCard
              label="Vendidos"
              value={kpis.vendidos}
              tone="red"
            />
          )}
          <KpiCard
            label={
              modoGerencia
                ? "Clientes registrados"
                : "Mis clientes"
            }
            value={kpis.clientes}
            tone="gray"
          />
          <KpiCard
            label={
              modoGerencia
                ? "Separaciones vigentes"
                : "Mis separaciones vigentes"
            }
            value={kpis.separacionesVigentes}
            tone="gold"
          />
          <KpiCard
            label={
              modoGerencia
                ? "Separaciones vencidas"
                : "Mis separaciones vencidas"
            }
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
