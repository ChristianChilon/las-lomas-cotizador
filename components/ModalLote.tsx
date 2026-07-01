"use client";

import { useState } from "react";

type LoteModal = {
  nombre?: string;
  area?: string | number;
  precio?: string | number;
  estado?: string;
};

type Props = {
  lote: LoteModal;
  onClose: () => void;
  onHablarAsesor: () => void;
};

export default function ModalLote({
  lote,
  onClose,
  onHablarAsesor,
}: Props) {
  const [pos, setPos] = useState({
    x: 520,
    y: 20,
  });

  const [dragging, setDragging] =
    useState(false);
  
  const [offset, setOffset] =
    useState({
      x: 0,
      y: 0,
    });

  const [meses, setMeses] =
    useState(24);

  const [inicial, setInicial] =
    useState(6000);

  if (!lote) return null;

  const precioNumero =
    Number(
      String(
        lote.precio || 0
      )
        .replace("S/", "")
        .replace(/,/g, "")
        .trim()
    );

  const saldo =
    Math.max(
      precioNumero - inicial,
      0
    );

  const cuota =
    meses > 0
      ? saldo / meses
      : 0;

  const cuota12 =
    saldo / 12;

  const cuota24 =
    saldo / 24;

  const cuota36 =
    saldo / 36;

  const colorEstado =
    lote.estado === "VENDIDO"
      ? "#E53935"
      : lote.estado ===
        "SEPARADO"
        ? "#FB8C00"
        : "#2E7D32";

  const fondoEstado =
    lote.estado === "VENDIDO"
      ? "rgba(229,57,53,.25)"
      : lote.estado ===
        "SEPARADO"
        ? "rgba(251,140,0,.25)"
        : "rgba(46,125,50,.25)";

  return (
    <div
      className="modal-lote-panel"
      onMouseMove={(e) => {
        if (!dragging) return;

        setPos({
          x:
            e.clientX -
            offset.x,

          y:
            e.clientY -
            offset.y,
        });
      }}
      onMouseUp={() =>
        setDragging(false)
      }
      style={{
        position: "fixed",

        left: pos.x,
        top: pos.y,

        width: 380,

        height: "77vh",

        overflowY: "auto",

        background:
          "rgba(255,255,255,.10)",

        backdropFilter:
          "blur(28px)",

        borderRadius: 22,

        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingTop: 0,

        zIndex: 99999,

        boxShadow:
          "0 18px 60px rgba(0,0,0,.18)",

        border:
          "1px solid rgba(255,255,255,.35)",
      }}
    >
      {/* CABECERA */}

      <div
        onMouseDown={(e) => {
          setDragging(true);

          setOffset({
            x:
              e.clientX -
              pos.x,

            y:
              e.clientY -
              pos.y,
          });
        }}
        style={{
          cursor: "move",

          position: "sticky",

          top: 0,

          zIndex: 999,

          marginLeft: -16,
          marginRight: -16,
          marginTop: -16,

          padding:
            "4px 10px",

          marginBottom: 23,

          background:
            "rgba(255,255,255,.99)",

          borderTopLeftRadius:
            22,

          borderTopRightRadius:
            22,

          borderBottom:
            "1px solid rgba(0,0,0,.08)",

          display: "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",
        }}
      >
        <div
          style={{
            display: "flex",

            alignItems:
              "center",

            gap: 8,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,

              borderRadius:
                "50%",

              background:
                "rgba(0,0,0,.05)",

              display: "flex",

              alignItems:
                "center",

              justifyContent:
                "center",
            }}
          >
            ☰
          </div>

          <div
            style={{
              fontSize: 11,

              fontWeight: 800,

              color: "#111",

              letterSpacing:
                "1px",

              textTransform:
                "uppercase",
            }}
          >
            Cotiza tu lote ideal
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: "none",

            background:
              "none",

            cursor:
              "pointer",

            fontSize: 18,

            color:
              "#666",
          }}
        >
          ✕
        </button>
      </div>
      {/* CARD LOTE */}

      <div
        style={{
          background:
            "rgba(255,255,255,.68)",

          border:
            "1px solid rgba(255,255,255,.55)",

          borderRadius: 16,

          padding: "8px 12px",

          marginBottom: 6,

          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 18,

            fontWeight: 800,

            color: "#111",

            marginBottom: 8,
          }}
        >
          {lote.nombre}
        </div>

        <div
          style={{
            display:
              "inline-block",

            padding:
              "8px 18px",

            borderRadius:
              999,

            background:
              fondoEstado,

            color:
              colorEstado,

            fontWeight:
              800,

            fontSize: 13,

            border:
              `1px solid ${colorEstado}33`,
          }}
        >
          ● {lote.estado}
        </div>
      </div>

      {/* INFO RAPIDA */}

      <div
        style={{
          background:
            "rgba(255,255,255,.68)",

          border:
            "1px solid rgba(255,255,255,.55)",

          borderRadius: 16,

          padding: 3,

          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",
          }}
        >
          <div
            style={{
              textAlign: "center",

              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,

                color: "#777",
              }}
            >
              ÁREA
            </div>

            <div
              style={{
                fontSize: 18,

                fontWeight: 700,
              }}
            >
              {lote.area}
            </div>
          </div>

          <div
            style={{
              width: 1,

              height: 36,

              background:
                "rgba(0,0,0,.08)",
            }}
          />

          <div
            style={{
              textAlign: "center",

              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,

                color: "#777",
              }}
            >
              PRECIO
            </div>

            <div
              style={{
                fontSize: 18,

                fontWeight: 800,

                color:
                  "#1B5E20",
              }}
            >
              S/
              {precioNumero.toLocaleString(
                "es-PE",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HERO FINANCIERO */}

      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,120,.65), rgba(255, 217, 0, 0.12))",

          border:
            "1px solid rgba(251, 220, 126, 0.3)",

          borderRadius: 18,

          padding: 5,

          marginBottom: 10,
        }}
      >
        <div
          style={{
            textAlign: "center",

            fontSize: 10,

            fontWeight: 700,

            color: "#7a4b00",

            marginBottom: 3,

            letterSpacing:
              ".5px",
          }}
        >
          TU CUOTA MENSUAL
          ESTIMADA
        </div>

        <div
          style={{
            textAlign: "center",

            fontSize: 34,

            fontWeight: 900,

            color: "#8B5E00",

            lineHeight: 1,
          }}
        >
          S/
          {cuota.toLocaleString(
            "es-PE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 6,
            borderTop:
              "1px solid rgba(0,0,0,.08)",
          }}
        >
          <div
            style={{
              flex: 1,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#666",
              }}
            >
              INICIAL
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              S/
              {inicial.toLocaleString("es-PE")}
            </div>
          </div>

          <div
            style={{
              width: 1,
              background:
                "rgba(0,0,0,.08)",
            }}
          />

          <div
            style={{
              flex: 1,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#666",
              }}
            >
              MESES
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {meses}
            </div>
          </div>
        </div>

      </div>
      {/* PLANES RAPIDOS */}

      <div
        style={{
          background:
            "rgba(255,255,255,.68)",

          border:
            "1px solid rgba(255,255,255,.55)",

          borderRadius: 16,

          padding: 6,

          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,

            fontWeight: 800,

            marginBottom: 8,

            color: "#222",
          }}
        >
          ⚡ Planes pensados para ti
        </div>

        <div
          style={{
            display: "flex",

            gap: 8,
          }}
        >
          <button
            onClick={() =>
              setMeses(12)
            }
            style={{
              flex: 1,

              border:
                meses === 12
                  ? "2px solid #2E7D32"
                  : "1px solid rgba(0,0,0,.08)",

              borderRadius: 12,

              padding: 10,

              background:
                meses === 12
                  ? "rgba(46,125,50,.12)"
                  : "rgba(255,255,255,.75)",

              cursor:
                "pointer",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              12
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#666",
              }}
            >
              meses
            </div>

            <div
              style={{
                marginTop: 4,

                fontSize: 16,

                fontWeight: 700,

                color:
                  "#1B5E20",
              }}
            >
              S/
              {cuota12.toLocaleString(
                "es-PE",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </div>
          </button>

          <button
            onClick={() =>
              setMeses(24)
            }
            style={{
              flex: 1,

              position: "relative",

              overflow: "visible",

              border:
                meses === 24
                  ? "2px solid #2E7D32"
                  : "1px solid rgba(0,0,0,.08)",

              borderRadius: 12,

              padding: 10,

              background:
                meses === 24
                  ? "rgba(46,125,50,.12)"
                  : "rgba(255,255,255,.75)",

              cursor:
                "pointer",
            }}
          >

            <div
              style={{
                position: "absolute",

                top: -12,

                left: "50%",

                transform:
                  "translateX(-50%)",

                fontSize: 18,
              }}
            >
              ⭐
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              24
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#666",
              }}
            >
              meses
            </div>

            <div
              style={{
                marginTop: 6,

                fontSize: 16,

                fontWeight: 700,

                color:
                  "#1B5E20",
              }}
            >
              S/
              {cuota24.toLocaleString(
                "es-PE",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </div>
          </button>

          <button
            onClick={() =>
              setMeses(36)
            }
            style={{
              flex: 1,

              border:
                meses === 36
                  ? "2px solid #2E7D32"
                  : "1px solid rgba(0,0,0,.08)",

              borderRadius: 12,

              padding: 10,

              background:
                meses === 36
                  ? "rgba(46,125,50,.12)"
                  : "rgba(255,255,255,.75)",

              cursor:
                "pointer",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              36
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#666",
              }}
            >
              meses
            </div>

            <div
              style={{
                marginTop: 6,

                fontSize: 16,

                fontWeight: 700,

                color:
                  "#1B5E20",
              }}
            >
              S/
              {cuota36.toLocaleString(
                "es-PE",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </div>
          </button>
        </div>
      </div>

      {/* AJUSTA TU PLAN */}
      <div
        style={{
          background:
            "rgba(255,255,255,.68)",

          border:
            "1px solid rgba(255,255,255,.55)",

          borderRadius: 16,

          padding: 12,

          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,

            fontWeight: 800,

            marginBottom: 10,
          }}
        >
          🔥 ¡Ajusta el plan a tu medida!
        </div>

        {/* MESES */}

        <div
          style={{
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                minWidth: 55,
              }}
            >
              Meses
            </div>

            <input
              type="number"
              min={1}
              max={36}
              value={meses}
              onChange={(e) =>
                setMeses(
                  Number(e.target.value)
                )
              }
              style={{
                width: 80,
                padding: 8,
                borderRadius: 12,
                border:
                  "1px solid rgba(0,0,0,.12)",
                textAlign: "center",
              }}
            />
          </div>

          <input
            type="range"
            min={1}
            max={36}
            value={meses}
            onChange={(e) =>
              setMeses(
                Number(e.target.value)
              )
            }
            style={{
              width: "100%",
              cursor: "pointer",
            }}
          />
        </div>

        {/* INICIAL */}

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                minWidth: 55,
              }}
            >
              Inicial
            </div>

            <input
              type="number"
              min={6000}
              max={precioNumero}
              step={500}
              value={inicial}
              onChange={(e) =>
                setInicial(
                  Number(e.target.value)
                )
              }
              style={{
                width: 110,
                padding: 8,
                borderRadius: 12,
                border:
                  "1px solid rgba(0,0,0,.12)",
                textAlign: "center",
              }}
            />
          </div>

          <input
            type="range"
            min={6000}
            max={precioNumero}
            step={500}
            value={inicial}
            onChange={(e) =>
              setInicial(
                Number(e.target.value)
              )
            }
            style={{
              width: "100%",
              cursor: "pointer",
            }}
          />
        </div>
      </div>

      {/* PIE */}

      <div
        style={{
          position: "sticky",

          bottom: -16,

          marginLeft: -16,
          marginRight: -16,
          marginBottom: -16,

          padding: "8px 10px",

          background:
            "rgba(255,255,255,.95)",

          backdropFilter:
            "blur(24px)",

          borderTop:
            "1px solid rgba(0,0,0,.08)",

          zIndex: 999,
        }}
      >
        <button
          onClick={() => {
            if (lote.estado !== "DISPONIBLE") {
              return;
            }

            onHablarAsesor();
          }}
          disabled={lote.estado !== "DISPONIBLE"}
          style={{
            width: "80%",
            margin: "0 auto",
            display: "block",
            padding: 3,
            border: "none",
            borderRadius: 14,

            background:
              lote.estado === "DISPONIBLE"
                ? "#95ec1c"
                : "#d1d5db",

            color:
              lote.estado === "DISPONIBLE"
                ? "black"
                : "#666",

            fontWeight: 600,
            fontSize: 14,

            cursor:
              lote.estado === "DISPONIBLE"
                ? "pointer"
                : "not-allowed",

            opacity:
              lote.estado === "DISPONIBLE"
                ? 1
                : 0.65,

            boxShadow:
              lote.estado === "DISPONIBLE"
                ? "0 4px 20px rgba(58, 251, 129, 0.25)"
                : "none",
          }}
        >
          {lote.estado === "DISPONIBLE"
            ? "🗩     Hablar con un asesor"
            : lote.estado === "SEPARADO"
            ? "Lote separado"
            : "Lote vendido"}
        </button>
      </div>
          
    </div>

  );
}
