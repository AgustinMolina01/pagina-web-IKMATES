// Sesiones por cookie firmada: una para el panel (ik_admin) y otra, con clave distinta, para clientes (ik_user).
const config = require("../configuracion");
const { one, getMeta, setMeta, persist } = require("../base-de-datos/conexion");
const { hashPassword, verifyPassword, safeEqual, hmac, randomToken } = require("../utilidades/seguridad");

const ADMIN_COOKIE = "ik_admin";
const CUSTOMER_COOKIE = "ik_user";

// Claves de firma: se leen de la base, así las sesiones sobreviven a un reinicio.
const adminSecret = () => config.SESSION_SECRET || getMeta("secret");
const customerSecret = () => getMeta("csecret");

function getCookie(req, name) {
  const found = (req.headers.cookie || "").split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}
const cookie = (req, name, value, maxAge, sameSite) =>
  `${name}=${value}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}${req.secure ? "; Secure" : ""}`;

// ---------- Panel de administración ----------
const makeAdminToken = () => {
  const exp = Date.now() + 12 * 3600 * 1000;
  return `${exp}.${hmac(adminSecret(), String(exp))}`;
};
function validAdminToken(token) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, hmac(adminSecret(), exp));
}
const setAdminCookie = (req, res) => res.setHeader("Set-Cookie", cookie(req, ADMIN_COOKIE, makeAdminToken(), 43200, "Strict"));
const clearAdminCookie = (req, res) => res.setHeader("Set-Cookie", cookie(req, ADMIN_COOKIE, "", 0, "Strict"));
const requireAdmin = (req, res, next) =>
  validAdminToken(getCookie(req, ADMIN_COOKIE)) ? next() : res.status(401).json({ error: "No autorizado" });

/** ¿Es la contraseña del panel? Usa la guardada con hash; si nunca se cambió, la inicial. */
function checkAdminPassword(pw) {
  const stored = getMeta("pw");
  if (stored) return verifyPassword(pw, stored);
  return safeEqual(hmac("init", pw), hmac("init", config.ADMIN_PASSWORD));
}
/** Correo de ingreso al panel (guardado o el inicial). Siempre en minúsculas. */
const getAdminEmail = () => (getMeta("admin_email") || config.ADMIN_EMAIL).toLowerCase();

/** ¿Coinciden correo y contraseña? Se revisan los dos siempre, para no dar pistas de cuál estaba mal. */
function checkAdminLogin(email, pw) {
  const emailOk = safeEqual(hmac("mail", String(email || "").trim().toLowerCase()), hmac("mail", getAdminEmail()));
  const pwOk = checkAdminPassword(pw);
  return emailOk && pwOk;
}

function changeAdminEmail(email) {
  setMeta("admin_email", String(email).trim().toLowerCase());
  persist();
}

const usingInitialPassword = () => !getMeta("pw") && !process.env.ADMIN_PASSWORD;

function changeAdminPassword(next) {
  setMeta("pw", hashPassword(next));
  if (!config.SESSION_SECRET) setMeta("secret", randomToken()); // cierra las demás sesiones del panel
  persist();
}

// ---------- Clientes ----------
const makeCustomerToken = (id) => {
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  return `${id}.${exp}.${hmac(customerSecret(), `u${id}.${exp}`)}`;
};
function getCustomer(req) {
  const token = getCookie(req, CUSTOMER_COOKIE);
  if (!token) return null;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, hmac(customerSecret(), `u${id}.${exp}`))) return null;
  return one("SELECT * FROM customers WHERE id=?", [Number(id)]) || null;
}
const setCustomerCookie = (req, res, id) => res.setHeader("Set-Cookie", cookie(req, CUSTOMER_COOKIE, makeCustomerToken(id), 2592000, "Lax"));
const clearCustomerCookie = (req, res) => res.setHeader("Set-Cookie", cookie(req, CUSTOMER_COOKIE, "", 0, "Lax"));

module.exports = {
  requireAdmin, setAdminCookie, clearAdminCookie, checkAdminPassword, checkAdminLogin, getAdminEmail, changeAdminEmail, usingInitialPassword, changeAdminPassword,
  getCustomer, setCustomerCookie, clearCustomerCookie,
};
