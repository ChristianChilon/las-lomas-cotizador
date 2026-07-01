"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  CRM_ESTADOS,
  LOTES_TABLE,
  colorEstado,
  etiquetaEstado,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Profile,
} from "../../lib/crm";

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
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState<number | null>(null);

  const cargar = async () => {
    if (!supabase) return;

    const perfil =
      await obtenerPerfilActual();
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

  const lotesFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, "");

    return lotes.filter((lote) => {
      const coincideEstado =
        estado === "TODOS" ||
        lote.estado === estado;

      const codigo =
        `${lote.mz}${lote.lote}`
          .toLowerCase()
          .replace(/[-\s]/g, "");

      const coincideTexto =
        !texto ||
        codigo.includes(texto) ||
        lote.mz.toLowerCase().includes(texto);

      return coincideEstado && coincideTexto;
    });
  }, [busqueda, estado, lotes]);

  const cambiarEstado = async (
    lote: LoteCrm,
    estadoNuevo: string
  ) => {
    if (!supabase || !profile) return;
    if (estadoNuevo === lote.estado) return;

    setGuardando(lote.id);
    setMensaje(null);
    setError(null);

    const estadoAnterior = lote.estado;

    const { error: updateError } =
      await supabase
        .from(LOTES_TABLE)
        .update({
          estado: estadoNuevo,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", lote.id);

    if (updateError) {
      setError(updateError.message);
      setGuardando(null);
      return;
    }

    const { error: historyError } =
      await supabase
        .from("historial_lotes")
        .insert({
          lote_id: lote.id,
          estado_anterior: estadoAnterior,
          estado_nuevo: estadoNuevo,
          cambiado_por: profile.id,
          motivo:
            "Cambio desde panel CRM",
        });

    if (historyError) {
      setError(historyError.message);
    } else {
      setMensaje(
        `Lote ${lote.mz}-${lote.lote} actualizado.`
      );
    }

    setGuardando(null);
    cargar();
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
      </div>

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
              const asesor = lote.asesor_id
                ? asesores[lote.asesor_id]
                : null;

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
                    {nombreCliente(cliente) ||
                      "-"}
                  </td>
                  <td style={td}>
                    {asesor?.full_name ||
                      asesor?.email ||
                      "-"}
                  </td>
                  <td style={td}>
                    <select
                      value={lote.estado}
                      disabled={
                        guardando === lote.id
                      }
                      onChange={(event) =>
                        cambiarEstado(
                          lote,
                          event.target.value
                        )
                      }
                      style={selectSmall}
                    >
                      {CRM_ESTADOS.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {etiquetaEstado(
                              item
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
