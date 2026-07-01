"use client";

import ModalLote from "../components/ModalLote";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
} from "react-zoom-pan-pinch";

import PlanoSVG from "../components/PlanoSVG";
import { supabase } from "../lib/supabase";

export type LoteData = {
  id: number;
  mz: string;
  lote: number;
  area: number;
  precio: number;
  estado: string;
  svg_id: string;
  nombre?: string;
};

export type LoteSeleccionado = {
  nombre?: string;
  area: string | number;
  precio: string | number;
  estado: string;
};

type LoteRegistro = {
  id: number | string;
  mz: string | null;
  lote: number | string;
  area: number | string;
  precio: number | string;
  estado: string | null;
  svg_id: string | null;
  nombre?: string | null;
};

const TABLA_LOTES = "las_lomas_lotes";

const normalizarEstado = (
  estado: string | null
) => {
  const valor =
    (estado || "DISPONIBLE")
      .trim()
      .toUpperCase();

  return valor === "RESERVADO"
    ? "SEPARADO"
    : valor;
};

const normalizarLotes = (
  data: LoteRegistro[]
): LoteData[] =>
  data
    .filter((lote) => Boolean(lote.svg_id))
    .map((lote) => ({
      id: Number(lote.id),
      mz: String(lote.mz || ""),
      lote: Number(lote.lote),
      area: Number(lote.area),
      precio: Number(lote.precio),
      estado: normalizarEstado(lote.estado),
      svg_id: String(lote.svg_id),
      nombre: lote.nombre
        ? String(lote.nombre)
        : undefined,
    }));

