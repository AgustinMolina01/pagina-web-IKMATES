import { $, esc } from "../../../compartido/elementos.js";
import { money } from "../../../compartido/formato.js";
import { post, del } from "../../../compartido/peticiones.js";
import { on } from "../../../compartido/eventos.js";
import { datos, hijas, cargarProductos, cargarCategorias, opcionesCategorias, etiquetaCategoria } from "../../servicios/datos.js";
import { abrirFormulario } from "../formulario-producto/formulario-producto.js";
import { abrirPrecios, registrarSeleccion } from "../cambio-precios/cambio-precios.js";
import { abrirImportar } from "../importar-planilla/importar-planilla.js";

const POCO_STOCK = 5;
const seleccion = new Set();
let visibles = 50; // de a 50 productos por pantalla

function filtrados() {
  const texto = $("#pSearch").value.trim().toLowerCase(), cat = $("#pFilter").value, estado = $("#pStatus").value;
  return datos.productos.filter((p) => {
    if (texto && !(p.name + " " + p.desc).toLowerCase().includes(texto)) return false;
    if (cat) {
      const c = datos.categorias.find((x) => x.slug === cat);
      const slugs = c ? [c.slug, ...hijas(c.id).map((k) => k.slug)] : [cat];
      if (!slugs.includes(p.cat)) return false;
    }
    if (estado === "sold" && !p.soldOut) return false;
    if (estado === "low" && !(p.stock !== null && p.stock > 0 && p.stock <= POCO_STOCK)) return false;
    if (estado === "hidden" && p.active) return false;
    if (estado === "feat" && !p.featured) return false;
    if (estado === "whole" && !p.wholesale) return false;
    if (estado === "opts" && !p.options.length) return false;
    return true;
  });
}

function etiquetasEstado(p) {
  const out = [`<span class="pill ${p.active ? "" : "off"}">${p.active ? "Visible" : "Oculto"}</span>`];
  if (p.soldOut) out.push(`<span class="pill off">Sin stock</span>`);
  else if (p.stock !== null) out.push(`<span class="pill ${p.stock <= POCO_STOCK ? "warn-pill" : "green"}">Stock: ${p.stock}</span>`);
  return out.join(" ");
}

