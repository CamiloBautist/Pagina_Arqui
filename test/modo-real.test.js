const test = require("node:test");
const assert = require("node:assert/strict");
const ModoReal = require("../src/js/modo-real.js");

const mr = new ModoReal();

test("1234:0010 → 12350h", () => {
  const r = mr.calcular({ segmento: 0x1234, offset: 0x0010 });
  assert.equal(r.fisica, 0x12350);
  assert.equal(r.base, 0x12340);
  assert.equal(r.supera1MB, false);
});

test("0000:0000 → 0", () => assert.equal(mr.calcular({ segmento: 0, offset: 0 }).fisica, 0));

test("F000:FFFF → FFFFFh (límite de 1 MB)", () => {
  const r = mr.calcular({ segmento: 0xF000, offset: 0xFFFF });
  assert.equal(r.fisica, 0xFFFFF);
  assert.equal(r.supera1MB, false);
});

test("FFFF:FFFF supera 1 MB (HMA) y el 8086 lo reduce a 20 bits", () => {
  const r = mr.calcular({ segmento: 0xFFFF, offset: 0xFFFF });
  assert.equal(r.fisica, 0x10FFEF);
  assert.equal(r.supera1MB, true);
  assert.equal(r.fisica8086, 0x0FFEF);
});

test("parseHex16 acepta 1–4 dígitos hex y rechaza el resto", () => {
  assert.equal(ModoReal.parseHex16("ff"), 0xFF);
  assert.equal(ModoReal.parseHex16(" 1234 "), 0x1234);
  for (const malo of ["", "12345", "xyz", "-1", "0x10"]) assert.equal(ModoReal.parseHex16(malo), null);
});

test("calcular lanza RangeError fuera de rango", () => {
  assert.throws(() => mr.calcular({ segmento: -1, offset: 0 }), RangeError);
  assert.throws(() => mr.calcular({ segmento: 0, offset: 0x10000 }), RangeError);
});
