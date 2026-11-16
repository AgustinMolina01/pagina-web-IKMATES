import "./carrusel.css";
import { $, $$, esc } from "../../compartido/elementos.js";
import { state, on } from "../../servicios/estado.js";

let index = 0, timer, count = 0;

function go(i) {
  index = (i + count) % count;
  $("#slides").style.transform = `translateX(-${index * 100}%)`;
  $$("#dots button").forEach((dot, n) => dot.classList.toggle("on", n === index));
}
function autoplay() {
  clearInterval(timer);
  if (count > 1) timer = setInterval(() => go(index + 1), 5000);
}

/** "#mates" (publicaciones viejas) → "/categoria/mates" si esa categoría existe. */
function destino(link) {
  const m = /^#([a-z0-9-]+)$/.exec(link || "");
  return m && state.categories.some((c) => c.slug === m[1]) ? "/categoria/" + m[1] : link;
}

function render() {
  const slider = $("#slider"), list = state.banners;
  count = list.length;
  if (!count) { slider.hidden = true; return; }
  $("#slides").innerHTML = list
    .map((b) => {
      const title = b.title || "Mates para acompañarte siempre";
      const link = destino(b.link);
      const href = /^(https?:\/\/|#|\/)/i.test(link || "") ? link : "#productos";
      return `<article class="slide">
        <img src="${esc(b.image)}" alt="" aria-hidden="true">
        <div class="slide-content">
          <p class="slide-kicker">IK Mates · Tradición para compartir</p>
          <h2>${esc(title)}</h2>
          <p class="slide-description">Mates, yerba y combos elegidos para acompañarte todos los días.</p>
          <div class="slide-actions">
            <a class="slide-action slide-action-primary" href="${esc(href)}">VER OFERTA</a>
            <a class="slide-action slide-action-secondary" href="#productos">VER COLECCIÓN</a>
          </div>
        </div>
      </article>`;
    })
    .join("");
  $("#dots").innerHTML = list.map((_, n) => `<button aria-label="Ir a la publicación ${n + 1}"></button>`).join("");
  const several = count > 1;
  $("#dots").hidden = !several;
  slider.hidden = false;
  go(0);
  autoplay();
}

export function initBannerSlider() {
  on("site", render);
  $("#dots").onclick = (e) => {
    const n = [...$("#dots").children].indexOf(e.target);
    if (n > -1) { go(n); autoplay(); }
  };

  // Deslizar con el dedo
  let startX = null;
  const slider = $("#slider");
  slider.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); autoplay(); }
    startX = null;
  });
}
