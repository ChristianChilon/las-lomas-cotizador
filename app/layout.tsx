import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Las Lomas",
  description: "Cotizador interactivo Las Lomas",
  icons: {
    icon: [
      {
        url: "/iconofocus.png",
        type: "image/png",
      },
    ],
    shortcut: "/iconofocus.png",
    apple: "/iconofocus.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
