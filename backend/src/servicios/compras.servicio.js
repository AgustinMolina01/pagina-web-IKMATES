// Cálculo y registro de pedidos. El servidor es la única fuente de verdad: nunca usa precios que mande el navegador.
const { all, one, exec, run, persist } = require("../base-de-datos/conexion");
const { text } = require("../utilidades/validacion");
const { isSoldOut, sanitizeOptions } = require("./productos.servicio");
const { applyCoupon, countUse } = require("./cupones.servicio");
const { PROVINCIAS } = require("../utilidades/provincias");

const parseJson = (s, fallback) => { try { return JSON.parse(s) ?? fallback; } catch (e) { return fallback; } };

// ---------- Envíos y formas de pago ----------
/** {"Santa Fe": 3000, "Córdoba": null…}: solo provincias válidas; null = a coordinar en esa provincia. */
function provincePrices(raw) {
  const obj = typeof raw === "string" ? parseJson(raw, {}) : raw;
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  for (const p of PROVINCIAS) {
    if (!(p in obj)) continue;
    const v = obj[p];
    const n = v === "" || v === null || v === undefined ? null : Math.round(Number(v));
    out[p] = Number.isFinite(n) && n >= 0 ? n : null;
  }
  return out;
}
const shippingRow = (r) => {
  const prices = provincePrices(r.province_prices);
  const byProvince = Object.keys(prices).length > 0;
  return {
    id: r.id, name: r.name, description: r.description, price: byProvince ? null : r.price, freeFrom: r.free_from,
    needsAddress: !!r.needs_address, active: !!r.active, sort: r.sort, byProvince, provincePrices: prices,
  };
};
const paymentRow = (r) => ({ id: r.id, name: r.name, description: r.description, discount: r.discount || 0, active: !!r.active, sort: r.sort });

const listShipping = ({ onlyActive = false } = {}) =>
  all(`SELECT * FROM shipping_methods ${onlyActive ? "WHERE active=1" : ""} ORDER BY sort,id`).map(shippingRow);
const listPayments = ({ onlyActive = false } = {}) =>
  all(`SELECT * FROM payment_methods ${onlyActive ? "WHERE active=1" : ""} ORDER BY sort,id`).map(paymentRow);

// ---------- Armado del pedido ----------
/**
 * input: { items:[{ id, qty, options:{ Color:"Negro" } }], shippingId, paymentId, shipTo }
 * strict = true  (pedido real): exige forma de pago, envío y dirección.
 * strict = false (cotización): si faltan, no falla; devuelve lo calculado y la lista "missing".
 * Devuelve { error } o { lines, subtotal, discount, payment, shipping, missing, total }.
 */
