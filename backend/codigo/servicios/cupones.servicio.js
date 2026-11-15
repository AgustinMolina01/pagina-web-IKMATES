// Cupones de descuento: un código (ej: IKMATES10) que el cliente escribe en el carrito.
// Puede ser un % o un monto fijo, con compra mínima, fecha de vencimiento y cantidad máxima de usos.
const { all, one, exec } = require("../base-de-datos/conexion");
const { isActive, nonNegInt, posInt, isDate, today } = require("../utilidades/validacion");

const couponRow = (r) => ({
  id: r.id, code: r.code, kind: r.kind, value: r.value, minTotal: r.min_total, maxUses: r.max_uses,
  uses: r.uses || 0, expires: r.expires || "", active: !!r.active,
});

const listCoupons = () => all("SELECT * FROM coupons ORDER BY id DESC").map(couponRow);

/** Código en mayúsculas, sin espacios: "ikmates 10" → "IKMATES10". */
const cleanCode = (v) => String(v ?? "").toUpperCase().replace(/\s+/g, "").slice(0, 30);

/** Valida lo que manda el panel. Devuelve { values } o { error }. */
function cleanCoupon(b, exceptId = 0) {
  const code = cleanCode(b.code);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "El código debe tener entre 3 y 30 letras o números, sin espacios (ej: IKMATES10)" };
  if (one("SELECT 1 FROM coupons WHERE code=? AND id<>?", [code, exceptId])) return { error: "Ya existe un cupón con ese código" };
  const kind = b.kind === "amount" ? "amount" : "percent";
  const value = posInt(b.value);
  if (!value) return { error: kind === "percent" ? "Poné el porcentaje de descuento (ej: 10)" : "Poné el monto de descuento en pesos" };
  if (kind === "percent" && value > 90) return { error: "El descuento no puede ser mayor al 90%" };
  const minTotal = nonNegInt(b.minTotal);
  if (b.minTotal !== "" && b.minTotal != null && minTotal === null) return { error: "La compra mínima debe ser un número" };
  const maxUses = b.maxUses === "" || b.maxUses == null ? null : posInt(b.maxUses);
  if (b.maxUses !== "" && b.maxUses != null && !maxUses) return { error: "La cantidad de usos debe ser un número mayor a 0 (vacío = sin límite)" };
  const expires = String(b.expires || "");
  if (expires && !isDate(expires)) return { error: "La fecha de vencimiento no es válida" };
  return { values: [code, kind, value, minTotal || null, maxUses, expires, isActive(b)] };
}

/**
 * ¿Se puede usar este cupón sobre este monto? (monto = productos menos el descuento por forma de pago)
 * Devuelve { coupon: { code, kind, value, discount } } o { error }.
 */
function applyCoupon(rawCode, amount) {
  const code = cleanCode(rawCode);
  const r = code && one("SELECT * FROM coupons WHERE code=?", [code]);
  if (!r || !r.active) return { error: "Ese cupón no existe" };
  if (r.expires && r.expires < today()) return { error: "Ese cupón está vencido" };
  if (r.max_uses != null && (r.uses || 0) >= r.max_uses) return { error: "Ese cupón ya se usó todas las veces permitidas" };
  if (r.min_total && amount < r.min_total) return { error: `Ese cupón es para compras desde $${Number(r.min_total).toLocaleString("es-AR")}` };
  const discount = r.kind === "amount" ? Math.min(r.value, amount) : Math.round((amount * r.value) / 100);
  return { coupon: { code: r.code, kind: r.kind, value: r.value, discount } };
}

/** Suma un uso (al registrar un pedido). No guarda: el que llama usa persist(). */
const countUse = (code) => exec("UPDATE coupons SET uses = COALESCE(uses,0) + 1 WHERE code=?", [code]);

module.exports = { listCoupons, cleanCoupon, applyCoupon, countUse, cleanCode };
