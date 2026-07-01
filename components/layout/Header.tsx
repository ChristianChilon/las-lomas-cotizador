"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/crm";

type Props = {
  profile: Profile;
};

export default function Header({ profile }: Props) {
  const router = useRouter();

  const cerrarSesion = async () => {
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  return (
    <header
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
      <div>
        <div
          style={{
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Panel privado
        </div>
        <div
          style={{
            color: "#111827",
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          Gestion inmobiliaria
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
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
