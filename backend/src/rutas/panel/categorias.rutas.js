// Categorías y subcategorías en el panel.
const { Router } = require("express");
const { all, exec, run, persist } = require("../../base-de-datos/conexion");
const { isActive, safeImg } = require("../../utilidades/validacion");
const C = require("../../servicios/categorias.servicio");

const router = Router();

router.get("/", (req, res) => res.json(C.listCategories()));

router.post("/", (req, res) => {
  const name = C.cleanName(req.body);
  if (!name) return res.status(400).json({ error: "Escribí el nombre de la categoría" });
  const parent = C.checkParent(req.body.parent_id, 0);
  if (parent.error) return res.status(400).json({ error: parent.error });
  if (C.sameNameExists(name, parent.pid, 0)) return res.status(400).json({ error: "Ya existe una categoría con ese nombre en ese lugar" });
  res.json({ id: run("INSERT INTO categories(slug,name,sort,parent_id) VALUES(?,?,?,?)", [C.uniqueSlug(name), name, C.nextSort(parent.pid), parent.pid]) });
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id), current = C.getCategory(id);
  if (!current) return res.status(404).json({ error: "No existe" });
  const name = C.cleanName(req.body);
  if (!name) return res.status(400).json({ error: "Escribí el nombre de la categoría" });
  const parent = "parent_id" in req.body ? C.checkParent(req.body.parent_id, id) : { pid: current.parent_id || null };
  if (parent.error) return res.status(400).json({ error: parent.error });
  if (C.sameNameExists(name, parent.pid, id)) return res.status(400).json({ error: "Ya existe una categoría con ese nombre en ese lugar" });
  // La foto solo cambia si viene en el pedido ("" la quita); renombrar u ocultar la conserva.
  const image = "image" in req.body ? safeImg(req.body.image) : current.image || "";
  run("UPDATE categories SET name=?, active=?, parent_id=?, image=? WHERE id=?", [name, isActive(req.body), parent.pid, image, id]);
  res.json({ ok: true });
});

// Flechas ↑ ↓ (solo entre hermanas: mismo nivel y mismo padre)
router.post("/:id/move", (req, res) => {
  const current = C.getCategory(req.params.id);
  if (!current) return res.json({ ok: true });
  const ids = all("SELECT id FROM categories WHERE COALESCE(parent_id,0)=? ORDER BY sort,id", [current.parent_id || 0]).map((r) => r.id);
  const i = ids.indexOf(current.id), j = i + (Number(req.body.dir) < 0 ? -1 : 1);
  if (j < 0 || j >= ids.length) return res.json({ ok: true });
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((id, n) => exec("UPDATE categories SET sort=? WHERE id=?", [n + 1, id]));
  persist();
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const cat = C.getCategory(req.params.id);
  if (!cat) return res.json({ ok: true });
  const subs = all("SELECT COUNT(*) AS n FROM categories WHERE parent_id=?", [cat.id])[0].n;
  if (subs) return res.status(400).json({ error: `Tiene ${subs} subcategoría${subs > 1 ? "s" : ""}. Eliminalas o movelas antes de borrar esta.` });
  const products = all("SELECT COUNT(*) AS n FROM products WHERE category=?", [cat.slug])[0].n;
  if (products) return res.status(400).json({ error: `Tiene ${products} producto${products > 1 ? "s" : ""}. Movelos a otra categoría o eliminalos antes de borrarla.` });
  run("DELETE FROM categories WHERE id=?", [cat.id]);
  res.json({ ok: true });
});

module.exports = router;
