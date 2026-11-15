// Cuentas de clientes: registro, ingreso y "Mis pedidos".
const { Router } = require("express");
const { all, one, run } = require("../base-de-datos/conexion");
const { hashPassword, verifyPassword } = require("../utilidades/seguridad");
const { createLimiter } = require("../utilidades/limitador");
const { oneLine, emailOk } = require("../utilidades/validacion");
const { LIMITS } = require("../configuracion");
const { getCustomer, setCustomerCookie, clearCustomerCookie } = require("../intermedios/autenticacion");
const { orderRow } = require("../servicios/compras.servicio");

const router = Router();
const registerLimiter = createLimiter({ max: LIMITS.registerPerHour, windowMs: 60 * 60 * 1000 });
const loginFailures = createLimiter({ max: 8, windowMs: 15 * 60 * 1000 });

const publicCustomer = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone || "" });

router.post("/register", (req, res) => {
  if (!registerLimiter.consume(req.ip)) return res.status(429).json({ error: "Demasiados registros desde esta conexión. Probá más tarde." });
  const name = oneLine(req.body.name, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").replace(/\D/g, "").slice(0, 15);

  if (name.length < 2) return res.status(400).json({ error: "Escribí tu nombre" });
  if (!emailOk(email)) return res.status(400).json({ error: "El email no es válido" });
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
  if (phone && phone.length < 8) return res.status(400).json({ error: "El WhatsApp debe tener código de área (solo números)" });
  if (one("SELECT 1 FROM customers WHERE lower(email)=?", [email])) return res.status(400).json({ error: "Ya existe una cuenta con ese email. Probá ingresar." });

  const id = run("INSERT INTO customers(name,email,phone,pw) VALUES(?,?,?,?)", [name, email, phone, hashPassword(password)]);
  setCustomerCookie(req, res, id);
  res.json({ customer: publicCustomer(one("SELECT * FROM customers WHERE id=?", [id])) });
});

router.post("/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const key = `${req.ip}:${email}`;
  if (loginFailures.blocked(key)) return res.status(429).json({ error: "Demasiados intentos. Probá en unos minutos." });
  const customer = one("SELECT * FROM customers WHERE lower(email)=?", [email]);
  if (!verifyPassword(String(req.body.password || ""), customer && customer.pw)) {
    loginFailures.add(key);
    return res.status(401).json({ error: "Email o contraseña incorrectos" }); // mismo mensaje exista o no el email
  }
  setCustomerCookie(req, res, customer.id);
  res.json({ customer: publicCustomer(customer) });
});

router.post("/logout", (req, res) => {
  clearCustomerCookie(req, res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const customer = getCustomer(req);
  res.json({ customer: customer ? publicCustomer(customer) : null });
});

router.get("/orders", (req, res) => {
  const customer = getCustomer(req);
  if (!customer) return res.status(401).json({ error: "Ingresá a tu cuenta" });
  res.json(all("SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC LIMIT 50", [customer.id]).map(orderRow));
});

module.exports = router;
