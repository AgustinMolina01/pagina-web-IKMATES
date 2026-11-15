// Ejecuta las pruebas automáticas.
//
//   node pruebas/ejecutar.js            → todas (servidor + pantallas)
//   node pruebas/ejecutar.js api        → solo las del servidor
//   node pruebas/ejecutar.js pantallas  → solo las de la tienda y el panel
//
// Busca todos los archivos *.prueba.js dentro de las carpetas pedidas.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const carpetas = process.argv.slice(2).length ? process.argv.slice(2) : ["api", "pantallas"];

function buscar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return buscar(ruta);
    return e.name.endsWith(".prueba.js") ? [ruta] : [];
  });
}

const archivos = carpetas.flatMap((c) => buscar(path.join(__dirname, c)));
if (!archivos.length) {
  console.error("No se encontraron pruebas en:", carpetas.join(", "));
  process.exit(1);
}

const resultado = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...archivos], { stdio: "inherit" });
process.exit(resultado.status ?? 1);
