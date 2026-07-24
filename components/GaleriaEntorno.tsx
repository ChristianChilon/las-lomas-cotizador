"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./GaleriaEntorno.module.css";

export type DestinoGaleria = "las-lomas" | "playa-malabrigo";

type FotoGaleria = {
  src: string;
  alt: string;
};

type CategoriaGaleria = {
  id: string;
  label: string;
  fotos: FotoGaleria[];
};

type ConfiguracionGaleria = {
  titulo: string;
  categoriaInicial: string;
  categorias: CategoriaGaleria[];
};

const GALERIAS: Record<DestinoGaleria, ConfiguracionGaleria> = {
  "las-lomas": {
    titulo: "Las Lomas de Malabrigo",
    categoriaInicial: "portico",
    categorias: [
      {
        id: "portico",
        label: "Pórtico",
        fotos: [
          {
            src: "/galeria/las-lomas/portico/01.webp",
            alt: "Vista del pórtico de ingreso de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/portico/02.webp",
            alt: "Segunda vista del pórtico de Las Lomas de Malabrigo",
          },
        ],
      },
      {
        id: "mirador",
        label: "Mirador",
        fotos: [
          {
            src: "/galeria/las-lomas/mirador/01.webp",
            alt: "Vista del mirador de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/mirador/02.webp",
            alt: "Perspectiva del mirador de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/mirador/03.webp",
            alt: "Otra perspectiva del mirador de Las Lomas de Malabrigo",
          },
        ],
      },
      {
        id: "parques",
        label: "Parques",
        fotos: [
          {
            src: "/galeria/las-lomas/parques/01.webp",
            alt: "Vista de los parques de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/parques/02.webp",
            alt: "Segunda vista de los parques de Las Lomas de Malabrigo",
          },
        ],
      },
      {
        id: "terreno",
        label: "Terreno",
        fotos: [
          {
            src: "/galeria/las-lomas/terreno/01.webp",
            alt: "Vista aérea del terreno de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/terreno/02.webp",
            alt: "Vista actual del terreno de Las Lomas de Malabrigo",
          },
          {
            src: "/galeria/las-lomas/terreno/03.webp",
            alt: "Topografía del terreno de Las Lomas de Malabrigo",
          },
        ],
      },
    ],
  },
  "playa-malabrigo": {
    titulo: "Playa Malabrigo",
    categoriaInicial: "playa",
    categorias: [
      {
        id: "playa",
        label: "Playa",
        fotos: [
          {
            src: "/galeria/playa-malabrigo/01.webp",
            alt: "Vista de Playa Malabrigo",
          },
          {
            src: "/galeria/playa-malabrigo/02.webp",
            alt: "Segunda vista de Playa Malabrigo",
          },
          {
            src: "/galeria/playa-malabrigo/03.webp",
            alt: "Tercera vista de Playa Malabrigo",
          },
          {
            src: "/galeria/playa-malabrigo/04.webp",
            alt: "Paseo costero de Playa Malabrigo",
          },
        ],
      },
    ],
  },
};

type Props = {
  destino: DestinoGaleria;
  modoNoche: boolean;
  onCerrar: () => void;
};

export default function GaleriaEntorno({
  destino,
  modoNoche,
  onCerrar,
}: Props) {
  const [categoriaId, setCategoriaId] = useState(
    () => GALERIAS[destino].categoriaInicial
  );
  const [fotoActiva, setFotoActiva] = useState(0);
  const inicioToqueRef = useRef<number | null>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  const galeria = GALERIAS[destino];
  const categoria =
    galeria?.categorias.find((actual) => actual.id === categoriaId) ??
    galeria?.categorias[0];
  const cantidadFotos = categoria?.fotos.length ?? 0;

  useEffect(() => {
    const elementoPrevio = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => cerrarRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = overflowPrevio;
      elementoPrevio?.focus();
    };
  }, [destino]);

  useEffect(() => {
    if (!destino || cantidadFotos === 0) return;

    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        onCerrar();
      } else if (evento.key === "ArrowRight") {
        setFotoActiva((actual) => (actual + 1) % cantidadFotos);
      } else if (evento.key === "ArrowLeft") {
        setFotoActiva(
          (actual) => (actual - 1 + cantidadFotos) % cantidadFotos
        );
      }
    };

    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [cantidadFotos, destino, onCerrar]);

  if (!categoria || cantidadFotos === 0) return null;

  const cambiarCategoria = (id: string) => {
    setCategoriaId(id);
    setFotoActiva(0);
  };

  const moverFoto = (direccion: number) => {
    setFotoActiva(
      (actual) => (actual + direccion + cantidadFotos) % cantidadFotos
    );
  };

  const finalizarToque = (evento: React.TouchEvent) => {
    const inicio = inicioToqueRef.current;
    inicioToqueRef.current = null;
    if (inicio === null) return;

    const diferencia = evento.changedTouches[0].clientX - inicio;
    if (Math.abs(diferencia) < 45) return;
    moverFoto(diferencia < 0 ? 1 : -1);
  };

  return (
    <div
      className={`${styles.overlay} ${modoNoche ? styles.night : ""}`}
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-galeria-entorno"
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Galería de fotos</span>
            <h2 id="titulo-galeria-entorno">{galeria.titulo}</h2>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            className={styles.close}
            onClick={onCerrar}
            aria-label="Cerrar galería"
          >
            <X aria-hidden="true" size={19} strokeWidth={2} />
          </button>
        </header>

        {galeria.categorias.length > 1 && (
          <nav className={styles.tabs} aria-label="Vistas de Las Lomas">
            {galeria.categorias.map((opcion) => {
              const activa = opcion.id === categoria.id;
              return (
                <button
                  key={opcion.id}
                  type="button"
                  className={activa ? styles.activeTab : ""}
                  aria-pressed={activa}
                  onClick={() => cambiarCategoria(opcion.id)}
                >
                  {opcion.label}
                </button>
              );
            })}
          </nav>
        )}

        <figure
          className={styles.stage}
          onTouchStart={(evento) => {
            inicioToqueRef.current = evento.touches[0].clientX;
          }}
          onTouchEnd={finalizarToque}
        >
          <Image
            key={categoria.fotos[fotoActiva].src}
            src={categoria.fotos[fotoActiva].src}
            alt={categoria.fotos[fotoActiva].alt}
            fill
            sizes="(max-width: 700px) 100vw, 1100px"
            className={styles.photo}
            draggable={false}
          />

          {cantidadFotos > 1 && (
            <>
              <button
                type="button"
                className={`${styles.arrow} ${styles.previous}`}
                onClick={() => moverFoto(-1)}
                aria-label="Ver fotografía anterior"
              >
                <ChevronLeft aria-hidden="true" size={21} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`${styles.arrow} ${styles.next}`}
                onClick={() => moverFoto(1)}
                aria-label="Ver fotografía siguiente"
              >
                <ChevronRight aria-hidden="true" size={21} strokeWidth={2} />
              </button>
            </>
          )}

          <figcaption className={styles.caption}>
            <span>{categoria.label}</span>
            <span>
              {fotoActiva + 1} / {cantidadFotos}
            </span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
