"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Map,
  Satellite,
  Table2,
  Tag,
  UserRound,
  WalletCards,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import MapaGeorreferenciado from "../../components/MapaGeorreferenciado";
import PlanoSVG from "../../components/PlanoSVG";
import {
  calcularEscalaEncuadre,
  esPantallaTactil,
} from "../../lib/planoViewport";
import {
  calcularEscalaMinimaPlano,
  DURACION_BOTON_PLANO,
  PASO_BOTON_PLANO,
  PASO_PINZA_PLANO,
  PASO_RUEDA_PLANO,
} from "../../lib/planoZoom";
import { supabase } from "../../lib/supabase";
import styles from "./disponibilidad.module.css";

type LotePublico = {
  id: number;
  mz: string;
  lote: number;
  area: number;
  precio: number;
  estado: string;
  svg_id: string;
};

type RegistroPublico = {
  id: number | string;
  mz: string | null;
  lote: number | string;
  area: number | string;
  estado: string | null;
  svg_id: string | null;
};

type LoteSeleccionado = {
  id: number;
  nombre: string;
  area: string;
  precio: string;
  estado: string;
};

type EstadoEnvio = "LISTO" | "ENVIANDO" | "ENVIADO" | "ERROR";
type VistaPublica = "mapa" | "tabla" | "ubicacion";
type CampoOrden = "mz" | "lote" | "area" | "estado";

const BROCHURE_URL = "/brochure-las-lomas-web.pdf";
const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/2JP1uF2zUReByyYM7";

const normalizarEstado = (estado: string | null) => {
  const valor = (estado || "DISPONIBLE").trim().toUpperCase();

  if (["RESERVADO", "CIERRE_SOLICITADO"].includes(valor)) {
    return "SEPARADO";
  }

  if (valor === "EN_NEGOCIACION") return "SEPARADO";

  return valor;
};

const normalizarLotes = (registros: RegistroPublico[]): LotePublico[] =>
  registros
    .filter((registro) => Boolean(registro.svg_id))
    .map((registro) => ({
      id: Number(registro.id),
      mz: String(registro.mz || ""),
      lote: Number(registro.lote),
      area: Number(registro.area),
      precio: 0,
      estado: normalizarEstado(registro.estado),
      svg_id: String(registro.svg_id),
    }));

const estadoClase = (estado: string) => {
  if (estado === "VENDIDO") return styles.statusSold;
  if (estado === "SEPARADO") return styles.statusReserved;

  return styles.statusAvailable;
};

const convertirLoteSeleccionado = (lote: LotePublico): LoteSeleccionado => ({
  id: lote.id,
  nombre: `MZ ${lote.mz} - LOTE ${lote.lote}`,
  area: `${Number(lote.area).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m2`,
  precio: "",
  estado: lote.estado,
});

