import "./formulario-producto.css";
import { $, esc } from "../../../compartido/elementos.js";
import { post, put } from "../../../compartido/peticiones.js";
import { subirFoto } from "../../servicios/subir-foto.js";
import { on, emit } from "../../../compartido/eventos.js";
import { datos, cargarProductos, cargarCategorias, opcionesCategorias } from "../../servicios/datos.js";

let fotos = [];  // la primera es la principal
let grupos = []; // variantes: [{ name, texto, valores:[{ label, soldOut }] }]

const decir = (mensaje, ok = false) => { $("#formErr").textContent = mensaje; $("#formErr").className = ok ? "okmsg" : "err"; };

// ---------- Fotos ----------
function dibujarFotos() {
  $("#pPhotos").innerHTML =
    fotos.map((url, i) => `<div class="photo"><img src="${esc(url)}" alt="">${i === 0 ? `<div class="main">Principal</div>` : ""}<div class="pb">${i > 0 ? `<button type="button" data-pmain="${i}" title="Hacer principal">★</button>` : "<span></span>"}<button type="button" data-prm="${i}" title="Quitar">✕</button></div></div>`).join("") +
    (fotos.length < 8 ? `<label class="addphoto" for="file">＋ Agregar<br>fotos</label>` : "");
}

// ---------- Variantes ----------
/** "Negro, Rojo, Azul" → [{ label, soldOut }], conservando lo que ya estaba marcado como agotado. */
function valoresDesdeTexto(texto, anteriores) {
  const vistos = new Set();
  return texto.split(",").map((t) => t.trim()).filter((t) => t && !vistos.has(t.toLowerCase()) && vistos.add(t.toLowerCase()))
    .map((label) => ({ label, soldOut: (anteriores.find((v) => v.label.toLowerCase() === label.toLowerCase()) || {}).soldOut || false }));
}
const chipsHtml = (g, i) => g.valores.map((v, j) => `<button type="button" class="chip${v.soldOut ? " off" : ""}" data-gchip="${i}:${j}">${esc(v.label)}${v.soldOut ? " (agotado)" : ""}</button>`).join("");

function dibujarGrupos() {
  $("#opcionesEditor").innerHTML = grupos.map((g, i) => `
    <div class="grupo-op" data-grupo="${i}">
      <div class="row2">
        <div><label>Nombre del grupo</label><input data-gname="${i}" value="${esc(g.name)}" maxlength="30" placeholder="Ej: Color"></div>
        <div><label>Opciones (separadas por coma)</label><input data-gvals="${i}" value="${esc(g.texto)}" placeholder="Negro, Rojo, Azul"></div>
      </div>
      <div class="chips" data-chips="${i}">${chipsHtml(g, i)}</div>
      <button type="button" class="mini" data-gdel="${i}">Quitar grupo</button>
    </div>`).join("");
  $("#agregarGrupo").classList.toggle("hidden", grupos.length >= 3);
}

// ---------- Abrir y guardar ----------
export function abrirFormulario(producto, copia = false) {
  $("#pForm").reset();
  decir("");
  emit("abrir-panel", "formulario");
  $("#productPanel").classList.remove("hidden");
  $("#pId").value = producto && !copia ? producto.id : "";
  $("#formTitle").textContent = !producto ? "Nuevo producto" : copia ? "Nuevo producto (copia — cambiá el nombre)" : "Editar producto";
  fotos = producto ? [producto.img, ...producto.images].filter(Boolean) : [];
  grupos = producto ? producto.options.map((g) => ({ name: g.name, texto: g.values.map((v) => v.label).join(", "), valores: g.values.map((v) => ({ ...v })) })) : [];
  if (producto) {
    $("#pName").value = copia ? producto.name + " (copia)" : producto.name;
    $("#pCat").value = producto.cat;
    $("#pDesc").value = producto.desc;
    $("#pPrice").value = producto.price;
    $("#pOldPrice").value = producto.oldPrice || "";
    $("#pWPrice").value = producto.wholesale ? producto.wholesale.price : "";
    $("#pWMin").value = producto.wholesale ? producto.wholesale.min : "";
    $("#pStock").value = producto.stock ?? "";
    $("#pTag").value = producto.tag;
    $("#pActive").checked = copia ? true : producto.active;
    $("#pSold").checked = copia ? false : producto.soldOutFlag;
    $("#pFeat").checked = copia ? false : producto.featured;
  }
  dibujarFotos();
  dibujarGrupos();
  $("#productPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#pName").focus();
}

