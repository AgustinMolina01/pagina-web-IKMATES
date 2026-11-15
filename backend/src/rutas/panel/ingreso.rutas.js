// Ingreso al panel. login/logout son públicos; me y password exigen sesión (se aplican en index.js).
const { Router } = require("express");
const { createLimiter } = require("../../utilidades/limitador");
const { setAdminCookie, clearAdminCookie, checkAdminPassword, checkAdminLogin, getAdminEmail, changeAdminEmail, usingInitialPassword, changeAdminPassword } = require("../../intermedios/autenticacion");

const open = Router();      // sin sesión
const protectedRoutes = Router(); // con sesión
const failures = createLimiter({ max: 8, windowMs: 15 * 60 * 1000 });

open.post("/login", (req, res) => {
  if (failures.blocked(req.ip)) return res.status(429).json({ error: "Demasiados intentos. Probá en unos minutos." });
  if (!checkAdminLogin(req.body.email, String(req.body.password || ""))) {
    failures.add(req.ip);
    return res.status(401).json({ error: "Correo o contraseña incorrectos" }); // no dice cuál de los dos falló
  }
  setAdminCookie(req, res);
  res.json({ ok: true });
});

open.post("/logout", (req, res) => {
  clearAdminCookie(req, res);
  res.json({ ok: true });
});

protectedRoutes.get("/me", (req, res) => res.json({ ok: true, email: getAdminEmail(), defaultPassword: usingInitialPassword() }));

// Cambiar el correo de ingreso (pide la contraseña actual). No cierra las sesiones abiertas.
protectedRoutes.post("/email", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!checkAdminPassword(String(req.body.current || ""))) return res.status(400).json({ error: "La contraseña actual no es correcta" });
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Escribí un correo válido (ej: tunombre@gmail.com)" });
  changeAdminEmail(email);
  res.json({ ok: true, email });
});

protectedRoutes.post("/password", (req, res) => {
  const current = String(req.body.current || ""), next = String(req.body.next || "");
  if (!checkAdminPassword(current)) return res.status(400).json({ error: "La contraseña actual no es correcta" });
  if (next.length < 8) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  if (next === current) return res.status(400).json({ error: "La nueva contraseña tiene que ser distinta a la actual" });
  changeAdminPassword(next);
  setAdminCookie(req, res); // sigue con sesión
  res.json({ ok: true });
});

module.exports = { open, protectedRoutes };
