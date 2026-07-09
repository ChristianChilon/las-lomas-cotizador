"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import {
  calcularCalificacionLead,
  colorNivelInteres,
  esGerencia,
  etiquetaCanalPreferido,
  etiquetaCapacidadCuota,
  etiquetaEstadoCita,
  etiquetaEstadoLead,
  etiquetaIntencionCompra,
  etiquetaNivelInteres,
  etiquetaProximaAccion,
  etiquetaResultadoSeguimiento,
  etiquetaSituacionInicial,
  etiquetaTiempoDecision,
  etiquetaTipoContacto,
  nombreCliente,
  type Cliente,
  type Profile,
  type SeguimientoCliente,
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

  situacionInicial: string;
  capacidadCuota: string;
  tiempoDecision: string;
  intencionCompra: string;
  canalPreferido: string;
  fechaProximoSeguimiento: string;
  objecionPrincipal: string;
  fechaCita: string;
  horaCita: string;
};

type SeguimientoForm = {
  clienteId: string;
  tipoContacto: string;
  resultado: string;
  comentario: string;
  fechaProximoSeguimiento: string;
};

const clienteVacio: ClienteForm = {
  nombres: "",
  apellidos: "",
  dni: "",
  celular: "",
  correo: "",
  fuente: "Meta Ads",
  observaciones: "",
  asesorId: "",

  situacionInicial: "SIN_DEFINIR",
  capacidadCuota: "SIN_DEFINIR",
  tiempoDecision: "SIN_DEFINIR",
  intencionCompra: "SIN_DEFINIR",
  canalPreferido: "SIN_DEFINIR",
  fechaProximoSeguimiento: "",
  objecionPrincipal: "",
  fechaCita: "",
  horaCita: "",
};

const seguimientoVacio: SeguimientoForm = {
  clienteId: "",
  tipoContacto: "WHATSAPP",
  resultado: "CONTACTADO",
  comentario: "",
  fechaProximoSeguimiento: "",
};

const situacionesInicial = [
  {
    value: "SIN_DEFINIR",
    label: "Sin definir",
  },
  {
    value: "INICIAL_LISTA",
    label:
      "Tengo la inicial lista y quiero evaluar lote hoy.",
  },
  {
    value: "INICIAL_PARCIAL",
    label:
      "Tengo parte de la inicial y puedo completarla pronto.",
  },
  {
    value: "SIN_INICIAL",
    label:
      "Aún no tengo inicial, pero quiero información.",
  },
  {
    value: "SOLO_COTIZANDO",
    label: "Solo estoy cotizando por ahora.",
  },
];

const capacidadesCuota = [
  {
    value: "SIN_DEFINIR",
    label: "Sin definir",
  },
  {
    value: "PUEDE_CUOTA",
    label:
      "Sí puedo asumir cuotas en ese rango.",
  },
  {
    value: "EVALUAR_CUOTA",
    label:
      "Puedo pagar cuotas, pero necesito evaluar el monto exacto.",
  },
  {
    value: "BUSCA_CUOTA_BAJA",
    label: "Busco cuotas más bajas.",
  },
  {
    value: "PAGO_CONTADO",
    label: "Prefiero pagar al contado.",
  },
];

const tiemposDecision = [
  {
    value: "SIN_DEFINIR",
    label: "Sin definir",
  },
  {
    value: "HOY",
    label: "Hoy.",
  },
  {
    value: "ESTA_SEMANA",
    label: "Esta semana.",
  },
  {
    value: "UNO_TRES_MESES",
    label: "En 1 a 3 meses.",
  },
  {
    value: "SOLO_MIRANDO",
    label: "Solo estoy mirando opciones.",
  },
];

const intencionesCompra = [
  {
    value: "SIN_DEFINIR",
    label: "Sin definir",
  },
  {
    value: "VER_LOTES_SEPARAR",
    label:
      "Sí, quiero ver lotes disponibles para separar.",
  },
  {
    value: "RESOLVER_DUDAS",
    label:
      "Sí, pero primero quiero resolver algunas dudas.",
  },
  {
    value: "INFO_GENERAL",
    label: "Solo quiero recibir información general.",
  },
];

const canalesPreferidos = [
  {
    value: "SIN_DEFINIR",
    label: "Sin definir",
  },
  {
    value: "WHATSAPP_RAPIDO",
    label:
      "WhatsApp rápido: quiero ver disponibilidad y condiciones para separar.",
  },
  {
    value: "CITA_OFICINA",
    label:
      "Cita en oficina de ventas: quiero evaluar el proyecto con un asesor y dejaré mi WhatsApp y Nro. DNI.",
  },
  {
    value: "LLAMADA",
    label:
      "Llamada telefónica: quiero resolver dudas antes de decidir.",
  },
  {
    value: "SOLO_INFO",
    label:
      "Solo deseo información general por ahora.",
  },
];

const tiposContacto = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "LLAMADA", label: "Llamada" },
  { value: "CITA", label: "Cita" },
  { value: "VISITA_OFICINA", label: "Visita en oficina" },
  { value: "ENVIO_INFO", label: "Envío de información" },
  { value: "RECORDATORIO", label: "Recordatorio" },
  { value: "OTRO", label: "Otro" },
];

const resultadosSeguimiento = [
  { value: "CONTACTADO", label: "Contactado" },
  { value: "NO_RESPONDE", label: "No responde" },
  { value: "INTERESADO", label: "Interesado" },
  { value: "DUDAS", label: "Tiene dudas" },
  { value: "AGENDO_CITA", label: "Agendó cita" },
  { value: "SEPARARA_PRONTO", label: "Separará pronto" },
  { value: "DESCARTADO", label: "Descartado" },
];

