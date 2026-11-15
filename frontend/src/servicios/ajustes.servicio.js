// Datos del negocio (editables en el panel): se aplican a todo elemento con data-s="clave".
import { $$ } from "../compartido/elementos.js";
import { state, emit } from "./estado.js";

/** Enlace de WhatsApp del negocio con un mensaje armado. */
export const waLink = (message) => `https://wa.me/${state.settings.whatsapp}?text=${encodeURIComponent(message)}`;

export const helloLink = () => waLink("Hola IK Mates! Quisiera hacer una consulta.");

/**
 * Pone cada dato en su lugar. En el HTML:
 *   <span data-s="hours">9 a 18 hs</span>
 *   <span data-s="hours" data-fmt="Te asesoramos de {v}">…</span>
 */
export function applySettings() {
  $$("[data-s]").forEach((el) => {
    el.textContent = (el.dataset.fmt || "{v}").replace("{v}", state.settings[el.dataset.s] ?? "");
  });
}

export function setSettings(settings) {
  state.settings = { ...state.settings, ...settings };
  applySettings();
  emit("settings");
}
