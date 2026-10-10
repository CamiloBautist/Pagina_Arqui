const test = require("node:test");
const assert = require("node:assert/strict");
const ModoProtegido = require("../src/js/modo-protegido.js");

const mp = new ModoProtegido();
const v = (selector, tipoSegmento, offset, operacion, cpl) =>
  mp.validar({ selector, tipoSegmento, offset, operacion, cpl });

test("parseSelector descompone índice, TI y RPL", () => {
  assert.deepEqual(ModoProtegido.parseSelector(0x002B), { indice: 5, ti: 0, rpl: 3 });
  assert.deepEqual(ModoProtegido.parseSelector(0x0004), { indice: 0, ti: 1, rpl: 0 });
});

test("parseDescriptor decodifica un código flat de 4 GB", () => {
  const d = ModoProtegido.parseDescriptor("00CF9A000000FFFF");
  assert.equal(d.base, 0);
  assert.equal(d.limit, 0xFFFFFFFF);
  assert.equal(d.G, 1);
  assert.equal(d.DB, 1);
  assert.equal(d.P, 1);
  assert.equal(d.DPL, 0);
  assert.equal(d.isCode, true);
  assert.equal(d.readable, true);
});

test("CS kernel: ejecutar 0008:00001000 → lineal 1000h", () => {
  const r = v(0x08, "CS", 0x1000, "execute", 0);
  assert.equal(r.ok, true);
  assert.equal(r.lineal, 0x1000);
  assert.equal(r.excepcion, null);
});

test("DS kernel: escribir permitido", () => assert.equal(v(0x10, "DS", 0x10, "write", 0).ok, true));

test("selector nulo → #GP(0)", () => assert.equal(v(0x00, "DS", 0, "read", 0).excepcion, "#GP(0)"));

test("índice fuera de la GDT → #GP con código de error", () =>
  assert.equal(v(0x0048, "DS", 0, "read", 0).excepcion, "#GP(0x0048)"));

test("segmento no presente → #NP (y #SS para SS)", () => {
  assert.equal(v(0x40, "DS", 0x10, "read", 0).excepcion, "#NP(0x0040)");
});

test("descriptor de sistema no se carga en DS → #GP", () =>
  assert.equal(v(0x48, "DS", 0, "read", 0).ok, false));

test("privilegio: CPL 3 no puede cargar datos DPL 0 en DS", () =>
  assert.equal(v(0x2B, "DS", 0x10, "read", 3).excepcion, "#GP(0x0028)"));

test("segmento de solo lectura: lectura sí, escritura no", () => {
  assert.equal(v(0x28, "DS", 0x10, "read", 0).ok, true);
  assert.equal(v(0x28, "DS", 0x10, "write", 0).excepcion, "#GP(0)");
});

test("límite: offset = límite pasa; límite + 1 falla (base 300000h)", () => {
  const ok = v(0x28, "DS", 0xFFF, "read", 0);
  assert.equal(ok.lineal, 0x300FFF);
  assert.equal(v(0x28, "DS", 0x1000, "read", 0).excepcion, "#GP(0)");
});

test("SS expansión abajo: offset ≤ límite falla con #SS(0), mayor pasa", () => {
  assert.equal(v(0x30, "SS", 0x100, "write", 0).excepcion, "#SS(0)");
  assert.equal(v(0x30, "SS", 0x1000, "write", 0).lineal, 0x101000);
});

test("LDT (TI = 1): selector 0004 apunta al índice 0 de la LDT", () => {
  const r = v(0x0004, "DS", 0x10, "write", 0);
  assert.equal(r.ok, true);
  assert.equal(r.tabla, "LDT");
  assert.equal(r.lineal, 0x600010);
});

test("ejecutar con un segmento cargado en DS → #GP(0)", () =>
  assert.equal(v(0x08, "DS", 0, "execute", 0).excepcion, "#GP(0)"));

test("la suma base + offset se trunca a 32 bits", () => {
  const m = new ModoProtegido({ gdt: [
    { name: "nulo", raw: "0000000000000000" },
    { name: "datos base F0000000", raw: "F0CF92000000FFFF" }
  ] });
  const r = m.validar({ selector: 0x08, tipoSegmento: "DS", offset: 0x20000000, operacion: "read", cpl: 0 });
  assert.equal(r.lineal, 0x10000000);
  assert.equal(r.desbordo, true);
});

test("validar lanza RangeError con entradas fuera de rango", () => {
  assert.throws(() => v(-1, "CS", 0, "read", 0), RangeError);
  assert.throws(() => v(0x08, "CS", 0x1_0000_0000, "read", 0), RangeError);
  assert.throws(() => v(0x08, "XX", 0, "read", 0), RangeError);
  assert.throws(() => v(0x08, "CS", 0, "read", 7), RangeError);
});
