import "./barra-anuncios.css";
import { $, esc } from "../../compartido/elementos.js";
import { money } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";
import { bestPayment, freeShippingFrom } from "../../servicios/ofertas.servicio.js";

/** Mensajes de la barra: primero las promociones reales (descuento por pago, envío gratis) y después los que ella escribió. */
function mensajes() {
  const pay = bestPayment(), free = freeShippingFrom();
  const promos = [];
  if (pay) promos.push(`${pay.discount}% OFF pagando con ${pay.name}`);
  if (free) promos.push(`Envío gratis desde ${money(free)}`);
  return [...promos, ...state.announcements];
}

function render() {
  const bar = $("#announce"), list = mensajes();
  if (!list.length) { bar.hidden = true; return; }
  let half = list;
  while (half.length < 6) half = half.concat(list); // que cubra todo el ancho
  const html = half.map((t) => `<span>${esc(t)}</span>`).join("");
  $("#announceTrack").innerHTML = html + html; // dos mitades para que el loop no se corte
  $("#announceTrack").style.setProperty("--dur", Math.max(20, half.join("").length / 4) + "s");
  bar.hidden = false;
}

export function initAnnounceBar() {
  on("site", render);
}
