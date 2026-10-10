/**
 * vista-modo-real.js
 * Interfaz del simulador 01: conecta el formulario con la clase ModoReal (js/modo-real.js).
 */
class VistaModoReal {
  constructor(modelo = new ModoReal()) {
    this.modelo = modelo;
    this.el = {
      segmento: document.getElementById("segment"),
      offset: document.getElementById("offset"),
      boton: document.getElementById("calculateReal"),
      error: document.getElementById("realError"),
      resultado: document.getElementById("realResult"),
      fisicaHex: document.getElementById("physicalHex"),
      fisicaDec: document.getElementById("physicalDec"),
      pasos: document.getElementById("realSteps")
    };

    this.el.boton.addEventListener("click", () => this.calcular());
    [this.el.segmento, this.el.offset].forEach((input) =>
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.calcular();
      })
    );
    this.calcular();
  }

  calcular() {
    const segmento = ModoReal.parseHex16(this.el.segmento.value);
    const offset = ModoReal.parseHex16(this.el.offset.value);

    if (segmento === null || offset === null) {
      this.el.error.textContent = "Entrada no válida. Ingresa valores hexadecimales de 1 a 4 dígitos (0–9, A–F).";
      this.el.resultado.classList.add("invalid");
      return;
    }

    const r = this.modelo.calcular({ segmento, offset });
    this.el.error.textContent = "";
    this.el.resultado.classList.remove("invalid");
    this.el.fisicaHex.textContent = ModoReal.hex(r.fisica, 5) + "h";
    this.el.fisicaDec.textContent = r.fisica.toLocaleString("es-CO");

    this.el.pasos.innerHTML = "";
    r.pasos.forEach((paso) => {
      const li = document.createElement("li");
      li.textContent = paso;
      this.el.pasos.appendChild(li);
    });
  }
}
