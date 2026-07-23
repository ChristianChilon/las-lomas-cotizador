"use client";

import type {
  GeoJSON as LeafletGeoJSON,
  LatLngBounds,
  Map as LeafletMap,
  PathOptions,
} from "leaflet";
import type { GeoJsonObject } from "geojson";
import { useEffect, useRef, useState } from "react";
import styles from "./MapaGeorreferenciado.module.css";

type LoteMapa = {
  id: number;
  mz: string;
  lote: number;
  area: number;
  precio: number;
  estado: string;
  svg_id: string;
};

type PropiedadesGeograficas = {
  kind: "lote" | "perimetro";
  svg_id?: string;
};

type ColeccionGeografica = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: PropiedadesGeograficas;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
  }>;
};

type Props = {
  lotes: LoteMapa[];
  seleccionActivaId?: number | null;
  modoNoche?: boolean;
  onSeleccionarLote: (lote: LoteMapa) => void;
  onVerEnPlano: (lote: LoteMapa) => void;
};

const CENTRO_PROYECTO: [number, number] = [
  -7.701578,
  -79.41193114804025,
];

const FONDO_PLANO = {
  ancho: 998.637,
  alto: 1393.841,
  superiorIzquierda: [-7.699663858003868, -79.41082514419111] as [
    number,
    number,
  ],
  superiorDerecha: [-7.701741489446807, -79.4096424977267] as [
    number,
    number,
  ],
  inferiorIzquierda: [-7.701310455344957, -79.41373214234923] as [
    number,
    number,
  ],
};

const ZOOM_ROTULOS = 19;

const formatearArea = (area: number) =>
  Number(area).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const contenidoRotulo = (lote: LoteMapa) =>
  `<strong>MZ ${lote.mz} · L${lote.lote}</strong><span>${formatearArea(lote.area)} m²</span>`;

const obtenerEstilo = (
  estado: string,
  seleccionado: boolean,
  modoNoche: boolean
): PathOptions => {
  const valor = estado.toUpperCase();
  const paleta = modoNoche
    ? {
        disponible: { fill: "#42a966", stroke: "#9be2ad" },
        separado: { fill: "#d8942c", stroke: "#ffd18a" },
        vendido: { fill: "#c95046", stroke: "#ffaaa2" },
      }
    : {
        disponible: { fill: "#2f8348", stroke: "#185d32" },
        separado: { fill: "#d38b24", stroke: "#9d5d0d" },
        vendido: { fill: "#af392f", stroke: "#7d221b" },
      };
  const color =
    valor === "VENDIDO"
      ? paleta.vendido
      : valor === "SEPARADO" ||
          valor === "RESERVADO" ||
          valor === "CIERRE_SOLICITADO" ||
          valor === "EN_NEGOCIACION"
        ? paleta.separado
        : paleta.disponible;

  return {
    color: seleccionado ? "#ffffff" : color.stroke,
    fillColor: color.fill,
    fillOpacity: seleccionado ? 0.82 : 0.56,
    opacity: 1,
    weight: seleccionado ? 3 : 1.2,
  };
};