function buildOrder(input = {}, { strict = true } = {}) {
  const missing = [];
  const items = Array.isArray(input.items) ? input.items.slice(0, 60) : [];
  const products = new Map(); // id -> fila
  const entries = [];         // renglones válidos, en el orden recibido

  for (const it of items) {
    const id = Number(it.id), qty = Math.round(Number(it.qty));
    if (!Number.isFinite(id) || !(qty > 0 && qty <= 999)) continue;
    if (!products.has(id)) products.set(id, one("SELECT * FROM products WHERE id=?", [id]) || null);
    const row = products.get(id);
    if (!row || !row.active || isSoldOut(row)) continue; // lo agotado o inexistente se descarta

    // Variantes: hay que elegir una opción disponible de cada grupo
    const groups = sanitizeOptions(parseJson(row.options, []));
    const chosen = it.options && typeof it.options === "object" ? it.options : {};
    const labels = [];
    for (const g of groups) {
      const value = g.values.find((v) => v.label === String(chosen[g.name] ?? ""));
      if (!value) return { error: `Elegí ${g.name.toLowerCase()} para "${row.name}"` };
      if (value.soldOut) return { error: `"${value.label}" (${g.name.toLowerCase()}) está agotado en "${row.name}"` };
      labels.push(`${g.name}: ${value.label}`);
    }
    entries.push({ row, qty, labels });
  }
  if (!entries.length) return { error: "El carrito está vacío o los productos ya no están disponibles" };

  // Misma variante repetida = un solo renglón
  const merged = new Map();
  for (const e of entries) {
    const key = e.row.id + "|" + e.labels.join(";");
    if (merged.has(key)) merged.get(key).qty += e.qty;
    else merged.set(key, { ...e });
  }

  // Cantidad total por producto (todas sus variantes juntas): define el stock y el precio mayorista
  const totalQty = new Map();
  for (const e of merged.values()) totalQty.set(e.row.id, (totalQty.get(e.row.id) || 0) + e.qty);
  for (const [id, qty] of totalQty) {
    const row = products.get(id);
    if (row.stock !== null && row.stock !== undefined && qty > row.stock) {
      return { error: row.stock === 1 ? `Solo queda 1 unidad de "${row.name}"` : `Solo quedan ${row.stock} unidades de "${row.name}"` };
    }
  }

  const lines = [...merged.values()].map((e) => {
    const qty = totalQty.get(e.row.id);
    const wholesale = !!(e.row.wholesale_price && e.row.wholesale_min && qty >= e.row.wholesale_min);
    const unit = wholesale ? e.row.wholesale_price : e.row.price;
    return { id: e.row.id, name: e.row.name, options: e.labels, qty: e.qty, unit, subtotal: unit * e.qty, wholesale };
  });
  const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);

  // Forma de pago (descuento sobre los productos)
  let payment = null, discount = 0;
  const payments = listPayments({ onlyActive: true });
  if (payments.length) {
    const p = payments.find((x) => x.id === Number(input.paymentId));
    if (p) {
      discount = Math.round((subtotal * p.discount) / 100);
      payment = { id: p.id, name: p.name, discountPct: p.discount, discount };
    } else if (strict) return { error: "Elegí cómo vas a pagar" };
    else missing.push("payment");
  }

  // Cupón de descuento (sobre lo que queda después del descuento por forma de pago)
  let coupon = null, couponDiscount = 0, couponError = "";
  if (String(input.coupon || "").trim()) {
    const c = applyCoupon(input.coupon, subtotal - discount);
    if (c.error) {
      if (strict) return { error: c.error };
      couponError = c.error; // en la cotización no frena: el carrito muestra el aviso
    } else {
      coupon = c.coupon;
      couponDiscount = c.coupon.discount;
    }
  }
  const productsTotal = subtotal - discount - couponDiscount;

  // Envío: gratis desde cierto monto, a coordinar, con costo fijo o con costo según la provincia
  let shipping = null, shippingCost = 0;
  const methods = listShipping({ onlyActive: true });
  if (methods.length) {
    const m = methods.find((x) => x.id === Number(input.shippingId));
    if (m) {
      const address = text(input.shipTo, 300);
      let province = "", price = m.price;
      if (m.byProvince) {
        province = PROVINCIAS.includes(input.province) ? input.province : "";
        if (!province) {
          if (strict) return { error: "Elegí tu provincia para calcular el envío" };
          missing.push("province");
        }
        price = province ? m.provincePrices[province] : null; // provincia sin precio = a coordinar
      }
      if (m.needsAddress && address.length < 6) {
        if (strict) return { error: "Completá la dirección de entrega" };
        missing.push("address");
      }
      const pending = price === null || price === undefined;
      const free = !pending && m.freeFrom != null && productsTotal >= m.freeFrom;
      shippingCost = pending ? 0 : free ? 0 : price;
      shipping = { id: m.id, name: m.name, cost: pending ? null : shippingCost, pending, free, address: m.needsAddress ? address : "", province };
    } else if (strict) return { error: "Elegí cómo querés recibir tu pedido" };
    else missing.push("shipping");
  }

  return { lines, subtotal, discount, payment, coupon, couponError, shipping, missing, total: productsTotal + shippingCost };
}

// ---------- Stock ----------
const qtyByProduct = (lines) => {
  const m = new Map();
  for (const l of lines) m.set(l.id, (m.get(l.id) || 0) + l.qty);
  return m;
};
/** sign = -1 descuenta (pedido nuevo), +1 repone (pedido cancelado). Solo toca productos con stock controlado. No guarda. */
function adjustStock(lines, sign) {
  for (const [id, qty] of qtyByProduct(lines)) {
    exec("UPDATE products SET stock = MAX(0, stock + ?) WHERE id=? AND stock IS NOT NULL", [sign * qty, id]);
  }
}

/** Guarda el pedido y descuenta el stock. Devuelve el id. */
function saveOrder(order, customerId) {
  adjustStock(order.lines, -1);
  if (order.coupon) countUse(order.coupon.code);
  const details = { subtotal: order.subtotal, discount: order.discount, payment: order.payment, coupon: order.coupon, shipping: order.shipping };
  return run("INSERT INTO orders(items,total,customer_id,details) VALUES(?,?,?,?)", [JSON.stringify(order.lines), order.total, customerId || null, JSON.stringify(details)]);
}

const STATUSES = ["nuevo", "atendido", "cancelado"];
/** Cambia el estado. Al cancelar repone el stock; al reabrir un pedido cancelado lo vuelve a descontar. */
function setOrderStatus(id, status) {
  const row = one("SELECT * FROM orders WHERE id=?", [id]);
  if (!row) return false;
  const lines = parseJson(row.items, []);
  if (status === "cancelado" && row.status !== "cancelado") adjustStock(lines, +1);
  if (status !== "cancelado" && row.status === "cancelado") adjustStock(lines, -1);
  exec("UPDATE orders SET status=? WHERE id=?", [status, id]);
  persist();
  return true;
}

function removeOrder(id) {
  const row = one("SELECT * FROM orders WHERE id=?", [id]);
  if (row && row.status !== "cancelado") adjustStock(parseJson(row.items, []), +1); // un pedido borrado libera su stock
  exec("DELETE FROM orders WHERE id=?", [id]);
  persist();
}

const orderRow = (r) => ({
  id: r.id, created_at: r.created_at, total: r.total, status: r.status,
  items: parseJson(r.items, []), details: parseJson(r.details, {}),
});

module.exports = { listShipping, listPayments, provincePrices, buildOrder, saveOrder, setOrderStatus, removeOrder, orderRow, STATUSES, parseJson };
