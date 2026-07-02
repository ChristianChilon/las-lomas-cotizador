"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  esGerencia,
  nombreCliente,
  type Cliente,
  type Profile,
} from "../../lib/crm";

type ClienteForm = {
  nombres: string;
  apellidos: string;
  dni: string;
  celular: string;
  correo: string;
  fuente: string;
  observaciones: string;
  asesorId: string;
};

const clienteVacio: ClienteForm = {
  nombres: "",
  apellidos: "",
  dni: "",
  celular: "",
  correo: "",
  fuente: "",
  observaciones: "",
  asesorId: "",
};

export default function ClientesTable() {
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );
  const [asesores, setAsesores] = useState<Profile[]>(
    []
  );
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] =
    useState<ClienteForm>(clienteVacio);
  const [mensaje, setMensaje] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [guardando, setGuardando] =
    useState(false);
  const [asignando, setAsignando] =
    useState<string | null>(null);

  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    const clientesQuery = supabase
      .from("clientes")
      .select(
        "id,nombres,apellidos,dni,celular,correo,direccion,fuente,observaciones,asesor_id,created_at,updated_at"
      )
      .order("created_at", {
        ascending: false,
      });

    const perfilesQuery = supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,phone,active"
      )
      .order("full_name", {
        ascending: true,
      });

    const [clientesRes, perfilesRes] =
      await Promise.all([
        clientesQuery,
        perfilesQuery,
      ]);

    if (clientesRes.error) {
      setError(clientesRes.error.message);
      return;
    }

    setError(null);
    setClientes((clientesRes.data || []) as Cliente[]);
    setAsesores(
      ((perfilesRes.data || []) as Profile[]).filter(
        (asesor) =>
          asesor.active !== false &&
          asesor.role === "asesor"
      )
    );
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const modoGerencia = esGerencia(profile);

  const asesoresMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    asesores.forEach((asesor) => {
      map[asesor.id] = asesor;
    });
    if (profile) {
      map[profile.id] = profile;
    }
    return map;
  }, [asesores, profile]);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return clientes.filter((cliente) => {
      if (!texto) return true;

      return [
        nombreCliente(cliente),
        cliente.dni,
        cliente.celular,
        cliente.correo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [busqueda, clientes]);

  const actualizarForm = (
    campo: keyof ClienteForm,
    valor: string
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const crearCliente = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    if (!supabase || !profile) return;

    setGuardando(true);
    setMensaje(null);
    setError(null);

    const asesorAsignado = modoGerencia
      ? form.asesorId || null
      : profile.id;

    const payload = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim() || null,
      dni: form.dni.trim() || null,
      celular: form.celular.trim(),
      correo: form.correo.trim() || null,
      fuente: form.fuente.trim() || null,
      observaciones:
        form.observaciones.trim() || null,
      asesor_id: asesorAsignado,
      created_by: profile.id,
    };

    const { error: insertError } =
      await supabase.from("clientes").insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setMensaje("Cliente registrado.");
      setForm(clienteVacio);
      await cargar();
    }

    setGuardando(false);
  };

  const reasignarCliente = async (
    cliente: Cliente,
    asesorId: string
  ) => {
    if (!supabase || !modoGerencia) return;

    setAsignando(cliente.id);
    setMensaje(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        asesor_id: asesorId || null,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMensaje("Cliente reasignado.");
      await cargar();
    }

    setAsignando(null);
  };

  return (
    <section>
      <form onSubmit={crearCliente} style={formBox}>
        <div style={formGrid}>
          <input
            required
            value={form.nombres}
            onChange={(event) =>
              actualizarForm("nombres", event.target.value)
            }
            placeholder="Nombres"
            style={input}
          />
          <input
            value={form.apellidos}
            onChange={(event) =>
              actualizarForm(
                "apellidos",
                event.target.value
              )
            }
            placeholder="Apellidos"
            style={input}
          />
          <input
            value={form.dni}
            onChange={(event) =>
              actualizarForm("dni", event.target.value)
            }
            placeholder="DNI"
            style={input}
          />
          <input
            required
            value={form.celular}
            onChange={(event) =>
              actualizarForm(
                "celular",
                event.target.value
              )
            }
            placeholder="Celular"
            style={input}
          />
          <input
            type="email"
            value={form.correo}
            onChange={(event) =>
              actualizarForm(
                "correo",
                event.target.value
              )
            }
            placeholder="Correo"
            style={input}
          />
          <input
            value={form.fuente}
            onChange={(event) =>
              actualizarForm(
                "fuente",
                event.target.value
              )
            }
            placeholder="Fuente"
            style={input}
          />
          {modoGerencia && (
            <select
              value={form.asesorId}
              onChange={(event) =>
                actualizarForm(
                  "asesorId",
                  event.target.value
                )
              }
              style={input}
            >
              <option value="">
                Sin asesor asignado
              </option>
              {asesores.map((asesor) => (
                <option
                  key={asesor.id}
                  value={asesor.id}
                >
                  {asesor.full_name ||
                    asesor.email}
                </option>
              ))}
            </select>
          )}
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
          {guardando ? "Guardando..." : "Crear cliente"}
        </button>
      </form>

      <div style={toolbar}>
        <input
          value={busqueda}
          onChange={(event) =>
            setBusqueda(event.target.value)
          }
          placeholder="Buscar cliente, DNI, celular o correo"
          style={search}
        />
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
                "Cliente",
                "DNI",
                "Celular",
                "Correo",
                "Fuente",
                "Asesor",
                "Registro",
              ].map((head) => (
                <th key={head} style={th}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((cliente) => {
              const asesor = cliente.asesor_id
                ? asesoresMap[cliente.asesor_id]
                : null;

              return (
                <tr key={cliente.id}>
                  <td style={td}>
                    {nombreCliente(cliente)}
                  </td>
                  <td style={td}>
                    {cliente.dni || "-"}
                  </td>
                  <td style={td}>
                    {cliente.celular || "-"}
                  </td>
                  <td style={td}>
                    {cliente.correo || "-"}
                  </td>
                  <td style={td}>
                    {cliente.fuente || "-"}
                  </td>
                  <td style={td}>
                    {modoGerencia ? (
                      <select
                        value={cliente.asesor_id || ""}
                        disabled={
                          asignando === cliente.id
                        }
                        onChange={(event) =>
                          reasignarCliente(
                            cliente,
                            event.target.value
                          )
                        }
                        style={selectSmall}
                      >
                        <option value="">
                          Sin asesor
                        </option>
                        {asesores.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.full_name ||
                              item.email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      asesor?.full_name ||
                      asesor?.email ||
                      "Asignado a ti"
                    )}
                  </td>
                  <td style={td}>
                    {cliente.created_at
                      ? new Date(
                          cliente.created_at
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
    "repeat(auto-fit, minmax(180px, 1fr))",
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

const toolbar: React.CSSProperties = {
  marginBottom: 14,
};

const search: React.CSSProperties = {
  ...input,
  width: "min(100%, 420px)",
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
