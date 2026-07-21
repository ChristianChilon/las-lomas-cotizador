export const PASO_RUEDA_PLANO = 0.0005;
export const PASO_BOTON_PLANO = 0.14;
export const DURACION_BOTON_PLANO = 180;
export const PASO_PINZA_PLANO = 1;

export const calcularEscalaMinimaPlano = (escalaInicial: number) =>
  Math.max(0.1, escalaInicial * 0.72);
