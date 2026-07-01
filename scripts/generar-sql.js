const fs = require("fs");

const csv = fs.readFileSync(
  "C:/Users/LENOVO/Documents/path-verdemar-svg-idsvg.csv",
  "utf8"
);

const filas = csv
  .split(/\r?\n/)
  .slice(1)
  .filter(f => f.trim());

let sql = "";

for (const fila of filas) {
  const partes = fila.split(",");

  if (partes.length < 3) continue;

  const mz = partes[0].trim();
  const lote = partes[1].trim();
  const svg_id = partes[2].trim();

  if (!mz || !lote || !svg_id) continue;

  sql += `
UPDATE lotes
SET svg_id='${svg_id}'
WHERE mz='${mz}'
AND lote=${Number(lote)};
`;
}

fs.writeFileSync(
  "actualizar_svg.sql",
  sql
);

console.log("SQL generado correctamente");