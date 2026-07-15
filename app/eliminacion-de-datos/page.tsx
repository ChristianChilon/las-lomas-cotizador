import type { Metadata } from "next";
import Link from "next/link";
import styles from "../politica-de-privacidad/politica.module.css";

export const metadata: Metadata = {
  title: "Eliminacion de datos | Las Lomas de Malabrigo",
  description:
    "Instrucciones para solicitar la eliminacion de datos personales en Las Lomas de Malabrigo.",
};

const EMAIL = "inmobiliariakomodo@gmail.com";

export default function EliminacionDeDatosPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <Link className={styles.back} href="/">
          &larr; Volver al cotizador
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Las Lomas de Malabrigo</span>
          <h1>Instrucciones para eliminar sus datos</h1>
          <p className={styles.effective}>Actualizadas el 14 de julio de 2026</p>
        </header>

        <section>
          <h2>1. Como presentar la solicitud</h2>
          <p>
            Puede solicitar la eliminacion de los datos personales proporcionados a
            traves de nuestros formularios, anuncios de Meta, sitio web o canales de
            atencion. Envie un correo a <a href={`mailto:${EMAIL}`}>{EMAIL}</a> con el
            asunto <strong>&quot;Eliminacion de datos personales&quot;</strong>.
          </p>
        </section>

        <section>
          <h2>2. Informacion necesaria</h2>
          <p>Incluya en su solicitud:</p>
          <ul>
            <li>su nombre completo;</li>
            <li>el celular o correo utilizado al registrarse;</li>
            <li>una descripcion clara de los datos que desea eliminar; y</li>
            <li>un medio para comunicarle la respuesta.</li>
          </ul>
          <p>
            Para proteger su informacion podremos solicitar datos adicionales
            estrictamente necesarios para verificar su identidad. No envie contraseñas
            ni informacion bancaria.
          </p>
        </section>

        <section className={styles.highlight}>
          <h2>3. Atencion de la solicitud</h2>
          <p>
            Confirmaremos la recepcion y atenderemos su pedido dentro de los plazos
            establecidos por la normativa peruana de proteccion de datos personales.
            Una vez completada la eliminacion, le enviaremos una confirmacion al medio
            de contacto indicado.
          </p>
        </section>

        <section>
          <h2>4. Alcance y excepciones</h2>
          <p>
            Eliminaremos o anonimizaremos la informacion asociada a la atencion
            comercial cuando corresponda. Determinados datos podran conservarse si
            existe una obligacion legal, una relacion contractual vigente, una
            operacion inmobiliaria formalizada o la necesidad de atender posibles
            responsabilidades. En ese caso se restringira su uso y se informara el
            motivo aplicable.
          </p>
        </section>

        <section>
          <h2>5. Otras solicitudes sobre sus datos</h2>
          <p>
            Tambien puede solicitar acceso, rectificacion, actualizacion u oposicion al
            tratamiento de sus datos. Consulte la{" "}
            <Link href="/politica-de-privacidad">Politica de privacidad</Link> para
            conocer sus derechos y el tratamiento que realizamos.
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
