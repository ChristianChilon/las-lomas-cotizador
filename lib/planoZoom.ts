export const PASO_RUEDA_PLANO = 0.001;
export const PASO_BOTON_PLANO = 0.18;
export const DURACION_BOTON_PLANO = 240;
export const PASO_PINZA_PLANO = 5;

export const calcularEscalaMinimaPlano = (escalaInicial: number) =>
  Math.max(0.1, escalaInicial * 0.72);
