/**
 * navegacion.js
 * Controla qué vista se muestra según el hash de la URL (#inicio, #modo-real, ...).
 * Solo una vista (elemento con [data-view]) está visible a la vez.
 */
class Navegacion {
  /** Anclas internas que pertenecen a otra vista: hash → vista que las contiene. */
  static ALIAS = { modulos: "inicio" };

  constructor({ vistaInicial = "inicio" } = {}) {
    this.vistaInicial = vistaInicial;
    this.vistas = [...document.querySelectorAll("[data-view]")];
    this.links = [...document.querySelectorAll(".nav-link")];
    this.sidebar = document.getElementById("sidebar");

    document.getElementById("mobileMenu")
      .addEventListener("click", () => this.sidebar.classList.toggle("open"));
    document.querySelectorAll("[data-scroll-top]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );
    window.addEventListener("hashchange", () => this.mostrarDesdeHash());
    this.mostrarDesdeHash();
  }

  mostrarDesdeHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const nombre = Navegacion.ALIAS[hash] ?? hash;
    const existe = this.vistas.some((v) => v.dataset.view === nombre);
    this.mostrar(existe ? nombre : this.vistaInicial, existe ? hash : "");
  }

  /** Muestra la vista `nombre` y oculta las demás. `ancla` permite saltar a un elemento dentro de ella. */
  mostrar(nombre, ancla = "") {
    this.vistas.forEach((v) => { v.hidden = v.dataset.view !== nombre; });
    this.links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${nombre}`));
    this.sidebar.classList.remove("open");

    const destino = ancla && ancla !== nombre ? document.getElementById(ancla) : null;
    if (destino) destino.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0 });
  }
}
