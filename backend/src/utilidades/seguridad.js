// Contraseñas con hash (scrypt) y comparaciones seguras.
const crypto = require("crypto");

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString("hex")}`;
}

/** Compara una contraseña con su hash. Cuesta lo mismo aunque no exista la cuenta (evita adivinar emails por el tiempo de respuesta). */
function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored || "").split("$");
  if (!salt || !hash) {
    crypto.scryptSync(pw, "x", 32);
    return false;
  }
  return safeEqual(crypto.scryptSync(pw, salt, 32).toString("hex"), hash);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const hmac = (secret, value) => crypto.createHmac("sha256", secret).update(value).digest("hex");
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
/** Contraseña temporal legible de 10 caracteres. */
const tempPassword = () => crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);

module.exports = { hashPassword, verifyPassword, safeEqual, hmac, randomToken, tempPassword };
