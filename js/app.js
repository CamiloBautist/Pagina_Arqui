const byId = (id) => document.getElementById(id);

function calculateRealAddress() {
  const segmentText = byId("segment").value.trim();
  const offsetText = byId("offset").value.trim();
  const error = byId("realError");

  const isHex16 = (value) => /^[0-9a-fA-F]{1,4}$/.test(value);
  if (!isHex16(segmentText) || !isHex16(offsetText)) {
    error.textContent = "Entrada no válida. Ingresa valores hexadecimales de 1 a 4 dígitos (0–9, A–F).";
    byId("realResult").classList.add("invalid");
    return;
  }

  const segment = Number.parseInt(segmentText, 16);
  const offset = Number.parseInt(offsetText, 16);
  const segmentBase = segment * 0x10;
  const physical = segmentBase + offset;

  error.textContent = "";
  byId("realResult").classList.remove("invalid");
  byId("physicalHex").textContent = physical.toString(16).toUpperCase().padStart(5, "0") + "h";
  byId("physicalDec").textContent = physical.toLocaleString("es-CO");

  byId("realSteps").innerHTML = "";
  const steps = [
    `Segmento: ${segmentText.toUpperCase()}h = ${segment.toLocaleString("es-CO")} en decimal.`,
    `Base del segmento: ${segmentText.toUpperCase()}h × 10h = ${segmentBase.toString(16).toUpperCase()}h (${segmentBase.toLocaleString("es-CO")} decimal).`,
    `Sumar el offset: ${segmentBase.toString(16).toUpperCase()}h + ${offsetText.toUpperCase()}h = ${physical.toString(16).toUpperCase()}h.`,
    `Resultado: dirección física ${physical.toString(16).toUpperCase()}h (${physical.toLocaleString("es-CO")} decimal).`
  ];
  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    byId("realSteps").appendChild(li);
  });
}

byId("calculateReal").addEventListener("click", calculateRealAddress);
["segment", "offset"].forEach((id) => {
  byId(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") calculateRealAddress();
  });
});
byId("mobileMenu").addEventListener("click", () => byId("sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-link, .sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    if (link.classList.contains("nav-link")) link.classList.add("active");
    byId("sidebar").classList.remove("open");
  });
});
calculateRealAddress();
