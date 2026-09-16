#!/usr/bin/env node

// Standalone script: parsea un PDF de horario UTP y extrae materias con coordenadas.
// Se ejecuta via child_process desde la Server Action, fuera de Turbopack.
// Usage: node parse-schedule-pdf.cjs <path-to-pdf>
// Output: JSON array de { str, x, y }

// pdfjs-dist (legacy) requiere DOMMatrix al cargar. En el contenedor de produccion
// no existe ni el global, ni @napi-rs/canvas (build glibc incompatible con el
// runner alpine/musl), asi que proveemos un shim minimo de matrices afin 2D.
// Solo se usa para extraer texto (getTextContent), no para renderizar.
if (typeof globalThis.DOMMatrix === "undefined") {
  const Affine = function (m = "matrix(1, 0, 0, 1, 0, 0)") {
    if (typeof m === "string") {
      const parts = m.match(/matrix\(([-0-9.,e\s]+)\)/i);
      const v = parts ? parts[1].split(",").map(parseFloat) : [];
      this.a = Number(v[0]) || 1;
      this.b = Number(v[1]) || 0;
      this.c = Number(v[2]) || 0;
      this.d = Number(v[3]) || 1;
      this.e = Number(v[4]) || 0;
      this.f = Number(v[5]) || 0;
    } else if (Array.isArray(m)) {
      this.a = m[0]; this.b = m[1]; this.c = m[2];
      this.d = m[3]; this.e = m[4]; this.f = m[5];
    } else {
      this.a = m?.a ?? 1; this.b = m?.b ?? 0; this.c = m?.c ?? 0;
      this.d = m?.d ?? 1; this.e = m?.e ?? 0; this.f = m?.f ?? 0;
    }
  };
  Affine.prototype.transformPoint = function (p) {
    const x = p.x, y = p.y;
    return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f };
  };
  Affine.prototype.translate = function (tx, ty) {
    return new Affine([
      this.a, this.b, this.c, this.d,
      this.e + this.a * tx + this.c * ty,
      this.f + this.b * tx + this.d * ty,
    ]);
  };
  Affine.prototype.scale = function (sx, sy) {
    return new Affine([this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f]);
  };
  Affine.prototype.multiply = function (o) {
    return new Affine([
      this.a * o.a + this.c * o.b,
      this.b * o.a + this.d * o.b,
      this.a * o.c + this.c * o.d,
      this.b * o.c + this.d * o.d,
      this.a * o.e + this.c * o.f + this.e,
      this.b * o.e + this.d * o.f + this.f,
    ]);
  };
  Affine.prototype.inverse = function () {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) return new Affine();
    const n = 1 / det;
    return new Affine([
      this.d * n, -this.b * n, -this.c * n, this.a * n,
      (this.c * this.f - this.d * this.e) * n,
      (this.b * this.e - this.a * this.f) * n,
    ]);
  };
  Affine.prototype.rotate = function (angle = 0) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Affine([
      this.a * c + this.c * s, this.b * c + this.d * s,
      this.c * c - this.a * s, this.d * c - this.b * s,
      this.e, this.f,
    ]);
  };
  Affine.prototype.rotateAxisAngle = function (x, y, z, angle = 0) {
    if (x !== 0 || y !== 0 || z !== 1) return new Affine();
    return this.rotate((angle * Math.PI) / 180);
  };
  Affine.prototype.rotateFromVector = function (x, y) {
    const len = Math.hypot(x, y);
    return this.rotate(Math.acos(len === 0 ? 1 : x / len));
  };
  Affine.prototype.skewX = function (sx) {
    return new Affine([this.a, this.b, this.a * Math.tan(sx) + this.c, this.b * Math.tan(sx) + this.d, this.e, this.f]);
  };
  Affine.prototype.skewY = function (sy) {
    return new Affine([this.c * Math.tan(sy) + this.a, this.d * Math.tan(sy) + this.b, this.c, this.d, this.e, this.f]);
  };
  Affine.prototype.toString = function () {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  };
  globalThis.DOMMatrix = Affine;
  globalThis.DOMMatrixReadOnly = Affine;
  globalThis.DOMPoint = function (x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  };
}

const fs = require("fs");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");

const pdfPath = process.argv[2];
if (!pdfPath) {
  process.stderr.write("Usage: node parse-schedule-pdf.cjs <pdf-path>\n");
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
  process.stderr.write(err && err.message ? err.message : String(err));
  process.exit(1);
});