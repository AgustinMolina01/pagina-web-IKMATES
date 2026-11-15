// Datos para vender más: porcentaje de oferta, mejor descuento por forma de pago y envío gratis.
// Todo sale de lo que ella carga en el panel (productos, y Envíos y pagos): nada está inventado.
import { state } from "./estado.js";

/** Porcentaje de oferta de un producto con "precio anterior" (0 si no tiene). */
export const discountPct = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

/** La forma de pago con mayor descuento, o null si ninguna tiene. */
export function bestPayment() {
  const withDiscount = state.payments.filter((p) => p.discount > 0).sort((a, b) => b.discount - a.discount);
  return withDiscount[0] || null;
}

export const priceWithDiscount = (price, pct) => Math.round(price * (1 - pct / 100));

/** Monto de compra desde el cual el envío es gratis (el menor de todas las formas de entrega), o null. */
export function freeShippingFrom() {
  const amounts = state.shipping.filter((s) => s.freeFrom != null && s.price !== 0).map((s) => s.freeFrom);
  return amounts.length ? Math.min(...amounts) : null;
}

/** ¿Hay alguna forma de entrega siempre gratis (ej: retiro en el local)? */
export const hasFreePickup = () => state.shipping.some((s) => s.price === 0);
