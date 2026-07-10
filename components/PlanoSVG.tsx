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
};

const PLANO_WIDTH = "999.809px";
const PLANO_HEIGHT = "1394.93px";

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
}: Props) {
  const svgContainer = useRef<HTMLDivElement>(null);
  const svgElementRef = useRef<SVGSVGElement | null>(null);

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

          tooltip.style.background =
            "rgba(255,255,255,0.05)";

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

        let loteActivo: HTMLElement | null = null;
        let loteClon: SVGElement | null = null;
        let loteHoverClon: SVGElement | null = null;

        let inicioClickX = 0;
        let inicioClickY = 0;
        let huboArrastre = false;
        let botonPresionado = 0;

        const obtenerColorEstado = (
          estado: string
        ) => {
          switch (estado?.toUpperCase()) {
            case "DISPONIBLE":
              return {
                fill: "rgba(47,111,67,0.30)",
                stroke: "#2F6F43",
              };

            case "SEPARADO":
            case "RESERVADO":
            case "CIERRE_SOLICITADO":
              return {
                fill: "rgba(202,137,55,0.36)",
                stroke: "#C9852E",
              };

            case "EN_NEGOCIACION":
              return {
                fill: "rgba(104,132,62,0.28)",
                stroke: "#68843E",
              };

            case "BLOQUEADO":
              return {
                fill: "rgba(90,99,112,0.30)",
                stroke: "#5A6370",
              };

            case "VENDIDO":
              return {
                fill: "rgba(159,59,48,0.38)",
                stroke: "#9F3B30",
              };

            default:
              return {
                fill: "rgba(47,111,67,0.24)",
                stroke: "#2F6F43",
              };
          }
        };

        const restaurarLote = (
          path: HTMLElement,
          lote: LotePlano
        ) => {
          const color =
            obtenerColorEstado(
              lote.estado
            );

          path.style.fill =
            color.fill;

          path.style.stroke =
            "#b9ada2";

          path.style.strokeWidth =
            "0.9";

          path.style.filter = "";
        };

        const limpiarHover = () => {
          if (loteHoverClon) {
            loteHoverClon.remove();
            loteHoverClon = null;
          }
        };

        const resaltarHover = (
          path: HTMLElement,
          stroke: string
        ) => {
          const parent = path.parentNode;

          if (!parent) return;

          limpiarHover();

          const clon =
            path.cloneNode(true) as SVGElement;

          clon.removeAttribute("id");
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

          parent.appendChild(clon);
          loteHoverClon = clon;
        };

        lotes.forEach((lote) => {
          const path =
            svgElement.getElementById(
              lote.svg_id
            ) as HTMLElement | null;

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
            "#b9ada2";

          path.style.strokeWidth =
            "0.9";

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

            <div>
              ${formatearDecimal(
                lote.area
              )} m2
            </div>

            <div>
              S/ ${formatearDecimal(
                lote.precio
              )}
            </div>

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

              const clon =
                path.cloneNode(true) as SVGElement;

              clon.style.pointerEvents =
                "none";

              clon.style.fill =
                "rgba(255,255,255,0.10)";

              clon.style.stroke =
                "#D8B56D";

              clon.style.strokeWidth =
                "2";

              clon.setAttribute(
                "vector-effect",
                "non-scaling-stroke"
              );

              capaResaltado!.innerHTML =
                "";

              const parent =
                path.parentNode;

              if (parent) {
                parent.appendChild(clon);
                parent.appendChild(path);
              }

              loteClon = clon;

              path.style.stroke =
                color.stroke;

              path.style.strokeWidth =
                "2.5";

              path.style.filter =
                "drop-shadow(0px 0px 4px rgba(216,181,109,.85))";
            }

            setLoteSeleccionado({
              id: lote.id,
              nombre: `MZ ${lote.mz} - LOTE ${lote.lote}`,
              area: `${formatearDecimal(
                lote.area
              )} m2`,
              precio: `S/ ${formatearDecimal(
                lote.precio
              )}`,
              estado: lote.estado,
            });
          };
        });
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelado = true;
    };
  }, [
    lotes,
    setLoteSeleccionado,
  ]);

  useEffect(() => {
    if (!loteUbicado) return;

    const timer = window.setTimeout(() => {
      const path =
        svgElementRef.current?.getElementById(
          loteUbicado.svg_id
        ) as HTMLElement | null;

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
        background: "#ffffff",
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
