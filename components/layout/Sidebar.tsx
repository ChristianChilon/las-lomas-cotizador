"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/asesores",
    label: "Dashboard",
  },
  {
    href: "/asesores/lotes",
    label: "Lotes",
  },
  {
    href: "/asesores/clientes",
    label: "Clientes",
  },
  {
    href: "/asesores/separaciones",
    label: "Separaciones",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 260,
        minHeight: "100vh",
        background:
          "linear-gradient(180deg,#0b2f24,#08251d)",
        color: "#fff",
        padding: 22,
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: ".4px",
          marginBottom: 28,
        }}
      >
        Las Lomas CRM
      </div>

      <nav
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        {links.map((link) => {
          const active =
            pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                textDecoration: "none",
                color: active
                  ? "#0b2f24"
                  : "#d9eadf",
                background: active
                  ? "#f5e6b8"
                  : "rgba(255,255,255,.06)",
                border:
                  "1px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                padding: "12px 14px",
                fontWeight: 800,
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