const cerrar = () => $("#productPanel").classList.add("hidden");

export function iniciarFormularioProducto() {
  on("categorias", () => {
    const actual = $("#pCat").value;
    $("#pCat").innerHTML = datos.categorias.length ? opcionesCategorias() : `<option value="">Primero creá una categoría</option>`;
    if (datos.categorias.some((c) => c.slug === actual)) $("#pCat").value = actual;
  });
  on("abrir-panel", (nombre) => { if (nombre !== "formulario") cerrar(); });

  $("#cancelEdit").onclick = cerrar;

  // Fotos
  $("#pPhotos").onclick = (e) => {
    const principal = e.target.dataset.pmain, quitar = e.target.dataset.prm;
    if (principal) { const [x] = fotos.splice(Number(principal), 1); fotos.unshift(x); dibujarFotos(); }
    if (quitar) { fotos.splice(Number(quitar), 1); dibujarFotos(); }
  };
  $("#file").onchange = async (e) => {
    const archivos = [...e.target.files].slice(0, 8 - fotos.length);
    e.target.value = "";
    decir(archivos.length ? "Subiendo fotos…" : "", true);
    try {
      for (const archivo of archivos) {
        fotos.push(await subirFoto(archivo)); // se achica antes de subir
        dibujarFotos();
      }
      decir("");
    } catch (err) { decir(err.message); }
  };

  // Variantes
  $("#agregarGrupo").onclick = () => { if (grupos.length < 3) { grupos.push({ name: "", texto: "", valores: [] }); dibujarGrupos(); } };
  $("#opcionesEditor").addEventListener("input", (e) => {
    const nombre = e.target.dataset.gname, valores = e.target.dataset.gvals;
    if (nombre !== undefined) grupos[Number(nombre)].name = e.target.value;
    if (valores !== undefined) {
      const i = Number(valores), g = grupos[i];
      g.texto = e.target.value;
      g.valores = valoresDesdeTexto(g.texto, g.valores);
      $(`[data-chips="${i}"]`).innerHTML = chipsHtml(g, i); // solo las etiquetas: no se pierde el cursor
    }
  });
  $("#opcionesEditor").addEventListener("click", (e) => {
    const chip = e.target.dataset.gchip, quitar = e.target.dataset.gdel;
    if (chip) { const [i, j] = chip.split(":").map(Number); grupos[i].valores[j].soldOut = !grupos[i].valores[j].soldOut; $(`[data-chips="${i}"]`).innerHTML = chipsHtml(grupos[i], i); }
    if (quitar !== undefined) { grupos.splice(Number(quitar), 1); dibujarGrupos(); }
  });

  // Guardar
  $("#pForm").onsubmit = async (e) => {
    e.preventDefault();
    decir("");
    const id = $("#pId").value;
    const cuerpo = {
      name: $("#pName").value, category: $("#pCat").value, description: $("#pDesc").value, price: $("#pPrice").value, oldPrice: $("#pOldPrice").value, tag: $("#pTag").value,
      wholesalePrice: $("#pWPrice").value, wholesaleMin: $("#pWMin").value, stock: $("#pStock").value,
      active: $("#pActive").checked, soldOut: $("#pSold").checked, featured: $("#pFeat").checked,
      image: fotos[0] || "", images: fotos.slice(1),
      options: grupos.map((g) => ({ name: g.name.trim(), values: g.valores })).filter((g) => g.name && g.values.length),
    };
    try {
      await (id ? put(`/api/admin/products/${id}`, cuerpo) : post("/api/admin/products", cuerpo));
      cerrar();
      await cargarProductos();
      await cargarCategorias();
    } catch (err) { decir(err.message); }
  };
}
