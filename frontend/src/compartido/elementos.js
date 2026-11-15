// Atajos para trabajar con el HTML.
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Escapa texto antes de ponerlo dentro de HTML (evita que un nombre con "<" rompa o inyecte código). */
export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Muestra u oculta un elemento (usa el atributo hidden). */
export const toggle = (element, visible) => { if (element) element.hidden = !visible; };

/** Ejecuta fn cuando el usuario deja de escribir durante `ms`. */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
