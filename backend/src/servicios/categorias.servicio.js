// Categorías de dos niveles (categoría > subcategoría). Ella escribe solo el nombre.
const { all, one, exec } = require("../base-de-datos/conexion");
const { oneLine } = require("../utilidades/validacion");

// Nombres que usan las secciones de la página: una categoría con ese nombre recibe otro identificador.
const RESERVED = new Set(["inicio", "nosotros", "contacto", "productos", "slider", "slides", "dots", "search", "announce", "destacados", "como-comprar", "comocomprar"]);

function slugify(name) {
  const s = String(name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "categoria";
  return RESERVED.has(s) ? s + "-cat" : s;
}
function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base, n = 2;
  while (one("SELECT 1 FROM categories WHERE slug=?", [slug])) slug = `${base}-${n++}`;
  return slug;
}

const cleanName = (body) => oneLine(body.name, 60);
const getCategory = (id) => (id ? one("SELECT * FROM categories WHERE id=?", [Number(id)]) : null);

function listCategories() {
  return all("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category=c.slug) AS count FROM categories c ORDER BY sort,id")
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, active: !!r.active, count: r.count, parent_id: r.parent_id || null, image: r.image || "" }));
}

/** Categorías visibles para el público, con el slug de su padre y su foto de portada. */
function publicCategories() {
  return all(`SELECT c.slug, c.name, COALESCE(c.image,'') AS image, p.slug AS parent FROM categories c LEFT JOIN categories p ON p.id=c.parent_id
              WHERE c.active=1 AND (c.parent_id IS NULL OR p.active=1) ORDER BY c.sort, c.id`);
}

/** Solo dos niveles. Devuelve { pid } o { error }. */
function checkParent(parentId, selfId) {
  if (!parentId) return { pid: null };
  const parent = getCategory(parentId);
  if (!parent) return { error: "La categoría principal no existe" };
  if (parent.parent_id) return { error: "Solo hay dos niveles: categoría y subcategoría" };
  if (selfId && parent.id === selfId) return { error: "Una categoría no puede estar dentro de sí misma" };
  if (selfId && one("SELECT 1 FROM categories WHERE parent_id=?", [selfId])) {
    return { error: "Esta categoría ya tiene subcategorías, no puede quedar dentro de otra" };
  }
  return { pid: parent.id };
}

const sameNameExists = (name, parentId, exceptId) =>
  !!one("SELECT 1 FROM categories WHERE lower(name)=lower(?) AND COALESCE(parent_id,0)=? AND id<>?", [name, parentId || 0, exceptId || 0]);

const nextSort = (parentId) =>
  ((one("SELECT MAX(sort) AS m FROM categories WHERE COALESCE(parent_id,0)=?", [parentId || 0]) || {}).m || 0) + 1;

/** Busca o crea una categoría (para la carga desde planilla). No guarda: el que llama usa persist(). */
function ensureCategory(name, parentId) {
  const found = one("SELECT * FROM categories WHERE lower(name)=lower(?) AND COALESCE(parent_id,0)=?", [name, parentId || 0]);
  if (found) return { category: found, created: false };
  const slug = uniqueSlug(name);
  exec("INSERT INTO categories(slug,name,sort,parent_id) VALUES(?,?,?,?)", [slug, name, nextSort(parentId), parentId || null]);
  return { category: one("SELECT * FROM categories WHERE slug=?", [slug]), created: true };
}

module.exports = {
  slugify, uniqueSlug, cleanName, getCategory, listCategories, publicCategories,
  checkParent, sameNameExists, nextSort, ensureCategory,
};
