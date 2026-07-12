"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { esGerencia, type Profile } from "../../lib/crm";

const links = [
  {
    href: "/asesores",
    label: "Dashboard",
  },
  {
    href: "/asesores/tareas",
    label: "Tareas",
    asesorLabel: "Mis tareas",
  },
  {
    href: "/asesores/leads",
    label: "Leads entrantes",
    asesorLabel: "Mis leads",
  },
  {
    href: "/asesores/agenda",
    label: "Agenda",
    asesorLabel: "Mi agenda",
  },
  {
    href: "/asesores/embudo",
    label: "Embudo",
    asesorLabel: "Mi embudo",
  },
  {
    href: "/asesores/pronostico",
    label: "Pronostico",
    asesorLabel: "Mi pronostico",
  },
  {
    href: "/asesores/metas",
    label: "Metas",
    asesorLabel: "Mis metas",
  },
  {
    href: "/asesores/calidad",
    label: "Calidad CRM",
    gerenciaOnly: true,
  },
  {
    href: "/asesores/configuracion",
    label: "Reglas comerciales",
    gerenciaOnly: true,
  },
  {
    href: "/asesores/lotes",
    label: "Lotes",
  },
  {
    href: "/asesores/cotizador",
    label: "Cotizador privado",
  },
  {
    href: "/asesores/cotizaciones",
    label: "Cotizaciones",
    asesorLabel: "Mis cotizaciones",
  },
  {
    href: "/asesores/clientes",
    label: "Clientes",
    asesorLabel: "Mis clientes",
  },
  {
    href: "/asesores/seguimientos",
    label: "Seguimientos",
    asesorLabel: "Mis seguimientos",
  },

  {
    href: "/asesores/separaciones",
    label: "Separaciones",
    asesorLabel: "Mis separaciones",
  },
  {
    href: "/asesores/historial",
    label: "Historial",
    gerenciaOnly: true,
  },
  {
    href: "/asesores/reportes",
    label: "Analitica",
    gerenciaOnly: true,
  },
];

type Props = {
  profile: Profile;
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ profile, open = false, onClose }: Props) {
  const pathname = usePathname();
  const modoGerencia = esGerencia(profile);
  const visibleLinks = links.filter(
    (link) => !link.gerenciaOnly || modoGerencia
  );

  return (
    <aside
      className={`crm-sidebar ${open ? "is-open" : ""}`}
      style={{
        width: 260,
        minHeight: "100vh",
        background:
          "linear-gradient(180deg,#0b2f24,#08251d)",
        color: "#fff",
        padding: 22,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div className="crm-sidebar-heading">
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: ".4px",
          }}
        >
          Las Lomas CRM
        </div>
        <button
          type="button"
          className="crm-sidebar-close"
          onClick={onClose}
          aria-label="Cerrar menu"
        >
          x
        </button>
      </div>

      <nav
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        {visibleLinks.map((link) => {
          const active =
            pathname === link.href;
          const label =
            !modoGerencia && link.asesorLabel
              ? link.asesorLabel
              : link.label;

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="crm-sidebar-link"
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
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
