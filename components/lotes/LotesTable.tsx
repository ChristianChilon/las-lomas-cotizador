"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  CRM_ESTADOS,
  LOTES_TABLE,
  colorEstado,
  etiquetaEstado,
  esGerencia,
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
  const [asesorFiltro, setAsesorFiltro] =
    useState("TODOS");
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState<number | null>(null);
  const [asignando, setAsignando] =
    useState<number | null>(null);
  const [aprobando, setAprobando] =
    useState<number | null>(null);

  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
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

  const modoGerencia = esGerencia(profile);

  const asesoresLista = useMemo(
    () =>
      Object.values(asesores).filter(
        (asesor) =>
          asesor.active !== false &&
          asesor.role === "asesor"
      ),
    [asesores]
  );

  const lotesFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, "");

    return lotes.filter((lote) => {
      const coincideEstado =
        estado === "TODOS" ||
        lote.estado === estado;

      const coincideAsesor =
        !modoGerencia ||
        asesorFiltro === "TODOS" ||
        (asesorFiltro === "SIN_ASIGNAR"
          ? !lote.asesor_id
          : lote.asesor_id === asesorFiltro);

      const codigo =
        `${lote.mz}${lote.lote}`
          .toLowerCase()
          .replace(/[-\s]/g, "");

      const coincideTexto =
        !texto ||
        codigo.includes(texto) ||
        lote.mz.toLowerCase().includes(texto);

      return (
        coincideEstado &&
        coincideAsesor &&
        coincideTexto
      );
    });
  }, [
    asesorFiltro,
    busqueda,
    estado,
    lotes,
    modoGerencia,
  ]);

  const estadosPermitidos = (lote: LoteCrm) => {
    if (!profile) return [lote.estado];

    if (modoGerencia) {
      return Array.from(CRM_ESTADOS).filter(
        (estadoItem) =>
          estadoItem !== "SEPARADO" ||
          lote.estado === "SEPARADO"
      );
    }

    if (
      lote.asesor_id &&
      lote.asesor_id !== profile.id
    ) {
      return [lote.estado];
    }

    if (lote.estado === "DISPONIBLE") {
      return [
        "DISPONIBLE",
        "EN_NEGOCIACION",
        "CIERRE_SOLICITADO",
      ];
    }

    if (lote.estado === "EN_NEGOCIACION") {
      return [
        "EN_NEGOCIACION",
        "DISPONIBLE",
        "CIERRE_SOLICITADO",
      ];
    }

    if (lote.estado === "SEPARADO") {
      return [
        "SEPARADO",
        "CIERRE_SOLICITADO",
      ];
    }

    return [lote.estado];
  };

  const cambiarEstado = async (
    lote: LoteCrm,
    estadoNuevo: string
  ) => {
    if (!supabase || !profile) return;
    if (estadoNuevo === lote.estado) return;

    setGuardando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_cambiar_estado_lote", {
        p_lote_id: lote.id,
        p_estado_nuevo: estadoNuevo,
        p_motivo:
          "Cambio desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Lote ${lote.mz}-${lote.lote} actualizado.`
      );
      await cargar();
    }

    setGuardando(null);
  };

  const asignarLote = async (
    lote: LoteCrm,
    asesorId: string
  ) => {
    if (!supabase || !modoGerencia) return;

    setAsignando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_asignar_lote", {
        p_lote_id: lote.id,
        p_asesor_id: asesorId || null,
        p_motivo:
          "Asignacion desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Lote ${lote.mz}-${lote.lote} reasignado.`
      );
      await cargar();
    }

    setAsignando(null);
  };

  const aprobarCierre = async (lote: LoteCrm) => {
    if (!supabase || !modoGerencia) return;

    setAprobando(lote.id);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_aprobar_cierre_lote", {
        p_lote_id: lote.id,
        p_motivo:
          "Venta aprobada desde panel CRM",
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        `Venta aprobada para ${lote.mz}-${lote.lote}.`
      );
      await cargar();
    }

    setAprobando(null);
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
        {modoGerencia && (
          <select
            value={asesorFiltro}
            onChange={(event) =>
              setAsesorFiltro(event.target.value)
            }
            style={select}
          >
            <option value="TODOS">
              Todos los asesores
            </option>
            <option value="SIN_ASIGNAR">
              Sin asignar
            </option>
            {asesoresLista.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.full_name || item.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {profile && !modoGerencia && (
        <div style={infoBox}>
          Para separar un lote con cliente, usa
          <strong> Mis separaciones</strong>. El
          estado separado debe crear una ficha real
          con cliente, monto, fecha y asesor.
        </div>
      )}

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
              const opciones =
                estadosPermitidos(lote);
              const puedeCambiar =
                opciones.length > 1;

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
                    {modoGerencia ? (
                      <select
                        value={lote.asesor_id || ""}
                        disabled={
                          asignando === lote.id
                        }
                        onChange={(event) =>
                          asignarLote(
                            lote,
                            event.target.value
                          )
                        }
                        style={selectSmall}
                      >
                        <option value="">
                          Sin asignar
                        </option>
                        {asesoresLista.map(
                          (item) => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.full_name ||
                                item.email}
                            </option>
                          )
                        )}
                      </select>
                    ) : asesor?.id === profile?.id ? (
                      "Asignado a ti"
                    ) : asesor ? (
                      "Asignado"
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={td}>
                    <div style={actionStack}>
                      <select
                        value={lote.estado}
                        disabled={
                          guardando === lote.id ||
                          !puedeCambiar
                        }
                        onChange={(event) =>
                          cambiarEstado(
                            lote,
                            event.target.value
                          )
                        }
                        style={selectSmall}
                      >
                        {opciones.map((item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {etiquetaEstado(item)}
                          </option>
                        ))}
                      </select>
                      {modoGerencia &&
                        lote.estado ===
                          "CIERRE_SOLICITADO" && (
                          <button
                            type="button"
                            disabled={
                              aprobando ===
                              lote.id
                            }
                            onClick={() =>
                              aprobarCierre(lote)
                            }
                            style={primarySmall}
                          >
                            {aprobando ===
                            lote.id
                              ? "Aprobando..."
                              : "Aprobar venta"}
                          </button>
                        )}
                      {profile &&
                        !modoGerencia &&
                        (lote.estado ===
                          "DISPONIBLE" ||
                          lote.estado ===
                            "EN_NEGOCIACION") && (
                          <a
                            href="/asesores/separaciones"
                            style={secondarySmall}
                          >
                            Separar con cliente
                          </a>
                        )}
                    </div>
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

const actionStack: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const primarySmall: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #2f6f43",
  padding: "0 12px",
  background: "#2f6f43",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondarySmall: React.CSSProperties = {
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid #c7b98f",
  padding: "0 12px",
  background: "#fff7dc",
  color: "#5f4a16",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const infoBox: React.CSSProperties = {
  marginBottom: 12,
  background: "#eef6ff",
  color: "#244d77",
  borderRadius: 12,
  padding: 12,
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
