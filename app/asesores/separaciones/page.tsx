import AsesorLayout from "../../../components/layout/AsesorLayout";
import SeparacionesTable from "../../../components/separaciones/SeparacionesTable";

export default function AsesoresSeparacionesPage() {
  return (
    <AsesorLayout
      title="Separaciones"
      subtitle="Crea separaciones y cambia el estado del lote en una sola operacion."
    >
      <SeparacionesTable />
    </AsesorLayout>
  );
}
