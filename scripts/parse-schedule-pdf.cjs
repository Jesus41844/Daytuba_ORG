#!/usr/bin/env node

// Standalone script: parsea un PDF de horario UTP y extrae materias con coordenadas.
// Se ejecuta via child_process desde la Server Action, fuera de Turbopack.
// Usage: node parse-schedule-pdf.mjs <path-to-pdf>
// Output: JSON array de { str, x, y }

const fs = require("fs");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");

const pdfPath = process.argv[2];
if (!pdfPath) {
  process.stderr.write("Usage: node parse-schedule-pdf.mjs <pdf-path>\n");
  process.exit(1);
}

async function main() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const items = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        items.push({
          str: item.str.trim(),
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
        });
      }
    }
  }

  process.stdout.write(JSON.stringify(items));
}

main().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
