import AsesorLayout from "../../../components/layout/AsesorLayout";
import CotizacionesTable from "../../../components/cotizaciones/CotizacionesTable";

export default function CotizacionesPage() {
  return (
    <AsesorLayout
      title="Cotizaciones"
      subtitle="Crea propuestas versionadas, controla su vigencia y conviértelas en separaciones sin duplicar datos."
    >
      <CotizacionesTable />
    </AsesorLayout>
  );
}
