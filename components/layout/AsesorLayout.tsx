"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { obtenerPerfilActual } from "../../lib/auth/clientAuth";
import type { Profile } from "../../lib/crm";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function AsesorLayout({
  children,
  title,
  subtitle,
}: Props) {
  const router = useRouter();
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const cargar = async () => {
      const result =
        await obtenerPerfilActual();

      if (!active) return;

      if (!result.profile) {
        setError(result.error);
        setLoading(false);

        if (
          result.error === "No hay sesion activa."
        ) {
          router.replace("/login");
        }

        return;
      }

      setProfile(result.profile);
      setLoading(false);
    };

    cargar();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f3f5f1",
          color: "#0b2f24",
          fontWeight: 900,
        }}
      >
        Cargando panel...
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f3f5f1",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: "#ffffff",
            borderRadius: 18,
            padding: 28,
            boxShadow:
              "0 24px 60px rgba(15,23,42,.12)",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: 10,
              color: "#111827",
            }}
          >
            Acceso no disponible
          </h1>
          <p
            style={{
              color: "#4b5563",
              lineHeight: 1.5,
            }}
          >
            {error ||
              "No se pudo cargar tu perfil de asesor."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f4f6f2",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Header profile={profile} />
        <main
          style={{
            padding: 28,
          }}
        >
          {(title || subtitle) && (
            <div style={pageHeader}>
              {title && <h1 style={titleStyle}>{title}</h1>}
              {subtitle && (
                <p style={subtitleStyle}>{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

const pageHeader: React.CSSProperties = {
  marginBottom: 22,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 30,
  fontWeight: 950,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: 15,
};
