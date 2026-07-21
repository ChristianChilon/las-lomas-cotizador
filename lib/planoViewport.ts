export const ANCHO_PLANO = 998.637;
export const ALTO_PLANO = 1393.841;

export const esPantallaTactil = (ancho: number) => ancho <= 768;

export const calcularEscalaEncuadre = (
  anchoVentana: number,
  altoVentana: number
) => {
  const esMovil = esPantallaTactil(anchoVentana);
  const margenHorizontal = esMovil ? 12 : 32;
  const margenVertical = esMovil ? 16 : 28;
  const escalaPorAncho =
    (anchoVentana - margenHorizontal) / ANCHO_PLANO;
  const escalaPorAlto =
    (altoVentana - margenVertical) / ALTO_PLANO;
  const escala = Math.min(escalaPorAncho, escalaPorAlto);

  return Math.max(0.1, Math.min(1.15, escala));
};
