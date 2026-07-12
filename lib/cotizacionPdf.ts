export type DatosPdfCotizacion = {
  numero: string;
  version: number;
  fechaEmision: string;
  validaHasta: string;
  cliente: string;
  dni?: string | null;
  celular?: string | null;
  correo?: string | null;
  manzana: string;
  lote: number;
  area: number;
  precioLista: number;
  precioOfertado: number;
  descuentoMonto: number;
  descuentoPorcentaje: number;
  montoSeparacion: number;
  inicial: number;
  saldoFinanciar: number;
  meses: number;
  cuotaMensual: number;
  asesor: string;
  telefonoAsesor?: string | null;
  observaciones?: string | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

const normalizarTextoPdf = (valor: string | number | null | undefined) =>
  String(valor ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");

const escaparTextoPdf = (valor: string | number | null | undefined) =>
  normalizarTextoPdf(valor)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");

const formatearMoneda = (valor: number) =>
  `S/ ${Number(valor || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatearFecha = (valor: string) => {
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
};

const envolver = (texto: string, maximo: number) => {
  const palabras = normalizarTextoPdf(texto).split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";

  palabras.forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra;

    if (prueba.length <= maximo) {
      actual = prueba;
      return;
    }

    if (actual) lineas.push(actual);
    actual = palabra;
  });

  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
};

const color = (hex: string) => {
  const valor = hex.replace("#", "");
  const partes = [0, 2, 4].map(
    (inicio) => parseInt(valor.slice(inicio, inicio + 2), 16) / 255
  );

  return partes.map((parte) => parte.toFixed(3)).join(" ");
};

const crearContenido = (datos: DatosPdfCotizacion) => {
  const comandos: string[] = [];
  const rojo = "#991b1b";
  const verde = "#123f30";
  const texto = "#20252b";
  const suave = "#667085";
  const borde = "#e4d9d9";
  const fondo = "#fffafa";

  const textoPdf = (
    x: number,
    top: number,
    size: number,
    valor: string | number,
    opciones: {
      bold?: boolean;
      fill?: string;
      align?: "left" | "right" | "center";
      width?: number;
    } = {}
  ) => {
    const fuente = opciones.bold ? "F2" : "F1";
    const fill = color(opciones.fill || texto);
    const textoEscapado = escaparTextoPdf(valor);
    const anchoAproximado = textoEscapado.length * size * 0.5;
    let posicionX = x;

    if (opciones.align === "right" && opciones.width) {
      posicionX = x + opciones.width - anchoAproximado;
    }

    if (opciones.align === "center" && opciones.width) {
      posicionX = x + (opciones.width - anchoAproximado) / 2;
    }

    const y = PAGE_HEIGHT - top - size;
    comandos.push(
      `${fill} rg BT /${fuente} ${size} Tf 1 0 0 1 ${posicionX.toFixed(
        2
      )} ${y.toFixed(2)} Tm (${textoEscapado}) Tj ET`
    );
  };

  const multilinea = (
    x: number,
    top: number,
    size: number,
    valor: string,
    maximo: number,
    opciones: { bold?: boolean; fill?: string; lineHeight?: number } = {}
  ) => {
    const lineHeight = opciones.lineHeight || size + 5;
    const lineas = envolver(valor, maximo);

    lineas.forEach((linea, index) =>
      textoPdf(x, top + index * lineHeight, size, linea, opciones)
    );

    return top + lineas.length * lineHeight;
  };

  const rectangulo = (
    x: number,
    top: number,
    width: number,
    height: number,
    fill: string,
    stroke = borde
  ) => {
    const y = PAGE_HEIGHT - top - height;
    comandos.push(
      `${color(fill)} rg ${color(stroke)} RG 1 w ${x} ${y} ${width} ${height} re B`
    );
  };

  const linea = (x1: number, top: number, x2: number, stroke = borde) => {
    const y = PAGE_HEIGHT - top;
    comandos.push(`${color(stroke)} RG 1 w ${x1} ${y} m ${x2} ${y} l S`);
  };

  textoPdf(MARGIN, 40, 22, "LAS LOMAS DE MALABRIGO", {
    bold: true,
    fill: verde,
  });
  textoPdf(MARGIN, 69, 10, "INMOBILIARIA KOMODO S.A.C. | RUC 20612152404", {
    bold: true,
    fill: suave,
  });
  textoPdf(365, 40, 19, "COTIZACION COMERCIAL", {
    bold: true,
    fill: rojo,
  });
  textoPdf(365, 69, 10, `${datos.numero} | Version ${datos.version}`, {
    bold: true,
    fill: suave,
  });
  linea(MARGIN, 95, PAGE_WIDTH - MARGIN, rojo);

  rectangulo(MARGIN, 116, 240, 112, fondo);
  textoPdf(64, 132, 10, "CLIENTE", { bold: true, fill: rojo });
  multilinea(64, 151, 16, datos.cliente, 28, { bold: true, lineHeight: 19 });
  textoPdf(64, 194, 9, `DNI: ${datos.dni || "-"}`, { fill: suave });
  textoPdf(64, 209, 9, `Celular: ${datos.celular || "-"}`, { fill: suave });

  rectangulo(307, 116, 240, 112, fondo);
  textoPdf(323, 132, 10, "LOTE COTIZADO", { bold: true, fill: rojo });
  textoPdf(323, 153, 18, `MZ ${datos.manzana} - LOTE ${datos.lote}`, {
    bold: true,
  });
  textoPdf(323, 181, 10, `Area: ${datos.area.toFixed(2)} m2`, { fill: suave });
  textoPdf(323, 199, 10, `Valida hasta: ${formatearFecha(datos.validaHasta)}`, {
    bold: true,
    fill: rojo,
  });

  textoPdf(MARGIN, 260, 16, "Propuesta economica", { bold: true, fill: rojo });
  rectangulo(MARGIN, 286, PAGE_WIDTH - MARGIN * 2, 218, "#ffffff");

  const fila = (top: number, etiqueta: string, valor: string, destacado = false) => {
    textoPdf(68, top, 11, etiqueta, { fill: destacado ? texto : suave, bold: destacado });
    textoPdf(340, top, 12, valor, {
      bold: true,
      fill: destacado ? rojo : texto,
      align: "right",
      width: 175,
    });
  };

  fila(307, "Precio de lista", formatearMoneda(datos.precioLista));
  fila(337, "Descuento comercial", `${formatearMoneda(datos.descuentoMonto)} (${datos.descuentoPorcentaje.toFixed(2)}%)`);
  fila(367, "Precio ofertado", formatearMoneda(datos.precioOfertado), true);
  linea(68, 394, 515);
  fila(407, "Monto de separacion", formatearMoneda(datos.montoSeparacion));
  fila(437, "Inicial propuesta", formatearMoneda(datos.inicial));
  fila(467, `Saldo en ${datos.meses} cuotas`, formatearMoneda(datos.saldoFinanciar));
  fila(487, "Cuota mensual estimada", formatearMoneda(datos.cuotaMensual), true);

  textoPdf(MARGIN, 538, 16, "Condiciones de la propuesta", { bold: true, fill: rojo });
  let topCondicion = 566;
  const condiciones = [
    `La presente propuesta es valida hasta el ${formatearFecha(datos.validaHasta)} y esta sujeta a la disponibilidad del lote al momento de formalizar la separacion.`,
    "La cotizacion no bloquea ni reserva el lote. La reserva comercial se produce unicamente al registrar la separacion y verificar el pago correspondiente.",
    `El financiamiento mostrado es referencial: ${datos.meses} cuotas de ${formatearMoneda(datos.cuotaMensual)}, calculadas sobre un saldo de ${formatearMoneda(datos.saldoFinanciar)}.`,
    "Cualquier modificacion de precio, inicial, plazo o descuento genera una nueva version de la cotizacion.",
  ];

  condiciones.forEach((condicion, index) => {
    textoPdf(58, topCondicion, 10, `${index + 1}.`, { bold: true, fill: rojo });
    topCondicion = multilinea(76, topCondicion, 10, condicion, 92, {
      fill: texto,
      lineHeight: 14,
    }) + 5;
  });

  if (datos.observaciones) {
    textoPdf(MARGIN, topCondicion + 3, 10, "Observaciones", { bold: true, fill: rojo });
    topCondicion = multilinea(
      MARGIN,
      topCondicion + 21,
      9,
      datos.observaciones.slice(0, 240),
      102,
      { fill: suave, lineHeight: 13 }
    );
  }

  linea(MARGIN, 748, PAGE_WIDTH - MARGIN);
  textoPdf(MARGIN, 765, 10, `Asesor: ${datos.asesor}`, { bold: true });
  textoPdf(MARGIN, 783, 9, `Celular: ${datos.telefonoAsesor || "-"}`, { fill: suave });
  textoPdf(315, 765, 9, `Emision: ${formatearFecha(datos.fechaEmision)}`, { fill: suave });
  textoPdf(315, 783, 9, "INTERBANK | Cuenta 600-3005917902", { fill: suave });
  textoPdf(MARGIN, 813, 8, "Las Lomas de Malabrigo | inmobiliariakomodo@gmail.com | 933008638", {
    bold: true,
    fill: rojo,
  });

  return comandos.join("\n");
};

const crearPdfBinario = (contenido: string) => {
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];

  objetos.forEach((objeto, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = Uint8Array.from(pdf, (caracter) => caracter.charCodeAt(0) & 255);
  return new Blob([bytes], { type: "application/pdf" });
};

export const crearPdfCotizacion = (datos: DatosPdfCotizacion) =>
  crearPdfBinario(crearContenido(datos));
