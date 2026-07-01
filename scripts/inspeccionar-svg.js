const fs = require("fs");

const svg = fs.readFileSync(
  "./public/plano-0-svg.svg",
  "utf8"
);

const textos = [
  ...svg.matchAll(
    /<text[\s\S]*?x="([^"]+)"[\s\S]*?y="([^"]+)"[\s\S]*?id="([^"]+)"[\s\S]*?<tspan[\s\S]*?>(.*?)<\/tspan>/g
  ),
].map((x) => ({
  x: Number(x[1]),
  y: Number(x[2]),
  id: x[3],
  texto: x[4].trim(),
}));

const lotes = textos.filter(
  (t) =>
    t.texto.startsWith("LOTE ")
);

const manzanas = textos.filter(
  (t) =>
    /^[A-Z]$/.test(t.texto)
);

fs.writeFileSync(
  "lotes.json",
  JSON.stringify(
    {
      lotes,
      manzanas,
    },
    null,
    2
  )
);

console.log(
  "Archivo generado: lotes.json"
);

console.log(
  "Lotes:",
  lotes.length
);

console.log(
  "Manzanas:",
  manzanas.length
);