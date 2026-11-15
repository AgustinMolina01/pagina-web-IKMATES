// Carrito: productos con sus opciones (color, virola…), envío, forma de pago y totales.
// Los precios y descuentos los calcula el servidor (/api/quote); acá solo se guardan las elecciones.
import { post } from "../compartido/peticiones.js";
import { money } from "../compartido/formato.js";
import { state, emit } from "./estado.js";
import { findProduct } from "./catalogo.servicio.js";
import { waLink } from "./ajustes.servicio.js";

const CART_KEY = "ik_cart_v2";
const CHECKOUT_KEY = "ik_checkout";

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* modo privado */ } };

/** Dos renglones son iguales si tienen el mismo producto y las mismas opciones. */
export const cartKey = (id, options = {}) =>
  id + "|" + Object.keys(options).sort().map((k) => `${k}=${options[k]}`).join(";");

export function loadCart() {
  state.cart = read(CART_KEY, []).filter((i) => i && i.key && i.id && i.qty > 0);
  state.checkout = { shippingId: null, paymentId: null, shipTo: "", province: "", coupon: "", ...read(CHECKOUT_KEY, {}) };
}
const saveCart = () => write(CART_KEY, state.cart);
export const saveCheckout = () => write(CHECKOUT_KEY, state.checkout);

export const cartCount = () => state.cart.reduce((n, i) => n + i.qty, 0);
const qtyOf = (id) => state.cart.filter((i) => i.id == id).reduce((n, i) => n + i.qty, 0);

/** Agrega un producto. Devuelve { ok } o { error } (sin stock, sin elegir opciones…). */
export function addToCart(id, options = {}, qty = 1) {
  const product = findProduct(id);
  if (!product || product.soldOut) return { error: "Este producto ya no está disponible" };
  for (const group of product.options) {
    const value = group.values.find((v) => v.label === options[group.name]);
    if (!value) return { error: `Elegí ${group.name.toLowerCase()}` };
    if (value.soldOut) return { error: `"${value.label}" está agotado` };
  }
  if (product.stock !== null && qtyOf(id) + qty > product.stock) {
    return { error: product.stock === 1 ? "Solo queda 1 unidad" : `Solo quedan ${product.stock} unidades` };
  }
  const key = cartKey(id, options);
  const line = state.cart.find((i) => i.key === key);
  line ? (line.qty += qty) : state.cart.push({ key, id: Number(id), qty, options });
  changed();
  return { ok: true };
}

/** Suma o resta una unidad. Devuelve { error } si no hay más stock. */
export function changeQty(key, delta) {
  const line = state.cart.find((i) => i.key === key);
  if (!line) return {};
  const product = findProduct(line.id);
  if (delta > 0 && product && product.stock !== null && qtyOf(line.id) + delta > product.stock) {
    return { error: product.stock === 1 ? "Solo queda 1 unidad" : `Solo quedan ${product.stock} unidades` };
  }
  line.qty += delta;
  if (line.qty <= 0) state.cart = state.cart.filter((i) => i.key !== key);
  changed();
  return {};
}

export function removeItem(key) {
  state.cart = state.cart.filter((i) => i.key !== key);
  changed();
}

export function clearCart() {
  state.cart = [];
  changed();
}

/** Saca del carrito lo que ya no existe o se agotó (al recargar los productos). */
export function pruneCart() {
  const before = state.cart.length;
  state.cart = state.cart.filter((i) => { const p = findProduct(i.id); return p && !p.soldOut; });
  if (state.cart.length !== before) saveCart();
}

function changed() {
  saveCart();
  emit("cart");
  refreshQuote();
}

// ---------- Elecciones de envío y pago ----------
export function setCheckout(patch) {
  state.checkout = { ...state.checkout, ...patch };
  saveCheckout();
  refreshQuote();
}

