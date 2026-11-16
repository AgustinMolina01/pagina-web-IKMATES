// Datos del negocio que ella edita desde el panel (Ajustes).
const { all, exec, persist } = require("../base-de-datos/conexion");
const { PRIVACIDAD, TERMINOS, PREGUNTAS } = require("./textos-legales");

const DEFAULTS = {
  whatsapp: "5493412147956",
  hours: "9 a 18 hs",
  address: "San Martín 1974, Rosario",
  heroEyebrow: "Tradición argentina",
  heroTitle: "Tomá mate con",
  heroTitleEm: "estilo propio",
  heroText: "Mates, yerba y combos seleccionados, con envíos a todo el país. Hacé tu pedido en minutos por WhatsApp.",
  instagram: "ikmates",
  facebook: "",
  tiktok: "",
  payments: "",
  shipping: "",
  wholesaleNote: "",
  // Sección "Quiénes somos"
  aboutTitle: "Pasión por el mate",
  aboutText: "En IK Mates creemos que compartir un mate es compartir tiempo. Seleccionamos cada producto para que dure, se vea bien y se disfrute desde el primer cebado.\n\nTrabajamos con atención directa: te asesoramos, armamos tu combo a medida y coordinamos el envío.",
  aboutValues: "Calidad: Productos elegidos uno por uno.\nAsesoramiento: Te ayudamos a elegir el mate ideal.\nRegalos: Combos listos para sorprender.",
  // Preguntas editables que complementan la información automática de compra.
  faqText: PREGUNTAS,
  privacyText: PRIVACIDAD,
  termsText: TERMINOS,
};

const MAX_LENGTH = {
  whatsapp: 15, hours: 80, address: 160, heroEyebrow: 60, heroTitle: 80, heroTitleEm: 80, heroText: 300,
  instagram: 200, facebook: 200, tiktok: 200, payments: 1200, shipping: 1200, wholesaleNote: 300,
  aboutTitle: 80, aboutText: 2000, aboutValues: 600, faqText: 6000,
  privacyText: 8000, termsText: 8000,
};

// Si ella vacía estos campos, vuelve el valor por defecto (la tienda no puede quedar sin ellos).
const REQUIRED = ["hours", "address", "heroTitle", "heroText", "aboutTitle", "aboutText", "privacyText", "termsText"];

function getSettings() {
  const out = { ...DEFAULTS };
  all("SELECT k,v FROM settings").forEach((r) => { if (r.k in out) out[r.k] = r.v; });
  return out;
}

/** Guarda los campos recibidos. Devuelve { error } si alguno no es válido. */
function saveSettings(body = {}) {
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in body)) continue;
    let value = String(body[key] ?? "").trim();
    value = (key === "whatsapp" ? value.replace(/\D/g, "") : value).slice(0, MAX_LENGTH[key]);
    if (key === "whatsapp" && value.length < 8) {
      return { error: "El WhatsApp debe incluir código de país y área, solo números (ej: 5493412147956)" };
    }
    if (REQUIRED.includes(key) && !value) value = DEFAULTS[key];
    exec("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [key, value]);
  }
  persist();
  return {};
}

module.exports = { getSettings, saveSettings, DEFAULTS };
