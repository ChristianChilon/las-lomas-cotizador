import ClientesTable from "../../../components/clientes/ClientesTable";
import AsesorLayout from "../../../components/layout/AsesorLayout";

export default function AsesoresClientesPage() {
  return (
    <AsesorLayout
      title="Clientes"
      subtitle="Registra prospectos y mantenlos asociados al asesor responsable."
    >
      <ClientesTable />
    </AsesorLayout>
  );
}
