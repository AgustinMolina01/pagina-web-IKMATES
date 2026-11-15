// Formato de precios, teléfonos, fechas y textos.
export const money = (n) => "$" + Number(n).toLocaleString("es-AR");

/** Minúsculas y sin acentos: para buscar "clasico" y encontrar "Clásico". */
export const normalize = (text) => String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** 5493412147956 → +54 9 341 214-7956 (celulares argentinos). Otros números: "+" delante. */
export function formatPhone(digits) {
  const m = /^549(\d{10})$/.exec(digits);
  if (!m) return "+" + digits;
  const area = m[1].startsWith("11") ? 2 : 3; // 11 = Buenos Aires; el resto, ciudades de 3 dígitos (341, 351, 261…)
  const rest = m[1].slice(area);
  return `+54 9 ${m[1].slice(0, area)} ${rest.slice(0, -4)}-${rest.slice(-4)}`;
}

/** "@usuario" o enlace completo → URL de la red social. */
export function socialUrl(kind, value) {
  if (/^https?:\/\//i.test(value)) return value;
  const user = encodeURIComponent(value.replace(/^@/, "").replace(/^\/+/, ""));
  if (kind === "instagram") return `https://instagram.com/${user}`;
  if (kind === "facebook") return `https://facebook.com/${user}`;
  return `https://www.tiktok.com/@${user}`;
}

/** Texto con varias líneas → lista de líneas no vacías. */
export const toLines = (text) => String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);

/** Fecha de SQLite (UTC) → "13/11/2026". */
export const formatDate = (sql) =>
  new Date(sql.replace(" ", "T") + "Z").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Fecha y hora corta para el panel. */
export const formatDateTime = (sql) =>
  new Date(sql.replace(" ", "T") + "Z").toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

/** Texto del costo de una forma de entrega: "gratis", "a coordinar", "$1.500, gratis desde $20.000", "según provincia". */
export function shippingPriceLabel(method) {
  if (method.byProvince) return "según provincia" + (method.freeFrom ? `, gratis desde ${money(method.freeFrom)}` : "");
  if (method.price === null || method.price === undefined) return "a coordinar";
  if (method.price === 0) return "gratis";
  return money(method.price) + (method.freeFrom ? `, gratis desde ${money(method.freeFrom)}` : "");
}
