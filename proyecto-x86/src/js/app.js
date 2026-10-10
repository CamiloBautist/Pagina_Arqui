/**
 * app.js
 * Punto de entrada: crea la navegación entre vistas y la interfaz de cada simulador.
 *   - Lógica pura:  ModoReal, ModoProtegido        (js/modo-real.js, js/modo-protegido.js)
 *   - Interfaz:     VistaModoReal, VistaModoProtegido, Navegacion   (js/ui/)
 */
const app = {
  navegacion: new Navegacion(),
  modoReal: new VistaModoReal(new ModoReal()),
  modoProtegido: new VistaModoProtegido(new ModoProtegido())
};
