import type { Cliente } from "./crm";

export type ConfiguracionComercial = {
  project_key: string;
  sla_primer_contacto_minutos: number;
  cadencia_caliente_dias: number;
  cadencia_tibio_dias: number;
  cadencia_frio_dias: number;
  alerta_separacion_dias: number;
  hora_inicio: string;
  hora_fin: string;
  atender_sabado: boolean;
  atender_domingo: boolean;
};

export const CONFIGURACION_COMERCIAL_BASE: ConfiguracionComercial = {
  project_key: "las_lomas",
  sla_primer_contacto_minutos: 30,
  cadencia_caliente_dias: 2,
  cadencia_tibio_dias: 4,
  cadencia_frio_dias: 7,
  alerta_separacion_dias: 3,
  hora_inicio: "08:00:00",
  hora_fin: "20:00:00",
  atender_sabado: true,
  atender_domingo: true,
};

const minutosHora = (hora: string) => {
  const [horas, minutos] = hora.split(":").map(Number);

  return (horas || 0) * 60 + (minutos || 0);
};

const esDiaAtencion = (
  fecha: Date,
  configuracion: ConfiguracionComercial
) => {
  const dia = fecha.getDay();

  if (dia === 6 && !configuracion.atender_sabado) return false;
  if (dia === 0 && !configuracion.atender_domingo) return false;

  return true;
};

const crearFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return null;

  const fecha = valor instanceof Date ? new Date(valor) : new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const minutosAtencionEntre = (
  fechaInicio: string | Date | null | undefined,
  fechaFin: string | Date | null | undefined,
  configuracion: ConfiguracionComercial
) => {
  const inicio = crearFecha(fechaInicio);
  const fin = crearFecha(fechaFin);

  if (!inicio || !fin || fin.getTime() <= inicio.getTime()) return 0;

  const inicioMinutos = minutosHora(configuracion.hora_inicio);
  const finMinutos = minutosHora(configuracion.hora_fin);
  const cursor = new Date(
    inicio.getFullYear(),
    inicio.getMonth(),
    inicio.getDate()
  );
  let total = 0;

  for (let dias = 0; dias < 3700 && cursor <= fin; dias += 1) {
    if (esDiaAtencion(cursor, configuracion)) {
      const apertura = new Date(cursor);
      apertura.setMinutes(inicioMinutos);

      const cierre = new Date(cursor);
      cierre.setMinutes(finMinutos);

      const tramoInicio = Math.max(apertura.getTime(), inicio.getTime());
      const tramoFin = Math.min(cierre.getTime(), fin.getTime());

      if (tramoFin > tramoInicio) total += tramoFin - tramoInicio;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.floor(total / 60000);
};

export const minutosAtencionTranscurridos = (
  fechaInicio: string | Date | null | undefined,
  configuracion: ConfiguracionComercial
) => minutosAtencionEntre(fechaInicio, new Date(), configuracion);

export const diasDesde = (
  fechaInicio: string | Date | null | undefined,
  fechaFin: string | Date = new Date()
) => {
  const inicio = crearFecha(fechaInicio);
  const fin = crearFecha(fechaFin);

  if (!inicio || !fin) return 0;

  return Math.max(
    0,
    Math.floor((fin.getTime() - inicio.getTime()) / 86400000)
  );
};

export const formatearDuracion = (minutos: number) => {
  if (minutos < 60) return `${Math.max(0, minutos)} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  return resto ? `${horas} h ${resto} min` : `${horas} h`;
};

export const diasCadencia = (
  cliente: Pick<Cliente, "nivel_interes">,
  configuracion: ConfiguracionComercial
) => {
  if (cliente.nivel_interes === "CALIENTE") {
    return configuracion.cadencia_caliente_dias;
  }

  if (cliente.nivel_interes === "TIBIO") {
    return configuracion.cadencia_tibio_dias;
  }

  return configuracion.cadencia_frio_dias;
};
