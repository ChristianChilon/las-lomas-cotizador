type Props = {
  lote: {
    nombre: string;
    area: string;
    precio: string;
    estado: string;
  } | null;
};

export default function PanelLateral({
  lote,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 340,
        height: "100vh",
        background: "#ffffff",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.12)",
        zIndex: 9998,
        padding: 24,
        overflowY: "auto",
      }}
    >
      {!lote ? (
        <>
          <h2
            style={{
              fontSize: 24,
              marginBottom: 10,
            }}
          >
            Seleccione un lote
          </h2>

          <p
            style={{
              color: "#777",
            }}
          >
            Haga clic sobre cualquier lote
            disponible en el plano.
          </p>
        </>
      ) : (
        <>
          <div
            style={{
              background: "#fff8f1",
              border: "1px solid #ffd7a8",
              borderRadius: 12,
              padding: 18,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#999",
                marginBottom: 4,
              }}
            >
              LOTE SELECCIONADO
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#ff8c00",
              }}
            >
              {lote.nombre}
            </div>
          </div>

          <Card
            titulo="Área"
            valor={lote.area}
          />

          <Card
            titulo="Precio"
            valor={lote.precio}
          />

          <div
            style={{
              marginTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#888",
                marginBottom: 6,
              }}
            >
              Estado
            </div>

            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background:
                  lote.estado ===
                  "Disponible"
                    ? "#e8f7ea"
                    : "#ffe6e6",
                color:
                  lote.estado ===
                  "Disponible"
                    ? "#1b8a3b"
                    : "#c62828",
                fontWeight: 600,
              }}
            >
              {lote.estado}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #ececec",
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#888",
          marginBottom: 6,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        {valor}
      </div>
    </div>
  );
}