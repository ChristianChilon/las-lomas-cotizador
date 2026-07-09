"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      <div style={loadingScreen}>
        <Image
          src="/icon.png"
          alt="Las Lomas CRM"
          width={86}
          height={86}
          style={loadingLogo}
        />

        <div style={loadingText}>
          Cargando panel...
        </div>

        <div style={loadingCredit}>
          Desarrollado by Christian Chilon
        </div>
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
      <Sidebar profile={profile} />
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

const loadingScreen: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  background: "#f7f8f5",
  color: "#052e22",
};

const loadingLogo: React.CSSProperties = {
  width: 86,
  height: 86,
  objectFit: "contain",
  borderRadius: 20,
  boxShadow: "0 18px 40px rgba(5,46,34,.14)",
};

const loadingText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 18,
  fontWeight: 950,
  letterSpacing: ".02em",
  color: "#052e22",
};

const loadingCredit: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#64748b",
};
