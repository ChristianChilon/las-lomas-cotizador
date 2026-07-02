"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  LOTES_TABLE,
  esGerencia,
  etiquetaEstado,
  type LoteCrm,
  type Profile,
} from "../../lib/crm";

type Historial = {
  id: string;
  lote_id: number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  cambiado_por: string | null;
  motivo: string | null;
  created_at: string;
};

export default function HistorialTable() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [historial, setHistorial] = useState<
    Historial[]
  >([]);
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [perfiles, setPerfiles] = useState<Profile[]>(
    []
  );
  const [error, setError] =
    useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    const [
      historialRes,
      lotesRes,
      perfilesRes,
    ] = await Promise.all([
      supabase
        .from("historial_lotes")
        .select(
          "id,lote_id,estado_anterior,estado_nuevo,cambiado_por,motivo,created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(300),
      supabase
        .from(LOTES_TABLE)
        .select(
          "id,mz,lote,area,precio,estado,svg_id,cliente_id,asesor_id,updated_at"
        ),
      supabase
        .from("profiles")
        .select(
          "id,full_name,email,role,phone,active"
        ),
    ]);

    if (historialRes.error) {
      setError(historialRes.error.message);
      return;
    }

    setError(null);
    setHistorial(
      (historialRes.data || []) as Historial[]
    );
    setLotes((lotesRes.data || []) as LoteCrm[]);
    setPerfiles(
      (perfilesRes.data || []) as Profile[]
    );
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const lotesMap = useMemo(() => {
    const map: Record<number, LoteCrm> = {};
    lotes.forEach((lote) => {
      map[lote.id] = lote;
    });
    return map;
  }, [lotes]);

  const perfilesMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    perfiles.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [perfiles]);

  if (!esGerencia(profile)) {
    return (
      <div style={alert}>
        Esta vista esta disponible solo para admin y
        jefe de ventas.
      </div>
    );
  }

  return (
    <section>
      {error && <div style={alert}>{error}</div>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {[
                "Fecha",
                "Lote",
                "Antes",
                "Despues",
                "Usuario",
                "Motivo",
              ].map((head) => (
                <th key={head} style={th}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historial.map((item) => {
              const lote = item.lote_id
                ? lotesMap[item.lote_id]
                : null;
              const usuario = item.cambiado_por
                ? perfilesMap[item.cambiado_por]
                : null;

              return (
                <tr key={item.id}>
                  <td style={td}>
                    {new Date(
                      item.created_at
                    ).toLocaleString("es-PE")}
                  </td>
                  <td style={td}>
                    {lote
                      ? `MZ ${lote.mz} - Lote ${lote.lote}`
                      : item.lote_id || "-"}
                  </td>
                  <td style={td}>
                    {etiquetaEstado(
                      item.estado_anterior
                    )}
                  </td>
                  <td style={td}>
                    {etiquetaEstado(
                      item.estado_nuevo
                    )}
                  </td>
                  <td style={td}>
                    {usuario?.full_name ||
                      usuario?.email ||
                      "-"}
                  </td>
                  <td style={td}>{item.motivo || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

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

const alert: React.CSSProperties = {
  marginBottom: 12,
  background: "#fbe0dc",
  color: "#8b2f25",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};
