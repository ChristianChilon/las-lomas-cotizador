"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { esGerencia, type Profile } from "../../lib/crm";

type SidebarLink = {
  href: string;
  label: string;
  asesorLabel?: string;
  gerenciaOnly?: boolean;
};

const grupos: Array<{ titulo: string; links: SidebarLink[] }> = [
  {
    titulo: "Trabajo diario",
    links: [
      { href: "/asesores", label: "Dashboard" },
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
    ],
  },
  {
    titulo: "Ventas",
    links: [
      {
        href: "/asesores/embudo",
        label: "Embudo",
        asesorLabel: "Mi embudo",
      },
      {
        href: "/asesores/clientes",
        label: "Clientes",
        asesorLabel: "Mis clientes",
      },
      { href: "/asesores/lotes", label: "Lotes" },
      { href: "/asesores/cotizador", label: "Cotizador privado" },
      {
        href: "/asesores/cotizaciones",
        label: "Cotizaciones",
        asesorLabel: "Mis cotizaciones",
      },
      {
        href: "/asesores/separaciones",
        label: "Separaciones",
        asesorLabel: "Mis separaciones",
      },
    ],
  },
  {
    titulo: "Seguimiento",
    links: [
      {
        href: "/asesores/seguimientos",
        label: "Seguimientos",
        asesorLabel: "Mis seguimientos",
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
    ],
  },
  {
    titulo: "Gerencia",
    links: [
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
        href: "/asesores/historial",
        label: "Historial",
        gerenciaOnly: true,
      },
      {
        href: "/asesores/reportes",
        label: "Analitica",
        gerenciaOnly: true,
      },
    ],
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
  const gruposVisibles = grupos
    .map((grupo) => ({
      ...grupo,
      links: grupo.links.filter(
        (link) => !link.gerenciaOnly || modoGerencia
      ),
    }))
    .filter((grupo) => grupo.links.length > 0);

  return (
    <aside
      className={`crm-sidebar ${open ? "is-open" : ""}`}
    >
      <div className="crm-sidebar-heading">
        <div className="crm-sidebar-brand">
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

      <nav className="crm-sidebar-nav">
        {gruposVisibles.map((grupo) => (
          <section className="crm-sidebar-group" key={grupo.titulo}>
            <div className="crm-sidebar-group-title">{grupo.titulo}</div>
            <div className="crm-sidebar-group-links">
              {grupo.links.map((link) => {
                const active = pathname === link.href;
                const label =
                  !modoGerencia && link.asesorLabel
                    ? link.asesorLabel
                    : link.label;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className={`crm-sidebar-link ${active ? "is-active" : ""}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
