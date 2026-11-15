// Pedidos registrados desde la tienda.
const { Router } = require("express");
const { all, one } = require("../../base-de-datos/conexion");
const {
  orderRow,
  setOrderStatus,
  removeOrder,
  STATUSES,
} = require("../../servicios/compras.servicio");

const router = Router();

router.get("/", (req, res) => {
  const orders = all(
    `SELECT o.*, c.name AS cname, c.email AS cemail, c.phone AS cphone
     FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC LIMIT 300`,
  ).map((r) => ({
    ...orderRow(r),
    customer: r.cname
      ? { name: r.cname, email: r.cemail, phone: r.cphone }
      : null,
  }));
  const sum = one(
    "SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS t FROM orders WHERE status<>'cancelado'",
  );
  res.json({ orders, count: sum.n, total: sum.t });
});

router.put("/:id", (req, res) => {
  const status = String(req.body.status || "");
  if (!STATUSES.includes(status))
    return res.status(400).json({ error: "Estado inválido" });
  if (!setOrderStatus(Number(req.params.id), status))
    return res.status(404).json({ error: "No existe" });
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  removeOrder(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