export default function MapaGeorreferenciado({
  lotes,
  seleccionActivaId = null,
  modoNoche = false,
  onSeleccionarLote,
  onVerEnPlano,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const lotLayersRef = useRef<Map<string, LeafletGeoJSON>>(new Map());
  const perimeterLayerRef = useRef<LeafletGeoJSON | null>(null);
  const lotesRef = useRef(lotes);
  const seleccionarRef = useRef(onSeleccionarLote);
  const verEnPlanoRef = useRef(onVerEnPlano);
  const modoNocheRef = useRef(modoNoche);
  const seleccionIdRef = useRef(seleccionActivaId);
  const [cargandoMapa, setCargandoMapa] = useState(true);
  const [errorMapa, setErrorMapa] = useState("");

  useEffect(() => {
    lotesRef.current = lotes;
    modoNocheRef.current = modoNoche;
    seleccionIdRef.current = seleccionActivaId;
  }, [lotes, modoNoche, seleccionActivaId]);

  useEffect(() => {
    seleccionarRef.current = onSeleccionarLote;
    verEnPlanoRef.current = onVerEnPlano;
  }, [onSeleccionarLote, onVerEnPlano]);

  useEffect(() => {
    let activo = true;
    const capasLotes = lotLayersRef.current;

    const iniciar = async () => {
      if (!containerRef.current || mapRef.current) return;

      try {
        const [leafletModule, respuesta] = await Promise.all([
          import("leaflet"),
          fetch("/las-lomas-georef.json", { cache: "force-cache" }),
        ]);

        if (!respuesta.ok) {
          throw new Error("No se pudo cargar la geometria georreferenciada.");
        }

        const datos = (await respuesta.json()) as ColeccionGeografica;
        if (!activo || !containerRef.current) return;

        const L = leafletModule.default;
        const mapa = L.map(containerRef.current, {
          center: CENTRO_PROYECTO,
          zoom: 17,
          zoomControl: false,
          zoomSnap: 0.25,
          zoomDelta: 0.5,
          minZoom: 13,
          maxZoom: 22,
          preferCanvas: false,
        });
        mapRef.current = mapa;

        L.control.zoom({ position: "bottomleft" }).addTo(mapa);
        L.control.scale({
          position: "bottomleft",
          imperial: false,
          maxWidth: 110,
        }).addTo(mapa);

        const imagenSatelital = L.tileLayer(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Imagen: Esri, Vantor, Earthstar Geographics y comunidad GIS",
            maxNativeZoom: 17,
            maxZoom: 22,
          }
        );
        imagenSatelital.once("tileload", () => {
          if (activo) setCargandoMapa(false);
        });
        imagenSatelital.once("tileerror", () => {
          if (activo) {
            setCargandoMapa(false);
            setErrorMapa(
              "La imagen satelital no respondio. Los lotes siguen georreferenciados."
            );
          }
        });
        imagenSatelital.addTo(mapa);

        const paneFondo = mapa.createPane("fondo-plano-las-lomas");
        paneFondo.style.zIndex = "350";
        paneFondo.style.pointerEvents = "none";

        const fondoPlano = document.createElement("img");
        fondoPlano.src = "/plano-base.webp";
        fondoPlano.alt = "";
        fondoPlano.className = styles.planOverlay;
        fondoPlano.style.width = `${FONDO_PLANO.ancho}px`;
        fondoPlano.style.height = `${FONDO_PLANO.alto}px`;
        paneFondo.appendChild(fondoPlano);

        const ubicarFondoPlano = () => {
          const superiorIzquierda = mapa.latLngToLayerPoint(
            FONDO_PLANO.superiorIzquierda
          );
          const superiorDerecha = mapa.latLngToLayerPoint(
            FONDO_PLANO.superiorDerecha
          );
          const inferiorIzquierda = mapa.latLngToLayerPoint(
            FONDO_PLANO.inferiorIzquierda
          );

          const a =
            (superiorDerecha.x - superiorIzquierda.x) / FONDO_PLANO.ancho;
          const b =
            (superiorDerecha.y - superiorIzquierda.y) / FONDO_PLANO.ancho;
          const c =
            (inferiorIzquierda.x - superiorIzquierda.x) / FONDO_PLANO.alto;
          const d =
            (inferiorIzquierda.y - superiorIzquierda.y) / FONDO_PLANO.alto;

          fondoPlano.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${superiorIzquierda.x}, ${superiorIzquierda.y})`;
        };

        fondoPlano.addEventListener("load", ubicarFondoPlano, { once: true });
        mapa.on("zoomend moveend resize viewreset", ubicarFondoPlano);
        ubicarFondoPlano();

        const perimetro = datos.features.find(
          (feature) => feature.properties.kind === "perimetro"
        );
        if (!perimetro) throw new Error("El archivo no contiene el perimetro.");

        const capaPerimetro = L.geoJSON(perimetro as GeoJsonObject, {
          interactive: false,
          style: {
            color: "#ffffff",
            fillColor: "#315f37",
            fillOpacity: 0.08,
            opacity: 0.98,
            weight: 3,
            dashArray: "9 6",
          },
        }).addTo(mapa);
        perimeterLayerRef.current = capaPerimetro;
        boundsRef.current = capaPerimetro.getBounds();

        datos.features
          .filter(
            (feature) =>
              feature.properties.kind === "lote" &&
              Boolean(feature.properties.svg_id)
          )
          .forEach((feature) => {
            const svgId = String(feature.properties.svg_id);
            const loteActual = lotesRef.current.find(
              (lote) => lote.svg_id === svgId
            );
            const capa = L.geoJSON(feature as GeoJsonObject, {
              style: obtenerEstilo(
                loteActual?.estado || "DISPONIBLE",
                loteActual?.id === seleccionIdRef.current,
                modoNocheRef.current
              ),
            }).addTo(mapa);

            if (loteActual) {
              capa.eachLayer((layer) => {
                layer.bindTooltip(contenidoRotulo(loteActual), {
                  permanent: true,
                  direction: "center",
                  className: styles.lotLabel,
                  opacity: 1,
                });

                if (mapa.getZoom() < ZOOM_ROTULOS) {
                  layer.closeTooltip();
                }
              });
            }

            capa.on("mouseover", () => {
              const lote = lotesRef.current.find(
                (actual) => actual.svg_id === svgId
              );
              if (!lote) return;

              capa.setStyle({
                ...obtenerEstilo(
                  lote.estado,
                  lote.id === seleccionIdRef.current,
                  modoNocheRef.current
                ),
                fillOpacity: 0.82,
                weight: 2.4,
              });
              capa.eachLayer((layer) => layer.openTooltip());
            });
            capa.on("mouseout", () => {
              const lote = lotesRef.current.find(
                (actual) => actual.svg_id === svgId
              );
              if (!lote) return;

              if (mapa.getZoom() < ZOOM_ROTULOS) {
                capa.eachLayer((layer) => layer.closeTooltip());
              }
              capa.setStyle(
                obtenerEstilo(
                  lote.estado,
                  lote.id === seleccionIdRef.current,
                  modoNocheRef.current
                )
              );
            });
            capa.on("click", (event) => {
              const lote = lotesRef.current.find(
                (actual) => actual.svg_id === svgId
              );
              if (!lote) return;

              seleccionarRef.current(lote);

              const contenido = document.createElement("div");
              contenido.className = styles.popupContent;

              const titulo = document.createElement("strong");
              titulo.textContent = `MZ ${lote.mz} - LOTE ${lote.lote}`;

              const area = document.createElement("span");
              area.textContent = `${formatearArea(lote.area)} m²`;

              const estado = document.createElement("span");
              estado.className = styles.popupStatus;
              estado.textContent = lote.estado;

              const boton = document.createElement("button");
              boton.type = "button";
              boton.className = styles.popupButton;
              boton.textContent = "Ver en el plano interactivo";
              boton.addEventListener("click", () =>
                verEnPlanoRef.current(lote)
              );

              contenido.append(titulo, area, estado, boton);
              L.popup({
                closeButton: true,
                maxWidth: 260,
                offset: [0, -4],
              })
                .setLatLng(event.latlng)
                .setContent(contenido)
                .openOn(mapa);
            });

            capasLotes.set(svgId, capa);
          });

        const actualizarRotulos = () => {
          const mostrar = mapa.getZoom() >= ZOOM_ROTULOS;
          capasLotes.forEach((capa) => {
            capa.eachLayer((layer) =>
              mostrar ? layer.openTooltip() : layer.closeTooltip()
            );
          });
        };
        mapa.on("zoomend", actualizarRotulos);

        if (boundsRef.current?.isValid()) {
          mapa.fitBounds(boundsRef.current, {
            padding: [32, 32],
            maxZoom: 18.5,
          });
        }
        actualizarRotulos();
        capaPerimetro.bringToFront();
        window.setTimeout(() => mapa.invalidateSize({ pan: false }), 120);
      } catch (error) {
        console.error(error);
        if (activo) {
          setCargandoMapa(false);
          setErrorMapa("No pudimos iniciar el mapa georreferenciado.");
        }
      }
    };

    void iniciar();

    return () => {
      activo = false;
      capasLotes.clear();
      perimeterLayerRef.current = null;
      boundsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loteSeleccionado = lotes.find(
      (lote) => lote.id === seleccionActivaId
    );

    lotLayersRef.current.forEach((capa, svgId) => {
      const lote = lotes.find((actual) => actual.svg_id === svgId);
      if (!lote) return;

      const seleccionado = lote.id === seleccionActivaId;
      capa.setStyle(obtenerEstilo(lote.estado, seleccionado, modoNoche));
      capa.eachLayer((layer) => {
        if (layer.getTooltip()) {
          layer.setTooltipContent(contenidoRotulo(lote));
        } else {
          layer.bindTooltip(contenidoRotulo(lote), {
            permanent: true,
            direction: "center",
            className: styles.lotLabel,
            opacity: 1,
          });
        }

        if ((mapRef.current?.getZoom() || 0) >= ZOOM_ROTULOS) {
          layer.openTooltip();
        } else {
          layer.closeTooltip();
        }
      });

      if (seleccionado) {
        capa.bringToFront();
      }
    });

    perimeterLayerRef.current?.bringToFront();

    if (loteSeleccionado) {
      const capa = lotLayersRef.current.get(loteSeleccionado.svg_id);
      const limites = capa?.getBounds();

      if (limites?.isValid()) {
        mapRef.current?.flyToBounds(limites, {
          padding: [90, 90],
          maxZoom: 20,
          duration: 0.65,
        });
      }
    }
  }, [lotes, modoNoche, seleccionActivaId]);

  const encuadrarProyecto = () => {
    if (!mapRef.current || !boundsRef.current?.isValid()) return;

    mapRef.current.fitBounds(boundsRef.current, {
      padding: [32, 32],
      maxZoom: 18.5,
    });
  };

  const verEntorno = () => {
    mapRef.current?.flyTo(CENTRO_PROYECTO, 14.5, {
      duration: 0.8,
    });
  };

  return (
    <div className={styles.shell}>
      <div
        ref={containerRef}
        className={styles.map}
        aria-label="Mapa satelital interactivo con el perimetro y los 213 lotes"
      />

      {cargandoMapa && (
        <div className={styles.loading}>Cargando imagen satelital...</div>
      )}
      {errorMapa && (
        <div className={styles.error} role="alert">
          {errorMapa}
        </div>
      )}

      <div className={styles.mapActions}>
        <button type="button" onClick={encuadrarProyecto}>
          Proyecto
        </button>
        <button type="button" onClick={verEntorno}>
          Ver entorno
        </button>
      </div>

      <div className={styles.legend} aria-label="Estados de lotes">
        <span><i className={styles.available} />Disponible</span>
        <span><i className={styles.reserved} />Separado</span>
        <span><i className={styles.sold} />Vendido</span>
      </div>
    </div>
  );
}
