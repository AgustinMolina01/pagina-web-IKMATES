import "./carrito.css";
import { $, esc, debounce } from "../../compartido/elementos.js";
import { money, shippingPriceLabel } from "../../compartido/formato.js";
import { freeShippingFrom } from "../../servicios/ofertas.servicio.js";
import { state, on } from "../../servicios/estado.js";
import { findProduct, emojiFor, loadProducts } from "../../servicios/catalogo.servicio.js";
import {
  cartCount, changeQty, removeItem, clearCart, setCheckout, saveCheckout, refreshQuote, missingChoices,
  selectedShipping, normalizeCheckout, submitOrder, orderMessage, whatsappUrl, pruneCart,
} from "../../servicios/carrito.servicio.js";
import { toast } from "../aviso/aviso.js";
import { PROVINCIAS } from "../../compartido/provincias.js";

export const openCart = () => { $("#drawer").classList.add("open"); $("#overlay").classList.add("show"); };
export const closeCart = () => { $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show"); };

/** Renglón del servidor que corresponde a un renglón del carrito (mismo producto y mismas opciones). */
function quoteLine(item) {
  const product = findProduct(item.id);
  if (!state.quote || !product) return null;
  const labels = product.options.map((g) => `${g.name}: ${item.options[g.name]}`).join(";");
  return state.quote.lines.find((l) => l.id === item.id && l.options.join(";") === labels) || null;
}

// ---------- Renglones ----------
function renderItems() {
  const box = $("#cartItems");
  $("#cartCount").textContent = cartCount();
  if (!state.cart.length) {
    box.innerHTML = `<div class="empty">Tu carrito está vacío.<br>Sumá productos para armar tu pedido.</div>`;
    return;
  }
  box.innerHTML = state.cart.map((item) => {
    const p = findProduct(item.id);
    if (!p) return "";
    const q = quoteLine(item), unit = q ? q.unit : p.price;
    const opts = Object.values(item.options).join(" · ");
    const hint = p.wholesale ? (q && q.wholesale ? `<span class="hint">Precio mayorista aplicado</span>` : `<span class="hint">Desde ${p.wholesale.min} u.: ${money(p.wholesale.price)} c/u</span>`) : "";
    return `<div class="item">
      <div class="item-ico">${p.img ? `<img src="${esc(p.img)}" alt="">` : emojiFor(p.cat)}</div>
      <div><h4>${esc(p.name)}</h4>${opts ? `<span class="opts">${esc(opts)}</span>` : ""}<small>${money(unit)} c/u</small>${hint}
        <div class="qty"><button data-dec="${esc(item.key)}" aria-label="Menos">−</button><span>${item.qty}</span><button data-inc="${esc(item.key)}" aria-label="Más">+</button></div></div>
      <div class="item-right">${money(unit * item.qty)}<button class="rm" data-rm="${esc(item.key)}">Quitar</button></div>
    </div>`;
  }).join("");
}

// ---------- Incentivo de envío gratis ----------
/** Total de lo que lleva (con el descuento por pago si el servidor ya lo calculó). */
function cartAmount() {
  if (state.quote) return state.quote.subtotal - state.quote.discount;
  return state.cart.reduce((n, i) => n + i.qty * (findProduct(i.id) || { price: 0 }).price, 0);
}

function renderProgress() {
  const box = $("#cartProgress"), goal = freeShippingFrom();
  if (!state.cart.length || !goal) { box.innerHTML = ""; return; }
  const amount = cartAmount(), left = goal - amount, pct = Math.min(100, Math.round((amount / goal) * 100));
  box.innerHTML = `<div class="ship-goal${left <= 0 ? " done" : ""}">
    <p>${left <= 0 ? "🎉 <b>¡Tu envío es gratis!</b>" : `Te faltan <b>${money(left)}</b> para tener <b>envío gratis</b>`}</p>
    <div class="ship-bar"><span style="width:${pct}%"></span></div></div>`;
}

// ---------- Barra fija del celular ----------
function renderBar() {
  const bar = $("#cartBar"), n = cartCount();
  bar.hidden = !n;
  document.body.classList.toggle("has-cartbar", n > 0);
  if (!n) return;
  $("#cartBarQty").textContent = n;
  $("#cartBarTotal").textContent = money(state.quote ? state.quote.total : cartAmount());
}

// ---------- Entrega y pago ----------
function choice(name, value, checked, title, desc, price, priceOff) {
  return `<label class="choice${checked ? " on" : ""}"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""}>
    <span class="choice-main"><strong>${esc(title)}</strong>${desc ? `<small>${esc(desc)}</small>` : ""}</span>
    ${price ? `<span class="choice-price${priceOff ? " off" : ""}">${esc(price)}</span>` : ""}</label>`;
}

function renderChoices() {
  const box = $("#cartChoices");
  if (!state.cart.length || (!state.shipping.length && !state.payments.length)) { box.innerHTML = ""; return; }
  const c = state.checkout, ship = selectedShipping();
  // Envío con costo por provincia: el cliente elige la suya y ve el precio
  const provinces = ship && ship.byProvince ? `<select class="address" id="shipProv" aria-label="Provincia de entrega">
      <option value="">Elegí tu provincia…</option>
      ${PROVINCIAS.map((p) => { const v = ship.provincePrices[p]; return `<option value="${esc(p)}" ${p === c.province ? "selected" : ""}>${esc(p)} — ${v == null ? "a coordinar" : v === 0 ? "gratis" : money(v)}</option>`; }).join("")}
    </select>` : "";
  const shipping = state.shipping.length ? `<h4>¿Cómo querés recibir tu pedido?</h4>` +
    state.shipping.map((m) => choice("ship", m.id, m.id === c.shippingId, m.name, m.description, shippingPriceLabel(m), m.price === 0)).join("") + provinces +
    (ship && ship.needsAddress ? `<textarea class="address" id="shipTo" rows="2" maxlength="300" placeholder="Dirección de entrega (calle, número, localidad, código postal)">${esc(c.shipTo)}</textarea>` : "") : "";
  const payments = state.payments.length ? `<h4>¿Cómo vas a pagar?</h4>` +
    state.payments.map((p) => choice("pay", p.id, p.id === c.paymentId, p.name, p.description, p.discount ? `${p.discount}% OFF` : "", true)).join("") : "";
  box.innerHTML = `<div class="choices">${shipping}${payments}</div>`;
}

// ---------- Totales (los calcula el servidor) ----------
function renderSummary() {
  const box = $("#cartSummary");
  if (!state.cart.length) { box.innerHTML = ""; return; }
  const q = state.quote;
  if (!q) {
    // Sin respuesta del servidor: error (ej. sin stock) o modo sin conexión
    if (state.quoteError) { box.innerHTML = `<div class="sum-err" role="alert">${esc(state.quoteError)}</div>`; return; }
    const total = state.cart.reduce((n, i) => n + i.qty * (findProduct(i.id) || { price: 0 }).price, 0);
    box.innerHTML = `<div class="sum-row total"><span>Total</span><span>${money(total)}</span></div>`;
    return;
  }
  const ship = q.shipping;
  const shipText = !ship ? "—" : ship.pending ? "A coordinar" : ship.free ? "Gratis" : money(ship.cost);
  const missing = missingChoices();
  box.innerHTML = `
    <div class="sum-row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
    ${q.discount > 0 ? `<div class="sum-row discount"><span>${esc(q.payment.name)} (${q.payment.discountPct}% off)</span><span>−${money(q.discount)}</span></div>` : ""}
    ${q.coupon ? `<div class="sum-row discount"><span>Cupón ${esc(q.coupon.code)}</span><span>−${money(q.coupon.discount)}</span></div>` : ""}
    ${ship || state.shipping.length ? `<div class="sum-row"><span>Envío</span><span>${shipText}</span></div>` : ""}
    <div class="sum-row total"><span>Total</span><span>${money(q.total)}</span></div>
    ${ship && ship.pending ? `<p class="sum-note">El costo del envío lo coordinamos por WhatsApp.</p>` : ""}
    ${missing.length ? `<p class="sum-note">Falta elegir: ${esc(missing.join(", "))}.</p>` : ""}`;
}

// ---------- Cupón ----------
/** Muestra si el cupón se aplicó o por qué no. Un cupón inválido se descarta (no frena el pedido). */
function renderCoupon() {
  const box = $("#cartCoupon"), msg = $("#couponMsg"), q = state.quote;
  box.hidden = !state.cart.length;
  if (q && q.coupon) {
    msg.className = "cupon-msg ok";
    msg.innerHTML = `✔ Cupón <b>${esc(q.coupon.code)}</b> aplicado: −${money(q.coupon.discount)} <button type="button" class="link-btn cupon-quitar" id="couponRemove">Quitar</button>`;
    $("#couponInput").value = q.coupon.code;
  } else if (q && q.couponError) {
    msg.className = "cupon-msg bad";
    msg.textContent = q.couponError;
    state.checkout.coupon = "";
    saveCheckout();
  } else if (!state.checkout.coupon) {
    msg.className = "cupon-msg";
    msg.textContent = "";
  }
}

/** El botón principal muestra el total: el cliente sabe exactamente cuánto va a pedir. */
function renderCheckoutButton() {
  const total = state.quote ? state.quote.total : cartAmount();
  $("#checkout").textContent = state.cart.length ? `Finalizar pedido por WhatsApp · ${money(total)}` : "Enviar pedido por WhatsApp";
}

// ---------- Enviar el pedido ----------
async function checkout() {
  if (!state.cart.length) return toast("Tu carrito está vacío");
  const missing = missingChoices();
  if (missing.length) {
    $("#shipTo")?.classList.toggle("bad", missing.includes("la dirección de entrega"));
    $("#shipProv")?.classList.toggle("bad", missing.includes("tu provincia"));
    return toast("Falta elegir " + missing[0]);
  }
  const button = $("#checkout");
  button.disabled = true;
  const popup = window.open("about:blank", "_blank"); // se abre ya, así el navegador no lo bloquea
  let order = null, id = null;
  try {
    ({ order, id } = await submitOrder());
  } catch (e) {
    if (e.status) { // el servidor rechazó el pedido (sin stock, falta algo…)
      if (popup) popup.close();
      button.disabled = false;
      toast(e.message);
      await loadProducts();
      return;
    }
    // Sin conexión con el servidor: se envía igual por WhatsApp con lo que hay en pantalla
    order = state.quote || {
      lines: state.cart.map((i) => { const p = findProduct(i.id); return { name: p.name, options: Object.entries(i.options).map(([k, v]) => `${k}: ${v}`), qty: i.qty, subtotal: p.price * i.qty }; }),
      subtotal: 0, discount: 0, payment: null, shipping: null, total: 0,
    };
    if (!state.quote) order.subtotal = order.total = order.lines.reduce((n, l) => n + l.subtotal, 0);
  }
  const url = whatsappUrl(orderMessage(order, id, state.account && state.account.name));
  if (popup) popup.location.href = url; else window.location.href = url;
  button.disabled = false;
  clearCart();
  closeCart();
  toast(id ? `Pedido #${id} enviado por WhatsApp` : "Pedido enviado por WhatsApp");
  loadProducts(); // el stock cambió
}

export function initCart() {
  const todo = () => { renderItems(); renderProgress(); renderSummary(); renderCoupon(); renderCheckoutButton(); renderBar(); };
  on("cart", () => { renderChoices(); todo(); });
  on("quote", todo);
  on("abrir-carrito", openCart);
  on("site", () => { normalizeCheckout(); renderChoices(); renderProgress(); refreshQuote(); });
  on("products", () => { pruneCart(); renderChoices(); todo(); refreshQuote(); });

  $("#openCart").onclick = openCart;
  $("#cartBar").onclick = openCart;

  // Si volvió y dejó cosas en el carrito, se lo recordamos una sola vez por visita
  try {
    if (state.cart.length && !sessionStorage.getItem("ik_recordatorio")) {
      sessionStorage.setItem("ik_recordatorio", "1");
      setTimeout(() => toast(`Tenés ${cartCount()} ${cartCount() === 1 ? "producto esperándote" : "productos esperándote"} en el carrito`), 1800);
    }
  } catch { /* sin sessionStorage */ }
  $("#closeCart").onclick = closeCart;
  $("#overlay").onclick = closeCart;
  $("#clearCart").onclick = clearCart;
  $("#checkout").onclick = checkout;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

  $("#cartItems").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"), rm = e.target.closest("[data-rm]");
    if (inc) { const r = changeQty(inc.dataset.inc, 1); if (r.error) toast(r.error); }
    if (dec) changeQty(dec.dataset.dec, -1);
    if (rm) removeItem(rm.dataset.rm);
  });

  // Elegir entrega o pago
  const slowQuote = debounce(refreshQuote, 350);
  // Cupón
  $("#couponForm").onsubmit = (e) => {
    e.preventDefault();
    const code = $("#couponInput").value.trim().toUpperCase();
    if (!code) return;
    $("#couponMsg").className = "cupon-msg";
    $("#couponMsg").textContent = "Revisando el cupón…";
    setCheckout({ coupon: code });
  };
  $("#cartCoupon").addEventListener("click", (e) => {
    if (e.target.id !== "couponRemove") return;
    $("#couponInput").value = "";
    setCheckout({ coupon: "" });
  });

  $("#cartChoices").addEventListener("change", (e) => {
    if (e.target.id === "shipProv") { setCheckout({ province: e.target.value }); e.target.classList.remove("bad"); }
    if (e.target.name === "ship") { setCheckout({ shippingId: Number(e.target.value) }); renderChoices(); }
    if (e.target.name === "pay") { setCheckout({ paymentId: Number(e.target.value) }); renderChoices(); }
  });
  $("#cartChoices").addEventListener("input", (e) => {
    if (e.target.id !== "shipTo") return;
    state.checkout.shipTo = e.target.value; // sin volver a dibujar: no se pierde el cursor
    saveCheckout();
    e.target.classList.remove("bad");
    slowQuote();
  });
}
