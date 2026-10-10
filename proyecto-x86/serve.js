// Servidor estático sin dependencias.  npm start → src/   |   npm run preview → dist/
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, process.argv.includes("--dist") ? "dist" : "src");
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

if (!fs.existsSync(root)) { console.error(`No existe ${root}. Ejecuta primero: npm run build`); process.exit(1); }

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403).end("Prohibido"); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("No encontrado"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }).end(data);
  });
}).listen(port, () => console.log(`Sirviendo ${path.basename(root)}/ en http://localhost:${port}`));
