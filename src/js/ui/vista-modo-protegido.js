/**
 * vista-modo-protegido.js
 * Interfaz del simulador 02: conecta el formulario con la clase ModoProtegido (js/modo-protegido.js).
 */
class VistaModoProtegido {
  static NOMBRE_SEGMENTO = { CS: "código (CS)", DS: "datos (DS)", SS: "pila (SS)" };
  static NOMBRE_OPERACION = { execute: "ejecución", read: "lectura", write: "escritura" };

  constructor(modelo = new ModoProtegido()) {
    this.modelo = modelo;
    const byId = (id) => document.getElementById(id);
    this.el = {
      selector: byId("pSelector"),
      tipoSegmento: byId("pSegType"),
      offset: byId("pOffset"),
      operacion: byId("pOp"),
      cpl: byId("pCpl"),
      boton: byId("calculateProtected"),
      error: byId("protectedError"),
      resultado: byId("protectedResult"),
      linealHex: byId("linearHex"),
      linealDec: byId("linearDec"),
      estado: byId("protectedStatus"),
      verificaciones: byId("protectedChecks"),
      pasos: byId("protectedSteps"),
      descriptor: byId("protectedDescriptor"),
      gdt: byId("gdtTable"),
      ldt: byId("ldtTable")
    };

    this.el.boton.addEventListener("click", () => this.calcular());
    [this.el.selector, this.el.offset].forEach((input) =>
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.calcular();
      })
    );
    this.renderTablas();
    this.calcular();
  }

  calcular() {
    const hex = ModoProtegido.hex;
    const selector = ModoProtegido.parseHex(this.el.selector.value, 4);
    const offset = ModoProtegido.parseHex(this.el.offset.value, 8);

    if (selector === null || offset === null) {
      this.el.error.textContent = "Entrada no válida. Selector: 1 a 4 dígitos hexadecimales; offset: 1 a 8 dígitos hexadecimales.";
      this.el.resultado.classList.add("invalid");
      return;
    }
    this.el.error.textContent = "";
    this.el.resultado.classList.remove("invalid");

    const tipoSegmento = this.el.tipoSegmento.value;
    const operacion = this.el.operacion.value;
    const cpl = Number(this.el.cpl.value);
    const r = this.modelo.validar({ selector, tipoSegmento, offset, operacion, cpl });

    this.llenarLista(this.el.verificaciones, r.verificaciones);
    this.llenarLista(this.el.pasos, r.pasos);

    this.el.linealHex.textContent = r.lineal === null ? "—" : hex(r.lineal, 8) + "h";
    this.el.linealDec.textContent = r.lineal === null ? "—" : r.lineal.toLocaleString("es-CO");
    this.el.resultado.classList.toggle("fault", !r.ok);

    const segName = VistaModoProtegido.NOMBRE_SEGMENTO[tipoSegmento];
    const opName = VistaModoProtegido.NOMBRE_OPERACION[operacion];
    this.el.estado.className = "status-banner " + (r.ok ? "ok" : "fault");
    this.el.estado.textContent = r.ok
      ? `Acceso permitido · ${opName} sobre segmento de ${segName} con CPL ${cpl}. Dirección lineal ${hex(r.lineal, 8)}h.`
      : `Acceso denegado · excepción ${r.excepcion}. Operación: ${opName} sobre segmento de ${segName}.`;

    this.renderDescriptor(selector, r);
    this.renderTablas(r.selector.ti, r.descriptor ? r.selector.indice : -1);
  }

  llenarLista(el, items) {
    el.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.textContent = it.text ?? it;
      if (it.ok !== undefined) li.className = it.ok ? "ok" : "fail";
      el.appendChild(li);
    });
  }

  renderDescriptor(selector, r) {
    const hex = ModoProtegido.hex;
    const s = r.selector, d = r.descriptor;
    const selTxt = `${hex(selector, 4)}h (idx ${s.indice} · TI ${s.ti} · RPL ${s.rpl})`;
    const campos = d ? [
      ["SELECTOR", selTxt],
      ["TABLA", `${r.tabla}[${s.indice}]`],
      ["BASE", hex(d.base, 8) + "h"],
      ["LÍMITE (20 BITS)", hex(d.limitRaw, 5) + "h"],
      ["LÍMITE EFECTIVO", hex(d.limit, 8) + "h"],
      ["G (GRANULARIDAD)", d.G ? "1 · páginas de 4 KB" : "0 · bytes"],
      ["D/B", d.DB ? "1 · 32 bits" : "0 · 16 bits"],
      ["L / AVL", `${d.L} / ${d.AVL}`],
      ["P (PRESENTE)", String(d.P)],
      ["DPL", String(d.DPL)],
      ["S", d.S ? "1 · código/datos" : "0 · sistema"],
      ["TIPO", `${hex(d.type)}h · ${d.typeName}`],
      ["BYTE DE ACCESO", hex(d.access, 2) + "h"]
    ] : [["SELECTOR", selTxt], ["DESCRIPTOR", "No disponible"]];

    const dl = this.el.descriptor;
    dl.innerHTML = "";
    campos.forEach(([k, v]) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      wrap.append(dt, dd);
      dl.appendChild(wrap);
    });
  }

  renderTablas(tiActiva = -1, indiceActivo = -1) {
    const hex = ModoProtegido.hex;
    const construir = (el, tabla, ti) => {
      el.innerHTML = "<thead><tr><th>#</th><th>SELECTOR</th><th>DESCRIPTOR</th><th>BASE</th><th>LÍMITE</th><th>DESCRIPCIÓN</th></tr></thead>";
      const tbody = document.createElement("tbody");
      tabla.forEach((entrada, i) => {
        const d = ModoProtegido.parseDescriptor(entrada.raw);
        const sel = (i << 3) | (ti << 2);
        const tr = document.createElement("tr");
        if (ti === tiActiva && i === indiceActivo) tr.classList.add("active");
        [i, hex(sel, 4) + "h", entrada.raw + "h", hex(d.base, 8) + "h", hex(d.limit, 8) + "h", entrada.name]
          .forEach((texto, c) => {
            const td = document.createElement("td");
            td.textContent = texto;
            if (c >= 1 && c <= 4) td.className = "mono";
            tr.appendChild(td);
          });
        tr.addEventListener("click", () => {
          this.el.selector.value = hex(sel, 4);
          this.calcular();
        });
        tbody.appendChild(tr);
      });
      el.appendChild(tbody);
    };
    construir(this.el.gdt, this.modelo.gdt, 0);
    construir(this.el.ldt, this.modelo.ldt, 1);
  }
}