const formatearFechaLocal = (
  fecha: string | null | undefined
) => {
  if (!fecha) return "-";

  const fechaLimpia = fecha.split("T")[0];

  const [year, month, day] = fechaLimpia
    .split("-")
    .map(Number);

  if (!year || !month || !day) return "-";

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString("es-PE");
};

const obtenerFechaHoyISO = () => {
  const hoy = new Date();

  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const PICKER_ITEM_HEIGHT = 28;
const PICKER_VISIBLE_ROWS = 5;
const PICKER_HEIGHT =
  PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ROWS;
const PICKER_VERTICAL_PADDING =
  PICKER_ITEM_HEIGHT * 2;

const HORAS_PICKER = Array.from(
  { length: 12 },
  (_, index) =>
    String(index + 1).padStart(2, "0")
);

const MINUTOS_PICKER = Array.from(
  { length: 60 },
  (_, index) =>
    String(index).padStart(2, "0")
);

const PERIODOS_PICKER = [
  "a. m.",
  "p. m.",
] as const;

type PeriodoPicker =
  (typeof PERIODOS_PICKER)[number];

const leerHoraCRM = (
  valor: string | null | undefined
) => {
  const texto = (valor || "")
    .toLowerCase()
    .trim();

  const numeros = texto.match(/\d+/g) || [];

  let hora = Number(numeros[0] || 9);
  let minuto = Number(numeros[1] || 0);

  if (!Number.isFinite(hora) || hora < 1) hora = 9;
  if (hora > 12) hora = ((hora - 1) % 12) + 1;

  if (
    !Number.isFinite(minuto) ||
    minuto < 0
  )
    minuto = 0;
  if (minuto > 59) minuto = 59;

  const periodo: PeriodoPicker =
    texto.includes("p")
      ? "p. m."
      : "a. m.";

  return {
    hora: String(hora).padStart(2, "0"),
    minuto: String(minuto).padStart(2, "0"),
    periodo,
  };
};

const escribirHoraCRM = (
  hora: string,
  minuto: string,
  periodo: PeriodoPicker
) => `${Number(hora)}:${minuto} ${periodo}`;

function WheelPickerColumn({
  items,
  selected,
  onChange,
  width = 64,
}: {
  items: string[];
  selected: string;
  onChange: (value: string) => void;
  width?: number;
}) {
  const ref =
    useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  useEffect(() => {
    const index = items.findIndex(
      (item) => item === selected
    );

    if (ref.current && index >= 0) {
      ref.current.scrollTo({
        top: index * PICKER_ITEM_HEIGHT,
        behavior: "smooth",
      });
    }
  }, [items, selected]);

  const cerrarScroll = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (!ref.current) return;

      const index = Math.round(
        ref.current.scrollTop /
          PICKER_ITEM_HEIGHT
      );

      const seguro = Math.max(
        0,
        Math.min(index, items.length - 1)
      );

      onChange(items[seguro]);
    }, 80);
  };

  return (
    <div
      style={{
        ...wheelOuter,
        width,
      }}
    >
      <div
        ref={ref}
        onScroll={cerrarScroll}
        style={wheelScroll}
      >
        <div
          style={{
            height:
              PICKER_VERTICAL_PADDING,
          }}
        />

        {items.map((item) => (
          <div
            key={item}
            onClick={() => onChange(item)}
            style={{
              ...wheelItem,
              color:
                item === selected
                  ? "#f8fafc"
                  : "#707784",
              fontWeight:
                item === selected
                  ? 900
                  : 500,
              transform:
                item === selected
                  ? "scale(1.05)"
                  : "scale(1)",
              opacity:
                item === selected
                  ? 1
                  : 0.75,
            }}
          >
            {item}
          </div>
        ))}

        <div
          style={{
            height:
              PICKER_VERTICAL_PADDING,
          }}
        />
      </div>

      <div style={wheelHighlight} />
    </div>
  );
}

