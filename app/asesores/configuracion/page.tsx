"use client";

import { useCallback, useEffect, useState } from "react";
import AsesorLayout from "../../../components/layout/AsesorLayout";
import { obtenerPerfilActual } from "../../../lib/auth/clientAuth";
import { esGerencia, type Profile } from "../../../lib/crm";
import { supabase } from "../../../lib/supabase";
import {
  CONFIGURACION_COMERCIAL_BASE,
  type ConfiguracionComercial,
} from "../../../lib/comercial";

type ConfiguracionGuardada = ConfiguracionComercial & {
  updated_by?: string | null;
  updated_at?: string | null;
};

type ConfigDraft = {
  sla_primer_contacto_minutos: string;
  cadencia_caliente_dias: string;
  cadencia_tibio_dias: string;
  cadencia_frio_dias: string;
  alerta_separacion_dias: string;
  hora_inicio: string;
  hora_fin: string;
  atender_sabado: boolean;
  atender_domingo: boolean;
  descuento_asesor_max_porcentaje: string;
  vigencia_cotizacion_dias: string;
  monto_separacion_referencial: string;
  inicial_minima: string;
};

const valoresIniciales: ConfigDraft = {
  sla_primer_contacto_minutos: String(
    CONFIGURACION_COMERCIAL_BASE.sla_primer_contacto_minutos
  ),
  cadencia_caliente_dias: String(
    CONFIGURACION_COMERCIAL_BASE.cadencia_caliente_dias
  ),
  cadencia_tibio_dias: String(
    CONFIGURACION_COMERCIAL_BASE.cadencia_tibio_dias
  ),
  cadencia_frio_dias: String(
    CONFIGURACION_COMERCIAL_BASE.cadencia_frio_dias
  ),
  alerta_separacion_dias: String(
    CONFIGURACION_COMERCIAL_BASE.alerta_separacion_dias
  ),
  hora_inicio: CONFIGURACION_COMERCIAL_BASE.hora_inicio.slice(0, 5),
  hora_fin: CONFIGURACION_COMERCIAL_BASE.hora_fin.slice(0, 5),
  atender_sabado: CONFIGURACION_COMERCIAL_BASE.atender_sabado,
  atender_domingo: CONFIGURACION_COMERCIAL_BASE.atender_domingo,
  descuento_asesor_max_porcentaje: String(
    CONFIGURACION_COMERCIAL_BASE.descuento_asesor_max_porcentaje
  ),
  vigencia_cotizacion_dias: String(
    CONFIGURACION_COMERCIAL_BASE.vigencia_cotizacion_dias
  ),
  monto_separacion_referencial: String(
    CONFIGURACION_COMERCIAL_BASE.monto_separacion_referencial
  ),
  inicial_minima: String(CONFIGURACION_COMERCIAL_BASE.inicial_minima),
};

const horaCorta = (hora: string | null | undefined) =>
  (hora || "").slice(0, 5);

const enteroPositivo = (valor: string) => {
  const numero = Number(valor);

  return Number.isFinite(numero) ? Math.max(1, Math.trunc(numero)) : 1;
};

