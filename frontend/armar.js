// Arma el sitio: junta el HTML, CSS y JS de cada componente y deja todo listo en frontend/dist/.
//
//   npm run armar            → versión final (minificada)
//   npm run desarrollo       → versión de desarrollo, se rearma sola al guardar un archivo
//
// Cómo funciona:
//   • Cada componente vive en su carpeta (src/componentes/<nombre>/) con su .html, .css y .js.
//   • Las páginas (src/paginas/*.pagina.html) arman la estructura con  <!-- @include componentes/x/x.html -->
//   • El .js de cada componente importa su .css, y esbuild junta todo en dist/assets/<página>.js y .css
//   • Lo que está en public/ (imágenes, etc.) se copia tal cual a dist/
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const CODIGO = path.join(__dirname, "src");
const ARMADO = path.join(__dirname, "dist");
const PUBLICO = path.join(__dirname, "public");
const DEV = process.argv.includes("--dev");
const WATCH = process.argv.includes("--watch");

const PAGES = [
  { name: "tienda", html: "paginas/tienda.pagina.html", out: "index.html", entry: "principal-tienda.js" },
  { name: "panel", html: "paginas/panel.pagina.html", out: "panel.html", entry: "panel/principal-panel.js" },
];

/** Reemplaza <!-- @include ruta --> por el contenido del archivo (la ruta es relativa a src/). */
function renderHtml(relPath, chain = []) {
  const file = path.join(CODIGO, relPath);
  if (chain.includes(file)) throw new Error(`Include circular: ${[...chain, file].join(" → ")}`);
  if (!fs.existsSync(file)) throw new Error(`No existe ${relPath} (pedido desde ${chain.length ? path.relative(CODIGO, chain[chain.length - 1]) : "la raíz"})`);
  return fs.readFileSync(file, "utf8").replace(/^([ \t]*)<!--\s*@include\s+([^\s]+)\s*-->/gm, (m, indent, rel) =>
    renderHtml(rel, [...chain, file]).trimEnd().split("\n").map((line) => (line ? indent + line : line)).join("\n").trimStart().replace(/^/, indent));
}

function buildHtml() {
  for (const page of PAGES) fs.writeFileSync(path.join(ARMADO, page.out), renderHtml(page.html));
}

function copyPublic() {
  if (fs.existsSync(PUBLICO)) fs.cpSync(PUBLICO, ARMADO, { recursive: true });
}

const bundleOptions = (page) => ({
  entryPoints: [path.join(CODIGO, page.entry)],
  outfile: path.join(ARMADO, "assets", page.name + ".js"), // el CSS sale como assets/<página>.css
  bundle: true,
  format: "iife",
  target: ["es2020"],
  minify: !DEV,
  sourcemap: DEV,
  legalComments: "none",
  external: ["/img/*"], // las imágenes de public/ se referencian como /img/... y se copian tal cual
  logLevel: "warning",
});

/** Borra el contenido de la carpeta pero no la carpeta: así no falla si está abierta en el Explorador o en la terminal. */
function vaciarCarpeta(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const nombre of fs.readdirSync(dir)) fs.rmSync(path.join(dir, nombre), { recursive: true, force: true });
}

const kb = (file) => (fs.statSync(file).size / 1024).toFixed(1) + " KB";

async function main() {
  vaciarCarpeta(ARMADO);
  fs.mkdirSync(path.join(ARMADO, "assets"), { recursive: true });
  copyPublic();
  buildHtml();

  if (WATCH) {
    for (const page of PAGES) await (await esbuild.context(bundleOptions(page))).watch();
    fs.watch(CODIGO, { recursive: true }, (event, name) => {
      if (name && name.endsWith(".html")) {
        try { buildHtml(); console.log("HTML rearmado:", name); } catch (e) { console.error(e.message); }
      }
    });
    console.log("Modo desarrollo: se rearma solo al guardar. Ctrl+C para salir.");
    return;
  }

  for (const page of PAGES) await esbuild.build(bundleOptions(page));
  for (const page of PAGES) {
    const js = path.join(ARMADO, "assets", page.name + ".js"), css = path.join(ARMADO, "assets", page.name + ".css");
    console.log(`✔ ${page.out.padEnd(11)} ${page.name}.js ${kb(js)} · ${page.name}.css ${fs.existsSync(css) ? kb(css) : "—"}`);
  }
}

main().catch((e) => {
  console.error("✖ Falló el armado:", e.message);
  process.exit(1);
});
