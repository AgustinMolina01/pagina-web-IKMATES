// Productos en el panel: lista, alta/edición, orden, acciones masivas, cambio de precios y carga desde planilla.
const { Router } = require("express");
const { all, one, exec, run, persist } = require("../../base-de-datos/conexion");
const { posInt, nonNegInt, parsePrice, text } = require("../../utilidades/validacion");
const P = require("../../servicios/productos.servicio");
const { ensureCategory } = require("../../servicios/categorias.servicio");

const router = Router();

router.get("/", (req, res) => res.json(P.listProducts()));

router.post("/", (req, res) => {
  const clean = P.cleanProduct(req.body);
  if (clean.error) return res.status(400).json({ error: clean.error });
  res.json({ id: run(P.INSERT_SQL, [...clean.values, P.nextSort()]) });
});

router.put("/:id", (req, res) => {
  const clean = P.cleanProduct(req.body);
  if (clean.error) return res.status(400).json({ error: clean.error });
  run(P.UPDATE_SQL, [...clean.values, Number(req.params.id)]);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  run("DELETE FROM products WHERE id=?", [Number(req.params.id)]);
  res.json({ ok: true });
});

// ----- Orden dentro de la categoría (flechas ↑ ↓) -----
router.post("/:id/move", (req, res) => {
  const current = one("SELECT id,category FROM products WHERE id=?", [Number(req.params.id)]);
  if (!current) return res.json({ ok: true });
  const ids = all("SELECT id FROM products WHERE category=? ORDER BY sort,id", [current.category]).map((r) => r.id);
  const i = ids.indexOf(current.id), j = i + (Number(req.body.dir) < 0 ? -1 : 1);
  if (j < 0 || j >= ids.length) return res.json({ ok: true });
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((id, n) => exec("UPDATE products SET sort=? WHERE id=?", [n + 1, id]));
  persist();
  res.json({ ok: true });
});

// ----- Acciones sobre varios productos -----
const BULK_FLAGS = {
  show: "active=1", hide: "active=0", soldout: "sold_out=1", instock: "sold_out=0", feature: "featured=1", unfeature: "featured=0",
};
router.post("/bulk", (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isFinite).slice(0, 2000);
  if (!ids.length) return res.status(400).json({ error: "Elegí al menos un producto" });
  const marks = ids.map(() => "?").join(",");
  const action = String(req.body.action || "");

  if (action === "move") {
    const category = String(req.body.category || "");
    if (!one("SELECT 1 FROM categories WHERE slug=?", [category])) return res.status(400).json({ error: "Elegí la categoría de destino" });
    exec(`UPDATE products SET category=? WHERE id IN (${marks})`, [category, ...ids]);
  } else if (action === "delete") {
    exec(`DELETE FROM products WHERE id IN (${marks})`, ids);
  } else if (BULK_FLAGS[action]) {
    exec(`UPDATE products SET ${BULK_FLAGS[action]} WHERE id IN (${marks})`, ids);
  } else {
    return res.status(400).json({ error: "Acción no válida" });
  }
  persist();
  res.json({ ok: true, count: ids.length });
});

