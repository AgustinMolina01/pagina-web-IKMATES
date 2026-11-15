// Envíos y formas de pago que ve el cliente al finalizar la compra.
const { Router } = require("express");
const { all, exec, run, persist } = require("../../base-de-datos/conexion");
const { isActive, bool, text, nonNegInt } = require("../../utilidades/validacion");
const { listShipping, listPayments, provincePrices } = require("../../servicios/compras.servicio");

const shipping = Router();
const payments = Router();

// Sube o baja un elemento dentro de su tabla (reordena todo para evitar empates)
function move(table, id, dir) {
  const ids = all(`SELECT id FROM ${table} ORDER BY sort,id`).map((r) => r.id);
  const i = ids.indexOf(Number(id)), j = i + (Number(dir) < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((x, n) => exec(`UPDATE ${table} SET sort=? WHERE id=?`, [n + 1, x]));
  persist();
}
const nextSort = (table) => ((all(`SELECT MAX(sort) AS m FROM ${table}`)[0] || {}).m || 0) + 1;

// ---------- Envíos ----------
function cleanShipping(b) {
  const name = text(b.name, 60);
  if (!name) return { error: "Escribí el nombre del envío (ej: Retiro en el local)" };
  const blank = b.price === "" || b.price === null || b.price === undefined;
  const price = nonNegInt(b.price);
  if (!blank && price === null) return { error: "El costo debe ser un número (0 si es gratis). Dejalo vacío para 'a coordinar'" };
  const freeFrom = nonNegInt(b.freeFrom);
  if (b.freeFrom !== "" && b.freeFrom != null && freeFrom === null) return { error: "El monto para envío gratis debe ser un número" };
  // Costo según la provincia: el "gratis desde" vale igual; las provincias sin precio quedan "a coordinar"
  const prices = provincePrices(b.provincePrices);
  const byProvince = Object.keys(prices).length > 0;
  if (byProvince && Object.values(prices).every((v) => v === null)) return { error: "Poné el costo de al menos una provincia" };
  return { values: [name, text(b.description, 200), byProvince ? null : price, byProvince || price !== null ? freeFrom : null, bool(b.needsAddress), isActive(b), byProvince ? JSON.stringify(prices) : ""] };
}
shipping.get("/", (req, res) => res.json(listShipping()));
shipping.post("/", (req, res) => {
  const c = cleanShipping(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json({ id: run("INSERT INTO shipping_methods(name,description,price,free_from,needs_address,active,province_prices,sort) VALUES(?,?,?,?,?,?,?,?)", [...c.values, nextSort("shipping_methods")]) });
});
shipping.put("/:id", (req, res) => {
  const c = cleanShipping(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  run("UPDATE shipping_methods SET name=?,description=?,price=?,free_from=?,needs_address=?,active=?,province_prices=? WHERE id=?", [...c.values, Number(req.params.id)]);
  res.json({ ok: true });
});
shipping.post("/:id/move", (req, res) => { move("shipping_methods", req.params.id, req.body.dir); res.json({ ok: true }); });
shipping.delete("/:id", (req, res) => { run("DELETE FROM shipping_methods WHERE id=?", [Number(req.params.id)]); res.json({ ok: true }); });

// ---------- Formas de pago ----------
function cleanPayment(b) {
  const name = text(b.name, 60);
  if (!name) return { error: "Escribí el nombre de la forma de pago (ej: Transferencia bancaria)" };
  const discount = b.discount === "" || b.discount == null ? 0 : nonNegInt(b.discount);
  if (discount === null || discount > 90) return { error: "El descuento debe ser un número entre 0 y 90" };
  return { values: [name, text(b.description, 200), discount, isActive(b)] };
}
payments.get("/", (req, res) => res.json(listPayments()));
payments.post("/", (req, res) => {
  const c = cleanPayment(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json({ id: run("INSERT INTO payment_methods(name,description,discount,active,sort) VALUES(?,?,?,?,?)", [...c.values, nextSort("payment_methods")]) });
});
payments.put("/:id", (req, res) => {
  const c = cleanPayment(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  run("UPDATE payment_methods SET name=?,description=?,discount=?,active=? WHERE id=?", [...c.values, Number(req.params.id)]);
  res.json({ ok: true });
});
payments.post("/:id/move", (req, res) => { move("payment_methods", req.params.id, req.body.dir); res.json({ ok: true }); });
payments.delete("/:id", (req, res) => { run("DELETE FROM payment_methods WHERE id=?", [Number(req.params.id)]); res.json({ ok: true }); });

module.exports = { shipping, payments };
