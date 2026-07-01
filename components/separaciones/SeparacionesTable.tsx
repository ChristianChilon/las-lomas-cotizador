"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  LOTES_TABLE,
  colorEstado,
  formatearArea,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type LoteCrm,
  type Separacion,
} from "../../lib/crm";

type SeparacionForm = {
  clienteId: string;
  loteId: string;
  monto: string;
  fechaLimite: string;
  observaciones: string;
};

const formVacio: SeparacionForm = {
  clienteId: "",
  loteId: "",
  monto: "",
  fechaLimite: "",
  observaciones: "",
};

export default function SeparacionesTable() {
  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );
  const [lotes, setLotes] = useState<LoteCrm[]>([]);
  const [separaciones, setSeparaciones] = useState<
    Separacion[]
  >([]);
  const [form, setForm] =
    useState<SeparacionForm>(formVacio);
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState(false);

  const cargar = async () => {
    if (!supabase) return;

    const [
      clientesRes,
      lotesRes,
      separacionesRes,
    ] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,created_at,updated_at"
        )
        .order("created_at", {
          ascending: false,
        }),
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
        .from("separaciones")
        .select(
          "id,lote_id,cliente_id,asesor_id,monto_separacion,fecha_limite,estado,observaciones,created_at,updated_at"
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (
      clientesRes.error ||
      lotesRes.error ||
      separacionesRes.error
    ) {
      setError(
        clientesRes.error?.message ||
          lotesRes.error?.message ||
          separacionesRes.error?.message ||
          "No se pudo cargar la informacion."
      );
      return;
    }

    setError(null);
    setClientes((clientesRes.data || []) as Cliente[]);
    setLotes((lotesRes.data || []) as LoteCrm[]);
    setSeparaciones(
      (separacionesRes.data || []) as Separacion[]
    );
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const lotesDisponibles = useMemo(
    () =>
      lotes.filter((lote) =>
        ["DISPONIBLE", "EN_NEGOCIACION"].includes(
          lote.estado
        )
      ),
    [lotes]
  );

  const clientesMap = useMemo(() => {
    const map: Record<string, Cliente> = {};
    clientes.forEach((cliente) => {
      map[cliente.id] = cliente;
    });
    return map;
  }, [clientes]);

  const lotesMap = useMemo(() => {
    const map: Record<number, LoteCrm> = {};
    lotes.forEach((lote) => {
      map[lote.id] = lote;
    });
    return map;
  }, [lotes]);

  const actualizarForm = (
    campo: keyof SeparacionForm,
    valor: string
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const crearSeparacion = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    if (!supabase) return;

    setGuardando(true);
    setMensaje(null);
    setError(null);

    const { error: rpcError } =
      await supabase.rpc("crm_crear_separacion", {
        p_lote_id: Number(form.loteId),
        p_cliente_id: form.clienteId,
        p_monto:
          form.monto.trim() === ""
            ? null
            : Number(form.monto),
        p_fecha_limite:
          form.fechaLimite || null,
        p_observaciones:
          form.observaciones.trim() || null,
      });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        "Separacion creada y lote actualizado."
      );
      setForm(formVacio);
      await cargar();
    }

    setGuardando(false);
  };

  return (
    <section>
      <form onSubmit={crearSeparacion} style={formBox}>
        <div style={formGrid}>
          <select
            required
            value={form.clienteId}
            onChange={(event) =>
              actualizarForm(
                "clienteId",
                event.target.value
              )
            }
            style={input}
          >
            <option value="">Cliente</option>
            {clientes.map((cliente) => (
              <option
                key={cliente.id}
                value={cliente.id}
              >
                {nombreCliente(cliente)}
              </option>
            ))}
          </select>
          <select
            required
            value={form.loteId}
            onChange={(event) =>
              actualizarForm(
                "loteId",
                event.target.value
              )
            }
            style={input}
          >
            <option value="">Lote disponible</option>
            {lotesDisponibles.map((lote) => (
              <option
                key={lote.id}
                value={lote.id}
              >
                MZ {lote.mz} - Lote {lote.lote} -{" "}
                {formatearArea(lote.area)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monto}
            onChange={(event) =>
              actualizarForm("monto", event.target.value)
            }
            placeholder="Monto de separacion"
            style={input}
          />
          <input
            type="date"
            value={form.fechaLimite}
            onChange={(event) =>
              actualizarForm(
                "fechaLimite",
                event.target.value
              )
            }
            style={input}
          />
        </div>
        <textarea
          value={form.observaciones}
          onChange={(event) =>
            actualizarForm(
              "observaciones",
              event.target.value
            )
          }
          placeholder="Observaciones"
          style={textarea}
        />
        <button
          disabled={guardando}
          type="submit"
          style={primaryButton}
        >
          {guardando
            ? "Guardando..."
            : "Crear separacion"}
        </button>
      </form>

      {mensaje && (
        <div style={success}>{mensaje}</div>
      )}
      {error && <div style={alert}>{error}</div>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {[
                "Lote",
                "Cliente",
                "Monto",
                "Vence",
                "Estado",
                "Registro",
              ].map((head) => (
                <th key={head} style={th}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {separaciones.map((separacion) => {
              const lote = separacion.lote_id
                ? lotesMap[separacion.lote_id]
                : null;
              const cliente =
                separacion.cliente_id
                  ? clientesMap[separacion.cliente_id]
                  : null;
              const estadoColor = colorEstado(
                lote?.estado || "SEPARADO"
              );

              return (
                <tr key={separacion.id}>
                  <td style={td}>
                    {lote
                      ? `MZ ${lote.mz} - Lote ${lote.lote}`
                      : "-"}
                  </td>
                  <td style={td}>
                    {nombreCliente(cliente) || "-"}
                  </td>
                  <td style={td}>
                    {separacion.monto_separacion
                      ? formatearMoneda(
                          separacion.monto_separacion
                        )
                      : "-"}
                  </td>
                  <td style={td}>
                    {separacion.fecha_limite
                      ? new Date(
                          `${separacion.fecha_limite}T00:00:00`
                        ).toLocaleDateString("es-PE")
                      : "-"}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        ...badge,
                        background: estadoColor.bg,
                        color: estadoColor.fg,
                      }}
                    >
                      {separacion.estado}
                    </span>
                  </td>
                  <td style={td}>
                    {separacion.created_at
                      ? new Date(
                          separacion.created_at
                        ).toLocaleDateString("es-PE")
                      : "-"}
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

const formBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 14px 36px rgba(15,23,42,.06)",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const input: React.CSSProperties = {
  height: 42,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
};

const textarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: 82,
  marginTop: 12,
  padding: 12,
  resize: "vertical",
};

const primaryButton: React.CSSProperties = {
  marginTop: 12,
  height: 42,
  border: 0,
  borderRadius: 12,
  padding: "0 18px",
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
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
