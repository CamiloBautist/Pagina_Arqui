/**
 * modo-protegido.js
 * Lógica de validación de modo protegido x86 (selector → GDT/LDT → descriptor → dirección lineal).
 * Clase independiente: NO usa el DOM, por lo que funciona en el navegador y en Node.js.
 *
 * Uso en el navegador:  <script src="js/modo-protegido.js"></script>   → ModoProtegido
 * Uso en Node.js:       const ModoProtegido = require("./modo-protegido.js");
 *
 * Ejemplo:
 *   const mp = new ModoProtegido();
 *   const r = mp.validar({ selector: 0x0008, tipoSegmento: "CS", offset: 0x1000, operacion: "execute", cpl: 0 });
 *   r.ok        // true
 *   r.lineal    // 4096 (0x1000)
 *   r.excepcion // null  (o "#GP(0x0008)", "#NP(...)", "#SS(0)", ...)
 */
class ModoProtegido {
  // Descriptores de ejemplo: 64 bits en hexadecimal (16 dígitos), formato x86 clásico.
  static GDT_EJEMPLO = [
    { name: "Descriptor nulo",             raw: "0000000000000000" },
    { name: "Código kernel (flat 4 GB)",   raw: "00CF9A000000FFFF" },
    { name: "Datos kernel (flat 4 GB)",    raw: "00CF92000000FFFF" },
    { name: "Código usuario (flat 4 GB)",  raw: "00CFFA000000FFFF" },
    { name: "Datos usuario (flat 4 GB)",   raw: "00CFF2000000FFFF" },
    { name: "Datos solo lectura (4 KB)",   raw: "0040903000000FFF" },
    { name: "Pila expansión abajo",        raw: "0040961000000FFF" },
    { name: "Código legible (8 KB)",       raw: "00409A2000001FFF" },
    { name: "Segmento no presente",        raw: "00401A4000000FFF" },
    { name: "TSS (descriptor de sistema)", raw: "0040895000000067" }
  ];
  static LDT_EJEMPLO = [
    { name: "Datos local (4 KB)",  raw: "0040926000000FFF" },
    { name: "Código local (4 KB)", raw: "00409A7000000FFF" },
    { name: "Datos DPL 3 (4 KB)",  raw: "0040F28000000FFF" }
  ];

  /** @param {{gdt?: {name:string, raw:string}[], ldt?: {name:string, raw:string}[]}} tablas */
  constructor({ gdt = ModoProtegido.GDT_EJEMPLO, ldt = ModoProtegido.LDT_EJEMPLO } = {}) {
    this.gdt = gdt;
    this.ldt = ldt;
  }

  /** Número → hexadecimal en mayúsculas con relleno de ceros. */
  static hex(n, ancho = 1) {
    return n.toString(16).toUpperCase().padStart(ancho, "0");
  }

  /** Texto hexadecimal (1..maxDigitos dígitos) → número, o null si no es válido. */
  static parseHex(texto, maxDigitos) {
    const t = String(texto).trim();
    return new RegExp(`^[0-9a-fA-F]{1,${maxDigitos}}$`).test(t) ? parseInt(t, 16) : null;
  }

  /** Selector de 16 bits → { indice, ti, rpl }. TI: 0 = GDT, 1 = LDT. */
  static parseSelector(selector) {
    return { indice: selector >> 3, ti: (selector >> 2) & 1, rpl: selector & 3 };
  }

  /** Descriptor de 64 bits (cadena hex de 16 dígitos) → campos decodificados. */
  static parseDescriptor(raw) {
    const hx = (a, b) => parseInt(raw.slice(a, b), 16);
    const baseHi = hx(0, 2), flags = hx(2, 4), access = hx(4, 6);
    const baseMid = hx(6, 8), baseLo = hx(8, 12), limLo = hx(12, 16);
    const base = baseHi * 0x1000000 + baseMid * 0x10000 + baseLo;
    const limitRaw = (flags & 0xF) * 0x10000 + limLo;
    const G = (flags >> 7) & 1;
    const type = access & 0xF;
    const S = (access >> 4) & 1;
    const isCode = !!(type & 8);
    const d = {
      raw, base, limitRaw, G,
      limit: G ? limitRaw * 0x1000 + 0xFFF : limitRaw, // límite efectivo en bytes
      DB: (flags >> 6) & 1, L: (flags >> 5) & 1, AVL: (flags >> 4) & 1,
      P: (access >> 7) & 1, DPL: (access >> 5) & 3, S, type, access,
      isCode,
      conforming: isCode && !!(type & 4),
      expandDown: !isCode && !!(type & 4),
      readable: isCode ? !!(type & 2) : true,
      writable: !isCode && !!(type & 2),
      accessed: !!(type & 1)
    };
    d.typeName = S === 0
      ? `Sistema (tipo ${ModoProtegido.hex(type)}h)`
      : isCode
        ? `Código${d.conforming ? " conforme" : ""} · ${d.readable ? "ejecución/lectura" : "solo ejecución"}`
        : `Datos${d.expandDown ? " expansión abajo" : ""} · ${d.writable ? "lectura/escritura" : "solo lectura"}`;
    return d;
  }

