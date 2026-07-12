"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import PlanoSVG from "../../components/PlanoSVG";
import {
  calcularEscalaEncuadre,
  esPantallaTactil,
} from "../../lib/planoViewport";
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

export default function DisponibilidadPage() {
  const [lotes, setLotes] = useState<LotePublico[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] =
    useState<LoteSeleccionado | null>(null);
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

    const cargar = async (silencioso = false) => {
      if (!silencioso) setCargando(true);

      try {
        let registros: RegistroPublico[] | null = null;

        if (supabase) {
          const resultadoRpc = await supabase.rpc(
            "crm_obtener_lotes_publicos"
          );

          if (!resultadoRpc.error && resultadoRpc.data) {
            registros = resultadoRpc.data as unknown as RegistroPublico[];
          } else {
            const resultadoTemporal = await supabase
              .from("las_lomas_lotes")
              .select("id,mz,lote,area,estado,svg_id")
              .order("id", { ascending: true });

            if (!resultadoTemporal.error) {
              registros = (resultadoTemporal.data || []) as RegistroPublico[];
            }
          }
        }

        const nuevosLotes = registros?.length
          ? normalizarLotes(registros)
          : await cargarRespaldo();

        if (activo) {
          setLotes(nuevosLotes);
          setErrorCarga("");
        }
      } catch (error) {
        console.error(error);

        if (activo) {
          setErrorCarga(
            "No pudimos actualizar la disponibilidad. Intenta nuevamente."
          );
        }
      } finally {
        if (activo && !silencioso) setCargando(false);
      }
    };

    void cargar();
    const intervalo = window.setInterval(() => void cargar(true), 20_000);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
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
          <span><small>LOTES DESDE</small><strong>S/24,000</strong></span>
          <span><small>INICIAL DESDE</small><strong>S/6,000</strong></span>
          <span><small>CUOTAS DESDE</small><strong>S/600</strong></span>
        </div>

        <button
          type="button"
          className={styles.themeButton}
          onClick={alternarModoNoche}
          aria-label={modoNoche ? "Activar modo dia" : "Activar modo noche"}
          title={modoNoche ? "Modo dia" : "Modo noche"}
        >
          {modoNoche ? "☀" : "☾"}
        </button>
      </header>

      <section className={styles.mapStage} aria-label="Plano de disponibilidad">
        {cargando && (
          <div className={styles.loading}>Actualizando disponibilidad...</div>
        )}
        {errorCarga && (
          <div className={styles.loadError} role="alert">{errorCarga}</div>
        )}

        <div className={styles.transformRoot}>
          <TransformWrapper
            key={`${esMovil ? "movil" : "desktop"}-${escalaInicial.toFixed(3)}`}
            initialScale={escalaInicial}
            minScale={0.1}
            maxScale={40}
            centerOnInit
            limitToBounds={false}
            wheel={{ step: esMovil ? 0.04 : 0.01 }}
            pinch={{ step: esMovil ? 4 : 1 }}
            doubleClick={{ disabled: true }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
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
                    loteUbicado={null}
                    setLoteSeleccionado={setLoteSeleccionado}
                    mostrarArea
                    mostrarPrecio={false}
                    modoNoche={modoNoche}
                  />
                </TransformComponent>

                <div className={styles.mapControls}>
                  <button type="button" onClick={() => zoomIn(esMovil ? 0.35 : 0.2)} aria-label="Acercar">+</button>
                  <button type="button" onClick={() => zoomOut(esMovil ? 0.35 : 0.2)} aria-label="Alejar">-</button>
                  <button type="button" onClick={() => resetTransform()} aria-label="Encuadrar plano">Centrar</button>
                  <button type="button" onClick={activarPantallaCompleta} aria-label="Pantalla completa">Expandir</button>
                </div>
              </>
            )}
          </TransformWrapper>
        </div>

        <aside className={styles.legend} aria-label="Estados de lotes">
          <span><i className={styles.availableDot} />Disponibles <strong>{resumen.disponibles}</strong></span>
          <span><i className={styles.reservedDot} />Separados <strong>{resumen.separados}</strong></span>
          <span><i className={styles.soldDot} />Vendidos <strong>{resumen.vendidos}</strong></span>
        </aside>

        {loteSeleccionado && (
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

        <p className={styles.disclaimer}>
          Montos referenciales sujetos al lote, modalidad de pago y evaluacion comercial.
        </p>
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
