import HistorialTable from "../../../components/historial/HistorialTable";
import AsesorLayout from "../../../components/layout/AsesorLayout";

export default function AsesoresHistorialPage() {
  return (
    <AsesorLayout
      title="Historial de lotes"
      subtitle="Auditoria de cambios de estado y asignaciones."
    >
      <HistorialTable />
    </AsesorLayout>
  );
}
