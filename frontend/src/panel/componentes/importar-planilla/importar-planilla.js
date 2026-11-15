import { $, esc } from "../../../compartido/elementos.js";
import { post } from "../../../compartido/peticiones.js";
import { on, emit } from "../../../compartido/eventos.js";
import { cargarProductos, cargarCategorias } from "../../servicios/datos.js";
import { productosDesdeCsv, PLANTILLA } from "./leer-csv.js";

let filas = [];

const decir = (m) => { $("#impErr").textContent = m; };

function cerrar() {
  $("#importPanel").classList.add("hidden");
  filas = [];
  $("#impPreview").innerHTML = "";
  $("#impGo").classList.add("hidden");
}

export function abrirImportar() {
  emit("abrir-panel", "importar");
  $("#importPanel").classList.remove("hidden");
  $("#importPanel").scrollIntoView({ behavior: "smooth" });
}

export function iniciarImportarPlanilla() {
  on("abrir-panel", (nombre) => { if (nombre !== "importar") $("#importPanel").classList.add("hidden"); });
  $("#impClose").onclick = cerrar;

  $("#dlTemplate").onclick = () => {
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([PLANTILLA], { type: "text/csv;charset=utf-8" }));
    enlace.download = "plantilla-productos.csv";
    enlace.click();
  };

  $("#csvFile").onchange = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    decir("");
    filas = [];
    $("#impGo").classList.add("hidden");
    try {
      filas = productosDesdeCsv(await archivo.text());
      $("#impPreview").innerHTML = `<div class="preview"><b>${filas.length} fila(s) listas para importar.</b> Primeras filas:<table><tr><th>Categoría</th><th>Nombre</th><th>Precio</th></tr>${filas.slice(0, 5).map((f) => `<tr><td>${esc(f.categoria)}</td><td>${esc(f.nombre)}</td><td>${esc(f.precio)}</td></tr>`).join("")}</table></div>`;
      $("#impGo").textContent = `Importar ${filas.length} productos`;
      $("#impGo").classList.remove("hidden");
    } catch (err) { decir(err.message); }
  };

  $("#impGo").onclick = async () => {
    try {
      const r = await post("/api/admin/products/import", { rows: filas });
      $("#impPreview").innerHTML = `<div class="preview"><b class="okmsg">Se importaron ${r.created} productos${r.categoriesCreated ? ` y se crearon ${r.categoriesCreated} categorías` : ""}.</b>${r.errorCount ? `<br><br><b>${r.errorCount} fila(s) con problemas (no se importaron):</b><br>${r.errors.map(esc).join("<br>")}` : ""}<br><br>Ahora podés agregarle las fotos a cada producto desde la lista.</div>`;
      $("#impGo").classList.add("hidden");
      $("#csvFile").value = "";
      filas = [];
      await cargarCategorias();
      await cargarProductos();
    } catch (err) { decir(err.message); }
  };
}