export default function Home() {
  const [loteSeleccionado, setLoteSeleccionado] =
    useState<LoteSeleccionado | null>(null);

  const [lotes, setLotes] = useState<LoteData[]>([]);

  const [
    mostrarContacto,
    setMostrarContacto,
  ] = useState(false);

  const [
    modoNoche,
    setModoNoche,
  ] = useState(false);

  const [
    mostrarResumen,
    setMostrarResumen,
  ] = useState(false);

  const [
    aceptaDatos,
    setAceptaDatos,
  ] = useState(false);

  const [
    aceptaComercial,
    setAceptaComercial,
  ] = useState(false);
  
  const [
    mostrarDatos,
    setMostrarDatos,
  ] = useState(false);

  const [vista, setVista] =
    useState<"mapa" | "tabla">(
      "mapa"
    );
  
  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState("TODOS");

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    precioMin,
    setPrecioMin,
  ] = useState("");

  const [
    precioMax,
    setPrecioMax,
  ] = useState("");

  const [
    areaMin,
    setAreaMin,
  ] = useState("");

  const [
    areaMax,
    setAreaMax,
  ] = useState("");

  const [campoOrden, setCampoOrden] =
    useState<
      "precio" |
      "area" |
      "lote" |
      "mz"
    >("precio");

  const [direccionOrden, setDireccionOrden] =
    useState<"asc" | "desc">(
      "asc"
    );  
 
  const [
    mostrarComercial,
    setMostrarComercial,
  ] = useState(false);

  const [
    filaSeleccionada,
    setFilaSeleccionada,
  ] = useState<number | null>(null);

  const [
    loteUbicado,
    setLoteUbicado,
  ] = useState<LoteData | null>(null);

  useEffect(() => {
    let activo = true;

    const aplicarLotes = (
      data: LoteData[]
    ) => {
      if (activo) {
        setLotes(data);
      }
    };

    const cargarLotesLocales =
      async () => {
        const respuesta =
          await fetch("/lotes.json");

        if (!respuesta.ok) {
          throw new Error(
            "No se pudo cargar public/lotes.json"
          );
        }

        const data =
          (await respuesta.json()) as LoteRegistro[];

        return normalizarLotes(data);
      };

    const cargarLotes = async () => {
      try {
        if (!supabase) {
          aplicarLotes(
            await cargarLotesLocales()
          );
          return;
        }

        const { data, error } =
          await supabase
            .from(TABLA_LOTES)
            .select(
              "id,mz,lote,area,precio,estado,svg_id"
            )
            .order("id", {
              ascending: true,
            });

        if (error) {
          throw error;
        }

        const lotesSupabase =
          normalizarLotes(
            (data || []) as LoteRegistro[]
          );

        if (!lotesSupabase.length) {
          throw new Error(
            "Supabase no devolvio lotes"
          );
        }

        aplicarLotes(lotesSupabase);
      } catch (error) {
        console.error(error);

        try {
          aplicarLotes(
            await cargarLotesLocales()
          );
        } catch (errorLocal) {
          console.error(errorLocal);
        }
      }
    };

    cargarLotes();

    if (!supabase) {
      return () => {
        activo = false;
      };
    }

    const clienteSupabase = supabase;

    const canal = clienteSupabase
      .channel("las_lomas_lotes_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLA_LOTES,
        },
        () => {
          cargarLotes();
        }
      )
      .subscribe();

    return () => {
      activo = false;
      clienteSupabase.removeChannel(canal);
    };
  }, []);

  const disponibles =
    lotes.filter(
      (l) =>
        l.estado ===
        "DISPONIBLE"
    ).length;

  const separados =
    lotes.filter(
      (l) =>
        l.estado ===
        "SEPARADO"
    ).length;

  const vendidos =
    lotes.filter(
      (l) =>
        l.estado ===
        "VENDIDO"
    ).length;
  
  const ordenar = (
    campo:
      | "precio"
      | "area"
      | "lote"
      | "mz"
  ) => {

    if (campoOrden === campo) {

      setDireccionOrden(
        direccionOrden === "asc"
          ? "desc"
          : "asc"
      );

    } else {

      setCampoOrden(campo);

      setDireccionOrden("asc");
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("TODOS");
    setPrecioMin("");
    setPrecioMax("");
    setAreaMin("");
    setAreaMax("");
  };

  const enviarWhatsApp = () => {
    if (!loteSeleccionado) return;

    if (loteSeleccionado.estado !== "DISPONIBLE") {
      return;
    }

    const mensaje = `Hola, me interesa el siguiente lote: ${loteSeleccionado.nombre}
   - Área: ${loteSeleccionado.area} 
   - Precio: ${loteSeleccionado.precio}
   - Estado: ${loteSeleccionado.estado}

  Quisiera más información.`;

    const url = `https://wa.me/51933008638?text=${encodeURIComponent(
      mensaje
    )}`;

    window.open(url, "_blank");
  };

  const colorDivisorTabla = modoNoche
    ? "1px solid rgba(216,229,203,.16)"
    : "1px solid #e8e8e8";

  const controlTabla = modoNoche
    ? {
        background: "rgba(255,255,255,.08)",
        border:
          "1px solid rgba(216,229,203,.24)",
        color: "#f5f8ee",
        colorScheme: "dark" as const,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.06)",
      }
    : {};

  const thTabla = {
    ...th,
    background: modoNoche
      ? "#172433"
      : th.background,
    color: modoNoche
      ? "#dbeac7"
      : th.color,
    boxShadow: modoNoche
      ? "0 2px 10px rgba(0,0,0,.28)"
      : th.boxShadow,
  };

  const tdTabla = {
    ...td,
    color: modoNoche
      ? "#edf4e9"
      : "#111827",
  };

  return (
    <main
      className={modoNoche ? "modo-noche" : ""}
      style={{
        width: "100vw",
        height: "100vh",
        background:
          modoNoche
          ? "#07111f"
          : "#f0f0f0",
        overflow: "hidden",
      }}  
    >
      <div
        style={{
          position: "fixed",

          top: 1,

          left: 20,

          zIndex: 9999,
        }}
      >
        <div
          className="logo-mobile-ajuste"
          style={{
            width: 143,
            height: 98,
          }}
        >
          <Image
            src="/las-lomas-logo.png"
            alt="Las Lomas de Malabrigo"
            width={4762}
            height={3270}
            priority
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              filter:
                "drop-shadow(0 0 2px rgba(255,255,255,.82)) drop-shadow(0 0 6px rgba(255,255,255,.45)) drop-shadow(0 5px 8px rgba(0,0,0,.30))",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "fixed",

          top: 4,

          left: "50%",

          transform:
            "translateX(-50%)",

          zIndex: 9999,

          display: "flex",

          gap: 5,

          padding: 7,

          borderRadius: 999,

          background:
            "linear-gradient(180deg,#fff8e6,#f5e6b8)",

          backdropFilter:
            "blur(18px)",

          WebkitBackdropFilter:
            "blur(8px)",

          border:
            "1px solid rgba(210,170,80,.35)",

          boxShadow:
            "0 6px 20px rgba(180,140,40,.18)",
        }}
      >
        <button
          onClick={() =>
            setVista("mapa")
          }
          style={{
            border: "none",

            padding:
              "4px 18px",
          
            height: 30,

            borderRadius: 999,

            cursor: "pointer",

            background:
              vista === "mapa"
                ? "linear-gradient(180deg,#7ea84d,#5f8238)"
                : "transparent",

            color:
              vista === "mapa"
                ? "#ffffff"
                : "#6d5a22",

            fontWeight: 600,

            fontSize: 13,

            letterSpacing: ".4px",
          }}
        >
          MAPA
        </button>

        <button
          onClick={() =>
            setVista("tabla")
          }
          style={{
            border: "none",

            padding:
              "0px 18px",
            
            height: 28,

            borderRadius: 999,

            cursor: "pointer",

            background:
              vista === "tabla"
                ? "linear-gradient(180deg,#7ea84d,#5f8238)"
                : "transparent",
            
            color:
              vista === "tabla"
                ? "#ffffff"
                : "#6d5a22",

            fontWeight: 600,

            fontSize: 13,

            letterSpacing: ".4px",
          }}
        >
          TABLA
        </button>
      </div>

      <TransformWrapper
        initialScale={0.92}
        minScale={0.1}
        maxScale={40}
        centerOnInit
        limitToBounds={false}
        wheel={{
          step: 0.008,
        }}
        pinch={{
          step: 1,
        }}
        doubleClick={{
          disabled: true,
        }}
        panning={{
          velocityDisabled: true,
        }}

      >
        {({
          zoomIn,
          zoomOut,
          resetTransform,
          zoomToElement,
        }) => (
          <>
          <div
            className="modo-mobile-ajuste"
            style={{
              position: "fixed",

              top: 20,

              right: 80,

              zIndex: 9999,
            }}
          >
            <div
              onClick={() =>
                setModoNoche(
                  !modoNoche
                )
              }
              style={{
                width: 72,

                height: 38,

                borderRadius: 999,

                background:
                  modoNoche
                    ? "#1f2937"
                    : "#b9c3ab",

                cursor: "pointer",

                position: "relative",

                transition:
                  "all .3s ease",

                boxShadow:
                  "0 6px 20px rgba(0,0,0,.18)",
              }}
            >
              <div
                style={{
                  position: "absolute",

                  top: 3,

                  left:
                    modoNoche
                      ? 37
                      : 3,

                  width: 32,

                  height: 32,

                  borderRadius: "50%",

                  background:
                    "white",

                  display: "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  fontSize: 16,

                  transition:
                    "all .3s ease",
                }}
              >
                {modoNoche
                  ? "🌙"
                  : "☀"}
              </div>
            </div>
          </div>
    
          {vista === "mapa" &&
            !mostrarResumen && (

            <div
              onMouseEnter={() =>
                setMostrarResumen(true)
              }

              style={{
                position: "fixed",

                top: 300,

                left: 20,

                opacity:
                  mostrarResumen ? 0 : 1,

                transform:
                  mostrarResumen
                    ? "translateX(-15px)"
                    : "translateX(0)",

                pointerEvents:
                  mostrarResumen
                    ? "none"
                    : "auto",

                transition:
                  "all .25s ease",

                zIndex: 9999,

                width: 50,

                height: 110,

                borderRadius: 999,

                background:
                  "rgba(255,255,255,.15)",

                backdropFilter:
                  "blur(12px)",

                border:
                  "1px solid rgba(255,255,255,.25)",

                display: "flex",

                flexDirection: "column",

                justifyContent: "center",

                alignItems: "center",

                gap: 16,

                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: "#2F6F43",
                  boxShadow:
                    "0 0 18px rgba(47,111,67,.45)",
                }}
              />

              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: "#C9852E",
                  boxShadow:
                    "0 0 18px rgba(201,133,46,.45)",
                }}
              />

              <div
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: "#9F3B30",
                  boxShadow:
                    "0 0 18px rgba(159,59,48,.45)",
                }}
              />
            </div>
          )}

          {vista === "mapa" &&
            mostrarResumen && (

              <div
                onMouseEnter={() =>
                  setMostrarResumen(true)
                }

                onMouseLeave={() =>
                  setMostrarResumen(false)
                }

                style={{
                  position: "fixed",

                  top: 293,

                  left: 20,

                  opacity:
                    mostrarResumen ? 1 : 0,

                  transform:
                    mostrarResumen
                      ? "translateX(0)"
                      : "translateX(-25px)",

                  visibility:
                    mostrarResumen
                      ? "visible"
                      : "hidden",

                  pointerEvents:
                    mostrarResumen
                      ? "auto"
                      : "none",

                  transition:
                    "all .25s ease",

                  zIndex: 9999,

                  background:
                    "rgba(255, 255, 255, 0.58)",

                  backdropFilter:
                    "blur(18px)",

                  WebkitBackdropFilter:
                    "blur(18px)",

                  borderRadius: 30,

                  padding: "20px",

                  minWidth: 180,

                  boxShadow:
                    mostrarResumen
                      ? "0 25px 50px rgba(0,0,0,.22)"
                      : "0 15px 30px rgba(0,0,0,.12)",

                  border:
                    "1px solid rgba(255,190,120,.35)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    
                    gap:12,

                    marginBottom: 14,

                    color: "#2F6F43",

                    fontWeight: 700,

                    fontSize: 15,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#2F6F43",
                        boxShadow:
                          "0 0 12px rgba(47,111,67,.45)",
                      }}
                    />

                    <span>DISPONIBLE</span>
                  </div>

                  <span>
                    ({disponibles})
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",

                    marginBottom: 14,

                    color: "#8A6325",

                    fontWeight: 700,

                    fontSize: 15,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#C9852E",
                        boxShadow:
                          "0 0 12px rgba(201,133,46,.45)",
                      }}
                    />

                    <span>SEPARADO</span>
                  </div>

                  <span>
                    ({separados})
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",

                    marginBottom: 14,

                    color: "#9F3B30",

                    fontWeight: 700,

                    fontSize: 15,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#9F3B30",
                        boxShadow:
                          "0 0 12px rgba(159,59,48,.45)",
                      }}
                    />

                    <span>VENDIDO</span>
                  </div>

                  <span>
                    ({vendidos})
                  </span>
                </div>

                <div
                  style={{
                    borderTop:
                      "1px solid #eee",

                    paddingTop: 12,

                    textAlign: "left",

                    fontWeight: 700,

                    color: "#444",
                  }}
                >
                  TOTAL ({lotes.length})
                </div>
              </div>
          )}
          
            {vista === "mapa" && (
            <div
              style={{
                position: "fixed",
                bottom: 25,
                left: "50%",
                transform: 
                  "translateX(-50%)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                
              }}
            >
              <button
                onClick={() => zoomIn()}
                style={boton}
              >
                +
              </button>

              <button
                onClick={() => zoomOut()}
                style={boton}
              >
                −
              </button>

              <button
                onClick={() =>
                  resetTransform()
                }
                style={boton}
              >
                ⌂
              </button>
            </div>
            )}

            {vista === "mapa" && (
              <TransformComponent
                wrapperStyle={{
                  width: "100vw",
                  height: "100vh",
                  cursor: "grab",
                }}
              >
                <PlanoSVG
                  lotes={lotes}
                  loteUbicado={loteUbicado}
                  setLoteSeleccionado={
                    setLoteSeleccionado
                  }
                />
              </TransformComponent>
            )}

            {vista === "tabla" && (
              <div
                className="tabla-scroll-mobile"
                style={{
                  marginTop: 100,

                  padding: 0,

                  height: "calc(100vh - 120px)",

                  overflowY: "auto",

                  background: modoNoche
                    ? "#0b1421"
                    : "white",

                  borderRadius: 20,

                  border: modoNoche
                    ? "1px solid rgba(216,229,203,.12)"
                    : "none",

                  boxShadow:
                    modoNoche
                    ? "0 18px 42px rgba(0,0,0,.34)"
                    : "0 10px 30px rgba(0,0,0,.06)",
                }}
              >

              <div
                className="barra-filtros-tabla"
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2000,
                  width: "100%",
                  boxSizing: "border-box",
                  background: modoNoche
                    ? "linear-gradient(180deg,#1d2b2f,#111d2c)"
                    : "#fdf6e3",
                  borderBottom: modoNoche
                    ? "1px solid rgba(216,229,203,.16)"
                    : "1px solid #eadfbe",
                  padding: "10px 22px",
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(320px, 1.25fr) minmax(240px, .85fr) minmax(240px, .85fr) 170px 110px",
                  columnGap: 24,
                  alignItems: "center",
                }}
              >
                {/* BUSCADOR */}
                <div
                  style={{
                    minWidth: 0,
                    paddingRight: 24,
                    borderRight: colorDivisorTabla,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      height: 22,
                      marginBottom: 8,
                    }}
                  />

                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 21,
                        color: modoNoche
                          ? "#b8d98e"
                          : "#476f34",
                        pointerEvents: "none",
                      }}
                    >
                      🔍︎
                    </span>

                    <input
                      value={busqueda}
                      onChange={(e) =>
                        setBusqueda(e.target.value)
                      }
                      placeholder="Buscar MZ o lote"
                      style={{
                        ...inputBuscador,
                        ...controlTabla,
                      }}
                    />
                  </div>
                </div>

                {/* PRECIO */}
                <div
                  style={{
                    ...bloqueFiltro,
                    borderRight: colorDivisorTabla,
                  }}
                >
                  <div
                    style={{
                      ...tituloFiltro,
                      color: modoNoche
                        ? "#dbeac7"
                        : tituloFiltro.color,
                    }}
                  >
                    Precio (S/)
                  </div>

                  <div style={grupoRango}>
                    <input
                      type="number"
                      value={precioMin}
                      onChange={(e) =>
                        setPrecioMin(e.target.value)
                      }
                      placeholder="Mín."
                      style={{
                        ...inputFiltro,
                        ...controlTabla,
                      }}
                    />

                    <span
                      style={{
                        ...separadorRango,
                        color: modoNoche
                          ? "#c5d1be"
                          : separadorRango.color,
                      }}
                    >
                      −
                    </span>

                    <input
                      type="number"
                      value={precioMax}
                      onChange={(e) =>
                        setPrecioMax(e.target.value)
                      }
                      placeholder="Máx."
                      style={{
                        ...inputFiltro,
                        ...controlTabla,
                      }}
                    />
                  </div>
                </div>

                {/* ÁREA */}
                <div
                  style={{
                    ...bloqueFiltro,
                    borderRight: colorDivisorTabla,
                  }}
                >
                  <div
                    style={{
                      ...tituloFiltro,
                      color: modoNoche
                        ? "#dbeac7"
                        : tituloFiltro.color,
                    }}
                  >
                    Área (m²)
                  </div>

                  <div style={grupoRango}>
                    <input
                      type="number"
                      value={areaMin}
                      onChange={(e) =>
                        setAreaMin(e.target.value)
                      }
                      placeholder="Mín."
                      style={{
                        ...inputFiltro,
                        ...controlTabla,
                      }}
                    />

                    <span
                      style={{
                        ...separadorRango,
                        color: modoNoche
                          ? "#c5d1be"
                          : separadorRango.color,
                      }}
                    >
                      −
                    </span>

                    <input
                      type="number"
                      value={areaMax}
                      onChange={(e) =>
                        setAreaMax(e.target.value)
                      }
                      placeholder="Máx."
                      style={{
                        ...inputFiltro,
                        ...controlTabla,
                      }}
                    />
                  </div>
                </div>

                {/* ESTADO */}
                <div style={bloqueEstado}>
                  <div
                    style={{
                      ...tituloFiltro,
                      color: modoNoche
                        ? "#dbeac7"
                        : tituloFiltro.color,
                    }}
                  >
                    Estado
                  </div>

                  <select
                    value={filtroEstado}
                    onChange={(e) =>
                      setFiltroEstado(e.target.value)
                    }
                    style={{
                      ...inputSelect,
                      ...controlTabla,
                    }}
                  >
                    <option value="TODOS">
                      Todos
                    </option>
                    <option value="DISPONIBLE">
                      Disponibles
                    </option>
                    <option value="SEPARADO">
                      Separados
                    </option>
                    <option value="VENDIDO">
                      Vendidos
                    </option>
                  </select>
                </div>

                {/* LIMPIAR */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    height: "100%",
                  }}
                >
                  <button
                    onClick={limpiarFiltros}
                    style={{
                      ...botonLimpiar,
                      border: modoNoche
                        ? "1px solid rgba(184,217,142,.34)"
                        : botonLimpiar.border,
                      background: modoNoche
                        ? "linear-gradient(180deg,#263c3f,#17283a)"
                        : botonLimpiar.background,
                      color: modoNoche
                        ? "#dff5ca"
                        : botonLimpiar.color,
                      boxShadow: modoNoche
                        ? "0 6px 18px rgba(0,0,0,.24)"
                        : botonLimpiar.boxShadow,
                    }}
                  >
                    ↻ Limpiar
                  </button>
                </div>
              </div>
     
                <table
                  className="tabla-lotes"
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: modoNoche
                      ? "#0b1421"
                      : "white",
                    borderRadius: 12,
                    margin: 0,
                    color: modoNoche
                      ? "#edf4e9"
                      : "#111827",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: modoNoche
                          ? "#172433"
                          : "#f5f5f5",
                      }}
                    >
                      <th
                        style={{
                          ...thTabla,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          ordenar("mz")
                        }
                      >
                        MZ

                        {campoOrden === "mz" 
                          ? direccionOrden === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ⇅"}
                      </th>

                      <th
                        style={{
                          ...thTabla,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          ordenar("lote")
                        }
                      >
                        LOTE

                        {campoOrden === "lote" 
                          ? direccionOrden === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ⇅"}
                      </th>

                      <th
                        style={{
                          ...thTabla,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          ordenar("area")
                        }
                      >
                        AREA

                        {campoOrden === "area"
                          ? direccionOrden === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ⇅"}
                      </th>

                      <th
                        style={{
                          ...thTabla,
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          ordenar("precio")
                        }
                      >
                        PRECIO

                        {campoOrden === "precio"
                          ? direccionOrden === "asc"
                            ? " ▲"
                            : " ▼"
                          : " ⇅"}
                      </th>

                      <th style={thTabla}>
                        ESTADO
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...lotes]

                      .filter(
                        (lote) =>
                          filtroEstado ===
                            "TODOS" ||
                          lote.estado ===
                            filtroEstado
                      )

                      .filter((lote) => {

                        if (busqueda === "")
                          return true;

                        const textoBusqueda =
                          busqueda
                            .toLowerCase()
                            .replace(/[-\s]/g, "")
                            .replace(/^([a-z])0+/i, "$1");

                        const codigoLote =
                          `${lote.mz}${Number(lote.lote)}`
                            .toLowerCase()
                            .replace(/[-\s]/g, "");

                        return (
                          codigoLote === textoBusqueda ||
                          lote.mz
                            .toLowerCase() ===
                            textoBusqueda
                        );
                      })

                      .filter((lote) => {

                        if (
                          precioMin !== "" &&
                          lote.precio < Number(precioMin)
                        )
                          return false;

                        if (
                          precioMax !== "" &&
                          lote.precio > Number(precioMax)
                        )
                          return false;

                        return true;
                      })

                      .filter((lote) => {

                        if (
                          areaMin !== "" &&
                          lote.area < Number(areaMin)
                        )
                          return false;

                        if (
                          areaMax !== "" &&
                          lote.area > Number(areaMax)
                        )
                          return false;

                        return true;
                      })

                      .sort((a, b) => {

                        let valorA =
                          a[campoOrden];

                        let valorB =
                          b[campoOrden];

                        if (
                          campoOrden === "mz"
                        ) {
                          valorA =
                            String(valorA).toUpperCase();

                          valorB =
                            String(valorB).toUpperCase();
                        }

                        if (
                          direccionOrden ===
                          "asc"
                        ) {

                          return valorA > valorB
                            ? 1
                            : -1;

                        } else {

                          return valorA < valorB
                            ? 1
                            : -1;
                        }
                      })
                      .map((lote, index) => (  

                      <tr
                        key={lote.id}

                        onClick={() => {
                          setFilaSeleccionada(lote.id);

                          setLoteUbicado(lote);

                          setVista("mapa");

                          setTimeout(() => {
                            zoomToElement(
                              lote.svg_id,
                              3,
                              700
                            );
                          }, 500);
                        }}

                        style={{
                          background:
                            filaSeleccionada === lote.id
                              ? modoNoche
                                ? "rgba(126,168,77,.24)"
                                : "#e9f7d9"
                              : index % 2 === 0
                                ? modoNoche
                                  ? "#111b29"
                                  : "#ffffff"
                                : modoNoche
                                  ? "#0d1724"
                                  : "#fafaf5",

                          borderBottom:
                            modoNoche
                              ? "1px solid rgba(216,229,203,.08)"
                              : "1px solid #efefef",

                          transition:
                            "all .20s ease",

                          cursor: "pointer",
                        }}
                      >

                        <td
                          style={{
                            ...tdTabla,
                            fontWeight: 700,
                            color: modoNoche
                              ? "#f7fbff"
                              : "#1f2937",
                          }}
                        >
                          {lote.mz}
                        </td>

                        <td
                          style={{
                            ...tdTabla,
                            fontWeight: 700,
                            color: modoNoche
                              ? "#f7fbff"
                              : "#1f2937",
                          }}
                        >
                          {lote.lote}
                        </td>

                        <td style={tdTabla}>
                          {Number(
                            lote.area
                          ).toFixed(2)}{" "}
                          m²
                        </td>

                        <td
                          style={{
                            ...tdTabla,
                          }}
                        >
                          S/{" "}
                          {Number(
                            lote.precio
                          ).toLocaleString(
                            "es-PE",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }  
                          )}
                        </td>

                        <td style={tdTabla}>
                          <span
                            style={{
                              padding: "6px 12px",

                              borderRadius: 999,

                              fontSize: 12,

                              fontWeight: 700,

                              color:
                                modoNoche
                                  ? lote.estado === "DISPONIBLE"
                                    ? "#c7f2c5"
                                    : lote.estado === "SEPARADO"
                                    ? "#ffe0a6"
                                    : "#ffc1b6"
                                  : lote.estado === "DISPONIBLE"
                                    ? "#2F6F43"
                                    : lote.estado === "SEPARADO"
                                    ? "#7B5A1D"
                                    : "#8F2F27",

                              background:
                                modoNoche
                                  ? lote.estado === "DISPONIBLE"
                                    ? "rgba(59,143,82,.22)"
                                    : lote.estado === "SEPARADO"
                                    ? "rgba(182,126,42,.24)"
                                    : "rgba(187,69,53,.24)"
                                  : lote.estado === "DISPONIBLE"
                                    ? "#E4F0E6"
                                    : lote.estado === "SEPARADO"
                                    ? "#F6E8CF"
                                    : "#F4DDD9",

                              border: modoNoche
                                ? "1px solid rgba(255,255,255,.08)"
                                : "none",
                            }}
                          >
                            {lote.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </>
        )}
      </TransformWrapper>

      {loteSeleccionado && (
        <ModalLote
          key={loteSeleccionado.nombre}
          lote={loteSeleccionado}
          modoNoche={modoNoche}
          onClose={() =>
            setLoteSeleccionado(null)
          }
          onHablarAsesor={() => {
            if (
              loteSeleccionado.estado !== "DISPONIBLE"
            ) {
              return;
            }

            setMostrarContacto(true);
          }}
        />
      )}

      {mostrarContacto && (
        <div
          style={{
            position: "fixed",
            inset: 0,

            background:
              "rgba(0,0,0,.35)",

            display: "flex",

            justifyContent:
              "center",

            alignItems:
              "center",

            zIndex: 999999,
          }}
        >
          <div
            style={{
              width: 700,

              maxWidth: "90vw",

              background:
                "white",

              borderRadius: 20,

              padding: 25,

              boxShadow:
                "0 20px 60px rgba(0,0,0,.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  margin: 0,
                }}
              >
                Te contactamos
              </h2>

              <button
                onClick={() =>
                  setMostrarContacto(
                    false
                  )
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  cursor: "pointer",
                  fontSize: 24,
                }}
              >
                ✕
              </button>
            </div>

            <input
              placeholder="Nombre completo *"
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                border:
                  "1px solid #ddd",
              }}
            />

            <input
              placeholder="Celular *"
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                border:
                  "1px solid #ddd",
              }}
            />

            <input
              placeholder="Email (opcional)"
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                border:
                  "1px solid #ddd",
              }}
            />

            <textarea
              defaultValue={`Hola, me interesa el siguiente lote: ${loteSeleccionado?.nombre}
            📐 Área: ${loteSeleccionado?.area}
            💰 Precio: ${loteSeleccionado?.precio}
            📌 Estado: ${loteSeleccionado?.estado}

            Quisiera más información.`}
              style={{
                width: "100%",
                height: 180,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                resize: "none",
              }}
            />
            <div
              style={{
                marginTop: 20,
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={aceptaDatos}
                  onChange={(e) =>
                    setAceptaDatos(
                      e.target.checked
                    )
                  }
                />

                <span>
                  He leído y acepto el{" "}

                  <span
                    onClick={() =>
                      setMostrarDatos(true)
                    }
                    style={{
                      color: "#1976d2",
                      textDecoration:
                        "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Tratamiento de Datos
                    Personales
                  </span>

                  {" "}*
                </span>

              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={aceptaComercial}
                  onChange={(e) =>
                    setAceptaComercial(
                      e.target.checked
                    )
                  }
                />

                <span>
                  He leído y acepto la{" "}

                  <span
                    onClick={() =>
                      setMostrarComercial(
                        true
                      )
                    }
                    style={{
                      color: "#1976d2",
                      textDecoration:
                        "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Política para envío de
                    Comunicaciones
                    Comerciales
                  </span>
                </span> 
                 
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                onClick={() =>
                  setMostrarContacto(
                    false
                  )
                }
                style={{
                  padding:
                    "12px 20px",
                  borderRadius: 12,
                  border:
                    "1px solid #ddd",
                  background:
                    "white",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                onClick={enviarWhatsApp}
                disabled={
                  !aceptaDatos ||
                  loteSeleccionado?.estado !== "DISPONIBLE"
                }
                style={{
                  padding: "12px 20px",

                  borderRadius: 12,

                  border: "none",

                  background:
                    loteSeleccionado?.estado === "DISPONIBLE"
                      ? "#7EA84D"
                      : "#e5e7eb",

                  color:
                    loteSeleccionado?.estado === "DISPONIBLE"
                      ? "#17351F"
                      : "#777",

                  fontWeight: 700,

                  opacity:
                    aceptaDatos &&
                    loteSeleccionado?.estado === "DISPONIBLE"
                      ? 1
                      : 0.55,

                  cursor:
                    aceptaDatos &&
                    loteSeleccionado?.estado === "DISPONIBLE"
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                {loteSeleccionado?.estado === "DISPONIBLE"
                  ? "📨 Solicitar asesoría"
                  : loteSeleccionado?.estado === "SEPARADO"
                  ? "Lote separado"
                  : "Lote vendido"}
              </button>
            </div>      
          </div>
        </div>
      )}

    {mostrarDatos && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "rgba(0,0,0,.45)",

          display: "flex",

          justifyContent:
            "center",

          alignItems:
            "center",

          zIndex: 9999999,
        }}
      >
        <div
          style={{
           width: 700,

           maxWidth: "92vw",

           maxHeight: "80vh",

           overflowY: "auto",

           background: "white",

           borderRadius: 24,

           padding: 35,

           boxShadow:
            "0 25px 70px rgba(0,0,0,.25)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: 25,
              paddingBottom: 12,
              borderBottom:
                "2px solid rgba(0,0,0,.08)",
              color: "#1f2937",
              fontWeight: 700,
            }}
          >
            Tratamiento de Datos Personales
          </h2>

          <p>
            Los datos personales
            proporcionados serán
            utilizados únicamente
            para atender su
            solicitud de información,
            realizar el seguimiento
            de su consulta y
            brindarle información
            relacionada con nuestros
            servicios y proyectos
            inmobiliarios.
          </p>

          <p>
            Sus datos serán tratados
            de forma confidencial y
            no serán compartidos con
            terceros sin su
            autorización, salvo
            obligación legal.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 30,
            }}
          >
            <button
              onClick={() =>
                setMostrarDatos(false)
              }
              style={{
                border: "none",

                background:
                  "#7EA84D",

                color: "#111",

                fontWeight: 700,

                fontSize: 16,

                padding:
                  "14px 40px",

                borderRadius: 14,

                cursor: "pointer",

                boxShadow:
                  "0 8px 25px rgba(126,168,77,.30)",
              }}
            >
              ✓ Aceptar
            </button>
          </div>
        </div>
      </div>
    )}
    {mostrarComercial && (
      <div
        style={{
          position: "fixed",
          inset: 0,

          background:
            "rgba(0,0,0,.45)",

          display: "flex",

          justifyContent:
            "center",

          alignItems:
            "center",

          zIndex: 9999999,
        }}
      >
        <div
          style={{
            width: 700,

            maxWidth: "92vw",

            maxHeight: "80vh",

            overflowY: "auto",

            background: "white",

            borderRadius: 24,

            padding: 35,

            boxShadow:
              "0 25px 70px rgba(0,0,0,.25)",
          }}
        >
          <h2
            style={{
              textAlign: "center",

              marginBottom: 25,

              paddingBottom: 12,

              borderBottom:
                "2px solid rgba(0,0,0,.08)",

              color: "#1f2937",

              fontWeight: 700,
            }}
          >
            Política para envío de
            Comunicaciones Comerciales
          </h2>

          <p>
            Al aceptar esta autorización,
            usted permite el envío de
            información comercial,
            promociones, novedades,
              campañas y proyectos
            relacionados con nuestros
            servicios inmobiliarios,
            arquitectura e ingeniería.
          </p>

          <p>
            Las comunicaciones podrán
            realizarse mediante correo
            electrónico, llamadas
            telefónicas o WhatsApp.
          </p>

          <p>
            Esta autorización es
            voluntaria y podrá ser
            revocada en cualquier
            momento.
          </p>

          <div
            style={{
              display: "flex",

              justifyContent:
                "center",

              marginTop: 30,
            }}
          >
            <button
              onClick={() =>
                setMostrarComercial(
                  false
                )
              }
              style={{
                border: "none",

                background:
                  "#7EA84D",

                color: "#111",

                fontWeight: 700,

                fontSize: 16,

                padding:
                  "14px 40px",

                borderRadius: 14,

                cursor: "pointer",

                boxShadow:
                  "0 8px 25px rgba(126,168,77,.30)",
              }}
            >
              ✓ Aceptar
            </button>
          </div>
        </div>
      </div>
    )}

  </main>
  );
}

const boton: React.CSSProperties = {
  width: 35,
  height: 35,
  border: "none",
  borderRadius: 12,
  background: "rgba(119, 114, 114, 0.85)",
  cursor: "pointer",
  fontSize: 20,
  fontWeight: "bold",
  color: "#ffffff",  
  boxShadow:
    "0 6px 20px rgba(0,0,0,0.25)",
};

const th: React.CSSProperties = {
  padding: "12px 14px",

  textAlign: "left",

  fontSize: 14,

  fontWeight: 600,

  letterSpacing: ".4px",

  color: "#4a6b2f",

  background: "#fdf6e3",

  position: "sticky",

  top: 92.7,

  zIndex: 1000,

  boxShadow:
    "0 2px 6px rgba(0,0,0,.05)",
};

const td: React.CSSProperties = {
  padding: "10px 14px",

  fontSize: 17,
};
const inputBuscador: React.CSSProperties = {
  width: "100%",
  height: 42,
  boxSizing: "border-box",
  paddingLeft: 52,
  paddingRight: 16,
  borderRadius: 16,
  border: "1px solid #d8d8d8",
  fontSize: 16,
  outline: "none",
};

const bloqueFiltro: React.CSSProperties = {
  minWidth: 0,
  paddingRight: 24,
  borderRight: "1px solid #e8e8e8",
};

const bloqueEstado: React.CSSProperties = {
  minWidth: 0,
};

const tituloFiltro: React.CSSProperties = {
  marginBottom: 8,
  textAlign: "center",
  fontSize: 14,
  fontWeight: 700,
  color: "#476f34",
};

const grupoRango: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const inputFiltro: React.CSSProperties = {
  width: 0,
  flex: 1,
  minWidth: 0,
  height: 42,
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid #d8d8d8",
  padding: "0 12px",
  fontSize: 15,
  outline: "none",
  textAlign: "center",
};

const separadorRango: React.CSSProperties = {
  fontWeight: 700,
  color: "#777",
  fontSize: 18,
};

const inputSelect: React.CSSProperties = {
  width: "100%",
  height: 42,
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid #d8d8d8",
  padding: "0 12px",
  fontSize: 15,
  fontWeight: 700,
  background: "white",
  cursor: "pointer",
  textAlign: "center",
  textAlignLast: "center",
};

const botonLimpiar: React.CSSProperties = {
  width: "100%",
  height: 42,
  borderRadius: 12,

  border: "1px solid #9fb783",

  background:
    "linear-gradient(180deg,#ffffff,#edf5df)",

  color: "#476f34",

  fontSize: 15,

  fontWeight: 800,

  letterSpacing: ".2px",

  cursor: "pointer",

  boxShadow:
    "0 4px 12px rgba(71,111,52,.12)",

  transition: "all .2s ease",
};
