import "./menu-productos.css";
import { $, esc } from "../../compartido/elementos.js";
import { on } from "../../servicios/estado.js";
import { navTree } from "../../servicios/catalogo.servicio.js";
import { rutaCategoria } from "../../servicios/navegacion.servicio.js";

function render() {
  const tree = navTree();
  $("#megaCols").innerHTML = tree
    .map((c) => `<div class="mega-col">
        <a class="mega-top" href="${esc(rutaCategoria(c.slug))}">${esc(c.name)}</a>
        ${c.kids.map((k) => `<a class="mega-sub" href="${esc(rutaCategoria(k.slug))}">${esc(k.name)}</a>`).join("")}
      </div>`)
    .join("");
  $("#megaBtn").hidden = !tree.length;
}

export function initMegaMenu() {
  const panel = $("#mega"), button = $("#megaBtn");
  const set = (open) => {
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", open);
  };

  on("products", render);
  on("site", render);

  button.onclick = (e) => { e.stopPropagation(); set(!panel.classList.contains("open")); };
  // En computadora se abre al pasar el mouse; en celular, al tocar
  if (window.matchMedia("(hover:hover)").matches) {
    button.addEventListener("mouseenter", () => set(true));
    $(".header").addEventListener("mouseleave", () => set(false));
  }
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#mega, #megaBtn")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
}