function dibujar() {
  const lista = filtrados();
  // Las flechas ↑ ↓ solo tienen sentido viendo una categoría entera, sin filtros
  const puedeOrdenar = $("#pFilter").value && !$("#pSearch").value.trim() && !$("#pStatus").value;
  const mismaCategoria = (p) => datos.productos.filter((x) => x.cat === p.cat);

  $("#tbody").innerHTML = lista.length
    ? lista.slice(0, visibles).map((p) => {
        const hermanos = mismaCategoria(p), i = hermanos.indexOf(p);
        return `<tr>
          <td><input type="checkbox" data-sel="${p.id}" ${seleccion.has(p.id) ? "checked" : ""}></td>
          <td>${p.img ? `<img class="thumb-s" src="${esc(p.img)}" alt="">` : `<div class="thumb-s">🧉</div>`}</td>
          <td><strong>${esc(p.name)}</strong>${p.featured ? ` <span class="pill green">★ Destacado</span>` : ""}${p.tag ? ` <span class="pill">${esc(p.tag)}</span>` : ""}${p.images.length ? ` <span class="pill">${p.images.length + 1} fotos</span>` : ""}${p.options.length ? ` <span class="pill">${p.options.map((g) => esc(g.name)).join(" · ")}</span>` : ""}</td>
          <td class="hide-m">${esc(etiquetaCategoria(p.cat))}</td>
          <td>${money(p.price)}${p.wholesale ? `<br><small style="color:var(--green)">${money(p.wholesale.price)} desde ${p.wholesale.min} u.</small>` : ""}</td>
          <td>${etiquetasEstado(p)}</td>
          <td class="acts" style="white-space:nowrap">${puedeOrdenar ? `<button data-up="${p.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button data-down="${p.id}" ${i === hermanos.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>` : ""}<button data-edit="${p.id}">Editar</button><button data-dup="${p.id}">Duplicar</button><button class="del" data-del="${p.id}">Eliminar</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">No hay productos con ese filtro.</td></tr>`;

  $("#pCount").textContent = `${Math.min(visibles, lista.length)} de ${lista.length} productos${puedeOrdenar ? " · usá ↑ ↓ para ordenarlos" : ""}`;
  $("#moreBtn").classList.toggle("hidden", lista.length <= visibles);
  $("#selAll").checked = lista.length > 0 && lista.every((p) => seleccion.has(p.id));
  const n = seleccion.size;
  $("#bulkBar").classList.toggle("hidden", n === 0);
  $("#bulkCount").textContent = `${n} seleccionado${n === 1 ? "" : "s"}`;
}

/** Ids de los productos tildados (los usa el cambio de precios). */
export const productosSeleccionados = () => [...seleccion];

function llenarCategorias() {
  const filtro = $("#pFilter").value, destino = $("#bulkCat").value;
  $("#pFilter").innerHTML = opcionesCategorias("Todas las categorías");
  $("#bulkCat").innerHTML = opcionesCategorias();
  if (datos.categorias.some((c) => c.slug === filtro)) $("#pFilter").value = filtro;
  if (datos.categorias.some((c) => c.slug === destino)) $("#bulkCat").value = destino;
}

export function iniciarProductos() {
  registrarSeleccion(productosSeleccionados); // el cambio de precios necesita saber cuáles están tildados
  on("categorias", () => { llenarCategorias(); dibujar(); });
  on("productos", dibujar);

  ["#pSearch", "#pFilter", "#pStatus"].forEach((s) => $(s).addEventListener("input", () => { visibles = 50; dibujar(); }));
  $("#moreBtn").onclick = () => { visibles += 50; dibujar(); };
  $("#selAll").onchange = (e) => { filtrados().forEach((p) => (e.target.checked ? seleccion.add(p.id) : seleccion.delete(p.id))); dibujar(); };

  $("#newProduct").onclick = () => abrirFormulario(null);
  $("#openPrices").onclick = abrirPrecios;
  $("#bulkPrice").onclick = abrirPrecios;
  $("#openImport").onclick = abrirImportar;

  // Acciones de cada fila
  $("#tbody").onclick = async (e) => {
    const d = e.target.dataset;
    if (d.sel) { e.target.checked ? seleccion.add(Number(d.sel)) : seleccion.delete(Number(d.sel)); return dibujar(); }
    try {
      if (d.up || d.down) { await post(`/api/admin/products/${d.up || d.down}/move`, { dir: d.up ? -1 : 1 }); return cargarProductos(); }
      if (d.edit || d.dup) return abrirFormulario(datos.productos.find((x) => x.id == (d.edit || d.dup)), !!d.dup);
      if (d.del && confirm("¿Eliminar este producto? No se puede deshacer.")) {
        await del(`/api/admin/products/${d.del}`);
        seleccion.delete(Number(d.del));
        await cargarProductos();
        await cargarCategorias();
      }
    } catch (err) { alert(err.message); }
  };

  // Acciones sobre los tildados
  $("#bulkBar").onclick = async (e) => {
    const accion = e.target.dataset.bulk;
    if (!accion) return;
    const ids = [...seleccion];
    if (accion === "delete" && !confirm(`¿Eliminar ${ids.length} producto(s)? No se puede deshacer.`)) return;
    if (accion === "move" && !$("#bulkCat").value) return alert("Elegí la categoría de destino");
    try {
      await post("/api/admin/products/bulk", { ids, action: accion, category: $("#bulkCat").value });
      if (accion === "delete") seleccion.clear();
      await cargarProductos();
      await cargarCategorias();
    } catch (err) { alert(err.message); }
  };
}
