// Construye el proyecto: valida la sintaxis de todos los .js y copia src/ → dist/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });
}

for (const f of jsFiles(SRC)) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    console.error(`✖ Error de sintaxis en ${path.relative(__dirname, f)}\n${e.stderr}`);
    process.exit(1);
  }
}

// Comprueba que index.html referencie archivos que existen
const html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) {
  if (!fs.existsSync(path.join(SRC, m[1]))) {
    console.error(`✖ index.html referencia un archivo inexistente: ${m[1]}`);
    process.exit(1);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(SRC, DIST, { recursive: true });
console.log(`✔ Build listo en dist/ (${fs.readdirSync(DIST).length} elementos en la raíz)`);
