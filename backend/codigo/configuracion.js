// Configuración central. Todo se puede cambiar con variables de entorno.
const path = require("path");

const RAIZ = path.join(__dirname, ".."); // carpeta backend/

const DATA_DIR = process.env.DATA_DIR || path.join(RAIZ, "datos");

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  // Contraseña inicial del panel. Después se cambia desde Ajustes (queda guardada con hash).
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "ikmates2024",
  // Correo de ingreso inicial al panel. Después se cambia desde Ajustes (queda guardado en la base).
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || "admin@ikmates.com").trim().toLowerCase(),
  // Si se define, firma las sesiones del panel; si no, se genera y se guarda en la base.
  SESSION_SECRET: process.env.SESSION_SECRET || "",
  DATA_DIR,
  DB_FILE: path.join(DATA_DIR, "ikmates.db"),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(RAIZ, "fotos-subidas"),
  PUBLIC_DIR: process.env.PUBLIC_DIR || path.join(RAIZ, "..", "frontend", "armado"),
  // Dirección pública de la tienda (ej: https://ikmates.com.ar). Si no se define, se toma de cada visita.
  SITE_URL: process.env.SITE_URL || "",
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
  // Límites anti-abuso (por conexión). Se pueden subir con variables de entorno, por ejemplo en pruebas.
  LIMITS: {
    registerPerHour: Number(process.env.REGISTER_LIMIT) || 10,
    ordersPerHour: Number(process.env.ORDER_LIMIT) || 30,
  },
};
