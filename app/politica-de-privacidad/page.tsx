import type { Metadata } from "next";
import Link from "next/link";
import styles from "./politica.module.css";

export const metadata: Metadata = {
  title: "Política de privacidad | Las Lomas de Malabrigo",
  description:
    "Política de privacidad y tratamiento de datos personales de Las Lomas de Malabrigo.",
};

const EMAIL = "inmobiliariakomodo@gmail.com";

export default function PoliticaDePrivacidadPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <Link className={styles.back} href="/">
          ← Volver al cotizador
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Las Lomas de Malabrigo</span>
          <h1>Política de privacidad y tratamiento de datos personales</h1>
          <p className={styles.effective}>Vigente desde el 11 de julio de 2026</p>
        </header>

        <section>
          <h2>1. Responsable del tratamiento</h2>
          <p>
            El responsable del tratamiento de los datos personales es <strong>INMOBILIARIA
            KOMODO S.A.C.</strong>, con RUC N.° 20612152404, empresa responsable del
            proyecto inmobiliario <strong>Las Lomas de Malabrigo</strong>, con domicilio
            fiscal en Mz. M, lote 22, sector Natasha Alta (Torre UPAO), distrito y
            provincia de Trujillo, departamento de La Libertad, Perú.
          </p>
          <p>
            Para consultas sobre privacidad o para ejercer derechos sobre sus datos,
            puede escribir a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2>2. Datos que recopilamos</h2>
          <p>Cuando usted completa un formulario de Meta Ads, podemos recopilar:</p>
          <ul>
            <li>nombre;</li>
            <li>número de celular; y</li>
            <li>las respuestas que proporcione en el formulario.</li>
          </ul>
          <p>
            El formulario actual de Meta Ads <strong>no solicita DNI</strong>. También
            podremos registrar información generada durante la atención comercial,
            como fecha y canal de contacto, interés manifestado, citas, observaciones
            y estado del seguimiento.
          </p>
        </section>

        <section>
          <h2>3. Finalidades del tratamiento</h2>
          <p>Utilizaremos sus datos para:</p>
          <ul>
            <li>brindarle información sobre Las Lomas de Malabrigo;</li>
            <li>atender sus consultas y calificar comercialmente su interés;</li>
            <li>contactarlo por llamada telefónica o WhatsApp;</li>
            <li>coordinar visitas, reuniones o citas;</li>
            <li>realizar seguimiento a su solicitud e interés comercial; y</li>
            <li>mantener trazabilidad y control de la atención en nuestro CRM.</li>
          </ul>
          <p>
            Sus datos ingresarán al <strong>CRM de Las Lomas de Malabrigo</strong> y
            serán accesibles únicamente para personal autorizado que necesite tratarlos
            para estas finalidades. No serán utilizados para finalidades incompatibles
            sin informarle y, cuando corresponda, solicitar un nuevo consentimiento.
          </p>
        </section>

        <section>
          <h2>4. Base legal y carácter facultativo</h2>
          <p>
            El tratamiento se sustenta en el consentimiento que usted otorga al enviar
            voluntariamente el formulario y aceptar el aviso correspondiente, de acuerdo
            con la Ley N.° 29733, Ley de Protección de Datos Personales, y su Reglamento,
            aprobado por Decreto Supremo N.° 016-2024-JUS.
          </p>
          <p>
            Entregar sus datos es facultativo; sin embargo, si no proporciona al menos
            su nombre y un medio de contacto, no podremos responder ni brindarle la
            atención comercial solicitada. Puede revocar su consentimiento en cualquier
            momento, sin efecto retroactivo y sin afectar los tratamientos permitidos o
            exigidos por ley.
          </p>
        </section>

        <section>
          <h2>5. Proveedores, encargados y transferencias</h2>
          <p>
            Para captar, alojar, procesar y gestionar la información pueden intervenir
            proveedores tecnológicos que actúan como encargados o subencargados, entre
            ellos <strong>Meta</strong> (formularios publicitarios), <strong>Vercel</strong>
            (alojamiento y operación del sitio) y <strong>Supabase</strong> (base de datos
            e infraestructura del CRM). Según la ubicación de su infraestructura, el
            tratamiento puede implicar flujos transfronterizos de datos.
          </p>
          <p>
            Estos proveedores tratarán la información solo para prestar sus servicios,
            sujetos a sus obligaciones contractuales y medidas de seguridad. También
            podremos comunicar datos cuando exista una obligación legal o requerimiento
            válido de una autoridad competente.
          </p>
        </section>

        <section className={styles.highlight}>
          <h2>6. No vendemos sus datos</h2>
          <p>
            <strong>No vendemos ni alquilamos sus datos personales.</strong> Tampoco los
            entregamos a terceros para que realicen sus propias campañas comerciales
            independientes. El acceso de proveedores tecnológicos responde únicamente a
            la operación del servicio descrito en esta política.
          </p>
        </section>

        <section>
          <h2>7. Conservación y seguridad</h2>
          <p>
            Conservaremos sus datos mientras sean necesarios para atender y realizar el
            seguimiento de su interés comercial. Al terminar esa finalidad, los
            eliminaremos o anonimizaremos dentro de un plazo razonable, salvo que una
            obligación legal, una relación contractual o la necesidad de atender posibles
            responsabilidades justifique conservarlos por más tiempo.
          </p>
          <p>
            Aplicamos medidas organizativas y técnicas razonables para prevenir accesos,
            usos, alteraciones, pérdidas o divulgaciones no autorizadas. Ningún sistema es
            completamente infalible, por lo que revisamos y mejoramos estas medidas según
            los riesgos de la operación.
          </p>
        </section>

        <section>
          <h2>8. Sus derechos y cómo ejercerlos</h2>
          <p>
            Usted puede solicitar información y ejercer sus derechos de acceso,
            rectificación o actualización, cancelación o supresión y oposición (derechos
            ARCO), así como revocar su consentimiento cuando corresponda.
          </p>
          <p>
            Envíe su solicitud gratuita a <a href={`mailto:${EMAIL}`}>{EMAIL}</a> con el
            asunto <strong>“Derechos ARCO”</strong>. Indique su nombre completo, el derecho
            que desea ejercer, una descripción clara de su pedido, un medio para recibir
            la respuesta y la información necesaria para acreditar su identidad. Solo
            solicitaremos documentación adicional cuando resulte necesaria para validar
            al titular o a su representante.
          </p>
          <p>
            Atenderemos la solicitud dentro de los plazos establecidos por la normativa
            aplicable. Si considera que su solicitud no fue atendida adecuadamente, puede
            acudir a la Autoridad Nacional de Protección de Datos Personales del Ministerio
            de Justicia y Derechos Humanos.
          </p>
        </section>

        <section>
          <h2>9. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política para reflejar cambios legales, tecnológicos
            u operativos. La versión vigente estará siempre publicada en esta página e
            indicará su fecha de entrada en vigencia. Si un cambio exige un nuevo
            consentimiento, lo solicitaremos antes de aplicar el nuevo tratamiento.
          </p>
        </section>

        <footer className={styles.footer}>
          <p>INMOBILIARIA KOMODO S.A.C. · RUC 20612152404</p>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </footer>
      </article>
    </main>
  );
}
