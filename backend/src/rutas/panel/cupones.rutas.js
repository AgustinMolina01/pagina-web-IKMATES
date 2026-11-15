// Cupones de descuento en el panel.
const { Router } = require("express");
const { run } = require("../../base-de-datos/conexion");
const { listCoupons, cleanCoupon } = require("../../servicios/cupones.servicio");

const router = Router();

router.get("/", (req, res) => res.json(listCoupons()));

router.post("/", (req, res) => {
  const c = cleanCoupon(req.body || {});
  if (c.error) return res.status(400).json({ error: c.error });
  res.json({ id: run("INSERT INTO coupons(code,kind,value,min_total,max_uses,expires,active) VALUES(?,?,?,?,?,?,?)", c.values) });
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const c = cleanCoupon(req.body || {}, id);
  if (c.error) return res.status(400).json({ error: c.error });
  run("UPDATE coupons SET code=?,kind=?,value=?,min_total=?,max_uses=?,expires=?,active=? WHERE id=?", [...c.values, id]);
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  run("DELETE FROM coupons WHERE id=?", [Number(req.params.id)]);
  res.json({ ok: true });
});

module.exports = router;
