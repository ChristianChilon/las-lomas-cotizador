import LoginForm from "../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg,#eef5ec,#ffffff 45%,#f8efd3)",
      }}
    >
      <LoginForm />
    </main>
  );
}
