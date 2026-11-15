import "./tarjeta-producto.css";
import { esc } from "../../compartido/elementos.js";
import { money } from "../../compartido/formato.js";
import { emojiFor, toneFor, stockNote, hasOptions } from "../../servicios/catalogo.servicio.js";
import { rutaProducto } from "../../servicios/navegacion.servicio.js";
import { discountPct, bestPayment, priceWithDiscount } from "../../servicios/ofertas.servicio.js";

/**
 * HTML de una tarjeta. Atributos que usa el catálogo:
 *   href="/producto/id"  → página del producto (foto y nombre); el botón "Elegir opciones" usa data-open="id"
 *   data-id="id"    → agrega directo al carrito (solo productos sin opciones)
 *
 * Pensada para vender: precio grande, oferta tachada con su %, precio con descuento por pago,
 * aviso de pocas unidades y un botón de compra siempre a la vista.
 */
export function cardHtml(p) {
  const note = stockNote(p);
  const off = discountPct(p);
  const pay = bestPayment();
  const badges = p.soldOut
    ? `<span class="tag tag-out">Sin stock</span>`
    : `${off ? `<span class="tag tag-off">−${off}%</span>` : ""}${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}`;
  const action = p.soldOut
    ? `<button class="add" disabled>Sin stock</button>`
    : hasOptions(p)
      ? `<button class="add" data-open="${p.id}">Elegir opciones</button>`
      : `<button class="add" data-id="${p.id}">Agregar al carrito</button>`;
  return `
    <article class="card${p.soldOut ? " sold" : ""}">
      <a class="card-img ${toneFor(p.cat)}" href="${rutaProducto(p.id)}" aria-label="${esc(p.name)}">
        ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : emojiFor(p.cat)}
        <div class="tags">${badges}</div>
      </a>
      <div class="card-body">
        <h3><a href="${rutaProducto(p.id)}">${esc(p.name)}</a></h3>
        <p>${esc(p.desc)}</p>
        ${note ? `<span class="low-stock">🔥 ${note}</span>` : ""}
        <div class="price-box">
          <div class="price-line">
            <span class="price">${money(p.price)}</span>
            ${off ? `<s class="price-old">${money(p.oldPrice)}</s>` : ""}
          </div>
          ${pay && !p.soldOut ? `<span class="pay-off"><b>${money(priceWithDiscount(p.price, pay.discount))}</b> con ${esc(pay.name.toLowerCase())}</span>` : ""}
          ${p.wholesale ? `<span class="wh">Por mayor: ${money(p.wholesale.price)} desde ${p.wholesale.min} u.</span>` : ""}
        </div>
        ${action}
      </div>
    </article>`;
}
