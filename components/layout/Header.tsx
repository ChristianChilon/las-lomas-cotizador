"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/crm";

type Props = {
  profile: Profile;
  onOpenMenu: () => void;
  modoNoche: boolean;
  onToggleNoche: () => void;
};

export default function Header({
  profile,
  onOpenMenu,
  modoNoche,
  onToggleNoche,
}: Props) {
  const router = useRouter();

  const cerrarSesion = async () => {
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  return (
    <header
      className="crm-header"
      style={{
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div className="crm-header-leading">
        <button
          type="button"
          className="crm-menu-button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div>
          <div className="crm-header-eyebrow">
            Panel privado
          </div>
          <div className="crm-header-title">
            Gestion inmobiliaria
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          type="button"
          className="crm-theme-button"
          onClick={onToggleNoche}
          aria-label={modoNoche ? "Activar modo dia" : "Activar modo noche"}
          title={modoNoche ? "Modo dia" : "Modo noche"}
        >
          {modoNoche ? "☀" : "☾"}
        </button>

        <div className="crm-profile-summary">
          <div
            className="crm-profile-name"
            style={{
              fontWeight: 900,
              color: "#111827",
            }}
          >
            {profile.full_name ||
              profile.email ||
              "Usuario"}
          </div>
          <div
            className="crm-profile-role"
            style={{
              color: "#6b7280",
              fontSize: 13,
              textTransform: "capitalize",
            }}
          >
            {profile.role.replace("_", " ")}
          </div>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          className="crm-logout-button"
          style={{
            border: "none",
            borderRadius: 12,
            padding: "11px 14px",
            background: "#0b2f24",
            color: "#ffffff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  );
}
