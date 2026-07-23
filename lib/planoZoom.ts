export const PASO_RUEDA_PLANO = 0.0025;
export const PASO_BOTON_PLANO = 0.35;
export const DURACION_BOTON_PLANO = 240;
export const PASO_PINZA_PLANO = 6;

export const calcularEscalaMinimaPlano = (escalaInicial: number) =>
  Math.max(0.1, escalaInicial * 0.72);