export default function DisponibilidadPage() {
  const [lotes, setLotes] = useState<LotePublico[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] =
    useState<LoteSeleccionado | null>(null);
  const [loteUbicado, setLoteUbicado] = useState<LotePublico | null>(null);
  const [vista, setVista] = useState<VistaPublica>("mapa");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [campoOrden, setCampoOrden] = useState<CampoOrden>("mz");
  const [direccionOrden, setDireccionOrden] =
    useState<"asc" | "desc">("asc");
  const [escalaInicial, setEscalaInicial] = useState(0.5);
  const [esMovil, setEsMovil] = useState(false);
  const [modoNoche, setModoNoche] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");
  const [website, setWebsite] = useState("");
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [aceptaComercial, setAceptaComercial] = useState(false);
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>("LISTO");
  const [errorEnvio, setErrorEnvio] = useState("");

  useEffect(() => {
    const actualizarEncuadre = () => {
      const movil = esPantallaTactil(window.innerWidth);
      const altoCabecera = movil ? 124 : 84;

      setEsMovil(movil);
      setEscalaInicial(
        calcularEscalaEncuadre(
          window.innerWidth,
          Math.max(320, window.innerHeight - altoCabecera)
        )
      );
    };

    actualizarEncuadre();
    window.addEventListener("resize", actualizarEncuadre);

    return () => window.removeEventListener("resize", actualizarEncuadre);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preferencia = window.localStorage.getItem("las-lomas-theme");
      const sistemaOscuro = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      setModoNoche(
        preferencia === "noche" || (!preferencia && sistemaOscuro)
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let activo = true;

    const cargarRespaldo = async () => {
      const respuesta = await fetch("/lotes.json", { cache: "no-store" });

      if (!respuesta.ok) throw new Error("No se pudo cargar el plano.");

      return normalizarLotes((await respuesta.json()) as RegistroPublico[]);
    };

    const cargarSupabase = async () => {
      if (!supabase) return null;
      const clienteSupabase = supabase;

      const consulta = async () => {
        const resultadoRpc = await clienteSupabase.rpc(
          "crm_obtener_lotes_publicos"
        );

        if (!resultadoRpc.error && resultadoRpc.data) {
          return resultadoRpc.data as unknown as RegistroPublico[];
        }

        const resultadoTemporal = await clienteSupabase
          .from("las_lomas_lotes")
          .select("id,mz,lote,area,estado,svg_id")
          .order("id", { ascending: true });

        if (resultadoTemporal.error) throw resultadoTemporal.error;

        return (resultadoTemporal.data || []) as RegistroPublico[];
      };

      return Promise.race([
        consulta(),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Supabase no respondio a tiempo.")),
            6_000
          );
        }),
      ]);
    };

    const cargar = async (silencioso = false) => {
      if (!silencioso) setCargando(true);

      try {
        const registros = await cargarSupabase();

        const nuevosLotes = registros?.length
          ? normalizarLotes(registros)
          : await cargarRespaldo();

        if (activo) {
          setLotes(nuevosLotes);
          setErrorCarga("");
        }
      } catch (error) {
        console.error(error);

        try {
          const respaldo = await cargarRespaldo();

          if (activo) {
            setLotes(respaldo);
            setErrorCarga("");
          }
        } catch (errorRespaldo) {
          console.error(errorRespaldo);

          if (activo) {
            setErrorCarga(
              "No pudimos actualizar la disponibilidad. Intenta nuevamente."
            );
          }
        }
      } finally {
        if (activo && !silencioso) setCargando(false);
      }
    };

    void cargar();
    const intervalo = window.setInterval(() => void cargar(true), 20_000);
    const canal = supabase
      ?.channel("visor_publico_lotes_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "las_lomas_lotes",
        },
        () => void cargar(true)
      )
      .subscribe();

    return () => {
      activo = false;
      window.clearInterval(intervalo);

      if (canal && supabase) {
        void supabase.removeChannel(canal);
      }
    };
  }, []);

  const resumen = useMemo(
    () => ({
      disponibles: lotes.filter((lote) => lote.estado === "DISPONIBLE").length,
      separados: lotes.filter((lote) => lote.estado === "SEPARADO").length,
      vendidos: lotes.filter((lote) => lote.estado === "VENDIDO").length,
    }),
    [lotes]
  );

  const lotesFiltrados = useMemo(() => {
    const texto = busqueda
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, "")
      .replace(/^([a-z])0+/i, "$1");

    return [...lotes]
      .filter(
        (lote) =>
          filtroEstado === "TODOS" || lote.estado === filtroEstado
      )
      .filter((lote) => {
        if (!texto) return true;

        const codigo = `${lote.mz}${Number(lote.lote)}`
          .toLowerCase()
          .replace(/[-\s]/g, "");

        return codigo === texto || lote.mz.toLowerCase() === texto;
      })
      .sort((primero, segundo) => {
        const valorPrimero = primero[campoOrden];
        const valorSegundo = segundo[campoOrden];
        const comparacion =
          typeof valorPrimero === "string" && typeof valorSegundo === "string"
            ? valorPrimero.localeCompare(valorSegundo, "es", {
                numeric: true,
                sensitivity: "base",
              })
            : Number(valorPrimero) - Number(valorSegundo);

        return direccionOrden === "asc" ? comparacion : -comparacion;
      });
  }, [busqueda, campoOrden, direccionOrden, filtroEstado, lotes]);

  const ordenarPor = (campo: CampoOrden) => {
    if (campo === campoOrden) {
      setDireccionOrden((actual) => (actual === "asc" ? "desc" : "asc"));
      return;
    }

    setCampoOrden(campo);
    setDireccionOrden("asc");
  };

  const alternarModoNoche = () => {
    setModoNoche((actual) => {
      const siguiente = !actual;
      window.localStorage.setItem(
        "las-lomas-theme",
        siguiente ? "noche" : "dia"
      );
      return siguiente;
    });
  };

  const abrirFormulario = () => {
    if (!loteSeleccionado || loteSeleccionado.estado !== "DISPONIBLE") return;

    setNombre("");
    setCelular("");
    setCorreo("");
    setWebsite("");
    setAceptaDatos(false);
    setAceptaComercial(false);
    setEstadoEnvio("LISTO");
    setErrorEnvio("");
    setMostrarFormulario(true);
  };

  const enviarSolicitud = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loteSeleccionado || estadoEnvio === "ENVIANDO") return;

    const celularNormalizado = celular.replace(/\D/g, "").replace(/^51/, "");

    if (nombre.trim().length < 3) {
      setErrorEnvio("Ingresa tu nombre completo.");
      setEstadoEnvio("ERROR");
      return;
    }

    if (!/^9\d{8}$/.test(celularNormalizado)) {
      setErrorEnvio("Ingresa un celular peruano valido de 9 digitos.");
      setEstadoEnvio("ERROR");
      return;
    }

    if (!aceptaDatos) {
      setErrorEnvio("Debes aceptar el tratamiento de datos personales.");
      setEstadoEnvio("ERROR");
      return;
    }

    setEstadoEnvio("ENVIANDO");
    setErrorEnvio("");

    try {
      const respuesta = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreCompleto: nombre.trim(),
          celular: celularNormalizado,
          correo: correo.trim() || null,
          loteId: loteSeleccionado.id,
          mensaje: `Solicitud de cotizacion personalizada desde el plano publico. ${loteSeleccionado.nombre}, area ${loteSeleccionado.area}.`,
          aceptaDatos: true,
          aceptaComercial,
          website,
        }),
      });
      const resultado = (await respuesta.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!respuesta.ok) {
        throw new Error(resultado.error || "No pudimos registrar tu solicitud.");
      }

      setEstadoEnvio("ENVIADO");
    } catch (error) {
      setErrorEnvio(
        error instanceof Error
          ? error.message
          : "No pudimos registrar tu solicitud."
      );
      setEstadoEnvio("ERROR");
    }
  };

  const abrirWhatsApp = () => {
    if (!loteSeleccionado) return;

    const mensaje = `Hola, soy ${nombre.trim()}. Solicite una cotizacion personalizada para ${loteSeleccionado.nombre} (${loteSeleccionado.area}).`;
    window.open(
      `https://wa.me/51933008638?text=${encodeURIComponent(mensaje)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const activarPantallaCompleta = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Algunos navegadores moviles no ofrecen Fullscreen API.
    }
  };

  return (
    <main
      className={`${styles.page} ${modoNoche ? styles.night : ""}`}
    >
      <header className={styles.header}>
        <Image
          src="/las-lomas-logo.png"
          alt="Las Lomas de Malabrigo"
          width={4762}
          height={3270}
          priority
          className={styles.logo}
        />

        <div className={styles.projectInfo}>
          <strong>Las Lomas de Malabrigo</strong>
          <span>Razuri, Ascope - La Libertad</span>
        </div>

        <div className={styles.references} aria-label="Referencias comerciales">
          <span>
            <Tag aria-hidden="true" />
            <span><small>LOTES DESDE</small><strong>S/24,000</strong></span>
          </span>
          <span>
            <WalletCards aria-hidden="true" />
            <span><small>INICIAL DESDE</small><strong>S/6,000</strong></span>
          </span>
          <span>
            <CalendarDays aria-hidden="true" />
            <span><small>CUOTAS DESDE</small><strong>S/600</strong></span>
          </span>
          <span className={styles.brochureReference}>
            <FileText aria-hidden="true" />
            <a
              href={BROCHURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir brochure de Las Lomas en PDF"
            >
              <strong>VER PDF</strong>
              <small>Brochure</small>
            </a>
          </span>
        </div>

        <div className={styles.headerActions}>
          <Link
            href="/login"
            className={styles.crmLink}
            aria-label="Ingresar al CRM de asesores"
            title="Ingresar al CRM de asesores"
          >
            <UserRound aria-hidden="true" />
            LOGIN
          </Link>
          <button
            type="button"
            className={styles.themeButton}
            onClick={alternarModoNoche}
            aria-label={modoNoche ? "Activar modo dia" : "Activar modo noche"}
            title={modoNoche ? "Modo dia" : "Modo noche"}
          >
            {modoNoche ? "\u2600" : "\u263E"}
          </button>
        </div>
      </header>

      <section className={styles.mapStage} aria-label="Plano de disponibilidad">
        {cargando && (
          <div className={styles.loading}>Actualizando disponibilidad...</div>
        )}
        {errorCarga && (
          <div className={styles.loadError} role="alert">{errorCarga}</div>
        )}

        <nav className={styles.viewSwitcher} aria-label="Vistas de disponibilidad">
          {(
            [
              ["mapa", "Plano", Map],
              ["ubicacion", "Satélite", Satellite],
              ["tabla", "Tabla", Table2],
            ] as const
          ).map(([vistaId, etiqueta, Icono]) => (
            <button
              key={vistaId}
              type="button"
              className={vista === vistaId ? styles.viewActive : ""}
              onClick={() => setVista(vistaId)}
              aria-pressed={vista === vistaId}
            >
              <Icono aria-hidden="true" />
              <span>{etiqueta}</span>
            </button>
          ))}
        </nav>

        <div className={styles.transformRoot}>
          <TransformWrapper
            key={`${esMovil ? "movil" : "desktop"}-${escalaInicial.toFixed(3)}`}
            initialScale={escalaInicial}
            minScale={calcularEscalaMinimaPlano(escalaInicial)}
            maxScale={12}
            centerOnInit
            limitToBounds={false}
            wheel={{ step: PASO_RUEDA_PLANO }}
            pinch={{ step: PASO_PINZA_PLANO }}
            doubleClick={{ disabled: true }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform, zoomToElement }) => {
              const abrirLoteEnMapa = (lote: LotePublico) => {
                setLoteSeleccionado(convertirLoteSeleccionado(lote));
                setLoteUbicado({ ...lote });
                setVista("mapa");

                window.setTimeout(() => {
                  zoomToElement(lote.svg_id, 3, 700);
                }, 500);
              };

              return (
                <>
                  {vista === "mapa" && (
                    <>
                      <TransformComponent
                        wrapperStyle={{
                          width: "100%",
                          height: "100%",
                          cursor: "grab",
                        }}
                      >
                        <PlanoSVG
                          lotes={lotes}
                          loteUbicado={loteUbicado}
                          setLoteSeleccionado={setLoteSeleccionado}
                          seleccionActivaId={loteSeleccionado?.id ?? null}
                          mostrarArea
                          mostrarPrecio={false}
                          modoNoche={modoNoche}
                        />
                      </TransformComponent>

                      <div className={styles.mapControls}>
                        <button type="button" onClick={() => zoomIn(PASO_BOTON_PLANO, DURACION_BOTON_PLANO)} aria-label="Acercar">+</button>
                        <button type="button" onClick={() => zoomOut(PASO_BOTON_PLANO, DURACION_BOTON_PLANO)} aria-label="Alejar">-</button>
                        <button type="button" onClick={() => resetTransform()} aria-label="Encuadrar plano">Centrar</button>
                        <button type="button" onClick={activarPantallaCompleta} aria-label="Pantalla completa">Expandir</button>
                      </div>
                    </>
                  )}

                  {vista === "tabla" && (
                    <section className={styles.tableView} aria-label="Tabla publica de lotes">
                      <div className={styles.tableToolbar}>
                        <label>
                          <span>BUSCAR LOTE</span>
                          <input
                            type="search"
                            value={busqueda}
                            onChange={(event) => setBusqueda(event.target.value)}
                            placeholder="Ej. A-12"
                          />
                        </label>

                        <label>
                          <span>ESTADO</span>
                          <select
                            value={filtroEstado}
                            onChange={(event) => setFiltroEstado(event.target.value)}
                          >
                            <option value="TODOS">Todos</option>
                            <option value="DISPONIBLE">Disponibles</option>
                            <option value="SEPARADO">Separados</option>
                            <option value="VENDIDO">Vendidos</option>
                          </select>
                        </label>

                        <div className={styles.tableCount} aria-live="polite">
                          <strong>{lotesFiltrados.length}</strong>
                          <span>lotes encontrados</span>
                        </div>
                      </div>

                      <div className={styles.tableScroll}>
                        <table className={styles.lotsTable}>
                          <thead>
                            <tr>
                              {(
                                [
                                  ["mz", "MZ"],
                                  ["lote", "LOTE"],
                                  ["area", "AREA"],
                                  ["estado", "ESTADO"],
                                ] as const
                              ).map(([campo, etiqueta]) => (
                                <th key={campo}>
                                  <button type="button" onClick={() => ordenarPor(campo)}>
                                    {etiqueta}
                                    {campoOrden === campo && (
                                      <span aria-hidden="true">
                                        {direccionOrden === "asc" ? " ▲" : " ▼"}
                                      </span>
                                    )}
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lotesFiltrados.map((lote) => (
                              <tr
                                key={lote.id}
                                className={
                                  loteSeleccionado?.id === lote.id
                                    ? styles.selectedRow
                                    : ""
                                }
                                onClick={() => abrirLoteEnMapa(lote)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    abrirLoteEnMapa(lote);
                                  }
                                }}
                                tabIndex={0}
                                aria-label={`Ver MZ ${lote.mz}, lote ${lote.lote} en el mapa`}
                              >
                                <td>{lote.mz}</td>
                                <td>{lote.lote}</td>
                                <td>
                                  {Number(lote.area).toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  m2
                                </td>
                                <td>
                                  <span className={`${styles.tableStatus} ${estadoClase(lote.estado)}`}>
                                    {lote.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {lotesFiltrados.length === 0 && (
                          <div className={styles.emptyTable}>
                            No encontramos lotes con esos filtros.
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {vista === "ubicacion" && (
                    <section className={styles.locationView} aria-label="Ubicacion del proyecto">
                      <div className={styles.locationCopy}>
                        <small>LAS LOMAS DE MALABRIGO</small>
                        <h2>Explora el proyecto sobre el terreno</h2>
                        <p>
                          Recorre la vista satelital, consulta los 213 lotes y
                          revisa que hay alrededor del proyecto. Toca cualquier
                          lote para ver su estado y regresar a su posicion exacta
                          en el plano interactivo.
                        </p>
                        <div className={styles.locationSummary}>
                          <span>
                            <strong>{resumen.disponibles}</strong>
                            disponibles
                          </span>
                          <span>
                            <strong>{resumen.separados}</strong>
                            separados
                          </span>
                          <span>
                            <strong>{resumen.vendidos}</strong>
                            vendidos
                          </span>
                        </div>
                        <a
                          href={GOOGLE_MAPS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.mapsButton}
                        >
                          Como llegar en Google Maps
                        </a>
                        <span>
                          Perimetro y lotes georreferenciados desde el plano
                          tecnico. La visualizacion es informativa y no reemplaza
                          la documentacion registral o catastral.
                        </span>
                      </div>

                      <div className={styles.mapEmbed}>
                        <MapaGeorreferenciado
                          lotes={lotes}
                          seleccionActivaId={loteSeleccionado?.id ?? null}
                          modoNoche={modoNoche}
                          onSeleccionarLote={(lote) => {
                            setLoteSeleccionado(
                              convertirLoteSeleccionado(lote)
                            );
                            setLoteUbicado({ ...lote });
                          }}
                          onVerEnPlano={abrirLoteEnMapa}
                        />
                      </div>
                    </section>
                  )}
                </>
              );
            }}
          </TransformWrapper>
        </div>

        {vista === "mapa" && (
          <aside className={styles.legend} aria-label="Estados de lotes">
            <span><i className={styles.availableDot} />Disponibles <strong>{resumen.disponibles}</strong></span>
            <span><i className={styles.reservedDot} />Separados <strong>{resumen.separados}</strong></span>
            <span><i className={styles.soldDot} />Vendidos <strong>{resumen.vendidos}</strong></span>
          </aside>
        )}

        {vista === "mapa" && loteSeleccionado && (
          <aside className={styles.lotPanel} aria-live="polite">
            <button
              type="button"
              className={styles.closePanel}
              onClick={() => setLoteSeleccionado(null)}
              aria-label="Cerrar detalle"
            >
              x
            </button>
            <small>LOTE SELECCIONADO</small>
            <strong>{loteSeleccionado.nombre}</strong>
            <span>{loteSeleccionado.area}</span>
            <span className={`${styles.status} ${estadoClase(loteSeleccionado.estado)}`}>
              {loteSeleccionado.estado}
            </span>
            <p>
              Precio desde S/24,000. La propuesta final depende del lote y la modalidad de pago.
            </p>
            {loteSeleccionado.estado === "DISPONIBLE" && (
              <button
                type="button"
                className={styles.quoteButton}
                onClick={abrirFormulario}
              >
                Solicitar cotizacion de este lote
              </button>
            )}
          </aside>
        )}

        {vista === "mapa" && (
          <p className={styles.disclaimer}>
            Montos referenciales sujetos al lote, modalidad de pago y evaluacion comercial.
          </p>
        )}
      </section>

      {mostrarFormulario && loteSeleccionado && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.formDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-title"
          >
            <button
              type="button"
              className={styles.dialogClose}
              onClick={() => setMostrarFormulario(false)}
              disabled={estadoEnvio === "ENVIANDO"}
              aria-label="Cerrar formulario"
            >
              x
            </button>

            {estadoEnvio === "ENVIADO" ? (
              <div className={styles.successState}>
                <span className={styles.successMark}>OK</span>
                <h2 id="quote-title">Solicitud registrada</h2>
                <p>
                  Un asesor recibio tu interes por {loteSeleccionado.nombre} y continuara contigo la cotizacion personalizada.
                </p>
                <button type="button" onClick={abrirWhatsApp} className={styles.whatsappButton}>
                  Continuar por WhatsApp
                </button>
                <button type="button" onClick={() => setMostrarFormulario(false)} className={styles.secondaryButton}>
                  Volver al plano
                </button>
              </div>
            ) : (
              <>
                <div className={styles.dialogHeading}>
                  <small>COTIZACION PERSONALIZADA</small>
                  <h2 id="quote-title">{loteSeleccionado.nombre}</h2>
                  <p>{loteSeleccionado.area} - Disponible</p>
                </div>

                <form onSubmit={enviarSolicitud} className={styles.form}>
                  <label>
                    Nombre completo
                    <input value={nombre} onChange={(event) => setNombre(event.target.value)} autoComplete="name" required />
                  </label>
                  <label>
                    Celular
                    <input value={celular} onChange={(event) => setCelular(event.target.value)} inputMode="tel" autoComplete="tel" required />
                  </label>
                  <label>
                    Correo <span>(opcional)</span>
                    <input value={correo} onChange={(event) => setCorreo(event.target.value)} type="email" autoComplete="email" />
                  </label>
                  <label className={styles.honeypot} aria-hidden="true">
                    Sitio web
                    <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={aceptaDatos} onChange={(event) => setAceptaDatos(event.target.checked)} />
                    <span>
                      Acepto el <Link href="/politica-de-privacidad" target="_blank">tratamiento de datos personales</Link>.
                    </span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={aceptaComercial} onChange={(event) => setAceptaComercial(event.target.checked)} />
                    <span>Acepto recibir informacion comercial por WhatsApp.</span>
                  </label>

                  {errorEnvio && <div className={styles.formError}>{errorEnvio}</div>}

                  <button type="submit" className={styles.submitButton} disabled={estadoEnvio === "ENVIANDO"}>
                    {estadoEnvio === "ENVIANDO" ? "Registrando..." : "Solicitar cotizacion"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
