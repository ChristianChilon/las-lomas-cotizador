import type { Metadata } from "next";
import Link from "next/link";
import styles from "../politica-de-privacidad/politica.module.css";

export const metadata: Metadata = {
  title: "Terminos y condiciones | Las Lomas de Malabrigo",
  description:
    "Terminos y condiciones de uso del sitio de Las Lomas de Malabrigo.",
};

const EMAIL = "inmobiliariakomodo@gmail.com";

export default function TerminosYCondicionesPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <Link className={styles.back} href="/">
          &larr; Volver al cotizador
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Las Lomas de Malabrigo</span>
          <h1>Terminos y condiciones de uso</h1>
          <p className={styles.effective}>Vigentes desde el 14 de julio de 2026</p>
        </header>

        <section>
          <h2>1. Identificacion del responsable</h2>
          <p>
            Este sitio es operado por <strong>INMOBILIARIA KOMODO S.A.C.</strong>, con
            RUC N.&deg; 20612152404, responsable de la comercializacion del proyecto
            inmobiliario <strong>Las Lomas de Malabrigo</strong>, ubicado en el Predio
            La Pampa, distrito de Razuri, provincia de Ascope, departamento de La
            Libertad, Peru.
          </p>
        </section>

        <section>
          <h2>2. Finalidad del sitio</h2>
          <p>
            El sitio permite consultar informacion comercial del proyecto, visualizar
            la ubicacion, area y estado referencial de los lotes, solicitar una
            cotizacion y comunicarse con el equipo comercial. El uso del sitio implica
            la aceptacion de estos terminos.
          </p>
        </section>

        <section>
          <h2>3. Informacion comercial y disponibilidad</h2>
          <p>
            Los precios, cuotas, areas, promociones, estados y demas datos publicados
            tienen caracter informativo y pueden actualizarse. La disponibilidad de un
            lote se confirma al momento de la atencion comercial y no queda reservada
            por seleccionar el lote, completar un formulario o recibir una cotizacion.
          </p>
          <p>
            Una separacion, compraventa o financiamiento solo produce los efectos que
            correspondan cuando se cumplen sus condiciones y se formaliza mediante los
            documentos aplicables aceptados por las partes.
          </p>
        </section>

        <section>
          <h2>4. Uso permitido</h2>
          <p>El usuario se compromete a:</p>
          <ul>
            <li>proporcionar informacion verdadera y actualizada;</li>
            <li>utilizar el sitio para fines licitos y personales;</li>
            <li>no intentar alterar, bloquear o acceder sin autorizacion al sistema; y</li>
            <li>no copiar ni explotar comercialmente sus contenidos sin autorizacion.</li>
          </ul>
        </section>

        <section>
          <h2>5. Propiedad intelectual</h2>
          <p>
            Los planos, fotografias, marcas, logotipos, textos, diseños y contenidos
            del sitio pertenecen a sus respectivos titulares y se encuentran protegidos
            por la normativa aplicable. Su consulta no concede licencias ni derechos de
            reproduccion, modificacion o distribucion.
          </p>
        </section>

        <section>
          <h2>6. Datos personales</h2>
          <p>
            El tratamiento de datos personales se rige por nuestra{" "}
            <Link href="/politica-de-privacidad">Politica de privacidad</Link>. Las
            solicitudes de eliminacion pueden presentarse siguiendo las{" "}
            <Link href="/eliminacion-de-datos">instrucciones de eliminacion de datos</Link>.
          </p>
        </section>

        <section>
          <h2>7. Disponibilidad del servicio</h2>
          <p>
            Procuramos mantener el sitio disponible y su informacion actualizada, pero
            pueden producirse interrupciones por mantenimiento, fallas tecnicas o causas
            ajenas a nuestro control. Corregiremos los errores identificados dentro de
            un plazo razonable.
          </p>
        </section>

        <section>
          <h2>8. Legislacion aplicable</h2>
          <p>
            Estos terminos se interpretan conforme a la legislacion peruana. Cualquier
            controversia se procurara resolver primero mediante comunicacion directa y,
            de persistir, ante las autoridades competentes conforme a ley.
          </p>
        </section>

        <section>
          <h2>9. Contacto y actualizaciones</h2>
          <p>
            Podemos actualizar estos terminos para reflejar cambios legales, tecnicos o
            comerciales. La version vigente se publicara en esta pagina. Para consultas,
            escriba a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </section>

        <footer className={styles.footer}>
          <p>INMOBILIARIA KOMODO S.A.C. &middot; RUC 20612152404</p>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </footer>
      </article>
    </main>
  );
}
