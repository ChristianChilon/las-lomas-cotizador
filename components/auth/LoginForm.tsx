"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const revisarSesion = async () => {
      const { data } =
        (await supabase?.auth.getSession()) || {
          data: { session: null },
        };

      if (data.session) {
        router.replace("/asesores");
      }
    };

    revisarSesion();
  }, [router]);

  const iniciarSesion = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        "Supabase no esta configurado."
      );
      return;
    }

    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (loginError) {
      setError(
        "Correo o contrasena incorrectos."
      );
      return;
    }

    router.replace("/asesores");
  };

  return (
    <form
      onSubmit={iniciarSesion}
      style={{
        width: "100%",
        maxWidth: 420,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        padding: 28,
        boxShadow:
          "0 24px 70px rgba(15,23,42,.16)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background:
            "linear-gradient(180deg,#0b2f24,#17633a)",
          color: "#ffffff",
          display: "grid",
          placeItems: "center",
          fontSize: 24,
          marginBottom: 20,
        }}
      >
        👤
      </div>

      <h1
        style={{
          margin: 0,
          marginBottom: 8,
          color: "#111827",
          fontSize: 28,
          fontWeight: 950,
        }}
      >
        Acceso asesores
      </h1>

      <p
        style={{
          margin: 0,
          marginBottom: 24,
          color: "#6b7280",
          lineHeight: 1.5,
        }}
      >
        Ingresa con tu correo corporativo para
        administrar clientes, lotes y separaciones.
      </p>

      <label style={label}>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
          autoComplete="email"
          style={input}
        />
      </label>

      <label style={label}>
        Contrasena
        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
          autoComplete="current-password"
          style={input}
        />
      </label>

      {error && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 14,
            background: "#fbe0dc",
            color: "#8b2f25",
            padding: "11px 12px",
            borderRadius: 12,
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          height: 46,
          border: "none",
          borderRadius: 14,
          background: "#0b2f24",
          color: "#ffffff",
          fontSize: 16,
          fontWeight: 900,
          cursor: loading
            ? "not-allowed"
            : "pointer",
          opacity: loading ? 0.72 : 1,
        }}
      >
        {loading
          ? "Ingresando..."
          : "Iniciar sesion"}
      </button>
    </form>
  );
}

const label: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 16,
  color: "#374151",
  fontWeight: 800,
};

const input: React.CSSProperties = {
  height: 44,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "0 12px",
  color: "#111827",
  background: "#ffffff",
  outline: "none",
  fontSize: 15,
};
