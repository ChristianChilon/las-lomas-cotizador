const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const inputSvg = path.join(root, "public", "plano-0-svg.svg");
const outputBase = path.join(root, "public", "plano-base.webp");
const outputLotes = path.join(root, "public", "plano-lotes.svg");

const attr = (source, name) => {
  const match = source.match(
    new RegExp(`(?:^|\\s)${name}="([^"]+)"`)
  );
  return match ? match[1] : "";
};

const svg = fs.readFileSync(inputSvg, "utf8");
const svgOpen = svg.match(/<svg\b([^>]*)>/);

if (!svgOpen) {
  throw new Error("No se encontro la etiqueta <svg> en el plano.");
}

const width = attr(svgOpen[1], "width") || "999.809";
const height = attr(svgOpen[1], "height") || "1394.93";
const viewBox = attr(svgOpen[1], "viewBox") || `0 0 ${width} ${height}`;

const lotGroup = svg.match(
  /<g\b([^>]*id="g19863"[^>]*)>([\s\S]*?)<\/g>/
);

if (!lotGroup) {
  throw new Error("No se encontro el grupo de paths de lotes.");
}

const groupTransform = attr(lotGroup[1], "transform");
const lotPaths = [...lotGroup[2].matchAll(/<path\b([^>]*id="path(?:196[5-9]\d|197\d\d|198[0-5]\d|1986[0-3])"[^>]*)\/?>/g)]
  .map(([, attrs]) => {
    const id = attr(attrs, "id");
    const d = attr(attrs, "d");

    return `  <path id="${id}" d="${d}" vector-effect="non-scaling-stroke"/>`;
  });

if (lotPaths.length !== 206) {
  throw new Error(
    `Se esperaban 206 lotes, pero se encontraron ${lotPaths.length}.`
  );
}

const lotesSvg = [
  `<svg id="plano-lotes" width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`,
  " <style>",
  "  path { fill: transparent; stroke: transparent; pointer-events: all; }",
  " </style>",
  ` <g id="CAPA_LOTES"${groupTransform ? ` transform="${groupTransform}"` : ""}>`,
  ...lotPaths,
  " </g>",
  ' <g id="CAPA_RESALTADO"></g>',
  "</svg>",
  "",
].join("\n");

fs.writeFileSync(outputLotes, lotesSvg, "utf8");

sharp(inputSvg, { density: 216 })
  .webp({
    quality: 88,
    effort: 6,
  })
  .toFile(outputBase)
  .then((info) => {
    console.log(
      JSON.stringify(
        {
          base: outputBase,
          lotes: outputLotes,
          lotesEncontrados: lotPaths.length,
          imagen: {
            width: info.width,
            height: info.height,
            size: info.size,
          },
        },
        null,
        2
      )
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