// ----- Cambio de precios (con vista previa) -----
router.post("/bulk-price", (req, res) => {
  const b = req.body, value = Number(b.value), mode = b.mode === "fixed" ? "fixed" : "percent";
  if (!Number.isFinite(value) || value === 0) return res.status(400).json({ error: "Ingresá un valor distinto de cero" });
  if (mode === "percent" && (value < -90 || value > 1000)) return res.status(400).json({ error: "El porcentaje debe estar entre -90 y 1000" });
  const step = [1, 10, 100, 1000].includes(Number(b.round)) ? Number(b.round) : 1;

  let rows;
  if (b.scope === "ids") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isFinite);
    if (!ids.length) return res.status(400).json({ error: "Elegí al menos un producto" });
    rows = all(`SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  } else if (b.scope === "category") {
    const cat = one("SELECT id,slug FROM categories WHERE slug=?", [String(b.category || "")]);
    if (!cat) return res.status(400).json({ error: "Elegí una categoría" });
    const slugs = [cat.slug, ...all("SELECT slug FROM categories WHERE parent_id=?", [cat.id]).map((r) => r.slug)];
    rows = all(`SELECT * FROM products WHERE category IN (${slugs.map(() => "?").join(",")})`, slugs);
  } else {
    rows = all("SELECT * FROM products");
  }

  const calc = (p) => Math.max(0, Math.round((mode === "percent" ? p * (1 + value / 100) : p + value) / step) * step);
  const changes = rows
    .map((r) => ({
      id: r.id, name: r.name, from: r.price, to: calc(r.price), wFrom: r.wholesale_price,
      wTo: mode === "percent" && b.includeWholesale && r.wholesale_price ? calc(r.wholesale_price) : r.wholesale_price,
    }))
    .filter((c) => c.to !== c.from || c.wTo !== c.wFrom);

  if (b.dryRun) return res.json({ count: changes.length, sample: changes.slice(0, 8) });
  changes.forEach((c) => exec("UPDATE products SET price=?, wholesale_price=? WHERE id=?", [c.to, c.wTo, c.id]));
  persist();
  res.json({ ok: true, count: changes.length });
});

// ----- Carga desde planilla (el navegador lee el CSV y manda las filas) -----
const yes = (v) => /^(si|sí|s|1|true|x|yes)$/i.test(String(v || "").trim());

/** "Color: Negro|Rojo; Virola: Acero|Alpaca" → [{ name, values }] */
function parseOptionsText(s) {
  return String(s || "").split(";").map((part) => {
    const [name, vals] = part.split(":");
    return { name: (name || "").trim(), values: String(vals || "").split("|").map((v) => v.trim()).filter(Boolean) };
  }).filter((g) => g.name && g.values.length);
}

router.post("/import", (req, res) => {
  const rows = (Array.isArray(req.body.rows) ? req.body.rows : []).slice(0, 1500);
  if (!rows.length) return res.status(400).json({ error: "La planilla no tiene filas" });

  let created = 0, categoriesCreated = 0;
  const errors = [];
  let sort = (one("SELECT MAX(sort) AS m FROM products") || {}).m || 0;

  rows.forEach((r, i) => {
    const line = i + 2, name = text(r.nombre, 120), price = parsePrice(r.precio);
    if (!name) return errors.push(`Fila ${line}: falta el nombre`);
    if (!Number.isFinite(price) || price < 0) return errors.push(`Fila ${line} (${name}): precio inválido`);

    const parts = String(r.categoria || "").split(">").map((s) => s.trim().replace(/\s+/g, " ").slice(0, 60)).filter(Boolean).slice(0, 2);
    if (!parts.length) return errors.push(`Fila ${line} (${name}): falta la categoría`);

    let parent = null, category = null;
    for (const part of parts) {
      const found = ensureCategory(part, parent);
      if (found.created) categoriesCreated++;
      category = found.category;
      parent = category.id;
    }

    let wholesalePrice = r.precio_mayorista ? parsePrice(r.precio_mayorista) : null, wholesaleMin = posInt(r.minimo_mayorista);
    if (!(wholesalePrice > 0 && wholesaleMin)) wholesalePrice = wholesaleMin = null;

    const clean = P.cleanProduct({
      category: category.slug, name, price, description: r.descripcion, tag: r.etiqueta, soldOut: yes(r.sin_stock), featured: yes(r.destacado),
      wholesalePrice, wholesaleMin, stock: nonNegInt(r.stock), options: parseOptionsText(r.opciones),
    });
    if (clean.error) return errors.push(`Fila ${line} (${name}): ${clean.error}`);
    exec(P.INSERT_SQL, [...clean.values, ++sort]);
    created++;
  });

  persist();
  res.json({ created, categoriesCreated, errors: errors.slice(0, 30), errorCount: errors.length });
});

module.exports = router;
