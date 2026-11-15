import "./categorias-destacadas.css";
import { $, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";
import { rutaCategoria } from "../../servicios/navegacion.servicio.js";
import { productsIn, childrenOf, emojiFor, toneFor } from "../../servicios/catalogo.servicio.js";

// Una tarjeta por categoría principal que tenga productos o foto de portada.
// La foto es la que ella cargó en Categorías; si no hay, la del primer producto con foto.
function render() {
  const tiles = state.categories.filter((c) => !c.parent).map((c) => {
    const slugs = [c.slug, ...childrenOf(c.slug).map((k) => k.slug)];
    return { c, products: slugs.flatMap((s) => productsIn(s)) };
  }).filter(({ c, products }) => products.length || c.image).map(({ c, products }) => {
    const photo = c.image || (products.find((p) => p.img) || {}).img;
    return `<a class="cat-tile ${toneFor(c.slug)}" href="${esc(rutaCategoria(c.slug))}">
      ${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : `<span class="cat-tile-ico">${emojiFor(c.slug)}</span>`}
      <span class="cat-tile-info"><strong>${esc(c.name)}</strong><small>${products.length} ${products.length === 1 ? "producto" : "productos"}</small></span>
    </a>`;
  });
  // Con una sola categoría no aporta: se oculta (y mientras se busca, para no empujar los resultados)
  const visible = tiles.length > 1 && !state.query.trim();
  $("#categoriasDestacadas").hidden = !visible;
  $("#catTiles").innerHTML = visible ? tiles.join("") : "";
}

export function initCategoryTiles() {
  on("products", render);
  on("site", render);
  on("query", render);
}
