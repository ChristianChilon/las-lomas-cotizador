import AsesorLayout from "../../../components/layout/AsesorLayout";
import SeparacionesTable from "../../../components/separaciones/SeparacionesTable";

export default function AsesoresSeparacionesPage() {
  return (
    <AsesorLayout
      title="Separaciones"
      subtitle="Controla vencimientos, liberaciones y el expediente documental de cada separacion."
    >
      <SeparacionesTable />
    </AsesorLayout>
  );
}