export default function ConfiguracionPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionGuardada | null>(null);
  const [draft, setDraft] = useState<ConfigDraft>(valoresIniciales);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [setupPendiente, setSetupPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

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

    const { data, error: configError } = await supabase
      .from("configuracion_comercial")
      .select("*")
      .eq("project_key", "las_lomas")
      .maybeSingle();

    const faltaTabla = Boolean(
      configError &&
        (configError.code === "42P01" ||
          configError.code === "PGRST205" ||
          configError.message.includes("configuracion_comercial"))
    );

    setSetupPendiente(faltaTabla);

    if (configError && !faltaTabla) {
      setError(configError.message);
      setCargando(false);
      return;
    }

    const actual = data
      ? ({
          ...CONFIGURACION_COMERCIAL_BASE,
          ...data,
        } as unknown as ConfiguracionGuardada)
      : null;
    setConfiguracion(actual);

    if (actual) {
      setDraft({
        sla_primer_contacto_minutos: String(
          actual.sla_primer_contacto_minutos
        ),
        cadencia_caliente_dias: String(actual.cadencia_caliente_dias),
        cadencia_tibio_dias: String(actual.cadencia_tibio_dias),
        cadencia_frio_dias: String(actual.cadencia_frio_dias),
        alerta_separacion_dias: String(actual.alerta_separacion_dias),
        hora_inicio: horaCorta(actual.hora_inicio),
        hora_fin: horaCorta(actual.hora_fin),
        atender_sabado: actual.atender_sabado,
        atender_domingo: actual.atender_domingo,
        descuento_asesor_max_porcentaje: String(
          actual.descuento_asesor_max_porcentaje
        ),
        vigencia_cotizacion_dias: String(actual.vigencia_cotizacion_dias),
        monto_separacion_referencial: String(
          actual.monto_separacion_referencial
        ),
        inicial_minima: String(actual.inicial_minima),
      });
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  const modoGerencia = esGerencia(profile);

  const guardar = async () => {
    if (!supabase || !profile || !modoGerencia || setupPendiente) return;

    if (!draft.hora_inicio || !draft.hora_fin) {
      setError("Define el inicio y fin del horario de atencion.");
      return;
    }

    if (draft.hora_inicio >= draft.hora_fin) {
      setError("La hora de cierre debe ser posterior a la hora de inicio.");
      return;
    }

    setGuardando(true);
    setError(null);
    setMensaje(null);

    const payload = {
      project_key: "las_lomas",
      sla_primer_contacto_minutos: Math.min(
        10080,
        enteroPositivo(draft.sla_primer_contacto_minutos)
      ),
      cadencia_caliente_dias: Math.min(
        365,
        enteroPositivo(draft.cadencia_caliente_dias)
      ),
      cadencia_tibio_dias: Math.min(
        365,
        enteroPositivo(draft.cadencia_tibio_dias)
      ),
      cadencia_frio_dias: Math.min(
        365,
        enteroPositivo(draft.cadencia_frio_dias)
      ),
      alerta_separacion_dias: Math.min(
        30,
        enteroPositivo(draft.alerta_separacion_dias)
      ),
      hora_inicio: draft.hora_inicio,
      hora_fin: draft.hora_fin,
      atender_sabado: draft.atender_sabado,
      atender_domingo: draft.atender_domingo,
      descuento_asesor_max_porcentaje: Math.min(
        30,
        Math.max(0, Number(draft.descuento_asesor_max_porcentaje) || 0)
      ),
      vigencia_cotizacion_dias: Math.min(
        30,
        enteroPositivo(draft.vigencia_cotizacion_dias)
      ),
      monto_separacion_referencial: Math.max(
        0,
        Number(draft.monto_separacion_referencial) || 0
      ),
      inicial_minima: Math.max(0, Number(draft.inicial_minima) || 0),
      updated_by: profile.id,
    };

    const { data, error: saveError } = await supabase
      .from("configuracion_comercial")
      .upsert(payload, { onConflict: "project_key" })
      .select("*")
      .single();

    if (saveError) {
      setError(saveError.message);
      setGuardando(false);
      return;
    }

    setConfiguracion(data as unknown as ConfiguracionGuardada);
    setMensaje("Reglas comerciales actualizadas correctamente.");
    setGuardando(false);
  };

  if (!cargando && !modoGerencia) {
    return (
      <AsesorLayout
        title="Reglas comerciales"
        subtitle="Modulo reservado para admin y jefe de ventas."
      >
        <div style={emptyBox}>
          Tu usuario no tiene permisos para modificar las reglas del equipo.
        </div>
      </AsesorLayout>
    );
  }

  return (
    <AsesorLayout
      title="Reglas comerciales"
      subtitle="SLA de primer contacto, cadencias por prioridad y anticipacion de separaciones."
    >
      <section>
        {setupPendiente && (
          <div style={setupAlert}>
            <strong>Configuracion pendiente en Supabase</strong>
            <span>
              Ejecuta 008_crm_reglas_comerciales.sql para activar estas
              reglas y sus politicas RLS. El Centro de tareas conserva
              valores seguros mientras tanto.
            </span>
          </div>
        )}

        {error && <div style={alert}>{error}</div>}
        {mensaje && <div style={successAlert}>{mensaje}</div>}

        {cargando ? (
          <div style={emptyBox}>Cargando reglas comerciales...</div>
        ) : (
          <>
            <div style={summaryGrid}>
              <Summary
                label="Primer contacto"
                value={`${draft.sla_primer_contacto_minutos} min`}
                detail="Tiempo objetivo dentro del horario comercial"
                tone="blue"
              />
              <Summary
                label="Lead caliente"
                value={`${draft.cadencia_caliente_dias} dias`}
                detail="Maximo sin actividad registrada"
                tone="red"
              />
              <Summary
                label="Lead tibio"
                value={`${draft.cadencia_tibio_dias} dias`}
                detail="Maximo sin actividad registrada"
                tone="gold"
              />
              <Summary
                label="Lead frio"
                value={`${draft.cadencia_frio_dias} dias`}
                detail="Maximo sin actividad registrada"
                tone="gray"
              />
              <Summary
                label="Separaciones"
                value={`${draft.alerta_separacion_dias} dias`}
                detail="Anticipacion para la alerta de vencimiento"
                tone="green"
              />
            </div>

            <div style={contentGrid}>
              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Velocidad de atencion</h2>
                    <p style={panelText}>
                      Define cuando un lead nuevo debe escalar como contacto
                      atrasado y el horario en que corre el SLA.
                    </p>
                  </div>
                </div>

                <div style={formGrid}>
                  <NumberField
                    label="SLA de primer contacto (minutos)"
                    value={draft.sla_primer_contacto_minutos}
                    min={1}
                    max={10080}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        sla_primer_contacto_minutos: value,
                      }))
                    }
                    full
                  />

                  <label style={field}>
                    <span>Inicio de atencion</span>
                    <input
                      type="time"
                      value={draft.hora_inicio}
                      onChange={(event) =>
                        setDraft((actual) => ({
                          ...actual,
                          hora_inicio: event.target.value,
                        }))
                      }
                      style={input}
                    />
                  </label>

                  <label style={field}>
                    <span>Fin de atencion</span>
                    <input
                      type="time"
                      value={draft.hora_fin}
                      onChange={(event) =>
                        setDraft((actual) => ({
                          ...actual,
                          hora_fin: event.target.value,
                        }))
                      }
                      style={input}
                    />
                  </label>

                  <label style={toggleRow}>
                    <input
                      type="checkbox"
                      checked={draft.atender_sabado}
                      onChange={(event) =>
                        setDraft((actual) => ({
                          ...actual,
                          atender_sabado: event.target.checked,
                        }))
                      }
                    />
                    <span>Contar sabados como dia de atencion</span>
                  </label>

                  <label style={toggleRow}>
                    <input
                      type="checkbox"
                      checked={draft.atender_domingo}
                      onChange={(event) =>
                        setDraft((actual) => ({
                          ...actual,
                          atender_domingo: event.target.checked,
                        }))
                      }
                    />
                    <span>Contar domingos como dia de atencion</span>
                  </label>
                </div>
              </article>

              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Cadencias y vencimientos</h2>
                    <p style={panelText}>
                      Controla cuantos dias puede pasar cada prioridad sin
                      una nueva actividad comercial registrada.
                    </p>
                  </div>
                </div>

                <div style={formGrid}>
                  <NumberField
                    label="Caliente: dias sin actividad"
                    value={draft.cadencia_caliente_dias}
                    min={1}
                    max={365}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        cadencia_caliente_dias: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Tibio: dias sin actividad"
                    value={draft.cadencia_tibio_dias}
                    min={1}
                    max={365}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        cadencia_tibio_dias: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Frio: dias sin actividad"
                    value={draft.cadencia_frio_dias}
                    min={1}
                    max={365}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        cadencia_frio_dias: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Avisar separacion antes de (dias)"
                    value={draft.alerta_separacion_dias}
                    min={1}
                    max={30}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        alerta_separacion_dias: value,
                      }))
                    }
                  />
                </div>
              </article>

              <article style={panel}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Cotizaciones</h2>
                    <p style={panelText}>
                      Define los limites que Supabase aplicara a las propuestas de los asesores.
                    </p>
                  </div>
                </div>

                <div style={formGrid}>
                  <NumberField
                    label="Descuento maximo del asesor (%)"
                    value={draft.descuento_asesor_max_porcentaje}
                    min={0}
                    max={30}
                    step="0.01"
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        descuento_asesor_max_porcentaje: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Vigencia de la cotizacion (dias)"
                    value={draft.vigencia_cotizacion_dias}
                    min={1}
                    max={30}
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        vigencia_cotizacion_dias: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Monto referencial de separacion"
                    value={draft.monto_separacion_referencial}
                    min={0}
                    max={100000}
                    step="0.01"
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        monto_separacion_referencial: value,
                      }))
                    }
                  />
                  <NumberField
                    label="Inicial minima"
                    value={draft.inicial_minima}
                    min={0}
                    max={1000000}
                    step="0.01"
                    onChange={(value) =>
                      setDraft((actual) => ({
                        ...actual,
                        inicial_minima: value,
                      }))
                    }
                  />
                </div>
              </article>
            </div>

            <div style={footerBar}>
              <div>
                <strong>Aplicacion inmediata</strong>
                <span>
                  Al guardar, el Centro de tareas recalcula las prioridades
                  con estas reglas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando || setupPendiente}
                style={saveButton}
              >
                {guardando ? "Guardando..." : "Guardar reglas"}
              </button>
            </div>

            {configuracion?.updated_at && (
              <p style={updatedText}>
                Ultima actualizacion: {new Date(
                  configuracion.updated_at
                ).toLocaleString("es-PE")}
              </p>
            )}
          </>
        )}
      </section>
    </AsesorLayout>
  );
}

