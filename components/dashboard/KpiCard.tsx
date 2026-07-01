type Props = {
  label: string;
  value: number | string;
  tone?: "green" | "gold" | "red" | "gray";
};

const tones = {
  green: {
    bg: "#e7f4eb",
    fg: "#17633a",
  },
  gold: {
    bg: "#fff3d6",
    fg: "#875c00",
  },
  red: {
    bg: "#fbe0dc",
    fg: "#8b2f25",
  },
  gray: {
    bg: "#eef2f7",
    fg: "#334155",
  },
};

export default function KpiCard({
  label,
  value,
  tone = "green",
}: Props) {
  const color = tones[tone];

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 22,
        boxShadow:
          "0 14px 36px rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontWeight: 800,
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "inline-flex",
          minWidth: 74,
          justifyContent: "center",
          borderRadius: 999,
          padding: "10px 16px",
          background: color.bg,
          color: color.fg,
          fontSize: 28,
          fontWeight: 950,
        }}
      >
        {value}
      </div>
    </div>
  );
}
