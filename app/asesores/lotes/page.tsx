import AsesorLayout from "../../../components/layout/AsesorLayout";
import LotesTable from "../../../components/lotes/LotesTable";

export default function AsesoresLotesPage() {
  return (
    <AsesorLayout
      title="Gestion de lotes"
      subtitle="Actualiza disponibilidad, separaciones y ventas sin tocar el cotizador publico."
    >
      <LotesTable />
    </AsesorLayout>
  );
}
