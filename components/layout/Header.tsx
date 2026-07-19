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
    <header className="crm-header">
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

      <div className="crm-header-actions">
        <button
          type="button"
          className="crm-theme-button"
          onClick={onToggleNoche}
          aria-label={modoNoche ? "Activar modo dia" : "Activar modo noche"}
          title={modoNoche ? "Modo dia" : "Modo noche"}
        >
          {modoNoche ? "\u2600" : "\u263E"}
        </button>

        <div className="crm-profile-summary">
          <div className="crm-profile-name">
            {profile.full_name ||
              profile.email ||
              "Usuario"}
          </div>
          <div className="crm-profile-role">
            {profile.role.replace("_", " ")}
          </div>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          className="crm-logout-button"
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  );
}
