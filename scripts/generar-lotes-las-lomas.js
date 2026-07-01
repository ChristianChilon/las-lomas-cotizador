const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const svgPath =
  process.argv[2] ||
  path.join(root, "public", "plano-0-svg.svg");
const outputPath =
  process.argv[3] ||
  path.join(root, "public", "lotes.json");
const precioM2 = Number(process.env.PRECIO_M2 || "250");

const svg = fs.readFileSync(svgPath, "utf8");

const attr = (source, name) => {
  const match = source.match(
    new RegExp(`(?:^|\\s)${name}="([^"]+)"`)
  );
  return match ? match[1] : "";
};

const stripTags = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const rotatePoint = (x, y, angle, cx = 0, cy = 0) => {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
};

const pointForText = (text) => {
  const rotate = text.transform.match(
    /rotate\(([-\d.]+)(?:\s+([-\d.]+)\s+([-\d.]+))?\)/
  );

  if (!rotate) {
    return {
      x: text.x,
      y: text.y,
    };
  }

  return rotatePoint(
    text.x,
    text.y,
    Number(rotate[1]),
    Number(rotate[2] || 0),
    Number(rotate[3] || 0)
  );
};

const texts = [
  ...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g),
].map(([, attrs, inner]) => {
  const text = {
    id: attr(attrs, "id"),
    x: Number(attr(attrs, "x")),
    y: Number(attr(attrs, "y")),
    transform: attr(attrs, "transform"),
    value: stripTags(inner),
  };

  return {
    ...text,
    point: pointForText(text),
  };
});

const tokenizePath = (d) =>
  d.match(
    /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g
  ) || [];

const isCommand = (token) => /^[a-zA-Z]$/.test(token);

