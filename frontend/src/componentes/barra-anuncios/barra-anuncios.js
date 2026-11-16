import "./barra-anuncios.css";
import { $, esc } from "../../compartido/elementos.js";
import { money } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";
import { bestPayment, freeShippingFrom } from "../../servicios/ofertas.servicio.js";

let timer = null, cambio = null, resize = null, mensajesMovil = [], indiceMovil = 0;

/** Mensajes de la barra: primero las promociones reales (descuento por pago, envío gratis) y después los que ella escribió. */
function mensajes() {
  const pay = bestPayment(), free = freeShippingFrom();
  const promos = [];
  if (pay) promos.push(`${pay.discount}% OFF pagando con ${pay.name}`);
  if (free) promos.push(`Envío gratis desde ${money(free)}`);
  return [...promos, ...state.announcements];
}

function render() {
  const bar = $("#announce"), track = $("#announceTrack"), list = mensajes();
  clearInterval(timer);
  clearTimeout(cambio);
  timer = cambio = null;
  if (!list.length) {
    track.classList.remove("announce-mobile", "is-changing");
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  if (window.innerWidth <= 700) {
    mensajesMovil = list;
    indiceMovil %= list.length;
    track.classList.add("announce-mobile");
    track.classList.remove("is-changing");
    track.innerHTML = `<span>${esc(list[indiceMovil])}</span>`;
    if (list.length > 1) {
      timer = setInterval(() => {
        indiceMovil = (indiceMovil + 1) % mensajesMovil.length;
        track.classList.add("is-changing");
        cambio = setTimeout(() => {
          track.innerHTML = `<span>${esc(mensajesMovil[indiceMovil])}</span>`;
          track.classList.remove("is-changing");
        }, 220);
      }, 3500);
    }
    return;
  }
  track.classList.remove("announce-mobile", "is-changing");
  let half = list;
  while (half.length < 6) half = half.concat(list); // que cubra todo el ancho
  const html = half.map((t) => `<span>${esc(t)}</span>`).join("");
  track.innerHTML = html + html; // dos mitades para que el loop no se corte
  track.style.setProperty("--dur", Math.max(20, half.join("").length / 4) + "s");
}

export function initAnnounceBar() {
  on("site", render);
  window.addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(render, 120);
  }, { passive: true });
}