  /**
   * Valida un acceso y calcula la dirección lineal.
   * @param {object} p
   * @param {number} p.selector      0..0xFFFF
   * @param {"CS"|"DS"|"SS"} p.tipoSegmento
   * @param {number} p.offset        0..0xFFFFFFFF
   * @param {"execute"|"read"|"write"} p.operacion
   * @param {number} p.cpl           0..3
   * @returns {{ok:boolean, excepcion:string|null, verificaciones:{ok:boolean,text:string}[],
   *            pasos:string[], selector:object, tabla:string, descriptor:object|null,
   *            lineal:number|null, desbordo:boolean}}
   */
  validar({ selector, tipoSegmento, offset, operacion, cpl }) {
    if (!Number.isInteger(selector) || selector < 0 || selector > 0xFFFF) throw new RangeError("selector fuera de rango (0000–FFFF)");
    if (!Number.isInteger(offset) || offset < 0 || offset > 0xFFFFFFFF) throw new RangeError("offset fuera de rango (00000000–FFFFFFFF)");
    if (!["CS", "DS", "SS"].includes(tipoSegmento)) throw new RangeError("tipoSegmento debe ser CS, DS o SS");
    if (!["execute", "read", "write"].includes(operacion)) throw new RangeError("operacion debe ser execute, read o write");
    if (![0, 1, 2, 3].includes(cpl)) throw new RangeError("cpl debe ser 0, 1, 2 o 3");

    const hex = ModoProtegido.hex;
    const { indice, ti, rpl } = ModoProtegido.parseSelector(selector);
    const nombreTabla = ti ? "LDT" : "GDT";
    const tabla = ti ? this.ldt : this.gdt;
    const codigoError = "0x" + hex(selector & 0xFFFC, 4);
    const gp = `#GP(${codigoError})`;
    const segExc = tipoSegmento === "SS" ? "#SS(0)" : "#GP(0)";

    const verificaciones = [];
    let excepcion = null;
    let d = null;
    const check = (ok, okMsg, failMsg, exc) => {
      verificaciones.push({ ok, text: ok ? okMsg : failMsg });
      if (!ok && !excepcion) excepcion = exc;
      return ok;
    };

    validacion: {
      // 1) Selector
      if (!check(!(ti === 0 && indice === 0),
        "El selector no es nulo.",
        "Selector nulo (GDT, índice 0): no puede usarse para acceder a memoria.", "#GP(0)")) break validacion;
      if (!check(indice < tabla.length,
        `Índice ${indice} dentro de la ${nombreTabla} (${tabla.length} descriptores).`,
        `Índice ${indice} fuera del límite de la ${nombreTabla} (solo ${tabla.length} descriptores).`, gp)) break validacion;

      d = ModoProtegido.parseDescriptor(tabla[indice].raw);

      // 2) Descriptor
      if (!check(d.S === 1, "S = 1: descriptor de código o datos.",
        "S = 0: es un descriptor de sistema y no puede cargarse en CS, DS ni SS.", gp)) break validacion;
      if (!check(d.P === 1, "P = 1: el segmento está presente en memoria.",
        "P = 0: el segmento no está presente.", tipoSegmento === "SS" ? `#SS(${codigoError})` : `#NP(${codigoError})`)) break validacion;

      // 3) Tipo de segmento y privilegios al cargar el registro
      if (tipoSegmento === "CS") {
        if (!check(d.isCode, "El descriptor es de código, válido para CS.",
          "CS requiere un segmento de código (bit 3 del tipo = 1).", gp)) break validacion;
        if (d.conforming) {
          if (!check(d.DPL <= cpl, `Código conforme: DPL (${d.DPL}) ≤ CPL (${cpl}).`,
            `Código conforme: DPL (${d.DPL}) debe ser ≤ CPL (${cpl}).`, gp)) break validacion;
        } else if (!check(rpl <= cpl && d.DPL === cpl,
          `Código no conforme: RPL (${rpl}) ≤ CPL (${cpl}) y DPL (${d.DPL}) = CPL.`,
          `Código no conforme: se exige RPL (${rpl}) ≤ CPL (${cpl}) y DPL (${d.DPL}) = CPL (${cpl}).`, gp)) break validacion;
      } else if (tipoSegmento === "DS") {
        if (!check(!d.isCode || d.readable, "El descriptor puede cargarse en DS.",
          "Un segmento de código solo puede cargarse en DS si es legible (R = 1).", gp)) break validacion;
        if (!d.conforming) {
          const ef = Math.max(cpl, rpl);
          if (!check(ef <= d.DPL, `Privilegio: máx(CPL ${cpl}, RPL ${rpl}) = ${ef} ≤ DPL (${d.DPL}).`,
            `Privilegio: máx(CPL ${cpl}, RPL ${rpl}) = ${ef} excede el DPL (${d.DPL}).`, gp)) break validacion;
        } else {
          check(true, "Código conforme: no se compara el DPL al cargar DS.", "", null);
        }
      } else { // SS
        if (!check(!d.isCode && d.writable, "El descriptor es un segmento de datos escribible, válido para SS.",
          "SS requiere un segmento de datos escribible (tipo datos con W = 1).", gp)) break validacion;
        if (!check(rpl === cpl && d.DPL === cpl, `RPL (${rpl}) = DPL (${d.DPL}) = CPL (${cpl}).`,
          `SS exige RPL (${rpl}) = DPL (${d.DPL}) = CPL (${cpl}).`, gp)) break validacion;
      }

      // 4) Permisos de la operación
      if (operacion === "execute") {
        if (!check(tipoSegmento === "CS" && d.isCode, "Ejecución permitida: segmento de código cargado en CS.",
          "Solo un segmento de código cargado en CS puede ejecutarse.", "#GP(0)")) break validacion;
      } else if (operacion === "read") {
        if (!check(!d.isCode || d.readable, "Lectura permitida por el descriptor.",
          "Lectura denegada: el segmento de código no es legible (R = 0).", segExc)) break validacion;
      } else if (!check(!d.isCode && d.writable, "Escritura permitida: segmento de datos escribible.",
        d.isCode ? "Escritura denegada: los segmentos de código nunca son escribibles."
                 : "Escritura denegada: segmento de datos de solo lectura (W = 0).", segExc)) break validacion;

      // 5) Límite
      if (d.expandDown) {
        const max = d.DB ? 0xFFFFFFFF : 0xFFFF;
        check(offset > d.limit && offset <= max,
          `Expansión abajo: ${hex(d.limit, 8)}h < offset ${hex(offset, 8)}h ≤ ${hex(max, 8)}h.`,
          `Expansión abajo: el offset ${hex(offset, 8)}h debe estar entre ${hex(d.limit + 1, 8)}h y ${hex(max, 8)}h.`, segExc);
      } else {
        check(offset <= d.limit,
          `Offset ${hex(offset, 8)}h ≤ límite efectivo ${hex(d.limit, 8)}h.`,
          `Offset ${hex(offset, 8)}h excede el límite efectivo ${hex(d.limit, 8)}h.`, segExc);
      }
    }

    // Procedimiento paso a paso
    const pasos = [
      `Selector ${hex(selector, 4)}h = ${selector.toString(2).padStart(16, "0").replace(/(.{4})(?=.)/g, "$1 ")}b → índice ${indice}, TI = ${ti} (${nombreTabla}), RPL = ${rpl}.`
    ];
    if (d) {
      pasos.push(`Descriptor leído: ${nombreTabla}[${indice}] = ${d.raw}h.`);
      pasos.push(`Base = ${hex(d.base, 8)}h; límite = ${hex(d.limitRaw, 5)}h${d.G ? " × 4 KB (G = 1) → " : " (G = 0) → "}${hex(d.limit, 8)}h.`);
    }
    let lineal = null, desbordo = false;
    if (!excepcion) {
      const suma = d.base + offset;
      desbordo = suma > 0xFFFFFFFF;
      lineal = suma % 0x100000000;
      pasos.push(`Dirección lineal = base + offset = ${hex(d.base, 8)}h + ${hex(offset, 8)}h = ${hex(suma, 9)}h` +
        (desbordo ? ` → se trunca a 32 bits: ${hex(lineal, 8)}h.` : "."));
      pasos.push("Con paginación desactivada, la dirección lineal coincide con la física.");
    } else {
      pasos.push(`Validación interrumpida: se genera la excepción ${excepcion}.`);
    }

    return {
      ok: !excepcion, excepcion, verificaciones, pasos,
      selector: { valor: selector, indice, ti, rpl, codigoError },
      tabla: nombreTabla, descriptor: d, lineal, desbordo
    };
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = ModoProtegido;
else if (typeof window !== "undefined") window.ModoProtegido = ModoProtegido;
