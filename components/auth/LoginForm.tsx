"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] =
    useState(false);
  const [focusedField, setFocusedField] = useState<
    "email" | "password" | null
  >(null);
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
      setError("Supabase no esta configurado.");
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
      setError("Correo o contrasena incorrectos.");
      return;
    }

    router.replace("/asesores");
  };

  return (
    <main style={page}>
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #374151 !important;
          caret-color: #0f766e !important;
          transition: background-color 9999s ease-in-out 0s;
        }

        input::selection {
          background: rgba(19, 137, 117, 0.16);
          color: #111827;
        }
      `}</style>

      <div style={shapeLeft} />
      <div style={shapeRight} />
      <div style={shapeBottom} />
      <div style={dots} />

      <section style={card}>
        <div style={cardHeader}>
          <div style={headerShapeOne} />
          <div style={headerShapeTwo} />
          <div style={headerShapeThree} />

          <div style={headerContent}>
            <div style={systemTextHeader}>
              <span style={headerLine} />
              <span>SISTEMA DE GESTION</span>
              <span style={headerLine} />
            </div>

            <img
              src="/logokomodo.png"
              alt="Komodo Inmobiliaria"
              style={logoWhite}
            />
          </div>
        </div>

        <div style={cardBody}>
          <h1 style={welcome}>¡Bienvenido!</h1>

          <p style={subtitle}>
            Ingresa tu correo para continuar
          </p>

          <form
            onSubmit={iniciarSesion}
            style={form}
          >
            <label style={label}>
              CORREO
              <div
                style={inputShell(
                  focusedField === "email"
                )}
              >
                <span style={inputIcon}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8C2 6.9 2.9 6 4 6Z"
                      fill="#138975"
                    />
                    <path
                      d="M4 8L12 13L20 8"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  onFocus={() =>
                    setFocusedField("email")
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                  required
                  autoComplete="email"
                  placeholder="Tu correo aquí"
                  style={textInput}
                />
              </div>
            </label>

            <label style={label}>
              CONTRASEÑA
              <div
                style={inputShell(
                  focusedField === "password"
                )}
              >
                <span style={inputIcon}>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M17 10H16V8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8V10H7C5.9 10 5 10.9 5 12V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V12C19 10.9 18.1 10 17 10ZM10 8C10 6.9 10.9 6 12 6C13.1 6 14 6.9 14 8V10H10V8Z"
                      fill="#138975"
                    />
                  </svg>
                </span>

                <input
                  type={
                    mostrarPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  onFocus={() =>
                    setFocusedField("password")
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                  required
                  autoComplete="current-password"
                  placeholder="Contraseña"
                  style={textInput}
                />

                <button
                  type="button"
                  onClick={() =>
                    setMostrarPassword(
                      !mostrarPassword
                    )
                  }
                  style={eyeButton}
                  aria-label="Mostrar contraseña"
                >
                  {mostrarPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>

            {error && (
              <div style={errorBox}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...submitButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              <span style={buttonContent}>
                <span style={buttonIcon}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 17L15 12L10 7"
                      stroke="white"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15 12H4"
                      stroke="white"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 5V19"
                      stroke="white"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>

                {loading
                  ? "INGRESANDO..."
                  : "Ingresar al Sistema"}
              </span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100svh",
  height: "100svh",
  width: "100vw",
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  padding: 0,
  margin: 0,
  background:
    "radial-gradient(circle at 15% 20%, rgba(139, 168, 43, .04), transparent 34%), radial-gradient(circle at 90% 10%, rgba(19, 137, 117, .04), transparent 32%), linear-gradient(135deg, #fdfdf9 0%, #fafcf6 44%, #f4fbf8 100%)",
};

const shapeLeft: React.CSSProperties = {
  position: "absolute",
  left: "-180px",
  top: "120px",
  width: 480,
  height: 620,
  borderRadius: "48%",
  background:
    "linear-gradient(180deg, rgba(13, 119, 106, .10), rgba(9, 67, 62, .14))",
  transform: "rotate(-18deg)",
};

const shapeRight: React.CSSProperties = {
  position: "absolute",
  right: "-150px",
  bottom: "60px",
  width: 430,
  height: 430,
  borderRadius: "42% 58% 50% 50%",
  background:
    "linear-gradient(145deg, rgba(139,168,43,.08), rgba(13,119,106,.03))",
  transform: "rotate(-18deg)",
};

const shapeBottom: React.CSSProperties = {
  position: "absolute",
  left: "15%",
  bottom: "-210px",
  width: "70%",
  height: 340,
  borderRadius: "50% 50% 0 0",
  background:
    "linear-gradient(90deg, rgba(139,168,43,.06), rgba(13,119,106,.04))",
};

const dots: React.CSSProperties = {
  position: "absolute",
  left: "70px",
  bottom: "180px",
  width: 90,
  height: 90,
  opacity: 0.28,
  backgroundImage:
    "radial-gradient(circle, rgba(255,255,255,.9) 2px, transparent 2px)",
  backgroundSize: "16px 16px",
};

const card: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 500,
  borderRadius: 22,
  background: "#ffffff",
  overflow: "hidden",
  border: "1px solid rgba(15,118,110,.12)",
  boxShadow:
    "0 30px 80px rgba(7, 53, 49, .18), 0 8px 22px rgba(7, 53, 49, .08)",
  transform: "scale(0.94)",
  transformOrigin: "center",
};

const cardHeader: React.CSSProperties = {
  padding: "34px 44px 30px",
  background:
    "linear-gradient(135deg,#064e3b 0%,#0f766e 52%,#08705f 100%)",
  display: "grid",
  justifyItems: "center",
  position: "relative",
  overflow: "hidden",
};

const headerContent: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  justifyItems: "center",
  width: "100%",
};

const headerShapeOne: React.CSSProperties = {
  position: "absolute",
  width: 220,
  height: 240,
  borderRadius: "45%",
  left: "-90px",
  top: "-95px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,.01), rgba(139,168,43,.11))",
  transform: "rotate(-22deg)",
  zIndex: 1,
};

const headerShapeTwo: React.CSSProperties = {
  position: "absolute",
  width: 200,
  height: 200,
  borderRadius: "48%",
  right: "-80px",
  bottom: "-115px",
  background:
    "linear-gradient(145deg, rgba(255,255,255,.09), rgba(255,255,255,.04))",
  transform: "rotate(18deg)",
  zIndex: 1,
};

const headerShapeThree: React.CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  right: "35px",
  top: "-110px",
  background:
    "radial-gradient(circle, rgba(139,168,43,.02), transparent 68%)",
  zIndex: 1,
};

const systemTextHeader: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "3px",
  textTransform: "uppercase",
  marginBottom: 24,
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  width: "100%",
};

const headerLine: React.CSSProperties = {
  display: "block",
  width: 86,
  height: 1,
  background: "rgba(255,255,255,.75)",
};

const logoWhite: React.CSSProperties = {
  width: "100%",
  maxWidth: 340,
  height: "auto",
  objectFit: "contain",

  // Convierte tu logo de color a blanco.
  filter:
    "brightness(0) invert(1)",
};

const cardBody: React.CSSProperties = {
  padding: "38px 44px 38px",
  display: "grid",
};

const welcome: React.CSSProperties = {
  margin: 0,
  color: "#0f766e",
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 950,
  textAlign: "center",
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 28px",
  color: "#6b7280",
  fontSize: 15,
  textAlign: "center",
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#164e44",
  fontWeight: 800,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "3px",
};

const inputShell = (
  focused: boolean
): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: 56,
  padding: "0 16px",
  borderRadius: 14,
  border: focused
    ? "1.6px solid #138975"
    : "1px solid #d8e5df",
  background: "#ffffff",
  boxShadow: focused
    ? "0 0 0 4px rgba(19,137,117,.12), 0 8px 22px rgba(19,137,117,.08)"
    : "0 1px 2px rgba(0,0,0,.02)",
  transition: "all .18s ease",
});

const inputIcon: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const textInput: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#374151",
  fontSize: 16,
  fontWeight: 500,
  paddingLeft: 4,
  letterSpacing: "normal",
  textTransform: "none",
};

const eyeButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 17,
  opacity: 0.65,
  padding: 0,
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
};

const errorBox: React.CSSProperties = {
  background: "#fbe0dc",
  color: "#8b2f25",
  padding: "12px 14px",
  borderRadius: 12,
  fontWeight: 800,
  border: "1px solid #f4b9b0",
};

const submitButton: React.CSSProperties = {
  width: "100%",
  height: 56,
  border: "2px solid #0b5f55",
  borderRadius: 14,
  background:
    "linear-gradient(135deg,#0f766e,#08705f,#064e3b)",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 950,
  letterSpacing: ".4px",
  marginTop: 8,
  boxShadow:
    "0 14px 28px rgba(6,78,59,.24)",
};

const buttonContent: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon: React.CSSProperties = {
  width: 18,
  height: 18,
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
  flexShrink: 0,
};