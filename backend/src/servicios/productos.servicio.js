// Productos: lectura, limpieza de datos, variantes (opciones) y stock.
const { all, one } = require("../base-de-datos/conexion");
const { isActive, bool, posInt, nonNegInt, text, safeImg } = require("../utilidades/validacion");

// Columnas editables, en el orden en que se guardan.
const COLUMNS = [
  "category", "name", "description", "price", "image", "tag", "active", "sold_out", "featured",
  "wholesale_price", "wholesale_min", "images", "stock", "options", "old_price",
];

const parseJson = (s, fallback) => { try { return JSON.parse(s) ?? fallback; } catch (e) { return fallback; } };

// ---------- Variantes ----------
// [{ name: "Color", values: [{ label: "Negro", soldOut: false }, ...] }]  (hasta 3 grupos de 15 valores)
function sanitizeOptions(input) {
  const out = [], seenGroups = new Set();
  for (const g of Array.isArray(input) ? input : []) {
    if (out.length === 3) break; // los 3 primeros grupos válidos
    const name = text(g && g.name, 30);
    if (!name || seenGroups.has(name.toLowerCase())) continue;
    const seen = new Set(), values = [];
    for (const v of (Array.isArray(g.values) ? g.values : []).slice(0, 15)) {
      const label = text(typeof v === "string" ? v : v && v.label, 30);
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      values.push({ label, soldOut: typeof v === "object" && !!v.soldOut });
    }
    if (values.length) { out.push({ name, values }); seenGroups.add(name.toLowerCase()); }
  }
  return out;
}

// ---------- Stock ----------
// stock = null: sin control. stock = número: se descuenta con cada pedido y al llegar a 0 queda agotado solo.
const isSoldOut = (row) => !!row.sold_out || (row.stock !== null && row.stock !== undefined && row.stock <= 0);

function toProduct(r) {
  const gallery = parseJson(r.images, []);
  return {
    id: r.id, cat: r.category, name: r.name, desc: r.description, price: r.price, img: r.image,
    images: Array.isArray(gallery) ? gallery.filter((x) => typeof x === "string") : [],
    tag: r.tag, active: !!r.active, featured: !!r.featured, sort: r.sort,
    soldOut: isSoldOut(r),     // lo que ve el cliente (marcado a mano o stock en 0)
    soldOutFlag: !!r.sold_out, // la casilla "Sin stock" tal como está guardada (para el panel)
    stock: r.stock === undefined ? null : r.stock,
    options: sanitizeOptions(parseJson(r.options, [])),
    oldPrice: r.old_price && r.old_price > r.price ? r.old_price : null, // solo cuenta si de verdad es más alto
    wholesale: r.wholesale_price && r.wholesale_min ? { price: r.wholesale_price, min: r.wholesale_min } : null,
  };
}

const listProducts = ({ onlyActive = false } = {}) =>
  all(`SELECT * FROM products ${onlyActive ? "WHERE active=1" : ""} ORDER BY sort,id`).map(toProduct);
const getProductRow = (id) => one("SELECT * FROM products WHERE id=?", [Number(id)]);
const nextSort = () => ((one("SELECT MAX(sort) AS m FROM products") || {}).m || 0) + 1;

/** Valida el producto que llega del panel. Devuelve { values } (en el orden de COLUMNS) o { error }. */
function cleanProduct(body) {
  const category = String(body.category || "");
  const name = text(body.name, 120);
  const price = Math.round(Number(body.price));
  if (!one("SELECT 1 FROM categories WHERE slug=?", [category])) return { error: "Elegí una categoría válida" };
  if (!name) return { error: "Falta el nombre" };
  if (!Number.isFinite(price) || price < 0) return { error: "Precio inválido" };

  const wholesalePrice = posInt(body.wholesalePrice), wholesaleMin = posInt(body.wholesaleMin);
  if (!wholesalePrice !== !wholesaleMin) return { error: "Para el precio mayorista completá el precio y la cantidad mínima" };
  if (wholesalePrice && price > 0 && wholesalePrice >= price) return { error: "El precio mayorista tiene que ser menor al precio normal" };

  const oldPrice = posInt(body.oldPrice);
  if (oldPrice && oldPrice <= price) return { error: "El precio anterior tiene que ser mayor al precio actual (es el que se muestra tachado)" };

  const hasStock = body.stock !== "" && body.stock !== null && body.stock !== undefined;
  const stock = nonNegInt(body.stock);
  if (hasStock && stock === null) return { error: "La cantidad en stock debe ser un número (0 o más)" };

  const gallery = (Array.isArray(body.images) ? body.images : []).map(safeImg).filter(Boolean).slice(0, 8);
  const values = [
    category, name, text(body.description, 600), price, safeImg(body.image), text(body.tag, 30),
    isActive(body), bool(body.soldOut), bool(body.featured),
    wholesalePrice, wholesaleMin, JSON.stringify(gallery), stock, JSON.stringify(sanitizeOptions(body.options)), oldPrice,
  ];
  return { values };
}

const placeholders = (n) => Array(n).fill("?").join(",");
const INSERT_SQL = `INSERT INTO products(${COLUMNS.join(",")},sort) VALUES(${placeholders(COLUMNS.length + 1)})`;
const UPDATE_SQL = `UPDATE products SET ${COLUMNS.map((c) => c + "=?").join(",")} WHERE id=?`;

module.exports = {
  COLUMNS, INSERT_SQL, UPDATE_SQL, sanitizeOptions, isSoldOut, toProduct, listProducts, getProductRow, nextSort, cleanProduct,
};