const bboxForPath = (d) => {
  const tokens = tokenizePath(d);
  let i = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const read = () => Number(tokens[i++]);
  const hasNumber = () =>
    i < tokens.length && !isCommand(tokens[i]);
  const include = (px, py) => {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  const point = (px, py, relative) => {
    x = relative ? x + px : px;
    y = relative ? y + py : py;
    include(x, y);
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      command = tokens[i++];
    }

    const relative = command === command.toLowerCase();
    const cmd = command.toLowerCase();

    if (cmd === "m") {
      let first = true;

      while (hasNumber()) {
        const px = read();
        const py = read();
        point(px, py, relative);

        if (first) {
          startX = x;
          startY = y;
          first = false;
        }
      }
      command = relative ? "l" : "L";
    } else if (cmd === "l" || cmd === "t") {
      while (hasNumber()) {
        point(read(), read(), relative);
      }
    } else if (cmd === "h") {
      while (hasNumber()) {
        point(read(), 0, true);
      }
    } else if (cmd === "v") {
      while (hasNumber()) {
        point(0, read(), true);
      }
    } else if (cmd === "c") {
      while (hasNumber()) {
        point(read(), read(), relative);
        point(read(), read(), relative);
        point(read(), read(), relative);
      }
    } else if (cmd === "s" || cmd === "q") {
      while (hasNumber()) {
        point(read(), read(), relative);
        point(read(), read(), relative);
      }
    } else if (cmd === "a") {
      while (hasNumber()) {
        const rx = read();
        const ry = read();
        read();
        read();
        read();
        const px = read();
        const py = read();

        include(x - rx, y - ry);
        include(x + rx, y + ry);
        point(px, py, relative);
      }
    } else if (cmd === "z") {
      x = startX;
      y = startY;
      include(x, y);
    } else {
      break;
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
};

const paths = [
  ...svg.matchAll(/<path\b([^>]*)\/?>/g),
].map(([, attrs]) => {
  const id = attr(attrs, "id");
  const d = attr(attrs, "d");

  return {
    id,
    n: Number(id.replace(/^path/, "")),
    d,
    bbox: bboxForPath(d),
  };
});

const lotPaths = paths.filter(
  (item) => item.n >= 19658 && item.n <= 19863
);

const blockPaths = paths.filter(
  (item) => item.n >= 48304 && item.n <= 48315
);

const areaTexts = texts
  .filter((text) => /^\d+(?:\.\d+)?\s*m2$/i.test(text.value))
  .map((text) => ({
    ...text,
    area: Number(text.value.replace(/\s*m2/i, "")),
  }));

const lotNumberTexts = texts
  .filter((text) => {
    const n = Number(text.id.replace(/^text/, ""));
    return n >= 48316 && /^\d{1,3}$/.test(text.value);
  })
  .map((text) => ({
    ...text,
    lote: Number(text.value),
  }));

const manzanaTexts = texts.filter((text) => {
  const n = Number(text.id.replace(/^text/, ""));
  return n >= 48316 && /^[A-Z]$/.test(text.value);
});

const distance = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const contains = (bbox, point, expand = 10) =>
  point.x >= bbox.minX - expand &&
  point.x <= bbox.maxX + expand &&
  point.y >= bbox.minY - expand &&
  point.y <= bbox.maxY + expand;

const matchTexts = (items, sourceTexts) => {
  const matches = new Map();
  const used = new Set();
  const candidates = [];

  for (const item of items) {
    for (const text of sourceTexts) {
      if (contains(item.bbox, text.point)) {
        candidates.push({
          item,
          text,
          score: distance(
            { x: item.bbox.cx, y: item.bbox.cy },
            text.point
          ),
        });
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (
      matches.has(candidate.item.id) ||
      used.has(candidate.text.id)
    ) {
      continue;
    }

    matches.set(candidate.item.id, candidate.text);
    used.add(candidate.text.id);
  }

  for (const item of items) {
    if (matches.has(item.id)) {
      continue;
    }

    const available = sourceTexts
      .filter((text) => !used.has(text.id))
      .map((text) => ({
        text,
        score: distance(
          { x: item.bbox.cx, y: item.bbox.cy },
          text.point
        ),
      }))
      .sort((a, b) => a.score - b.score);

    if (available[0]) {
      matches.set(item.id, available[0].text);
      used.add(available[0].text.id);
    }
  }

  return matches;
};

const areaByPath = matchTexts(lotPaths, areaTexts);
const numberByPath = matchTexts(lotPaths, lotNumberTexts);

const bboxArea = (bbox) =>
  Math.abs((bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY));

const blockNames = new Map(
  blockPaths.map((block) => {
    const center = {
      x: block.bbox.cx,
      y: block.bbox.cy,
    };

    const nearest = manzanaTexts
      .map((text) => ({
        text,
        score: distance(center, text.point),
      }))
      .sort((a, b) => a.score - b.score)[0];

    return [block.id, nearest?.text.value || "A"];
  })
);

const manzanaForPath = (item) => {
  const center = {
    x: item.bbox.cx,
    y: item.bbox.cy,
  };

  const containingBlock = blockPaths
    .filter((block) => contains(block.bbox, center, 2))
    .map((block) => ({
      block,
      area: bboxArea(block.bbox),
    }))
    .sort((a, b) => a.area - b.area)[0];

  if (containingBlock) {
    return blockNames.get(containingBlock.block.id) || "A";
  }

  const nearestBlock = blockPaths
    .map((block) => ({
      block,
      score: distance(center, {
        x: block.bbox.cx,
        y: block.bbox.cy,
      }),
    }))
    .sort((a, b) => a.score - b.score)[0];

  return nearestBlock
    ? blockNames.get(nearestBlock.block.id) || "A"
    : "A";
};

const lotes = lotPaths
  .map((item) => {
    const area = areaByPath.get(item.id);
    const number = numberByPath.get(item.id);
    const areaValue = area?.area || 0;

    return {
      id: 0,
      mz: manzanaForPath(item),
      lote: number?.lote || item.n - 19657,
      area: areaValue,
      precio: Number((areaValue * precioM2).toFixed(2)),
      estado: "DISPONIBLE",
      svg_id: item.id,
    };
  })
  .sort(
    (a, b) =>
      a.mz.localeCompare(b.mz, "es") ||
      a.lote - b.lote ||
      a.svg_id.localeCompare(b.svg_id)
  )
  .map((lote, index) => ({
    ...lote,
    id: index + 1,
  }));

fs.writeFileSync(
  outputPath,
  JSON.stringify(lotes, null, 2),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      lotes: lotes.length,
      areas: areaTexts.length,
      numeros: lotNumberTexts.length,
      manzanas: manzanaTexts.length,
      bloques: blockPaths.length,
      precioM2,
      salida: outputPath,
    },
    null,
    2
  )
);
