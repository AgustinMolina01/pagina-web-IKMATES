// Clientes registrados: lista, contraseña temporal y baja de cuenta.
const { Router } = require("express");
const { all, one, exec, run } = require("../../base-de-datos/conexion");
const { hashPassword, tempPassword } = require("../../utilidades/seguridad");

const router = Router();

// Nunca se devuelve el hash de la contraseña
router.get("/", (req, res) => res.json(all(
  `SELECT c.id,c.name,c.email,c.phone,c.created_at,
          (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id) AS orders
   FROM customers c ORDER BY c.id DESC`)));

router.post("/:id/reset-password", (req, res) => {
  const customer = one("SELECT id FROM customers WHERE id=?", [Number(req.params.id)]);
  if (!customer) return res.status(404).json({ error: "No existe" });
  const temp = tempPassword();
  run("UPDATE customers SET pw=? WHERE id=?", [hashPassword(temp), customer.id]);
  res.json({ password: temp });
});

router.delete("/:id", (req, res) => {
  exec("UPDATE orders SET customer_id=NULL WHERE customer_id=?", [Number(req.params.id)]); // los pedidos quedan registrados
  run("DELETE FROM customers WHERE id=?", [Number(req.params.id)]);
  res.json({ ok: true });
});

module.exports = router;