function HoraPickerIOS({
  value,
  onChange,
}: {
  value: string;
  onChange: (valor: string) => void;
}) {
  const [abierto, setAbierto] =
    useState(false);

  const actual = useMemo(
    () => leerHoraCRM(value),
    [value]
  );

  const [hora, setHora] = useState(
    actual.hora
  );
  const [minuto, setMinuto] = useState(
    actual.minuto
  );
  const [periodo, setPeriodo] =
    useState<PeriodoPicker>(
      actual.periodo
    );

  useEffect(() => {
    if (!abierto) {
      const timer = window.setTimeout(() => {
        const horaActual =
          leerHoraCRM(value);
        setHora(horaActual.hora);
        setMinuto(horaActual.minuto);
        setPeriodo(horaActual.periodo);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [value, abierto]);

  const confirmar = () => {
    onChange(
      escribirHoraCRM(
        hora,
        minuto,
        periodo
      )
    );
    setAbierto(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={botonHoraIOS}
      >
        {value || "Seleccionar hora"}
      </button>

      {abierto && (
        <div style={pickerOverlay}>
          <div style={pickerModal}>
            <div style={pickerHeader}>
              <button
                type="button"
                onClick={() =>
                  setAbierto(false)
                }
                style={pickerGhostButton}
              >
                Cancelar
              </button>

              <strong
                style={{
                  color: "#111827",
                }}
              >
                Seleccionar hora
              </strong>

              <button
                type="button"
                onClick={confirmar}
                style={pickerPrimaryButton}
              >
                Listo
              </button>
            </div>

            <div style={pickerBody}>
              <WheelPickerColumn
                items={HORAS_PICKER}
                selected={hora}
                onChange={setHora}
                width={54}
              />

              <div style={pickerColon}>
                :
              </div>

              <WheelPickerColumn
                items={MINUTOS_PICKER}
                selected={minuto}
                onChange={setMinuto}
                width={54}
              />

              <WheelPickerColumn
                items={[
                  ...PERIODOS_PICKER,
                ]}
                selected={periodo}
                onChange={(value) =>
                  setPeriodo(
                    value as PeriodoPicker
                  )
                }
                width={68}
              />
            </div>

            <div style={pickerPreview}>
              Hora elegida:{" "}
              <strong style={pickerPreviewHora}>
                {escribirHoraCRM(
                  hora,
                  minuto,
                  periodo
                )}
              </strong>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ClientesTable() {
  const searchParams = useSearchParams();

  const seguimientoDesdeUrl =
    searchParams.get("seguimiento");

  const clienteDesdeUrl =
    searchParams.get("cliente");

  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>(
    []
  );
  const [asesores, setAsesores] = useState<Profile[]>(
    []
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtroNivel, setFiltroNivel] =
    useState("TODOS");
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

  const [parametroProcesado, setParametroProcesado] =
   useState<string | null>(null);
  
  const [programandoCita, setProgramandoCita] =
    useState<string | null>(null);

  const [citaEditando, setCitaEditando] =
    useState<{
      clienteId: string;
      fechaCita: string;
      horaCita: string;
    } | null>(null);
  
  const [seguimientos, setSeguimientos] = useState<
    SeguimientoCliente[]
  >([]);

  const [seguimientoEditando, setSeguimientoEditando] =
    useState<SeguimientoForm | null>(null);

  const [guardandoSeguimiento, setGuardandoSeguimiento] =
    useState<string | null>(null);

  const [historialAbierto, setHistorialAbierto] =
    useState<string | null>(null);
    
  const cargar = async () => {
    if (!supabase) return;

    const perfil = await obtenerPerfilActual();
    setProfile(perfil.profile);

    const clientesQuery = supabase
      .from("clientes")
      .select(
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
          "created_at",
          "updated_at",
          "situacion_inicial",
          "capacidad_cuota",
          "tiempo_decision",
          "intencion_compra",
          "canal_preferido",
          "puntaje_lead",
          "nivel_interes",
          "estado_lead",
          "proxima_accion",
          "fecha_proximo_seguimiento",
          "objecion_principal",
          "estado_cita",
          "fecha_cita",
          "hora_cita",
        ].join(",")
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

    const seguimientosQuery = supabase
      .from("seguimientos_clientes")
      .select(
        "id,cliente_id,asesor_id,tipo_contacto,resultado,comentario,fecha_proximo_seguimiento,created_by,created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    const [clientesRes, perfilesRes, seguimientosRes] =
      await Promise.all([
        clientesQuery,
        perfilesQuery,
        seguimientosQuery,
      ]);

    if (clientesRes.error) {
      setError(clientesRes.error.message);
      return;
    }

    setError(null);
    setClientes(
      (clientesRes.data || []) as unknown as Cliente[]
    );
    setSeguimientos(
      (seguimientosRes.data || []) as unknown as SeguimientoCliente[]
    );
    setAsesores(
      (
        (perfilesRes.data || []) as unknown as Profile[]
      ).filter(
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

  const asesoresPorId = useMemo(() => {
    const mapa = new Map<string, Profile>();

    asesores.forEach((asesor) => {
      mapa.set(asesor.id, asesor);
    });

    return mapa;
  }, [asesores]);

  const seguimientosPorCliente = useMemo(() => {
    const mapa = new Map<string, SeguimientoCliente[]>();

    seguimientos.forEach((seguimiento) => {
      const lista =
        mapa.get(seguimiento.cliente_id) || [];

      lista.push(seguimiento);
      mapa.set(seguimiento.cliente_id, lista);
    });

    return mapa;
  }, [seguimientos]);

  const calificacionVista = useMemo(
    () =>
      calcularCalificacionLead({
        situacion_inicial:
          form.situacionInicial,
        capacidad_cuota: form.capacidadCuota,
        tiempo_decision: form.tiempoDecision,
        intencion_compra: form.intencionCompra,
        canal_preferido: form.canalPreferido,
      }),
    [
      form.situacionInicial,
      form.capacidadCuota,
      form.tiempoDecision,
      form.intencionCompra,
      form.canalPreferido,
    ]
  );

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const clientesVisibles =
      profile && !modoGerencia
        ? clientes.filter(
            (cliente) =>
              cliente.asesor_id === profile.id
          )
        : clientes;

    return clientesVisibles.filter((cliente) => {
      if (
        filtroNivel !== "TODOS" &&
        cliente.nivel_interes !== filtroNivel
      ) {
        return false;
      }

      if (!texto) return true;

      return [
        nombreCliente(cliente),
        cliente.dni,
        cliente.celular,
        cliente.correo,
        cliente.fuente,
        cliente.nivel_interes,
        cliente.estado_lead,
        cliente.canal_preferido,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [
    busqueda,
    clientes,
    filtroNivel,
    modoGerencia,
    profile,
  ]);

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

    if (
      form.canalPreferido === "CITA_OFICINA" &&
      !form.dni.trim()
    ) {
      setError(
        "Para solicitar cita en oficina, registra el DNI del cliente."
      );
      setGuardando(false);
      return;
    }

    const asesorAsignado = modoGerencia
      ? form.asesorId || null
      : profile.id;

    const calificacion =
      calcularCalificacionLead({
        situacion_inicial:
          form.situacionInicial,
        capacidad_cuota: form.capacidadCuota,
        tiempo_decision: form.tiempoDecision,
        intencion_compra: form.intencionCompra,
        canal_preferido: form.canalPreferido,
      });

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

      situacion_inicial:
        form.situacionInicial,
      capacidad_cuota: form.capacidadCuota,
      tiempo_decision: form.tiempoDecision,
      intencion_compra:
        form.intencionCompra,
      canal_preferido:
        form.canalPreferido,
      puntaje_lead:
        calificacion.puntaje_lead,
      nivel_interes:
        calificacion.nivel_interes,
      estado_lead:
        calificacion.estado_lead,
      proxima_accion:
        calificacion.proxima_accion,
      fecha_proximo_seguimiento:
        form.fechaProximoSeguimiento || null,
      objecion_principal:
        form.objecionPrincipal.trim() || null,
      estado_cita:
        form.canalPreferido === "CITA_OFICINA"
          ? "CITA_SOLICITADA"
          : "SIN_CITA",
      fecha_cita: null,
      hora_cita: null,
    };

    const { error: insertError } =
      await supabase.from("clientes").insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setMensaje("Cliente registrado y calificado.");
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

  const iniciarProgramarCita = (cliente: Cliente) => {
    setMensaje(null);
    setError(null);

    setCitaEditando({
      clienteId: cliente.id,
      fechaCita: cliente.fecha_cita || "",
      horaCita: cliente.hora_cita || "",
    });
  };

  const actualizarCitaEditando = (
    campo: "fechaCita" | "horaCita",
    valor: string
  ) => {
    setCitaEditando((actual) =>
      actual
        ? {
            ...actual,
            [campo]: valor,
          }
        : actual
    );
  };

  const guardarProgramacionCita = async (
    cliente: Cliente
  ) => {
    if (!supabase || !citaEditando) return;

    if (!citaEditando.fechaCita) {
      setError("Selecciona la fecha de la cita.");
      return;
    }

    if (citaEditando.fechaCita < obtenerFechaHoyISO()) {
      setError("No puedes programar una cita en una fecha pasada.");
      return;
    }

    if (!citaEditando.horaCita.trim()) {
      setError("Registra la hora pactada de la cita.");
      return;
    }

    setProgramandoCita(cliente.id);
    setMensaje(null);
    setError(null);

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        estado_cita: "CITA_PROGRAMADA",
        fecha_cita: citaEditando.fechaCita,
        hora_cita: citaEditando.horaCita.trim(),
        fecha_proximo_seguimiento:
          citaEditando.fechaCita,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMensaje("Cita programada correctamente.");
      setCitaEditando(null);
      await cargar();
    }

    setProgramandoCita(null);
  };

  const iniciarSeguimiento = (cliente: Cliente) => {
    setMensaje(null);
    setError(null);

    setSeguimientoEditando({
      ...seguimientoVacio,
      clienteId: cliente.id,
      tipoContacto:
        cliente.canal_preferido === "LLAMADA"
          ? "LLAMADA"
          : cliente.canal_preferido === "CITA_OFICINA"
            ? "CITA"
            : "WHATSAPP",
    });
  };



  useEffect(() => {
    if (!seguimientoDesdeUrl) return;
    if (parametroProcesado === seguimientoDesdeUrl) return;
    if (clientes.length === 0) return;

    const clienteEncontrado = clientes.find(
      (cliente) => cliente.id === seguimientoDesdeUrl
    );

    if (!clienteEncontrado) return;

    const timer = window.setTimeout(() => {
      iniciarSeguimiento(clienteEncontrado);
      setParametroProcesado(seguimientoDesdeUrl);

      const fila = document.getElementById(
        `cliente-${clienteEncontrado.id}`
      );

      fila?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    seguimientoDesdeUrl,
    parametroProcesado,
    clientes,
  ]);

  const actualizarSeguimiento = (
    campo: keyof SeguimientoForm,
    valor: string
  ) => {
    setSeguimientoEditando((actual) =>
      actual
        ? {
            ...actual,
            [campo]: valor,
          }
        : actual
    );
  };

  const guardarSeguimientoCliente = async (
    cliente: Cliente
  ) => {
    if (!supabase || !profile || !seguimientoEditando) return;

    if (!seguimientoEditando.comentario.trim()) {
      setError("Escribe un comentario del seguimiento.");
      return;
    }

    if (
      seguimientoEditando.fechaProximoSeguimiento &&
      seguimientoEditando.fechaProximoSeguimiento <
        obtenerFechaHoyISO()
    ) {
      setError(
        "El próximo seguimiento no puede estar en una fecha pasada."
      );
      return;
    }

    setGuardandoSeguimiento(cliente.id);
    setMensaje(null);
    setError(null);

    const asesorDelSeguimiento =
      cliente.asesor_id || profile.id;

    const { error: insertError } = await supabase
      .from("seguimientos_clientes")
      .insert({
        cliente_id: cliente.id,
        asesor_id: asesorDelSeguimiento,
        tipo_contacto:
          seguimientoEditando.tipoContacto,
        resultado: seguimientoEditando.resultado,
        comentario:
          seguimientoEditando.comentario.trim(),
        fecha_proximo_seguimiento:
          seguimientoEditando.fechaProximoSeguimiento ||
          null,
        created_by: profile.id,
      });

    if (insertError) {
      setError(insertError.message);
      setGuardandoSeguimiento(null);
      return;
    }

    let nuevoEstadoLead = cliente.estado_lead || "SEGUIMIENTO";
    let nuevaProximaAccion = cliente.proxima_accion || "CONTACTAR";

    if (seguimientoEditando.resultado === "NO_RESPONDE") {
      nuevoEstadoLead = "NO_RESPONDE";
      nuevaProximaAccion = "VOLVER_A_CONTACTAR";
    }

    if (
      seguimientoEditando.resultado === "CONTACTADO" ||
      seguimientoEditando.resultado === "INTERESADO" ||
      seguimientoEditando.resultado === "DUDAS"
    ) {
      nuevoEstadoLead = "SEGUIMIENTO";
      nuevaProximaAccion = "VOLVER_A_CONTACTAR";
    }

    if (seguimientoEditando.resultado === "AGENDO_CITA") {
      nuevoEstadoLead = "CALIFICADO";
      nuevaProximaAccion = "AGENDAR_CITA";
    }

    if (
      seguimientoEditando.resultado === "SEPARARA_PRONTO"
    ) {
      nuevoEstadoLead = "NEGOCIANDO";
      nuevaProximaAccion = "ESPERAR_PAGO";
    }

    if (seguimientoEditando.resultado === "DESCARTADO") {
      nuevoEstadoLead = "PERDIDO";
      nuevaProximaAccion = "DESCARTAR";
    }

    const { error: updateError } = await supabase
      .from("clientes")
      .update({
        estado_lead: nuevoEstadoLead,
        proxima_accion: nuevaProximaAccion,
        fecha_proximo_seguimiento:
          seguimientoEditando.fechaProximoSeguimiento ||
          null,
      })
      .eq("id", cliente.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMensaje("Seguimiento registrado.");
      setSeguimientoEditando(null);
      await cargar();
    }

    setGuardandoSeguimiento(null);
  };

  const nivelColor = colorNivelInteres(
    calificacionVista.nivel_interes
  );

  return (
    <section>
      <form onSubmit={crearCliente} style={formBox}>
        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>
              Registro del cliente
            </h3>
            <p style={sectionText}>
              Registra los datos básicos y completa el
              filtro comercial.
            </p>
          </div>

          <div
            style={{
              ...scoreBox,
              background: nivelColor.bg,
              color: nivelColor.fg,
            }}
          >
            <strong>
              {etiquetaNivelInteres(
                calificacionVista.nivel_interes
              )}
            </strong>
            <span>
              {calificacionVista.puntaje_lead}/100
            </span>
          </div>
        </div>

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
            required={form.canalPreferido === "CITA_OFICINA"}
            value={form.dni}
            onChange={(event) =>
              actualizarForm("dni", event.target.value)
            }
            placeholder={
              form.canalPreferido === "CITA_OFICINA"
                ? "DNI obligatorio para cita"
                : "DNI"
            }
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
            placeholder="WhatsApp / Celular"
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

        <div style={divider} />

        <div style={sectionHeader}>
          <div>
            <h3 style={sectionTitle}>
              Calificador comercial
            </h3>
            <p style={sectionText}>
              Estas preguntas ayudan a separar compradores
              reales de curiosos.
            </p>
          </div>
        </div>

        <div style={questionsGrid}>
          <label style={questionBox}>
            <span style={questionTitle}>
              1. Para acceder al precio de lanzamiento,
              la separación se realiza desde S/ 500 y la
              inicial referencial es desde S/ 6,000.
            </span>
            <span style={questionSubtitle}>
              ¿Cuál es tu situación actual?
            </span>
            <select
              value={form.situacionInicial}
              onChange={(event) =>
                actualizarForm(
                  "situacionInicial",
                  event.target.value
                )
              }
              style={input}
            >
              {situacionesInicial.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={questionBox}>
            <span style={questionTitle}>
              2. El saldo puede financiarse en cuotas
              mensuales aproximadas entre S/ 600 y S/ 1,000,
              según el lote elegido.
            </span>
            <span style={questionSubtitle}>
              ¿Qué opción se ajusta mejor a ti?
            </span>
            <select
              value={form.capacidadCuota}
              onChange={(event) =>
                actualizarForm(
                  "capacidadCuota",
                  event.target.value
                )
              }
              style={input}
            >
              {capacidadesCuota.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={questionBox}>
            <span style={questionTitle}>
              3. ¿En qué plazo te gustaría separar o
              tomar una decisión?
            </span>
            <select
              value={form.tiempoDecision}
              onChange={(event) =>
                actualizarForm(
                  "tiempoDecision",
                  event.target.value
                )
              }
              style={input}
            >
              {tiemposDecision.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={questionBox}>
            <span style={questionTitle}>
              4. ¿Quieres que un asesor te envíe la
              disponibilidad actual de lotes y las
              condiciones para separar?
            </span>
            <select
              value={form.intencionCompra}
              onChange={(event) =>
                actualizarForm(
                  "intencionCompra",
                  event.target.value
                )
              }
              style={input}
            >
              {intencionesCompra.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={questionBox}>
            <span style={questionTitle}>
              5. ¿Cómo deseas avanzar con la atención
              comercial?
            </span>
            <select
              value={form.canalPreferido}
              onChange={(event) =>
                actualizarForm(
                  "canalPreferido",
                  event.target.value
                )
              }
              style={input}
            >
              {canalesPreferidos.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.canalPreferido === "CITA_OFICINA" && (
          <div style={citaBox}>
            <strong>
              Cita en oficina de ventas solicitada
            </strong>
            <p style={sectionText}>
              El cliente dejó intención de asistir a oficina. El asesor debe
              comunicarse por WhatsApp o llamada para pactar fecha y hora.
              Luego la cita se programará manualmente en el CRM.
            </p>
          </div>
        )}

        <div style={formGrid}>
          {form.canalPreferido !== "CITA_OFICINA" && (
            <input
              type="date"
              value={form.fechaProximoSeguimiento}
              onChange={(event) =>
                actualizarForm(
                  "fechaProximoSeguimiento",
                  event.target.value
                )
              }
              style={input}
              title="Fecha de próximo seguimiento"
            />
          )}

          <input
            value={form.objecionPrincipal}
            onChange={(event) =>
              actualizarForm(
                "objecionPrincipal",
                event.target.value
              )
            }
            placeholder="Objeción principal: precio, ubicación, documentos, cuotas..."
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
            : "Crear cliente calificado"}
        </button>
      </form>

      <div style={toolbar}>
        <input
          value={busqueda}
          onChange={(event) =>
            setBusqueda(event.target.value)
          }
          placeholder="Buscar cliente, DNI, celular, correo o estado"
          style={search}
        />

        <select
          value={filtroNivel}
          onChange={(event) =>
            setFiltroNivel(event.target.value)
          }
          style={selectSmall}
        >
          <option value="TODOS">Todos los leads</option>
          <option value="CALIENTE">
            Solo calientes
          </option>
          <option value="TIBIO">Solo tibios</option>
          <option value="FRIO">Solo fríos</option>
        </select>

        {profile && !modoGerencia && (
          <span style={filterPill}>
            Mostrando solo mis clientes
          </span>
        )}
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
                "Lead",
                "Inicial",
                "Cuotas",
                "Decisión",
                "Canal",
                "Acción",
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
              const color = colorNivelInteres(
                cliente.nivel_interes
              );

              const asesor = cliente.asesor_id
                ? asesoresPorId.get(cliente.asesor_id)
                : null;

              return (
                <tr
                  key={cliente.id}
                  id={`cliente-${cliente.id}`}
                  style={
                    clienteDesdeUrl === cliente.id ||
                    seguimientoDesdeUrl === cliente.id
                      ? filaResaltada
                      : undefined
                  }
                >
                  <td style={td}>
                    <strong>
                      {nombreCliente(cliente)}
                    </strong>
                    <div style={muted}>
                      DNI: {cliente.dni || "-"}
                    </div>
                    <div style={muted}>
                      WhatsApp:{" "}
                      {cliente.celular || "-"}
                    </div>
                    <div style={muted}>
                      Fuente:{" "}
                      {cliente.fuente || "-"}
                    </div>
                  </td>

                  <td style={td}>
                    <span
                      style={{
                        ...badge,
                        background: color.bg,
                        color: color.fg,
                      }}
                    >
                      {etiquetaNivelInteres(
                        cliente.nivel_interes
                      )}
                    </span>
                    <div style={muted}>
                      Puntaje:{" "}
                      {cliente.puntaje_lead ?? 0}/100
                    </div>
                    <div style={muted}>
                      Estado:{" "}
                      {etiquetaEstadoLead(
                        cliente.estado_lead
                      )}
                    </div>
                  </td>

                  <td style={td}>
                    {etiquetaSituacionInicial(
                      cliente.situacion_inicial
                    )}
                  </td>

                  <td style={td}>
                    {etiquetaCapacidadCuota(
                      cliente.capacidad_cuota
                    )}
                  </td>

                  <td style={td}>
                    {etiquetaTiempoDecision(
                      cliente.tiempo_decision
                    )}
                    <div style={muted}>
                      {etiquetaIntencionCompra(
                        cliente.intencion_compra
                      )}
                    </div>
                  </td>

                  <td style={td}>
                    {etiquetaCanalPreferido(
                      cliente.canal_preferido
                    )}

                    {cliente.canal_preferido ===
                      "CITA_OFICINA" && (
                      <>
                        <div style={muted}>
                          Estado:{" "}
                          {etiquetaEstadoCita(
                            cliente.estado_cita
                          )}
                        </div>

                        <div style={mutedNoWrap}>
                          {cliente.fecha_cita
                            ? formatearFechaLocal(cliente.fecha_cita)
                            : "Fecha por pactar"}
                          {cliente.hora_cita
                            ? ` - ${cliente.hora_cita}`
                            : ""}
                        </div>
                      </>
                    )}
                  </td>

                  <td style={td}>
                    {etiquetaProximaAccion(
                      cliente.proxima_accion
                    )}

                    {cliente.canal_preferido === "CITA_OFICINA" && (
                      <div style={miniEditor}>
                        {citaEditando?.clienteId === cliente.id ? (
                          <>
                            <input
                              type="date"
                              min={obtenerFechaHoyISO()}
                              value={citaEditando.fechaCita}
                              onChange={(event) =>
                                actualizarCitaEditando(
                                  "fechaCita",
                                  event.target.value
                                )
                              }
                              style={miniInput}
                            />

                            <HoraPickerIOS
                              value={citaEditando.horaCita}
                              onChange={(valor) =>
                                actualizarCitaEditando(
                                  "horaCita",
                                  valor
                                )
                              }
                            />

                            <div style={miniActions}>
                              <button
                                type="button"
                                disabled={programandoCita === cliente.id}
                                onClick={() =>
                                  guardarProgramacionCita(cliente)
                                }
                                style={smallGreenButton}
                              >
                                {programandoCita === cliente.id
                                  ? "Guardando..."
                                  : "Guardar cita"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setCitaEditando(null)}
                                style={smallGhostButton}
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              iniciarProgramarCita(cliente)
                            }
                            style={smallGoldButton}
                          >
                            {cliente.fecha_cita
                              ? "Reprogramar cita"
                              : "Programar cita"}
                          </button>
                        )}
                      </div>
                    )}

                    <div style={miniEditor}>
                      {seguimientoEditando?.clienteId === cliente.id ? (
                        <>
                          <select
                            value={seguimientoEditando.tipoContacto}
                            onChange={(event) =>
                              actualizarSeguimiento(
                                "tipoContacto",
                                event.target.value
                              )
                            }
                            style={miniInput}
                          >
                            {tiposContacto.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={seguimientoEditando.resultado}
                            onChange={(event) =>
                              actualizarSeguimiento(
                                "resultado",
                                event.target.value
                              )
                            }
                            style={miniInput}
                          >
                            {resultadosSeguimiento.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>

                          <textarea
                            value={seguimientoEditando.comentario}
                            onChange={(event) =>
                              actualizarSeguimiento(
                                "comentario",
                                event.target.value
                              )
                            }
                            placeholder="Comentario del seguimiento"
                            style={miniTextarea}
                          />

                          <input
                            type="date"
                            min={obtenerFechaHoyISO()}
                            value={
                              seguimientoEditando.fechaProximoSeguimiento
                            }
                            onChange={(event) =>
                              actualizarSeguimiento(
                                "fechaProximoSeguimiento",
                                event.target.value
                              )
                            }
                            style={miniInput}
                          />

                          <div style={miniActions}>
                            <button
                              type="button"
                              disabled={
                                guardandoSeguimiento === cliente.id
                              }
                              onClick={() =>
                                guardarSeguimientoCliente(cliente)
                              }
                              style={smallGreenButton}
                            >
                              {guardandoSeguimiento === cliente.id
                                ? "Guardando..."
                                : "Guardar seguimiento"}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSeguimientoEditando(null)}
                              style={smallGhostButton}
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => iniciarSeguimiento(cliente)}
                          style={smallBlueButton}
                        >
                          Registrar seguimiento
                        </button>
                      )}
                    </div>

                    {(() => {
                      const listaSeguimientos =
                        seguimientosPorCliente.get(cliente.id) || [];

                      const ultimoSeguimiento = listaSeguimientos[0];

                      if (!ultimoSeguimiento) return null;

                      return (
                        <div style={seguimientoCompacto}>
                          <div style={seguimientoCompactoTitulo}>
                            Último seguimiento
                          </div>

                          <strong>
                            {etiquetaTipoContacto(
                              ultimoSeguimiento.tipo_contacto
                            )}{" "}
                            ·{" "}
                            {etiquetaResultadoSeguimiento(
                              ultimoSeguimiento.resultado
                            )}
                          </strong>

                          {ultimoSeguimiento.comentario && (
                            <div style={muted}>
                              {ultimoSeguimiento.comentario}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setHistorialAbierto(cliente.id)
                            }
                            style={smallGhostButton}
                          >
                            Ver historial ({listaSeguimientos.length})
                          </button>
                        </div>
                      );
                    })()}

                    {cliente.fecha_proximo_seguimiento &&
                      cliente.canal_preferido !== "CITA_OFICINA" && (
                        <div style={muted}>
                          Seguimiento:{" "}
                          {formatearFechaLocal(
                            cliente.fecha_proximo_seguimiento
                          )}
                        </div>
                      )}

                    {cliente.objecion_principal && (
                      <div style={muted}>
                        Objeción:{" "}
                        {cliente.objecion_principal}
                      </div>
                    )}
                  </td>

                  <td style={td}>
                    {modoGerencia ? (
                      <select
                        value={
                          cliente.asesor_id || ""
                        }
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
                      "Asignado a ti"
                    )}

                    {modoGerencia && asesor && (
                      <div style={muted}>
                        {asesor.full_name ||
                          asesor.email}
                      </div>
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

            {clientesFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    ...td,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  No hay clientes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {historialAbierto && (
        <div
          style={modalOverlay}
          onClick={() => setHistorialAbierto(null)}
        >
          <div
            style={historialModal}
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const clienteActual = clientes.find(
                (item) => item.id === historialAbierto
              );

              const listaSeguimientos =
                seguimientosPorCliente.get(historialAbierto) || [];

              return (
                <>
                  <div style={modalHeader}>
                    <div>
                      <div style={modalSubtitulo}>
                        Historial comercial
                      </div>
                      <h3 style={modalTitulo}>
                        {clienteActual
                          ? nombreCliente(clienteActual)
                          : "Cliente"}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHistorialAbierto(null)}
                      style={modalCloseButton}
                    >
                      ×
                    </button>
                  </div>

                  {listaSeguimientos.length === 0 ? (
                    <div style={emptyHistorial}>
                      Este cliente aún no tiene seguimientos registrados.
                    </div>
                  ) : (
                    <div style={historialLista}>
                      {listaSeguimientos.map((seguimiento) => (
                        <div
                          key={seguimiento.id}
                          style={historialItem}
                        >
                          <div style={historialItemTop}>
                            <strong>
                              {etiquetaTipoContacto(
                                seguimiento.tipo_contacto
                              )}{" "}
                              ·{" "}
                              {etiquetaResultadoSeguimiento(
                                seguimiento.resultado
                              )}
                            </strong>

                            {seguimiento.created_at && (
                              <span style={historialFecha}>
                                {new Date(
                                  seguimiento.created_at
                                ).toLocaleString("es-PE")}
                              </span>
                            )}
                          </div>

                          {seguimiento.comentario && (
                            <p style={historialComentario}>
                              {seguimiento.comentario}
                            </p>
                          )}

                          {seguimiento.fecha_proximo_seguimiento && (
                            <div style={historialSeguimiento}>
                              Próximo seguimiento:{" "}
                              {formatearFechaLocal(
                                seguimiento.fecha_proximo_seguimiento
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
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

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 14,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 18,
  fontWeight: 900,
};

const sectionText: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const scoreBox: React.CSSProperties = {
  minWidth: 116,
  borderRadius: 14,
  padding: "10px 12px",
  textAlign: "center",
  fontWeight: 900,
  display: "grid",
  gap: 3,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const questionsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const questionBox: React.CSSProperties = {
  display: "grid",
  gap: 8,
  border: "1px solid #e5e7eb",
  background: "#fafaf8",
  borderRadius: 14,
  padding: 14,
};

const questionTitle: React.CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.35,
};

const questionSubtitle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const input: React.CSSProperties = {
  height: 42,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 12px",
  background: "#ffffff",
  color: "#111827",
  width: "100%",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: 82,
  marginTop: 12,
  padding: 12,
  resize: "vertical",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "#eef0ec",
  margin: "18px 0",
};

const citaBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  borderRadius: 14,
  border: "1px solid #d9e6db",
  background: "#f2f8f3",
  padding: 14,
  color: "#17633a",
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
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const search: React.CSSProperties = {
  ...input,
  width: "min(100%, 420px)",
};

const filterPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 36,
  borderRadius: 999,
  padding: "0 12px",
  background: "#eef6ff",
  color: "#244d77",
  fontWeight: 900,
  fontSize: 13,
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
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "13px 16px",
  borderBottom: "1px solid #eef0ec",
  color: "#111827",
  fontSize: 14,
  verticalAlign: "top",
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

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const muted: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
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

const miniEditor: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 6,
  maxWidth: 220,
};

const miniInput: React.CSSProperties = {
  height: 34,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0 9px",
  background: "#ffffff",
  color: "#111827",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

const miniActions: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const smallGreenButton: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "7px 10px",
  background: "#2f7d46",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};

const smallGoldButton: React.CSSProperties = {
  border: "1px solid #d9b65d",
  borderRadius: 10,
  padding: "7px 10px",
  background: "#fff6d8",
  color: "#7a4b12",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};

const smallGhostButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "7px 10px",
  background: "#ffffff",
  color: "#374151",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};

const botonHoraIOS: React.CSSProperties =
  {
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  };

const pickerOverlay: React.CSSProperties =
  {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15,23,42,.32)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: 16,
  };

const pickerModal: React.CSSProperties = {
  width: "min(100%, 320px)",
  background: "#ffffff",
  borderRadius: 18,
  boxShadow:
    "0 18px 42px rgba(15,23,42,.18)",
  padding: 12,
  transform: "scale(.85)",
  transformOrigin: "center",
};

const pickerHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
  gap: 8,
};

const pickerGhostButton: React.CSSProperties =
  {
    border: 0,
    background: "transparent",
    color: "#475569",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 14,
    padding: "6px 4px",
  };

const pickerPrimaryButton: React.CSSProperties =
  {
    border: 0,
    borderRadius: 10,
    background: "#2f7d46",
    color: "#ffffff",
    fontWeight: 900,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 14,
    minWidth: 72,
    height: 42,
  };

const pickerBody: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background:
    "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
  borderRadius: 16,
  padding: "10px 8px",
};

const pickerColon: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: 20,
  fontWeight: 900,
  paddingBottom: 2,
};

const wheelOuter: React.CSSProperties = {
  position: "relative",
  height: PICKER_HEIGHT,
  overflow: "hidden",
  borderRadius: 14,
};

const wheelScroll: React.CSSProperties = {
  height: PICKER_HEIGHT,
  overflowY: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  scrollSnapType: "y mandatory",
};

const wheelItem: React.CSSProperties = {
  height: PICKER_ITEM_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  letterSpacing: ".01em",
  cursor: "pointer",
  scrollSnapAlign: "center",
  transition: "all .16s ease",
};

const wheelHighlight: React.CSSProperties = {
  position: "absolute",
  left: 4,
  right: 4,
  top: "50%",
  transform: "translateY(-50%)",
  height: PICKER_ITEM_HEIGHT + 6,
  borderRadius: 10,
  background:
    "rgba(255,255,255,.10)",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
  borderBottom:
    "1px solid rgba(255,255,255,.06)",
  pointerEvents: "none",
};

const pickerPreview: React.CSSProperties = {
  marginTop: 12,
  textAlign: "center",
  color: "#64748b",
  fontSize: 16,
};

const pickerPreviewHora: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#111827",
};

const mutedNoWrap: React.CSSProperties = {
  ...muted,
  whiteSpace: "nowrap",
};

const miniTextarea: React.CSSProperties = {
  ...miniInput,
  minHeight: 68,
  padding: 9,
  resize: "vertical",
};

const smallBlueButton: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 10,
  padding: "7px 10px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};

const seguimientoCompacto: React.CSSProperties = {
  marginTop: 8,
  borderLeft: "3px solid #dbeafe",
  background: "#f8fafc",
  padding: "8px 9px",
  borderRadius: 8,
  fontSize: 12,
  color: "#334155",
  display: "grid",
  gap: 4,
};

const seguimientoCompactoTitulo: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  background: "rgba(15,23,42,.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
};

const historialModal: React.CSSProperties = {
  width: "min(100%, 720px)",
  maxHeight: "82vh",
  overflow: "hidden",
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: "0 24px 70px rgba(15,23,42,.25)",
  border: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
};

const modalHeader: React.CSSProperties = {
  padding: "18px 20px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const modalSubtitulo: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const modalTitulo: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 22,
  lineHeight: 1.15,
  color: "#0f172a",
};

const modalCloseButton: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
};

const historialLista: React.CSSProperties = {
  padding: 18,
  overflowY: "auto",
  display: "grid",
  gap: 12,
};

const historialItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fafaf8",
  borderRadius: 14,
  padding: 14,
};

const historialItemTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  color: "#0f172a",
};

const historialFecha: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const historialComentario: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.45,
};

const historialSeguimiento: React.CSSProperties = {
  marginTop: 10,
  display: "inline-flex",
  borderRadius: 999,
  background: "#eef6ff",
  color: "#244d77",
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const emptyHistorial: React.CSSProperties = {
  padding: 24,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 800,
};
const filaResaltada: React.CSSProperties = {
  background: "#fff8e1",
  boxShadow: "inset 4px 0 0 #d97706",
};