function Summary({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "red" | "gold" | "green" | "gray";
}) {
  const colors = {
    blue: { bg: "#eef6ff", fg: "#244d77", border: "#c7ddf4" },
    red: { bg: "#fff1ef", fg: "#8b2f25", border: "#f3c7c0" },
    gold: { bg: "#fff8e1", fg: "#8a5a00", border: "#eed28a" },
    green: { bg: "#eef8f1", fg: "#17633a", border: "#c9e7d2" },
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

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  full = false,
  step = "1",
}: {
  label: string;
  value: string;
  min: number;
  max?: number;
  onChange: (value: string) => void;
  full?: boolean;
  step?: string;
}) {
  return (
    <label style={{ ...field, ...(full ? fieldFull : {}) }}>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={input}
      />
    </label>
  );
}

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
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

const contentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
  gap: 16,
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const panelHeader: React.CSSProperties = {
  marginBottom: 16,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 21,
  fontWeight: 950,
};

const panelText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 14,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const fieldFull: React.CSSProperties = {
  gridColumn: "1 / -1",
};

const input: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 44,
  borderRadius: 11,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  padding: "0 12px",
  fontSize: 15,
  fontWeight: 850,
  boxSizing: "border-box",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 44,
  borderRadius: 11,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  padding: "0 12px",
  color: "#334155",
  fontSize: 13,
  fontWeight: 850,
};

const footerBar: React.CSSProperties = {
  marginTop: 16,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

const saveButton: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #2f7d46",
  background: "#2f7d46",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 950,
  cursor: "pointer",
};

const setupAlert: React.CSSProperties = {
  background: "#eef6ff",
  color: "#244d77",
  border: "1px solid #c7ddf4",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  display: "grid",
  gap: 5,
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

const successAlert: React.CSSProperties = {
  background: "#eef8f1",
  color: "#17633a",
  border: "1px solid #c9e7d2",
  borderRadius: 14,
  padding: 14,
  marginBottom: 18,
  fontWeight: 800,
};

const emptyBox: React.CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  padding: 18,
  borderRadius: 14,
  fontWeight: 800,
};

const updatedText: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#64748b",
  fontSize: 12,
  textAlign: "right",
};
