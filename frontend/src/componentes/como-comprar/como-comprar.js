import "./como-comprar.css";
import { $, esc } from "../../compartido/elementos.js";
import { toLines, shippingPriceLabel } from "../../compartido/formato.js";
import { state, on } from "../../servicios/estado.js";

const card = (title, body) => `<div class="info-card"><h3>${title}</h3>${body}</div>`;
const list = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;

function render() {
  const s = state.settings;
  // Las formas de pago y de entrega que ella configuró + las líneas de texto libre de Ajustes
  const payments = [
    ...state.payments.map((p) => (p.discount ? `${p.name} — ${p.discount}% de descuento` : p.name)),
    ...toLines(s.payments),
  ];
  const shipping = [
    ...state.shipping.map((m) => `${m.name} — ${shippingPriceLabel(m)}`),
    ...toLines(s.shipping),
  ];
  $("#infoCards").innerHTML =
    (payments.length ? card("Formas de pago", list(payments)) : "") +
    (shipping.length ? card("Envíos y entrega", list(shipping)) : "") +
    (s.wholesaleNote ? card("Compras por mayor", `<p>${esc(s.wholesaleNote)}</p>`) : "");
}

export function initHowToBuy() {
  on("site", render);
}
