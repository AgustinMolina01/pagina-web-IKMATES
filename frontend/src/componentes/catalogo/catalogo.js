import "./catalogo.css";
import { $, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";
import { productsIn, childrenOf, navTree, matchesQuery } from "../../servicios/catalogo.servicio.js";
import { addToCart } from "../../servicios/carrito.servicio.js";
import { cardHtml } from "../tarjeta-producto/tarjeta-producto.js";
import { rutaCategoria } from "../../servicios/navegacion.servicio.js";
import { toast } from "../aviso/aviso.js";

/** Destacados + una sección por categoría (con sus subcategorías). Lo que no tiene productos no se muestra. */
function render() {
  const searching = state.query.trim() !== "";
  let shown = 0;

  const featured = searching ? [] : state.products.filter((p) => p.featured && state.categories.some((c) => c.slug === p.cat)).slice(0, 8);
  const featuredHtml = featured.length
    ? `<section class="section" id="destacados"><div class="container">
         <div class="section-head"><h2>Destacados</h2></div>
         <div class="grid">${featured.map(cardHtml).join("")}</div></div></section>`
    : "";
  if (featured.length) shown++;

  const sections = navTree().map((c) => {
    const direct = productsIn(c.slug).filter(matchesQuery);
    const subs = childrenOf(c.slug).map((k) => ({ k, list: productsIn(k.slug).filter(matchesQuery) })).filter((s) => s.list.length);
    if (!direct.length && !subs.length) return "";
    return `<section class="section ${shown++ % 2 ? "alt" : ""}" id="${esc(c.slug)}">
      <div class="container">
        <div class="section-head"><h2><a href="${esc(rutaCategoria(c.slug))}">${esc(c.name)}</a></h2><a class="ver-todo" href="${esc(rutaCategoria(c.slug))}">Ver todo en ${esc(c.name)} →</a></div>
        ${direct.length ? `<div class="grid">${direct.map(cardHtml).join("")}</div>` : ""}
        ${subs.map((s) => `<h3 class="sub-head" id="${esc(s.k.slug)}">${esc(s.k.name)}</h3><div class="grid">${s.list.map(cardHtml).join("")}</div>`).join("")}
      </div></section>`;
  }).join("");

  const empty = searching ? `No encontramos productos para “${esc(state.query.trim())}”.` : "Próximamente nuevos productos.";
  $("#productos").innerHTML = featuredHtml + sections || `<p class="catalog-empty">${empty}</p>`;
}

export function initCatalog() {
  on("products", render);
  on("site", render);
  on("query", render);

  // Clic en "Agregar al carrito" de una tarjeta (abrir la página del producto lo maneja navegacion.servicio.js)
  document.addEventListener("click", (e) => {
    const add = e.target.closest("#productos [data-id]");
    if (add) {
      const result = addToCart(add.dataset.id);
      toast(result.error || "Agregado al carrito");
    }
  });
}
