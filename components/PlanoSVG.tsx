"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type LotePlano = {
  id: number;
  mz: string;
  lote: number;
  area: number;
  precio: number;
  estado: string;
  svg_id: string;
};

type LoteSeleccionado = {
  id: number;
  nombre: string;
  area: string;
  precio: string;
  estado: string;
};

type Props = {
  lotes: LotePlano[];
  loteUbicado: LotePlano | null;
  setLoteSeleccionado: (lote: LoteSeleccionado) => void;
  seleccionActivaId?: number | null;
  mostrarArea?: boolean;
  mostrarPrecio?: boolean;
  modoNoche?: boolean;
};

const PLANO_WIDTH = "998.637px";
const PLANO_HEIGHT = "1393.841px";

let tooltip: HTMLDivElement | null = null;

const formatearDecimal = (
  valor: number | string
) =>
  Number(valor).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PlanoSVG({
  lotes,
  loteUbicado,
  setLoteSeleccionado,
  seleccionActivaId = null,
  mostrarArea = true,
  mostrarPrecio = true,
  modoNoche = false,
}: Props) {
  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElementRef = useRef<SVGSVGElement | null>(null);
  const limpiarSeleccionRef = useRef<() => void>(() => undefined);
  const seleccionActivaIdRef = useRef<number | null>(seleccionActivaId);
  const seleccionAnteriorRef = useRef<number | null>(seleccionActivaId);

  useEffect(() => {
    if (!lotes.length) return;

    let cancelado = false;

    fetch("/plano-lotes.svg")
      .then((res) => res.text())
      .then((svg) => {
        if (cancelado || !svgContainer.current) return;

        svgContainer.current.innerHTML = svg;

        const svgElement =
          svgContainer.current.querySelector("svg");

        if (!svgElement) return;

        svgElementRef.current = svgElement;
        svgElement.style.position = "absolute";
        svgElement.style.inset = "0";
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";
        svgElement.style.display = "block";
        svgElement.style.overflow = "visible";

        let capaResaltado =
          svgElement.querySelector(
            "#CAPA_RESALTADO"
          ) as SVGGElement | null;

        if (!capaResaltado) {
          capaResaltado =
            document.createElementNS(
              "http://www.w3.org/2000/svg",
              "g"
            );

          capaResaltado.id =
            "CAPA_RESALTADO";

          svgElement.appendChild(
            capaResaltado
          );
        }

        if (!tooltip) {
          tooltip = document.createElement("div");

          tooltip.style.position = "fixed";
          tooltip.style.display = "none";

          tooltip.style.backdropFilter =
            "blur(12px)";

          tooltip.style.padding =
            "4px 6px";

          tooltip.style.borderRadius =
            "8px";

          tooltip.style.border =
            "1px solid rgba(255,255,255,.35)";

          tooltip.style.boxShadow =
            "0 8px 30px rgba(0,0,0,.18)";

          tooltip.style.zIndex =
            "999999";

          tooltip.style.pointerEvents =
            "none";

          tooltip.style.fontFamily =
            "Arial";

          tooltip.style.minWidth =
            "70px";

          document.body.appendChild(
            tooltip
          );
        }

        tooltip.style.background = modoNoche
          ? "rgba(10,21,33,.90)"
          : "rgba(255,255,255,.82)";
        tooltip.style.color = modoNoche
          ? "#f3f7ef"
          : "#17211b";
        tooltip.style.borderColor = modoNoche
          ? "rgba(216,229,203,.28)"
          : "rgba(255,255,255,.72)";

        let loteActivo: SVGPathElement | null = null;
        let loteClon: SVGPathElement | null = null;
        let loteHoverClon: SVGPathElement | null = null;

        let inicioClickX = 0;
        let inicioClickY = 0;
        let huboArrastre = false;
        let botonPresionado = 0;

        const obtenerColorEstado = (
          estado: string
        ) => {
          const paleta = modoNoche
            ? {
                disponible: {
                  fill: "rgba(69,162,101,0.44)",
                  stroke: "#71D394",
                },
                separado: {
                  fill: "rgba(226,154,43,0.48)",
                  stroke: "#F2B84F",
                },
                negociacion: {
                  fill: "rgba(145,174,72,0.44)",
                  stroke: "#B5D46D",
                },
                bloqueado: {
                  fill: "rgba(125,139,158,0.43)",
                  stroke: "#AAB8CA",
                },
                vendido: {
                  fill: "rgba(211,78,66,0.48)",
                  stroke: "#F08075",
                },
              }
            : {
                disponible: {
                  fill: "rgba(44,119,70,0.40)",
                  stroke: "#267346",
                },
                separado: {
                  fill: "rgba(205,132,27,0.44)",
                  stroke: "#B96E08",
                },
                negociacion: {
                  fill: "rgba(111,142,58,0.40)",
                  stroke: "#58762D",
                },
                bloqueado: {
                  fill: "rgba(89,101,118,0.38)",
                  stroke: "#525E6F",
                },
                vendido: {
                  fill: "rgba(174,55,44,0.44)",
                  stroke: "#A33128",
                },
              };

          switch (estado?.toUpperCase()) {
            case "DISPONIBLE":
              return paleta.disponible;

            case "SEPARADO":
            case "RESERVADO":
            case "CIERRE_SOLICITADO":
              return paleta.separado;

            case "EN_NEGOCIACION":
              return paleta.negociacion;

            case "BLOQUEADO":
              return paleta.bloqueado;

            case "VENDIDO":
              return paleta.vendido;

            default:
              return paleta.disponible;
          }
        };

        const bordeBase = modoNoche
          ? "#CAD5C8"
          : "#9B8D82";

        // El SVG trae la rotulacion convertida a glifos <use>.
        // Se ajusta solo su pintura; la geometria y los IDs permanecen intactos.
        svgElement
          .querySelectorAll<SVGUseElement>('use[style*="#6c5353"]')
          .forEach((glifo) => {
            glifo.style.fill = modoNoche ? "#F1D5C9" : "#4C3431";
            glifo.style.stroke = modoNoche
              ? "rgba(16,20,22,0.92)"
              : "rgba(250,244,232,0.78)";
            glifo.style.strokeWidth = modoNoche ? "0.62" : "0.34";
            glifo.style.paintOrder = "stroke fill";
          });

        svgElement
          .querySelectorAll<SVGUseElement>('use[style*="#782121"]')
          .forEach((glifo) => {
            glifo.style.fill = modoNoche ? "#FF9A8F" : "#8C251F";
            glifo.style.stroke = modoNoche
              ? "rgba(20,18,17,0.68)"
              : "rgba(255,247,238,0.46)";
            glifo.style.strokeWidth = modoNoche ? "0.34" : "0.18";
            glifo.style.paintOrder = "stroke fill";
          });

        const restaurarLote = (
          path: SVGPathElement,
          lote: LotePlano
        ) => {
          const color =
            obtenerColorEstado(
              lote.estado
            );

          path.style.fill =
            color.fill;

          path.style.stroke =
            bordeBase;

          path.style.strokeWidth =
            "1.05";

          path.style.filter = "";
        };

        const limpiarHover = () => {
          if (loteHoverClon) {
            loteHoverClon.remove();
            loteHoverClon = null;
          }
        };

        const clonarEnCapaSuperior = (
          path: SVGPathElement
        ) => {
          const clon =
            path.cloneNode(true) as SVGPathElement;
          const matrizOrigen = path.getCTM();
          const matrizCapa = capaResaltado!.getCTM();

          clon.removeAttribute("id");

          const trazado = clon.getAttribute("d")?.trim();
          if (trazado && !/[zZ]\s*$/.test(trazado)) {
            clon.setAttribute("d", `${trazado} z`);
          }

          clon.style.strokeLinejoin = "round";
          clon.style.strokeLinecap = "round";

          if (matrizOrigen && matrizCapa) {
            const matrizRelativa = matrizCapa
              .inverse()
              .multiply(matrizOrigen);

            clon.removeAttribute("transform");
            clon.setAttribute(
              "transform",
              `matrix(${matrizRelativa.a} ${matrizRelativa.b} ${matrizRelativa.c} ${matrizRelativa.d} ${matrizRelativa.e} ${matrizRelativa.f})`
            );
          }

          return clon;
        };

        const limpiarSeleccion = () => {
          limpiarHover();

          if (loteClon) {
            loteClon.remove();
            loteClon = null;
          }

          if (loteActivo) {
            const loteAnterior = lotes.find(
              (lote) => lote.svg_id === loteActivo?.id
            );

            if (loteAnterior) {
              restaurarLote(loteActivo, loteAnterior);
            }
          }

          loteActivo = null;
          capaResaltado!.replaceChildren();
        };

        limpiarSeleccionRef.current = limpiarSeleccion;

        const resaltarHover = (
          path: SVGPathElement,
          stroke: string
        ) => {
          const parent = path.parentNode;

          if (!parent) return;

          limpiarHover();

          const clon = clonarEnCapaSuperior(path);
          clon.style.pointerEvents =
            "none";
          clon.style.fill = "none";
          clon.style.stroke = stroke;
          clon.style.strokeWidth = "2.4";
          clon.style.filter =
            "drop-shadow(0px 0px 3px rgba(0,0,0,.22))";

          clon.setAttribute(
            "vector-effect",
            "non-scaling-stroke"
          );

          capaResaltado!.appendChild(clon);
          loteHoverClon = clon;
        };

        lotes.forEach((lote) => {
          const path =
            svgElement.getElementById(
              lote.svg_id
            ) as SVGPathElement | null;

          if (!path) return;

          const color =
            obtenerColorEstado(
              lote.estado
            );

          path.style.cursor =
            "pointer";

          path.style.pointerEvents =
            "all";

          path.style.fill =
            color.fill;

          path.style.stroke =
            bordeBase;

          path.style.strokeWidth =
            "1.05";

          path.style.transition =
            "fill 0.15s ease, stroke 0.15s ease";

          path.onmousedown = (
            e: MouseEvent
          ) => {
            inicioClickX = e.clientX;
            inicioClickY = e.clientY;
            huboArrastre = false;
            botonPresionado = e.button;
          };

          path.onmouseover = () => {
            if (window.innerWidth <= 768) {
              return;
            }

            if (!tooltip) return;

            const estadoColor =
              obtenerColorEstado(
                lote.estado
              ).stroke;

            const detalleArea = mostrarArea
              ? `<div>${formatearDecimal(lote.area)} m2</div>`
              : "";
            const detallePrecio = mostrarPrecio
              ? `<div>S/ ${formatearDecimal(lote.precio)}</div>`
              : "";

            tooltip.innerHTML = `
            <div
              style="
              font-size:18px;
              font-weight:600;
              margin-bottom:6px;
              "
            >
              ${lote.mz}-${lote.lote}
            </div>

            ${detalleArea}
            ${detallePrecio}

            <div
              style="
              margin-top:8px;
              color:${estadoColor};
              font-weight:700;
              "
            >
              ${lote.estado}
            </div>
          `;

            path.onmousemove = (
              e: MouseEvent
            ) => {
              const distanciaX =
                Math.abs(
                  e.clientX - inicioClickX
                );

              const distanciaY =
                Math.abs(
                  e.clientY - inicioClickY
                );

              if (
                distanciaX > 10 ||
                distanciaY > 10
              ) {
                huboArrastre = true;
              }

              if (window.innerWidth <= 768) {
                return;
              }
              if (!tooltip) return;

              tooltip.style.left =
                `${e.clientX + 18}px`;

              tooltip.style.top =
                `${e.clientY + 18}px`;
            };

            tooltip.style.display =
              "block";

            if (
              loteActivo === path
            ) {
              limpiarHover();
              return;
            }

            resaltarHover(
              path,
              estadoColor
            );

            path.style.stroke =
              estadoColor;

            path.style.strokeWidth =
              "2";
          };

          path.onmouseout = () => {

            if (tooltip) {
              tooltip.style.display =
                "none";
            }

            if (
              loteActivo === path
            )
              return;

            limpiarHover();

            restaurarLote(
              path,
              lote
            );
          };

          path.onclick = (
            e: MouseEvent
          ) => {
            e.stopPropagation();

            if (tooltip) {
              tooltip.style.display =
                "none";
            }

            if (
              huboArrastre ||
              botonPresionado !== 0
            ) {
              return;
            }

            limpiarHover();

            if (loteActivo !== path) {
              if (loteClon) {
                loteClon.remove();
                loteClon = null;
              }

              if (loteActivo) {
                const anterior =
                  lotes.find(
                    (l) =>
                      l.svg_id ===
                      loteActivo?.id
                  );

                if (anterior) {
                  restaurarLote(
                    loteActivo,
                    anterior
                  );
                }
              }

              loteActivo = path;

              const clon = clonarEnCapaSuperior(path);

              clon.style.pointerEvents =
                "none";

              clon.style.fill =
                color.fill;

              clon.style.stroke =
                color.stroke;

              clon.style.strokeWidth =
                "2";

              clon.setAttribute(
                "vector-effect",
                "non-scaling-stroke"
              );

              capaResaltado!.innerHTML = "";
              capaResaltado!.appendChild(clon);

              loteClon = clon;

              path.style.stroke =
                color.stroke;

              path.style.strokeWidth =
                "2.5";

              path.style.filter =
                `drop-shadow(0px 0px 4px ${color.stroke})`;
            }

            setLoteSeleccionado({
              id: lote.id,
              nombre: `MZ ${lote.mz} - LOTE ${lote.lote}`,
              area: `${formatearDecimal(
                lote.area
              )} m2`,
              precio: mostrarPrecio
                ? `S/ ${formatearDecimal(lote.precio)}`
                : "",
              estado: lote.estado,
            });
          };
        });

        const loteSeleccionadoActual = lotes.find(
          (lote) => lote.id === seleccionActivaIdRef.current
        );

        if (loteSeleccionadoActual) {
          const pathSeleccionado = svgElement.getElementById(
            loteSeleccionadoActual.svg_id
          ) as SVGPathElement | null;

          pathSeleccionado?.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
            })
          );
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelado = true;
    };
  }, [
    lotes,
    modoNoche,
    mostrarArea,
    mostrarPrecio,
    setLoteSeleccionado,
  ]);

  useEffect(() => {
    const seleccionAnterior = seleccionAnteriorRef.current;
    seleccionAnteriorRef.current = seleccionActivaId;
    seleccionActivaIdRef.current = seleccionActivaId;

    if (seleccionAnterior !== null && seleccionActivaId === null) {
      limpiarSeleccionRef.current();
    }
  }, [seleccionActivaId]);

  useEffect(() => {
    if (!loteUbicado) return;

    const timer = window.setTimeout(() => {
      const path =
        svgElementRef.current?.getElementById(
          loteUbicado.svg_id
        ) as SVGPathElement | null;

      if (path) {
        path.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loteUbicado]);

  return (
    <div
      style={{
        position: "relative",
        width: PLANO_WIDTH,
        height: PLANO_HEIGHT,
        background: modoNoche ? "#07111f" : "#ffffff",
      }}
    >
      <Image
        src="/plano-base.webp"
        alt="Plano Las Lomas"
        fill
        priority
        unoptimized
        draggable={false}
        style={{
          objectFit: "fill",
          userSelect: "none",
          pointerEvents: "none",
          filter: modoNoche
            ? "brightness(.52) saturate(.78) contrast(1.08)"
            : "none",
          transition: "filter .25s ease",
        }}
      />

      <div
        ref={svgContainer}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