/** Si lo guardado ya no existe (ella lo desactivó), se descarta; si hay una sola opción, se elige sola. */
export function normalizeCheckout() {
  const c = state.checkout;
  if (!state.shipping.some((s) => s.id === c.shippingId)) c.shippingId = state.shipping.length === 1 ? state.shipping[0].id : null;
  if (!state.payments.some((p) => p.id === c.paymentId)) c.paymentId = state.payments.length === 1 ? state.payments[0].id : null;
  saveCheckout();
}

export const selectedShipping = () => state.shipping.find((s) => s.id === state.checkout.shippingId) || null;

// ---------- Totales ----------
const orderPayload = () => ({
  items: state.cart.map((i) => ({ id: i.id, qty: i.qty, options: i.options })),
  shippingId: state.checkout.shippingId, paymentId: state.checkout.paymentId, shipTo: state.checkout.shipTo,
  province: state.checkout.province, coupon: state.checkout.coupon,
});

let quoteSeq = 0;
/** Pide los totales al servidor. Ignora respuestas viejas si el cliente siguió tocando. */
export async function refreshQuote() {
  const seq = ++quoteSeq;
  if (!state.cart.length) { state.quote = null; emit("quote"); return; }
  try {
    const quote = await post("/api/quote", orderPayload());
    if (seq === quoteSeq) { state.quote = quote; state.quoteError = ""; }
  } catch (e) {
    if (seq === quoteSeq) { state.quote = null; state.quoteError = e.status ? e.message : ""; } // sin servidor: error vacío
  }
  if (seq === quoteSeq) emit("quote");
}

/** Qué falta elegir antes de enviar el pedido (lista de textos), según lo que dijo el servidor. */
export function missingChoices() {
  const out = [];
  if (state.payments.length && !state.checkout.paymentId) out.push("cómo vas a pagar");
  if (state.shipping.length && !state.checkout.shippingId) out.push("cómo querés recibir tu pedido");
  else {
    if (selectedShipping()?.byProvince && !state.checkout.province) out.push("tu provincia");
    if (selectedShipping()?.needsAddress && state.checkout.shipTo.trim().length < 6) out.push("la dirección de entrega");
  }
  return out;
}

// ---------- Enviar el pedido ----------
/** Mensaje de WhatsApp con el detalle completo. */
export function orderMessage(order, id, customerName) {
  const lines = order.lines.map((l) => {
    const opts = l.options && l.options.length ? ` (${l.options.join(", ")})` : "";
    return `• ${l.qty} x ${l.name}${opts} — ${money(l.subtotal)}${l.wholesale ? " (precio mayorista)" : ""}`;
  });
  const parts = [`Hola IK Mates! Quiero hacer este pedido${id ? " #" + id : ""}:`, "", ...lines, ""];
  parts.push(`Subtotal: ${money(order.subtotal)}`);
  if (order.payment) {
    parts.push(order.discount > 0 ? `Pago: ${order.payment.name} (${order.payment.discountPct}% off: −${money(order.discount)})` : `Pago: ${order.payment.name}`);
  }
  if (order.coupon) parts.push(`Cupón ${order.coupon.code}: −${money(order.coupon.discount)}`);
  if (order.shipping) {
    const cost = order.shipping.pending ? "a coordinar" : order.shipping.free ? "gratis" : money(order.shipping.cost);
    parts.push(`Entrega: ${order.shipping.name}${order.shipping.province ? " a " + order.shipping.province : ""} (${cost})`);
    if (order.shipping.address) parts.push(`Dirección: ${order.shipping.address}`);
  }
  parts.push(`Total: ${money(order.total)}${order.shipping && order.shipping.pending ? " + envío a coordinar" : ""}`);
  if (customerName) parts.push("", `Cliente: ${customerName}`);
  parts.push("", "¿Me confirman disponibilidad y envío?");
  return parts.join("\n");
}

/** Registra el pedido en el servidor y devuelve { order, id } (o lanza el error del servidor). */
export async function submitOrder() {
  const order = await post("/api/orders", orderPayload());
  return { order, id: order.id };
}

export const whatsappUrl = (message) => waLink(message);
