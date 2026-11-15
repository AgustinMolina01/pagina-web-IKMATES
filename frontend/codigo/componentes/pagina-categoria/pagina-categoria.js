import "./pagina-categoria.css";
import { $, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";
import { productsIn, childrenOf } from "../../servicios/catalogo.servicio.js";
import { irA, rutaCategoria } from "../../servicios/navegacion.servicio.js";
import { cardHtml } from "../tarjeta-producto/tarjeta-producto.js";

const ORDENES = {
  "": (a, b) => (b.featured - a.featured) || (a.sort - b.sort) || (a.id - b.id),
  menor: (a, b) => a.price - b.price,
  mayor: (a, b) => b.price - a.price,
  nombre: (a, b) => a.name.localeCompare(b.name, "es"),
};

const plural = (n) => `${n} ${n === 1 ? "producto" : "productos"}`;

function render() {
  if (state.vista.tipo !== "categoria") return;
  const cat = state.categories.find((c) => c.slug === state.vista.slug);
  if (!cat) {
    // Las categorías llegan junto con el resto del sitio: si todavía no llegaron esperamos; si ya llegaron, no existe.
    if (state.siteLoaded) irA("/", { reemplazar: true });
    return;
  }
  const padre = cat.parent ? state.categories.find((c) => c.slug === cat.parent) : null;
  const orden = ORDENES[$("#catOrden").value] || ORDENES[""];
  const lista = (slug) => productsIn(slug).slice().sort(orden);

  // Una categoría principal muestra también los productos de sus subcategorías, agrupados
  const subs = padre ? [] : childrenOf(cat.slug).map((k) => ({ k, lista: lista(k.slug) })).filter((s) => s.lista.length);
  const directos = lista(cat.slug);
  const total = directos.length + subs.reduce((n, s) => n + s.lista.length, 0);

  document.title = `${cat.name} | IK Mates`;
  $("#catTitulo").textContent = cat.name;
  $("#catCuenta").textContent = plural(total);
  $("#catMigas").innerHTML = [
    `<a href="/">Inicio</a>`,
    padre ? `<a href="${esc(rutaCategoria(padre.slug))}">${esc(padre.name)}</a>` : "",
    `<span aria-current="page">${esc(cat.name)}</span>`,
  ].filter(Boolean).join('<span aria-hidden="true">›</span>');

  // Subcategorías como atajos (en una subcategoría: volver a la principal y ver sus hermanas)
  const hermanas = padre ? childrenOf(padre.slug).filter((k) => productsIn(k.slug).length) : subs.map((s) => s.k);
  const principal = padre || cat;
  $("#catChips").innerHTML = hermanas.length
    ? [`<a class="chip${padre ? "" : " on"}" href="${esc(rutaCategoria(principal.slug))}">Todo ${esc(principal.name)}</a>`,
       ...hermanas.map((k) => `<a class="chip${k.slug === cat.slug ? " on" : ""}" href="${esc(rutaCategoria(k.slug))}">${esc(k.name)}</a>`)].join("")
    : "";

  const grilla = (productos) => `<div class="grid">${productos.map(cardHtml).join("")}</div>`;
  $("#catProductos").innerHTML = !total
    ? `<p class="catalog-empty">Todavía no hay productos en esta categoría. <a href="/">Volver al inicio</a></p>`
    : (directos.length ? grilla(directos) : "") +
      subs.map((s) => `<h2 class="sub-head"><a href="${esc(rutaCategoria(s.k.slug))}">${esc(s.k.name)}</a></h2>${grilla(s.lista)}`).join("");
}

export function initCategoryPage() {
  on("vista", () => { $("#catOrden").value = ""; render(); }); // al entrar a otra categoría, vuelve el orden original
  on("products", render);
  on("site", render);
  $("#catOrden").addEventListener("change", render);
}
