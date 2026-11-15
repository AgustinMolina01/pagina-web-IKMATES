// Funciones chicas para limpiar y validar datos que llegan del navegador.

const isActive = (b) => (b.active === false || b.active === 0 ? 0 : 1);
const bool = (v) => (v === true || v === 1 || v === "1" || v === "true" ? 1 : 0);

/** Entero positivo o null. */
const posInt = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** Entero >= 0 o null (vacío = null). */
const nonNegInt = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const text = (v, max) => String(v ?? "").trim().slice(0, max);
const oneLine = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Solo enlaces http(s), anclas (#) o rutas propias (/). Bloquea "javascript:" y similares. */
const safeLink = (l) => {
  l = text(l, 300);
  return /^(https?:\/\/|#|\/)/i.test(l) ? l : "";
};
/** Solo imágenes propias (subidas o del sitio). */
const safeImg = (l) => {
  l = text(l, 300);
  return /^(\/uploads\/|\/img\/)/.test(l) ? l : "";
};

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emailOk = (e) => e.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

/** Precio con formato argentino ("18.600,00 ARS", "$ 1.500", "1500") a entero. */
const parsePrice = (v) => {
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return Math.round(Number(s));
};

module.exports = { isActive, bool, posInt, nonNegInt, text, oneLine, safeLink, safeImg, isDate, today, emailOk, parsePrice };
