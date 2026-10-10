/**
 * modo-real.js
 * Lógica de direccionamiento en modo real x86:  Dirección física = (Segmento × 16) + Offset
 * Clase independiente: NO usa el DOM (funciona en navegador y en Node.js).
 *
 * Ejemplo:
 *   const r = new ModoReal().calcular({ segmento: 0x1234, offset: 0x0010 });
 *   r.fisica      // 0x12350
 *   r.pasos       // procedimiento paso a paso (array de textos)
 */
class ModoReal {
  /** Número → hexadecimal en mayúsculas con relleno de ceros. */
  static hex(n, ancho = 1) {
    return n.toString(16).toUpperCase().padStart(ancho, "0");
  }

  /** Texto hexadecimal de 1 a 4 dígitos (0000–FFFF) → número, o null si no es válido. */
  static parseHex16(texto) {
    const t = String(texto).trim();
    return /^[0-9a-fA-F]{1,4}$/.test(t) ? parseInt(t, 16) : null;
  }

  /**
   * @param {{segmento:number, offset:number}} p  ambos en 0..0xFFFF
   * @returns {{segmento:number, offset:number, base:number, fisica:number,
   *            supera1MB:boolean, fisica8086:number, pasos:string[]}}
   */
  calcular({ segmento, offset }) {
    for (const [nombre, v] of [["segmento", segmento], ["offset", offset]]) {
      if (!Number.isInteger(v) || v < 0 || v > 0xFFFF) throw new RangeError(`${nombre} fuera de rango (0000–FFFF)`);
    }
    const hex = ModoReal.hex;
    const base = segmento * 0x10;           // desplazar 4 bits a la izquierda
    const fisica = base + offset;
    const supera1MB = fisica > 0xFFFFF;     // más allá de los 20 bits de dirección del 8086
    const pasos = [
      `Segmento: ${hex(segmento, 4)}h = ${segmento.toLocaleString("es-CO")} en decimal.`,
      `Base del segmento: ${hex(segmento, 4)}h × 10h = ${hex(base)}h (${base.toLocaleString("es-CO")} decimal).`,
      `Sumar el offset: ${hex(base)}h + ${hex(offset, 4)}h = ${hex(fisica)}h.`,
      `Resultado: dirección física ${hex(fisica)}h (${fisica.toLocaleString("es-CO")} decimal).`
    ];
    if (supera1MB) {
      pasos.push(`Nota: ${hex(fisica)}h supera 1 MB (FFFFFh). Un 8086 la reduciría a 20 bits (${hex(fisica & 0xFFFFF, 5)}h); con la línea A20 habilitada se accede a la HMA.`);
    }
    return { segmento, offset, base, fisica, supera1MB, fisica8086: fisica & 0xFFFFF, pasos };
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = ModoReal;
else if (typeof window !== "undefined") window.ModoReal = ModoReal;
