// Límite de intentos por clave (IP, email…) en una ventana de tiempo. Vive en memoria.
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const recent = (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    hits.set(key, list);
    return list;
  };
  return {
    /** ¿Ya llegó al máximo? (no suma) */
    blocked: (key) => recent(key).length >= max,
    /** Suma un intento (ej: un ingreso fallido). */
    add: (key) => { recent(key).push(Date.now()); },
    /** Suma un intento y dice si está permitido (ej: registros, pedidos). */
    consume(key) {
      const list = recent(key);
      if (list.length >= max) return false;
      list.push(Date.now());
      return true;
    },
  };
}
module.exports = { createLimiter };
