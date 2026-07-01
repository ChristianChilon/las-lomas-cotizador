type Props = {
  visible: boolean;
  x: number;
  y: number;
  nombre: string;
  area: string;
  precio: string;
};

export default function TooltipLote({
  visible,
  x,
  y,
  nombre,
  area,
  precio,
}: Props) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: x + 15,
        top: y + 15,
        background: "white",
        padding: "10px 14px",
        borderRadius: 10,
        boxShadow:
          "0 4px 12px rgba(0,0,0,0.15)",
        pointerEvents: "none",
        zIndex: 10000,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {nombre}
      </div>

      <div>{area}</div>

      <div>{precio}</div>
    </div>
  );
}